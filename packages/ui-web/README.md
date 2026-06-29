# @garagebuild/ui-web

React SPA for the GarageBuild platform. Built with Vite and tested with vitest. Connects to the GarageBuild REST API server and provides a browser-based interface for managing the workspace, projects, and AI model configurations.

## Pages

| Page | Route (in-app nav) | Description |
|------|--------------------|-------------|
| Dashboard | default | Workspace info, connection status, loaded plugins |
| Projects | Projects nav | List, create, and delete projects |
| Models | Models nav | Add, activate, and remove AI model configurations |

## Install & Build

```bash
npm install --workspace=packages/ui-web
npm run build --workspace=packages/ui-web     # Vite production build → dist/
npm test --workspace=packages/ui-web          # vitest, 17 tests
npm run dev --workspace=packages/ui-web       # Vite dev server on :5173
```

The dev server proxies `/api/*` to `http://localhost:3000` (the GarageBuild REST server).

## Server URL

By default the app connects to `http://localhost:3000`. Set a different URL by storing it in `localStorage`:

```javascript
localStorage.setItem('garagebuild.serverUrl', 'http://my-server:3000');
```

## API Client

`src/api/client.ts` is a typed fetch wrapper that can be used independently:

```typescript
import { GarageBuildApiClient } from './src/api/client';

const client = new GarageBuildApiClient('http://localhost:3000');
const workspace = await client.getWorkspace();
const projects = await client.listProjects();
const ok = await client.ping();
```

DELETE endpoints (204 No Content) are handled correctly — the client reads body as text first before attempting JSON parse.
