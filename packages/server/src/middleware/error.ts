// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Error middleware
// ─────────────────────────────────────────────────────────────────────────────

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(
  err: FastifyError,
  _req: FastifyRequest,
  reply: FastifyReply,
): void {
  const status = err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';

  void reply.status(status).send({
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message,
    },
  });
}

// Convenience factory for typed API errors
export function apiError(message: string, statusCode = 400, code = 'BAD_REQUEST'): FastifyError {
  const err = new Error(message) as FastifyError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function notFound(thing: string): FastifyError {
  return apiError(`${thing} not found`, 404, 'NOT_FOUND');
}
