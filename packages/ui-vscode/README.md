# GarageBuild VS Code Extension

VS Code extension for the GarageBuild platform. Connects to a running GarageBuild server, provides commands for project creation and AI agent execution, and shows server connection status in the status bar.

## Features

- **Status bar** — shows GarageBuild server connection state, auto-polls every 30 seconds
- **`GarageBuild: Create Project`** — wizard (name → framework → TypeScript? → output path) that scaffolds a project via the REST API
- **`GarageBuild: Run Agent on File`** — select a task type (generate/review/test/refactor/explain), describe what to do, stream output to a dedicated Output Channel
- **`GarageBuild: Show Connection Status`** — manually refresh the status bar

## Install & Build

```bash
npm install --workspace=packages/ui-vscode
npm run build --workspace=packages/ui-vscode
npm test --workspace=packages/ui-vscode      # 12 tests, no VS Code required
```

**Note:** This package compiles to CommonJS (not ESM) because VS Code's extension host requires CJS. This is the only GarageBuild package that deviates from the ESM-everywhere rule.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `garagebuild.serverUrl` | `http://localhost:3000` | URL of the running GarageBuild server |

## Development

To develop and test the extension locally, open the `packages/ui-vscode` folder in VS Code and press F5 to launch the Extension Development Host.

## API Client

`src/api-client.ts` is a standalone HTTP client (uses `node:http` / `node:https`, no external dependencies) that can be used independently of VS Code:

```typescript
import { GarageBuildApiClient } from './dist/api-client';

const client = new GarageBuildApiClient({ baseUrl: 'http://localhost:3000' });
const workspace = await client.getWorkspace();
const ok = await client.ping();  // → true | false
```
