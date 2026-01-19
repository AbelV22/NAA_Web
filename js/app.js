/**
 * app.js
 * The Main Orchestrator for NuclearX Premium.
 * Initializes the store, components, and workers.
 */

import { appStore } from './store/Store.js';
import { bus, EVENTS } from './modules/EventBus.js';
import { DataLoader } from './store/DataLoader.js';
import { NuclearSolver } from './engine/NuclearSolver.js';
import { SECONDS_PER_DAY } from './utils/Constants.js';
import { PERIODIC_TABLE } from './utils/PeriodicTable.js';
import { renderActivityPieChart, renderComplianceBarChart, renderDecayChart } from './utils/Charts.js';
import { exportToPDF } from './utils/PDF.js';
import { PasswordGate } from './auth/PasswordGate.js';
import { Presets } from './store/Presets.js';

class App {
    constructor() {
        this.dataLoader = new DataLoader();
        this.solver = null;
        this.init();
    }

    async init() {
        try {
            // Security Check
            const isAuthenticated = await PasswordGate.init();
            if (!isAuthenticated) return;

            console.log('%c Thermal NAA Tool Initializing... ', 'background: #0066ff; color: #fff; border-radius: 4px; padding: 2px 8px;');

            // Initialize UI
            this.setupNavigation();
            this.setupAutocomplete();
            this.renderSingleIsotopeForm();
            this.renderImpurityForm();
            this.renderWasteForm();
            this.renderLimitForm();
            this.setupEventListeners();

            this.dataLoader.loadAll()
                .then(() => {
                    const state = appStore.getState();
                    if (state.dataLoaded) {
                        this.solver = new NuclearSolver(state.xsData, state.chainData, state.limitsData);
                        console.log('Math Engine Initialized');
                    }
                    console.log('App ready');
                    // Hide any initial loading spinner if applicable
                })
                .catch(err => {
                    console.error('Data loading error:', err);
                    this.showError('Database Error', `Failed to load nuclear data CSV files. Check if they exist in public/data/. Details: ${err.message}`);
                });
        } catch (error) {
            console.error('Initialization Error:', error);
            this.showError('Application Error', `Failed to initialize the tool. Details: ${error.message}`);
        }
    }

