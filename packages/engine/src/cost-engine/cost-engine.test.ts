// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — CostEngine Tests
// ─────────────────────────────────────────────────────────────────────────────

import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID as uuid } from 'crypto';
import { jest } from '@jest/globals';
import { initDatabase } from '../workspace-manager/database.js';
import { CostEngine } from './cost-engine.js';
import { eventBus } from '../event-bus/event-bus.js';

function tempDbPath(): string {
  return join(tmpdir(), `garagebuild-test-${uuid()}.db`);
}

const WORKSPACE_ID = 'ws-001';
const PROJECT_ID = 'proj-001';
const SESSION_ID = 'sess-001';
const MESSAGE_ID = 'msg-001';

function makeEngine() {
  const db = initDatabase(tempDbPath());
  db.prepare(`INSERT INTO workspaces (id, name, owner, created_at, updated_at, settings) VALUES (?, 'WS', 'local', datetime('now'), datetime('now'), '{}')`).run(WORKSPACE_ID);
  db.prepare(`INSERT INTO projects (id, workspace_id, name, description, framework, path, status, created_at, updated_at) VALUES (?, ?, 'App', '', 'react', '/tmp', 'active', datetime('now'), datetime('now'))`).run(PROJECT_ID, WORKSPACE_ID);
  db.prepare(`INSERT INTO sessions (id, project_id, name, started_at) VALUES (?, ?, 'S1', datetime('now'))`).run(SESSION_ID, PROJECT_ID);
  db.prepare(`INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, 'assistant', 'Hi', datetime('now'))`).run(MESSAGE_ID, SESSION_ID);

  return { db, engine: new CostEngine(db) };
}

const BASE_USAGE = {
  messageId: MESSAGE_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  provider: 'anthropic',
  model: 'claude-haiku',
  inputTokens: 100,
  outputTokens: 200,
  costUsd: 0.005,
  isLocal: false,
};

describe('CostEngine', () => {
  let db: ReturnType<typeof initDatabase>;
  let engine: CostEngine;

  beforeEach(() => {
    ({ db, engine } = makeEngine());
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    engine.detach();
    db.close();
  });

  // ── recordUsage ────────────────────────────────────────────────────────────

  describe('recordUsage()', () => {
    it('stores usage and returns it', () => {
      const usage = engine.recordUsage(BASE_USAGE);
      expect(usage.id).toBeDefined();
      expect(usage.provider).toBe('anthropic');
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(200);
      expect(usage.totalTokens).toBe(300);
      expect(usage.costUsd).toBe(0.005);
      expect(usage.isLocal).toBe(false);
    });

    it('computes totalTokens as input + output', () => {
      const usage = engine.recordUsage({ ...BASE_USAGE, inputTokens: 40, outputTokens: 60 });
      expect(usage.totalTokens).toBe(100);
    });

    it('emits usage.recorded', () => {
      const handler = jest.fn<(p: { messageId: string; costUsd: number; totalTokens: number }) => void>();
      eventBus.on('usage.recorded', handler);

      engine.recordUsage(BASE_USAGE);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: MESSAGE_ID, costUsd: 0.005, totalTokens: 300 }),
      );
    });

    it('handles local (free) models with zero cost', () => {
      const usage = engine.recordUsage({ ...BASE_USAGE, provider: 'ollama', model: 'llama3', costUsd: 0, isLocal: true });
      expect(usage.isLocal).toBe(true);
      expect(usage.costUsd).toBe(0);
    });
  });

  // ── attach / event-driven recording ───────────────────────────────────────

  describe('attach()', () => {
    it('auto-records usage when message.completed fires', () => {
      engine.attach();

      eventBus.emit('message.completed', {
        messageId: MESSAGE_ID,
        sessionId: SESSION_ID,
        projectId: PROJECT_ID,
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 50,
        outputTokens: 150,
        costUsd: 0.003,
        isLocal: false,
        latencyMs: 800,
      });

      const summary = engine.getSessionSummary(SESSION_ID);
      expect(summary.totalTokens).toBe(200);
      expect(summary.totalCostUsd).toBeCloseTo(0.003);
    });
  });

  // ── getSessionSummary ──────────────────────────────────────────────────────

  describe('getSessionSummary()', () => {
    it('returns zero summary for empty session', () => {
      const summary = engine.getSessionSummary(SESSION_ID);
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCostUsd).toBe(0);
      expect(summary.scope).toBe('session');
      expect(summary.scopeId).toBe(SESSION_ID);
    });

    it('aggregates multiple messages', () => {
      engine.recordUsage({ ...BASE_USAGE, inputTokens: 100, outputTokens: 100, costUsd: 0.01 });
      // Second entry uses the same messageId — FK allows duplicate token_usage rows per message
      engine.recordUsage({ ...BASE_USAGE, inputTokens: 50, outputTokens: 50, costUsd: 0.005 });

      const summary = engine.getSessionSummary(SESSION_ID);
      expect(summary.totalInputTokens).toBe(150);
      expect(summary.totalOutputTokens).toBe(150);
      expect(summary.totalTokens).toBe(300);
      expect(summary.totalCostUsd).toBeCloseTo(0.015);
    });

    it('separates local vs cloud tokens', () => {
      engine.recordUsage({ ...BASE_USAGE, inputTokens: 100, outputTokens: 100, costUsd: 0.01, isLocal: false });
      engine.recordUsage({ ...BASE_USAGE, provider: 'ollama', model: 'llama3', inputTokens: 50, outputTokens: 50, costUsd: 0, isLocal: true });

      const summary = engine.getSessionSummary(SESSION_ID);
      expect(summary.cloudTokens).toBe(200);
      expect(summary.localTokens).toBe(100);
    });

    it('groups by provider', () => {
      engine.recordUsage({ ...BASE_USAGE, inputTokens: 100, outputTokens: 100, costUsd: 0.01 });

      const summary = engine.getSessionSummary(SESSION_ID);
      expect(summary.byProvider['anthropic']).toBeDefined();
      expect(summary.byProvider['anthropic'].tokens).toBe(200);
    });

    it('groups by model', () => {
      engine.recordUsage(BASE_USAGE);

      const summary = engine.getSessionSummary(SESSION_ID);
      expect(summary.byModel['anthropic/claude-haiku']).toBeDefined();
    });
  });

  // ── getProjectSummary ──────────────────────────────────────────────────────

  describe('getProjectSummary()', () => {
    it('aggregates all sessions in a project', () => {
      engine.recordUsage({ ...BASE_USAGE, inputTokens: 100, outputTokens: 100, costUsd: 0.01 });

      const summary = engine.getProjectSummary(PROJECT_ID);
      expect(summary.scope).toBe('project');
      expect(summary.totalTokens).toBe(200);
    });
  });

  // ── getWorkspaceSummary ────────────────────────────────────────────────────

  describe('getWorkspaceSummary()', () => {
    it('aggregates all projects in workspace', () => {
      engine.recordUsage({ ...BASE_USAGE, inputTokens: 100, outputTokens: 100, costUsd: 0.01 });

      const summary = engine.getWorkspaceSummary(WORKSPACE_ID);
      expect(summary.scope).toBe('workspace');
      expect(summary.totalTokens).toBe(200);
    });
  });
});
