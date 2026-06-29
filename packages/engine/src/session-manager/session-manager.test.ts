// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — SessionManager Tests
// ─────────────────────────────────────────────────────────────────────────────

import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { jest } from '@jest/globals';
import { initDatabase } from '../workspace-manager/database.js';
import { SessionManager } from './session-manager.js';
import { eventBus } from '../event-bus/event-bus.js';

function tempDbPath(): string {
  return join(tmpdir(), `garagebuild-test-${randomUUID()}.db`);
}

const WORKSPACE_ID = 'ws-001';
const PROJECT_ID = 'proj-001';

function makeManager() {
  const db = initDatabase(tempDbPath());
  db.prepare(`INSERT INTO workspaces (id, name, owner, created_at, updated_at, settings) VALUES (?, 'WS', 'local', datetime('now'), datetime('now'), '{}')`).run(WORKSPACE_ID);
  db.prepare(`INSERT INTO projects (id, workspace_id, name, description, framework, path, status, created_at, updated_at) VALUES (?, ?, 'App', '', 'react', '/tmp', 'active', datetime('now'), datetime('now'))`).run(PROJECT_ID, WORKSPACE_ID);
  return { db, manager: new SessionManager(db) };
}

describe('SessionManager', () => {
  let db: ReturnType<typeof initDatabase>;
  let manager: SessionManager;

  beforeEach(() => {
    ({ db, manager } = makeManager());
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    db.close();
  });

  // ── startSession ───────────────────────────────────────────────────────────

  describe('startSession()', () => {
    it('creates a session', () => {
      const session = manager.startSession(PROJECT_ID, 'My Session');
      expect(session.id).toBeDefined();
      expect(session.projectId).toBe(PROJECT_ID);
      expect(session.name).toBe('My Session');
      expect(session.endedAt).toBeUndefined();
    });

    it('generates a default name when none provided', () => {
      const session = manager.startSession(PROJECT_ID);
      expect(session.name).toBeTruthy();
    });

    it('emits session.started', () => {
      const handler = jest.fn<(p: { sessionId: string; projectId: string }) => void>();
      eventBus.on('session.started', handler);

      manager.startSession(PROJECT_ID);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT_ID }));
    });
  });

  // ── endSession ─────────────────────────────────────────────────────────────

  describe('endSession()', () => {
    it('sets ended_at', () => {
      const session = manager.startSession(PROJECT_ID);
      const ended = manager.endSession(session.id);
      expect(ended.endedAt).toBeDefined();
    });

    it('emits session.ended with durationMs', () => {
      const handler = jest.fn<(p: { sessionId: string; durationMs: number }) => void>();
      eventBus.on('session.ended', handler);

      const session = manager.startSession(PROJECT_ID);
      manager.endSession(session.id);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: session.id, durationMs: expect.any(Number) }),
      );
    });

    it('is idempotent — calling twice does not re-emit', () => {
      const handler = jest.fn<(p: { sessionId: string; durationMs: number }) => void>();
      eventBus.on('session.ended', handler);

      const session = manager.startSession(PROJECT_ID);
      manager.endSession(session.id);
      manager.endSession(session.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── getSession ─────────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('returns a session by id', () => {
      const created = manager.startSession(PROJECT_ID);
      const fetched = manager.getSession(created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('throws for unknown id', () => {
      expect(() => manager.getSession('bad-id')).toThrow('not found');
    });
  });

  // ── listSessions ───────────────────────────────────────────────────────────

  describe('listSessions()', () => {
    it('returns empty array when no sessions', () => {
      expect(manager.listSessions(PROJECT_ID)).toEqual([]);
    });

    it('returns sessions for the project in descending order', () => {
      manager.startSession(PROJECT_ID, 'First');
      manager.startSession(PROJECT_ID, 'Second');
      const sessions = manager.listSessions(PROJECT_ID);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].name).toBe('Second');
    });
  });

  // ── addUserMessage ─────────────────────────────────────────────────────────

  describe('addUserMessage()', () => {
    it('creates a user message', () => {
      const session = manager.startSession(PROJECT_ID);
      const msg = manager.addUserMessage(session.id, 'Hello!');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello!');
    });

    it('emits message.created with role user', () => {
      const handler = jest.fn<(p: { messageId: string; sessionId: string; role: string }) => void>();
      eventBus.on('message.created', handler);

      const session = manager.startSession(PROJECT_ID);
      manager.addUserMessage(session.id, 'Hi');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
    });

    it('throws if session does not exist', () => {
      expect(() => manager.addUserMessage('bad-id', 'Hi')).toThrow('not found');
    });
  });

  // ── recordAssistantMessage ─────────────────────────────────────────────────

  describe('recordAssistantMessage()', () => {
    it('creates an assistant message', () => {
      const session = manager.startSession(PROJECT_ID);
      const msg = manager.recordAssistantMessage(session.id, {
        content: 'Here is your code.',
        modelConfigId: 'model-1',
        provider: 'anthropic',
        model: 'claude-sonnet',
        inputTokens: 100,
        outputTokens: 200,
        costUsd: 0.005,
        isLocal: false,
        latencyMs: 1200,
      });
      expect(msg.role).toBe('assistant');
      expect(msg.content).toBe('Here is your code.');
      expect(msg.modelConfigId).toBe('model-1');
    });

    it('emits message.completed with full cost data', () => {
      const handler = jest.fn<(p: {
        messageId: string; sessionId: string; projectId: string;
        inputTokens: number; costUsd: number;
      }) => void>();
      eventBus.on('message.completed', handler);

      const session = manager.startSession(PROJECT_ID);
      manager.recordAssistantMessage(session.id, {
        content: 'Hi',
        modelConfigId: 'model-1',
        provider: 'anthropic',
        model: 'claude-haiku',
        inputTokens: 50,
        outputTokens: 80,
        costUsd: 0.001,
        isLocal: false,
        latencyMs: 500,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          inputTokens: 50,
          outputTokens: 80,
          costUsd: 0.001,
        }),
      );
    });
  });

  // ── getMessages ────────────────────────────────────────────────────────────

  describe('getMessages()', () => {
    it('returns messages in chronological order', () => {
      const session = manager.startSession(PROJECT_ID);
      manager.addUserMessage(session.id, 'First');
      manager.recordAssistantMessage(session.id, {
        content: 'Reply',
        modelConfigId: 'm1',
        provider: 'ollama',
        model: 'llama3',
        inputTokens: 10,
        outputTokens: 20,
        costUsd: 0,
        isLocal: true,
        latencyMs: 100,
      });

      const messages = manager.getMessages(session.id);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });
  });

  // ── getContext ─────────────────────────────────────────────────────────────

  describe('getContext()', () => {
    it('returns messages as ChatMessage array', () => {
      const session = manager.startSession(PROJECT_ID);
      manager.addUserMessage(session.id, 'Build me a button');

      const ctx = manager.getContext(session.id);
      expect(ctx).toHaveLength(1);
      expect(ctx[0]).toEqual({ role: 'user', content: 'Build me a button' });
    });

    it('caps at maxMessages most recent', () => {
      const session = manager.startSession(PROJECT_ID);
      for (let i = 0; i < 5; i++) {
        manager.addUserMessage(session.id, `Message ${i}`);
      }

      const ctx = manager.getContext(session.id, 3);
      expect(ctx).toHaveLength(3);
      expect(ctx[2].content).toBe('Message 4');
    });
  });
});
