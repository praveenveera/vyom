// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild — @garagebuild/plugin-ollama
//
// Connects GarageBuild to a local Ollama instance (https://ollama.com).
// All models running through Ollama are free (isLocal: true, cost: 0).
//
// Config fields (all optional, applied during initialize()):
//   baseUrl  — where Ollama is running, default http://localhost:11434
//   model    — default model name, default llama3
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto';
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
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaStreamChunk,
  OllamaTagsResponse,
} from './types.js';

// ── Context window map for well-known Ollama models ───────────────────────────

const CONTEXT_WINDOWS: Record<string, number> = {
  llama3: 8192,
  'llama3:8b': 8192,
  'llama3:70b': 8192,
  'llama3.1': 131072,
  'llama3.1:8b': 131072,
  'llama3.2': 131072,
  'llama3.2:3b': 131072,
  llama2: 4096,
  mistral: 32768,
  'mistral:7b': 32768,
  mixtral: 32768,
  codellama: 16384,
  deepseek_coder: 16384,
  phi3: 131072,
  'phi3:mini': 131072,
  gemma: 8192,
  gemma2: 8192,
  qwen2: 131072,
};

function contextWindowFor(modelName: string): number {
  const base = modelName.split(':')[0] ?? modelName;
  return CONTEXT_WINDOWS[modelName] ?? CONTEXT_WINDOWS[base] ?? 8192;
}

// ── OllamaPlugin ──────────────────────────────────────────────────────────────

export type Fetcher = typeof fetch;

export class OllamaPlugin implements ModelPlugin {
  private baseUrl = 'http://localhost:11434';
  private defaultModel = 'llama3';

  // Accept an injected fetcher so tests never hit the network
  constructor(private readonly fetcher: Fetcher = fetch) {}

  // ── GarageBuildPlugin ─────────────────────────────────────────────────────────────

  async initialize(config: PluginConfig): Promise<void> {
    if (typeof config['baseUrl'] === 'string') this.baseUrl = config['baseUrl'];
    if (typeof config['model'] === 'string') this.defaultModel = config['model'];
  }

  async teardown(): Promise<void> {
    // Nothing to clean up — Ollama manages its own lifecycle
  }

  async healthCheck(): Promise<HealthResult> {
    const start = Date.now();
    try {
      const res = await this.fetcher(`${this.baseUrl}/api/tags`);
      if (!res.ok) {
        return { status: 'unhealthy', message: `Ollama returned HTTP ${res.status}` };
      }
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'unhealthy',
        message: `Cannot reach Ollama at ${this.baseUrl}: ${String(err)}`,
      };
    }
  }

  getManifest(): PluginManifest {
    return {
      id: 'ollama',
      name: '@garagebuild/plugin-ollama',
      version: '0.1.0',
      type: 'model',
      author: 'GarageBuild',
      description: 'Run AI models locally via Ollama — no API key required, zero cost.',
      entry: './dist/index.js',
      configSchema: './dist/config-schema.json',
      capabilities: ['chat', 'code', 'streaming'],
      minGarageBuildVersion: '0.1.0',
      sandboxTier: 'trusted',
    };
  }

  getConfigSchema(): ConfigSchema {
    return {
      fields: {
        baseUrl: {
          type: 'string',
          title: 'Ollama Base URL',
          description: 'The URL where Ollama is running.',
          default: 'http://localhost:11434',
          required: false,
        },
        model: {
          type: 'string',
          title: 'Default Model',
          description: 'Default model (e.g. llama3, mistral, codellama). Must be pulled first.',
          default: 'llama3',
          required: false,
        },
      },
    };
  }

  // ── ModelPlugin ────────────────────────────────────────────────────────────

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body: OllamaChatRequest = {
      model: request.model || this.defaultModel,
      messages: request.messages,
      stream: false,
      ...(request.temperature !== undefined || request.maxTokens !== undefined
        ? {
            options: {
              ...(request.temperature !== undefined && { temperature: request.temperature }),
              ...(request.maxTokens !== undefined && { num_predict: request.maxTokens }),
            },
          }
        : {}),
    };

    const res = await this.fetcher(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama chat failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as OllamaChatResponse;

    return {
      id: randomUUID(),
      content: data.message.content,
      model: data.model,
      finishReason: data.done_reason === 'length' ? 'length' : 'stop',
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
    };
  }

  async *stream(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const body: OllamaChatRequest = {
      model: request.model || this.defaultModel,
      messages: request.messages,
      stream: true,
      ...(request.temperature !== undefined || request.maxTokens !== undefined
        ? {
            options: {
              ...(request.temperature !== undefined && { temperature: request.temperature }),
              ...(request.maxTokens !== undefined && { num_predict: request.maxTokens }),
            },
          }
        : {}),
    };

    const res = await this.fetcher(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const id = randomUUID();
    let accumulated = '';
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        const chunk = JSON.parse(line) as OllamaStreamChunk;
        accumulated += chunk.message.content;

        const chatChunk: ChatChunk = {
          id,
          delta: chunk.message.content,
          accumulated,
          isDone: chunk.done,
          ...(chunk.done ? { finishReason: chunk.done_reason ?? 'stop' } : {}),
        };

        yield chatChunk;

        if (chunk.done) return;
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    // Ollama has no standalone tokenizer endpoint.
    // ~4 characters per token is a reasonable approximation for most LLMs.
    return Math.ceil(text.length / 4);
  }

  estimateCost(inputTokens: number, estimatedOutputTokens: number): CostEstimate {
    return {
      inputTokens,
      estimatedOutputTokens,
      estimatedCostUsd: 0,
      isLocal: true,
      confidence: 'estimated',
    };
  }

  getModelInfo(): ModelInfo {
    return {
      descriptor: this.makeDescriptor(this.defaultModel),
      isConfigured: true,
      lastChecked: new Date(),
    };
  }

  async listAvailableModels(): Promise<ModelDescriptor[]> {
    const res = await this.fetcher(`${this.baseUrl}/api/tags`);

    if (!res.ok) {
      throw new Error(`Ollama returned HTTP ${res.status} for /api/tags`);
    }

    const data = (await res.json()) as OllamaTagsResponse;

    return data.models.map(entry => this.makeDescriptor(entry.name));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private makeDescriptor(modelName: string): ModelDescriptor {
    return {
      id: `ollama/${modelName}`,
      provider: 'ollama',
      modelName,
      displayName: modelName,
      isLocal: true,
      contextWindow: contextWindowFor(modelName),
      capabilities: ['chat', 'code', 'streaming'],
      pricing: { inputCostPer1MTokens: 0, outputCostPer1MTokens: 0, isLocal: true },
      status: 'available',
    };
  }
}
