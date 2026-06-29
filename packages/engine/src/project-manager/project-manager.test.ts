// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — ProjectManager Tests
// ─────────────────────────────────────────────────────────────────────────────

import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { jest } from '@jest/globals';
import { initDatabase } from '../workspace-manager/database.js';
import { ProjectManager } from './project-manager.js';
import { eventBus } from '../event-bus/event-bus.js';

function tempDbPath(): string {
  return join(tmpdir(), `garagebuild-test-${randomUUID()}.db`);
}

const WORKSPACE_ID = 'ws-test-001';

function makeManager() {
  const db = initDatabase(tempDbPath());
  // Seed the workspace row so FK constraint passes
  db.prepare(`
    INSERT INTO workspaces (id, name, owner, created_at, updated_at, settings)
    VALUES (?, 'Test WS', 'local', datetime('now'), datetime('now'), '{}')
  `).run(WORKSPACE_ID);
  return { db, manager: new ProjectManager(db, WORKSPACE_ID) };
}

describe('ProjectManager', () => {
  let db: ReturnType<typeof initDatabase>;
  let manager: ProjectManager;

  beforeEach(() => {
    ({ db, manager } = makeManager());
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    db.close();
  });

  // ── createProject ──────────────────────────────────────────────────────────

  describe('createProject()', () => {
    it('creates a project and returns it', () => {
      const project = manager.createProject({ name: 'My App', framework: 'react', path: '/tmp/my-app' });
      expect(project.id).toBeDefined();
      expect(project.name).toBe('My App');
      expect(project.framework).toBe('react');
      expect(project.status).toBe('active');
      expect(project.workspaceId).toBe(WORKSPACE_ID);
    });

    it('defaults description to empty string', () => {
      const project = manager.createProject({ name: 'App', framework: 'vue', path: '/tmp/app' });
      expect(project.description).toBe('');
    });

    it('stores description when provided', () => {
      const project = manager.createProject({
        name: 'App',
        framework: 'react',
        path: '/tmp/app',
        description: 'A great app',
      });
      expect(project.description).toBe('A great app');
    });

    it('emits project.created', () => {
      const handler = jest.fn<(p: { projectId: string; name: string; framework: string }) => void>();
      eventBus.on('project.created', handler);

      manager.createProject({ name: 'App', framework: 'react', path: '/tmp/app' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'App', framework: 'react' }),
      );
    });
  });

  // ── getProject ─────────────────────────────────────────────────────────────

  describe('getProject()', () => {
    it('returns the project by id', () => {
      const created = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      const fetched = manager.getProject(created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('throws for unknown id', () => {
      expect(() => manager.getProject('non-existent')).toThrow('not found');
    });
  });

  // ── listProjects ───────────────────────────────────────────────────────────

  describe('listProjects()', () => {
    it('returns empty array when no projects', () => {
      expect(manager.listProjects()).toEqual([]);
    });

    it('returns all active projects', () => {
      manager.createProject({ name: 'A', framework: 'react', path: '/tmp/a' });
      manager.createProject({ name: 'B', framework: 'vue', path: '/tmp/b' });
      expect(manager.listProjects()).toHaveLength(2);
    });

    it('filters by status', () => {
      const p = manager.createProject({ name: 'A', framework: 'react', path: '/tmp/a' });
      manager.archiveProject(p.id);
      manager.createProject({ name: 'B', framework: 'vue', path: '/tmp/b' });

      expect(manager.listProjects({ status: 'active' })).toHaveLength(1);
      expect(manager.listProjects({ status: 'archived' })).toHaveLength(1);
    });
  });

  // ── openProject / closeProject ─────────────────────────────────────────────

  describe('openProject()', () => {
    it('returns the project and emits project.opened', () => {
      const created = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      const handler = jest.fn<(p: { projectId: string }) => void>();
      eventBus.on('project.opened', handler);

      const opened = manager.openProject(created.id);

      expect(opened.id).toBe(created.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeProject()', () => {
    it('emits project.closed', () => {
      const created = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      const handler = jest.fn<(p: { projectId: string }) => void>();
      eventBus.on('project.closed', handler);

      manager.closeProject(created.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── archiveProject / restoreProject ───────────────────────────────────────

  describe('archiveProject()', () => {
    it('sets status to archived', () => {
      const p = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      const archived = manager.archiveProject(p.id);
      expect(archived.status).toBe('archived');
    });

    it('emits project.archived', () => {
      const p = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      const handler = jest.fn<(p: { projectId: string }) => void>();
      eventBus.on('project.archived', handler);

      manager.archiveProject(p.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('throws for unknown id', () => {
      expect(() => manager.archiveProject('bad-id')).toThrow('not found');
    });
  });

  describe('restoreProject()', () => {
    it('sets status back to active', () => {
      const p = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      manager.archiveProject(p.id);
      const restored = manager.restoreProject(p.id);
      expect(restored.status).toBe('active');
    });
  });

  // ── updateProject ──────────────────────────────────────────────────────────

  describe('updateProject()', () => {
    it('updates name', () => {
      const p = manager.createProject({ name: 'Old', framework: 'react', path: '/tmp' });
      const updated = manager.updateProject(p.id, { name: 'New' });
      expect(updated.name).toBe('New');
    });

    it('updates description', () => {
      const p = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      const updated = manager.updateProject(p.id, { description: 'Updated desc' });
      expect(updated.description).toBe('Updated desc');
    });

    it('throws for unknown id', () => {
      expect(() => manager.updateProject('bad-id', { name: 'X' })).toThrow('not found');
    });
  });

  // ── deleteProject ──────────────────────────────────────────────────────────

  describe('deleteProject()', () => {
    it('removes the project', () => {
      const p = manager.createProject({ name: 'App', framework: 'react', path: '/tmp' });
      manager.deleteProject(p.id);
      expect(manager.listProjects()).toHaveLength(0);
    });

    it('throws for unknown id', () => {
      expect(() => manager.deleteProject('bad-id')).toThrow('not found');
    });
  });
});
