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
    handlers = new Map();
    onceHandlers = new Map();
    /**
     * Emit an event. All registered handlers are called synchronously in
     * registration order. Async handlers are fired and not awaited unless
     * you use emitAsync.
     */
    emit(event, payload) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(payload);
                }
                catch (err) {
                    console.error(`[EventBus] Error in handler for "${event}":`, err);
                }
            }
        }
        const onceHandlers = this.onceHandlers.get(event);
        if (onceHandlers) {
            for (const handler of onceHandlers) {
                try {
                    handler(payload);
                }
                catch (err) {
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
    async emitAsync(event, payload) {
        const promises = [];
        const handlers = this.handlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                const result = handler(payload);
                if (result instanceof Promise)
                    promises.push(result);
            }
        }
        const onceHandlers = this.onceHandlers.get(event);
        if (onceHandlers) {
            for (const handler of onceHandlers) {
                const result = handler(payload);
                if (result instanceof Promise)
                    promises.push(result);
            }
            this.onceHandlers.delete(event);
        }
        await Promise.all(promises);
    }
    /**
     * Subscribe to an event. Returns an object with an unsubscribe method.
     */
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
        return {
            unsubscribe: () => {
                this.handlers.get(event)?.delete(handler);
            },
        };
    }
    /**
     * Subscribe to an event once. The handler is automatically removed
     * after the first invocation.
     */
    once(event, handler) {
        if (!this.onceHandlers.has(event)) {
            this.onceHandlers.set(event, new Set());
        }
        this.onceHandlers.get(event).add(handler);
        return {
            unsubscribe: () => {
                this.onceHandlers.get(event)?.delete(handler);
            },
        };
    }
    /**
     * Remove all handlers for a specific event, or all handlers if no
     * event is specified. Useful for testing and cleanup.
     */
    removeAllListeners(event) {
        if (event) {
            this.handlers.delete(event);
            this.onceHandlers.delete(event);
        }
        else {
            this.handlers.clear();
            this.onceHandlers.clear();
        }
    }
    /**
     * Return the number of handlers registered for an event.
     * Useful for debugging and testing.
     */
    listenerCount(event) {
        return (this.handlers.get(event)?.size ?? 0) + (this.onceHandlers.get(event)?.size ?? 0);
    }
}
// Export a singleton for use across the engine
export const eventBus = new EventBus();
//# sourceMappingURL=event-bus.js.map