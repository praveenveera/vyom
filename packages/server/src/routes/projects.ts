// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Project routes
//
// GET    /projects          → list all projects
// POST   /projects          → create a project
// GET    /projects/:id      → get a project
// PATCH  /projects/:id      → update name/description
// DELETE /projects/:id      → archive a project
// GET    /projects/:id/cost → project-level usage summary
// GET    /projects/:id/tree → file tree (depth optional)
// GET    /projects/:id/files/*path → read a file
// PUT    /projects/:id/files/*path → write a file
// DELETE /projects/:id/files/*path → delete a file
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import type { GarageBuildEngine } from '@garagebuild/engine';
import type { Framework } from '@garagebuild/engine';
import { notFound } from '../middleware/error.js';

export async function projectRoutes(app: FastifyInstance, engine: GarageBuildEngine): Promise<void> {
  // GET /projects
  app.get('/projects', async (_req, reply) => {
    const projects = engine.projectManager.listProjects();
    return reply.send(projects);
  });

  // POST /projects
  app.post<{
    Body: {
      name: string;
      framework: Framework;
      description?: string;
      path: string;
    };
  }>('/projects', async (req, reply) => {
    const { name, framework, description, path } = req.body;
    if (!name || !framework || !path) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'name, framework, and path are required' },
      });
    }

    const project = engine.projectManager.createProject({
      name,
      framework,
      path,
      ...(description !== undefined && { description }),
    });

    return reply.status(201).send(project);
  });

  // GET /projects/:id
  app.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    try {
      const project = engine.projectManager.getProject(req.params.id);
      return reply.send(project);
    } catch {
      throw notFound(`Project ${req.params.id}`);
    }
  });

  // PATCH /projects/:id
  app.patch<{
    Params: { id: string };
    Body: { name?: string; description?: string };
  }>('/projects/:id', async (req, reply) => {
    try {
      const project = engine.projectManager.updateProject(req.params.id, req.body);
      return reply.send(project);
    } catch {
      throw notFound(`Project ${req.params.id}`);
    }
  });

  // DELETE /projects/:id  (archives)
  app.delete<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    try {
      engine.projectManager.archiveProject(req.params.id);
      return reply.status(204).send();
    } catch {
      throw notFound(`Project ${req.params.id}`);
    }
  });

  // GET /projects/:id/cost
  app.get<{ Params: { id: string } }>('/projects/:id/cost', async (req, reply) => {
    const summary = engine.costEngine.getProjectSummary(req.params.id);
    return reply.send(summary);
  });

  // GET /projects/:id/tree?depth=4
  app.get<{
    Params: { id: string };
    Querystring: { depth?: string };
  }>('/projects/:id/tree', async (req, reply) => {
    const depth = req.query.depth !== undefined ? parseInt(req.query.depth, 10) : 4;
    const tree = await engine.fileSystem.getTree(req.params.id, depth);
    return reply.send(tree);
  });

  // GET /projects/:id/files/*
  app.get<{ Params: { id: string; '*': string } }>(
    '/projects/:id/files/*',
    async (req, reply) => {
      const filePath = req.params['*'];
      try {
        const content = await engine.fileSystem.readFile(req.params.id, filePath);
        return reply.type('text/plain').send(content);
      } catch {
        throw notFound(`File ${filePath}`);
      }
    },
  );

  // PUT /projects/:id/files/*
  app.put<{
    Params: { id: string; '*': string };
    Body: { content: string };
  }>('/projects/:id/files/*', async (req, reply) => {
    const filePath = req.params['*'];
    await engine.fileSystem.writeFile(req.params.id, filePath, req.body.content);
    return reply.status(204).send();
  });

  // DELETE /projects/:id/files/*
  app.delete<{ Params: { id: string; '*': string } }>(
    '/projects/:id/files/*',
    async (req, reply) => {
      const filePath = req.params['*'];
      try {
        await engine.fileSystem.deleteFile(req.params.id, filePath);
        return reply.status(204).send();
      } catch {
        throw notFound(`File ${filePath}`);
      }
    },
  );
}
