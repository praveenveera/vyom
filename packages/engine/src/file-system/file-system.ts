// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — FileSystemManager
//
// Scoped file I/O for project directories. Each operation resolves a project
// path from the shared SQLite DB and works relative to that root.
//
// Emits:
//   file.created  — on writeFile() for a new path
//   file.modified — on writeFile() for an existing path
//   file.deleted  — on deleteFile()
//
// Watching:
//   watchProject() installs an OS-level watcher for external changes (IDE edits,
//   git operations). The watcher emits file.modified/deleted for changes that
//   come in from outside the API. Both the explicit writes and the watcher may
//   fire events for the same change — consumers should be idempotent.
// ─────────────────────────────────────────────────────────────────────────────

import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  unlink,
  mkdir,
  readdir,
  stat,
  rename,
  copyFile,
} from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { join, dirname } from 'node:path';
import type Database from 'better-sqlite3';
import { eventBus } from '../event-bus/event-bus.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface FileEntry {
  path: string;         // relative to project root, always forward-slash delimited
  name: string;         // filename (no directory prefix)
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;   // ISO-8601
}

// ── Internals ─────────────────────────────────────────────────────────────────

// Directories to skip when walking the project tree
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.nuxt', '.cache', '.turbo', 'build']);

// ── FileSystemManager ─────────────────────────────────────────────────────────

export class FileSystemManager {
  private watchers = new Map<string, FSWatcher>();

  constructor(private readonly db: Database.Database) {}

  // ── File reads ─────────────────────────────────────────────────────────────

  async readFile(projectId: string, relativePath: string): Promise<string> {
    const root = this.requireProjectPath(projectId);
    return fsReadFile(join(root, relativePath), 'utf8');
  }

  async readFileBytes(projectId: string, relativePath: string): Promise<Buffer> {
    const root = this.requireProjectPath(projectId);
    return fsReadFile(join(root, relativePath));
  }

  // ── File writes ────────────────────────────────────────────────────────────

  async writeFile(projectId: string, relativePath: string, content: string): Promise<void> {
    const root = this.requireProjectPath(projectId);
    const full = join(root, relativePath);

    await mkdir(dirname(full), { recursive: true });

    let isNew = false;
    try {
      await stat(full);
    } catch {
      isNew = true;
    }

    await fsWriteFile(full, content, 'utf8');

    eventBus.emit(isNew ? 'file.created' : 'file.modified', {
      projectId,
      path: normPath(relativePath),
    });
  }

  async writeFileBytes(projectId: string, relativePath: string, data: Buffer): Promise<void> {
    const root = this.requireProjectPath(projectId);
    const full = join(root, relativePath);

    await mkdir(dirname(full), { recursive: true });

    let isNew = false;
    try {
      await stat(full);
    } catch {
      isNew = true;
    }

    await fsWriteFile(full, data);

    eventBus.emit(isNew ? 'file.created' : 'file.modified', {
      projectId,
      path: normPath(relativePath),
    });
  }

  // ── File operations ────────────────────────────────────────────────────────

  async deleteFile(projectId: string, relativePath: string): Promise<void> {
    const root = this.requireProjectPath(projectId);
    await unlink(join(root, relativePath));
    eventBus.emit('file.deleted', { projectId, path: normPath(relativePath) });
  }

  async moveFile(projectId: string, fromPath: string, toPath: string): Promise<void> {
    const root = this.requireProjectPath(projectId);
    const dest = join(root, toPath);
    await mkdir(dirname(dest), { recursive: true });
    await rename(join(root, fromPath), dest);
    eventBus.emit('file.deleted',  { projectId, path: normPath(fromPath) });
    eventBus.emit('file.created',  { projectId, path: normPath(toPath) });
  }

  async copyFile(projectId: string, fromPath: string, toPath: string): Promise<void> {
    const root = this.requireProjectPath(projectId);
    const dest = join(root, toPath);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(join(root, fromPath), dest);
    eventBus.emit('file.created', { projectId, path: normPath(toPath) });
  }

