#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — standalone entry point
// ─────────────────────────────────────────────────────────────────────────────

import { GarageBuildEngine } from '@garagebuild/engine';
import { createApp } from './app.js';
import { bootstrapPlugins } from './bootstrap.js';

const PORT = parseInt(process.env['GarageBuild_PORT'] ?? '3000', 10);
const HOST = process.env['GarageBuild_HOST'] ?? '127.0.0.1';

async function main() {
  const engine = new GarageBuildEngine();
  await engine.initialize();
  await bootstrapPlugins(engine);

  const app = await createApp(engine, { logger: true, cors: true });

  const address = await app.listen({ port: PORT, host: HOST });
  console.log(`GarageBuild Server listening at ${address}`);

  const shutdown = async () => {
    await app.close();
    await engine.shutdown();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
