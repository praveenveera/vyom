// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Desktop — REST API client (browser fetch, same as ui-web)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Workspace, ModelConfig, Project, PluginRecord, AgentResult,
  CreateProjectInput, AddModelInput,
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

  getWorkspace(): Promise<Workspace> {
    return this.request<Workspace>('GET', '/workspace');
  }

  updateSettings(settings: Partial<{ theme: 'dark' | 'light'; telemetryEnabled: boolean }>): Promise<Workspace> {
    return this.request<Workspace>('PATCH', '/workspace', { settings });
  }

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

  listPlugins(): Promise<PluginRecord[]> {
    return this.request<PluginRecord[]>('GET', '/plugins');
  }

  runAgent(projectId: string, task: { type: string; description: string }): Promise<AgentResult> {
    return this.request<AgentResult>('POST', '/agent/run', { projectId, ...task });
  }

  async ping(): Promise<boolean> {
    try {
      await this.getWorkspace();
      return true;
    } catch {
      return false;
    }
  }
}
