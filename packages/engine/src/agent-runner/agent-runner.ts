// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — AgentRunner
//
// Executes AI agent tasks by routing to the right built-in agent definition
// and driving ModelRouter with a task-specific system prompt.
//
// Phase 1: built-in agents only (code-generator, reviewer, test-writer,
//          refactorer, explainer). No external AgentPlugin integration yet —
//          that is the Phase 2 extension point.
//
// Event flow:
//   agent.task.started → ModelRouter.chat() → agent.task.completed
//                                           → agent.task.failed (on error)
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentTask, AgentResult, AgentChunk, TaskType } from '@garagebuild/plugin-sdk';
import { eventBus } from '../event-bus/event-bus.js';
import type { ModelRouter } from '../model-router/model-router.js';
import {
  BUILT_IN_AGENTS,
  AGENT_BY_TASK_TYPE,
  type AgentDefinition,
} from './built-in-agents.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunOptions {
  /** Session to associate with this task for event payloads. */
  sessionId?: string;
  /** Override the model config to use. Falls back to the active model. */
  modelConfigId?: string;
}

// ── AgentRunner ───────────────────────────────────────────────────────────────

export class AgentRunner {
  constructor(private readonly modelRouter: ModelRouter) {}

  /**
   * Execute an agent task and return the complete result.
   * Emits agent.task.started, agent.task.completed (or .failed).
   */
  async execute(task: AgentTask, options: RunOptions = {}): Promise<AgentResult> {
    const sessionId = options.sessionId ?? '';
    const startedAt = Date.now();

    let agent: AgentDefinition;
    try {
      agent = this.resolveAgent(task.type);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, output: '', errors: [error] };
    }

    eventBus.emit('agent.task.started', {
      agentId: agent.id,
      taskType: task.type,
      sessionId,
    });

    try {
      const response = await this.modelRouter.chat({
        messages: [
          { role: 'system', content: agent.buildSystemPrompt() },
          { role: 'user', content: agent.buildUserPrompt(task) },
        ],
        ...(options.modelConfigId !== undefined && { modelConfigId: options.modelConfigId }),
      });

      eventBus.emit('agent.task.completed', {
        agentId: agent.id,
        sessionId,
        durationMs: Date.now() - startedAt,
      });

      return {
        success: true,
        output: cleanAgentOutput(response.content, task.type),
        errors: [],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      eventBus.emit('agent.task.failed', {
        agentId: agent.id,
        sessionId,
        error,
      });

      return {
        success: false,
        output: '',
        errors: [error],
      };
    }
  }

  /**
   * Execute an agent task and stream the output chunk by chunk.
   * Emits agent.task.started, agent.task.completed (or .failed).
   */
  async *stream(
    task: AgentTask,
    options: RunOptions & { messageId?: string } = {},
  ): AsyncGenerator<AgentChunk> {
    const agent = this.resolveAgent(task.type);
    const sessionId = options.sessionId ?? '';
    const startedAt = Date.now();

    eventBus.emit('agent.task.started', {
      agentId: agent.id,
      taskType: task.type,
      sessionId,
    });

    try {
      const streamGen = this.modelRouter.stream(
        {
          messages: [
            { role: 'system', content: agent.buildSystemPrompt() },
            { role: 'user', content: agent.buildUserPrompt(task) },
          ],
          ...(options.modelConfigId !== undefined && { modelConfigId: options.modelConfigId }),
        },
        options.messageId,
      );

      let lastAccumulated = '';

      for await (const chunk of streamGen) {
        lastAccumulated = chunk.accumulated;
        yield { delta: chunk.delta, accumulated: chunk.accumulated, isDone: chunk.isDone };
      }

      eventBus.emit('agent.task.completed', {
        agentId: agent.id,
        sessionId,
        durationMs: Date.now() - startedAt,
      });

      // Ensure the caller always gets a final isDone chunk
      if (lastAccumulated !== '') {
        yield { delta: '', accumulated: lastAccumulated, isDone: true };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      eventBus.emit('agent.task.failed', { agentId: agent.id, sessionId, error });
      throw err;
    }
  }

  /** List all built-in agent definitions. */
  listAgents(): AgentDefinition[] {
    return BUILT_IN_AGENTS;
  }

  /** Returns true if there is a built-in agent that handles this task type. */
  canHandle(taskType: TaskType): boolean {
    return AGENT_BY_TASK_TYPE.has(taskType);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private resolveAgent(taskType: TaskType): AgentDefinition {
    const agent = AGENT_BY_TASK_TYPE.get(taskType);
    if (!agent) {
      throw new Error(`No agent available for task type: "${taskType}"`);
    }
    return agent;
  }
}

/**
 * Utility to scrub conversational padding, markdown wrapping, and schema drift
 * from local LLM outputs based on the task constraints.
 */
export function cleanAgentOutput(content: string, taskType: TaskType): string {
  if (taskType === 'chat' || taskType === 'review' || taskType === 'explain') {
    return content;
  }

  const trimmed = content.trim();

  // 1. Extract markdown code blocks if the output contains them (common for code-gen/tests)
  const codeBlockRegex = /```(?:[a-zA-Z0-9.-]+(?:\s+[^\n]+)?)?\n([\s\S]+?)\n```/g;
  const matches = [...trimmed.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    if (taskType === 'test') {
      return matches[0][1];
    }
    return trimmed; 
  }

  // 2. Extract JSON payload if surrounded by conversational text (useful for tool-calling)
  const jsonRegex = /\{[\s\S]*\}/;
  const jsonMatch = trimmed.match(jsonRegex);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[0]);
      return jsonMatch[0];
    } catch {
      // invalid JSON, fall through
    }
  }

  // 3. Extract XML tags if present
  const xmlTagRegex = /<[a-zA-Z_0-9-]+(?:\s+[a-zA-Z_0-9-]+=".*?")*>[\s\S]*?<\/[a-zA-Z_0-9-]+>/;
  const xmlMatch = trimmed.match(xmlTagRegex);
  if (xmlMatch) {
    return xmlMatch[0];
  }

  return trimmed;
}
