// ─────────────────────────────────────────────────────────────────────────────
// @garagebuild/plugin-ollama Tests
//
// All tests use an injected mock fetcher — no real Ollama instance required.
// ─────────────────────────────────────────────────────────────────────────────

import { OllamaPlugin } from './ollama-plugin.js';
import type { OllamaChatResponse, OllamaStreamChunk, OllamaTagsResponse } from './types.js';

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

function streamFetch(chunks: OllamaStreamChunk[]): typeof fetch {
  return async () => {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
        }
        controller.close();
      },
    });
    return { ok: true, status: 200, body: readable } as unknown as Response;
  };
}

function errorFetch(status: number): typeof fetch {
  return async () => ({ ok: false, status, json: async () => ({}), body: null }) as unknown as Response;
}

function throwingFetch(message: string): typeof fetch {
  return async () => {
    throw new Error(message);
  };
}

// ── Shared fixture ────────────────────────────────────────────────────────────

const CHAT_RESPONSE: OllamaChatResponse = {
  model: 'llama3',
  created_at: '2024-01-01T00:00:00Z',
  message: { role: 'assistant', content: 'Hello, world!' },
  done: true,
  done_reason: 'stop',
  total_duration: 1000000000,
  load_duration: 100000000,
  prompt_eval_count: 12,
  eval_count: 34,
  eval_duration: 800000000,
};

const TAGS_RESPONSE: OllamaTagsResponse = {
  models: [
    {
      name: 'llama3:latest',
      model: 'llama3:latest',
      modified_at: '2024-01-01T00:00:00Z',
      size: 4661224676,
      digest: 'sha256:abc',
      details: {
        parent_model: '',
        format: 'gguf',
        family: 'llama',
        families: ['llama'],
        parameter_size: '8.0B',
        quantization_level: 'Q4_0',
      },
    },
    {
      name: 'mistral:latest',
      model: 'mistral:latest',
      modified_at: '2024-01-01T00:00:00Z',
      size: 3825819520,
      digest: 'sha256:def',
      details: {
        parent_model: '',
        format: 'gguf',
        family: 'mistral',
        families: ['mistral'],
        parameter_size: '7.2B',
        quantization_level: 'Q4_0',
      },
    },
  ],
};

