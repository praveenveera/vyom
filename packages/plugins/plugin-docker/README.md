# @garagebuild/plugin-docker

GarageBuild deployment plugin for Docker. Implements `DeploymentPlugin` from `@garagebuild/plugin-sdk`. Builds images, runs containers, and manages their lifecycle using injected `child_process.spawn` — making it fully testable without a real Docker daemon.

## Capabilities

| Method | Docker Command | Description |
|--------|---------------|-------------|
| `deploy` | `docker build` + `docker run` | Build image and start container |
| `undeploy` | `docker stop` + `docker rm` | Stop and remove a deployment |
| `getStatus` | `docker inspect` | Check if container is running |
| `generateDockerfile` | — | Multi-stage nginx Dockerfile |
| `generateComposeFile` | — | `docker-compose.yml` with healthcheck |
| `generateManifests` | — | Returns `[]` (k8s planned for Phase 4) |

## Install & Build

```bash
npm install --workspace=packages/plugins/plugin-docker
npm run build --workspace=packages/plugins/plugin-docker
npm test --workspace=packages/plugins/plugin-docker   # 24 tests, no Docker required
```

## Usage

```typescript
import { DockerPlugin } from '@garagebuild/plugin-docker';

const plugin = new DockerPlugin();   // uses real child_process.spawn
await plugin.initialize({});

const result = await plugin.deploy(project, {
  target: 'local',
  environment: 'production',
  envVars: { NODE_ENV: 'production' },
});
// result.url → 'http://localhost:8080'

await plugin.undeploy(result.deploymentId);
```

## Testability

The plugin accepts an optional `SpawnFn` parameter so tests can inject a mock spawner without requiring Docker:

```typescript
import type { SpawnFn } from '@garagebuild/plugin-docker';

const mockSpawn: SpawnFn = (cmd, args, opts) => {
  // return a mock ChildProcess
};
const plugin = new DockerPlugin(mockSpawn);
```
