/**
 * Autocomplete.js
 * UI Component that attaches to an input field to provide smart search suggestions.
 */

import { searchModule } from '../utils/SearchModule.js';
import { HistoryManager } from '../store/History.js';
import { PeriodicTableModal } from './PeriodicTableModal.js';

export class Autocomplete {
    /**
     * @param {string} inputId ID of the input element
     * @param {Function} onSelect Callback when an item is selected (value) => void
     * @param {Object} options Configuration options
     * @param {string} options.filterType Optional 'element' or 'isotope' to strict filter suggestions
     */
    constructor(inputId, onSelect, options = {}) {
        this.input = document.getElementById(inputId);
        if (!this.input) return;

        this.onSelect = onSelect;
        this.options = options;
        this.wrapper = null;
        this.dropdown = null;
        this.suggestions = [];
        this.selectionIndex = -1;
        this.ptModal = null; // Lazy init

        this.init();
    }

    init() {
        // Prevent double init
        if (this.input.dataset.autocomplete) return;
        this.input.dataset.autocomplete = "true";

        // Remove native list if present
        this.input.removeAttribute('list');

        // Wrap input
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'autocomplete-wrapper';
        this.wrapper.style.position = 'relative';
        this.input.parentNode.insertBefore(this.wrapper, this.input);
        this.wrapper.appendChild(this.input);

        // Sidebar/Grid Button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-open-pt';
        btn.innerHTML = '📅'; // Grid/Table icon
        btn.title = 'Open Periodic Table';
        btn.style.cssText = `
            position: absolute; 
            right: 8px; 
            top: 50%; 
            transform: translateY(-50%); 
            background: none; 
            border: none; 
            cursor: pointer; 
            font-size: 1.2rem; 
            opacity: 0.5; 
            padding: 4px;
            z-index: 5;
            transition: opacity 0.2s;
        `;
        btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
        btn.addEventListener('mouseleave', () => btn.style.opacity = '0.5');
        btn.addEventListener('click', () => this.openPeriodicTable());
        this.wrapper.appendChild(btn);

        // Adjust input padding
        this.input.style.paddingRight = '40px';

        // Create Dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-dropdown';
        this.dropdown.style.display = 'none';
        this.wrapper.appendChild(this.dropdown);

        // Events
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
        this.input.addEventListener('focus', () => this.onFocus());

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) this.close();
        });
    }

    openPeriodicTable() {
        if (!this.ptModal) {
            this.ptModal = new PeriodicTableModal((symbol) => {
                this.selectItem({
                    label: symbol,
                    value: symbol,
                    type: 'element'
                });
            });
        }
        this.ptModal.open();
    }

    onInput() {
        const val = this.input.value.trim();
        if (val.length < 1) {
            this.showRecents();
            return;
        }

        let results = searchModule.search(val);

        // Filter if requested
        if (this.options.filterType) {
            results = results.filter(item => item.type === this.options.filterType);
        }

        this.suggestions = results;
        this.render();
    }

    onFocus() {
        if (this.input.value.trim().length === 0) {
            this.showRecents();
        } else {
            this.onInput();
        }
    }

    showRecents() {
        const recents = HistoryManager.getRecentSearches();
        if (!recents || recents.length === 0) {
            this.close();
            return;
        }

        this.suggestions = recents.map(r => ({
            label: r,
            value: r,
            type: 'recent',
            category: 'Recent'
        }));
        this.render();
    }

    onKeyDown(e) {
        if (this.dropdown.style.display === 'none') return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectionIndex = Math.min(this.selectionIndex + 1, this.suggestions.length - 1);
            this.refreshHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectionIndex = Math.max(this.selectionIndex - 1, -1);
            this.refreshHighlight();
        } else if (e.key === 'Enter') {
            if (this.selectionIndex >= 0 && this.suggestions[this.selectionIndex]) {
                e.preventDefault();
                this.selectItem(this.suggestions[this.selectionIndex]);
            }
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    render() {
        if (this.suggestions.length === 0) {
            this.close();
            return;
        }

        this.dropdown.innerHTML = '';
        this.selectionIndex = -1;

        this.suggestions.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';

            let icon;
            if (item.type === 'recent') icon = '🕒';
            else if (item.type === 'element') icon = '⚛️';
            else icon = '☢️';

            div.innerHTML = `
                <span class="ac-icon">${icon}</span>
                <span class="ac-label">${item.label}</span>
                ${item.category ? `<span class="ac-category">${item.category}</span>` : ''}
            `;

            div.addEventListener('click', () => this.selectItem(item));
            div.addEventListener('mouseenter', () => {
                this.selectionIndex = idx;
                this.refreshHighlight();
            });

            this.dropdown.appendChild(div);
        });

        this.dropdown.style.display = 'block';
    }

    refreshHighlight() {
        Array.from(this.dropdown.children).forEach((child, idx) => {
            child.classList.toggle('selected', idx === this.selectionIndex);
            if (idx === this.selectionIndex) {
                child.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    selectItem(item) {
        if (item.type === 'element') {
            this.input.value = item.value;
            // Trigger search to show detailed isotopes for this element
            this.onInput();
            return;
        }

        // Isotope logic (normal)
        HistoryManager.addRecentSearch(item.value);
        this.input.value = item.value;
        this.close();

        // Try to trigger change event so other listeners pick it up
        this.input.dispatchEvent(new Event('change'));
        this.input.dispatchEvent(new Event('input'));

        if (this.onSelect) this.onSelect(item.value);
    }

    close() {
        this.dropdown.style.display = 'none';
        this.suggestions = [];
        this.selectionIndex = -1;
    }
}
