export interface VyomEvents {
    'workspace.created': {
        workspaceId: string;
        name: string;
    };
    'workspace.updated': {
        workspaceId: string;
    };
    'project.created': {
        projectId: string;
        name: string;
        framework: string;
    };
    'project.opened': {
        projectId: string;
    };
    'project.closed': {
        projectId: string;
    };
    'project.exported': {
        projectId: string;
        outputPath: string;
    };
    'project.archived': {
        projectId: string;
    };
    'session.started': {
        sessionId: string;
        projectId: string;
    };
    'session.ended': {
        sessionId: string;
        durationMs: number;
    };
    'message.created': {
        messageId: string;
        sessionId: string;
        role: string;
    };
    'message.streaming': {
        messageId: string;
        delta: string;
        accumulated: string;
    };
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
    'message.failed': {
        messageId: string;
        sessionId: string;
        error: string;
    };
    'file.created': {
        projectId: string;
        path: string;
    };
    'file.modified': {
        projectId: string;
        path: string;
    };
    'file.deleted': {
        projectId: string;
        path: string;
    };
    'usage.recorded': {
        messageId: string;
        costUsd: number;
        totalTokens: number;
    };
    'usage.threshold.reached': {
        scope: string;
        scopeId: string;
        costUsd: number;
    };
    'usage.limit.exceeded': {
        scope: string;
        scopeId: string;
        limitUsd: number;
    };
    'plugin.installed': {
        pluginId: string;
        name: string;
        type: string;
    };
    'plugin.activated': {
        pluginId: string;
    };
    'plugin.deactivated': {
        pluginId: string;
    };
    'plugin.error': {
        pluginId: string;
        error: string;
    };
    'plugin.uninstalled': {
        pluginId: string;
    };
    'model.configured': {
        modelId: string;
        provider: string;
        model: string;
    };
    'model.switched': {
        from: string;
        to: string;
        sessionId: string;
    };
    'agent.task.started': {
        agentId: string;
        taskType: string;
        sessionId: string;
    };
    'agent.task.completed': {
        agentId: string;
        sessionId: string;
        durationMs: number;
    };
    'agent.task.failed': {
        agentId: string;
        sessionId: string;
        error: string;
    };
    'devserver.started': {
        projectId: string;
        url: string;
        port: number;
    };
    'devserver.stopped': {
        projectId: string;
    };
    'devserver.error': {
        projectId: string;
        error: string;
    };
    'app.ready': Record<string, never>;
    'app.shutdown': Record<string, never>;
}
export type VyomEventName = keyof VyomEvents;
export type VyomEventPayload<T extends VyomEventName> = VyomEvents[T];
type EventHandler<T extends VyomEventName> = (payload: VyomEventPayload<T>) => void | Promise<void>;
interface EventSubscription {
    unsubscribe: () => void;
}
/**
 * The VYOM Event Bus.
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
export declare class EventBus {
    private readonly handlers;
    private readonly onceHandlers;
    /**
     * Emit an event. All registered handlers are called synchronously in
     * registration order. Async handlers are fired and not awaited unless
     * you use emitAsync.
     */
    emit<T extends VyomEventName>(event: T, payload: VyomEventPayload<T>): void;
    /**
     * Emit an event and await all async handlers before returning.
     * Use this when you need to ensure downstream processing is complete.
     */
    emitAsync<T extends VyomEventName>(event: T, payload: VyomEventPayload<T>): Promise<void>;
    /**
     * Subscribe to an event. Returns an object with an unsubscribe method.
     */
    on<T extends VyomEventName>(event: T, handler: EventHandler<T>): EventSubscription;
    /**
     * Subscribe to an event once. The handler is automatically removed
     * after the first invocation.
     */
    once<T extends VyomEventName>(event: T, handler: EventHandler<T>): EventSubscription;
    /**
     * Remove all handlers for a specific event, or all handlers if no
     * event is specified. Useful for testing and cleanup.
     */
    removeAllListeners(event?: VyomEventName): void;
    /**
     * Return the number of handlers registered for an event.
     * Useful for debugging and testing.
     */
    listenerCount(event: VyomEventName): number;
}
export declare const eventBus: EventBus;
export {};
//# sourceMappingURL=event-bus.d.ts.map