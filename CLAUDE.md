# GarageBuild — Claude Code Context

GarageBuild (व्योम) is an open AI development platform. Build Once. Run Anywhere. Use Any AI. Own Everything.

## Quick commands

```bash
npm run build                                  # Build all packages (turbo)
npm run test                                   # Test all packages (turbo)
npm run build --workspace=packages/engine      # Build engine only
npm test --workspace=packages/engine           # Test engine only (with coverage)
npm run build --workspace=packages/plugin-sdk  # Build plugin-sdk only
```

## Monorepo layout

```
packages/
  engine/          ← Core platform engine (Node.js + TypeScript + SQLite)
  plugin-sdk/      ← Shared plugin interfaces and types (start here for new plugins)
  plugins/
    plugin-openai/     ← Phase 1
    plugin-anthropic/  ← Phase 1
    plugin-ollama/     ← Phase 1
    plugin-react/      ← Phase 1
    plugin-docker/     ← Phase 1 ✅
  cli/             ← Command-line interface
  ui-desktop/      ← Tauri + React desktop app ✅
  ui-web/          ← React SPA ✅
  ui-vscode/       ← VS Code extension ✅
docs/
  adr/             ← Architecture decision records
  project/         ← Architecture and engineering documents
```

## Engine subsystem status

| Subsystem | File | Status |
|-----------|------|--------|
| EventBus | `event-bus/event-bus.ts` | ✅ |
| WorkspaceManager | `workspace-manager/workspace-manager.ts` | ✅ |
| ProjectManager | `project-manager/project-manager.ts` | ✅ |
| SessionManager | `session-manager/session-manager.ts` | ✅ |
| CostEngine | `cost-engine/cost-engine.ts` | ✅ |
| PluginRegistry | `plugin-registry/plugin-registry.ts` | ✅ |
| ModelRouter | `model-router/model-router.ts` | ✅ |
| AgentRunner | `agent-runner/agent-runner.ts` | ✅ |
| FileSystem | `file-system/file-system.ts` | ✅ |
| GarageBuildEngine | `engine.ts` | ✅ (orchestrator) |

Database schema: `workspace-manager/database.ts`  
All managers share one SQLite connection via `workspaceManager.getDb()`.

## The single most important rule

**Subsystems never call each other directly. All communication goes through the Event Bus.**

```typescript
// ✅
sessionManager.recordAssistantMessage(...)  // emits 'message.completed'
// CostEngine listens → records usage automatically

// ❌
sessionManager → costEngine.record(...)
```

## Plugin conventions

- Plugin manifest `id` must equal the provider/framework name (e.g. `'openai'`, `'react'`).  
  This is the key `PluginRegistry.getModelPlugin(provider)` and `ModelRouter` use.
- All plugin interfaces live in `packages/plugin-sdk/src/interfaces.ts`.
- All plugin types live in `packages/plugin-sdk/src/types.ts`.
- New plugin packages go in `packages/plugins/plugin-{name}/`.

## TypeScript config

`tsconfig.base.json` at root — strict mode, `exactOptionalPropertyTypes: true`, `NodeNext` modules.  
Use `import type` for type-only imports. Never pass `undefined` to optional fields that use `?:` — spread instead: `...(val !== undefined && { key: val })`.

## Test conventions

- Tests live next to source: `foo.test.ts` beside `foo.ts`.
- Each test gets its own temp SQLite db: `join(tmpdir(), 'garagebuild-test-' + randomUUID() + '.db')`.
- Always seed FK prerequisites (workspaces → projects → sessions → messages) before testing child tables.
- Call `eventBus.removeAllListeners()` in `beforeEach` to prevent handler leakage between tests.

## Workspace Rules & Customizations

Detailed workspace configurations, Event Bus conventions, TypeScript constraints, and documentation guidelines are codified in [.agents/AGENTS.md](file:///.agents/AGENTS.md). 

### 🛡️ Agent Execution Rules (Hard Requirement - Cannot Miss)
1. **Git Sandbox Rule:** Verify workspace status before running file-writing or compiler tools. Advise staging/committing changes first so they can be reverted via `git reset --hard`.
2. **Local Verification Rule:** Run package test suites (`npm run test` or `npm test --workspace=packages/engine`) locally to verify all changes before completing your work. Report the test run metrics in your chat response.
3. **Tool Calling Regex:** Use non-greedy regex-based XML tags (`<write_file path="...">...</write_file>`) for tool operations to avoid parser loop failures.
4. **Parallel Python & TS:** Provide equivalent script examples in both Python and TypeScript.


