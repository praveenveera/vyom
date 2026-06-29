#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild CLI — Entry point
// ─────────────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { registerCreateCommand } from './commands/create.js';
import { registerModelCommands } from './commands/model.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerCostCommand } from './commands/cost.js';
import { shutdownEngine } from './engine-factory.js';
import { error } from './output.js';

const program = new Command();

program
  .name('garagebuild')
  .description('GarageBuild — Build Once. Run Anywhere. Use Any AI. Own Everything.')
  .version('0.1.0');

// ── Top-level commands ────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize a GarageBuild workspace (safe to run multiple times)')
  .action(wrapAsync(initCommand));

program
  .command('status')
  .description('Show workspace, active model, and plugin status')
  .action(wrapAsync(statusCommand));

// ── Sub-command groups ────────────────────────────────────────────────────────

registerCreateCommand(program);
registerModelCommands(program);
registerGenerateCommand(program);
registerCostCommand(program);

// ── Parse ─────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}).finally(() => shutdownEngine());

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapAsync(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  };
}
