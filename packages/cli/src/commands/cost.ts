// garagebuild cost — show usage and cost summary

import type { Command } from 'commander';
import { getEngine } from '../engine-factory.js';
import { header, table, info } from '../output.js';

export function registerCostCommand(parent: Command): void {
  parent
    .command('cost')
    .description('Show AI usage and cost summary for the workspace')
    .option('--project <id>', 'Show costs for a specific project')
    .option('--session <id>', 'Show costs for a specific session')
    .action(async (opts: { project?: string; session?: string }) => {
      const { engine, workspace } = await getEngine();

      let summary;
      if (opts.session) {
        summary = engine.costEngine.getSessionSummary(opts.session);
        header(`Session Usage: ${opts.session}`);
      } else if (opts.project) {
        summary = engine.costEngine.getProjectSummary(opts.project);
        header(`Project Usage: ${opts.project}`);
      } else {
        summary = engine.costEngine.getWorkspaceSummary(workspace.id);
        header(`Workspace Usage: ${workspace.name}`);
      }

      if (!summary || summary.totalTokens === 0) {
        info('No usage recorded yet.');
        return;
      }

      table([
        ['Input tokens',  String(summary.totalInputTokens)],
        ['Output tokens', String(summary.totalOutputTokens)],
        ['Total tokens',  String(summary.totalTokens)],
        ['Total cost',    `$${summary.totalCostUsd.toFixed(4)}`],
      ]);

      if (Object.keys(summary.byProvider).length > 0) {
        header('By Provider');
        for (const [provider, usage] of Object.entries(summary.byProvider)) {
          table([
            [provider, `$${usage.costUsd.toFixed(4)} (${usage.tokens} tokens)`],
          ]);
        }
      }
    });
}
