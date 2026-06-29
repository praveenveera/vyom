# @garagebuild/engine

The GarageBuild core platform engine. Manages workspaces, projects, sessions, AI model routing, plugin registration, cost tracking, file operations, and agent execution. All subsystems communicate exclusively through a typed EventBus — no direct calls between subsystems.

## Subsystems

| Subsystem | File | Responsibility |
|-----------|------|---------------|
| EventBus | `event-bus/event-bus.ts` | Typed pub/sub backbone — the only cross-subsystem communication channel |
| WorkspaceManager | `workspace-manager/workspace-manager.ts` | Root workspace, settings, model configs |
| ProjectManager | `project-manager/project-manager.ts` | Project lifecycle — create, open, archive |
| SessionManager | `session-manager/session-manager.ts` | AI sessions, message history, context tracking |
| CostEngine | `cost-engine/cost-engine.ts` | Token usage recording and cost aggregation |
| PluginRegistry | `plugin-registry/plugin-registry.ts` | Plugin load, health check, lookup by type |
| ModelRouter | `model-router/model-router.ts` | Routes chat/stream calls through the active model plugin |
| AgentRunner | `agent-runner/agent-runner.ts` | Dispatches agent tasks to registered agent definitions |
| FileSystem | `file-system/file-system.ts` | File CRUD and project directory watching |
| GarageBuildEngine | `engine.ts` | Orchestrator — initialises all subsystems, exposes single API surface |

## Install & Build

```bash
npm install --workspace=packages/engine
npm run build --workspace=packages/engine
npm test --workspace=packages/engine      # runs Jest with coverage
```

## Usage

```typescript
import { GarageBuildEngine } from '@garagebuild/engine';

const engine = new GarageBuildEngine('/path/to/garagebuild.db');
await engine.initialize();

// Create a project
const project = engine.projectManager.createProject({
  name: 'My App',
  framework: 'react',
  path: '/home/user/my-app',
});

// Register a model plugin and route a chat request
await engine.pluginRegistry.loadPlugin(openAIPlugin);
const response = await engine.modelRouter.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4o',
});

await engine.shutdown();
```

## Architecture Rule

> Subsystems never call each other directly. All communication goes through the EventBus.

```typescript
// ✅ Correct
sessionManager.recordAssistantMessage(...)  // emits 'message.completed'
// CostEngine listens and records usage automatically

// ❌ Wrong
sessionManager.costEngine.record(...)
```

## Database

Single SQLite database shared across all subsystems via `workspaceManager.getDb()`. Schema is defined in `workspace-manager/database.ts`.
