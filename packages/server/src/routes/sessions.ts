// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Session routes
//
// GET    /projects/:projectId/sessions       → list sessions for a project
// POST   /projects/:projectId/sessions       → start a new session
// GET    /projects/:projectId/sessions/:id   → get session + messages
// DELETE /projects/:projectId/sessions/:id   → end session
// GET    /projects/:projectId/sessions/:id/context → chat context (last N messages)
// GET    /projects/:projectId/sessions/:id/cost    → session cost summary
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import type { GarageBuildEngine } from '@garagebuild/engine';
import { notFound } from '../middleware/error.js';

export async function sessionRoutes(app: FastifyInstance, engine: GarageBuildEngine): Promise<void> {
  // GET /projects/:projectId/sessions
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/sessions',
    async (req, reply) => {
      const sessions = engine.sessionManager.listSessions(req.params.projectId);
      return reply.send(sessions);
    },
  );

  // POST /projects/:projectId/sessions
  app.post<{
    Params: { projectId: string };
    Body: { title?: string };
  }>('/projects/:projectId/sessions', async (req, reply) => {
    const session = engine.sessionManager.startSession(
      req.params.projectId,
      req.body.title,
    );
    return reply.status(201).send(session);
  });

  // GET /projects/:projectId/sessions/:id
  app.get<{ Params: { projectId: string; id: string } }>(
    '/projects/:projectId/sessions/:id',
    async (req, reply) => {
      try {
        const session = engine.sessionManager.getSession(req.params.id);
        const messages = engine.sessionManager.getMessages(req.params.id);
        return reply.send({ ...session, messages });
      } catch {
        throw notFound(`Session ${req.params.id}`);
      }
    },
  );

  // DELETE /projects/:projectId/sessions/:id  (ends session)
  app.delete<{ Params: { projectId: string; id: string } }>(
    '/projects/:projectId/sessions/:id',
    async (req, reply) => {
      try {
        engine.sessionManager.endSession(req.params.id);
        return reply.status(204).send();
      } catch {
        throw notFound(`Session ${req.params.id}`);
      }
    },
  );

  // GET /projects/:projectId/sessions/:id/context?max=50
  app.get<{
    Params: { projectId: string; id: string };
    Querystring: { max?: string };
  }>('/projects/:projectId/sessions/:id/context', async (req, reply) => {
    const max = req.query.max !== undefined ? parseInt(req.query.max, 10) : 50;
    const context = engine.sessionManager.getContext(req.params.id, max);
    return reply.send(context);
  });

  // GET /projects/:projectId/sessions/:id/cost
  app.get<{ Params: { projectId: string; id: string } }>(
    '/projects/:projectId/sessions/:id/cost',
    async (req, reply) => {
      const summary = engine.costEngine.getSessionSummary(req.params.id);
      return reply.send(summary);
    },
  );
}
