// garagebuild model list / use / remove

import type { Command } from 'commander';
import { getEngine } from '../engine-factory.js';
import { header, table, success, info, fatal } from '../output.js';

export function registerModelCommands(parent: Command): void {
  const model = parent.command('model').description('Manage AI model configurations');

  model
    .command('list')
    .description('List configured AI models')
    .action(async () => {
      const { engine } = await getEngine();
      const configs = engine.workspaceManager.listModelConfigs();

      header('Model Configurations');
      if (configs.length === 0) {
        info('No models configured. Run: garagebuild model add <provider> <model-name> --api-key <key>');
        return;
      }

      for (const cfg of configs) {
        const activeModel = engine.workspaceManager.getActiveModel();
        const active = activeModel?.id === cfg.id ? ' ← active' : '';
        table([
          ['ID',       cfg.id + active],
          ['Provider', cfg.provider],
          ['Model',    cfg.modelName],
        ]);
        process.stdout.write('\n');
      }
    });

  model
    .command('add <provider> <model-name>')
    .description('Add a model configuration')
    .option('--api-key <key>', 'API key for the provider')
    .option('--base-url <url>', 'Custom API base URL (for proxies/Azure)')
    .option('--display-name <name>', 'Human-friendly name')
    .action(async (provider: string, modelName: string, opts: {
      apiKey?: string;
      baseUrl?: string;
      displayName?: string;
    }) => {
      const { engine } = await getEngine();

      const id = await engine.workspaceManager.addModelConfig({
        provider,
        modelName,
        displayName: opts.displayName ?? `${provider}/${modelName}`,
        isLocal: provider === 'ollama',
        ...(opts.apiKey   !== undefined && { apiKey:   opts.apiKey   }),
        ...(opts.baseUrl  !== undefined && { baseUrl:  opts.baseUrl  }),
      });

      success(`Model added (id: ${id})`);
    });

  model
    .command('use <id>')
    .description('Set the active model configuration')
    .action(async (id: string) => {
      const { engine } = await getEngine();
      await engine.workspaceManager.setActiveModel(id);
      success(`Active model set to: ${id}`);
    });

  model
    .command('remove <id>')
    .description('Remove a model configuration')
    .action(async (id: string) => {
      const { engine } = await getEngine();
      engine.workspaceManager.removeModelConfig(id);
      success(`Model configuration removed: ${id}`);
    });

  model
    .command('health')
    .description('Check health of all registered plugins')
    .action(async () => {
      const { engine } = await getEngine();
      const results = await engine.pluginRegistry.healthCheckAll();
      header('Plugin Health');
      const entries = Object.entries(results);
      if (entries.length === 0) {
        info('No plugins registered.');
        return;
      }
      table(
        entries.map(([id, r]) => [
          id,
          `${r.status}${r.message ? ` — ${r.message}` : ''}`,
        ] as [string, string]),
      );
    });

  // Guard against unknown sub-commands
  model.action(() => {
    model.help();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fatal(msg: string): never {
  return fatal(msg);
}

void _fatal; // suppress unused warning
