/**
 * PeriodicTableModal.js
 * Renders an interactive Periodic Table in a modal.
 */

import { PERIODIC_TABLE } from '../utils/PeriodicTable.js';

export class PeriodicTableModal {
    constructor(onSelect) {
        this.onSelect = onSelect;
        this.modal = null;
        this.init();
    }

    init() {
        // Create Modal Structure
        this.modal = document.createElement('div');
        this.modal.className = 'manual-overlay'; // Reuse existing modal overlay class
        this.modal.id = 'period-table-modal';

        const card = document.createElement('div');
        card.className = 'manual-card pt-card'; // Add specific class
        card.style.maxWidth = '1100px';
        card.style.width = '95%';

        card.innerHTML = `
            <button class="btn-close-manual" id="pt-close">×</button>
            <h2 style="margin-bottom: 1rem;">Select Element</h2>
            <div class="pt-grid" id="pt-grid"></div>
            <div class="pt-legend">
                <span class="pt-legend-item alkali-metal">Alkali Metal</span>
                <span class="pt-legend-item alkaline-earth">Alkaline Earth</span>
                <span class="pt-legend-item transition-metal">Transition Metal</span>
                <span class="pt-legend-item post-transition">Post-Transition</span>
                <span class="pt-legend-item metalloid">Metalloid</span>
                <span class="pt-legend-item nonmetal">Nonmetal</span>
                <span class="pt-legend-item noble-gas">Noble Gas</span>
                <span class="pt-legend-item lanthanide">Lanthanide</span>
                <span class="pt-legend-item actinide">Actinide</span>
            </div>
        `;

        this.modal.appendChild(card);
        document.body.appendChild(this.modal);

        this.renderGrid(card.querySelector('#pt-grid'));

        // Events
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal || e.target.id === 'pt-close') {
                this.close();
            }
        });
    }

    renderGrid(container) {
        // 18 Columns, 7 Rows (plus lanthanides/actinides)
        // We can use grid-column and grid-row styles

        PERIODIC_TABLE.forEach(elem => {
            const cell = document.createElement('div');
            cell.className = `pt-cell ${this.getCategoryClass(elem.category)}`;
            cell.style.gridColumn = elem.group;
            cell.style.gridRow = elem.period;

            // Handle Lanthanides/Actinides (Group 3, Period 6/7 usually condensed)
            // We'll create a separate block or use specific positioning
            if (elem.category === 'lanthanide') {
                cell.style.gridRow = 9;
                // Offset group for display row
                cell.style.gridColumn = (elem.Z - 57) + 3;
            } else if (elem.category === 'actinide') {
                cell.style.gridRow = 10;
                cell.style.gridColumn = (elem.Z - 89) + 3;
            }

            cell.innerHTML = `
                <div class="pt-num">${elem.Z}</div>
                <div class="pt-sym">${elem.symbol}</div>
                <div class="pt-name">${elem.name}</div>
            `;

            cell.addEventListener('click', () => {
                this.onSelect(elem.symbol);
                this.close();
            });

            container.appendChild(cell);
        });
    }

    getCategoryClass(cat) {
        if (!cat) return '';
        // Simplify categories to CSS classes
        if (cat.includes('alkali') && !cat.includes('earth')) return 'alkali-metal';
        if (cat.includes('alkaline earth')) return 'alkaline-earth';
        if (cat.includes('transition')) return 'transition-metal';
        if (cat.includes('lanthanide')) return 'lanthanide';
        if (cat.includes('actinide')) return 'actinide';
        if (cat.includes('noble')) return 'noble-gas';
        if (cat.includes('metalloid')) return 'metalloid';
        if (cat.includes('nonmetal')) return 'nonmetal';
        if (cat.includes('post-transition')) return 'post-transition';
        return '';
    }

    open() {
        this.modal.classList.add('active');
    }

    close() {
        this.modal.classList.remove('active');
    }
}
