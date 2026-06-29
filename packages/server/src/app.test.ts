// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Integration tests (Fastify inject, no real engine)
// ─────────────────────────────────────────────────────────────────────────────

import { createApp } from './app.js';
import type { GarageBuildEngine } from '@garagebuild/engine';
import type { FastifyInstance } from 'fastify';

// ── Mock engine ───────────────────────────────────────────────────────────────

const WORKSPACE = {
  id: 'ws-1',
  name: 'Test Workspace',
  owner: 'test',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  settings: {},
};

const MODEL_CONFIG = {
  id: 'mc-1',
  workspaceId: 'ws-1',
  provider: 'anthropic',
  modelName: 'claude-haiku-4-5-20251001',
  displayName: 'Claude Haiku',
  isLocal: false,
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
};

const PROJECT = {
  id: 'proj-1',
  workspaceId: 'ws-1',
  name: 'My App',
  description: '',
  framework: 'react' as const,
  path: '/tmp/my-app',
  status: 'active' as const,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const SESSION = {
  id: 'sess-1',
  projectId: 'proj-1',
  name: 'Chat',
  startedAt: '2025-01-01T00:00:00Z',
  endedAt: null as string | null,
  messageCount: 0,
};

function makeEngine(): GarageBuildEngine {
  return {
    workspaceManager: {
      getWorkspace: () => WORKSPACE,
      updateSettings: () => WORKSPACE,
      listModelConfigs: () => [MODEL_CONFIG],
      addModelConfig: () => MODEL_CONFIG,
      getModelConfig: (id: string) => {
        if (id === 'mc-1') return MODEL_CONFIG;
        throw new Error('not found');
      },
      setActiveModel: (id: string) => {
        if (id === 'mc-1') return MODEL_CONFIG;
        throw new Error('not found');
      },
      removeModelConfig: () => undefined,
      getActiveModel: () => MODEL_CONFIG,
    },
    costEngine: {
      getWorkspaceSummary: () => ({
        scope: 'workspace',
        scopeId: 'ws-1',
        totalInputTokens: 100,
        totalOutputTokens: 200,
        totalTokens: 300,
        totalCostUsd: 0.001,
        localTokens: 0,
        cloudTokens: 300,
        byProvider: {},
        byModel: {},
      }),
      getProjectSummary: () => null,
      getSessionSummary: () => null,
    },
    projectManager: {
      listProjects: () => [PROJECT],
      createProject: () => PROJECT,
      getProject: (id: string) => {
        if (id === 'proj-1') return PROJECT;
        throw new Error('not found');
      },
      updateProject: (id: string) => {
        if (id === 'proj-1') return PROJECT;
        throw new Error('not found');
      },
      archiveProject: (id: string) => {
        if (id !== 'proj-1') throw new Error('not found');
        return PROJECT;
      },
    },
    sessionManager: {
      listSessions: () => [SESSION],
      startSession: () => SESSION,
      getSession: (id: string) => {
        if (id === 'sess-1') return SESSION;
        throw new Error('not found');
      },
      endSession: (id: string) => {
        if (id !== 'sess-1') throw new Error('not found');
        return SESSION;
      },
      getMessages: () => [],
      getContext: () => [],
    },
    agentRunner: {
      listAgents: () => [
        {
          id: 'generate',
          name: 'Code Generator',
          description: 'Generates code',
          taskTypes: ['generate'],
          capabilities: ['code_generation'],
          buildSystemPrompt: () => '',
          buildUserPrompt: () => '',
        },
      ],
      execute: async () => ({ success: true, output: 'generated code', errors: [] }),
      stream: async function* () {
        yield { delta: 'hello', accumulated: 'hello', isDone: false };
        yield { delta: '', accumulated: 'hello', isDone: true };
      },
      canHandle: () => true,
    },
    pluginRegistry: {
      listLoaded: () => [],
      getPlugin: (_id: string) => { throw new Error('not found'); },
      register: async () => ({ id: 'openai', name: '@garagebuild/plugin-openai', version: '0.1.0', type: 'model', entryPoint: '', sandboxTier: 'trusted', isActive: true, config: {}, workspaceId: 'ws-1', installedAt: '' }),
      healthCheckAll: async () => ({}),
    },
    fileSystem: {
      getTree: async () => [
        { path: 'src/index.ts', name: 'index.ts', isDirectory: false, sizeBytes: 100, modifiedAt: '2025-01-01T00:00:00Z' },
      ],
      readFile: async (_id: string, path: string) => {
        if (path === 'src/index.ts') return 'export {}';
        throw new Error('not found');
      },
      writeFile: async () => undefined,
      deleteFile: async (_id: string, path: string) => {
        if (path !== 'src/index.ts') throw new Error('not found');
      },
    },
  } as unknown as GarageBuildEngine;
}

// ── Test setup ────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeEach(async () => {
  app = await createApp(makeEngine(), { cors: false });
});

afterEach(async () => {
  await app.close();
});

// ── /health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
  });
});

// ── Workspace ─────────────────────────────────────────────────────────────────

describe('GET /workspace', () => {
  it('returns workspace object', async () => {
    const res = await app.inject({ method: 'GET', url: '/workspace' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: 'ws-1', name: 'Test Workspace' });
  });
});

describe('PATCH /workspace', () => {
  it('returns updated workspace', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/workspace',
      payload: { settings: { theme: 'dark' } },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: 'ws-1' });
  });
});

