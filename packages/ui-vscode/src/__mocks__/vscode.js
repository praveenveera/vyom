'use strict';

const StatusBarAlignment = { Left: 1, Right: 2 };
const ProgressLocation = { Notification: 15, Window: 10, SourceControl: 1 };

function makeStatusBarItem() {
  return {
    text: '',
    tooltip: '',
    command: undefined,
    show: () => {},
    hide: () => {},
    dispose: () => {},
  };
}

function makeOutputChannel() {
  return {
    appendLine: () => {},
    show: () => {},
    dispose: () => {},
  };
}

function makeDisposable() {
  return { dispose: () => {} };
}

const vscode = {
  StatusBarAlignment,
  ProgressLocation,
  window: {
    showInputBox: () => Promise.resolve(undefined),
    showQuickPick: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    withProgress: (_opts, task) => task({ report: () => {} }, { isCancellationRequested: false }),
    createOutputChannel: () => makeOutputChannel(),
    createStatusBarItem: () => makeStatusBarItem(),
    activeTextEditor: undefined,
  },
  commands: {
    registerCommand: (_id, _handler) => makeDisposable(),
    executeCommand: () => Promise.resolve(),
  },
  workspace: {
    getConfiguration: (_section) => ({
      get: (_key, defaultValue) => defaultValue,
    }),
  },
};

module.exports = vscode;
