import { appStore } from './Store.js';

export class DataLoader {
    constructor() {
        this.cache = new Map();
        // Path relative to index.html (which is in premium_app/)
        // Data is in premium_app/public/data/
        this.paths = {
            xs: './public/data/Database_Fixed_Lambdas2.csv',
            chain: './public/data/BaseDatos_Cadenas_Completas.csv',
            limits: './public/data/limits.csv'
        };
    }

    async loadAll() {
        try {
            const [xsData, chainData, limitsData] = await Promise.all([
                this.loadCSV(this.paths.xs),
                this.loadCSV(this.paths.chain),
                this.loadCSV(this.paths.limits)
            ]);

            appStore.setState({
                xsData,
                chainData,
                limitsData,
                dataLoaded: true
            });

            console.log('Premium Data Loaded Successfully');
            return true;
        } catch (error) {
            console.error('Data Load Failed', error);
            appStore.setState({ databaseError: error.message });
            return false;
        }
    }

    async loadCSV(url) {
        // Check for offline data injection
        let key = null;
        if (url.includes('Database_Fixed_Lambdas2')) key = 'xs';
        else if (url.includes('BaseDatos_Cadenas_Completas')) key = 'chain';
        else if (url.includes('limits')) key = 'limits';

        if (key && window.NUCLEAR_DATA_OFFLINE && window.NUCLEAR_DATA_OFFLINE[key]) {
            console.log(`Using embedded data for ${key}`);
            const text = window.NUCLEAR_DATA_OFFLINE[key];
            const data = this.parseCSV(text);
            this.cache.set(url, data);
            return data;
        }

        if (this.cache.has(url)) return this.cache.get(url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        const text = await response.text();
        const data = this.parseCSV(text);

        this.cache.set(url, data);
        return data;
    }

    parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());

        return lines.slice(1).map(line => {
            // Handle quoted strings (simple split doesn't work for "a,b")
            // But our DB has simple structure, simple regex split is safer
            // Or use a simple CSV parser
            const values = [];
            let current = '';
            let inQuote = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuote = !inQuote;
                else if (char === ',' && !inQuote) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            return headers.reduce((obj, header, idx) => {
                obj[header] = values[idx] || '';
                return obj;
            }, {});
        });
    }
}
