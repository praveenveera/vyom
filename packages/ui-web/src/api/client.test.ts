// ─────────────────────────────────────────────────────────────────────────────
// GarageBuildApiClient tests — fetch mocked via vi.stubGlobal
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GarageBuildApiClient } from './client';

// ── fetch mock helpers ────────────────────────────────────────────────────────

function okResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(message, { status });
}

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

let client: GarageBuildApiClient;

beforeEach(() => {
  client = new GarageBuildApiClient('http://localhost:3000');
  vi.stubGlobal('fetch', vi.fn());
});

function mockFetch(response: Response): void {
  vi.mocked(global.fetch).mockResolvedValueOnce(response);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GarageBuildApiClient', () => {
  // ── constructor ───────────────────────────────────────────────────────────

  it('strips trailing slash from baseUrl', () => {
    const c = new GarageBuildApiClient('http://localhost:3000/');
    mockFetch(okResponse({ id: 'ws1', name: 'W', owner: 'o', settings: { theme: 'dark', telemetryEnabled: false } }));
    // URL should be http://localhost:3000/workspace, not http://localhost:3000//workspace
    void c.getWorkspace();
    const url = (vi.mocked(global.fetch).mock.calls[0]?.[0] as string) ?? '';
    expect(url).toBe('http://localhost:3000/workspace');
  });

  // ── getWorkspace ──────────────────────────────────────────────────────────

  it('getWorkspace GETs /workspace', async () => {
    const ws = { id: 'ws1', name: 'My WS', owner: 'alice', settings: { theme: 'dark' as const, telemetryEnabled: true } };
    mockFetch(okResponse(ws));
    const result = await client.getWorkspace();
    expect(result.id).toBe('ws1');
    expect(result.name).toBe('My WS');
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/workspace');
    expect(opts.method).toBe('GET');
  });

  // ── updateSettings ────────────────────────────────────────────────────────

  it('updateSettings PATCHes /workspace with nested settings', async () => {
    const ws = { id: 'ws1', name: 'W', owner: 'o', settings: { theme: 'light' as const, telemetryEnabled: false } };
    mockFetch(okResponse(ws));
    await client.updateSettings({ theme: 'light' });
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/workspace');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ settings: { theme: 'light' } });
  });

  // ── listModels ────────────────────────────────────────────────────────────

  it('listModels GETs /workspace/models', async () => {
    mockFetch(okResponse([{ id: 'm1', provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o', isLocal: false, isActive: true }]));
    const models = await client.listModels();
    expect(models).toHaveLength(1);
    expect(models[0]?.provider).toBe('openai');
  });

  it('addModel POSTs to /workspace/models', async () => {
    const model = { id: 'm2', provider: 'openai', modelName: 'gpt-4o-mini', displayName: 'GPT-4o Mini', isLocal: false, isActive: false };
    mockFetch(okResponse(model));
    const result = await client.addModel({ provider: 'openai', modelName: 'gpt-4o-mini' });
    expect(result.id).toBe('m2');
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe('POST');
  });

  it('activateModel PUTs /workspace/models/:id/activate', async () => {
    const model = { id: 'm1', provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o', isLocal: false, isActive: true };
    mockFetch(okResponse(model));
    await client.activateModel('m1');
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/workspace/models/m1/activate');
    expect(opts.method).toBe('PUT');
  });

  it('removeModel DELETEs /workspace/models/:id', async () => {
    mockFetch(new Response(null, { status: 204 }));
    await client.removeModel('m1');
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/workspace/models/m1');
    expect(opts.method).toBe('DELETE');
  });

  // ── listProjects ──────────────────────────────────────────────────────────

  it('listProjects GETs /projects', async () => {
    const projects = [{ id: 'p1', name: 'My App', framework: 'react', path: '/tmp/app', createdAt: '2025-01-01' }];
    mockFetch(okResponse(projects));
    const result = await client.listProjects();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('My App');
  });

  it('createProject POSTs to /projects with body', async () => {
    const project = { id: 'p2', name: 'New App', framework: 'vue', path: '/tmp/new', createdAt: '2025-01-02' };
    mockFetch(okResponse(project));
    const result = await client.createProject({ name: 'New App', framework: 'vue', path: '/tmp/new' });
    expect(result.id).toBe('p2');
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toMatchObject({ name: 'New App' });
  });

  it('deleteProject DELETEs /projects/:id', async () => {
    mockFetch(new Response(null, { status: 204 }));
    await client.deleteProject('p1');
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/projects/p1');
    expect(opts.method).toBe('DELETE');
  });

  // ── sessions ──────────────────────────────────────────────────────────────

  it('listSessions GETs /projects/:id/sessions', async () => {
    const sessions = [{ id: 's1', projectId: 'p1', title: 'Session 1', status: 'active', createdAt: '2025-01-01' }];
    mockFetch(okResponse(sessions));
    const result = await client.listSessions('p1');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s1');
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/projects/p1/sessions');
  });

  it('createSession POSTs to /projects/:id/sessions', async () => {
    const session = { id: 's2', projectId: 'p1', title: 'New Session', status: 'active', createdAt: '2025-01-02' };
    mockFetch(okResponse(session));
    const result = await client.createSession('p1', 'New Session');
    expect(result.id).toBe('s2');
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/projects/p1/sessions');
    expect(opts.method).toBe('POST');
  });

  // ── plugins ───────────────────────────────────────────────────────────────

  it('listPlugins GETs /plugins', async () => {
    mockFetch(okResponse([{ id: 'docker', name: 'Docker', version: '0.1.0', type: 'deployment', status: 'loaded' }]));
    const plugins = await client.listPlugins();
    expect(plugins[0]?.id).toBe('docker');
  });

  // ── runAgent ──────────────────────────────────────────────────────────────

  it('runAgent POSTs to /agent/execute with task', async () => {
    mockFetch(okResponse({ success: true, output: 'All good', errors: [] }));
    const result = await client.runAgent({ type: 'review', description: 'Check for bugs' });
    expect(result.success).toBe(true);
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/agent/execute');
    const body = JSON.parse(opts.body as string) as { type: string };
    expect(body.type).toBe('review');
  });

  // ── streamAgent ───────────────────────────────────────────────────────────

  it('streamAgent calls onChunk for each content chunk', async () => {
    const lines = [
      'event: chunk',
      'data: {"delta":"Hello","accumulated":"Hello","isDone":false}',
      '',
      'event: chunk',
      'data: {"delta":" world","accumulated":"Hello world","isDone":false}',
      '',
      'event: done',
      'data: {"success":true}',
    ];
    mockFetch(sseResponse(lines));

    const chunks: string[] = [];
    await client.streamAgent(
      { type: 'chat', description: 'Hi' },
      {
        onChunk: ({ delta }) => chunks.push(delta),
        onDone: () => {},
        onError: () => {},
      },
    );

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('streamAgent calls onDone at the end', async () => {
    const lines = [
      'event: chunk',
      'data: {"delta":"Hi","accumulated":"Hi","isDone":false}',
      '',
      'event: done',
      'data: {"success":true}',
    ];
    mockFetch(sseResponse(lines));

    let done = false;
    await client.streamAgent(
      { type: 'chat', description: 'test' },
      {
        onChunk: () => {},
        onDone: () => { done = true; },
        onError: () => {},
      },
    );

    expect(done).toBe(true);
  });

  it('streamAgent delivers accumulated text correctly', async () => {
    const lines = [
      'event: chunk',
      'data: {"delta":"foo","accumulated":"foo","isDone":false}',
      '',
      'event: chunk',
      'data: {"delta":"bar","accumulated":"foobar","isDone":false}',
      '',
      'event: done',
      'data: {"success":true}',
    ];
    mockFetch(sseResponse(lines));

    const accumulated: string[] = [];
    await client.streamAgent(
      { type: 'chat', description: 'test' },
      {
        onChunk: (c) => accumulated.push(c.accumulated),
        onDone: () => {},
        onError: () => {},
      },
    );

    expect(accumulated).toEqual(['foo', 'foobar']);
  });

  it('streamAgent calls onError on HTTP error', async () => {
    mockFetch(errorResponse(500, 'Internal error'));

    let errorMsg = '';
    await client.streamAgent(
      { type: 'chat', description: 'test' },
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (msg) => { errorMsg = msg; },
      },
    );

    expect(errorMsg).toContain('500');
  });

  it('streamAgent calls onError when server emits error event', async () => {
    const lines = [
      'event: error',
      'data: {"message":"No model configured"}',
    ];
    mockFetch(sseResponse(lines));

    let errorMsg = '';
    await client.streamAgent(
      { type: 'chat', description: 'test' },
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (msg) => { errorMsg = msg; },
      },
    );

    expect(errorMsg).toBe('No model configured');
  });

  it('streamAgent calls onError when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    let errorMsg = '';
    await client.streamAgent(
      { type: 'chat', description: 'test' },
      {
        onChunk: () => {},
        onDone: () => {},
        onError: (msg) => { errorMsg = msg; },
      },
    );

    expect(errorMsg).toContain('ECONNREFUSED');
  });

  // ── cost / usage ─────────────────────────────────────────────────────────

  it('getWorkspaceCost GETs /workspace/cost', async () => {
    const summary = { scope: 'workspace', scopeId: 'ws1', totalInputTokens: 100, totalOutputTokens: 50, totalTokens: 150, totalCostUsd: 0.0012, localTokens: 0, cloudTokens: 150, byProvider: {}, byModel: {} };
    mockFetch(okResponse(summary));
    const result = await client.getWorkspaceCost();
    expect(result.totalTokens).toBe(150);
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/workspace/cost');
  });

  it('getProjectCost GETs /projects/:id/cost', async () => {
    const summary = { scope: 'project', scopeId: 'p1', totalInputTokens: 80, totalOutputTokens: 40, totalTokens: 120, totalCostUsd: 0.0008, localTokens: 0, cloudTokens: 120, byProvider: {}, byModel: {} };
    mockFetch(okResponse(summary));
    const result = await client.getProjectCost('p1');
    expect(result.scopeId).toBe('p1');
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/projects/p1/cost');
  });

  it('getSessionCost GETs /projects/:pid/sessions/:sid/cost', async () => {
    const summary = { scope: 'session', scopeId: 's1', totalInputTokens: 20, totalOutputTokens: 10, totalTokens: 30, totalCostUsd: 0.0002, localTokens: 0, cloudTokens: 30, byProvider: {}, byModel: {} };
    mockFetch(okResponse(summary));
    const result = await client.getSessionCost('p1', 's1');
    expect(result.scope).toBe('session');
    const [url] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/projects/p1/sessions/s1/cost');
  });

  // ── ping ──────────────────────────────────────────────────────────────────

  it('ping returns true when getWorkspace succeeds', async () => {
    const ws = { id: 'ws1', name: 'W', owner: 'o', settings: { theme: 'dark' as const, telemetryEnabled: false } };
    mockFetch(okResponse(ws));
    expect(await client.ping()).toBe(true);
  });

  it('ping returns false when fetch rejects', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));
    expect(await client.ping()).toBe(false);
  });

  // ── error handling ────────────────────────────────────────────────────────

  it('rejects with HTTP error on non-2xx response', async () => {
    mockFetch(errorResponse(404, 'Not found'));
    await expect(client.getProject('bad-id')).rejects.toThrow('HTTP 404');
  });

  it('sends Content-Type: application/json header', async () => {
    const ws = { id: 'ws1', name: 'W', owner: 'o', settings: { theme: 'dark' as const, telemetryEnabled: false } };
    mockFetch(okResponse(ws));
    await client.getWorkspace();
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('does not send body on GET requests', async () => {
    mockFetch(okResponse([]));
    await client.listProjects();
    const [, opts] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(opts.body).toBeUndefined();
  });
});
