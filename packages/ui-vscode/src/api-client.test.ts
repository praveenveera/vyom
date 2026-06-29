// ─────────────────────────────────────────────────────────────────────────────
// GarageBuildApiClient tests — real local HTTP server, no mocks needed
// ─────────────────────────────────────────────────────────────────────────────

import * as http from 'node:http';
import * as net from 'node:net';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GarageBuildApiClient } from './api-client';

// ── Mini fake server ──────────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let client: GarageBuildApiClient;

beforeAll(() => new Promise<void>((resolve) => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const rawBody = chunks.length > 0 ? Buffer.concat(chunks).toString() : '';
      const body = rawBody.length > 0 ? (JSON.parse(rawBody) as unknown) : undefined;

      res.setHeader('Content-Type', 'application/json');

      if (req.url === '/workspace' && req.method === 'GET') {
        res.end(JSON.stringify({ id: 'ws-1', name: 'Test Workspace', owner: 'tester' }));

      } else if (req.url === '/projects' && req.method === 'GET') {
        res.end(JSON.stringify([
          { id: 'p1', name: 'My App', framework: 'react', path: '/tmp/my-app' },
        ]));

      } else if (req.url === '/projects' && req.method === 'POST') {
        res.statusCode = 201;
        res.end(JSON.stringify({ id: 'new-id', ...(body as object) }));

      } else if (req.url === '/plugins' && req.method === 'GET') {
        res.end(JSON.stringify([
          { id: 'docker', name: 'Docker', version: '0.1.0', type: 'deployment', status: 'loaded' },
        ]));

      } else if (req.url === '/agent/run' && req.method === 'POST') {
        res.end(JSON.stringify({ success: true, output: 'Looks good!', errors: [] }));

      } else if (req.url === '/bad-json') {
        res.end('not json at all');

      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
      }
    });
  });

  server.listen(0, () => {
    port = (server.address() as net.AddressInfo).port;
    client = new GarageBuildApiClient({ baseUrl: `http://localhost:${port}` });
    resolve();
  });
}));

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GarageBuildApiClient', () => {
  // ── getWorkspace ─────────────────────────────────────────────────────────

  it('getWorkspace returns the workspace object', async () => {
    const ws = await client.getWorkspace();
    expect(ws.id).toBe('ws-1');
    expect(ws.name).toBe('Test Workspace');
    expect(ws.owner).toBe('tester');
  });

  // ── listProjects ─────────────────────────────────────────────────────────

  it('listProjects returns array of projects', async () => {
    const projects = await client.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe('My App');
    expect(projects[0]?.framework).toBe('react');
  });

  // ── createProject ─────────────────────────────────────────────────────────

  it('createProject POSTs body and returns created project', async () => {
    const created = await client.createProject({
      name: 'Brand New App',
      framework: 'vue',
      typescript: true,
      tailwind: true,
      outputPath: '/tmp/brand-new',
    });
    expect(created.id).toBe('new-id');
    expect(created.name).toBe('Brand New App');
    expect(created.framework).toBe('vue');
  });

  // ── listPlugins ───────────────────────────────────────────────────────────

  it('listPlugins returns array of plugin records', async () => {
    const plugins = await client.listPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.id).toBe('docker');
    expect(plugins[0]?.type).toBe('deployment');
  });

  // ── runAgent ──────────────────────────────────────────────────────────────

  it('runAgent POSTs task and returns agent result', async () => {
    const result = await client.runAgent({
      type: 'review',
      description: 'Review this function for bugs',
      filePath: '/tmp/my-app/src/main.ts',
    });
    expect(result.success).toBe(true);
    expect(result.output).toBe('Looks good!');
    expect(result.errors).toHaveLength(0);
  });

  it('runAgent works without optional filePath', async () => {
    const result = await client.runAgent({
      type: 'explain',
      description: 'Explain what this does',
    });
    expect(result.success).toBe(true);
  });

  // ── ping ──────────────────────────────────────────────────────────────────

  it('ping returns true when server is reachable', async () => {
    const ok = await client.ping();
    expect(ok).toBe(true);
  });

  it('ping returns false when server is not reachable', async () => {
    const bad = new GarageBuildApiClient({ baseUrl: 'http://127.0.0.1:1', timeout: 500 });
    const ok = await bad.ping();
    expect(ok).toBe(false);
  });

  // ── error handling ────────────────────────────────────────────────────────

  it('rejects with HTTP error message on 4xx response', async () => {
    // Access the private request method via cast to hit the 404 route
    await expect(
      (client as unknown as { request: (m: string, p: string) => Promise<unknown> })
        .request('GET', '/unknown-path'),
    ).rejects.toThrow(/HTTP 404/);
  });

  it('rejects when response body is not valid JSON', async () => {
    await expect(
      (client as unknown as { request: (m: string, p: string) => Promise<unknown> })
        .request('GET', '/bad-json'),
    ).rejects.toThrow(/Invalid JSON/);
  });

  // ── timeout ───────────────────────────────────────────────────────────────

  it('uses default timeout of 10000ms', () => {
    const c = new GarageBuildApiClient({ baseUrl: 'http://localhost:3000' });
    // accessing private field via cast to verify default
    expect((c as unknown as { timeout: number }).timeout).toBe(10_000);
  });

  it('accepts custom timeout', () => {
    const c = new GarageBuildApiClient({ baseUrl: 'http://localhost:3000', timeout: 500 });
    expect((c as unknown as { timeout: number }).timeout).toBe(500);
  });
});
