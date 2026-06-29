// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — GarageBuildEngine
//
// Top-level orchestrator. Creates and wires all subsystems, sharing a
// single database connection, then emits 'app.ready'.
//
// Usage:
//   const engine = new GarageBuildEngine();
//   await engine.initialize();
//
//   engine.projectManager.createProject(...);
//   engine.sessionManager.startSession(...);
//   await engine.modelRouter.chat(...);
// ─────────────────────────────────────────────────────────────────────────────

import { eventBus } from './event-bus/event-bus.js';
import { WorkspaceManager } from './workspace-manager/workspace-manager.js';
import type { Workspace } from './workspace-manager/workspace-manager.js';
import { ProjectManager } from './project-manager/project-manager.js';
import { SessionManager } from './session-manager/session-manager.js';
import { CostEngine } from './cost-engine/cost-engine.js';
import { PluginRegistry } from './plugin-registry/plugin-registry.js';
import { ModelRouter } from './model-router/model-router.js';
import { AgentRunner } from './agent-runner/agent-runner.js';
import { FileSystemManager } from './file-system/file-system.js';

export class GarageBuildEngine {
  readonly workspaceManager: WorkspaceManager;

  // Populated after initialize()
  private _projectManager!: ProjectManager;
  private _sessionManager!: SessionManager;
  private _costEngine!: CostEngine;
  private _pluginRegistry!: PluginRegistry;
  private _modelRouter!: ModelRouter;
  private _agentRunner!: AgentRunner;
  private _fileSystem!: FileSystemManager;

  constructor() {
    this.workspaceManager = new WorkspaceManager();
  }

  async initialize(dbPath?: string): Promise<Workspace> {
    const workspace = await this.workspaceManager.initialize(dbPath);
    const db = this.workspaceManager.getDb();

    this._projectManager = new ProjectManager(db, workspace.id);
    this._sessionManager = new SessionManager(db);
    this._costEngine = new CostEngine(db);
    this._costEngine.attach();
    this._pluginRegistry = new PluginRegistry(db, workspace.id);
    this._modelRouter = new ModelRouter(this._pluginRegistry, this.workspaceManager);
    this._agentRunner = new AgentRunner(this._modelRouter);
    this._fileSystem = new FileSystemManager(db);

    eventBus.emit('app.ready', {});

    return workspace;
  }

  get projectManager(): ProjectManager {
    this.assertReady();
    return this._projectManager;
  }

  get sessionManager(): SessionManager {
    this.assertReady();
    return this._sessionManager;
  }

  get costEngine(): CostEngine {
    this.assertReady();
    return this._costEngine;
  }

  get pluginRegistry(): PluginRegistry {
    this.assertReady();
    return this._pluginRegistry;
  }

  get modelRouter(): ModelRouter {
    this.assertReady();
    return this._modelRouter;
  }

  get agentRunner(): AgentRunner {
    this.assertReady();
    return this._agentRunner;
  }

  get fileSystem(): FileSystemManager {
    this.assertReady();
    return this._fileSystem;
  }

  async shutdown(): Promise<void> {
    this._fileSystem?.close();
    this._costEngine?.detach();
    await this._pluginRegistry?.teardownAll();
    eventBus.emit('app.shutdown', {});
    this.workspaceManager.close();
  }

  private assertReady(): void {
    if (!this._projectManager) {
      throw new Error('GarageBuildEngine not initialized. Call initialize() first.');
    }
  }
}
