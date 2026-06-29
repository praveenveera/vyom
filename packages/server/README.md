# @garagebuild/server

Fastify REST API server for the GarageBuild platform. Wraps the engine and exposes all functionality over HTTP, including a Server-Sent Events endpoint for streaming agent output.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/workspace` | Current workspace and settings |
| PATCH | `/workspace` | Update workspace settings |
| GET | `/workspace/models` | List model configurations |
| POST | `/workspace/models` | Add a model configuration |
| PUT | `/workspace/models/:id/activate` | Set the active model |
| DELETE | `/workspace/models/:id` | Remove a model |
| GET | `/workspace/cost` | Workspace-level cost summary |
| GET | `/projects` | List projects |
| POST | `/projects` | Create a project |
| GET | `/projects/:id` | Get project details |
| DELETE | `/projects/:id` | Delete a project |
| GET | `/projects/:id/files/*` | Read a project file |
| GET | `/projects/:projectId/sessions` | List sessions |
| POST | `/projects/:projectId/sessions` | Start a session |
| GET | `/projects/:projectId/sessions/:id` | Get session + messages |
| DELETE | `/projects/:projectId/sessions/:id` | End a session |
| GET | `/projects/:projectId/sessions/:id/cost` | Session cost |
| POST | `/agent/run` | Run an agent task (returns JSON result) |
| GET | `/agent/stream` | Stream agent output via SSE |
| GET | `/plugins` | List loaded plugins |
| POST | `/plugins/:id/health` | Health check a plugin |

## SSE Streaming

The `/agent/stream` endpoint uses Server-Sent Events:

```
event: chunk
data: {"delta":"Hello","accumulated":"Hello","isDone":false}

event: done
data: {"success":true,"output":"Hello world","errors":[]}
```

## Install & Build

```bash
npm install --workspace=packages/server
npm run build --workspace=packages/server
npm test --workspace=packages/server
```

## Usage

```typescript
import { GarageBuildEngine } from '@garagebuild/engine';
import { createApp } from '@garagebuild/server';

const engine = new GarageBuildEngine('./garagebuild.db');
await engine.initialize();

const app = await createApp(engine, { logger: true });
await app.listen({ port: 3000 });
```
