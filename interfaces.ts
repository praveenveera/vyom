// ─────────────────────────────────────────────────────────────────────────────
// VYOM Plugin SDK — Plugin Interfaces
// ─────────────────────────────────────────────────────────────────────────────

import type {
  HealthResult,
  PluginManifest,
  ConfigSchema,
  PluginConfig,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  CostEstimate,
  ModelInfo,
  ModelDescriptor,
  ProjectOptions,
  ProjectScaffold,
  Project,
  ValidationResult,
  GeneratedFile,
  ComponentSpec,
  PageSpec,
  DevServer,
  BuildResult,
  DeployConfig,
  DeployResult,
  DeployStatus,
  AgentTask,
  AgentResult,
  AgentChunk,
  AgentCapability,
  TaskType,
} from './types.js';

// ── Base Plugin ───────────────────────────────────────────────────────────────
//
// Every plugin regardless of type must implement this contract.
// The lifecycle methods are called by the PluginRegistry.

export interface VyomPlugin {
  /**
   * Called once when the plugin is loaded. Use this to establish connections,
   * validate configuration and prepare internal state.
   */
  initialize(config: PluginConfig): Promise<void>;

  /**
   * Called when the plugin is unloaded or VYOM is shutting down.
   * Clean up connections, timers and any other resources.
   */
  teardown(): Promise<void>;

  /**
   * Called periodically and on demand to verify the plugin is functioning.
   * Return 'unhealthy' if the plugin cannot perform its core function.
   */
  healthCheck(): Promise<HealthResult>;

  /**
   * Returns the plugin's manifest — the static metadata declared in
   * vyom-plugin.json. Must return the same value every call.
   */
  getManifest(): PluginManifest;

  /**
   * Returns the JSON schema describing the configuration fields this plugin
   * requires. VYOM uses this to auto-generate the settings UI.
   */
  getConfigSchema(): ConfigSchema;
}

// ── Model Plugin ─────────────────────────────────────────────────────────────
//
// Connects VYOM to an AI provider. The engine only ever calls these methods
// through the Model Abstraction Layer — never directly.
//
// Golden Rule: countTokens and estimateCost MUST be implemented.
// These methods are how cost transparency works regardless of provider.
// Local models must return 0.00 for cost but still count tokens.

export interface ModelPlugin extends VyomPlugin {
  /**
   * Send a chat request and return the complete response.
   * The plugin is responsible for translating to/from the provider's format.
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Send a chat request and stream the response chunk by chunk.
   * Every chunk must conform to ChatChunk regardless of provider stream format.
   */
  stream(request: ChatRequest): AsyncGenerator<ChatChunk>;

  /**
   * Count the number of tokens in the given text for this model.
   * Used to show live token counts before the user sends a message.
   */
  countTokens(text: string): Promise<number>;

  /**
   * Estimate the cost of a request given token counts.
   * Local models must return isLocal: true and estimatedCostUsd: 0.
   */
  estimateCost(inputTokens: number, estimatedOutputTokens: number): CostEstimate;

  /**
   * Return current metadata about the configured model including
   * capabilities, context window and pricing.
   */
  getModelInfo(): ModelInfo;

  /**
   * List all models available through this provider with the current config.
   * For local providers like Ollama, this reflects what is locally installed.
   */
  listAvailableModels(): Promise<ModelDescriptor[]>;
}

// ── Framework Plugin ──────────────────────────────────────────────────────────
//
// Adds support for a frontend framework. Handles project scaffolding,
// code generation, the dev server and build output.

export interface FrameworkPlugin extends VyomPlugin {
  /**
   * Scaffold a new project. Creates all necessary files and returns
   * the list of generated files plus install/dev commands.
   */
  createProject(options: ProjectOptions): Promise<ProjectScaffold>;

  /**
   * Validate an existing project directory. Used when opening a project
   * to verify it matches the expected framework structure.
   */
  validateProject(path: string): Promise<ValidationResult>;

  /**
   * Generate a React/Vue/etc component from a natural language spec.
   * Returns one or more files to be written to the project.
   */
  generateComponent(spec: ComponentSpec): Promise<GeneratedFile[]>;

  /**
   * Generate a full page from a natural language spec.
   * Must be routing-aware — creates the route and any necessary imports.
   */
  generatePage(spec: PageSpec): Promise<GeneratedFile[]>;

  /**
   * Start the framework dev server for the given project.
   * Returns a DevServer handle that can be used to stop it.
   */
  startDevServer(project: Project): Promise<DevServer>;

  /**
   * Stop a running dev server.
   */
  stopDevServer(server: DevServer): Promise<void>;

  /**
   * Build the project for production.
   */
  build(project: Project): Promise<BuildResult>;

  /**
   * Generate a production-ready Dockerfile for this framework.
   * The generated file must produce a working container with no manual edits.
   */
  generateDockerfile(project: Project): Promise<string>;
}

// ── Deployment Plugin ─────────────────────────────────────────────────────────
//
// Handles packaging and deploying projects to a target environment.

export interface DeploymentPlugin extends VyomPlugin {
  /**
   * Deploy the project to the configured target.
   */
  deploy(project: Project, config: DeployConfig): Promise<DeployResult>;

  /**
   * Remove a previously deployed instance.
   */
  undeploy(deploymentId: string): Promise<void>;

  /**
   * Get the current status of a deployment.
   */
  getStatus(deploymentId: string): Promise<DeployStatus>;

  /**
   * Generate a Dockerfile for this deployment target.
   */
  generateDockerfile(project: Project): Promise<string>;

  /**
   * Generate a docker-compose.yml for local container execution.
   */
  generateComposeFile(project: Project): Promise<string>;

  /**
   * Generate any additional deployment manifests (e.g. k8s YAML).
   */
  generateManifests(project: Project): Promise<GeneratedFile[]>;
}

// ── Agent Plugin ──────────────────────────────────────────────────────────────
//
// Adds a specialised AI agent role to VYOM. Agents have a specific
// purpose — code review, test writing, documentation, etc.

export interface AgentPlugin extends VyomPlugin {
  /**
   * Execute an agent task and return the complete result.
   */
  execute(task: AgentTask): Promise<AgentResult>;

  /**
   * Execute an agent task and stream the output.
   */
  stream(task: AgentTask): AsyncGenerator<AgentChunk>;

  /**
   * Return the list of capabilities this agent supports.
   */
  getCapabilities(): AgentCapability[];

  /**
   * Return the task types this agent can handle.
   */
  getSupportedTaskTypes(): TaskType[];
}
