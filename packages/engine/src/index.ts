// GarageBuild Engine — Public API

// ── Orchestrator ──────────────────────────────────────────────────────────────
export { GarageBuildEngine } from './engine.js';

// ── Event Bus ─────────────────────────────────────────────────────────────────
export { EventBus, eventBus } from './event-bus/event-bus.js';
export type { GarageBuildEvents, GarageBuildEventName, GarageBuildEventPayload } from './event-bus/event-bus.js';

// ── WorkspaceManager ──────────────────────────────────────────────────────────
export { WorkspaceManager } from './workspace-manager/workspace-manager.js';
export type {
  Workspace,
  WorkspaceSettings,
  ModelConfig,
  AddModelConfigOptions,
} from './workspace-manager/workspace-manager.js';
export { initDatabase, getGarageBuildDir, getDatabasePath } from './workspace-manager/database.js';

// ── ProjectManager ────────────────────────────────────────────────────────────
export { ProjectManager } from './project-manager/project-manager.js';
export type {
  Project,
  CreateProjectOptions,
  ProjectStatus,
  Framework,
} from './project-manager/project-manager.js';

// ── SessionManager ────────────────────────────────────────────────────────────
export { SessionManager } from './session-manager/session-manager.js';
export type {
  Session,
  Message,
  MessageRole,
  RecordAssistantMessageOptions,
} from './session-manager/session-manager.js';

// ── CostEngine ────────────────────────────────────────────────────────────────
export { CostEngine } from './cost-engine/cost-engine.js';
export type {
  TokenUsage,
  UsageSummary,
  UsageScope,
  ProviderUsage,
} from './cost-engine/cost-engine.js';

// ── PluginRegistry ────────────────────────────────────────────────────────────
export { PluginRegistry } from './plugin-registry/plugin-registry.js';
export type {
  PluginRecord,
  RegisterPluginOptions,
} from './plugin-registry/plugin-registry.js';

// ── ModelRouter ───────────────────────────────────────────────────────────────
export { ModelRouter } from './model-router/model-router.js';
export type {
  UnifiedChatRequest,
  UnifiedChatResponse,
  UnifiedUsage,
  StreamChunk,
} from './model-router/model-router.js';

// ── AgentRunner ───────────────────────────────────────────────────────────────
export { AgentRunner } from './agent-runner/agent-runner.js';
export type { RunOptions } from './agent-runner/agent-runner.js';
export type { AgentDefinition } from './agent-runner/built-in-agents.js';

// ── FileSystem ────────────────────────────────────────────────────────────────
export { FileSystemManager } from './file-system/file-system.js';
export type { FileEntry } from './file-system/file-system.js';
