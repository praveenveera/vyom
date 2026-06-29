// ─────────────────────────────────────────────────────────────────────────────
// plugin-docker — DeploymentPlugin implementation
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type {
  PluginConfig,
  PluginManifest,
  ConfigSchema,
  HealthResult,
  Project,
  DeployConfig,
  DeployResult,
  DeployStatus,
  GeneratedFile,
} from '@garagebuild/plugin-sdk';
import type { DeploymentPlugin } from '@garagebuild/plugin-sdk';
import type { SpawnFn, DeploymentRecord } from './types.js';
import { dockerfile, composeFile } from './templates.js';

const MANIFEST: PluginManifest = {
  id: 'docker',
  name: 'Docker',
  version: '0.1.0',
  type: 'deployment',
  author: 'GarageBuild',
  description: 'Build, run and manage containers for GarageBuild projects',
  entry: 'dist/index.js',
  configSchema: 'docker-schema.json',
  capabilities: ['deploy', 'undeploy', 'status', 'dockerfile', 'compose'],
  minGarageBuildVersion: '0.1.0',
  sandboxTier: 'trusted',
};

// ── Internal helper ───────────────────────────────────────────────────────────

function runCommand(
  spawnFn: SpawnFn,
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawnFn(cmd, args, { ...(cwd !== undefined && { cwd }), stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('close', (code: number | null) => { resolve({ code: code ?? 1, stdout, stderr }); });
  });
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export class DockerPlugin implements DeploymentPlugin {
  private readonly _spawn: SpawnFn;
  private readonly _deployments = new Map<string, DeploymentRecord>();
  private _nextPort = 8080;

  constructor(spawnFn: SpawnFn = spawn) {
    this._spawn = spawnFn;
  }

  async initialize(_config: PluginConfig): Promise<void> {}

  async teardown(): Promise<void> {
    this._deployments.clear();
  }

  async healthCheck(): Promise<HealthResult> {
    const start = Date.now();
    try {
      const { code } = await runCommand(this._spawn, 'docker', ['info', '--format', '{{.ServerVersion}}']);
      if (code !== 0) {
        return { status: 'unhealthy', message: 'Docker daemon not accessible' };
      }
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch {
      return { status: 'unhealthy', message: 'Failed to run docker info' };
    }
  }

  getManifest(): PluginManifest {
    return MANIFEST;
  }

  getConfigSchema(): ConfigSchema {
    return { fields: {} };
  }

  async deploy(project: Project, config: DeployConfig): Promise<DeployResult> {
    const deploymentId = randomUUID();
    const port = this._nextPort++;
    const imageTag = `garagebuild-${project.name.toLowerCase()}:${config.environment}`;
    const containerName = `garagebuild-${deploymentId.slice(0, 8)}-${config.environment}`;

    // Build image
    const build = await runCommand(
      this._spawn,
      'docker',
      ['build', '-t', imageTag, '.'],
      project.path,
    );
    if (build.code !== 0) {
      return {
        success: false,
        deploymentId,
        errors: [`docker build failed: ${build.stderr.trim() || build.stdout.trim()}`],
      };
    }

    // Compose optional env args
    const envArgs: string[] = [];
    if (config.envVars !== undefined) {
      for (const [k, v] of Object.entries(config.envVars)) {
        envArgs.push('-e', `${k}=${v}`);
      }
    }

    // Run container
    const run = await runCommand(
      this._spawn,
      'docker',
      ['run', '-d', '-p', `${port}:80`, '--name', containerName, ...envArgs, imageTag],
    );
    if (run.code !== 0) {
      return {
        success: false,
        deploymentId,
        errors: [`docker run failed: ${run.stderr.trim() || run.stdout.trim()}`],
      };
    }

    const url = `http://localhost:${port}`;
    this._deployments.set(deploymentId, {
      id: deploymentId,
      projectId: project.id,
      imageTag,
      containerName,
      port,
      environment: config.environment,
      status: 'deployed',
      url,
      startedAt: new Date().toISOString(),
    });

    return { success: true, deploymentId, url, errors: [] };
  }

  async undeploy(deploymentId: string): Promise<void> {
    const record = this._deployments.get(deploymentId);
    if (record === undefined) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    await runCommand(this._spawn, 'docker', ['stop', record.containerName]);
    await runCommand(this._spawn, 'docker', ['rm', record.containerName]);
    this._deployments.delete(deploymentId);
  }

  async getStatus(deploymentId: string): Promise<DeployStatus> {
    const record = this._deployments.get(deploymentId);
    if (record === undefined) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const { code, stdout } = await runCommand(
      this._spawn,
      'docker',
      ['inspect', '--format', '{{.State.Status}}', record.containerName],
    );

    if (code !== 0) {
      record.status = 'failed';
      return 'failed';
    }

    const state = stdout.trim();
    if (state === 'running') {
      record.status = 'deployed';
      return 'deployed';
    }

    record.status = 'failed';
    return 'failed';
  }

  async generateDockerfile(project: Project): Promise<string> {
    return dockerfile(project);
  }

  async generateComposeFile(project: Project): Promise<string> {
    return composeFile(project);
  }

  async generateManifests(_project: Project): Promise<GeneratedFile[]> {
    return [];
  }
}
