// Minimal API response types matching the GarageBuild REST server

export interface Workspace {
  id: string;
  name: string;
  owner: string;
}

export interface Project {
  id: string;
  name: string;
  framework: string;
  path: string;
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
  typescript: boolean;
  tailwind: boolean;
  outputPath: string;
}

export interface RunAgentInput {
  type: string;
  description: string;
  filePath?: string;
}