    showError(title, msg) {
        const modal = document.createElement('div');
        modal.className = 'card';
        modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:100000; padding:2rem; background:#1a1a3a; border:2px solid #ff6b6b; color:white; max-width:500px; box-shadow:0 0 50px rgba(0,0,0,0.8);';
        modal.innerHTML = `
            <h2 style="color:#ff6b6b; margin-top:0;">⚠️ ${title}</h2>
            <p>${msg}</p>
            <button onclick="location.reload()" class="btn btn-primary" style="margin-top:1rem; width:100%;">Retry / Refresh</button>
        `;
        document.body.appendChild(modal);
    }

    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                appStore.setState({ activeTab: target });
                this.updateActiveTabs(target);
            });
        });
        appStore.subscribe((state) => {
            this.updateActiveTabs(state.activeTab);
        });
    }

    updateActiveTabs(activeId) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeId));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${activeId}`));
    }

    setupAutocomplete() {
        const list = document.createElement('datalist');
        list.id = 'elements-list';
        PERIODIC_TABLE.forEach(elem => {
            const opt = document.createElement('option');
            opt.value = elem;
            list.appendChild(opt);
        });
        document.body.appendChild(list);
    }

    setupEventListeners() {
        bus.on(EVENTS.CALCULATION_START, () => this.handleCalculation());

        // Delegate Event Listeners for dynamic elements
        document.body.addEventListener('click', (e) => {
            const id = e.target.id;
            if (id === 'btn-calculate') this.handleCalculation();

            // Impurity Strings
            if (id === 'btn-add-imp') this.addImpurityItem();
            if (id === 'btn-calc-imp') this.handleImpurityCalculation();

            // Waste Strings
            if (id === 'btn-add-waste-imp') this.addWasteItem();
            if (id === 'btn-calc-waste') this.handleWasteCalculation();

            // Limit Strings
            if (id === 'btn-add-lim') this.addLimitItem();
            if (id === 'btn-calc-lim') this.handleLimitCalculation();

            // Help Toggle logic
            if (e.target.classList.contains('help-btn') || e.target.closest('.help-btn')) {
                const btn = e.target.classList.contains('help-btn') ? e.target : e.target.closest('.help-btn');
                const targetId = btn.dataset.help;
                const panel = document.getElementById(targetId);
                if (panel) {
                    panel.classList.toggle('active');
                }
            }

            // Manual triggers
            if (id === 'btn-open-manual') document.getElementById('manual-modal').classList.add('active');
            if (id === 'btn-close-manual') document.getElementById('manual-modal').classList.remove('active');

            // Remove buttons
            if (e.target.classList.contains('btn-remove-item')) {
                e.target.parentElement.remove();
            }
            // Start Presets Logic
            if (e.target.closest('.btn-save-preset')) {
                const type = e.target.closest('.btn-save-preset').dataset.type;
                this.handleSavePreset(type);
            }
            if (e.target.closest('.btn-load-preset')) {
                const type = e.target.closest('.btn-load-preset').dataset.type;
                this.handleLoadPreset(type);
            }
            // End Presets Logic
        });
    }

    // --- PRESETS HELPERS ---
    getSingleIsotopeData() {
        return {
            iso: document.getElementById('input-iso').value,
            mass: document.getElementById('input-mass').value,
            flux: document.getElementById('input-flux').value,
            time: document.getElementById('input-time').value,
            cool: document.getElementById('input-cool').value
        };
    }
    setSingleIsotopeData(data) {
        if (!data) return;
        if (data.iso) document.getElementById('input-iso').value = data.iso;
        if (data.mass) document.getElementById('input-mass').value = data.mass;
        if (data.flux) document.getElementById('input-flux').value = data.flux;
        if (data.time) document.getElementById('input-time').value = data.time;
        if (data.cool) document.getElementById('input-cool').value = data.cool;
    }

    getImpurityData() {
        // We only save the main inputs, not the list for now (or maybe we should?)
        // Let's safe the main inputs to simplify first version
        return {
            mass: document.getElementById('imp-mass').value,
            flux: document.getElementById('imp-flux').value,
            time: document.getElementById('imp-time').value,
            cool: document.getElementById('imp-cool').value
        };
    }
    setImpurityData(data) {
        if (!data) return;
        if (data.mass) document.getElementById('imp-mass').value = data.mass;
        if (data.flux) document.getElementById('imp-flux').value = data.flux;
        if (data.time) document.getElementById('imp-time').value = data.time;
        if (data.cool) document.getElementById('imp-cool').value = data.cool;
    }

    getWasteData() {
        return {
            mass: document.getElementById('waste-mass').value,
            total: document.getElementById('waste-total').value,
            flux: document.getElementById('waste-flux').value,
            time: document.getElementById('waste-time').value,
            cool: document.getElementById('waste-cool').value
        };
    }
    setWasteData(data) {
        if (!data) return;
        if (data.mass) document.getElementById('waste-mass').value = data.mass;
        if (data.total) document.getElementById('waste-total').value = data.total;
        if (data.flux) document.getElementById('waste-flux').value = data.flux;
        if (data.time) document.getElementById('waste-time').value = data.time;
        if (data.cool) document.getElementById('waste-cool').value = data.cool;
    }

    getLimitData() {
        return {
            mass: document.getElementById('lim-mass').value,
            wmass: document.getElementById('lim-wmass').value,
            flux: document.getElementById('lim-flux').value,
            time: document.getElementById('lim-time').value,
            cool: document.getElementById('lim-cool').value,
            type: document.getElementById('lim-type').value
        };
    }
    setLimitData(data) {
        if (!data) return;
        if (data.mass) document.getElementById('lim-mass').value = data.mass;
        if (data.wmass) document.getElementById('lim-wmass').value = data.wmass;
        if (data.flux) document.getElementById('lim-flux').value = data.flux;
        if (data.time) document.getElementById('lim-time').value = data.time;
        if (data.cool) document.getElementById('lim-cool').value = data.cool;
        if (data.type) document.getElementById('lim-type').value = data.type;
    }

    handleSavePreset(type) {
        let data = null;
        if (type === 'single') data = this.getSingleIsotopeData();
        if (type === 'impurity') data = this.getImpurityData();
        if (type === 'waste') data = this.getWasteData();
        if (type === 'limit') data = this.getLimitData();

        if (!data) return;

        const name = prompt('Enter a name for this preset:');
        if (name) {
            Presets.save(type, name, data);
            this.showToast('Preset saved!', 'success');
        }
    }

    handleLoadPreset(type) {
        const list = Presets.getList(type);
        if (list.length === 0) return this.showToast('No presets found', 'warning');

        // Simple prompt for now, could be a better modal later
        let msg = "Available Presets:\n";
        list.forEach((n, i) => msg += `${i + 1}. ${n}\n`);
        msg += "\nEnter the number of the preset to load:";

        const choice = prompt(msg);
        const idx = parseInt(choice) - 1;

        if (idx >= 0 && idx < list.length) {
            const name = list[idx];
            const data = Presets.load(type, name);

            if (type === 'single') this.setSingleIsotopeData(data);
            if (type === 'impurity') this.setImpurityData(data);
            if (type === 'waste') this.setWasteData(data);
            if (type === 'limit') this.setLimitData(data);

            this.showToast(`Loaded "${name}"`, 'success');
        }
    }

    renderSingleIsotopeForm() {
        const container = document.getElementById('tab-single-isotope');
        if (!container) return;

        // Define SVG icons inline for performance
        const icons = {
            atom: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(0 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/></svg>',
            mass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M6 8h12l-2 13H8L6 8z"/></svg>',
            flux: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            time: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            cool: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>'
        };

        container.innerHTML = `
            <div class="panel card">
                <div class="panel-header">
                    <h2 class="panel-title">Single Isotope Activation</h2>
                    <div style="display:flex; gap:0.5rem; margin-right:auto; margin-left:1rem;">
                        <button class="btn-secondary btn-save-preset" data-type="single" title="Save Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
                        <button class="btn-secondary btn-load-preset" data-type="single" title="Load Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></button>
                    </div>
                    <button class="help-btn" data-help="help-single">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
                        How it works
                    </button>
                </div>

                <div id="help-single" class="help-panel">
                    <div class="help-content">
                        <h4>Theoretical Background</h4>
                        <p>This module calculates the specific activity of an isotope and its progeny using the <b>Bateman Equation</b>. It simulates the neutron capture process (n,γ) and the subsequent radioactive decay chain.</p>
                        <ul>
                            <li><b>Parent Isotope:</b> The target isotope used for irradiation.</li>
                            <li><b>Neutron Flux:</b> The density of free neutrons in the reactor.</li>
                            <li><b>Irradiation:</b> Duration the sample stays inside the flux.</li>
                        </ul>
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label>${icons.atom} PARENT ISOTOPE</label>
                        <input type="text" id="input-iso" value="Lu-176" class="input-field" placeholder="e.g. Lu-176">
                    </div>
                    <div class="form-group">
                        <label>${icons.mass} MASS (g)</label>
                        <input type="number" id="input-mass" value="1.0" class="input-field" step="0.1">
                    </div>
                     <div class="form-group">
                        <label>${icons.flux} NEUTRON FLUX (n/cm² · s)</label>
                        <input type="text" id="input-flux" value="2.2e14" class="input-field">
                    </div>
                    <div class="form-group">
                        <label>${icons.time} IRRADIATION TIME (days)</label>
                        <input type="number" id="input-time" value="14.0" class="input-field" step="0.1">
                    </div>
                     <div class="form-group">
                        <label>${icons.cool} COOLING TIME (days)</label>
                        <input type="number" id="input-cool" value="0.0" class="input-field" step="0.1">
                    </div>
                </div>
                <div class="form-actions" style="margin-top: 2rem;">
                    <button id="btn-calculate" class="btn-primary">
                        Calculate Activation
                    </button>
                </div>
                <div id="results-area" class="results-area" style="margin-top: 2rem;"></div>
            </div>
        `;
    }

    renderImpurityForm() {
        const container = document.getElementById('tab-impurity');
        if (!container) return;

        const icons = {
            element: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16" font-size="10" text-anchor="middle" fill="currentColor">Fe</text></svg>',
            mass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M6 8h12l-2 13H8L6 8z"/></svg>',
            flux: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            time: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            cool: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>'
        };

        container.innerHTML = `
            <div class="panel card">
                <div class="panel-header">
                    <h2 class="panel-title">Impurity Activation</h2>
                    <div style="display:flex; gap:0.5rem; margin-right:auto; margin-left:1rem;">
                        <button class="btn-secondary btn-save-preset" data-type="impurity" title="Save Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
                        <button class="btn-secondary btn-load-preset" data-type="impurity" title="Load Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></button>
                    </div>
                    <button class="help-btn" data-help="help-imp">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
                        How it works
                    </button>
                </div>

                <div id="help-imp" class="help-panel">
                    <div class="help-content">
                        <h4>Bulk Sample Analysis</h4>
                        <p>This calculator handles multi-element activation. It calculates the resulting activity from secondary elements (impurities) present in your target material.</p>
                        <ul>
                            <li><b>ppm (Parts Per Million):</b> Concentration of the impurity in the main sample mass.</li>
                            <li><b>Sample Mass:</b> Total weight of the bulk material.</li>
                            <li><b>Automatic Pathing:</b> The system automatically identifies all possible (n,γ) pathways for the given element.</li>
                        </ul>
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label>${icons.element} ELEMENT SYMBOL</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" id="imp-sym" placeholder="e.g. Fe" class="input-field" style="flex:1" list="elements-list">
                            <input type="number" id="imp-ppm" placeholder="ppm" class="input-field" style="flex:1">
                            <button id="btn-add-imp" class="btn-secondary">Add</button>
                        </div>
                    </div>
                </div>
                <div id="impurity-list" class="impurity-list" style="margin: 1rem 0; display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
                <div class="form-grid">
                    <div class="form-group"><label>${icons.mass} SAMPLE MASS (g)</label><input type="number" id="imp-mass" value="1.0" class="input-field"></div>
                    <div class="form-group"><label>${icons.flux} FLUX (n/cm² · s)</label><input type="text" id="imp-flux" value="2.2e14" class="input-field"></div>
                    <div class="form-group"><label>${icons.time} IRRADIATION (days)</label><input type="number" id="imp-time" value="10.0" class="input-field"></div>
                    <div class="form-group"><label>${icons.cool} COOLING (days)</label><input type="number" id="imp-cool" value="0.0" class="input-field"></div>
                </div>
                <div class="form-actions" style="margin-top: 2rem;">
                    <button id="btn-calc-imp" class="btn-primary">Calculate Impurity Activation</button>
                </div>
                </div>
                <div id="imp-results-area" class="results-area" style="margin-top: 2rem;"></div>
            </div>`;
    }

    renderWasteForm() {
        const container = document.getElementById('tab-waste');
        if (!container) return;

        const icons = {
            mass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M6 8h12l-2 13H8L6 8z"/></svg>',
            waste: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
            flux: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            time: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            cool: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>'
        };

        container.innerHTML = `
            <div class="panel card">
                <div class="panel-header">
                    <h2 class="panel-title">Waste Compliance</h2>
                    <div style="display:flex; gap:0.5rem; margin-right:auto; margin-left:1rem;">
                        <button class="btn-secondary btn-save-preset" data-type="waste" title="Save Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
                        <button class="btn-secondary btn-load-preset" data-type="waste" title="Load Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></button>
                    </div>
                    <button class="help-btn" data-help="help-waste">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
                        About Compliance
                    </button>
                </div>

                <div id="help-waste" class="help-panel">
                    <div class="help-content">
                        <h4>Regulatory Standards</h4>
                        <p>This tool verifies if the produced batch complies with international safety limits (Exemption and Clearance) for disposal or unrestricted release.</p>
                        <ul>
                            <li><b>Sum Index:</b> $\\sum (Activity_i / Limit_i)$. Must be below 1.0 for compliance.</li>
                            <li><b>Clearance Time:</b> The engine calculates the cooling duration required until the sum index drops below 1.0.</li>
                            <li><b>Total Waste:</b> The volume of material used to dilute the sample activity to specific activity (Bq/g).</li>
                        </ul>
                    </div>
                </div>

                 <div class="form-grid">
                    <div class="form-group"><label>${icons.mass} SAMPLE MASS (g)</label><input type="number" id="waste-mass" value="10.0" class="input-field"></div>
                    <div class="form-group"><label>${icons.waste} TOTAL WASTE (g)</label><input type="number" id="waste-total" value="35000" class="input-field"></div>
                </div>
                <div class="form-grid">
                     <div class="form-group"><label>${icons.time} IRRADIATION (days)</label><input type="number" id="waste-time" value="10.0" class="input-field"></div>
                     <div class="form-group"><label>${icons.cool} COOLING (days)</label><input type="number" id="waste-cool" value="365.0" class="input-field"></div>
                     <div class="form-group"><label>${icons.flux} FLUX (n/cm² · s)</label><input type="text" id="waste-flux" value="2.2e14" class="input-field"></div>
                </div>
                <div style="margin: 1rem 0;">
                    <label>Impurities</label>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                         <input type="text" id="waste-imp-sym" placeholder="Sym" class="input-field" style="width: 80px;" list="elements-list">
                         <input type="number" id="waste-imp-ppm" placeholder="ppm" class="input-field" style="width: 80px;">
                         <button id="btn-add-waste-imp" class="btn-secondary">Add</button>
                    </div>
                    <div id="waste-imp-list" class="impurity-list" style="display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
                </div>
                <button id="btn-calc-waste" class="btn-primary">Analyze Batch</button>
                <div id="waste-results-area" class="results-area" style="margin-top: 2rem;"></div>
            </div>`;
    }

    renderLimitForm() {
        const container = document.getElementById('tab-limits');
        if (!container) return;

        const icons = {
            mass: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M6 8h12l-2 13H8L6 8z"/></svg>',
            waste: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
            flux: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            time: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
            cool: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>'
        };

        container.innerHTML = `
            <div class="panel card">
                <div class="panel-header">
                    <h2 class="panel-title">Limit ppm Calculator</h2>
                    <div style="display:flex; gap:0.5rem; margin-right:auto; margin-left:1rem;">
                        <button class="btn-secondary btn-save-preset" data-type="limit" title="Save Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
                        <button class="btn-secondary btn-load-preset" data-type="limit" title="Load Preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg></button>
                    </div>
                    <button class="help-btn" data-help="help-limit">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
                        Reverse Logic
                    </button>
                </div>

                <div id="help-limit" class="help-panel">
                    <div class="help-content">
                        <h4>Purity Requirements</h4>
                        <p>What is the maximum amount of "Element X" allowed in my target to remain compliant? This module solves for concentration (ppm) based on safety limits.</p>
                        <ul>
                            <li><b>Reverse Analysis:</b> Instead of Activity = Flux × Mass, it calculates Mass = Safety Limit / (Flux × Specific Rate).</li>
                            <li><b>Fractions:</b> You can specify what percentage of the total sample activity is attributed to a specific element.</li>
                        </ul>
                    </div>
                </div>

                <div class="form-grid">
                     <div class="form-group"><label>${icons.mass} SAMPLE MASS (g)</label><input type="number" id="lim-mass" value="7.5" class="input-field"></div>
                     <div class="form-group"><label>${icons.waste} WASTE MASS (g)</label><input type="number" id="lim-wmass" value="35000" class="input-field"></div>
                     <div class="form-group"><label>${icons.flux} FLUX (n/cm² · s)</label><input type="text" id="lim-flux" value="2.2e14" class="input-field"></div>
                </div>
                 <div class="form-grid">
                     <div class="form-group"><label>${icons.time} IRRADIATION (days)</label><input type="number" id="lim-time" value="14.0" class="input-field"></div>
                     <div class="form-group"><label>${icons.cool} COOLING (days)</label><input type="number" id="lim-cool" value="365.0" class="input-field"></div>
                </div>
                <!-- Controls for Adding Elements -->
                <div style="margin: 1rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <label style="display:block; margin-bottom: 0.5rem; font-weight: 500;">Add Target Element</label>
                    <div style="display: flex; gap: 0.5rem; align-items: flex-end;">
                         <div style="flex:1">
                            <label style="font-size:0.8em; color:#aaa">Symbol</label>
                            <input type="text" id="lim-sym" placeholder="e.g. Fe" class="input-field" list="elements-list">
                         </div>
                         <div style="width: 100px;">
                            <label style="font-size:0.8em; color:#aaa">Frac %</label>
                            <input type="number" id="lim-frac" placeholder="100" value="100" class="input-field">
                         </div>
                         <div style="width: 100px;">
                            <label style="font-size:0.8em; color:#aaa">Waste %</label>
                            <input type="number" id="lim-waste" placeholder="100" value="100" class="input-field">
                         </div>
                         <button id="btn-add-lim" class="btn-secondary" style="height: 38px;">Add</button>
                    </div>
                </div>

                <!-- The List of Added Elements -->
                <div id="lim-list" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;"></div>

                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Limit Standard</label>
                    <select id="lim-type" class="input-field">
                        <option value="clearance">Clearance (Freigabe)</option>
                        <option value="exemption">Exemption (Befreiung)</option>
                    </select>
                </div>

                <button id="btn-calc-lim" class="btn-primary">Calculate Max ppm</button>
                <div id="lim-results-area" class="results-area" style="margin-top: 2rem;"></div>
            </div>`;
    }

    handleCalculation() {
        if (!this.solver) {
            this.showToast('Engine not ready yet', 'error');
            return;
        }

        const iso = document.getElementById('input-iso').value;
        const mass = parseFloat(document.getElementById('input-mass').value);
        const fluxStr = document.getElementById('input-flux').value;
        const time = parseFloat(document.getElementById('input-time').value);
        const cool = parseFloat(document.getElementById('input-cool').value);

        const flux = parseFloat(fluxStr);
        const tIrrS = time * SECONDS_PER_DAY;
        const tCoolS = cool * SECONDS_PER_DAY;

        this.showToast('Computing...', 'info');

        try {
            const results = this.solver.solve(iso, mass, flux, tIrrS, tCoolS);
            this.renderResults(results, 'results-area');
            this.showToast('Calculation Complete', 'success');
        } catch (e) {
            console.error(e);
            this.showToast('Calculation Error', 'error');
        }
    }

    // --- IMPURITY CALCULATOR ---
    addImpurityItem() {
        const symStart = document.getElementById('imp-sym');
        const ppmStart = document.getElementById('imp-ppm');
        if (!symStart.value || !ppmStart.value) return;

        const list = document.getElementById('impurity-list');
        const item = document.createElement('div');
        item.className = 'impurity-tag';
        item.style.cssText = 'background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px;';
        item.innerHTML = `
            <span class="imp-data" data-sym="${symStart.value}" data-ppm="${ppmStart.value}">${symStart.value}: ${ppmStart.value} ppm</span>
            <button class="btn-remove-item" style="background:none; border:none; color: #ff6b6b; cursor: pointer;">&times;</button>
        `;
        list.appendChild(item);
        symStart.value = '';
        ppmStart.value = '';
    }

    handleImpurityCalculation() {
        if (!this.solver) return this.showToast('Engine Loading...', 'error');

        const mass = parseFloat(document.getElementById('imp-mass').value) || 0;
        const flux = parseFloat(document.getElementById('imp-flux').value) || 0;
        const time = parseFloat(document.getElementById('imp-time').value) || 0;
        const cool = parseFloat(document.getElementById('imp-cool').value) || 0;

        const tIrrS = time * SECONDS_PER_DAY;
        const tCoolS = cool * SECONDS_PER_DAY;

        const items = document.querySelectorAll('#impurity-list .imp-data');
        if (items.length === 0) return this.showToast('Add impurities first', 'warning');

        this.showToast('Calculating...', 'info');

        try {
            let combinedResults = [];
            items.forEach(node => {
                const sym = node.dataset.sym;
                const ppm = parseFloat(node.dataset.ppm);
                const elemMass = (ppm / 1e6) * mass;

                const res = this.solver.solveElement(sym, elemMass, flux, tIrrS, tCoolS);
                combinedResults.push(...res);
            });

            // Merge
            const finalMap = new Map();
            combinedResults.forEach(r => {
                if (!finalMap.has(r.Isotope)) {
                    finalMap.set(r.Isotope, { ...r, Activity: 0, Atoms: 0 });
                }
                const ex = finalMap.get(r.Isotope);
                ex.Activity += r.Activity;
                ex.Atoms += r.Atoms;
            });

            const results = Array.from(finalMap.values()).sort((a, b) => b.Activity - a.Activity);
            this.renderResults(results, 'imp-results-area');
            this.showToast('Impurity Analysis Complete', 'success');

        } catch (e) {
            console.error(e);
            this.showToast('Analysis Error', 'error');
        }
    }

    // --- WASTE CALCULATOR ---
    addWasteItem() {
        const sym = document.getElementById('waste-imp-sym').value;
        const ppm = document.getElementById('waste-imp-ppm').value;
        if (!sym || !ppm) return;
        const list = document.getElementById('waste-imp-list');
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px; margin-right: 4px; margin-bottom: 4px;';
        item.innerHTML = `<span class="waste-data" data-sym="${sym}" data-ppm="${ppm}">${sym}: ${ppm} ppm</span> <button class="btn-remove-item" style="background:none; border:none; color: #ff6b6b; cursor: pointer;">x</button>`;
        list.appendChild(item);
        document.getElementById('waste-imp-sym').value = '';
        document.getElementById('waste-imp-ppm').value = '';
    }

    handleWasteCalculation() {
        if (!this.solver) return;
        const mass = parseFloat(document.getElementById('waste-mass').value) || 0;
        const totalWaste = parseFloat(document.getElementById('waste-total').value) || 0;
        const flux = parseFloat(document.getElementById('waste-flux').value) || 0;
        const time = parseFloat(document.getElementById('waste-time').value) || 0;
        const cool = parseFloat(document.getElementById('waste-cool').value) || 0;

        const tIrrS = time * SECONDS_PER_DAY;
        const tCoolS = cool * SECONDS_PER_DAY;

        // Get Impurities
        const impurities = {};
        document.querySelectorAll('#waste-imp-list .waste-data').forEach(node => {
            const sym = node.dataset.sym;
            const ppm = parseFloat(node.dataset.ppm);
            impurities[sym] = ppm;
        });

        if (Object.keys(impurities).length === 0) return this.showToast('Add impurities first', 'warning');

        this.showToast('Analyzing Batch...', 'info');

        try {
            // Call Engine
            // Assuming "H" as dummy main element or null, using 'exemption' for now based on logic2.py logic for incineration/dumping?
            // "Limit_Incineration_100t_Bq_g" was hinted in logic2.py, but usually we use 'clearance' or 'exemption'.
            // Let's default to 'exemption' as a safer "waste" limit, but ideally UI should allow selection.
            // For now, hardcode 'exemption' to match typical waste compliance checks.
            const limitType = 'exemption';

            const results = this.solver.calculateWasteCompliance(
                impurities, null, mass, flux, tIrrS, tCoolS, totalWaste, limitType
            );

            // Render Results
            let html = `
                <div style="background: ${results.summary.isCompliant ? 'rgba(0,255,150,0.1)' : 'rgba(255,100,100,0.1)'}; 
                            padding: 1.5rem; border-radius: 12px; border: 1px solid ${results.summary.isCompliant ? 'var(--accent-green)' : 'var(--accent-red)'}; 
                            margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin:0; font-size: 1.5rem; color: ${results.summary.isCompliant ? 'var(--accent-green)' : 'var(--accent-red)'};">
                            ${results.summary.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
                        </h3>
                        <p style="margin:0.5rem 0 0 0; color: var(--text-secondary);">Total Fraction: ${results.summary.sumIndex.toFixed(4)}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-size: 0.8rem; text-transform: uppercase;">Clearance Time</span>
                        <span style="font-size: 1.25rem; font-weight: bold; font-family: var(--font-mono); color: var(--text-primary);">
                             ${results.summary.daysToClear > 0 ? results.summary.daysToClear.toFixed(1) + ' days' : (results.summary.isCompliant ? '0 days' : '> 100 Years')}
                        </span>
                    </div>
                </div>

                <table class="data-table" style="width:100%">
                    <thead>
                        <tr>
                            <th>Isotope</th>
                            <th>Total Activity (Bq)</th>
                            <th>Spec. Act (Bq/g)</th>
                            <th>Limit (Bq/g)</th>
                            <th>Fraction</th>
                        </tr>
                    </thead>
                    <tbody>`;

            results.results.forEach(r => {
                html += `
                    <tr>
                        <td>${r.Isotope}</td>
                        <td style="font-family: var(--font-mono);">${r.ActivityTotal.toExponential(2)}</td>
                        <td style="font-family: var(--font-mono);">${r.SpecAct.toExponential(2)}</td>
                        <td style="font-family: var(--font-mono);">${r.Limit.toExponential(2)}</td>
                        <td style="font-weight: bold; color: ${r.Fraction > 1 ? 'var(--accent-red)' : 'var(--text-primary)'};">${r.Fraction.toFixed(4)}</td>
                    </tr>`;
            });

            html += `</tbody></table>
            
            <!-- Charts Section -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                <div class="card" style="padding: 1rem;">
                    <canvas id="waste-pie-chart" style="max-height: 280px;"></canvas>
                </div>
                <div class="card" style="padding: 1rem;">
                    <canvas id="waste-bar-chart" style="max-height: 280px;"></canvas>
                </div>
            </div>`;

            document.getElementById('waste-results-area').innerHTML = html;

            // Render Charts (after DOM update)
            setTimeout(() => {
                // Prepare data for charts
                const chartData = results.results.map(r => ({
                    Isotope: r.Isotope,
                    isotope: r.Isotope,
                    Activity: r.ActivityTotal,
                    fraction: r.Fraction
                }));

                renderActivityPieChart('waste-pie-chart', chartData);
                renderComplianceBarChart('waste-bar-chart', chartData.map(d => ({
                    isotope: d.Isotope,
                    fraction: d.fraction
                })));
            }, 50);

            this.showToast('Analysis Complete', 'success');

        } catch (e) {
            console.error(e);
            this.showToast('Compliance Error', 'error');
        }
    }

    // --- LIMIT CALCULATOR ---
    addLimitItem() {
        const symStart = document.getElementById('lim-sym');
        const fracStart = document.getElementById('lim-frac');
        const wasteStart = document.getElementById('lim-waste');

        const sym = symStart.value.trim();
        if (!sym) return;

        // Defaults
        const frac = parseFloat(fracStart.value) || 100;
        const waste = parseFloat(wasteStart.value) || 100;

        const list = document.getElementById('lim-list');
        const item = document.createElement('div');
        item.className = 'lim-row';
        item.style.cssText = 'background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;';

        item.innerHTML = `
            <div class="lim-data" data-sym="${sym}" data-frac="${frac}" data-waste="${waste}" style="display: flex; gap: 1rem; align-items: center;">
                <span style="font-weight: bold; width: 40px;">${sym}</span>
                <span style="color: #aaa; font-size: 0.9em;">Frac: <span style="color: white">${frac}%</span></span>
                <span style="color: #aaa; font-size: 0.9em;">Waste: <span style="color: white">${waste}%</span></span>
            </div>
            <button class="btn-remove-item" style="background:none; border:none; color: #ff6b6b; cursor: pointer; font-size: 1.2em;">&times;</button>
        `;
        list.appendChild(item);

        // Reset inputs
        symStart.value = '';
        // fracStart.value = '100'; // Keep defaults for rapid entry
        // wasteStart.value = '100';
        symStart.focus();
    }

    handleLimitCalculation() {
        if (!this.solver) return;
        const mass = parseFloat(document.getElementById('lim-mass').value) || 0;
        const wMass = parseFloat(document.getElementById('lim-wmass').value) || 0;
        const flux = parseFloat(document.getElementById('lim-flux').value) || 0;
        const time = parseFloat(document.getElementById('lim-time').value) || 0;
        const cool = parseFloat(document.getElementById('lim-cool').value) || 0;
        const limitType = document.getElementById('lim-type').value;

        const tIrrS = time * SECONDS_PER_DAY;
        const tCoolS = cool * SECONDS_PER_DAY;

        const elements = [];
        const fractions = {};
        const wasteFractions = {};

        document.querySelectorAll('#lim-list .lim-data').forEach(node => {
            const s = node.dataset.sym;
            const f = parseFloat(node.dataset.frac) || 100;
            const w = parseFloat(node.dataset.waste) || 100;
            elements.push(s);
            fractions[s] = f / 100.0; // Convert to decimal
            wasteFractions[s] = w / 100.0; // Convert to decimal
        });

        if (elements.length === 0) return this.showToast('Add target elements first', 'warning');

        this.showToast(`Calculating Limits (${limitType})...`, 'info');

        try {
            const results = this.solver.calculateMaxPPM(
                elements, flux, tIrrS, tCoolS, wMass, mass, limitType, fractions, wasteFractions
            );

            if (!results || results.length === 0) return this.showToast('No active isotopes found', 'warning');

            let html = `
                <div style="overflow-x: auto;">
                <table class="data-table" style="width:100%; font-size: 0.9em;">
                    <thead>
                        <tr>
                            <th>Element</th>
                            <th>Parent Iso</th>
                            <th>Reaction</th>
                            <th>Isotope</th>
                            <th>Iso Max ppm</th>
                            <th>Share %</th>
                            <th>Limit Iso</th>
                            <th>Elem Max ppm</th>
                            <th>Waste %</th>
                            <th>Frac %</th>
                        </tr>
                    </thead>
                    <tbody>`;

            results.forEach(r => {
                const isoPpm = r.IsoMaxPPM > 9.99e9 ? '> 1e10' : r.IsoMaxPPM.toExponential(2);
                const elemPpm = r.ElemMaxPPM === Infinity ? 'Infinite' : (r.ElemMaxPPM > 9.99e9 ? '> 1e10' : r.ElemMaxPPM.toExponential(2));

                html += `
                    <tr>
                        <td style="font-weight: bold; color: var(--accent-cyan);">${r.Element}</td>
                        <td>${r.Parent}</td>
                        <td style="font-size: 0.85em; color: var(--text-muted);">${r.Reaction}</td>
                        <td>${r.Isotope}</td>
                        <td style="font-family: var(--font-mono);">${isoPpm}</td>
                        <td>${r.Share.toFixed(1)}</td>
                        <td>${r.LimitIso}</td>
                        <td style="font-family: var(--font-mono); color: var(--accent-yellow); font-weight: bold;">${elemPpm}</td>
                        <td>${r.WastePct}</td>
                        <td>${r.FracPct}</td>
                    </tr>`;
            });

            html += `</tbody></table></div>`;
            document.getElementById('lim-results-area').innerHTML = html;
            this.showToast('Limits Calculated', 'success');

        } catch (e) {
            console.error(e);
            this.showToast('Limit Calc Error', 'error');
        }
    }

    renderResults(results, targetId = 'results-area') {
        const area = document.getElementById(targetId);
        if (!area) return;

        const total = results.reduce((acc, r) => acc + r.Activity, 0);
        const topIso = results.length > 0 ? results[0] : null;
        const topPct = topIso ? ((topIso.Activity / total) * 100).toFixed(1) : 0;

        // Unique canvas ID based on target
        const pieChartId = `${targetId}-pie-chart`;

        // Store results for PDF export
        this.lastResults = { title: 'Activation_Analysis', results, summary: { TotalActivity: total.toExponential(2) + ' Bq', DominantIsotope: topIso ? topIso.Isotope : '-', PathwaysFound: results.length } };

        let html = `
            <!-- Summary Card -->
            <div style="background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,255,150,0.05)); 
                        padding: 1.5rem; border-radius: 12px; border: 1px solid var(--accent-cyan); 
                        margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">Analysis Results</span>
                    <button id="btn-export-pdf-${targetId}" class="btn-secondary" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.85rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Export PDF
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Total Activity</span>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--accent-green); font-family: var(--font-mono);">
                            ${total.toExponential(2)} Bq
                        </div>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Dominant Isotope</span>
                        <div style="font-size: 1.25rem; font-weight: bold; color: var(--accent-cyan);">
                            ${topIso ? topIso.Isotope : '-'} <span style="font-size: 0.9rem; color: var(--text-secondary);">(${topPct}%)</span>
                        </div>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted);">Pathways Found</span>
                        <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">
                            ${results.length}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Results Grid -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
                <!-- Table -->
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Reaction Pathway</th>
                                <th title="Cross section at thermal neutron energy for the first (n,γ)/(n,p)/(n,α) reaction in the pathway. 1 barn = 10⁻²⁴ cm².">Cross Section (barn)</th>
                                <th>Activity (Bq)</th>
                                <th title="Number of activated atoms after irradiation.">Number of Atoms</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        results.slice(0, 25).forEach(r => {
            const pathway = (r.Pathway || r.Isotope || '').replace(/n,g/g, 'n,γ');
            const xs = r.XS > 0 ? r.XS.toFixed(2) : '-';
            const atoms = r.Atoms ? r.Atoms.toExponential(2) : '-';

            html += `
                <tr>
                    <td style="font-size: 0.9em;">${pathway}</td>
                    <td style="font-family: var(--font-mono);">${xs}</td>
                    <td style="font-family: var(--font-mono);">${r.Activity.toExponential(3)}</td>
                    <td style="font-family: var(--font-mono);">${atoms}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
                <!-- Charts Column -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Pie Chart -->
                    <div class="card" style="padding: 1rem; height: 220px;">
                        <canvas id="${pieChartId}"></canvas>
                    </div>
                    <!-- Decay Chart -->
                    <div class="card" style="padding: 1rem; height: 280px;">
                        <canvas id="${targetId}-decay-chart"></canvas>
                    </div>
                </div>
            </div>
        `;

        area.innerHTML = html;

        // Render charts and setup PDF export button
        setTimeout(() => {
            renderActivityPieChart(pieChartId, results);

            // Render decay chart for top isotope
            if (topIso && this.solver) {
                const lambda = this.solver.lambdaCache.get(topIso.Isotope) || 0;
                if (lambda > 0) {
                    const halfLifeSeconds = Math.log(2) / lambda;
                    // Determine appropriate time range based on half-life
                    const maxDays = Math.min(Math.max(halfLifeSeconds / 86400 * 5, 30), 365 * 10);
                    renderDecayChart(`${targetId}-decay-chart`, topIso.Isotope, topIso.Activity, halfLifeSeconds, maxDays);
                }
            }

            // Setup PDF export button
            const pdfBtn = document.getElementById(`btn-export-pdf-${targetId}`);
            if (pdfBtn) {
                pdfBtn.addEventListener('click', () => {
                    const pdfData = results.map(r => ({
                        Pathway: (r.Pathway || r.Isotope || '').replace(/n,g/g, 'n,γ').substring(0, 40),
                        'Activity (Bq)': r.Activity.toExponential(2),
                        'Cross Section': r.XS > 0 ? r.XS.toFixed(2) : '-',
                        Atoms: r.Atoms ? r.Atoms.toExponential(2) : '-'
                    }));
                    exportToPDF('Activation_Analysis', pdfData, {
                        TotalActivity: total.toExponential(2) + ' Bq',
                        DominantIsotope: topIso ? topIso.Isotope : '-',
                        PathwaysFound: results.length
                    });
                });
            }
        }, 50);
    }

    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Start the Application
document.addEventListener('DOMContentLoaded', () => {
    window.NuclearX = new App();
});
