// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild VS Code Extension — entry point
// ─────────────────────────────────────────────────────────────────────────────

import * as vscode from 'vscode';
import { GarageBuildApiClient } from './api-client';
import { StatusBarManager } from './status-bar';
import { createProjectCommand } from './commands/create-project';
import { runAgentCommand } from './commands/run-agent';

let healthInterval: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const cfg = vscode.workspace.getConfiguration('garagebuild');
  const serverUrl = cfg.get<string>('serverUrl', 'http://localhost:3000');

  const client = new GarageBuildApiClient({ baseUrl: serverUrl });
  const statusBar = new StatusBarManager(client);

  context.subscriptions.push(
    vscode.commands.registerCommand('garagebuild.createProject', () =>
      createProjectCommand(client)),
    vscode.commands.registerCommand('garagebuild.runAgent', () =>
      runAgentCommand(client)),
    vscode.commands.registerCommand('garagebuild.showStatus', () =>
      statusBar.checkAndUpdate()),
    statusBar,
  );

  void statusBar.checkAndUpdate();
  healthInterval = setInterval(() => { void statusBar.checkAndUpdate(); }, 30_000);
}

export function deactivate(): void {
  if (healthInterval !== undefined) {
    clearInterval(healthInterval);
    healthInterval = undefined;
  }
}
