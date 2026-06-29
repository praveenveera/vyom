// ─────────────────────────────────────────────────────────────────────────────
// plugin-docker — DockerPlugin tests (injected spawner, no Docker required)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { Project, DeployConfig } from '@garagebuild/plugin-sdk';
import type { SpawnFn } from './types.js';
import { DockerPlugin } from './docker-plugin.js';

// ── Mock spawner factory ──────────────────────────────────────────────────────

interface MockResponse { code: number; stdout?: string; stderr?: string; }

interface MockSpawner {
  spawn: SpawnFn;
  calls: Array<{ cmd: string; args: string[]; cwd?: string }>;
}

function makeMockSpawn(responses: MockResponse[]): MockSpawner {
  const calls: MockSpawner['calls'] = [];
  let index = 0;

  const spawn: SpawnFn = (cmd, args, opts) => {
    calls.push({ cmd, args, ...(opts.cwd !== undefined && { cwd: opts.cwd as string }) });
    const response = responses[index++] ?? { code: 0 };

    const emitter = new EventEmitter();
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();

    setImmediate(() => {
      if (response.stdout) stdoutEmitter.emit('data', Buffer.from(response.stdout));
      if (response.stderr) stderrEmitter.emit('data', Buffer.from(response.stderr));
      emitter.emit('close', response.code);
    });

    return Object.assign(emitter, {
      stdout: stdoutEmitter,
      stderr: stderrEmitter,
    }) as unknown as ChildProcess;
  };

  return { spawn, calls };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_PROJECT: Project = {
  id: 'proj-123',
  name: 'my-app',
  framework: 'react',
  path: '/tmp/my-app',
};

const FAKE_CONFIG: DeployConfig = {
  target: 'local',
  environment: 'development',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DockerPlugin', () => {
  let plugin: DockerPlugin;

  beforeEach(() => {
    plugin = new DockerPlugin(makeMockSpawn([]).spawn);
  });

  // ── Manifest / schema ──────────────────────────────────────────────────────

  it('getManifest returns correct id and type', () => {
    const m = plugin.getManifest();
    expect(m.id).toBe('docker');
    expect(m.type).toBe('deployment');
    expect(m.sandboxTier).toBe('trusted');
  });

  it('getConfigSchema fields is a plain object (not array)', () => {
    const schema = plugin.getConfigSchema();
    expect(schema.fields).not.toBeInstanceOf(Array);
    expect(typeof schema.fields).toBe('object');
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  it('initialize resolves without error', async () => {
    await expect(plugin.initialize({})).resolves.toBeUndefined();
  });

  it('teardown resolves without error', async () => {
    await expect(plugin.teardown()).resolves.toBeUndefined();
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  it('healthCheck returns healthy when docker info exits 0', async () => {
    const { spawn } = makeMockSpawn([{ code: 0, stdout: '24.0.5' }]);
    const p = new DockerPlugin(spawn);
    const result = await p.healthCheck();
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('healthCheck returns unhealthy when docker info exits non-zero', async () => {
    const { spawn } = makeMockSpawn([{ code: 1, stderr: 'Cannot connect' }]);
    const p = new DockerPlugin(spawn);
    const result = await p.healthCheck();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toMatch(/daemon/i);
  });

  it('healthCheck returns unhealthy when spawn throws', async () => {
    const badSpawn: SpawnFn = () => { throw new Error('ENOENT'); };
    const p = new DockerPlugin(badSpawn);
    const result = await p.healthCheck();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toMatch(/Failed/i);
  });

  // ── deploy ─────────────────────────────────────────────────────────────────

  it('deploy calls docker build then docker run on success', async () => {
    const { spawn, calls } = makeMockSpawn([
      { code: 0 }, // build
      { code: 0, stdout: 'abc123\n' }, // run
    ]);
    const p = new DockerPlugin(spawn);
    const result = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.url).toMatch(/http:\/\/localhost:\d+/);
    expect(result.deploymentId).toBeTruthy();

    expect(calls[0]?.cmd).toBe('docker');
    expect(calls[0]?.args[0]).toBe('build');
    expect(calls[0]?.cwd).toBe('/tmp/my-app');

    expect(calls[1]?.cmd).toBe('docker');
    expect(calls[1]?.args[0]).toBe('run');
  });

  it('deploy returns failure when docker build fails', async () => {
    const { spawn } = makeMockSpawn([
      { code: 1, stderr: 'Dockerfile not found' },
    ]);
    const p = new DockerPlugin(spawn);
    const result = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/build failed/i);
  });

  it('deploy returns failure when docker run fails', async () => {
    const { spawn } = makeMockSpawn([
      { code: 0 }, // build succeeds
      { code: 1, stderr: 'port already in use' }, // run fails
    ]);
    const p = new DockerPlugin(spawn);
    const result = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/run failed/i);
  });

  it('deploy includes -e flags for envVars', async () => {
    const { spawn, calls } = makeMockSpawn([
      { code: 0 },
      { code: 0, stdout: 'cid\n' },
    ]);
    const p = new DockerPlugin(spawn);
    await p.deploy(FAKE_PROJECT, {
      target: 'local',
      environment: 'production',
      envVars: { FOO: 'bar', BAZ: 'qux' },
    });

    const runArgs = calls[1]?.args ?? [];
    expect(runArgs).toContain('-e');
    expect(runArgs).toContain('FOO=bar');
    expect(runArgs).toContain('BAZ=qux');
  });

  it('deploy increments port with each call', async () => {
    const p = new DockerPlugin(
      makeMockSpawn(Array.from({ length: 4 }, () => ({ code: 0, stdout: 'cid\n' }))).spawn,
    );

    const r1 = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);
    const r2 = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);

    const port1 = Number(r1.url?.split(':')[2]);
    const port2 = Number(r2.url?.split(':')[2]);
    expect(port2).toBe(port1 + 1);
  });

  it('deploy uses image tag derived from project name and environment', async () => {
    const { spawn, calls } = makeMockSpawn([{ code: 0 }, { code: 0, stdout: 'cid\n' }]);
    const p = new DockerPlugin(spawn);
    await p.deploy(FAKE_PROJECT, { target: 'local', environment: 'staging' });

    const buildArgs = calls[0]?.args ?? [];
    const tagIndex = buildArgs.indexOf('-t');
    expect(buildArgs[tagIndex + 1]).toContain('staging');
    expect(buildArgs[tagIndex + 1]).toContain('my-app');
  });

  // ── undeploy ───────────────────────────────────────────────────────────────

  it('undeploy calls docker stop then docker rm', async () => {
    const { spawn, calls } = makeMockSpawn([
      { code: 0 }, { code: 0, stdout: 'cid\n' }, // deploy: build + run
      { code: 0 }, { code: 0 }, // undeploy: stop + rm
    ]);
    const p = new DockerPlugin(spawn);
    const { deploymentId } = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);
    await p.undeploy(deploymentId);

    const stopCall = calls.find(c => c.args.includes('stop'));
    const rmCall = calls.find(c => c.args.includes('rm'));
    expect(stopCall).toBeDefined();
    expect(rmCall).toBeDefined();
  });

  it('undeploy throws when deploymentId is unknown', async () => {
    const { spawn } = makeMockSpawn([]);
    const p = new DockerPlugin(spawn);
    await expect(p.undeploy('does-not-exist')).rejects.toThrow(/not found/);
  });

  // ── getStatus ──────────────────────────────────────────────────────────────

  it('getStatus returns deployed when container is running', async () => {
    const { spawn, calls: _ } = makeMockSpawn([
      { code: 0 }, // build
      { code: 0, stdout: 'cid\n' }, // run
      { code: 0, stdout: 'running\n' }, // inspect
    ]);
    const p = new DockerPlugin(spawn);
    const { deploymentId } = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);
    const status = await p.getStatus(deploymentId);
    expect(status).toBe('deployed');
  });

  it('getStatus returns failed when container is stopped', async () => {
    const { spawn } = makeMockSpawn([
      { code: 0 },
      { code: 0, stdout: 'cid\n' },
      { code: 0, stdout: 'exited\n' },
    ]);
    const p = new DockerPlugin(spawn);
    const { deploymentId } = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);
    const status = await p.getStatus(deploymentId);
    expect(status).toBe('failed');
  });

  it('getStatus returns failed when inspect exits non-zero', async () => {
    const { spawn } = makeMockSpawn([
      { code: 0 },
      { code: 0, stdout: 'cid\n' },
      { code: 1, stderr: 'No such container' },
    ]);
    const p = new DockerPlugin(spawn);
    const { deploymentId } = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);
    const status = await p.getStatus(deploymentId);
    expect(status).toBe('failed');
  });

  it('getStatus throws when deploymentId is unknown', async () => {
    const { spawn } = makeMockSpawn([]);
    const p = new DockerPlugin(spawn);
    await expect(p.getStatus('ghost-id')).rejects.toThrow(/not found/);
  });

  // ── generateDockerfile ────────────────────────────────────────────────────

  it('generateDockerfile returns non-empty string containing FROM and nginx', async () => {
    const { spawn } = makeMockSpawn([]);
    const p = new DockerPlugin(spawn);
    const content = await p.generateDockerfile(FAKE_PROJECT);
    expect(content).toContain('FROM node:');
    expect(content).toContain('nginx');
    expect(content).toContain('EXPOSE 80');
  });

  it('generateDockerfile sanitises project name for the label', async () => {
    const { spawn } = makeMockSpawn([]);
    const p = new DockerPlugin(spawn);
    const tricky: Project = { ...FAKE_PROJECT, name: 'My App!' };
    const content = await p.generateDockerfile(tricky);
    // safeName converts to lowercase + hyphens
    expect(content).toContain('my-app-');
  });

  // ── generateComposeFile ───────────────────────────────────────────────────

  it('generateComposeFile returns YAML containing project name and port 80', async () => {
    const { spawn } = makeMockSpawn([]);
    const p = new DockerPlugin(spawn);
    const content = await p.generateComposeFile(FAKE_PROJECT);
    expect(content).toContain('my-app');
    expect(content).toContain(':80');
  });

  // ── generateManifests ─────────────────────────────────────────────────────

  it('generateManifests returns an empty array (Phase 1 — no k8s)', async () => {
    const { spawn } = makeMockSpawn([]);
    const p = new DockerPlugin(spawn);
    const manifests = await p.generateManifests(FAKE_PROJECT);
    expect(manifests).toEqual([]);
  });

  // ── teardown clears deployments ───────────────────────────────────────────

  it('teardown clears deployment map so getStatus throws afterwards', async () => {
    const { spawn } = makeMockSpawn([{ code: 0 }, { code: 0, stdout: 'cid\n' }]);
    const p = new DockerPlugin(spawn);
    const { deploymentId } = await p.deploy(FAKE_PROJECT, FAKE_CONFIG);
    await p.teardown();
    await expect(p.getStatus(deploymentId)).rejects.toThrow(/not found/);
  });
});
