// garagebuild create <name> — scaffold a new project

import type { Command } from 'commander';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getEngine } from '../engine-factory.js';
import { success, info, header, table, fatal } from '../output.js';
import type { Framework } from '@garagebuild/engine';

const FRAMEWORKS = ['react', 'vue', 'angular', 'nextjs', 'svelte'] as const;

export function registerCreateCommand(parent: Command): void {
  parent
    .command('create <name>')
    .description('Create a new GarageBuild project')
    .option('-f, --framework <framework>', 'Framework (react|vue|angular|nextjs|svelte)', 'react')
    .option('--no-typescript', 'Disable TypeScript (default: enabled)')
    .option('--no-tailwind', 'Disable Tailwind CSS (default: enabled)')
    .option('-o, --output <path>', 'Output directory (default: ./<name>)')
    .action(async (name: string, opts: {
      framework: string;
      typescript: boolean;
      tailwind: boolean;
      output?: string;
    }) => {
      const framework = opts.framework as Framework;
      if (!(FRAMEWORKS as readonly string[]).includes(framework)) {
        fatal(`Unknown framework "${framework}". Valid options: ${FRAMEWORKS.join(', ')}`);
      }

      const outputPath = opts.output ?? join(process.cwd(), name);
      const { engine } = await getEngine();

      // Register project in DB
      const project = engine.projectManager.createProject({
        name,
        framework,
        description: `${framework} project created with GarageBuild`,
        path: outputPath,
      });
      const projectId = project.id;

      header('Creating project');
      table([
        ['Name',      name],
        ['Framework', framework],
        ['TypeScript', opts.typescript ? 'yes' : 'no'],
        ['Tailwind',   opts.tailwind   ? 'yes' : 'no'],
        ['Output',     outputPath],
        ['Project ID', projectId],
      ]);

      // Attempt to scaffold via the framework plugin if registered
      const frameworkPlugin = engine.pluginRegistry.getFrameworkPlugin(framework);
      if (frameworkPlugin) {
        info(`Scaffolding with @garagebuild/plugin-${framework}…`);
        const scaffold = await frameworkPlugin.createProject({
          name,
          framework,
          typescript: opts.typescript,
          tailwind: opts.tailwind,
          outputPath,
        });

        await mkdir(outputPath, { recursive: true });
        for (const file of scaffold.files) {
          const dest = join(outputPath, file.path);
          await mkdir(join(dest, '..'), { recursive: true });
          await writeFile(dest, file.content, 'utf8');
        }

        process.stdout.write('\n');
        info(`Install: cd ${name} && ${scaffold.installCommand}`);
        info(`  Start: ${scaffold.devCommand}`);
      } else {
        info(`Plugin @garagebuild/plugin-${framework} not installed — project registered but no files generated.`);
        info(`Run: npm install @garagebuild/plugin-${framework} to enable scaffolding.`);
      }

      success(`Project "${name}" created (id: ${projectId})`);
    });
}
