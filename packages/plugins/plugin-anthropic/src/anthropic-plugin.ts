// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild — @garagebuild/plugin-anthropic
//
// Connects GarageBuild to the Anthropic Messages API.
// Handles system-message extraction (Anthropic requires system as a separate
// field, not inside the messages array), SSE stream parsing, and real
// per-model cost calculation.
//
// Config fields:
//   apiKey  (string, required) — your Anthropic API key
//   model   (string, optional) — default model, default claude-haiku-4-5-20251001
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ModelPlugin,
  PluginManifest,
  ConfigSchema,
  PluginConfig,
  HealthResult,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  CostEstimate,
  ModelInfo,
  ModelDescriptor,
  ChatMessage,
} from '@garagebuild/plugin-sdk';

import type {
  AnthropicMessage,
  AnthropicCreateRequest,
  AnthropicCreateResponse,
  AnthropicErrorResponse,
  AnthropicStreamEvent,
  AnthropicMessageStartEvent,
  AnthropicContentBlockDeltaEvent,
  AnthropicMessageDeltaEvent,
  AnthropicModelsResponse,
} from './types.js';

import { getPricing, calculateCost } from './pricing.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 4096;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Anthropic does not accept `system` as a message role.
 * Extract system messages into a single string, keep only user/assistant.
 */
function splitSystem(messages: ChatMessage[]): {
  messages: AnthropicMessage[];
  system: string | undefined;
} {
  const systemParts: string[] = [];
  const chat: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else {
      chat.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
  }

  return {
    messages: chat,
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
  };
}

function isMessageStart(e: AnthropicStreamEvent): e is AnthropicMessageStartEvent {
  return e.type === 'message_start';
}

function isContentDelta(e: AnthropicStreamEvent): e is AnthropicContentBlockDeltaEvent {
  return e.type === 'content_block_delta';
}

function isMessageDelta(e: AnthropicStreamEvent): e is AnthropicMessageDeltaEvent {
  return e.type === 'message_delta';
}

// ── AnthropicPlugin ───────────────────────────────────────────────────────────

export type Fetcher = typeof fetch;

export class AnthropicPlugin implements ModelPlugin {
  private apiKey = '';
  private defaultModel = DEFAULT_MODEL;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  // ── GarageBuildPlugin ─────────────────────────────────────────────────────────────

  async initialize(config: PluginConfig): Promise<void> {
    if (typeof config['apiKey'] === 'string') this.apiKey = config['apiKey'];
    if (typeof config['model'] === 'string') this.defaultModel = config['model'];
  }

  async teardown(): Promise<void> {}

  async healthCheck(): Promise<HealthResult> {
    if (!this.apiKey) {
      return { status: 'unhealthy', message: 'No API key configured. Set apiKey in plugin config.' };
    }

    const start = Date.now();
    try {
      const res = await this.fetcher(`${API_BASE}/models`, { headers: this.headers() });
      if (!res.ok) {
        return { status: 'unhealthy', message: `Anthropic returned HTTP ${res.status}` };
      }
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', message: `Cannot reach Anthropic API: ${String(err)}` };
    }
  }

