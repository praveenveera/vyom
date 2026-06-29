// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — AgentRunner Tests
// ─────────────────────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { AgentRunner } from './agent-runner.js';
import { eventBus } from '../event-bus/event-bus.js';
import type { ModelRouter, UnifiedChatResponse, StreamChunk } from '../model-router/model-router.js';
import type { AgentTask } from '@garagebuild/plugin-sdk';

// ── Mock ModelRouter ──────────────────────────────────────────────────────────

function makeRouter(
  overrides: Partial<{
    chat: ModelRouter['chat'];
    stream: ModelRouter['stream'];
  }> = {},
): ModelRouter {
  return {
    chat: overrides.chat ?? (async () => ({
      id: 'resp-1',
      content: 'Generated output',
      model: 'claude-haiku-4-5-20251001',
      provider: 'anthropic',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 100, costUsd: 0.001, isLocal: false },
      latencyMs: 300,
      timestamp: new Date().toISOString(),
    } satisfies UnifiedChatResponse)),
    stream: overrides.stream ?? (async function* () {
      const chunks: StreamChunk[] = [
        { id: 'r1', delta: 'Hello', accumulated: 'Hello', isDone: false },
        { id: 'r1', delta: ' world', accumulated: 'Hello world', isDone: true },
      ];
      for (const c of chunks) yield c;
    }),
    estimateCost: async () => ({
      inputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCostUsd: 0,
      isLocal: false,
      confidence: 'estimated' as const,
    }),
  } as unknown as ModelRouter;
}

