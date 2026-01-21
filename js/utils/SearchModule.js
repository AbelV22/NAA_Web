/**
 * SearchModule.js
 * Centralized logic for element and isotope searching using fuzzy matching.
 */

import { PERIODIC_TABLE } from './PeriodicTable.js';

export class SearchModule {
    constructor() {
        // Core Elements
        this.elements = PERIODIC_TABLE.map(e => ({
            ...e,
            lowerSym: e.symbol.toLowerCase(),
            lowerName: e.name.toLowerCase()
        }));

        // Valid Isotopes (injected later from XS Data)
        // Format: { label: "Lu-176 (2.59%)", value: "Lu-176", element: "Lu", lower: "lu-176" }
        this.isotopes = [];
        this.isotopeMap = new Map(); // "Lu" -> ["Lu-176", "Lu-177", ...]
    }

    /**
     * Load valid isotopes from the nuclear database (xsData)
     * @param {Array} isotopeList List of { symbol, A, abundance }
     */
    loadIsotopes(isotopeList) {
        this.isotopes = [];
        this.isotopeMap.clear();

        isotopeList.forEach(iso => {
            const sym = iso.symbol;
            const A = iso.A;
            const full = `${sym}-${A}`;
            const label = full;

            const item = {
                label: label,
                value: full,
                element: sym,
                lower: full.toLowerCase(),
                type: 'isotope'
            };

            this.isotopes.push(item);

            if (!this.isotopeMap.has(sym)) this.isotopeMap.set(sym, []);
            this.isotopeMap.get(sym).push(item);
        });

        console.log(`SearchModule: Loaded ${this.isotopes.length} isotopes.`);
    }

    /**
     * Search for isotopes/elements
     * @param {string} query 
     * @returns {Array} List of suggestions { label, value, type, score }
     */
    search(query) {
        if (!query || query.length < 1) return [];
        const q = query.toLowerCase().trim();

        // Check if query contains digits (strict isotope search)
        const hasDigits = /\d/.test(q);
        const matches = [];

        // 1. Element Search
        if (!hasDigits) {
            this.elements.forEach(e => {
                let score = 0;
                // Match Symbol
                if (e.lowerSym === q) score = 100; // Exact Symbol
                else if (e.lowerSym.startsWith(q)) score = 80; // Prefix Symbol

                // Match Name
                else if (e.lowerName === q) score = 90; // Exact Name
                else if (e.lowerName.startsWith(q)) score = 60; // Prefix Name
                else if (e.lowerName.includes(q)) score = 10; // Contains Name

                if (score > 0) {
                    // Add Element itself
                    matches.push({
                        label: `${e.name} (${e.symbol})`,
                        value: e.symbol,
                        type: 'element',
                        category: e.category,
                        score: score
                    });

                    // Add known isotopes for this element (if exact or strong prefix match)
                    if (score >= 80 && this.isotopeMap.has(e.symbol)) {
                        const isos = this.isotopeMap.get(e.symbol);
                        isos.forEach(iso => {
                            matches.push({
                                ...iso,
                                score: score - 5 // Slightly lower than element itself
                            });
                        });
                    }
                }
            });
        }
        // 2. Isotope Search (e.g. "Lu-177" or "177")
        else {
            // Check direct isotope list matches
            this.isotopes.forEach(iso => {
                if (iso.lower.includes(q)) {
                    matches.push({
                        ...iso,
                        score: iso.lower.startsWith(q) ? 100 : 50
                    });
                }
            });

            // Also check mass number only (e.g. "177" -> Lu-177, Yb-177...)
            const numMatch = q.match(/^\d+$/);
            if (numMatch) {
                // Already handled by includes check above (since "lu-177" includes "177")
                // unique scoring logic?
            }
        }

        // Deduplicate by value
        const unique = new Map();
        matches.forEach(m => {
            if (!unique.has(m.value) || unique.get(m.value).score < m.score) {
                unique.set(m.value, m);
            }
        });

        return Array.from(unique.values()).sort((a, b) => b.score - a.score).slice(0, 12);
    }

    /**
     * strict validation of isotope input
     * @param {string} value 
     * @returns {boolean}
     */
    isValidIsotope(value) {
        if (!value) return false;
        const lower = value.toLowerCase().trim();
        return this.isotopes.some(iso => iso.lower === lower);
    }
}

export const searchModule = new SearchModule();
