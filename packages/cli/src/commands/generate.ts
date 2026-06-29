// garagebuild generate <description> — AI code generation via AgentRunner

import type { Command } from 'commander';
import { getEngine } from '../engine-factory.js';
import { info, success, error, fatal } from '../output.js';
import type { TaskType } from '@garagebuild/plugin-sdk';

const TASK_TYPES: TaskType[] = ['generate', 'review', 'test', 'refactor', 'explain'];

export function registerGenerateCommand(parent: Command): void {
  parent
    .command('generate <description>')
    .alias('gen')
    .description('Run an AI agent task (generate, review, test, refactor, or explain code)')
    .option('-t, --type <type>', `Task type: ${TASK_TYPES.join(' | ')}`, 'generate')
    .option('-s, --session <id>', 'Associate with an existing session ID')
    .option('-m, --model <id>', 'Model configuration ID to use')
    .option('--stream', 'Stream output chunk by chunk')
    .action(async (description: string, opts: {
      type: string;
      session?: string;
      model?: string;
      stream?: boolean;
    }) => {
      const taskType = opts.type as TaskType;
      if (!TASK_TYPES.includes(taskType)) {
        fatal(`Unknown task type "${opts.type}". Valid types: ${TASK_TYPES.join(', ')}`);
      }

      const { engine } = await getEngine();

      if (!engine.agentRunner.canHandle(taskType)) {
        fatal(`No agent available for task type: ${taskType}`);
      }

      const task = {
        type: taskType,
        description,
      };

      const runOpts = {
        ...(opts.session !== undefined && { sessionId: opts.session }),
        ...(opts.model   !== undefined && { modelConfigId: opts.model }),
      };

      info(`Running ${taskType} agent…\n`);

      if (opts.stream) {
        try {
          for await (const chunk of engine.agentRunner.stream(task, runOpts)) {
            if (chunk.delta) process.stdout.write(chunk.delta);
          }
          process.stdout.write('\n');
          success('Done.');
        } catch (err) {
          error(`Stream failed: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      } else {
        const result = await engine.agentRunner.execute(task, runOpts);
        if (result.success) {
          process.stdout.write(result.output + '\n');
          success('Done.');
        } else {
          error(`Agent failed: ${result.errors.join('; ')}`);
          process.exit(1);
        }
      }
    });
}
