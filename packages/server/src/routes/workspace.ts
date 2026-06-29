// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Workspace routes
//
// GET  /workspace            → current workspace + settings
// PATCH /workspace           → update settings (theme, telemetryEnabled)
// GET  /workspace/models     → list model configurations
// POST /workspace/models     → add a model configuration
// GET  /workspace/models/:id → get one model config
// PUT  /workspace/models/:id/activate → set active model
// DELETE /workspace/models/:id → remove a model config
// GET  /workspace/cost       → workspace-level usage summary
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import type { GarageBuildEngine } from '@garagebuild/engine';
import { notFound } from '../middleware/error.js';
import { createPlugin } from '../bootstrap.js';

export async function workspaceRoutes(app: FastifyInstance, engine: GarageBuildEngine): Promise<void> {
  // GET /workspace
  app.get('/workspace', async (_req, reply) => {
    const ws = engine.workspaceManager.getWorkspace();
    return reply.send(ws);
  });

  // PATCH /workspace
  app.patch<{ Body: { settings?: { theme?: 'dark' | 'light'; defaultModelId?: string; telemetryEnabled?: boolean } } }>(
    '/workspace',
    async (req, reply) => {
      if (req.body.settings !== undefined) {
        engine.workspaceManager.updateSettings(req.body.settings);
      }
      const updated = engine.workspaceManager.getWorkspace();
      return reply.send(updated);
    },
  );

  // GET /workspace/models
  app.get('/workspace/models', async (_req, reply) => {
    const configs = engine.workspaceManager.listModelConfigs();
    return reply.send(configs);
  });

  // POST /workspace/models
  app.post<{
    Body: {
      provider: string;
      modelName: string;
      displayName?: string;
      isLocal?: boolean;
      apiKey?: string;
      baseUrl?: string;
    };
  }>('/workspace/models', async (req, reply) => {
    const { provider, modelName, displayName, isLocal, apiKey, baseUrl } = req.body;
    if (!provider || !modelName) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'provider and modelName are required' } });
    }

    const config = engine.workspaceManager.addModelConfig({
      provider,
      modelName,
      displayName: displayName ?? `${provider}/${modelName}`,
      isLocal: isLocal ?? false,
      ...(apiKey  !== undefined && { apiKeyRef: apiKey  }),
      ...(baseUrl !== undefined && { baseUrl }),
    });

    // Configure the in-memory plugin instance with the new credentials
    try {
      const plugin = engine.pluginRegistry.getPlugin(provider);
      await plugin.initialize({
        ...(apiKey  !== undefined && { apiKey  }),
        ...(baseUrl !== undefined && { baseUrl }),
      });
    } catch {
      // Provider not a known built-in — no in-memory plugin to update
      const newPlugin = createPlugin(provider);
      if (newPlugin) {
        await engine.pluginRegistry.register(newPlugin, {
          ...(apiKey  !== undefined && { apiKey  }),
          ...(baseUrl !== undefined && { baseUrl }),
        });
      }
    }

    return reply.status(201).send(config);
  });

  // GET /workspace/models/:id
  app.get<{ Params: { id: string } }>('/workspace/models/:id', async (req, reply) => {
    try {
      const config = engine.workspaceManager.getModelConfig(req.params.id);
      return reply.send(config);
    } catch {
      throw notFound(`Model config ${req.params.id}`);
    }
  });

  // PUT /workspace/models/:id/activate
  app.put<{ Params: { id: string } }>(
    '/workspace/models/:id/activate',
    async (req, reply) => {
      try {
        const config = engine.workspaceManager.setActiveModel(req.params.id);
        return reply.send(config);
      } catch {
        throw notFound(`Model config ${req.params.id}`);
      }
    },
  );

  // DELETE /workspace/models/:id
  app.delete<{ Params: { id: string } }>('/workspace/models/:id', async (req, reply) => {
    engine.workspaceManager.removeModelConfig(req.params.id);
    return reply.status(204).send();
  });

  // GET /workspace/cost
  app.get('/workspace/cost', async (_req, reply) => {
    const ws = engine.workspaceManager.getWorkspace();
    const summary = engine.costEngine.getWorkspaceSummary(ws.id);
    return reply.send(summary);
  });
}
