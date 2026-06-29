// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — ModelRouter
//
// The single entry point for all AI calls. Resolves the correct model plugin
// from the workspace's active model config and translates to/from the
// unified request/response contract.
//
// ADR-007: The engine never calls AI providers directly. All calls go here.
// ─────────────────────────────────────────────────────────────────────────────

import type { ChatMessage, ChatRequest, CostEstimate } from '@garagebuild/plugin-sdk';
import type { WorkspaceManager } from '../workspace-manager/workspace-manager.js';
import type { PluginRegistry } from '../plugin-registry/plugin-registry.js';
import { eventBus } from '../event-bus/event-bus.js';

// ── Unified contracts ─────────────────────────────────────────────────────────

export interface UnifiedChatRequest {
  /** ID of the ModelConfig to use. Falls back to the active model if omitted. */
  modelConfigId?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface UnifiedUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  isLocal: boolean;
}

export interface UnifiedChatResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: UnifiedUsage;
  latencyMs: number;
  timestamp: string;
}

export interface StreamChunk {
  id: string;
  delta: string;
  accumulated: string;
  isDone: boolean;
}

// ── ModelRouter ───────────────────────────────────────────────────────────────

export class ModelRouter {
  constructor(
    private readonly pluginRegistry: PluginRegistry,
    private readonly workspaceManager: WorkspaceManager,
  ) {}

  /**
   * Send a chat request and return the complete response.
   * Resolves the model config, routes to the correct plugin, and returns
   * a normalized UnifiedChatResponse regardless of provider.
   */
  async chat(request: UnifiedChatRequest): Promise<UnifiedChatResponse> {
    const { plugin, modelConfig } = this.resolve(request.modelConfigId);

    const chatRequest: ChatRequest = {
      messages: request.messages,
      model: modelConfig.modelName,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.maxTokens !== undefined && { maxTokens: request.maxTokens }),
    };

    const startTime = Date.now();
    const response = await plugin.chat(chatRequest);
    const latencyMs = Date.now() - startTime;

    const inputCostPer1k = modelConfig.costPer1kInputTokens;
    const outputCostPer1k = modelConfig.costPer1kOutputTokens;
    const costUsd = modelConfig.isLocal
      ? 0
      : (response.inputTokens / 1000) * inputCostPer1k +
        (response.outputTokens / 1000) * outputCostPer1k;

    return {
      id: response.id,
      content: response.content,
      model: modelConfig.modelName,
      provider: modelConfig.provider,
      finishReason: response.finishReason,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costUsd,
        isLocal: modelConfig.isLocal,
      },
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Stream a chat response chunk by chunk.
   * Each chunk carries a delta and the accumulated text so far.
   * Emits 'message.streaming' events for each chunk (requires a messageId
   * if the caller wants event-driven UI updates).
   */
  async *stream(request: UnifiedChatRequest, messageId?: string): AsyncGenerator<StreamChunk> {
    const { plugin, modelConfig } = this.resolve(request.modelConfigId);

    const chatRequest: ChatRequest = {
      messages: request.messages,
      model: modelConfig.modelName,
      stream: true,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.maxTokens !== undefined && { maxTokens: request.maxTokens }),
    };

    const pluginStream = plugin.stream(chatRequest);

    for await (const chunk of pluginStream) {
      if (messageId && !chunk.isDone) {
        eventBus.emit('message.streaming', {
          messageId,
          delta: chunk.delta,
          accumulated: chunk.accumulated,
        });
      }

      yield {
        id: chunk.id,
        delta: chunk.delta,
        accumulated: chunk.accumulated,
        isDone: chunk.isDone,
      };
    }
  }

  /**
   * Estimate the cost of a request before sending it.
   * Uses the plugin's token counter for the input and assumes the caller
   * provides an estimated output token count.
   */
  async estimateCost(
    inputText: string,
    estimatedOutputTokens: number,
    modelConfigId?: string,
  ): Promise<CostEstimate> {
    const { plugin } = this.resolve(modelConfigId);
    const inputTokens = await plugin.countTokens(inputText);
    return plugin.estimateCost(inputTokens, estimatedOutputTokens);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private resolve(modelConfigId?: string) {
    const modelConfig = modelConfigId
      ? this.workspaceManager.getModelConfig(modelConfigId)
      : this.workspaceManager.getActiveModel();

    if (!modelConfig) {
      throw new Error('No model configured. Add a model in workspace settings.');
    }

    const plugin = this.pluginRegistry.getModelPlugin(modelConfig.provider);

    return { plugin, modelConfig };
  }
}
