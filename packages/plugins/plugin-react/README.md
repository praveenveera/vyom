# @garagebuild/plugin-react

GarageBuild framework plugin for React. Implements `FrameworkPlugin` from `@garagebuild/plugin-sdk`. Scaffolds new React projects with Vite, TypeScript, and optional Tailwind CSS, and generates production-ready Dockerfiles.

## Capabilities

- **Project scaffolding** — generates `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- **Tailwind support** — adds `tailwind.config.js`, `postcss.config.js`, and `src/styles.css` when enabled
- **Dockerfile generation** — multi-stage build (Node → nginx), self-contained (no external config files)
- **Component generation** — TypeScript or JavaScript component stubs
- **Page generation** — page stubs with route awareness

## Install & Build

```bash
npm install --workspace=packages/plugins/plugin-react
npm run build --workspace=packages/plugins/plugin-react
npm test --workspace=packages/plugins/plugin-react
```

## Generated Project Structure

```
my-app/
├── package.json        (react, react-dom, vite, typescript)
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .gitignore
├── src/
│   ├── main.tsx
│   └── App.tsx
└── (tailwind files if enabled)
```

## Usage

```typescript
import { ReactPlugin } from '@garagebuild/plugin-react';

const plugin = new ReactPlugin();
await plugin.initialize({});

const scaffold = await plugin.createProject({
  name: 'my-app',
  framework: 'react',
  typescript: true,
  tailwind: true,
  outputPath: '/home/user/my-app',
});

// scaffold.files: GeneratedFile[] — write these to disk
// scaffold.installCommand: 'npm install'
// scaffold.devCommand: 'npm run dev'
```
