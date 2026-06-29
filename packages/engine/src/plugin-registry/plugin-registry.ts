// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — PluginRegistry
//
// Discovers, loads and manages the lifecycle of GarageBuild plugins.
//
// Phase 1 sandboxing tiers:
//   Tier 1 (trusted)     — same process, direct instance registration
//   Tier 2 (lightweight) — separate Node.js process + IPC (future)
//   Tier 3 (full)        — WASM / container (future)
//
// Today only Tier 1 is implemented. Plugins are registered by passing an
// instance directly. DB records are persisted so the registry survives
// restarts (future: load from entry_point on startup).
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import type { GarageBuildPlugin, ModelPlugin, FrameworkPlugin, AgentPlugin, DeploymentPlugin } from '@garagebuild/plugin-sdk';
import type { PluginType, PluginConfig, SandboxTier } from '@garagebuild/plugin-sdk';
import { eventBus } from '../event-bus/event-bus.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginRecord {
  id: string;
  workspaceId: string;
  name: string;
  version: string;
  type: PluginType;
  entryPoint: string;
  sandboxTier: SandboxTier;
  isActive: boolean;
  config: PluginConfig;
  installedAt: string;
}

export interface RegisterPluginOptions {
  name: string;
  version: string;
  type: PluginType;
  entryPoint: string;
  sandboxTier?: SandboxTier;
  config?: PluginConfig;
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface PluginConfigRow {
  id: string;
  workspace_id: string;
  name: string;
  version: string;
  type: string;
  entry_point: string;
  sandbox_tier: string;
  is_active: number;
  config: string;
  installed_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToRecord(row: PluginConfigRow): PluginRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    version: row.version,
    type: row.type as PluginType,
    entryPoint: row.entry_point,
    sandboxTier: row.sandbox_tier as SandboxTier,
    isActive: row.is_active === 1,
    config: JSON.parse(row.config) as PluginConfig,
    installedAt: row.installed_at,
  };
}

// ── PluginRegistry ────────────────────────────────────────────────────────────

export class PluginRegistry {
  private readonly instances = new Map<string, GarageBuildPlugin>();

  constructor(
    private readonly db: Database.Database,
    private readonly workspaceId: string,
  ) {}

  /**
   * Register a plugin instance directly (Tier 1 — trusted, same process).
   * Persists a record in the DB so it can be referenced by name later.
   * If a record with the same name already exists it is reused.
   */
  async register(plugin: GarageBuildPlugin, config?: PluginConfig): Promise<PluginRecord> {
    const manifest = plugin.getManifest();
    const effectiveConfig = config ?? {};

    let record = this.findRecord(manifest.id);

    if (!record) {
      const id = manifest.id;
      const now = new Date().toISOString();

      this.db.prepare(`
        INSERT INTO plugin_configs
          (id, workspace_id, name, version, type, entry_point, sandbox_tier, is_active, config, installed_at)
        VALUES (?, ?, ?, ?, ?, ?, 'trusted', 1, ?, ?)
      `).run(
        id,
        this.workspaceId,
        manifest.name,
        manifest.version,
        manifest.type,
        manifest.entry,
        JSON.stringify(effectiveConfig),
        now,
      );

      record = this.getRecord(id);

      eventBus.emit('plugin.installed', {
        pluginId: id,
        name: manifest.name,
        type: manifest.type,
      });
    }

    await plugin.initialize(record.config);
    this.instances.set(record.id, plugin);

    eventBus.emit('plugin.activated', { pluginId: record.id });

    return record;
  }

  /**
   * Deactivate a loaded plugin by its manifest id.
   */
  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.instances.get(pluginId);

    if (plugin) {
      await plugin.teardown();
      this.instances.delete(pluginId);
    }

    this.db
      .prepare('UPDATE plugin_configs SET is_active = 0 WHERE id = ?')
      .run(pluginId);

    eventBus.emit('plugin.deactivated', { pluginId });
  }

  /**
   * Get a loaded plugin instance by its manifest id.
   */
  getPlugin(pluginId: string): GarageBuildPlugin {
    const plugin = this.instances.get(pluginId);
    if (!plugin) throw new Error(`Plugin not loaded: ${pluginId}`);
    return plugin;
  }

  /**
   * Find a model plugin by provider name.
   * Provider name matches the plugin manifest id (e.g. 'openai', 'anthropic').
   */
  getModelPlugin(provider: string): ModelPlugin {
    const plugin = this.instances.get(provider);
    if (!plugin) throw new Error(`Model plugin not found for provider: ${provider}`);
    return plugin as ModelPlugin;
  }

  getFrameworkPlugin(framework: string): FrameworkPlugin {
    const plugin = this.instances.get(framework);
    if (!plugin) throw new Error(`Framework plugin not found: ${framework}`);
    return plugin as FrameworkPlugin;
  }

  getAgentPlugin(agentId: string): AgentPlugin {
    const plugin = this.instances.get(agentId);
    if (!plugin) throw new Error(`Agent plugin not found: ${agentId}`);
    return plugin as AgentPlugin;
  }

  getDeploymentPlugin(target: string): DeploymentPlugin {
    const plugin = this.instances.get(target);
    if (!plugin) throw new Error(`Deployment plugin not found: ${target}`);
    return plugin as DeploymentPlugin;
  }

  listLoaded(): PluginRecord[] {
    const ids = Array.from(this.instances.keys());
    return ids.map(id => this.getRecord(id));
  }

  listRecords(filter?: { type?: PluginType }): PluginRecord[] {
    let query = 'SELECT * FROM plugin_configs WHERE workspace_id = ?';
    const params: unknown[] = [this.workspaceId];

    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }

    query += ' ORDER BY installed_at ASC';

    const rows = this.db.prepare(query).all(...params) as PluginConfigRow[];
    return rows.map(rowToRecord);
  }

  async healthCheckAll(): Promise<Record<string, { status: string; message: string | undefined }>> {
    const results: Record<string, { status: string; message: string | undefined }> = {};

    for (const [id, plugin] of this.instances) {
      try {
        const health = await plugin.healthCheck();
        results[id] = { status: health.status, message: health.message };
      } catch (err) {
        results[id] = { status: 'unhealthy', message: String(err) };
        eventBus.emit('plugin.error', { pluginId: id, error: String(err) });
      }
    }

    return results;
  }

  async teardownAll(): Promise<void> {
    for (const [id, plugin] of this.instances) {
      try {
        await plugin.teardown();
      } catch (err) {
        eventBus.emit('plugin.error', { pluginId: id, error: String(err) });
      }
    }
    this.instances.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private getRecord(pluginId: string): PluginRecord {
    const row = this.db
      .prepare('SELECT * FROM plugin_configs WHERE id = ?')
      .get(pluginId) as PluginConfigRow | undefined;

    if (!row) throw new Error(`Plugin record not found: ${pluginId}`);

    return rowToRecord(row);
  }

  private findRecord(pluginId: string): PluginRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM plugin_configs WHERE id = ? AND workspace_id = ?')
      .get(pluginId, this.workspaceId) as PluginConfigRow | undefined;

    return row ? rowToRecord(row) : undefined;
  }
}
