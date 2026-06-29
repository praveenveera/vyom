// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild plugin-react — Project File Templates
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectOptions } from '@garagebuild/plugin-sdk';

// ── package.json ──────────────────────────────────────────────────────────────

export function packageJson(opts: ProjectOptions): string {
  const deps: Record<string, string> = {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
  };

  const devDeps: Record<string, string> = {
    '@vitejs/plugin-react': '^4.3.1',
    vite: '^5.4.10',
    ...(opts.typescript && {
      typescript: '^5.4.0',
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
    }),
    ...(opts.tailwind && {
      tailwindcss: '^3.4.14',
      autoprefixer: '^10.4.20',
      postcss: '^8.4.47',
    }),
  };

  return JSON.stringify(
    {
      name: opts.name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        ...(opts.typescript && { 'type-check': 'tsc --noEmit' }),
      },
      dependencies: deps,
      devDependencies: devDeps,
    },
    null,
    2,
  );
}

// ── vite.config ───────────────────────────────────────────────────────────────

export function viteConfig(_opts: ProjectOptions): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: { outDir: 'dist' },
});
`;
}

// ── tsconfig.json ─────────────────────────────────────────────────────────────

export const tsconfigJson = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      isolatedModules: true,
      moduleDetection: 'force',
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ['src'],
  },
  null,
  2,
);

// ── index.html ────────────────────────────────────────────────────────────────

export function indexHtml(opts: ProjectOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${opts.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${opts.typescript ? 'tsx' : 'jsx'}"></script>
  </body>
</html>
`;
}

// ── src/main.tsx ──────────────────────────────────────────────────────────────

export function mainTsx(opts: ProjectOptions): string {
  return `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
${opts.tailwind ? "import './index.css';\n" : ''}import App from './App.${opts.typescript ? 'tsx' : 'jsx'}';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
}

// ── src/App.tsx ───────────────────────────────────────────────────────────────

export function appTsx(opts: ProjectOptions): string {
  const cssProp = opts.tailwind
    ? `className="flex min-h-screen flex-col items-center justify-center bg-gray-50"`
    : `style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}`;

  return `${opts.typescript ? "import { useState } from 'react';\n" : "import { useState } from 'react';\n"}
function App() {
  const [count, setCount] = useState(0);

  return (
    <div ${cssProp}>
      <h1${opts.tailwind ? ' className="text-4xl font-bold mb-8"' : ''}>${opts.name}</h1>
      <button
        ${opts.tailwind ? 'className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"' : ''}
        onClick={() => setCount(c => c + 1)}
      >
        count is {count}
      </button>
    </div>
  );
}

export default App;
`;
}

// ── src/index.css (Tailwind) ──────────────────────────────────────────────────

export const tailwindCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

// ── tailwind.config.js ────────────────────────────────────────────────────────

export const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`;

// ── postcss.config.js ─────────────────────────────────────────────────────────

export const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

// ── .gitignore ────────────────────────────────────────────────────────────────

export const gitignore = `# Dependencies
node_modules

# Build output
dist

# Env files
.env
.env.local
.env.*.local

# Editor
.vscode
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store
Thumbs.db
`;

// ── Dockerfile (Nginx multi-stage, self-contained) ────────────────────────────

export function dockerfile(_opts: ProjectOptions): string {
  return `# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve
FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\\n  listen 80;\\n  root /usr/share/nginx/html;\\n  index index.html;\\n  location / { try_files $uri $uri/ /index.html; }\\n  gzip on;\\n}\\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

// ── Component template ────────────────────────────────────────────────────────

export function componentTemplate(
  name: string,
  props: Record<string, string> = {},
  typescript: boolean,
): string {
  const propsType = Object.entries(props)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  const propsInterface =
    typescript && Object.keys(props).length > 0
      ? `\ninterface ${name}Props {\n${propsType}\n}\n`
      : '';

  const propsParam =
    typescript && Object.keys(props).length > 0
      ? `{ ${Object.keys(props).join(', ')} }: ${name}Props`
      : Object.keys(props).length > 0
        ? `{ ${Object.keys(props).join(', ')} }`
        : '';

  return `import type { FC } from 'react';
${propsInterface}
const ${name}${typescript ? `: FC${Object.keys(props).length > 0 ? `<${name}Props>` : ''}` : ''} = (${propsParam}) => {
  return (
    <div>
      <h2>${name}</h2>
    </div>
  );
};

export default ${name};
`;
}

// ── Page template ─────────────────────────────────────────────────────────────

export function pageTemplate(name: string, typescript: boolean): string {
  return `${typescript ? "import type { FC } from 'react';\n\n" : ''}const ${name}Page${typescript ? ': FC' : ''} = () => {
  return (
    <main>
      <h1>${name}</h1>
    </main>
  );
};

export default ${name}Page;
`;
}
