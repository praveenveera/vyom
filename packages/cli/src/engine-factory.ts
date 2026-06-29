// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild CLI — Engine bootstrap
//
// Initialises GarageBuildEngine with the default database path and registers plugins
// that are installed (detected by trying to import them). Commands that need
// the engine call getEngine() once — subsequent calls return the same instance.
// ─────────────────────────────────────────────────────────────────────────────

import { GarageBuildEngine } from '@garagebuild/engine';
import type { Workspace } from '@garagebuild/engine';

let _engine: GarageBuildEngine | undefined;
let _workspace: Workspace | undefined;

export async function getEngine(): Promise<{ engine: GarageBuildEngine; workspace: Workspace }> {
  if (_engine && _workspace) return { engine: _engine, workspace: _workspace };

  const engine = new GarageBuildEngine();
  const workspace = await engine.initialize();

  _engine = engine;
  _workspace = workspace;

  return { engine, workspace };
}

export async function shutdownEngine(): Promise<void> {
  if (_engine) {
    await _engine.shutdown();
    _engine = undefined;
    _workspace = undefined;
  }
}
