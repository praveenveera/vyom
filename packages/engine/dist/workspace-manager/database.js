// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — Database
//
// Sets up the SQLite database at ~/.garagebuild/data/garagebuild.db
// All schema changes must be versioned migrations.
// ─────────────────────────────────────────────────────────────────────────────
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
// ── Paths ─────────────────────────────────────────────────────────────────────
export function getGarageBuildDir() {
    return join(homedir(), '.garagebuild');
}
export function getDataDir() {
    return join(getGarageBuildDir(), 'data');
}
export function getDatabasePath() {
    return join(getDataDir(), 'garagebuild.db');
}
// ── Schema ────────────────────────────────────────────────────────────────────
const SCHEMA_VERSION = 1;
const CREATE_TABLES = `
  -- Schema version tracking
  CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- The root workspace
  CREATE TABLE IF NOT EXISTS workspaces (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    owner       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    settings    TEXT NOT NULL DEFAULT '{}'
  );

  -- Configured AI model providers
  CREATE TABLE IF NOT EXISTS model_configs (
    id                          TEXT PRIMARY KEY,
    workspace_id                TEXT NOT NULL,
    provider                    TEXT NOT NULL,
    model_name                  TEXT NOT NULL,
    display_name                TEXT NOT NULL,
    api_key_ref                 TEXT,
    base_url                    TEXT,
    cost_per_1k_input_tokens    REAL NOT NULL DEFAULT 0,
    cost_per_1k_output_tokens   REAL NOT NULL DEFAULT 0,
    is_local                    INTEGER NOT NULL DEFAULT 0,
    is_active                   INTEGER NOT NULL DEFAULT 0,
    context_window              INTEGER NOT NULL DEFAULT 4096,
    capabilities                TEXT NOT NULL DEFAULT '["chat"]',
    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  );

  -- Projects
  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    framework   TEXT NOT NULL DEFAULT 'react',
    path        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  );

  -- Sessions
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    name        TEXT NOT NULL,
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at    TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );

  -- Messages
  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    model_config_id TEXT,
    agent_id        TEXT,
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  -- Token usage per message
  CREATE TABLE IF NOT EXISTS token_usage (
    id              TEXT PRIMARY KEY,
    message_id      TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    project_id      TEXT NOT NULL,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    cost_usd        REAL NOT NULL DEFAULT 0,
    is_local        INTEGER NOT NULL DEFAULT 0,
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES messages(id)
  );

  -- Plugin registrations
  CREATE TABLE IF NOT EXISTS plugin_configs (
    id            TEXT PRIMARY KEY,
    workspace_id  TEXT NOT NULL,
    name          TEXT NOT NULL,
    version       TEXT NOT NULL,
    type          TEXT NOT NULL,
    entry_point   TEXT NOT NULL,
    sandbox_tier  TEXT NOT NULL DEFAULT 'lightweight',
    is_active     INTEGER NOT NULL DEFAULT 1,
    config        TEXT NOT NULL DEFAULT '{}',
    installed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  );
`;
// ── Database initialisation ───────────────────────────────────────────────────
/**
 * Initialises the GarageBuild database.
 * Creates ~/.garagebuild/data/ if it doesn't exist.
 * Runs schema migrations if needed.
 * Returns an open database connection.
 */
export function initDatabase(dbPath) {
    const path = dbPath ?? getDatabasePath();
    // Ensure the data directory exists
    const dir = join(path, '..');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    const db = new Database(path);
    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Run schema
    db.exec(CREATE_TABLES);
    // Record schema version if not already done
    const version = db
        .prepare('SELECT version FROM schema_version WHERE version = ?')
        .get(SCHEMA_VERSION);
    if (!version) {
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    }
    return db;
}
//# sourceMappingURL=database.js.map