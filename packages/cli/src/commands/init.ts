// garagebuild init — initialize a GarageBuild workspace in the current directory

import { getEngine } from '../engine-factory.js';
import { success, table, header } from '../output.js';

export async function initCommand(): Promise<void> {
  const { workspace } = await getEngine();

  header('GarageBuild Workspace');
  table([
    ['ID',         workspace.id],
    ['Name',       workspace.name],
    ['Created at', workspace.createdAt],
  ]);

  success('Workspace ready at ~/.garagebuild/data/garagebuild.db');
}
