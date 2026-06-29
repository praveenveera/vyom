// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Fastify app factory
//
// Call createApp(engine) to get a configured Fastify instance.
// The engine must already be initialised (engine.initialize() called).
// ─────────────────────────────────────────────────────────────────────────────

import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { GarageBuildEngine } from '@garagebuild/engine';
import { errorHandler } from './middleware/error.js';
import { workspaceRoutes } from './routes/workspace.js';
import { projectRoutes } from './routes/projects.js';
import { sessionRoutes } from './routes/sessions.js';
import { agentRoutes } from './routes/agent.js';
import { pluginRoutes } from './routes/plugins.js';
import { fileRoutes } from './routes/files.js';

export interface ServerOptions {
  cors?: boolean;
  logger?: boolean;
}

export async function createApp(engine: GarageBuildEngine, opts: ServerOptions = {}) {
  const app = Fastify({ logger: opts.logger ?? false });

  if (opts.cors !== false) {
    await app.register(cors, { origin: true });
  }

  app.setErrorHandler(errorHandler);

  // Health probe — no auth required
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', version: '0.1.0' });
  });

  // Register route groups
  await workspaceRoutes(app, engine);
  await projectRoutes(app, engine);
  await sessionRoutes(app, engine);
  await agentRoutes(app, engine);
  await pluginRoutes(app, engine);
  await fileRoutes(app, engine);

  return app;
}
