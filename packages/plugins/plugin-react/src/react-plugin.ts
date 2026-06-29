// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild plugin-react — FrameworkPlugin implementation
//
// Scaffolds React+Vite+TypeScript projects, generates components/pages,
// manages the Vite dev server, and produces Dockerfiles.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  FrameworkPlugin,
  PluginManifest,
  ConfigSchema,
  PluginConfig,
  HealthResult,
  ProjectOptions,
  ProjectScaffold,
  Project,
  ValidationResult,
  GeneratedFile,
  ComponentSpec,
  PageSpec,
  DevServer,
  BuildResult,
} from '@garagebuild/plugin-sdk';
import {
  packageJson,
  viteConfig,
  tsconfigJson,
  indexHtml,
  mainTsx,
  appTsx,
  tailwindCss,
  tailwindConfig,
  postcssConfig,
  gitignore,
  dockerfile,
  componentTemplate,
  pageTemplate,
} from './templates.js';

const MANIFEST: PluginManifest = {
  id: 'react',
  name: 'React Plugin',
  version: '0.1.0',
  description: 'Scaffold and build React+Vite+TypeScript projects',
  type: 'framework',
  sandboxTier: 'trusted',
  author: 'GarageBuild',
  entry: 'dist/index.js',
  configSchema: 'dist/index.d.ts',
  capabilities: ['scaffold', 'code_generation', 'dev_server', 'build', 'containerize'],
  minGarageBuildVersion: '0.1.0',
};

export class ReactPlugin implements FrameworkPlugin {
  // ── GarageBuildPlugin lifecycle ───────────────────────────────────────────────────

  async initialize(_config: PluginConfig): Promise<void> {}

  async teardown(): Promise<void> {}

  async healthCheck(): Promise<HealthResult> {
    return { status: 'healthy' };
  }

  getManifest(): PluginManifest {
    return MANIFEST;
  }

  getConfigSchema(): ConfigSchema {
    return { fields: {} };
  }

  // ── FrameworkPlugin ────────────────────────────────────────────────────────

  async createProject(options: ProjectOptions): Promise<ProjectScaffold> {
    const ext = options.typescript ? 'tsx' : 'jsx';
    const files: GeneratedFile[] = [
      { path: 'package.json', content: packageJson(options), action: 'create' },
      { path: `vite.config.${options.typescript ? 'ts' : 'js'}`, content: viteConfig(options), action: 'create' },
      { path: 'index.html', content: indexHtml(options), action: 'create' },
      { path: '.gitignore', content: gitignore, action: 'create' },
      { path: `src/main.${ext}`, content: mainTsx(options), action: 'create' },
      { path: `src/App.${ext}`, content: appTsx(options), action: 'create' },
    ];

    if (options.typescript) {
      files.push({ path: 'tsconfig.json', content: tsconfigJson, action: 'create' });
    }

    if (options.tailwind) {
      files.push(
        { path: 'src/index.css', content: tailwindCss, action: 'create' },
        { path: 'tailwind.config.js', content: tailwindConfig, action: 'create' },
        { path: 'postcss.config.js', content: postcssConfig, action: 'create' },
      );
    }

    return {
      files,
      installCommand: 'npm install',
      devCommand: 'npm run dev',
    };
  }

  async validateProject(path: string): Promise<ValidationResult> {
    try {
      const raw = await readFile(join(path, 'package.json'), 'utf8');
      const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
      const hasReact = 'react' in (pkg.dependencies ?? {});
      return hasReact
        ? { valid: true, errors: [] }
        : { valid: false, errors: ['package.json does not list "react" as a dependency'] };
    } catch {
      return { valid: false, errors: ['Could not read package.json'] };
    }
  }

  async generateComponent(spec: ComponentSpec): Promise<GeneratedFile[]> {
    const content = componentTemplate(spec.name, spec.props ?? {}, true);
    return [
      {
        path: `src/components/${spec.name}.tsx`,
        content,
        action: 'create',
      },
    ];
  }

  async generatePage(spec: PageSpec): Promise<GeneratedFile[]> {
    const content = pageTemplate(spec.name, true);
    return [
      {
        path: `src/pages/${spec.name}Page.tsx`,
        content,
        action: 'create',
      },
    ];
  }

  async startDevServer(project: Project): Promise<DevServer> {
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn('npm', ['run', 'dev'], {
        cwd: project.path,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let resolved = false;

      const onData = (data: Buffer) => {
        const line = data.toString();
        const match = /localhost:(\d+)/.exec(line);
        if (match && !resolved) {
          resolved = true;
          const port = parseInt(match[1], 10);
          resolve({
            url: `http://localhost:${port}`,
            port,
            stop: async () => { proc.kill('SIGTERM'); },
          });
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);

      proc.on('error', (err) => {
        if (!resolved) reject(err);
      });

      // Fallback: resolve with default port after 10 s if no URL seen yet
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            url: 'http://localhost:3000',
            port: 3000,
            stop: async () => { proc.kill('SIGTERM'); },
          });
        }
      }, 10_000);
    });
  }

  async stopDevServer(server: DevServer): Promise<void> {
    await server.stop();
  }

  async build(project: Project): Promise<BuildResult> {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const proc = spawn('npm', ['run', 'build'], {
        cwd: project.path,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line.toLowerCase().includes('warn')) {
          warnings.push(line);
        } else if (line) {
          errors.push(line);
        }
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          outputDir: join(project.path, 'dist'),
          errors,
          warnings,
          durationMs: Date.now() - startedAt,
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          outputDir: join(project.path, 'dist'),
          errors: [err.message],
          warnings,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }

  async generateDockerfile(project: Project): Promise<string> {
    const options: ProjectOptions = {
      name: project.name,
      framework: 'react',
      typescript: true,
      tailwind: false,
      outputPath: project.path,
    };
    return dockerfile(options);
  }
}
