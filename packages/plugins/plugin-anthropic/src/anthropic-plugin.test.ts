// ─────────────────────────────────────────────────────────────────────────────
// @garagebuild/plugin-anthropic Tests
//
// All tests use an injected mock fetcher — no real API key required.
// ─────────────────────────────────────────────────────────────────────────────

import { AnthropicPlugin } from './anthropic-plugin.js';
import { getPricing, calculateCost } from './pricing.js';
import type { AnthropicCreateResponse, AnthropicModelsResponse } from './types.js';

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
      json: async () => ({ type: 'error', error: { type: 'api_error', message: `HTTP ${status}` } }),
      body: null,
    }) as unknown as Response;
}

function throwingFetch(msg: string): typeof fetch {
  return async () => { throw new Error(msg); };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHAT_RESPONSE: AnthropicCreateResponse = {
  id: 'msg_123',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'Hello, world!' }],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 25 },
};

const MODELS_RESPONSE: AnthropicModelsResponse = {
  data: [
    { type: 'model', id: 'claude-opus-4-8', display_name: 'Claude Opus 4.8', created_at: '2025-01-01T00:00:00Z' },
    { type: 'model', id: 'claude-sonnet-4-6-20250219', display_name: 'Claude Sonnet 4.6', created_at: '2025-01-01T00:00:00Z' },
    { type: 'model', id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', created_at: '2025-01-01T00:00:00Z' },
  ],
  has_more: false,
};

// SSE lines for a streaming response spelling out "Hi there"
function sseLines(): string[] {
  return [
    `data: ${JSON.stringify({ type: 'message_start', message: { id: 'msg_abc', model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 10 } } })}`,
    `data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}`,
    `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } })}`,
    `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' there' } })}`,
    `data: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}`,
    `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } })}`,
    `data: ${JSON.stringify({ type: 'message_stop' })}`,
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnthropicPlugin', () => {
  let plugin: AnthropicPlugin;

  beforeEach(async () => {
    plugin = new AnthropicPlugin(jsonFetch(MODELS_RESPONSE));
    await plugin.initialize({ apiKey: 'sk-test-key' });
  });

  // ── getManifest ────────────────────────────────────────────────────────────

  describe('getManifest()', () => {
    it('has id "anthropic" and type "model"', () => {
      const m = plugin.getManifest();
      expect(m.id).toBe('anthropic');
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
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  describe('healthCheck()', () => {
    it('returns healthy when API responds', async () => {
      const p = new AnthropicPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const result = await p.healthCheck();
      expect(result.status).toBe('healthy');
    });

    it('returns unhealthy with no apiKey', async () => {
      const p = new AnthropicPlugin(jsonFetch({}));
      await p.initialize({});
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch(/API key/);
    });

    it('returns unhealthy on HTTP error', async () => {
      const p = new AnthropicPlugin(errorFetch(401));
      await p.initialize({ apiKey: 'bad-key' });
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch('401');
    });

    it('returns unhealthy when fetch throws', async () => {
      const p = new AnthropicPlugin(throwingFetch('ECONNREFUSED'));
      await p.initialize({ apiKey: 'sk-test' });
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch('ECONNREFUSED');
    });
  });

  // ── chat ───────────────────────────────────────────────────────────────────

  describe('chat()', () => {
    it('returns content, model, token counts', async () => {
      const p = new AnthropicPlugin(jsonFetch(CHAT_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });

      const res = await p.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-haiku-4-5-20251001',
      });

      expect(res.id).toBe('msg_123');
      expect(res.content).toBe('Hello, world!');
      expect(res.finishReason).toBe('stop');
      expect(res.inputTokens).toBe(10);
      expect(res.outputTokens).toBe(25);
    });

    it('maps stop_reason max_tokens to finishReason length', async () => {
      const p = new AnthropicPlugin(
        jsonFetch({ ...CHAT_RESPONSE, stop_reason: 'max_tokens' }),
      );
      await p.initialize({ apiKey: 'sk-test' });
      const res = await p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' });
      expect(res.finishReason).toBe('length');
    });

    it('throws a readable error on API failure', async () => {
      const p = new AnthropicPlugin(errorFetch(401));
      await p.initialize({ apiKey: 'bad' });
      await expect(
        p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' }),
      ).rejects.toThrow(/Anthropic error/);
    });

    it('strips system messages out of the messages array', async () => {
      // The plugin must not forward system messages to the API as a role
      let capturedBody: unknown;
      const captureFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, status: 200, json: async () => CHAT_RESPONSE, body: null } as unknown as Response;
      };

      const p = new AnthropicPlugin(captureFetch);
      await p.initialize({ apiKey: 'sk-test' });

      await p.chat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-haiku-4-5-20251001',
      });

      const body = capturedBody as { system?: string; messages?: unknown[] };
      expect(body.system).toBe('You are a helpful assistant.');
      expect(body.messages).toHaveLength(1);
      expect((body.messages?.[0] as { role: string })?.role).toBe('user');
    });

    it('concatenates multiple system messages', async () => {
      let capturedBody: unknown;
      const captureFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, status: 200, json: async () => CHAT_RESPONSE, body: null } as unknown as Response;
      };

      const p = new AnthropicPlugin(captureFetch);
      await p.initialize({ apiKey: 'sk-test' });

      await p.chat({
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'system', content: 'Respond in English.' },
          { role: 'user', content: 'Hi' },
        ],
        model: 'claude-haiku-4-5-20251001',
      });

      const body = capturedBody as { system?: string };
      expect(body.system).toBe('Be concise.\n\nRespond in English.');
    });

    it('omits system field when no system messages are present', async () => {
      let capturedBody: unknown;
      const captureFetch: typeof fetch = async (_url, init) => {
        capturedBody = JSON.parse((init?.body as string) ?? '{}');
        return { ok: true, status: 200, json: async () => CHAT_RESPONSE, body: null } as unknown as Response;
      };

      const p = new AnthropicPlugin(captureFetch);
      await p.initialize({ apiKey: 'sk-test' });

      await p.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'claude-haiku-4-5-20251001',
      });

      expect((capturedBody as { system?: unknown }).system).toBeUndefined();
    });
  });

  // ── stream ─────────────────────────────────────────────────────────────────

  describe('stream()', () => {
    it('yields text delta chunks', async () => {
      const p = new AnthropicPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' })) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter(c => !c.isDone);
      expect(textChunks[0]?.delta).toBe('Hi');
      expect(textChunks[1]?.delta).toBe(' there');
    });

    it('builds accumulated text correctly', async () => {
      const p = new AnthropicPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' })) {
        chunks.push(chunk);
      }

      const finalTextChunk = chunks.filter(c => !c.isDone).at(-1);
      expect(finalTextChunk?.accumulated).toBe('Hi there');
    });

    it('final chunk has isDone: true', async () => {
      const p = new AnthropicPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' })) {
        chunks.push(chunk);
      }

      expect(chunks.at(-1)?.isDone).toBe(true);
    });

    it('all chunks share the same id from message_start', async () => {
      const p = new AnthropicPlugin(sseFetch(sseLines()));
      await p.initialize({ apiKey: 'sk-test' });

      const ids = new Set<string>();
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' })) {
        ids.add(chunk.id);
      }

      expect(ids.size).toBe(1);
      expect([...ids][0]).toBe('msg_abc');
    });

    it('throws on HTTP error', async () => {
      const p = new AnthropicPlugin(errorFetch(500));
      await p.initialize({ apiKey: 'sk-test' });
      const gen = p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' });
      await expect(gen.next()).rejects.toThrow('HTTP 500');
    });

    it('ignores non-data SSE lines (event:, id:, comments)', async () => {
      const lines = [
        'event: message_start',
        `data: ${JSON.stringify({ type: 'message_start', message: { id: 'msg_x', model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 5 } } })}`,
        '',
        ': keep-alive comment',
        `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } })}`,
        `data: ${JSON.stringify({ type: 'message_stop' })}`,
      ];

      const p = new AnthropicPlugin(sseFetch(lines));
      await p.initialize({ apiKey: 'sk-test' });

      const chunks = [];
      for await (const chunk of p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'claude-haiku-4-5-20251001' })) {
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
      const haiku = new AnthropicPlugin(jsonFetch({}));
      await haiku.initialize({ apiKey: 'k', model: 'claude-haiku-4-5-20251001' });

      const opus = new AnthropicPlugin(jsonFetch({}));
      await opus.initialize({ apiKey: 'k', model: 'claude-opus-4-8' });

      const haikuCost = haiku.estimateCost(100_000, 50_000).estimatedCostUsd;
      const opusCost  = opus.estimateCost(100_000, 50_000).estimatedCostUsd;

      expect(opusCost).toBeGreaterThan(haikuCost);
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
      const p = new AnthropicPlugin(jsonFetch({}));
      await p.initialize({});
      expect(p.getModelInfo().isConfigured).toBe(false);
    });

    it('reflects the configured default model', async () => {
      const p = new AnthropicPlugin(jsonFetch({}));
      await p.initialize({ apiKey: 'k', model: 'claude-opus-4-8' });
      expect(p.getModelInfo().descriptor.modelName).toBe('claude-opus-4-8');
    });
  });

  // ── listAvailableModels ────────────────────────────────────────────────────

  describe('listAvailableModels()', () => {
    it('returns a descriptor for each model from the API', async () => {
      const p = new AnthropicPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const models = await p.listAvailableModels();
      expect(models).toHaveLength(3);
    });

    it('all models have isLocal: false', async () => {
      const p = new AnthropicPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const models = await p.listAvailableModels();
      expect(models.every(m => !m.isLocal)).toBe(true);
    });

    it('applies pricing from the registry', async () => {
      const p = new AnthropicPlugin(jsonFetch(MODELS_RESPONSE));
      await p.initialize({ apiKey: 'sk-test' });
      const models = await p.listAvailableModels();
      const opus = models.find(m => m.modelName === 'claude-opus-4-8');
      expect(opus?.pricing.inputCostPer1MTokens).toBe(15.00);
    });

    it('throws on HTTP error', async () => {
      const p = new AnthropicPlugin(errorFetch(403));
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
    const p = getPricing('claude-opus-4-8');
    expect(p.inputCostPer1MTokens).toBe(15.00);
    expect(p.outputCostPer1MTokens).toBe(75.00);
  });

  it('prefix match for versioned model ids', () => {
    const p = getPricing('claude-sonnet-4-6-20250219');
    expect(p.inputCostPer1MTokens).toBe(3.00);
  });

  it('falls back to defaults for unknown models', () => {
    const p = getPricing('claude-unknown-model-9000');
    expect(p.inputCostPer1MTokens).toBeGreaterThan(0);
  });

  it('calculateCost returns 0 for 0 tokens', () => {
    expect(calculateCost(0, 0, 'claude-sonnet-4-6')).toBe(0);
  });

  it('calculateCost is proportional to token count', () => {
    const base = calculateCost(1_000_000, 0, 'claude-sonnet-4-6');
    expect(base).toBeCloseTo(3.00);
  });
});