describe('GET /workspace/models', () => {
  it('returns array of model configs', async () => {
    const res = await app.inject({ method: 'GET', url: '/workspace/models' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe('POST /workspace/models', () => {
  it('creates a model config and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/models',
      payload: { provider: 'openai', modelName: 'gpt-4o-mini' },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ provider: 'anthropic' }); // mock always returns MODEL_CONFIG
  });

  it('returns 400 when provider is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/workspace/models',
      payload: { modelName: 'gpt-4o-mini' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /workspace/models/:id', () => {
  it('returns 200 for existing model', async () => {
    const res = await app.inject({ method: 'GET', url: '/workspace/models/mc-1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: 'mc-1' });
  });

  it('returns 404 for unknown model', async () => {
    const res = await app.inject({ method: 'GET', url: '/workspace/models/unknown' });
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /workspace/models/:id/activate', () => {
  it('activates a model and returns it', async () => {
    const res = await app.inject({ method: 'PUT', url: '/workspace/models/mc-1/activate' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: 'mc-1' });
  });

  it('returns 404 for unknown model', async () => {
    const res = await app.inject({ method: 'PUT', url: '/workspace/models/bad/activate' });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /workspace/models/:id', () => {
  it('returns 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/workspace/models/mc-1' });
    expect(res.statusCode).toBe(204);
  });
});

describe('GET /workspace/cost', () => {
  it('returns usage summary', async () => {
    const res = await app.inject({ method: 'GET', url: '/workspace/cost' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ totalTokens: 300 });
  });
});

// ── Projects ──────────────────────────────────────────────────────────────────

describe('GET /projects', () => {
  it('returns array of projects', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /projects', () => {
  it('creates a project and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { name: 'My App', framework: 'react', path: '/tmp/my-app' },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ name: 'My App' });
  });

  it('returns 400 when path is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { name: 'My App', framework: 'react' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /projects/:id', () => {
  it('returns project for known id', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/proj-1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ id: 'proj-1' });
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/bad' });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /projects/:id', () => {
  it('updates and returns project', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/projects/proj-1',
      payload: { name: 'Renamed' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('DELETE /projects/:id', () => {
  it('returns 204 for known project', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/projects/proj-1' });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for unknown project', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/projects/bad' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /projects/:id/tree', () => {
  it('returns file tree', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/proj-1/tree' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe('GET /projects/:id/files/*', () => {
  it('returns file content as text/plain', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/proj-1/files/src/index.ts' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('export {}');
  });

  it('returns 404 for non-existent file', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/proj-1/files/ghost.ts' });
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /projects/:id/files/*', () => {
  it('writes a file and returns 204', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/projects/proj-1/files/src/new.ts',
      payload: { content: 'export const x = 1;' },
    });
    expect(res.statusCode).toBe(204);
  });
});

describe('DELETE /projects/:id/files/*', () => {
  it('deletes a known file and returns 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/proj-1/files/src/index.ts',
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for unknown file', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/proj-1/files/ghost.ts',
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── Sessions ──────────────────────────────────────────────────────────────────

describe('GET /projects/:projectId/sessions', () => {
  it('returns session list', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/proj-1/sessions' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /projects/:projectId/sessions', () => {
  it('creates a session and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects/proj-1/sessions',
      payload: { title: 'New Chat' },
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({ id: 'sess-1' });
  });
});

describe('GET /projects/:projectId/sessions/:id', () => {
  it('returns session with messages', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/proj-1/sessions/sess-1',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { messages: unknown[] };
    expect(body.messages).toBeDefined();
  });

  it('returns 404 for unknown session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/proj-1/sessions/bad',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /projects/:projectId/sessions/:id', () => {
  it('ends session and returns 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/proj-1/sessions/sess-1',
    });
    expect(res.statusCode).toBe(204);
  });
});

describe('GET /projects/:projectId/sessions/:id/context', () => {
  it('returns chat context array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/proj-1/sessions/sess-1/context',
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});

// ── Agent ─────────────────────────────────────────────────────────────────────

describe('GET /agents', () => {
  it('returns agent list', async () => {
    const res = await app.inject({ method: 'GET', url: '/agents' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe('POST /agent/execute', () => {
  it('returns agent result', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agent/execute',
      payload: { type: 'generate', description: 'A button component' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: true, output: 'generated code' });
  });

  it('returns 400 when type is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agent/execute',
      payload: { description: 'something' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /agent/stream', () => {
  it('returns SSE response with chunk and done events', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agent/stream',
      payload: { type: 'generate', description: 'A button' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('event: chunk');
    expect(res.body).toContain('event: done');
  });

  it('returns 400 when description is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/agent/stream',
      payload: { type: 'generate' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Plugins ───────────────────────────────────────────────────────────────────

describe('GET /plugins', () => {
  it('returns empty array when no plugins registered', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugins' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});

describe('POST /plugins/health', () => {
  it('returns health check results', async () => {
    const res = await app.inject({ method: 'POST', url: '/plugins/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({});
  });
});

describe('GET /plugins/:id/health', () => {
  it('returns 404 for unknown plugin', async () => {
    const res = await app.inject({ method: 'GET', url: '/plugins/unknown/health' });
    expect(res.statusCode).toBe(404);
  });
});
