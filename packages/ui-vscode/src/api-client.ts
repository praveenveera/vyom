// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild VS Code extension — REST API client
//
// Pure Node.js http/https — no external dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import * as http from 'node:http';
import * as https from 'node:https';
import type { Workspace, Project, PluginRecord, AgentResult, CreateProjectInput, RunAgentInput } from './types';

export interface ApiClientOptions {
  baseUrl: string;
  timeout?: number;
}

export class GarageBuildApiClient {
  private readonly baseUrl: URL;
  private readonly timeout: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.timeout = options.timeout ?? 10_000;
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl.toString());
      const isHttps = url.protocol === 'https:';
      const driver = isHttps ? https : http;

      const payload = body !== undefined ? JSON.stringify(body) : undefined;
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(payload !== undefined && { 'Content-Length': Buffer.byteLength(payload) }),
      };

      const portNum = url.port !== '' ? parseInt(url.port, 10) : (isHttps ? 443 : 80);

      const req = driver.request(
        { hostname: url.hostname, port: portNum, path: url.pathname + url.search, method, headers },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            if (res.statusCode !== undefined && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error('Invalid JSON response from server'));
            }
          });
        },
      );

      req.setTimeout(this.timeout, () => req.destroy(new Error(`Request timed out after ${this.timeout}ms`)));
      req.on('error', reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  }

  getWorkspace(): Promise<Workspace> {
    return this.request<Workspace>('GET', '/workspace');
  }

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/projects');
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.request<Project>('POST', '/projects', input);
  }

  listPlugins(): Promise<PluginRecord[]> {
    return this.request<PluginRecord[]>('GET', '/plugins');
  }

  runAgent(input: RunAgentInput): Promise<AgentResult> {
    return this.request<AgentResult>('POST', '/agent/run', input);
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
