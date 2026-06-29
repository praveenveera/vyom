// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Web — API client (browser fetch)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Workspace, ModelConfig, Project, PluginRecord, AgentResult, Session,
  SessionWithMessages, FileEntry,
  CreateProjectInput, AddModelInput, StreamChunk, UsageSummary,
} from './types';

export class GarageBuildApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    if (text.length === 0) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ── Workspace ──────────────────────────────────────────────────────────────

  getWorkspace(): Promise<Workspace> {
    return this.request<Workspace>('GET', '/workspace');
  }

  updateSettings(settings: Partial<{ theme: 'dark' | 'light'; telemetryEnabled: boolean }>): Promise<Workspace> {
    return this.request<Workspace>('PATCH', '/workspace', { settings });
  }

  // ── Models ─────────────────────────────────────────────────────────────────

  listModels(): Promise<ModelConfig[]> {
    return this.request<ModelConfig[]>('GET', '/workspace/models');
  }

  addModel(input: AddModelInput): Promise<ModelConfig> {
    return this.request<ModelConfig>('POST', '/workspace/models', input);
  }

  activateModel(id: string): Promise<ModelConfig> {
    return this.request<ModelConfig>('PUT', `/workspace/models/${id}/activate`);
  }

  removeModel(id: string): Promise<void> {
    return this.request<void>('DELETE', `/workspace/models/${id}`);
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/projects');
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.request<Project>('POST', '/projects', input);
  }

  getProject(id: string): Promise<Project> {
    return this.request<Project>('GET', `/projects/${id}`);
  }

  deleteProject(id: string): Promise<void> {
    return this.request<void>('DELETE', `/projects/${id}`);
  }

  // ── Plugins ────────────────────────────────────────────────────────────────

  listPlugins(): Promise<PluginRecord[]> {
    return this.request<PluginRecord[]>('GET', '/plugins');
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  listSessions(projectId: string): Promise<Session[]> {
    return this.request<Session[]>('GET', `/projects/${projectId}/sessions`);
  }

  createSession(projectId: string, title?: string): Promise<Session> {
    return this.request<Session>('POST', `/projects/${projectId}/sessions`, { title });
  }

  getSession(projectId: string, sessionId: string): Promise<SessionWithMessages> {
    return this.request<SessionWithMessages>('GET', `/projects/${projectId}/sessions/${sessionId}`);
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  listFiles(projectId: string): Promise<FileEntry[]> {
    return this.request<FileEntry[]>('GET', `/projects/${projectId}/files`);
  }

  async readFile(projectId: string, filePath: string): Promise<string> {
    const url = `${this.baseUrl}/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  // ── Agent ──────────────────────────────────────────────────────────────────

  runAgent(task: { type: string; description: string; sessionId?: string; modelConfigId?: string }): Promise<AgentResult> {
    return this.request<AgentResult>('POST', '/agent/execute', task);
  }

  async streamAgent(
    task: { type: string; description: string; sessionId?: string; projectId?: string; modelConfigId?: string },
    callbacks: {
      onChunk: (chunk: StreamChunk) => void;
      onDone: (filesWritten?: string[]) => void;
      onError: (message: string) => void;
    },
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
    } catch (err) {
      callbacks.onError(String(err));
      return;
    }

    if (!res.ok || !res.body) {
      callbacks.onError(`HTTP ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (!raw) continue;
            const data = JSON.parse(raw) as Record<string, unknown>;

            if (currentEvent === 'chunk') {
              callbacks.onChunk({
                delta: String(data['delta'] ?? ''),
                accumulated: String(data['accumulated'] ?? ''),
                isDone: Boolean(data['isDone']),
              });
            } else if (currentEvent === 'done') {
              const filesWritten = data['filesWritten'] as string[] | undefined;
              callbacks.onDone(filesWritten);
            } else if (currentEvent === 'error') {
              callbacks.onError(String(data['message'] ?? 'Unknown error'));
            }
            currentEvent = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Cost / Usage ──────────────────────────────────────────────────────────

  getWorkspaceCost(): Promise<UsageSummary> {
    return this.request<UsageSummary>('GET', '/workspace/cost');
  }

  getProjectCost(projectId: string): Promise<UsageSummary> {
    return this.request<UsageSummary>('GET', `/projects/${projectId}/cost`);
  }

  getSessionCost(projectId: string, sessionId: string): Promise<UsageSummary> {
    return this.request<UsageSummary>('GET', `/projects/${projectId}/sessions/${sessionId}/cost`);
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await this.getWorkspace();
      return true;
    } catch {
      return false;
    }
  }
}
