export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export interface HealthResult {
    status: HealthStatus;
    message?: string;
    latencyMs?: number;
}
export type PluginType = 'model' | 'framework' | 'deployment' | 'agent' | 'enterprise';
export type SandboxTier = 'trusted' | 'lightweight' | 'full';
export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    type: PluginType;
    author: string;
    description: string;
    entry: string;
    configSchema: string;
    capabilities: string[];
    minGarageBuildVersion: string;
    sandboxTier: SandboxTier;
}
export interface ConfigField {
    type: 'string' | 'number' | 'boolean' | 'select';
    title: string;
    description?: string;
    secret?: boolean;
    required?: boolean;
    default?: string | number | boolean;
    options?: string[];
}
export interface ConfigSchema {
    fields: Record<string, ConfigField>;
}
export type PluginConfig = Record<string, string | number | boolean>;
export type MessageRole = 'user' | 'assistant' | 'system';
export interface ChatMessage {
    role: MessageRole;
    content: string;
}
export interface ChatRequest {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}
export interface ChatResponse {
    id: string;
    content: string;
    model: string;
    finishReason: 'stop' | 'length' | 'error';
    inputTokens: number;
    outputTokens: number;
}
export interface ChatChunk {
    id: string;
    delta: string;
    accumulated: string;
    isDone: boolean;
    finishReason?: string;
}
export interface CostEstimate {
    inputTokens: number;
    estimatedOutputTokens: number;
    estimatedCostUsd: number;
    isLocal: boolean;
    confidence: 'exact' | 'estimated';
}
export interface ModelPricing {
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    isLocal: boolean;
}
export type ModelCapability = 'chat' | 'code' | 'vision' | 'embeddings' | 'function_calling' | 'streaming';
export type ModelStatus = 'available' | 'unavailable' | 'unconfigured';
export interface ModelDescriptor {
    id: string;
    provider: string;
    modelName: string;
    displayName: string;
    isLocal: boolean;
    contextWindow: number;
    capabilities: ModelCapability[];
    pricing: ModelPricing;
    status: ModelStatus;
}
export interface ModelInfo {
    descriptor: ModelDescriptor;
    isConfigured: boolean;
    lastChecked?: Date;
}
export interface GeneratedFile {
    path: string;
    content: string;
    action: 'create' | 'modify' | 'delete';
}
export type Framework = 'react' | 'vue' | 'angular' | 'nextjs' | 'svelte';
export interface ProjectOptions {
    name: string;
    framework: Framework;
    typescript: boolean;
    tailwind: boolean;
    outputPath: string;
}
export interface ProjectScaffold {
    files: GeneratedFile[];
    installCommand: string;
    devCommand: string;
}
export interface Project {
    id: string;
    name: string;
    framework: Framework;
    path: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export interface DevServer {
    url: string;
    port: number;
    stop: () => Promise<void>;
}
export interface BuildResult {
    success: boolean;
    outputDir: string;
    errors: string[];
    warnings: string[];
    durationMs: number;
}
export interface ComponentSpec {
    name: string;
    description: string;
    props?: Record<string, string>;
    existingFiles?: string[];
}
export interface PageSpec {
    name: string;
    route: string;
    description: string;
    existingFiles?: string[];
}
export interface DeployConfig {
    target: string;
    environment: 'development' | 'staging' | 'production';
    envVars?: Record<string, string>;
}
export interface DeployResult {
    success: boolean;
    deploymentId: string;
    url?: string;
    errors: string[];
}
export type DeployStatus = 'pending' | 'building' | 'deployed' | 'failed';
export type AgentCapability = 'code_generation' | 'code_review' | 'test_writing' | 'refactoring' | 'documentation';
export type TaskType = 'chat' | 'generate' | 'review' | 'test' | 'refactor' | 'explain';
export interface AgentTask {
    type: TaskType;
    description: string;
    context?: {
        files?: string[];
        projectPath?: string;
    };
}
export interface AgentResult {
    success: boolean;
    output: string;
    files?: GeneratedFile[];
    errors: string[];
}
export interface AgentChunk {
    delta: string;
    accumulated: string;
    isDone: boolean;
}
//# sourceMappingURL=types.d.ts.map