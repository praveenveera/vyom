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

export interface AgentResult {
  success: boolean;
  output: string;
  errors: string[];
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
