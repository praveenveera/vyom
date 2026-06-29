// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — FileSystemManager Tests
// ─────────────────────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { FileSystemManager } from './file-system.js';
import { eventBus } from '../event-bus/event-bus.js';
import { initDatabase } from '../workspace-manager/database.js';
import type Database from 'better-sqlite3';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT_ID = randomUUID();
const WORKSPACE_ID = randomUUID();

function makeDb(projectPath: string): Database.Database {
  const dbPath = join(tmpdir(), `garagebuild-test-${randomUUID()}.db`);
  const db = initDatabase(dbPath);

  db.prepare(
    "INSERT INTO workspaces (id, name, owner) VALUES (?, ?, ?)",
  ).run(WORKSPACE_ID, 'test-workspace', 'test');

  db.prepare(
    'INSERT INTO projects (id, workspace_id, name, path, framework) VALUES (?, ?, ?, ?, ?)',
  ).run(PROJECT_ID, WORKSPACE_ID, 'test-project', projectPath, 'react');

  return db;
}

async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'garagebuild-fs-test-'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FileSystemManager', () => {
  let tmpDir: string;
  let db: Database.Database;
  let fs: FileSystemManager;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    db = makeDb(tmpDir);
    fs = new FileSystemManager(db);
    eventBus.removeAllListeners();
  });

  afterEach(async () => {
    fs.close();
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── requireProjectPath ─────────────────────────────────────────────────────

  it('throws for an unknown project id', async () => {
    await expect(fs.readFile('no-such-id', 'file.txt')).rejects.toThrow('Project not found');
  });

  // ── writeFile / readFile ───────────────────────────────────────────────────

  describe('writeFile() + readFile()', () => {
    it('writes and reads back a file', async () => {
      await fs.writeFile(PROJECT_ID, 'hello.txt', 'hello world');
      const content = await fs.readFile(PROJECT_ID, 'hello.txt');
      expect(content).toBe('hello world');
    });

    it('creates intermediate directories', async () => {
      await fs.writeFile(PROJECT_ID, 'src/components/Button.tsx', 'export {}');
      const content = await fs.readFile(PROJECT_ID, 'src/components/Button.tsx');
      expect(content).toBe('export {}');
    });

    it('emits file.created for a new file', async () => {
      const handler = jest.fn<(p: { projectId: string; path: string }) => void>();
      eventBus.on('file.created', handler);

      await fs.writeFile(PROJECT_ID, 'new.ts', 'const x = 1;');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PROJECT_ID, path: 'new.ts' }),
      );
    });

    it('emits file.modified for an existing file', async () => {
      await writeFile(join(tmpDir, 'existing.ts'), 'original', 'utf8');

      const created = jest.fn<(p: { projectId: string; path: string }) => void>();
      const modified = jest.fn<(p: { projectId: string; path: string }) => void>();
      eventBus.on('file.created', created);
      eventBus.on('file.modified', modified);

      await fs.writeFile(PROJECT_ID, 'existing.ts', 'updated');

      expect(created).not.toHaveBeenCalled();
      expect(modified).toHaveBeenCalledTimes(1);
      expect(modified).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'existing.ts' }),
      );
    });

    it('overwrites file content', async () => {
      await fs.writeFile(PROJECT_ID, 'data.txt', 'v1');
      await fs.writeFile(PROJECT_ID, 'data.txt', 'v2');
      expect(await fs.readFile(PROJECT_ID, 'data.txt')).toBe('v2');
    });
  });

  // ── writeFileBytes / readFileBytes ─────────────────────────────────────────

  describe('writeFileBytes() + readFileBytes()', () => {
    it('round-trips binary data correctly', async () => {
      const data = Buffer.from([0x00, 0xFF, 0x42, 0xAB]);
      await fs.writeFileBytes(PROJECT_ID, 'binary.bin', data);
      const back = await fs.readFileBytes(PROJECT_ID, 'binary.bin');
      expect(Buffer.compare(back, data)).toBe(0);
    });
  });

  // ── deleteFile ─────────────────────────────────────────────────────────────

  describe('deleteFile()', () => {
    it('removes the file from disk', async () => {
      await fs.writeFile(PROJECT_ID, 'to-delete.txt', 'bye');
      await fs.deleteFile(PROJECT_ID, 'to-delete.txt');
      await expect(fs.readFile(PROJECT_ID, 'to-delete.txt')).rejects.toThrow();
    });

    it('emits file.deleted', async () => {
      const handler = jest.fn<(p: { projectId: string; path: string }) => void>();
      eventBus.on('file.deleted', handler);

      await fs.writeFile(PROJECT_ID, 'bye.ts', 'x');
      await fs.deleteFile(PROJECT_ID, 'bye.ts');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PROJECT_ID, path: 'bye.ts' }),
      );
    });

    it('throws when deleting a non-existent file', async () => {
      await expect(fs.deleteFile(PROJECT_ID, 'ghost.txt')).rejects.toThrow();
    });
  });

  // ── moveFile ───────────────────────────────────────────────────────────────

  describe('moveFile()', () => {
    it('moves file and old path is gone', async () => {
      await fs.writeFile(PROJECT_ID, 'old.txt', 'content');
      await fs.moveFile(PROJECT_ID, 'old.txt', 'new.txt');

      expect(await fs.readFile(PROJECT_ID, 'new.txt')).toBe('content');
      await expect(fs.readFile(PROJECT_ID, 'old.txt')).rejects.toThrow();
    });

    it('emits file.deleted then file.created', async () => {
      const events: string[] = [];
      eventBus.on('file.deleted', () => { events.push('deleted'); });
      eventBus.on('file.created', () => { events.push('created'); });

      await fs.writeFile(PROJECT_ID, 'src.ts', 'x');

      events.length = 0; // clear the 'created' from writeFile
      eventBus.removeAllListeners();
      eventBus.on('file.deleted', () => { events.push('deleted'); });
      eventBus.on('file.created', () => { events.push('created'); });

      await fs.moveFile(PROJECT_ID, 'src.ts', 'dst.ts');
      expect(events).toEqual(['deleted', 'created']);
    });
  });

  // ── copyFile ───────────────────────────────────────────────────────────────

  describe('copyFile()', () => {
    it('copies file and both paths exist', async () => {
      await fs.writeFile(PROJECT_ID, 'original.txt', 'data');
      await fs.copyFile(PROJECT_ID, 'original.txt', 'copy.txt');

      expect(await fs.readFile(PROJECT_ID, 'original.txt')).toBe('data');
      expect(await fs.readFile(PROJECT_ID, 'copy.txt')).toBe('data');
    });

    it('emits file.created for the copy', async () => {
      await fs.writeFile(PROJECT_ID, 'src.txt', 'x');

      const handler = jest.fn<(p: { path: string }) => void>();
      eventBus.removeAllListeners();
      eventBus.on('file.created', handler);

      await fs.copyFile(PROJECT_ID, 'src.txt', 'dst.txt');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ path: 'dst.txt' }));
    });
  });

  // ── makeDir ────────────────────────────────────────────────────────────────

  describe('makeDir()', () => {
    it('creates nested directories', async () => {
      await fs.makeDir(PROJECT_ID, 'a/b/c');
      const entries = await fs.listDir(PROJECT_ID, 'a/b');
      expect(entries.some(e => e.name === 'c' && e.isDirectory)).toBe(true);
    });
  });

  // ── listDir ────────────────────────────────────────────────────────────────

  describe('listDir()', () => {
    it('lists entries in the project root', async () => {
      await fs.writeFile(PROJECT_ID, 'a.ts', '');
      await fs.writeFile(PROJECT_ID, 'b.ts', '');

      const entries = await fs.listDir(PROJECT_ID);
      const names = entries.map(e => e.name);
      expect(names).toContain('a.ts');
      expect(names).toContain('b.ts');
    });

    it('each entry has path, name, isDirectory, sizeBytes, modifiedAt', async () => {
      await fs.writeFile(PROJECT_ID, 'check.ts', 'hello');

      const entries = await fs.listDir(PROJECT_ID);
      const file = entries.find(e => e.name === 'check.ts');

      expect(file).toBeDefined();
      expect(file?.isDirectory).toBe(false);
      expect(file?.sizeBytes).toBeGreaterThan(0);
      expect(file?.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('returns directories as isDirectory: true', async () => {
      await fs.makeDir(PROJECT_ID, 'mydir');

      const entries = await fs.listDir(PROJECT_ID);
      const dir = entries.find(e => e.name === 'mydir');
      expect(dir?.isDirectory).toBe(true);
    });

    it('lists a subdirectory', async () => {
      await fs.writeFile(PROJECT_ID, 'src/index.ts', 'x');

      const entries = await fs.listDir(PROJECT_ID, 'src');
      expect(entries.some(e => e.name === 'index.ts')).toBe(true);
    });
  });

  // ── getTree ────────────────────────────────────────────────────────────────

  describe('getTree()', () => {
    it('returns all entries recursively', async () => {
      await fs.writeFile(PROJECT_ID, 'root.ts', '');
      await fs.writeFile(PROJECT_ID, 'src/index.ts', '');
      await fs.writeFile(PROJECT_ID, 'src/components/Button.tsx', '');

      const tree = await fs.getTree(PROJECT_ID);
      const paths = tree.map(e => e.path);

      expect(paths).toContain('root.ts');
      expect(paths).toContain('src/index.ts');
      expect(paths).toContain('src/components/Button.tsx');
    });

    it('skips node_modules', async () => {
      await mkdir(join(tmpDir, 'node_modules', 'react'), { recursive: true });
      await writeFile(join(tmpDir, 'node_modules', 'react', 'index.js'), 'module.exports={}', 'utf8');

      const tree = await fs.getTree(PROJECT_ID);
      expect(tree.some(e => e.path.includes('node_modules'))).toBe(false);
    });

    it('skips .git directory', async () => {
      await mkdir(join(tmpDir, '.git'), { recursive: true });
      await writeFile(join(tmpDir, '.git', 'HEAD'), 'ref: refs/heads/main', 'utf8');

      const tree = await fs.getTree(PROJECT_ID);
      expect(tree.some(e => e.path.includes('.git'))).toBe(false);
    });

    it('respects maxDepth', async () => {
      await fs.writeFile(PROJECT_ID, 'a/b/c/deep.ts', '');

      const shallow = await fs.getTree(PROJECT_ID, 1);
      expect(shallow.some(e => e.path === 'a/b/c/deep.ts')).toBe(false);

      const deep = await fs.getTree(PROJECT_ID, 4);
      expect(deep.some(e => e.path === 'a/b/c/deep.ts')).toBe(true);
    });
  });

  // ── fileExists ─────────────────────────────────────────────────────────────

  describe('fileExists()', () => {
    it('returns true for an existing file', async () => {
      await fs.writeFile(PROJECT_ID, 'exists.ts', 'x');
      expect(await fs.fileExists(PROJECT_ID, 'exists.ts')).toBe(true);
    });

    it('returns false for a non-existent path', async () => {
      expect(await fs.fileExists(PROJECT_ID, 'ghost.ts')).toBe(false);
    });
  });

  // ── watchProject / unwatchProject ─────────────────────────────────────────

  describe('watchProject()', () => {
    it('isWatching returns false before watchProject', () => {
      expect(fs.isWatching(PROJECT_ID)).toBe(false);
    });

    it('isWatching returns true after watchProject', () => {
      fs.watchProject(PROJECT_ID, tmpDir);
      expect(fs.isWatching(PROJECT_ID)).toBe(true);
    });

    it('unwatchProject stops watching', () => {
      fs.watchProject(PROJECT_ID, tmpDir);
      fs.unwatchProject(PROJECT_ID);
      expect(fs.isWatching(PROJECT_ID)).toBe(false);
    });

    it('calling watchProject twice is a no-op', () => {
      fs.watchProject(PROJECT_ID, tmpDir);
      fs.watchProject(PROJECT_ID, tmpDir); // second call should be silently ignored
      expect(fs.isWatching(PROJECT_ID)).toBe(true);
    });
  });

  // ── close ──────────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('stops all active watchers', () => {
      fs.watchProject(PROJECT_ID, tmpDir);
      fs.close();
      expect(fs.isWatching(PROJECT_ID)).toBe(false);
    });

    it('can be called with no watchers without error', () => {
      expect(() => fs.close()).not.toThrow();
    });
  });
});
