// ─────────────────────────────────────────────────────────────────────────────
// plugin-docker — internal types
// ─────────────────────────────────────────────────────────────────────────────

import type { SpawnOptions } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { DeployStatus } from '@garagebuild/plugin-sdk';

// ── Injected spawner (for test isolation) ─────────────────────────────────────

export type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

// ── Deployment record ─────────────────────────────────────────────────────────

export interface DeploymentRecord {
  id: string;
  projectId: string;
  imageTag: string;
  containerName: string;
  port: number;
  environment: string;
  status: DeployStatus;
  url: string;
  startedAt: string;
}

// ── docker inspect output (subset we care about) ──────────────────────────────

export interface DockerInspectEntry {
  State: {
    Status: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';
    Running: boolean;
  };
}