  getManifest(): PluginManifest {
    return {
      id: 'anthropic',
      name: '@garagebuild/plugin-anthropic',
      version: '0.1.0',
      type: 'model',
      author: 'GarageBuild',
      description: 'Claude models via the Anthropic API. Supports streaming and accurate per-token cost tracking.',
      entry: './dist/index.js',
      configSchema: './dist/config-schema.json',
      capabilities: ['chat', 'code', 'streaming', 'function_calling'],
      minGarageBuildVersion: '0.1.0',
      sandboxTier: 'trusted',
    };
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: {
        apiKey: {
          type: 'string',
          title: 'Anthropic API Key',
          description: 'Your Anthropic API key from console.anthropic.com',
          secret: true,
          required: true,
        },
        model: {
          type: 'string',
          title: 'Default Model',
          description: 'Default Claude model (e.g. claude-haiku-4-5-20251001, claude-sonnet-4-6-20250219)',
          default: DEFAULT_MODEL,
          required: false,
        },
      },
    };
  }

  // ── ModelPlugin ────────────────────────────────────────────────────────────

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model || this.defaultModel;
    const { messages, system } = splitSystem(request.messages);

    const body: AnthropicCreateRequest = {
      model,
      messages,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(system !== undefined && { system }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    };

    const res = await this.fetcher(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = (await res.json()) as AnthropicErrorResponse;
      throw new Error(`Anthropic error: ${errBody.error?.message ?? `HTTP ${res.status}`}`);
    }

    const data = (await res.json()) as AnthropicCreateResponse;
    const content = data.content.map(b => b.text).join('');

    return {
      id: data.id,
      content,
      model: data.model,
      finishReason: data.stop_reason === 'max_tokens' ? 'length' : 'stop',
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }

  async *stream(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const model = request.model || this.defaultModel;
    const { messages, system } = splitSystem(request.messages);

    const body: AnthropicCreateRequest = {
      model,
      messages,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: true,
      ...(system !== undefined && { system }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    };

    const res = await this.fetcher(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Anthropic stream error: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let messageId = '';
    let lineBuffer = '';
    let stopReason = 'stop';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        // SSE: only data lines carry payload; ignore event/id/comment lines
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;

        const event = JSON.parse(raw) as AnthropicStreamEvent;

        if (isMessageStart(event)) {
          messageId = event.message.id;
        }

        if (isContentDelta(event) && event.delta.type === 'text_delta') {
          accumulated += event.delta.text;
          yield { id: messageId, delta: event.delta.text, accumulated, isDone: false };
        }

        if (isMessageDelta(event)) {
          stopReason = event.delta.stop_reason;
        }

        if (event.type === 'message_stop') {
          yield {
            id: messageId,
            delta: '',
            accumulated,
            isDone: true,
            finishReason: stopReason === 'max_tokens' ? 'length' : 'stop',
          };
          return;
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    // Anthropic has a count_tokens endpoint but it requires a full messages payload.
    // For live pre-send estimates we use the same ~4 chars/token approximation.
    return Math.ceil(text.length / 4);
  }

  estimateCost(inputTokens: number, estimatedOutputTokens: number): CostEstimate {
    return {
      inputTokens,
      estimatedOutputTokens,
      estimatedCostUsd: calculateCost(inputTokens, estimatedOutputTokens, this.defaultModel),
      isLocal: false,
      confidence: 'estimated',
    };
  }

  getModelInfo(): ModelInfo {
    const pricing = getPricing(this.defaultModel);
    return {
      descriptor: {
        id: `anthropic/${this.defaultModel}`,
        provider: 'anthropic',
        modelName: this.defaultModel,
        displayName: pricing.displayName,
        isLocal: false,
        contextWindow: pricing.contextWindow,
        capabilities: ['chat', 'code', 'streaming', 'function_calling'],
        pricing: {
          inputCostPer1MTokens: pricing.inputCostPer1MTokens,
          outputCostPer1MTokens: pricing.outputCostPer1MTokens,
          isLocal: false,
        },
        status: this.apiKey ? 'available' : 'unconfigured',
      },
      isConfigured: !!this.apiKey,
      lastChecked: new Date(),
    };
  }

  async listAvailableModels(): Promise<ModelDescriptor[]> {
    const res = await this.fetcher(`${API_BASE}/models`, { headers: this.headers() });

    if (!res.ok) {
      throw new Error(`Anthropic models API returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as AnthropicModelsResponse;

    return data.data.map(entry => {
      const pricing = getPricing(entry.id);
      return {
        id: `anthropic/${entry.id}`,
        provider: 'anthropic',
        modelName: entry.id,
        displayName: entry.display_name || pricing.displayName,
        isLocal: false,
        contextWindow: pricing.contextWindow,
        capabilities: ['chat', 'code', 'streaming', 'function_calling'] as ModelDescriptor['capabilities'],
        pricing: {
          inputCostPer1MTokens: pricing.inputCostPer1MTokens,
          outputCostPer1MTokens: pricing.outputCostPer1MTokens,
          isLocal: false,
        },
        status: 'available' as const,
      };
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': API_VERSION,
    };
  }
}
