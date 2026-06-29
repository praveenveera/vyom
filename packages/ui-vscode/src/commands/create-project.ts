import * as vscode from 'vscode';
import type { GarageBuildApiClient } from '../api-client';

const FRAMEWORKS = ['react', 'vue', 'angular', 'nextjs', 'svelte'] as const;
type Framework = typeof FRAMEWORKS[number];

export async function createProjectCommand(client: GarageBuildApiClient): Promise<void> {
  const name = await vscode.window.showInputBox({
    title: 'GarageBuild — New Project',
    prompt: 'Project name',
    validateInput: (v) => v.trim().length === 0 ? 'Name cannot be empty' : undefined,
  });
  if (name === undefined) return;

  const frameworkPick = await vscode.window.showQuickPick(
    FRAMEWORKS.map(f => ({ label: f })),
    { title: 'GarageBuild — Select framework' },
  );
  if (frameworkPick === undefined) return;

  const tsPick = await vscode.window.showQuickPick(
    [{ label: 'Yes' }, { label: 'No' }],
    { title: 'GarageBuild — Use TypeScript?' },
  );
  if (tsPick === undefined) return;

  const outputPath = await vscode.window.showInputBox({
    title: 'GarageBuild — Output directory',
    prompt: 'Absolute path where the project will be created',
    ...(process.env['HOME'] !== undefined && { value: `${process.env['HOME']}/${name.trim()}` }),
  });
  if (outputPath === undefined) return;

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `GarageBuild: Creating ${name.trim()}…`, cancellable: false },
      async () => {
        await client.createProject({
          name: name.trim(),
          framework: frameworkPick.label as Framework,
          typescript: tsPick.label === 'Yes',
          tailwind: false,
          outputPath,
        });
      },
    );
    void vscode.window.showInformationMessage(`Project "${name.trim()}" created.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`GarageBuild: Failed to create project — ${msg}`);
  }
}
