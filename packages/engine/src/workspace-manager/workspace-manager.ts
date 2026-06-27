// ─────────────────────────────────────────────────────────────────────────────
// VYOM Engine — WorkspaceManager
//
// The first subsystem to initialise. Owns the root workspace, settings,
// model configurations and plugin registrations.
//
// All state changes emit events through the Event Bus.
// No other subsystem calls WorkspaceManager directly — they listen to events.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { eventBus } from '../event-bus/event-bus.js';
import { initDatabase } from './database.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  theme?: 'dark' | 'light';
  defaultModelId?: string;
  telemetryEnabled?: boolean;
}

export interface ModelConfig {
  id: string;
  workspaceId: string;
  provider: string;
  modelName: string;
  displayName: string;
  apiKeyRef?: string;
  baseUrl?: string;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  isLocal: boolean;
  isActive: boolean;
  contextWindow: number;
  capabilities: string[];
  createdAt: string;
}

export interface AddModelConfigOptions {
  provider: string;
  modelName: string;
  displayName: string;
  apiKeyRef?: string;
  baseUrl?: string;
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
  isLocal?: boolean;
  contextWindow?: number;
  capabilities?: string[];
}

// ── Row types (SQLite raw rows) ───────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  name: string;
  owner: string;
  created_at: string;
  updated_at: string;
  settings: string;
}

interface ModelConfigRow {
  id: string;
  workspace_id: string;
  provider: string;
  model_name: string;
  display_name: string;
  api_key_ref: string | null;
  base_url: string | null;
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
  is_local: number;
  is_active: number;
  context_window: number;
  capabilities: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: JSON.parse(row.settings) as WorkspaceSettings,
  };
}

function rowToModelConfig(row: ModelConfigRow): ModelConfig {
  const config: ModelConfig = {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    modelName: row.model_name,
    displayName: row.display_name,
    costPer1kInputTokens: row.cost_per_1k_input_tokens,
    costPer1kOutputTokens: row.cost_per_1k_output_tokens,
    isLocal: row.is_local === 1,
    isActive: row.is_active === 1,
    contextWindow: row.context_window,
    capabilities: JSON.parse(row.capabilities) as string[],
    createdAt: row.created_at,
  };

  if (row.api_key_ref !== null) {
    config.apiKeyRef = row.api_key_ref;
  }

  if (row.base_url !== null) {
    config.baseUrl = row.base_url;
  }

  return config;
}

// ── WorkspaceManager ──────────────────────────────────────────────────────────

/**
 * WorkspaceManager — owns the root workspace and all its configuration.
 *
 * Initialise once at startup:
 *   const manager = new WorkspaceManager();
 *   const workspace = await manager.initialize();
 *
 * After that, the workspace is ready and all subsystems can use it.
 */
export class WorkspaceManager {
  private db!: Database.Database;
  private workspace!: Workspace;
  private initialized = false;

