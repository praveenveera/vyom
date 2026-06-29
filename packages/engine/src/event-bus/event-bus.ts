// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Engine — Event Bus
//
// The internal nervous system. All subsystems communicate through events.
// No subsystem ever calls another subsystem directly.
//
// Design principle:
//   SessionManager.emit('message.created', message)  ✅
//   SessionManager → CostEngine.record(message)      ❌
// ─────────────────────────────────────────────────────────────────────────────

// ── Event Catalogue ───────────────────────────────────────────────────────────
//
// Every event emitted in GarageBuild is declared here with its payload type.
// This gives full type safety across the entire event system.

export interface GarageBuildEvents {
  // Workspace
  'workspace.created': { workspaceId: string; name: string };
  'workspace.updated': { workspaceId: string };

  // Project
  'project.created': { projectId: string; name: string; framework: string };
  'project.opened': { projectId: string };
  'project.closed': { projectId: string };
  'project.exported': { projectId: string; outputPath: string };
  'project.archived': { projectId: string };

  // Session
  'session.started': { sessionId: string; projectId: string };
  'session.ended': { sessionId: string; durationMs: number };

  // Message
  'message.created': { messageId: string; sessionId: string; role: string };
  'message.streaming': { messageId: string; delta: string; accumulated: string };
  'message.completed': {
    messageId: string;
    sessionId: string;
    projectId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    isLocal: boolean;
    latencyMs: number;
  };
  'message.failed': { messageId: string; sessionId: string; error: string };

  // File
  'file.created': { projectId: string; path: string };
  'file.modified': { projectId: string; path: string };
  'file.deleted': { projectId: string; path: string };

  // Usage
  'usage.recorded': { messageId: string; costUsd: number; totalTokens: number };
  'usage.threshold.reached': { scope: string; scopeId: string; costUsd: number };
  'usage.limit.exceeded': { scope: string; scopeId: string; limitUsd: number };

  // Plugin
  'plugin.installed': { pluginId: string; name: string; type: string };
  'plugin.activated': { pluginId: string };
  'plugin.deactivated': { pluginId: string };
  'plugin.error': { pluginId: string; error: string };
  'plugin.uninstalled': { pluginId: string };

  // Model
  'model.configured': { modelId: string; provider: string; model: string };
  'model.switched': { from: string; to: string; sessionId: string };

  // Agent
  'agent.task.started': { agentId: string; taskType: string; sessionId: string };
  'agent.task.completed': { agentId: string; sessionId: string; durationMs: number };
  'agent.task.failed': { agentId: string; sessionId: string; error: string };

  // Dev server
  'devserver.started': { projectId: string; url: string; port: number };
  'devserver.stopped': { projectId: string };
  'devserver.error': { projectId: string; error: string };

  // App lifecycle
  'app.ready': Record<string, never>;
  'app.shutdown': Record<string, never>;
}

export type GarageBuildEventName = keyof GarageBuildEvents;
export type GarageBuildEventPayload<T extends GarageBuildEventName> = GarageBuildEvents[T];

type EventHandler<T extends GarageBuildEventName> = (payload: GarageBuildEventPayload<T>) => void | Promise<void>;

interface EventSubscription {
  unsubscribe: () => void;
}

// ── Event Bus ─────────────────────────────────────────────────────────────────

/**
 * The GarageBuild Event Bus.
 *
 * Subsystems use this to communicate without coupling to each other.
 * All events are typed — TypeScript will catch unknown event names and
 * mismatched payload shapes at compile time.
 *
 * Usage:
 *   // Emit
 *   bus.emit('message.completed', { messageId, costUsd, ... });
 *
 *   // Listen
 *   const sub = bus.on('message.completed', (payload) => { ... });
 *   sub.unsubscribe(); // when done
 *
 *   // Listen once
 *   bus.once('app.ready', () => { ... });
 */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler<GarageBuildEventName>>>();
  private readonly onceHandlers = new Map<string, Set<EventHandler<GarageBuildEventName>>>();

  /**
   * Emit an event. All registered handlers are called synchronously in
   * registration order. Async handlers are fired and not awaited unless
   * you use emitAsync.
   */
  emit<T extends GarageBuildEventName>(event: T, payload: GarageBuildEventPayload<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload as GarageBuildEventPayload<GarageBuildEventName>);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }

    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        try {
          handler(payload as GarageBuildEventPayload<GarageBuildEventName>);
        } catch (err) {
          console.error(`[EventBus] Error in once-handler for "${event}":`, err);
        }
      }
      this.onceHandlers.delete(event);
    }
  }

  /**
   * Emit an event and await all async handlers before returning.
   * Use this when you need to ensure downstream processing is complete.
   */
  async emitAsync<T extends GarageBuildEventName>(event: T, payload: GarageBuildEventPayload<T>): Promise<void> {
    const promises: Promise<void>[] = [];

    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        const result = handler(payload as GarageBuildEventPayload<GarageBuildEventName>);
        if (result instanceof Promise) promises.push(result);
      }
    }

    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        const result = handler(payload as GarageBuildEventPayload<GarageBuildEventName>);
        if (result instanceof Promise) promises.push(result);
      }
      this.onceHandlers.delete(event);
    }

    await Promise.all(promises);
  }

  /**
   * Subscribe to an event. Returns an object with an unsubscribe method.
   */
  on<T extends GarageBuildEventName>(event: T, handler: EventHandler<T>): EventSubscription {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<GarageBuildEventName>);

    return {
      unsubscribe: () => {
        this.handlers.get(event)?.delete(handler as EventHandler<GarageBuildEventName>);
      },
    };
  }

  /**
   * Subscribe to an event once. The handler is automatically removed
   * after the first invocation.
   */
  once<T extends GarageBuildEventName>(event: T, handler: EventHandler<T>): EventSubscription {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler as EventHandler<GarageBuildEventName>);

    return {
      unsubscribe: () => {
        this.onceHandlers.get(event)?.delete(handler as EventHandler<GarageBuildEventName>);
      },
    };
  }

  /**
   * Remove all handlers for a specific event, or all handlers if no
   * event is specified. Useful for testing and cleanup.
   */
  removeAllListeners(event?: GarageBuildEventName): void {
    if (event) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  /**
   * Return the number of handlers registered for an event.
   * Useful for debugging and testing.
   */
  listenerCount(event: GarageBuildEventName): number {
    return (this.handlers.get(event)?.size ?? 0) + (this.onceHandlers.get(event)?.size ?? 0);
  }
}

// Export a singleton for use across the engine
export const eventBus = new EventBus();