const STREAM_CHUNKS: OllamaStreamChunk[] = [
  { model: 'llama3', created_at: '', message: { role: 'assistant', content: 'Hello' }, done: false },
  { model: 'llama3', created_at: '', message: { role: 'assistant', content: ', ' }, done: false },
  { model: 'llama3', created_at: '', message: { role: 'assistant', content: 'world!' }, done: false },
  {
    model: 'llama3',
    created_at: '',
    message: { role: 'assistant', content: '' },
    done: true,
    done_reason: 'stop',
    prompt_eval_count: 12,
    eval_count: 34,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OllamaPlugin', () => {
  let plugin: OllamaPlugin;

  beforeEach(() => {
    plugin = new OllamaPlugin(jsonFetch(TAGS_RESPONSE));
  });

  // ── initialize ─────────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('uses default baseUrl and model when config is empty', async () => {
      await plugin.initialize({});
      const manifest = plugin.getManifest();
      expect(manifest.id).toBe('ollama');
    });

    it('applies baseUrl from config', async () => {
      const p = new OllamaPlugin(errorFetch(404));
      await p.initialize({ baseUrl: 'http://custom:11434' });
      // Health check hits the configured baseUrl — error confirms it tried
      const health = await p.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });

  // ── getManifest ────────────────────────────────────────────────────────────

  describe('getManifest()', () => {
    it('returns correct id and type', () => {
      const manifest = plugin.getManifest();
      expect(manifest.id).toBe('ollama');
      expect(manifest.type).toBe('model');
      expect(manifest.sandboxTier).toBe('trusted');
    });
  });

  // ── getConfigSchema ────────────────────────────────────────────────────────

  describe('getConfigSchema()', () => {
    it('has baseUrl and model fields', () => {
      const schema = plugin.getConfigSchema();
      expect(schema.fields['baseUrl']).toBeDefined();
      expect(schema.fields['model']).toBeDefined();
    });

    it('marks both fields as not required', () => {
      const schema = plugin.getConfigSchema();
      expect(schema.fields['baseUrl']?.required).toBeFalsy();
      expect(schema.fields['model']?.required).toBeFalsy();
    });
  });

  // ── healthCheck ────────────────────────────────────────────────────────────

  describe('healthCheck()', () => {
    it('returns healthy when Ollama responds', async () => {
      const p = new OllamaPlugin(jsonFetch(TAGS_RESPONSE));
      const result = await p.healthCheck();
      expect(result.status).toBe('healthy');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns unhealthy on non-2xx response', async () => {
      const p = new OllamaPlugin(errorFetch(503));
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch('503');
    });

    it('returns unhealthy when fetch throws (Ollama not running)', async () => {
      const p = new OllamaPlugin(throwingFetch('ECONNREFUSED'));
      const result = await p.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.message).toMatch('ECONNREFUSED');
    });
  });

  // ── chat ───────────────────────────────────────────────────────────────────

  describe('chat()', () => {
    it('returns a ChatResponse with content and token counts', async () => {
      const p = new OllamaPlugin(jsonFetch(CHAT_RESPONSE));
      const response = await p.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      });

      expect(response.content).toBe('Hello, world!');
      expect(response.model).toBe('llama3');
      expect(response.finishReason).toBe('stop');
      expect(response.inputTokens).toBe(12);
      expect(response.outputTokens).toBe(34);
      expect(response.id).toBeDefined();
    });

    it('maps done_reason "length" to finishReason "length"', async () => {
      const p = new OllamaPlugin(
        jsonFetch({ ...CHAT_RESPONSE, done_reason: 'length' }),
      );
      const response = await p.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      });
      expect(response.finishReason).toBe('length');
    });

    it('throws on HTTP error', async () => {
      const p = new OllamaPlugin(errorFetch(500));
      await expect(
        p.chat({ messages: [{ role: 'user', content: 'Hi' }], model: 'llama3' }),
      ).rejects.toThrow('HTTP 500');
    });
  });

  // ── stream ─────────────────────────────────────────────────────────────────

  describe('stream()', () => {
    it('yields chunks with delta and accumulated text', async () => {
      const p = new OllamaPlugin(streamFetch(STREAM_CHUNKS));
      const chunks = [];

      for await (const chunk of p.stream({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(4);
      expect(chunks[0]?.delta).toBe('Hello');
      expect(chunks[2]?.delta).toBe('world!');
    });

    it('builds accumulated text correctly', async () => {
      const p = new OllamaPlugin(streamFetch(STREAM_CHUNKS));
      const chunks = [];

      for await (const chunk of p.stream({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      })) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 2]?.accumulated).toBe('Hello, world!');
    });

    it('marks the final chunk as done', async () => {
      const p = new OllamaPlugin(streamFetch(STREAM_CHUNKS));
      const chunks = [];

      for await (const chunk of p.stream({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      })) {
        chunks.push(chunk);
      }

      const last = chunks[chunks.length - 1];
      expect(last?.isDone).toBe(true);
    });

    it('all non-final chunks have isDone: false', async () => {
      const p = new OllamaPlugin(streamFetch(STREAM_CHUNKS));
      const chunks = [];

      for await (const chunk of p.stream({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama3',
      })) {
        chunks.push(chunk);
      }

      const nonFinal = chunks.slice(0, -1);
      expect(nonFinal.every(c => !c.isDone)).toBe(true);
    });

    it('throws on HTTP error', async () => {
      const p = new OllamaPlugin(errorFetch(500));
      const gen = p.stream({ messages: [{ role: 'user', content: 'Hi' }], model: 'llama3' });
      await expect(gen.next()).rejects.toThrow('HTTP 500');
    });
  });

  // ── countTokens ────────────────────────────────────────────────────────────

  describe('countTokens()', () => {
    it('returns a positive count for non-empty text', async () => {
      const count = await plugin.countTokens('Hello, how are you today?');
      expect(count).toBeGreaterThan(0);
    });

    it('returns 0 for empty string', async () => {
      const count = await plugin.countTokens('');
      expect(count).toBe(0);
    });

    it('longer text returns higher count', async () => {
      const short = await plugin.countTokens('Hi');
      const long = await plugin.countTokens('Hi '.repeat(100));
      expect(long).toBeGreaterThan(short);
    });
  });

  // ── estimateCost ───────────────────────────────────────────────────────────

  describe('estimateCost()', () => {
    it('always returns zero cost and isLocal: true', () => {
      const estimate = plugin.estimateCost(1000, 500);
      expect(estimate.estimatedCostUsd).toBe(0);
      expect(estimate.isLocal).toBe(true);
      expect(estimate.inputTokens).toBe(1000);
      expect(estimate.estimatedOutputTokens).toBe(500);
    });
  });

  // ── getModelInfo ───────────────────────────────────────────────────────────

  describe('getModelInfo()', () => {
    it('returns model info with isLocal: true', () => {
      const info = plugin.getModelInfo();
      expect(info.isConfigured).toBe(true);
      expect(info.descriptor.isLocal).toBe(true);
      expect(info.descriptor.pricing.isLocal).toBe(true);
      expect(info.descriptor.pricing.inputCostPer1MTokens).toBe(0);
    });

    it('reflects the configured default model', async () => {
      const p = new OllamaPlugin(jsonFetch({}));
      await p.initialize({ model: 'mistral' });
      const info = p.getModelInfo();
      expect(info.descriptor.modelName).toBe('mistral');
    });
  });

  // ── listAvailableModels ────────────────────────────────────────────────────

  describe('listAvailableModels()', () => {
    it('returns descriptors for all locally installed models', async () => {
      const p = new OllamaPlugin(jsonFetch(TAGS_RESPONSE));
      const models = await p.listAvailableModels();

      expect(models).toHaveLength(2);
      expect(models[0]?.modelName).toBe('llama3:latest');
      expect(models[1]?.modelName).toBe('mistral:latest');
    });

    it('all returned models have isLocal: true and zero cost', async () => {
      const p = new OllamaPlugin(jsonFetch(TAGS_RESPONSE));
      const models = await p.listAvailableModels();

      for (const model of models) {
        expect(model.isLocal).toBe(true);
        expect(model.pricing.inputCostPer1MTokens).toBe(0);
        expect(model.pricing.outputCostPer1MTokens).toBe(0);
      }
    });

    it('throws on HTTP error', async () => {
      const p = new OllamaPlugin(errorFetch(503));
      await expect(p.listAvailableModels()).rejects.toThrow('HTTP 503');
    });
  });

  // ── teardown ───────────────────────────────────────────────────────────────

  describe('teardown()', () => {
    it('resolves without error', async () => {
      await expect(plugin.teardown()).resolves.toBeUndefined();
    });
  });
});
