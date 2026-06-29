# @garagebuild/plugin-sdk

Shared interfaces and types for all GarageBuild plugins. Every plugin package — model, framework, deployment, or agent — imports its interface from here. The SDK has no runtime code; it is types only.

## Interfaces

| Interface | Extends | Purpose |
|-----------|---------|---------|
| `GarageBuildPlugin` | — | Base lifecycle: `initialize`, `teardown`, `healthCheck`, `getManifest`, `getConfigSchema` |
| `ModelPlugin` | `GarageBuildPlugin` | AI provider: `chat`, `stream`, `countTokens`, `estimateCost`, `getModelInfo`, `listAvailableModels` |
| `FrameworkPlugin` | `GarageBuildPlugin` | Frontend framework: `createProject`, `validateProject`, `generateComponent`, `generatePage`, `startDevServer`, `build`, `generateDockerfile` |
| `DeploymentPlugin` | `GarageBuildPlugin` | Container deployment: `deploy`, `undeploy`, `getStatus`, `generateDockerfile`, `generateComposeFile`, `generateManifests` |
| `AgentPlugin` | `GarageBuildPlugin` | AI agent role: `execute`, `stream`, `getCapabilities`, `getSupportedTaskTypes` |

## Key Types

```typescript
// Plugin identity
PluginManifest   // id, name, version, type, author, entry, capabilities, sandboxTier
ConfigSchema     // fields: Record<string, ConfigField>  (never an array)
SandboxTier      // 'trusted' | 'lightweight' | 'full'

// AI types
ChatRequest / ChatResponse / ChatChunk
CostEstimate / ModelPricing / ModelDescriptor

// Project types
Project / ProjectOptions / ProjectScaffold / GeneratedFile
DeployConfig / DeployResult / DeployStatus
```

## Install & Build

```bash
npm install --workspace=packages/plugin-sdk
npm run build --workspace=packages/plugin-sdk
```

## Writing a Plugin

```typescript
import type { ModelPlugin, PluginManifest, ConfigSchema } from '@garagebuild/plugin-sdk';
import type { ChatRequest, ChatResponse, ChatChunk } from '@garagebuild/plugin-sdk';

export class MyPlugin implements ModelPlugin {
  getManifest(): PluginManifest {
    return {
      id: 'my-provider',   // MUST equal the provider name used in model configs
      name: 'My Provider',
      version: '0.1.0',
      type: 'model',
      author: 'me',
      description: '...',
      entry: 'dist/index.js',
      configSchema: 'schema.json',
      capabilities: ['chat', 'streaming'],
      minGarageBuildVersion: '0.1.0',
      sandboxTier: 'trusted',
    };
  }
  // ...implement remaining methods
}
```

The plugin `id` in the manifest **must** match the `provider` field in workspace model configs — this is how `PluginRegistry.getModelPlugin(provider)` and `ModelRouter` find the right plugin.
