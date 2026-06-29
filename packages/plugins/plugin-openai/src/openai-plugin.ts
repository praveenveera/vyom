// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild — @garagebuild/plugin-openai
//
// Connects GarageBuild to the OpenAI Chat Completions API.
// System messages are passed natively (OpenAI accepts role: 'system').
// Streaming uses SSE with `data: <json>` lines terminated by `data: [DONE]`.
//
// Config fields:
//   apiKey  (string, required) — your OpenAI API key
//   model   (string, optional) — default model, default gpt-4o-mini
//   baseUrl (string, optional) — override for Azure/local proxies
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
} from '@garagebuild/plugin-sdk';

import type {
  OpenAIMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIErrorResponse,
  OpenAIStreamChunk,
  OpenAIModelsResponse,
} from './types.js';

import { getPricing, calculateCost } from './pricing.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

// ── OpenAIPlugin ──────────────────────────────────────────────────────────────

export type Fetcher = typeof fetch;

export class OpenAIPlugin implements ModelPlugin {
  private apiKey = '';
  private defaultModel = DEFAULT_MODEL;
  private apiBase = DEFAULT_API_BASE;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  // ── GarageBuildPlugin ─────────────────────────────────────────────────────────────

  async initialize(config: PluginConfig): Promise<void> {
    if (typeof config['apiKey']  === 'string') this.apiKey       = config['apiKey'];
    if (typeof config['model']   === 'string') this.defaultModel = config['model'];
    if (typeof config['baseUrl'] === 'string') this.apiBase      = config['baseUrl'];
  }

  async teardown(): Promise<void> {}

  async healthCheck(): Promise<HealthResult> {
    if (!this.apiKey) {
      return { status: 'unhealthy', message: 'No API key configured. Set apiKey in plugin config.' };
    }

    const start = Date.now();
    try {
      const res = await this.fetcher(`${this.apiBase}/models`, { headers: this.headers() });
      if (!res.ok) {
        return { status: 'unhealthy', message: `OpenAI returned HTTP ${res.status}` };
      }
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { status: 'unhealthy', message: `Cannot reach OpenAI API: ${String(err)}` };
    }
  }

  getManifest(): PluginManifest {
    return {
      id: 'openai',
      name: '@garagebuild/plugin-openai',
      version: '0.1.0',
      type: 'model',
      author: 'GarageBuild',
      description: 'GPT models via the OpenAI Chat Completions API. Supports streaming and accurate per-token cost tracking.',
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
          title: 'OpenAI API Key',
          description: 'Your OpenAI API key from platform.openai.com',
          secret: true,
          required: true,
        },
        model: {
          type: 'string',
          title: 'Default Model',
          description: 'Default GPT model (e.g. gpt-4o, gpt-4o-mini, gpt-4-turbo)',
          default: DEFAULT_MODEL,
          required: false,
        },
        baseUrl: {
          type: 'string',
          title: 'API Base URL',
          description: 'Override for Azure OpenAI or local proxies. Default: https://api.openai.com/v1',
          required: false,
        },
      },
    };
  }

  // ── ModelPlugin ────────────────────────────────────────────────────────────

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model || this.defaultModel;
    const messages = request.messages.map<OpenAIMessage>(m => ({
      role: m.role as OpenAIMessage['role'],
      content: m.content,
    }));

    const body: OpenAIChatRequest = {
      model,
      messages,
      ...(request.maxTokens   !== undefined && { max_tokens:   request.maxTokens   }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    };

    const res = await this.fetcher(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = (await res.json()) as OpenAIErrorResponse;
      throw new Error(`OpenAI error: ${errBody.error?.message ?? `HTTP ${res.status}`}`);
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    if (!choice) throw new Error('OpenAI returned no choices');

    const finishReason = choice.finish_reason === 'length' ? 'length' : 'stop';

    return {
      id: data.id,
      content: choice.message.content,
      model: data.model,
      finishReason,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  }

  async *stream(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const model = request.model || this.defaultModel;
    const messages = request.messages.map<OpenAIMessage>(m => ({
      role: m.role as OpenAIMessage['role'],
      content: m.content,
    }));

    const body: OpenAIChatRequest = {
      model,
      messages,
      stream: true,
      ...(request.maxTokens   !== undefined && { max_tokens:   request.maxTokens   }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    };

    const res = await this.fetcher(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`OpenAI stream error: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let messageId = '';
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;

        const chunk = JSON.parse(raw) as OpenAIStreamChunk;
        const choice = chunk.choices[0];
        if (!choice) continue;

        if (!messageId) messageId = chunk.id;

        if (choice.delta.content) {
          accumulated += choice.delta.content;
          yield { id: messageId, delta: choice.delta.content, accumulated, isDone: false };
        }

        if (choice.finish_reason !== null) {
          const finishReason = choice.finish_reason === 'length' ? 'length' : 'stop';
          yield { id: messageId, delta: '', accumulated, isDone: true, finishReason };
          return;
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    // GPT models use ~4 chars/token on average for English text
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
        id: `openai/${this.defaultModel}`,
        provider: 'openai',
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
    const res = await this.fetcher(`${this.apiBase}/models`, { headers: this.headers() });

    if (!res.ok) {
      throw new Error(`OpenAI models API returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as OpenAIModelsResponse;

    // Surface only chat-capable GPT models, skipping fine-tuned and embedding models
    const chatModels = data.data.filter(m =>
      m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'),
    );

    return chatModels.map(entry => {
      const pricing = getPricing(entry.id);
      return {
        id: `openai/${entry.id}`,
        provider: 'openai',
        modelName: entry.id,
        displayName: pricing.displayName,
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
      Authorization: `Bearer ${this.apiKey}`,
    };
  }
}
