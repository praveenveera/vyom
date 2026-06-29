// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Plugin routes
//
// GET  /plugins             → list all registered plugins with status
// GET  /plugins/:id/health  → health check a specific plugin
// POST /plugins/health      → health check all plugins
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import type { GarageBuildEngine } from '@garagebuild/engine';
import { notFound } from '../middleware/error.js';

export async function pluginRoutes(app: FastifyInstance, engine: GarageBuildEngine): Promise<void> {
  // GET /plugins
  app.get('/plugins', async (_req, reply) => {
    const plugins = engine.pluginRegistry.listLoaded();
    return reply.send(plugins);
  });

  // GET /plugins/:id/health
  app.get<{ Params: { id: string } }>('/plugins/:id/health', async (req, reply) => {
    try {
      const plugin = engine.pluginRegistry.getPlugin(req.params.id);
      const result = await plugin.healthCheck();
      return reply.send({ pluginId: req.params.id, ...result });
    } catch {
      throw notFound(`Plugin ${req.params.id}`);
    }
  });

  // POST /plugins/health  (health check all)
  app.post('/plugins/health', async (_req, reply) => {
    const results = await engine.pluginRegistry.healthCheckAll();
    return reply.send(results);
  });
}
