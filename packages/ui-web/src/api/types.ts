// API response types matching the GarageBuild REST server

export interface Workspace {
  id: string;
  name: string;
  owner: string;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  theme: 'dark' | 'light';
  telemetryEnabled: boolean;
  defaultModelId?: string;
}

export interface ModelConfig {
  id: string;
  provider: string;
  modelName: string;
  displayName: string;
  isLocal: boolean;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  framework: string;
  path: string;
  createdAt: string;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  type: string;
  status: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface AgentResult {
  success: boolean;
  output: string;
  errors: string[];
}

export interface StreamChunk {
  delta: string;
  accumulated: string;
  isDone: boolean;
}

export interface ProviderUsage {
  tokens: number;
  costUsd: number;
}

export interface UsageSummary {
  scope: 'session' | 'project' | 'workspace';
  scopeId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  localTokens: number;
  cloudTokens: number;
  byProvider: Record<string, ProviderUsage>;
  byModel: Record<string, ProviderUsage>;
}

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelConfigId?: string;
  agentId?: string;
  timestamp: string;
}

export interface SessionWithMessages extends Session {
  messages: SessionMessage[];
}

export interface CreateProjectInput {
  name: string;
  framework: string;
  path: string;
}

export interface AddModelInput {
  provider: string;
  modelName: string;
  displayName?: string;
  isLocal?: boolean;
  apiKey?: string;
  baseUrl?: string;
}
