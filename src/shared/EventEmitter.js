/**
 * A simple event emitter class for handling custom events.
 * This allows for decoupled communication between different parts of the application.
 */
export class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * Registers a listener for a specific event.
     * @param {string} eventName - The name of the event.
     * @param {Function} listener - The callback function to execute.
     */
    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    /**
     * Emits an event, calling all registered listeners with the provided data.
     * @param {string} eventName - The name of the event to emit.
     * @param {*} [data] - Optional data to pass to the listeners.
     */
    emit(eventName, data) {
        const listeners = this.events[eventName];
        if (listeners) {
            listeners.forEach(listener => listener(data));
        }
    }

    /**
     * Removes a specific listener for an event.
     * @param {string} eventName - The name of the event.
     * @param {Function} listenerToRemove - The listener function to remove.
     */
    off(eventName, listenerToRemove) {
        const listeners = this.events[eventName];
        if (listeners) {
            this.events[eventName] = listeners.filter(listener => listener !== listenerToRemove);
        }
    }

    /**
     * Removes all listeners for all events.
     */
    removeAllListeners() {
        this.events = {};
    }
}