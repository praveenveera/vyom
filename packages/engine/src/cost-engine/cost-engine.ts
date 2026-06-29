// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — CostEngine
//
// Records token usage and calculates cost summaries.
// Driven entirely by events — it listens to 'message.completed' and records
// the usage without being called directly by SessionManager.
//
// This is how the Event Bus decoupling principle works in practice:
//   SessionManager.emit('message.completed')  → CostEngine records usage
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { eventBus } from '../event-bus/event-bus.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenUsage {
  id: string;
  messageId: string;
  sessionId: string;
  projectId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  isLocal: boolean;
  timestamp: string;
}

export type UsageScope = 'session' | 'project' | 'workspace';

export interface ProviderUsage {
  tokens: number;
  costUsd: number;
}

export interface UsageSummary {
  scope: UsageScope;
  scopeId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  localTokens: number;
  cloudTokens: number;
  byProvider: Record<string, ProviderUsage>;
  byModel: Record<string, ProviderUsage>;
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface TokenUsageRow {
  id: string;
  message_id: string;
  session_id: string;
  project_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  is_local: number;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToTokenUsage(row: TokenUsageRow): TokenUsage {
  return {
    id: row.id,
    messageId: row.message_id,
    sessionId: row.session_id,
    projectId: row.project_id,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    isLocal: row.is_local === 1,
    timestamp: row.timestamp,
  };
}

// ── CostEngine ────────────────────────────────────────────────────────────────

export class CostEngine {
  private subscription: { unsubscribe: () => void } | undefined;

  constructor(private readonly db: Database.Database) {}

  /**
   * Subscribe to 'message.completed' events and automatically record usage.
   * Call this once at startup.
   */
  attach(): void {
    this.subscription = eventBus.on('message.completed', (payload) => {
      this.recordUsage({
        messageId: payload.messageId,
        sessionId: payload.sessionId,
        projectId: payload.projectId,
        provider: payload.provider,
        model: payload.model,
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        costUsd: payload.costUsd,
        isLocal: payload.isLocal,
      });
    });
  }

  /**
   * Unsubscribe from events. Call on shutdown.
   */
  detach(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  recordUsage(options: Omit<TokenUsage, 'id' | 'totalTokens' | 'timestamp'>): TokenUsage {
    const id = randomUUID();
    const now = new Date().toISOString();
    const totalTokens = options.inputTokens + options.outputTokens;

    this.db.prepare(`
      INSERT INTO token_usage (
        id, message_id, session_id, project_id,
        provider, model,
        input_tokens, output_tokens, total_tokens,
        cost_usd, is_local, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      options.messageId,
      options.sessionId,
      options.projectId,
      options.provider,
      options.model,
      options.inputTokens,
      options.outputTokens,
      totalTokens,
      options.costUsd,
      options.isLocal ? 1 : 0,
      now,
    );

    const row = this.db
      .prepare('SELECT * FROM token_usage WHERE id = ?')
      .get(id) as TokenUsageRow;

    const usage = rowToTokenUsage(row);

    eventBus.emit('usage.recorded', {
      messageId: usage.messageId,
      costUsd: usage.costUsd,
      totalTokens: usage.totalTokens,
    });

    return usage;
  }

  getSessionSummary(sessionId: string): UsageSummary {
    const rows = this.db
      .prepare('SELECT * FROM token_usage WHERE session_id = ?')
      .all(sessionId) as TokenUsageRow[];

    return buildSummary('session', sessionId, rows);
  }

  getProjectSummary(projectId: string): UsageSummary {
    const rows = this.db
      .prepare('SELECT * FROM token_usage WHERE project_id = ?')
      .all(projectId) as TokenUsageRow[];

    return buildSummary('project', projectId, rows);
  }

  getWorkspaceSummary(workspaceId: string): UsageSummary {
    const rows = this.db.prepare(`
      SELECT tu.* FROM token_usage tu
      JOIN projects p ON tu.project_id = p.id
      WHERE p.workspace_id = ?
    `).all(workspaceId) as TokenUsageRow[];

    return buildSummary('workspace', workspaceId, rows);
  }
}

function buildSummary(scope: UsageScope, scopeId: string, rows: TokenUsageRow[]): UsageSummary {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let localTokens = 0;
  let cloudTokens = 0;
  const byProvider: Record<string, ProviderUsage> = {};
  const byModel: Record<string, ProviderUsage> = {};

  for (const row of rows) {
    const total = row.total_tokens;
    totalInputTokens += row.input_tokens;
    totalOutputTokens += row.output_tokens;
    totalCostUsd += row.cost_usd;

    if (row.is_local === 1) {
      localTokens += total;
    } else {
      cloudTokens += total;
    }

    byProvider[row.provider] ??= { tokens: 0, costUsd: 0 };
    byProvider[row.provider].tokens += total;
    byProvider[row.provider].costUsd += row.cost_usd;

    const modelKey = `${row.provider}/${row.model}`;
    byModel[modelKey] ??= { tokens: 0, costUsd: 0 };
    byModel[modelKey].tokens += total;
    byModel[modelKey].costUsd += row.cost_usd;
  }

  return {
    scope,
    scopeId,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCostUsd,
    localTokens,
    cloudTokens,
    byProvider,
    byModel,
  };
}
