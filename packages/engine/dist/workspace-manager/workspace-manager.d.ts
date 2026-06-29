import Database from 'better-sqlite3';
export interface Workspace {
    id: string;
    name: string;
    owner: string;
    createdAt: string;
    updatedAt: string;
    settings: WorkspaceSettings;
}
export interface WorkspaceSettings {
    theme?: 'dark' | 'light';
    defaultModelId?: string;
    telemetryEnabled?: boolean;
}
export interface ModelConfig {
    id: string;
    workspaceId: string;
    provider: string;
    modelName: string;
    displayName: string;
    apiKeyRef?: string;
    baseUrl?: string;
    costPer1kInputTokens: number;
    costPer1kOutputTokens: number;
    isLocal: boolean;
    isActive: boolean;
    contextWindow: number;
    capabilities: string[];
    createdAt: string;
}
export interface AddModelConfigOptions {
    provider: string;
    modelName: string;
    displayName: string;
    apiKeyRef?: string;
    baseUrl?: string;
    costPer1kInputTokens?: number;
    costPer1kOutputTokens?: number;
    isLocal?: boolean;
    contextWindow?: number;
    capabilities?: string[];
}
/**
 * WorkspaceManager — owns the root workspace and all its configuration.
 *
 * Initialise once at startup:
 *   const manager = new WorkspaceManager();
 *   const workspace = await manager.initialize();
 *
 * After that, the workspace is ready and all subsystems can use it.
 */
export declare class WorkspaceManager {
    private db;
    private workspace;
    private initialized;
    /**
     * Initialize the workspace manager.
     * Creates ~/.garagebuild/ and the SQLite database if they don't exist.
     * Creates the default workspace on first run.
     * Emits 'workspace.created' on first run or 'workspace.updated' on subsequent runs.
     */
    initialize(dbPath?: string): Promise<Workspace>;
    /**
     * Returns the current workspace.
     * Throws if initialize() has not been called.
     */
    getWorkspace(): Workspace;
    /**
     * Updates workspace settings.
     * Merges the provided settings with the existing ones.
     */
    updateSettings(settings: Partial<WorkspaceSettings>): Workspace;
    /**
     * Adds a new AI model configuration to the workspace.
     * If this is the first model, it is automatically set as active.
     */
    addModelConfig(options: AddModelConfigOptions): ModelConfig;
    /**
     * Returns all model configurations for this workspace.
     */
    listModelConfigs(): ModelConfig[];
    /**
     * Returns the currently active model configuration.
     * Returns undefined if no models are configured.
     */
    getActiveModel(): ModelConfig | undefined;
    /**
     * Sets a model as the active model.
     * Deactivates all other models in the workspace.
     */
    setActiveModel(modelId: string): ModelConfig;
    /**
     * Removes a model configuration.
     * If the removed model was active and other models exist,
     * the first remaining model becomes active.
     */
    removeModelConfig(modelId: string): void;
    /**
     * Returns a model configuration by ID.
     * Throws if not found in this workspace.
     */
    getModelConfig(modelId: string): ModelConfig;
    /**
     * Returns the underlying database connection.
     * Used by other engine subsystems to share a single connection.
     */
    getDb(): Database.Database;
    /**
     * Closes the database connection.
     * Call this when GarageBuild is shutting down.
     */
    close(): void;
    private assertInitialized;
}
//# sourceMappingURL=workspace-manager.d.ts.map