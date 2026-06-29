// garagebuild status — show workspace overview

import { getEngine } from '../engine-factory.js';
import { header, table, info } from '../output.js';

export async function statusCommand(): Promise<void> {
  const { engine, workspace } = await getEngine();

  header('Workspace');
  table([
    ['ID',   workspace.id],
    ['Name', workspace.name],
  ]);

  const activeModel = engine.workspaceManager.getActiveModel() ?? null;

  header('Active model');
  if (activeModel) {
    table([
      ['Provider', activeModel.provider],
      ['Model',    activeModel.modelName],
    ]);
  } else {
    info('No model configured. Run: garagebuild model use <provider> <model>');
  }

  const health = await engine.pluginRegistry.healthCheckAll();
  const pluginIds = Object.keys(health);

  header('Plugins');
  if (pluginIds.length === 0) {
    info('No plugins registered.');
  } else {
    table(
      pluginIds.map(id => [id, health[id]?.status ?? 'unknown'] as [string, string]),
    );
  }
}
