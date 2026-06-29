// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Agent routes
//
// GET  /agents              → list all built-in agent definitions
// POST /agent/execute       → run a task and return the full result (blocking)
// POST /agent/stream        → run a task and stream chunks as SSE
//
// SSE format for /agent/stream:
//   event: chunk
//   data: {"delta":"...","accumulated":"...","isDone":false}
//
//   event: done
//   data: {"output":"<full text>","filesWritten":["src/..."]}
//
//   event: error
//   data: {"message":"<error>"}
// ─────────────────────────────────────────────────────────────────────────────

import { normalize } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { GarageBuildEngine } from '@garagebuild/engine';
import type { TaskType } from '@garagebuild/plugin-sdk';

// ── Code block parser ─────────────────────────────────────────────────────────

interface ParsedFile { path: string; content: string }

function parseCodeFiles(text: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  // Matches: ```<lang> <relative/path.ext>\n<content>\n```
  const regex = /```[a-zA-Z]*\s+([\w./\-]+\.\w+)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1]?.trim();
    const content  = match[2] ?? '';
    if (filePath && !filePath.includes('..')) {
      // Normalise slashes and ensure the path stays relative
      const safe = normalize(filePath).replace(/^[/\\]+/, '');
      if (safe) files.push({ path: safe, content });
    }
  }
  return files;
}

// ── Route factory ─────────────────────────────────────────────────────────────

export async function agentRoutes(app: FastifyInstance, engine: GarageBuildEngine): Promise<void> {
  // GET /agents
  app.get('/agents', async (_req, reply) => {
    const agents = engine.agentRunner.listAgents();
    return reply.send(agents);
  });

  // POST /agent/execute
  app.post<{
    Body: {
      type: TaskType;
      description: string;
      sessionId?: string;
      projectId?: string;
      modelConfigId?: string;
      context?: { projectPath?: string; files?: string[] };
    };
  }>('/agent/execute', async (req, reply) => {
    const { type, description, sessionId, modelConfigId, context } = req.body;

    if (!type || !description) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'type and description are required' },
      });
    }

    const result = await engine.agentRunner.execute(
      { type, description, ...(context !== undefined && { context }) },
      {
        ...(sessionId     !== undefined && { sessionId     }),
        ...(modelConfigId !== undefined && { modelConfigId }),
      },
    );

    return reply.send(result);
  });

  // POST /agent/stream  — responds with Server-Sent Events
  app.post<{
    Body: {
      type: TaskType;
      description: string;
      sessionId?: string;
      projectId?: string;
      modelConfigId?: string;
      context?: { projectPath?: string; files?: string[] };
    };
  }>('/agent/stream', async (req, reply) => {
    const { type, description, sessionId, projectId, modelConfigId, context } = req.body;

    if (!type || !description) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: 'type and description are required' },
      });
    }

    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Record user message into the session (if session provided)
    if (sessionId) {
      try {
        engine.sessionManager.addUserMessage(sessionId, description);
      } catch {
        // session may not exist; continue without recording
      }
    }

    const task = { type, description, ...(context !== undefined && { context }) };
    const opts = {
      ...(sessionId     !== undefined && { sessionId     }),
      ...(modelConfigId !== undefined && { modelConfigId }),
    };

    let accumulated = '';

    try {
      for await (const chunk of engine.agentRunner.stream(task, opts)) {
        accumulated = chunk.accumulated;
        raw.write(
          `event: chunk\ndata: ${JSON.stringify({
            delta: chunk.delta,
            accumulated: chunk.accumulated,
            isDone: chunk.isDone,
          })}\n\n`,
        );
      }

      // Record assistant message
      const agentId = type;
      if (sessionId && accumulated) {
        try {
          engine.sessionManager.addAssistantMessage(sessionId, accumulated, agentId);
        } catch {
          // best-effort
        }
      }

      // For generate tasks: parse code blocks and write files to the project
      let filesWritten: string[] = [];
      if (type === 'generate' && projectId && accumulated) {
        const parsed = parseCodeFiles(accumulated);
        for (const { path: filePath, content } of parsed) {
          try {
            await engine.fileSystem.writeFile(projectId, filePath, content);
            filesWritten.push(filePath);
          } catch {
            // skip files we can't write
          }
        }
      }

      raw.write(`event: done\ndata: ${JSON.stringify({ success: true, filesWritten })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      raw.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      raw.end();
    }
  });
}
