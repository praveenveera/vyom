// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — SessionManager
//
// Owns AI working sessions within a project: message history, context
// window tracking, and assistant response recording.
//
// When an assistant message is recorded, this subsystem emits
// 'message.completed' so the CostEngine can record usage without
// needing to be called directly.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { ChatMessage } from '@garagebuild/plugin-sdk';
import { eventBus } from '../event-bus/event-bus.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  projectId: string;
  name: string;
  startedAt: string;
  endedAt?: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  modelConfigId?: string;
  agentId?: string;
  timestamp: string;
}

export interface RecordAssistantMessageOptions {
  content: string;
  modelConfigId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  isLocal: boolean;
  latencyMs: number;
  agentId?: string;
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  project_id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  model_config_id: string | null;
  agent_id: string | null;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToSession(row: SessionRow): Session {
  const session: Session = {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    startedAt: row.started_at,
  };
  if (row.ended_at !== null) session.endedAt = row.ended_at;
  return session;
}

function rowToMessage(row: MessageRow): Message {
  const message: Message = {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    timestamp: row.timestamp,
  };
  if (row.model_config_id !== null) message.modelConfigId = row.model_config_id;
  if (row.agent_id !== null) message.agentId = row.agent_id;
  return message;
}

// ── SessionManager ────────────────────────────────────────────────────────────

export class SessionManager {
  constructor(private readonly db: Database.Database) {}

  startSession(projectId: string, name?: string): Session {
    const id = randomUUID();
    const now = new Date().toISOString();
    const sessionName = name ?? `Session ${new Date().toLocaleString()}`;

    this.db.prepare(`
      INSERT INTO sessions (id, project_id, name, started_at)
      VALUES (?, ?, ?, ?)
    `).run(id, projectId, sessionName, now);

    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow;
    const session = rowToSession(row);

    eventBus.emit('session.started', { sessionId: session.id, projectId });

    return session;
  }

  endSession(sessionId: string): Session {
    const session = this.getSession(sessionId);

    if (session.endedAt) return session;

    const now = new Date().toISOString();
    const durationMs = Date.now() - new Date(session.startedAt).getTime();

    this.db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(now, sessionId);

    const updated = this.getSession(sessionId);
    eventBus.emit('session.ended', { sessionId, durationMs });

    return updated;
  }

  getSession(sessionId: string): Session {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as SessionRow | undefined;

    if (!row) throw new Error(`Session not found: ${sessionId}`);

    return rowToSession(row);
  }

  listSessions(projectId: string): Session[] {
    // rowid breaks ties when sessions share the same started_at timestamp
    const rows = this.db
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC, rowid DESC')
      .all(projectId) as SessionRow[];

    return rows.map(rowToSession);
  }

  addUserMessage(sessionId: string, content: string): Message {
    this.getSession(sessionId);

    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp)
      VALUES (?, ?, 'user', ?, ?)
    `).run(id, sessionId, content, now);

    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow;
    const message = rowToMessage(row);

    eventBus.emit('message.created', { messageId: message.id, sessionId, role: 'user' });

    return message;
  }

  /**
   * Record the AI response for a session turn.
   * Emits 'message.completed' so CostEngine can record token usage
   * without being called directly.
   */
  recordAssistantMessage(sessionId: string, options: RecordAssistantMessageOptions): Message {
    const session = this.getSession(sessionId);

    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, model_config_id, agent_id, timestamp)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      options.content,
      options.modelConfigId,
      options.agentId ?? null,
      now,
    );

    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow;
    const message = rowToMessage(row);

    eventBus.emit('message.created', { messageId: message.id, sessionId, role: 'assistant' });
    eventBus.emit('message.completed', {
      messageId: message.id,
      sessionId,
      projectId: session.projectId,
      provider: options.provider,
      model: options.model,
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      costUsd: options.costUsd,
      isLocal: options.isLocal,
      latencyMs: options.latencyMs,
    });

    return message;
  }

  addAssistantMessage(sessionId: string, content: string, agentId?: string): Message {
    this.getSession(sessionId);

    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, content, agent_id, timestamp)
      VALUES (?, ?, 'assistant', ?, ?, ?)
    `).run(id, sessionId, content, agentId ?? null, now);

    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow;
    const message = rowToMessage(row);

    eventBus.emit('message.created', { messageId: message.id, sessionId, role: 'assistant' });

    return message;
  }

  getMessages(sessionId: string): Message[] {
    this.getSession(sessionId);

    const rows = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
      .all(sessionId) as MessageRow[];

    return rows.map(rowToMessage);
  }

  /**
   * Returns the message history formatted for an AI provider.
   * Caps at maxMessages most recent messages to stay within context windows.
   */
  getContext(sessionId: string, maxMessages = 50): ChatMessage[] {
    const messages = this.getMessages(sessionId);
    return messages.slice(-maxMessages).map(m => ({ role: m.role, content: m.content }));
  }
}
