// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — File routes
//
// GET /projects/:projectId/files          → project file tree (depth 4)
// GET /projects/:projectId/file?path=...  → read a file's text content
// ─────────────────────────────────────────────────────────────────────────────

import { normalize } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { GarageBuildEngine } from '@garagebuild/engine';
import { notFound } from '../middleware/error.js';

export async function fileRoutes(app: FastifyInstance, engine: GarageBuildEngine): Promise<void> {
  // GET /projects/:projectId/files  — full project tree
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/files',
    async (req, reply) => {
      try {
        const tree = await engine.fileSystem.getTree(req.params.projectId);
        return reply.send(tree);
      } catch {
        throw notFound(`Project ${req.params.projectId}`);
      }
    },
  );

  // GET /projects/:projectId/file?path=src/...  — read a single file
  app.get<{
    Params: { projectId: string };
    Querystring: { path?: string };
  }>(
    '/projects/:projectId/file',
    async (req, reply) => {
      const rawPath = req.query.path;
      if (!rawPath) {
        return reply.status(400).send({ error: 'path query parameter required' });
      }

      // Prevent path traversal
      const safePath = normalize(rawPath).replace(/^[/\\]+/, '');
      if (safePath.includes('..')) {
        return reply.status(400).send({ error: 'Invalid file path' });
      }

      try {
        const content = await engine.fileSystem.readFile(req.params.projectId, safePath);
        return reply.header('Content-Type', 'text/plain').send(content);
      } catch {
        throw notFound(`File ${safePath}`);
      }
    },
  );
}
