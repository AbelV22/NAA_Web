/**
 * Store.js
 * A high-performance, 0-dependency State Manager for Vanilla JS.
 * Design inspired by Zustand/Redux but optimized for browser-native execution.
 */

export class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Set();
    }

    /**
     * Get the current state
     */
    getState() {
        return this.state;
    }

    /**
     * Update the state and notify all listeners
     * @param {Object|Function} nextState - New state object or a function that receives current state
     */
    setState(nextState) {
        const newState = typeof nextState === 'function'
            ? nextState(this.state)
            : nextState;

        // Shallow merge
        this.state = { ...this.state, ...newState };

        // Notify listeners
        this.listeners.forEach(listener => listener(this.state));

        console.log('[Store Update]:', this.state);
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function(state)
     * @returns {Function} - Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        // Instant first call for initial render
        listener(this.state);

        return () => this.listeners.delete(listener);
    }
}

/**
 * Global App State Definition
 */
export const appStore = new Store({
    // Navigation
    activeTab: 'single-isotope',

    // Calculation Input
    inputIsotope: 'Lu-177',
    neutronFlux: '2.2e14',
    irradiationTime: 14.0,
    coolingTime: 0.0,

    // Simulation Results
    isCalculating: false,
    pathways: [],
    finalResults: null,

    // Data Loading
    dataLoaded: false,
    databaseError: null
});
