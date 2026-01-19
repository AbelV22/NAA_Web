/**
 * EventBus.js
 * Provides global event communication between decoupled components.
 * Essential for "Micro-frontend" style architecture in vanilla JS.
 */

class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * Signal an event to all subscribers
     */
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }

    /**
     * Unsubscribe
     */
    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
}

export const bus = new EventBus();

// Global Event Constants
export const EVENTS = {
    CALCULATION_START: 'calc:start',
    CALCULATION_COMPLETE: 'calc:complete',
    DATA_LOAD_SUCCESS: 'data:success',
    DATA_LOAD_ERROR: 'data:error',
    TOAST_SHOW: 'ui:toast'
};
