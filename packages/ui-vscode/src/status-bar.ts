import * as vscode from 'vscode';
import type { GarageBuildApiClient } from './api-client';

export class StatusBarManager implements vscode.Disposable {
  private readonly _item: vscode.StatusBarItem;
  private readonly _client: GarageBuildApiClient;

  constructor(client: GarageBuildApiClient) {
    this._client = client;
    this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this._item.text = '$(sync~spin) GarageBuild';
    this._item.tooltip = 'GarageBuild — checking connection…';
    this._item.command = 'garagebuild.showStatus';
    this._item.show();
  }

  async checkAndUpdate(): Promise<void> {
    const connected = await this._client.ping();
    if (connected) {
      this._item.text = '$(circle-filled) GarageBuild';
      this._item.tooltip = 'GarageBuild — connected';
    } else {
      this._item.text = '$(circle-slash) GarageBuild';
      this._item.tooltip = 'GarageBuild — server not reachable';
    }
  }

  dispose(): void {
    this._item.dispose();
  }
}
