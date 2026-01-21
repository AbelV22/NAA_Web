/**
 * History.js
 * Manages calculation history using localStorage in Premium App.
 * Handles persistence of calculation history and sessions.
 */

export class HistoryManager {
    constructor() {
        this.STORAGE_KEY_HISTORY = 'nuclear_calc_history';
        this.STORAGE_KEY_SESSIONS = 'nuclear_calc_sessions';
        this.history = [];
        this.sessions = [];
        this.init();
    }

    init() {
        this.loadFromStorage();
        console.log(`HistoryManager initialized: ${this.history.length} items, ${this.sessions.length} sessions`);
    }

    loadFromStorage() {
        try {
            const hist = localStorage.getItem(this.STORAGE_KEY_HISTORY);
            const sess = localStorage.getItem(this.STORAGE_KEY_SESSIONS);

            this.history = hist ? JSON.parse(hist) : [];
            this.sessions = sess ? JSON.parse(sess) : [];
        } catch (e) {
            console.error('Failed to load history from LocalStorage', e);
            this.history = [];
            this.sessions = [];
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY_HISTORY, JSON.stringify(this.history));
            localStorage.setItem(this.STORAGE_KEY_SESSIONS, JSON.stringify(this.sessions));
        } catch (e) {
            console.error('Failed to save history to LocalStorage', e);
            if (e.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded');
            }
        }
    }

    /**
     * Save a calculation result
     * @param {string} type - 'single', 'impurity', 'waste', 'limit'
     * @param {Object} params - Input parameters
     * @param {string} summary - Human readable summary string
     */
    saveCalculation(type, params, summary) {
        const item = {
            id: this._generateId(),
            timestamp: new Date().toISOString(),
            type: type,
            params: params,
            summary: summary
        };

        this.history.unshift(item);

        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }

        this.saveToStorage();
        return item;
    }

    getHistory() {
        return this.history;
    }

    deleteHistoryItem(id) {
        this.history = this.history.filter(item => item.id !== id);
        this.saveToStorage();
    }

    clearHistory() {
        this.history = [];
        this.saveToStorage();
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    createSession(name, itemIds) {
        const selectedItems = this.history.filter(item => itemIds.includes(item.id));
        if (selectedItems.length === 0) return null;

        const session = {
            id: this._generateId(),
            name: name,
            created: new Date().toISOString(),
            items: JSON.parse(JSON.stringify(selectedItems))
        };

        this.sessions.unshift(session);
        this.saveToStorage();
        return session;
    }

    getSessions() {
        return this.sessions;
    }

    deleteSession(id) {
        this.sessions = this.sessions.filter(s => s.id !== id);
        this.saveToStorage();
    }

    // =========================================================================
    // Import / Export
    // =========================================================================

    exportSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return null;
        return JSON.stringify(session, null, 2);
    }

    importSession(jsonString) {
        try {
            const session = JSON.parse(jsonString);
            if (!session.name || !session.items) throw new Error('Invalid session format');

            session.id = this._generateId();
            session.created = new Date().toISOString();
            session.name = session.name + ' (Imported)';

            this.sessions.unshift(session);
            this.saveToStorage();
            return session;
        } catch (e) {
            console.error('Import failed', e);
            throw e;
        }
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // =========================================================================
    // Static Helpers for Autocomplete (Recent Searches)
    // =========================================================================

    static _instance = null;
    static getInstance() {
        if (!this._instance) this._instance = new HistoryManager();
        return this._instance;
    }

    static RECENT_SEARCH_KEY = 'nuclear_recent_searches';

    static getRecentSearches() {
        try {
            const raw = localStorage.getItem(this.RECENT_SEARCH_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    static addRecentSearch(term) {
        if (!term || !term.trim()) return;
        let recents = this.getRecentSearches();
        // Remove if exists to move to top
        recents = recents.filter(r => r !== term);
        recents.unshift(term);
        // Limit to 10
        if (recents.length > 10) recents = recents.slice(0, 10);
        localStorage.setItem(this.RECENT_SEARCH_KEY, JSON.stringify(recents));
    }
}