  /**
   * Initialize the workspace manager.
   * Creates ~/.vyom/ and the SQLite database if they don't exist.
   * Creates the default workspace on first run.
   * Emits 'workspace.created' on first run or 'workspace.updated' on subsequent runs.
   */
  async initialize(dbPath?: string): Promise<Workspace> {
    // Set up the database
    this.db = initDatabase(dbPath);

    // Load or create the workspace
    const existingRow = this.db
      .prepare('SELECT * FROM workspaces LIMIT 1')
      .get() as WorkspaceRow | undefined;

    if (existingRow) {
      this.workspace = rowToWorkspace(existingRow);
    } else {
      // First run — create the default workspace
      const id = randomUUID();
      const now = new Date().toISOString();

      this.db.prepare(`
        INSERT INTO workspaces (id, name, owner, created_at, updated_at, settings)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, 'My Workspace', 'local', now, now, '{}');

      const row = this.db
        .prepare('SELECT * FROM workspaces WHERE id = ?')
        .get(id) as WorkspaceRow;

      this.workspace = rowToWorkspace(row);

      eventBus.emit('workspace.created', {
        workspaceId: this.workspace.id,
        name: this.workspace.name,
      });
    }

    this.initialized = true;
    return this.workspace;
  }

  // ── Workspace ───────────────────────────────────────────────────────────────

  /**
   * Returns the current workspace.
   * Throws if initialize() has not been called.
   */
  getWorkspace(): Workspace {
    this.assertInitialized();
    return this.workspace;
  }

  /**
   * Updates workspace settings.
   * Merges the provided settings with the existing ones.
   */
  updateSettings(settings: Partial<WorkspaceSettings>): Workspace {
    this.assertInitialized();

    const merged = { ...this.workspace.settings, ...settings };
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE workspaces
      SET settings = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(merged), now, this.workspace.id);

    this.workspace = {
      ...this.workspace,
      settings: merged,
      updatedAt: now,
    };

    eventBus.emit('workspace.updated', { workspaceId: this.workspace.id });

    return this.workspace;
  }

  // ── Model Configurations ────────────────────────────────────────────────────

  /**
   * Adds a new AI model configuration to the workspace.
   * If this is the first model, it is automatically set as active.
   */
  addModelConfig(options: AddModelConfigOptions): ModelConfig {
    this.assertInitialized();

    const id = randomUUID();
    const existingModels = this.listModelConfigs();
    const isFirstModel = existingModels.length === 0;

    this.db.prepare(`
      INSERT INTO model_configs (
        id, workspace_id, provider, model_name, display_name,
        api_key_ref, base_url,
        cost_per_1k_input_tokens, cost_per_1k_output_tokens,
        is_local, is_active, context_window, capabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      this.workspace.id,
      options.provider,
      options.modelName,
      options.displayName,
      options.apiKeyRef ?? null,
      options.baseUrl ?? null,
      options.costPer1kInputTokens ?? 0,
      options.costPer1kOutputTokens ?? 0,
      options.isLocal ? 1 : 0,
      isFirstModel ? 1 : 0,
      options.contextWindow ?? 4096,
      JSON.stringify(options.capabilities ?? ['chat']),
    );

    const row = this.db
      .prepare('SELECT * FROM model_configs WHERE id = ?')
      .get(id) as ModelConfigRow;

    const config = rowToModelConfig(row);

    eventBus.emit('model.configured', {
      modelId: config.id,
      provider: config.provider,
      model: config.modelName,
    });

    return config;
  }

  /**
   * Returns all model configurations for this workspace.
   */
  listModelConfigs(): ModelConfig[] {
    this.assertInitialized();

    const rows = this.db
      .prepare('SELECT * FROM model_configs WHERE workspace_id = ? ORDER BY created_at ASC')
      .all(this.workspace.id) as ModelConfigRow[];

    return rows.map(rowToModelConfig);
  }

  /**
   * Returns the currently active model configuration.
   * Returns undefined if no models are configured.
   */
  getActiveModel(): ModelConfig | undefined {
    this.assertInitialized();

    const row = this.db
      .prepare('SELECT * FROM model_configs WHERE workspace_id = ? AND is_active = 1')
      .get(this.workspace.id) as ModelConfigRow | undefined;

    return row ? rowToModelConfig(row) : undefined;
  }

  /**
   * Sets a model as the active model.
   * Deactivates all other models in the workspace.
   */
  setActiveModel(modelId: string): ModelConfig {
    this.assertInitialized();

    const row = this.db
      .prepare('SELECT * FROM model_configs WHERE id = ? AND workspace_id = ?')
      .get(modelId, this.workspace.id) as ModelConfigRow | undefined;

    if (!row) {
      throw new Error(`Model config not found: ${modelId}`);
    }

    // Deactivate all models then activate the chosen one
    this.db
      .prepare('UPDATE model_configs SET is_active = 0 WHERE workspace_id = ?')
      .run(this.workspace.id);

    this.db
      .prepare('UPDATE model_configs SET is_active = 1 WHERE id = ?')
      .run(modelId);

    const previous = this.getActiveModel();

    eventBus.emit('model.switched', {
      from: previous?.id ?? '',
      to: modelId,
      sessionId: '',
    });

    const updated = this.db
      .prepare('SELECT * FROM model_configs WHERE id = ?')
      .get(modelId) as ModelConfigRow;

    return rowToModelConfig(updated);
  }

  /**
   * Removes a model configuration.
   * If the removed model was active and other models exist,
   * the first remaining model becomes active.
   */
  removeModelConfig(modelId: string): void {
    this.assertInitialized();

    const row = this.db
      .prepare('SELECT * FROM model_configs WHERE id = ? AND workspace_id = ?')
      .get(modelId, this.workspace.id) as ModelConfigRow | undefined;

    if (!row) {
      throw new Error(`Model config not found: ${modelId}`);
    }

    const wasActive = row.is_active === 1;

    this.db
      .prepare('DELETE FROM model_configs WHERE id = ?')
      .run(modelId);

    // If we removed the active model, activate the next one
    if (wasActive) {
      const next = this.db
        .prepare('SELECT * FROM model_configs WHERE workspace_id = ? LIMIT 1')
        .get(this.workspace.id) as ModelConfigRow | undefined;

      if (next) {
        this.db
          .prepare('UPDATE model_configs SET is_active = 1 WHERE id = ?')
          .run(next.id);
      }
    }
  }

  // ── Teardown ─────────────────────────────────────────────────────────────────

  /**
   * Closes the database connection.
   * Call this when VYOM is shutting down.
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('WorkspaceManager not initialized. Call initialize() first.');
    }
  }
}
