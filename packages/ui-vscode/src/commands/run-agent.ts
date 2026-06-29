import * as vscode from 'vscode';
import type { GarageBuildApiClient } from '../api-client';

const TASK_TYPES = ['generate', 'review', 'test', 'refactor', 'explain'] as const;
type TaskType = typeof TASK_TYPES[number];

export async function runAgentCommand(client: GarageBuildApiClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    void vscode.window.showWarningMessage('GarageBuild: Open a file first to run an agent.');
    return;
  }

  const taskPick = await vscode.window.showQuickPick(
    TASK_TYPES.map(t => ({ label: t })),
    { title: 'GarageBuild — Agent task type' },
  );
  if (taskPick === undefined) return;

  const description = await vscode.window.showInputBox({
    title: 'GarageBuild — Describe the task',
    prompt: 'What should the agent do?',
    validateInput: (v) => v.trim().length === 0 ? 'Description cannot be empty' : undefined,
  });
  if (description === undefined) return;

  const channel = vscode.window.createOutputChannel('GarageBuild Agent');
  channel.show(true);
  channel.appendLine(`── GarageBuild Agent: ${taskPick.label} ────────────────────────────\n`);

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `GarageBuild: ${taskPick.label}…`, cancellable: false },
      async () => {
        const result = await client.runAgent({
          type: taskPick.label as TaskType,
          description: description.trim(),
          filePath: editor.document.uri.fsPath,
        });
        channel.appendLine(result.output);
        if (result.errors.length > 0) {
          channel.appendLine(`\n── Errors ──────────────────────────────────────────────\n${result.errors.join('\n')}`);
        }
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    channel.appendLine(`\nError: ${msg}`);
    void vscode.window.showErrorMessage(`GarageBuild: Agent failed — ${msg}`);
  }
}
