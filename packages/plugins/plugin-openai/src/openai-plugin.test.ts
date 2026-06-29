// ─────────────────────────────────────────────────────────────────────────────
// @garagebuild/plugin-openai Tests
//
// All tests use an injected mock fetcher — no real API key required.
// ─────────────────────────────────────────────────────────────────────────────

import { OpenAIPlugin } from './openai-plugin.js';
import { getPricing, calculateCost } from './pricing.js';
import type { OpenAIChatResponse, OpenAIModelsResponse } from './types.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      body: null,
    }) as unknown as Response;
}

function sseFetch(lines: string[]): typeof fetch {
  return async () => {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(line + '\n'));
        }
        controller.close();
      },
    });
    return { ok: true, status: 200, body: readable } as unknown as Response;
  };
}

function errorFetch(status: number): typeof fetch {
  return async () =>
    ({
      ok: false,
      status,
      json: async () => ({ error: { message: `HTTP ${status}`, type: 'api_error', code: null } }),
      body: null,
    }) as unknown as Response;
}

function throwingFetch(msg: string): typeof fetch {
  return async () => { throw new Error(msg); };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHAT_RESPONSE: OpenAIChatResponse = {
  id: 'chatcmpl-abc123',
  object: 'chat.completion',
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello, world!' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 25, total_tokens: 35 },
};

const MODELS_RESPONSE: OpenAIModelsResponse = {
  object: 'list',
  data: [
    { id: 'gpt-4o',        object: 'model', created: 1_700_000_000, owned_by: 'openai' },
    { id: 'gpt-4o-mini',   object: 'model', created: 1_700_000_000, owned_by: 'openai' },
    { id: 'gpt-4-turbo',   object: 'model', created: 1_700_000_000, owned_by: 'openai' },
    { id: 'gpt-3.5-turbo', object: 'model', created: 1_700_000_000, owned_by: 'openai' },
    { id: 'text-embedding-ada-002', object: 'model', created: 1_700_000_000, owned_by: 'openai' }, // filtered out
  ],
};

// SSE lines spelling "Hi there"
function sseLines(): string[] {
  return [
    `data: ${JSON.stringify({ id: 'chatcmpl-xyz', object: 'chat.completion.chunk', model: 'gpt-4o-mini', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })}`,
    `data: ${JSON.stringify({ id: 'chatcmpl-xyz', object: 'chat.completion.chunk', model: 'gpt-4o-mini', choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }] })}`,
    `data: ${JSON.stringify({ id: 'chatcmpl-xyz', object: 'chat.completion.chunk', model: 'gpt-4o-mini', choices: [{ index: 0, delta: { content: ' there' }, finish_reason: null }] })}`,
    `data: ${JSON.stringify({ id: 'chatcmpl-xyz', object: 'chat.completion.chunk', model: 'gpt-4o-mini', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}`,
    'data: [DONE]',
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OpenAIPlugin', () => {
  let plugin: OpenAIPlugin;

  beforeEach(async () => {
    plugin = new OpenAIPlugin(jsonFetch(MODELS_RESPONSE));
    await plugin.initialize({ apiKey: 'sk-test-key' });
  });

  // ── getManifest ────────────────────────────────────────────────────────────

  describe('getManifest()', () => {
    it('has id "openai" and type "model"', () => {
      const m = plugin.getManifest();
      expect(m.id).toBe('openai');
      expect(m.type).toBe('model');
    });
  });

  // ── getConfigSchema ────────────────────────────────────────────────────────

  describe('getConfigSchema()', () => {
    it('has apiKey as a required secret field', () => {
      const schema = plugin.getConfigSchema();
      expect(schema.fields['apiKey']?.required).toBe(true);
      expect(schema.fields['apiKey']?.secret).toBe(true);
    });

    it('has model as optional', () => {
      const schema = plugin.getConfigSchema();
      expect(schema.fields['model']?.required).toBeFalsy();
    });

    it('has baseUrl as optional', () => {
      const schema = plugin.getConfigSchema();
      expect(schema.fields['baseUrl']?.required).toBeFalsy();
    });
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  describe('healthCheck()', () => {
    it('returns healthy when API responds', async () => {
      const p = new OpenAIPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const result = await p.healthCheck();
      expect(result.status).toBe('healthy');
    });

    it('returns unhealthy with no apiKey', async () => {
      const p = new OpenAIPlugin(jsonFetch({}));
      await p.initialize({});
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch(/API key/);
    });

    it('returns unhealthy on HTTP error', async () => {
      const p = new OpenAIPlugin(errorFetch(401));
      await p.initialize({ apiKey: 'bad-key' });
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch('401');
    });

    it('returns unhealthy when fetch throws', async () => {
      const p = new OpenAIPlugin(throwingFetch('ECONNREFUSED'));
      await p.initialize({ apiKey: 'sk-test' });
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch('ECONNREFUSED');
    });
  });

  // ── chat ───────────────────────────────────────────────────────────────────

  describe('chat()', () => {
    it('returns content, model, token counts', async () => {
      const p = new OpenAIPlugin(jsonFetch(CHAT_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });

      const res = await p.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4o-mini',
      });

      expect(res.id).toBe('chatcmpl-abc123');
      expect(res.content).toBe('Hello, world!');
      expect(res.finishReason).toBe('stop');
      expect(res.inputTokens).toBe(10);
      expect(res.outputTokens).toBe(25);
    });

    it('maps finish_reason length to finishReason length', async () => {
      const p = new OpenAIPlugin(
        jsonFetch({ ...CHAT_RESPONSE, choices: [{ ...CHAT_RESPONSE.choices[0], finish_reason: 'length' }] }),
      );
      await p.initialize({ apiKey: 'sk-test' });
      const res = await p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' });
      expect(res.finishReason).toBe('length');
    });

    it('throws a readable error on API failure', async () => {
      const p = new OpenAIPlugin(errorFetch(401));
      await p.initialize({ apiKey: 'bad' });
      await expect(
        p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' }),
      ).rejects.toThrow(/OpenAI error/);
    });

    it('passes system messages natively in the messages array', async () => {
      let capturedBody: unknown;
      const captureFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, status: 200, json: async () => CHAT_RESPONSE, body: null } as unknown as Response;
      };

      const p = new OpenAIPlugin(captureFetch);
      await p.initialize({ apiKey: 'sk-test' });

      await p.chat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'gpt-4o-mini',
      });

      const body = capturedBody as { messages: { role: string }[] };
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]?.role).toBe('system');
      expect(body.messages[1]?.role).toBe('user');
    });

    it('uses the custom baseUrl when configured', async () => {
      let capturedUrl = '';
      const captureFetch: typeof fetch = async (url, _init) => {
        capturedUrl = url as string;
        return { ok: true, status: 200, json: async () => CHAT_RESPONSE, body: null } as unknown as Response;
      };

      const p = new OpenAIPlugin(captureFetch);
      await p.initialize({ apiKey: 'sk-test', baseUrl: 'https://my-proxy.example.com/v1' });

      await p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' });
      expect(capturedUrl).toMatch('my-proxy.example.com');
    });

    it('falls back to default model when none specified', async () => {
      let capturedBody: unknown;
      const captureFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, status: 200, json: async () => CHAT_RESPONSE, body: null } as unknown as Response;
      };

      const p = new OpenAIPlugin(captureFetch);
      await p.initialize({ apiKey: 'sk-test' });

      await p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: '' });
      expect((capturedBody as { model: string }).model).toBe('gpt-4o-mini');
    });
  });

  // ── stream ─────────────────────────────────────────────────────────────────

  describe('stream()', () => {
    it('yields text delta chunks', async () => {
      const p = new OpenAIPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' })) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter(c => !c.isDone && c.delta !== '');
      expect(textChunks[0]?.delta).toBe('Hi');
      expect(textChunks[1]?.delta).toBe(' there');
    });

    it('builds accumulated text correctly', async () => {
      const p = new OpenAIPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' })) {
        chunks.push(chunk);
      }

      const finalTextChunk = chunks.filter(c => !c.isDone).at(-1);
      expect(finalTextChunk?.accumulated).toBe('Hi there');
    });

    it('final chunk has isDone: true', async () => {
      const p = new OpenAIPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' })) {
        chunks.push(chunk);
      }

      expect(chunks.at(-1)?.isDone).toBe(true);
    });

    it('all chunks share the same id', async () => {
      const p = new OpenAIPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const ids = new Set<string>();
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' })) {
        ids.add(chunk.id);
      }

      expect(ids.size).toBe(1);
      expect([...ids][0]).toBe('chatcmpl-xyz');
    });

    it('throws on HTTP error', async () => {
      const p = new OpenAIPlugin(errorFetch(500));
      await p.initialize({ apiKey: 'sk-test' });
      const gen = p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' });
      await expect(gen.next()).rejects.toThrow('HTTP 500');
    });

    it('ignores non-data SSE lines and [DONE] sentinel', async () => {
      const lines = [
        ': keep-alive',
        `data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', model: 'gpt-4o-mini', choices: [{ index: 0, delta: { content: 'OK' }, finish_reason: null }] })}`,
        '',
        `data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', model: 'gpt-4o-mini', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}`,
        'data: [DONE]',
      ];

      const p = new OpenAIPlugin(sseFetch(lines));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o-mini' })) {
        chunks.push(chunk);
      }

      expect(chunks.filter(c => !c.isDone)[0]?.delta).toBe('OK');
    });
  });

  // ── countTokens ────────────────────────────────────────────────────────────

  describe('countTokens()', () => {
    it('returns 0 for empty string', async () => {
      expect(await plugin.countTokens('')).toBe(0);
    });

    it('returns positive count for non-empty text', async () => {
      expect(await plugin.countTokens('Hello, world!')).toBeGreaterThan(0);
    });

    it('longer text has higher count', async () => {
      const a = await plugin.countTokens('short');
      const b = await plugin.countTokens('This is a much longer piece of text that has many more tokens.');
      expect(b).toBeGreaterThan(a);
    });
  });

  // ── estimateCost ───────────────────────────────────────────────────────────

  describe('estimateCost()', () => {
    it('returns isLocal: false and non-zero cost for cloud models', () => {
      const est = plugin.estimateCost(1_000_000, 500_000);
      expect(est.isLocal).toBe(false);
      expect(est.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('uses the configured default model for pricing', async () => {
      const mini = new OpenAIPlugin(jsonFetch({}));
      await mini.initialize({ apiKey: 'k', model: 'gpt-4o-mini' });

      const large = new OpenAIPlugin(jsonFetch({}));
      await large.initialize({ apiKey: 'k', model: 'gpt-4o' });

      const miniCost  = mini.estimateCost(100_000, 50_000).estimatedCostUsd;
      const largeCost = large.estimateCost(100_000, 50_000).estimatedCostUsd;

      expect(largeCost).toBeGreaterThan(miniCost);
    });

    it('cost scales linearly with tokens', () => {
      const half = plugin.estimateCost(500_000, 250_000).estimatedCostUsd;
      const full = plugin.estimateCost(1_000_000, 500_000).estimatedCostUsd;
      expect(full).toBeCloseTo(half * 2, 6);
    });
  });

  // ── getModelInfo ───────────────────────────────────────────────────────────

  describe('getModelInfo()', () => {
    it('returns isLocal: false', () => {
      expect(plugin.getModelInfo().descriptor.isLocal).toBe(false);
    });

    it('isConfigured true when apiKey is set', () => {
      expect(plugin.getModelInfo().isConfigured).toBe(true);
    });

    it('isConfigured false when no apiKey', async () => {
      const p = new OpenAIPlugin(jsonFetch({}));
      await p.initialize({});
      expect(p.getModelInfo().isConfigured).toBe(false);
    });

    it('reflects the configured default model', async () => {
      const p = new OpenAIPlugin(jsonFetch({}));
      await p.initialize({ apiKey: 'k', model: 'gpt-4-turbo' });
      expect(p.getModelInfo().descriptor.modelName).toBe('gpt-4-turbo');
    });
  });

  // ── listAvailableModels ────────────────────────────────────────────────────

  describe('listAvailableModels()', () => {
    it('returns only chat-capable models (filters out embeddings)', async () => {
      const p = new OpenAIPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const models = await p.listAvailableModels();
      expect(models.every(m => m.modelName.startsWith('gpt-') || m.modelName.startsWith('o'))).toBe(true);
      expect(models.find(m => m.modelName === 'text-embedding-ada-002')).toBeUndefined();
    });

    it('all returned models have isLocal: false', async () => {
      const p = new OpenAIPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const models = await p.listAvailableModels();
      expect(models.every(m => !m.isLocal)).toBe(true);
    });

    it('applies pricing from the registry for known models', async () => {
      const p = new OpenAIPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const models = await p.listAvailableModels();
      const gpt4o = models.find(m => m.modelName === 'gpt-4o');
      expect(gpt4o?.pricing.inputCostPer1MTokens).toBe(2.50);
    });

    it('throws on HTTP error', async () => {
      const p = new OpenAIPlugin(errorFetch(403));
      await p.initialize({ apiKey: 'bad' });
      await expect(p.listAvailableModels()).rejects.toThrow('HTTP 403');
    });
  });

  // ── teardown ───────────────────────────────────────────────────────────────

  describe('teardown()', () => {
    it('resolves without error', async () => {
      await expect(plugin.teardown()).resolves.toBeUndefined();
    });
  });
});

// ── Pricing unit tests ────────────────────────────────────────────────────────

describe('pricing registry', () => {
  it('exact model id lookup', () => {
    const p = getPricing('gpt-4o');
    expect(p.inputCostPer1MTokens).toBe(2.50);
    expect(p.outputCostPer1MTokens).toBe(10.00);
  });

  it('prefix match for versioned model ids', () => {
    const p = getPricing('gpt-4o-2024-11-20');
    expect(p.inputCostPer1MTokens).toBe(2.50);
  });

  it('gpt-4o-mini is cheaper than gpt-4o', () => {
    const mini  = getPricing('gpt-4o-mini');
    const large = getPricing('gpt-4o');
    expect(mini.inputCostPer1MTokens).toBeLessThan(large.inputCostPer1MTokens);
  });

  it('falls back to defaults for unknown models', () => {
    const p = getPricing('gpt-99-ultra-extreme');
    expect(p.inputCostPer1MTokens).toBeGreaterThan(0);
  });

  it('calculateCost returns 0 for 0 tokens', () => {
    expect(calculateCost(0, 0, 'gpt-4o')).toBe(0);
  });

  it('calculateCost is proportional to token count', () => {
    const base = calculateCost(1_000_000, 0, 'gpt-4o');
    expect(base).toBeCloseTo(2.50);
  });

  it('o1 is more expensive than gpt-4o', () => {
    const o1   = getPricing('o1');
    const gpt4 = getPricing('gpt-4o');
    expect(o1.inputCostPer1MTokens).toBeGreaterThan(gpt4.inputCostPer1MTokens);
  });
});
