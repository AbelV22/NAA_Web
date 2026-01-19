/**
 * Presets.js
 * Manages saving and loading of user form configurations using localStorage.
 */
export class Presets {
    static get STORAGE_KEY() {
        return 'nuclear_presets_v1';
    }

    /**
     * Get all presets from storage
     * @returns {Object} structure: { type: { name: data } }
     */
    static getAll() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.error('Presets load error', e);
            return {};
        }
    }

    /**
     * Save a preset
     * @param {string} type - 'single', 'impurity', 'waste', 'limit'
     * @param {string} name - User defined name
     * @param {Object} data - The form data
     */
    static save(type, name, data) {
        const all = this.getAll();
        if (!all[type]) all[type] = {};

        all[type][name] = {
            timestamp: Date.now(),
            data: data
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        return true;
    }

    /**
     * Load a specific preset
     * @param {string} type 
     * @param {string} name 
     */
    static load(type, name) {
        const all = this.getAll();
        return (all[type] && all[type][name]) ? all[type][name].data : null;
    }

    /**
     * Delete a preset
     */
    static delete(type, name) {
        const all = this.getAll();
        if (all[type] && all[type][name]) {
            delete all[type][name];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            return true;
        }
        return false;
    }

    /**
     * Get list of preset names for a type
     */
    static getList(type) {
        const all = this.getAll();
        if (!all[type]) return [];
        return Object.keys(all[type]).sort();
    }
}
