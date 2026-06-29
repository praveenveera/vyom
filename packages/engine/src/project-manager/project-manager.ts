// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — ProjectManager
//
// Owns project lifecycle within a workspace: create, open, close, archive.
// All state changes emit events through the Event Bus.
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { eventBus } from '../event-bus/event-bus.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'archived';
export type Framework = 'react' | 'vue' | 'angular' | 'nextjs' | 'svelte';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  framework: Framework;
  path: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectOptions {
  name: string;
  framework: Framework;
  path: string;
  description?: string;
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  framework: string;
  path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    framework: row.framework as Framework,
    path: row.path,
    status: row.status as ProjectStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── ProjectManager ────────────────────────────────────────────────────────────

export class ProjectManager {
  constructor(
    private readonly db: Database.Database,
    private readonly workspaceId: string,
  ) {}

  createProject(options: CreateProjectOptions): Project {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO projects (id, workspace_id, name, description, framework, path, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      this.workspaceId,
      options.name,
      options.description ?? '',
      options.framework,
      options.path,
      now,
      now,
    );

    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow;
    const project = rowToProject(row);

    eventBus.emit('project.created', {
      projectId: project.id,
      name: project.name,
      framework: project.framework,
    });

    return project;
  }

  getProject(projectId: string): Project {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?')
      .get(projectId, this.workspaceId) as ProjectRow | undefined;

    if (!row) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return rowToProject(row);
  }

  listProjects(filter?: { status?: ProjectStatus }): Project[] {
    let query = 'SELECT * FROM projects WHERE workspace_id = ?';
    const params: unknown[] = [this.workspaceId];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as ProjectRow[];
    return rows.map(rowToProject);
  }

  openProject(projectId: string): Project {
    const project = this.getProject(projectId);
    eventBus.emit('project.opened', { projectId: project.id });
    return project;
  }

  closeProject(projectId: string): void {
    this.getProject(projectId);
    eventBus.emit('project.closed', { projectId });
  }

  archiveProject(projectId: string): Project {
    const now = new Date().toISOString();

    const result = this.db.prepare(`
      UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ? AND workspace_id = ?
    `).run(now, projectId, this.workspaceId);

    if (result.changes === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const project = this.getProject(projectId);
    eventBus.emit('project.archived', { projectId });
    return project;
  }

  restoreProject(projectId: string): Project {
    const now = new Date().toISOString();

    const result = this.db.prepare(`
      UPDATE projects SET status = 'active', updated_at = ? WHERE id = ? AND workspace_id = ?
    `).run(now, projectId, this.workspaceId);

    if (result.changes === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return this.getProject(projectId);
  }

  updateProject(projectId: string, updates: { name?: string; description?: string }): Project {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }

    params.push(projectId, this.workspaceId);

    const result = this.db.prepare(`
      UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND workspace_id = ?
    `).run(...params);

    if (result.changes === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return this.getProject(projectId);
  }

  deleteProject(projectId: string): void {
    this.getProject(projectId);

    this.db.prepare('DELETE FROM projects WHERE id = ? AND workspace_id = ?')
      .run(projectId, this.workspaceId);
  }
}