  // ── Directory operations ───────────────────────────────────────────────────

  async makeDir(projectId: string, relativePath: string): Promise<void> {
    const root = this.requireProjectPath(projectId);
    await mkdir(join(root, relativePath), { recursive: true });
  }

  async listDir(projectId: string, relativePath = '.'): Promise<FileEntry[]> {
    const root = this.requireProjectPath(projectId);
    const absDir = join(root, relativePath === '.' ? '' : relativePath);
    const items = await readdir(absDir, { withFileTypes: true });

    return Promise.all(
      items.map(async item => {
        const s = await stat(join(absDir, item.name));
        const rel = relativePath === '.' ? item.name : `${relativePath}/${item.name}`;
        return {
          path: normPath(rel),
          name: item.name,
          isDirectory: item.isDirectory(),
          sizeBytes: s.size,
          modifiedAt: s.mtime.toISOString(),
        };
      }),
    );
  }

  /**
   * Recursively collect all entries up to `maxDepth` levels deep.
   * Skips common build/dependency directories (node_modules, .git, dist, …).
   */
  async getTree(projectId: string, maxDepth = 4): Promise<FileEntry[]> {
    const root = this.requireProjectPath(projectId);
    const entries: FileEntry[] = [];
    await this.walk(root, '', 0, maxDepth, entries);
    return entries;
  }

  async fileExists(projectId: string, relativePath: string): Promise<boolean> {
    const root = this.requireProjectPath(projectId);
    try {
      await stat(join(root, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  // ── Watcher ────────────────────────────────────────────────────────────────

  /**
   * Watch a project directory for external changes (IDE edits, git ops, etc.).
   * Emits file.modified or file.deleted events. No-op if already watching.
   *
   * Note: `recursive` watch is natively supported on macOS/Windows.
   * On Linux each subdirectory needs its own watcher — this implementation
   * uses the Node.js built-in which handles that detail on supported platforms.
   */
  watchProject(projectId: string, projectPath: string): void {
    if (this.watchers.has(projectId)) return;

    const watcher = watch(
      projectPath,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) return;
        const rel = normPath(filename);
        const full = join(projectPath, rel);

        stat(full)
          .then(() => { eventBus.emit('file.modified', { projectId, path: rel }); })
          .catch(() => { eventBus.emit('file.deleted', { projectId, path: rel }); });
      },
    );

    watcher.on('error', () => { /* absorb OS watcher errors silently */ });
    this.watchers.set(projectId, watcher);
  }

  unwatchProject(projectId: string): void {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
    }
  }

  isWatching(projectId: string): boolean {
    return this.watchers.has(projectId);
  }

  /** Stop all watchers. Call from GarageBuildEngine.shutdown(). */
  close(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private requireProjectPath(projectId: string): string {
    const row = this.db
      .prepare('SELECT path FROM projects WHERE id = ?')
      .get(projectId) as { path: string } | undefined;

    if (!row) throw new Error(`Project not found: ${projectId}`);
    return row.path;
  }

  private async walk(
    base: string,
    rel: string,
    depth: number,
    maxDepth: number,
    out: FileEntry[],
  ): Promise<void> {
    if (depth > maxDepth) return;

    const abs = rel ? join(base, rel) : base;
    const items = await readdir(abs, { withFileTypes: true }).catch(() => []);

    for (const item of items) {
      if (IGNORED_DIRS.has(item.name)) continue;

      const itemRel = rel ? `${rel}/${item.name}` : item.name;
      const s = await stat(join(abs, item.name)).catch(() => null);
      if (!s) continue;

      out.push({
        path: normPath(itemRel),
        name: item.name,
        isDirectory: item.isDirectory(),
        sizeBytes: s.size,
        modifiedAt: s.mtime.toISOString(),
      });

      if (item.isDirectory()) {
        await this.walk(base, itemRel, depth + 1, maxDepth, out);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normPath(p: string): string {
  return p.replace(/\\/g, '/');
}