const GENERATE_TASK: AgentTask = {
  type: 'generate',
  description: 'A counter button component',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentRunner', () => {
  let runner: AgentRunner;

  beforeEach(() => {
    runner = new AgentRunner(makeRouter());
    eventBus.removeAllListeners();
  });

  // ── execute ────────────────────────────────────────────────────────────────

  describe('execute()', () => {
    it('returns a successful AgentResult with the model output', async () => {
      const result = await runner.execute(GENERATE_TASK);
      expect(result.success).toBe(true);
      expect(result.output).toBe('Generated output');
      expect(result.errors).toHaveLength(0);
    });

    it('works for all five built-in task types', async () => {
      const types = ['generate', 'review', 'test', 'refactor', 'explain'] as const;
      for (const type of types) {
        const result = await runner.execute({ type, description: 'some code' });
        expect(result.success).toBe(true);
      }
    });

    it('emits agent.task.started before calling the model', async () => {
      const order: string[] = [];
      eventBus.on('agent.task.started', () => { order.push('started'); });

      const chatFn = jest.fn<ModelRouter['chat']>(async () => {
        order.push('chat');
        return {
          id: 'r',
          content: 'ok',
          model: 'm',
          provider: 'p',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, isLocal: false },
          latencyMs: 0,
          timestamp: '',
        };
      });

      await new AgentRunner(makeRouter({ chat: chatFn })).execute(GENERATE_TASK);
      expect(order).toEqual(['started', 'chat']);
    });

    it('emits agent.task.completed on success', async () => {
      const handler = jest.fn<(p: { agentId: string; sessionId: string; durationMs: number }) => void>();
      eventBus.on('agent.task.completed', handler);

      await runner.execute(GENERATE_TASK, { sessionId: 'sess-1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'generate', sessionId: 'sess-1' }),
      );
    });

    it('returns success: false and emits agent.task.failed when model throws', async () => {
      const failRouter = makeRouter({
        chat: async () => { throw new Error('No model configured'); },
      });
      const handler = jest.fn<(p: { agentId: string; error: string }) => void>();
      eventBus.on('agent.task.failed', handler);

      const result = await new AgentRunner(failRouter).execute(GENERATE_TASK);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch('No model configured');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('throws for an unknown task type', async () => {
      await expect(
        runner.execute({ type: 'generate' as never, description: 'x' }),
      ).resolves.toBeDefined(); // 'generate' is valid

      const badRunner = new AgentRunner(makeRouter());
      await expect(
        badRunner.execute({ type: 'unknown-type' as never, description: 'x' }),
      ).resolves.toMatchObject({ success: false, errors: [expect.stringMatching('agent')] });
    });

    it('passes the task context as part of the user prompt', async () => {
      let capturedMessages: unknown[] = [];
      const capturingRouter = makeRouter({
        chat: async (req) => {
          capturedMessages = req.messages;
          return { id: 'r', content: 'ok', model: 'm', provider: 'p', finishReason: 'stop', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, isLocal: false }, latencyMs: 0, timestamp: '' };
        },
      });

      await new AgentRunner(capturingRouter).execute({
        type: 'generate',
        description: 'A button',
        context: { files: ['src/Button.tsx'], projectPath: '/app' },
      });

      const userMsg = (capturedMessages as { role: string; content: string }[]).find(m => m.role === 'user');
      expect(userMsg?.content).toMatch('src/Button.tsx');
      expect(userMsg?.content).toMatch('/app');
    });

    it('injects the correct system prompt for each task type', async () => {
      const prompts: Record<string, string> = {};
      const capturingRouter = makeRouter({
        chat: async (req) => {
          const sys = (req.messages as { role: string; content: string }[]).find(m => m.role === 'system');
          prompts['last'] = sys?.content ?? '';
          return { id: 'r', content: 'ok', model: 'm', provider: 'p', finishReason: 'stop', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, isLocal: false }, latencyMs: 0, timestamp: '' };
        },
      });
      const r = new AgentRunner(capturingRouter);

      await r.execute({ type: 'generate', description: 'x' });
      expect(prompts['last']).toMatch(/React/);

      await r.execute({ type: 'review', description: 'x' });
      expect(prompts['last']).toMatch(/code review/i);

      await r.execute({ type: 'test', description: 'x' });
      expect(prompts['last']).toMatch(/Jest/);
    });

    it('scrubs conversational padding and extracts JSON payload for tool task types', async () => {
      const JSON_PADDING_OUTPUT = 'Sure, here is the JSON tool output:\n{\n  "action": "create",\n  "params": {}\n}\nHope this helps!';
      const mockRouter = makeRouter({
        chat: async () => ({
          id: 'r',
          content: JSON_PADDING_OUTPUT,
          model: 'm',
          provider: 'p',
          finishReason: 'stop',
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, isLocal: false },
          latencyMs: 0,
          timestamp: '',
        }),
      });
      const r = new AgentRunner(mockRouter);
      const result = await r.execute({ type: 'generate', description: 'x' });
      expect(result.output).toBe('{\n  "action": "create",\n  "params": {}\n}');
    });

    it('scrubs XML tags from conversational padding', async () => {
      const XML_PADDING_OUTPUT = 'The file change details are:\n<write_file path="src/index.ts">console.log("ok")</write_file>\nHave a good day!';
      const mockRouter = makeRouter({
        chat: async () => ({
          id: 'r',
          content: XML_PADDING_OUTPUT,
          model: 'm',
          provider: 'p',
          finishReason: 'stop',
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, isLocal: false },
          latencyMs: 0,
          timestamp: '',
        }),
      });
      const r = new AgentRunner(mockRouter);
      const result = await r.execute({ type: 'generate', description: 'x' });
      expect(result.output).toBe('<write_file path="src/index.ts">console.log("ok")</write_file>');
    });

    it('does not scrub conversational task types (chat, review, explain)', async () => {
      const CONVERSATIONAL_OUTPUT = 'Here is the code explanation:\n{\n  "some": "json"\n}';
      const mockRouter = makeRouter({
        chat: async () => ({
          id: 'r',
          content: CONVERSATIONAL_OUTPUT,
          model: 'm',
          provider: 'p',
          finishReason: 'stop',
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, isLocal: false },
          latencyMs: 0,
          timestamp: '',
        }),
      });
      const r = new AgentRunner(mockRouter);
      const result = await r.execute({ type: 'explain', description: 'x' });
      expect(result.output).toBe(CONVERSATIONAL_OUTPUT);
    });
  });

  // ── stream ─────────────────────────────────────────────────────────────────

  describe('stream()', () => {
    it('yields chunks from the model', async () => {
      const chunks = [];
      for await (const chunk of runner.stream(GENERATE_TASK)) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.delta).toBe('Hello');
    });

    it('emits agent.task.started and agent.task.completed', async () => {
      const started = jest.fn<(p: { agentId: string; taskType: string; sessionId: string }) => void>();
      const completed = jest.fn<(p: { agentId: string; sessionId: string; durationMs: number }) => void>();
      eventBus.on('agent.task.started', started);
      eventBus.on('agent.task.completed', completed);

      for await (const _ of runner.stream(GENERATE_TASK)) { /* drain */ }

      expect(started).toHaveBeenCalledTimes(1);
      expect(completed).toHaveBeenCalledTimes(1);
    });

    it('emits agent.task.failed and re-throws when model throws', async () => {
      const failRouter = makeRouter({
        stream: async function* () {
          yield* [];
          throw new Error('stream broken');
        },
      });
      const failed = jest.fn<(p: { agentId: string; sessionId: string; error: string }) => void>();
      eventBus.on('agent.task.failed', failed);

      const gen = new AgentRunner(failRouter).stream(GENERATE_TASK);
      await expect(gen.next()).rejects.toThrow('stream broken');
      expect(failed).toHaveBeenCalledTimes(1);
    });
  });

  // ── listAgents / canHandle ─────────────────────────────────────────────────

  describe('listAgents()', () => {
    it('returns all six built-in agents', () => {
      const agents = runner.listAgents();
      expect(agents).toHaveLength(6);
    });

    it('each agent has id, name, taskTypes, capabilities', () => {
      for (const agent of runner.listAgents()) {
        expect(agent.id).toBeTruthy();
        expect(agent.name).toBeTruthy();
        expect(agent.taskTypes.length).toBeGreaterThan(0);
        expect(agent.capabilities.length).toBeGreaterThan(0);
      }
    });
  });

  describe('canHandle()', () => {
    it('returns true for all built-in task types', () => {
      expect(runner.canHandle('generate')).toBe(true);
      expect(runner.canHandle('review')).toBe(true);
      expect(runner.canHandle('test')).toBe(true);
      expect(runner.canHandle('refactor')).toBe(true);
      expect(runner.canHandle('explain')).toBe(true);
    });
  });
});
