import { AVOGADRO, BARN_TO_CM2, SECONDS_PER_DAY } from '../utils/Constants.js';
import { parseIsotopeClean, getUniqueId } from '../utils/Parser.js';

export class NuclearSolver {
    constructor(dfXs, dfChain, dfLimits) {
        this.xsMap = new Map();
        this.decayMap = new Map();
        this.lambdaCache = new Map();
        this.sigmaRemovalCache = new Map();
        this.elementMap = new Map();
        this.limitsMap = new Map();

        this._buildMaps(dfXs, dfChain);
        this._buildLimits(dfLimits);
    }

    _buildLimits(dfLimits) {
        if (!dfLimits || !Array.isArray(dfLimits)) return;
        dfLimits.forEach(row => {
            const iso = (row.Isotope || row['Nuclide'] || '').toString().trim();
            // Standardize ID format if needed, but the primary key is usually 'Eu-152'
            // Ensure robust key matching
            if (iso) {
                // Ensure we parse exponents correctly if they are strings
                const cleanFloat = (v) => {
                    if (typeof v === 'number') return v;
                    if (!v) return 1e99;
                    return parseFloat(v.replace(',', '.'));
                };

                this.limitsMap.set(iso, {
                    clearance: cleanFloat(row.Limit_Clearance_Bq_g),
                    exemption: cleanFloat(row.Limit_Exemption_Bq_g)
                });
            }
        });
    }

    _setLambda(isoKey, val) {
        try {
            const v = parseFloat(val);
            if (v > 1e-40) {
                this.lambdaCache.set(isoKey, v);
            }
        } catch (e) { }
    }

    _buildMaps(dfXs, dfChain) {
        // Activation
        if (dfXs && dfXs.length > 0) {
            dfXs.forEach(row => {
                const pSym = (row.Symbol || '').toString().trim();
                const pA = parseInt(row.A, 10) || 0;
                const pKey = getUniqueId(pSym, pA, '');

                const daughter = parseIsotopeClean((row.Daughter_Isotope || '').toString());
                const dKey = getUniqueId(daughter.symbol, daughter.massNumber, daughter.metastable);

                // Store Abundance for Element lookup
                let theta = parseFloat(row.Abundance);
                if (!isNaN(theta) && theta > 0) {
                    if (!this.elementMap.has(pSym)) this.elementMap.set(pSym, []);
                    const list = this.elementMap.get(pSym);
                    // Avoid duplicates if multiple reactions exist for same parent
                    if (!list.some(x => x.A === pA)) {
                        list.push({ A: pA, theta: theta });
                    }
                }

                if (row.Decay_Constant_Lambda) this._setLambda(dKey, row.Decay_Constant_Lambda);

                const sigma = parseFloat(row.Max_XS) || 0;
                if (sigma > 0) {
                    if (!this.xsMap.has(pKey)) this.xsMap.set(pKey, []);
                    this.xsMap.get(pKey).push({ child: dKey, sigma: sigma, type: row.Reaction || 'n,γ' });

                    const current = this.sigmaRemovalCache.get(pKey) || 0;
                    this.sigmaRemovalCache.set(pKey, current + sigma);
                }
            });
        }

        // Decay
        if (dfChain && dfChain.length > 0) {
            dfChain.forEach(row => {
                const parent = parseIsotopeClean((row.Padre_Isotopo || '').toString());
                const pKey = getUniqueId(parent.symbol, parent.massNumber, parent.metastable);

                const child = parseIsotopeClean((row.Hijo_Isotopo || '').toString());
                const hKey = getUniqueId(child.symbol, child.massNumber, child.metastable);

                if (row.Hijo_Lambda) this._setLambda(hKey, row.Hijo_Lambda);
                if (row.Padre_Lambda) this._setLambda(pKey, row.Padre_Lambda);

                const br = parseFloat(row.Branching_Ratio) || 0;
                if (br > 0) {
                    if (!this.decayMap.has(pKey)) this.decayMap.set(pKey, []);
                    this.decayMap.get(pKey).push({ child: hKey, br: br, type: 'decay' });
                }
            });
        }
    }

    /**
     * Solve for a generic Element (natural abundance)
     * @param {boolean} merge If true (default), sums activity of identical isotopes from different parents.
     */
    solveElement(elementSymbol, totalMassG, flux, tIrrS, tCoolS, merge = true) {
        const parents = this.elementMap.get(elementSymbol) || [];
        if (parents.length === 0) return [];

        let aggregatedResults = [];

        parents.forEach(p => {
            const massIso = totalMassG * p.theta; // Mass of this specific isotope
            const pKey = getUniqueId(elementSymbol, p.A, '');
            // Solve for this parent
            // Force abundance=1.0 because we already scaled the mass
            const res = this.solve(pKey, massIso, flux, tIrrS, tCoolS, 1.0);

            // Tag results with the parent isotope for traceability
            const parentLabel = `${elementSymbol}-${p.A}`;
            res.forEach(r => r.Parent = parentLabel);

            aggregatedResults.push(...res);
        });

        if (!merge) {
            // Return raw list, but sort by activity
            return aggregatedResults.sort((a, b) => b.Activity - a.Activity);
        }

        // Merge identical isotopes
        const merged = new Map();
        aggregatedResults.forEach(r => {
            if (!merged.has(r.Isotope)) {
                merged.set(r.Isotope, { ...r, Activity: 0, Atoms: 0 });
            }
            const exist = merged.get(r.Isotope);
            exist.Activity += r.Activity;
            exist.Atoms += r.Atoms;
            // Note: Parent info is lost in merge, which is fine for totals
        });

        return Array.from(merged.values()).sort((a, b) => b.Activity - a.Activity);
    }

    getLimit(isotope, type = 'exemption') {
        const lim = this.limitsMap.get(isotope);
        if (!lim) return 1e99; // Default high limit if not found (or return null?)
        return (type === 'clearance') ? lim.clearance : lim.exemption;
    }

    getRemovalRate(isoKey, flux) {
        const lam = this.lambdaCache.get(isoKey) || 0;
        const sig = this.sigmaRemovalCache.get(isoKey) || 0;
        return lam + (sig * BARN_TO_CM2 * flux);
    }

    solve(parentIso, massG, flux, tIrrS, tCoolS, abundance = 1.0, maxDepth = 6) {
        // Phase 1: Irradiation
        const phase1Results = this._coreBatemanStep(
            parentIso, massG, flux, tIrrS, abundance, maxDepth, ''
        );

        if (tCoolS <= 0) return this._formatResults(phase1Results);

        // Phase 2: Cooling
        const finalResults = [];
        phase1Results.forEach(res => {
            if (res.finalAtoms < 1e-20) return;
            // Mass number approx for intermediate mass
            const match = res.finalIso.match(/(\d+)/);
            const aVal = match ? parseFloat(match[1]) : 0;
            const massInput = (res.finalAtoms * aVal) / AVOGADRO;

            const coolingStep = this._coreBatemanStep(
                res.finalIso, massInput, 0.0, tCoolS, 1.0, maxDepth, res.pathStr
            );
            finalResults.push(...coolingStep);
        });

        return this._formatResults(finalResults);
    }

    _coreBatemanStep(parentIso, startMassG, flux, timeS, abundance, maxDepth, pathPrefix) {
        const parent = parseIsotopeClean(parentIso);
        if (!parent.symbol) return [];

        const startNode = getUniqueId(parent.symbol, parent.massNumber, parent.metastable);
        const mMol = parseFloat(parent.massNumber) || 1;
        const n0 = (startMassG * abundance * AVOGADRO) / mMol;

        const allPaths = [[{ iso: startNode, k: 0, xs: 0, type: 'Start' }]];
        const stack = [[startNode, [{ iso: startNode, k: 0, xs: 0, type: 'Start' }], 0]];

        while (stack.length > 0) {
            const [currIso, currPath, depth] = stack.pop();
            if (depth >= maxDepth) continue;

            if (flux > 0 && this.xsMap.has(currIso)) {
                this.xsMap.get(currIso).forEach(rx => {
                    if (currPath.some(s => s.iso === rx.child)) return;
                    const k = rx.sigma * BARN_TO_CM2 * flux;
                    const newPath = [...currPath, { iso: rx.child, k: k, xs: rx.sigma, type: rx.type }];
                    allPaths.push(newPath);
                    stack.push([rx.child, newPath, depth + 1]);
                });
            }

            if (this.decayMap.has(currIso)) {
                const lamP = this.lambdaCache.get(currIso) || 0;
                if (lamP > 0) {
                    this.decayMap.get(currIso).forEach(dec => {
                        if (currPath.some(s => s.iso === dec.child)) return;
                        const k = lamP * dec.br;
                        const newPath = [...currPath, { iso: dec.child, k: k, xs: 0, type: 'Decay' }];
                        allPaths.push(newPath);
                        stack.push([dec.child, newPath, depth + 1]);
                    });
                }
            }
        }

        const rawResults = [];
        allPaths.forEach(path => {
            const isos = path.map(s => s.iso);
            const lambdas = isos.map(i => this.getRemovalRate(i, flux));
            const ks = path.slice(1).map(s => s.k);
            const n = isos.length;
            let atomsEnd = 0;

            for (let i = 0; i < lambdas.length; i++) {
                for (let j = i + 1; j < lambdas.length; j++) {
                    if (Math.abs(lambdas[i] - lambdas[j]) < 1e-12) lambdas[j] += 1e-13;
                }
            }

            const prodK = ks.reduce((a, b) => a * b, 1);
            if (prodK > 0) {
                for (let i = 0; i < n; i++) {
                    let denom = 1.0;
                    for (let j = 0; j < n; j++) {
                        if (i !== j) denom *= (lambdas[j] - lambdas[i]);
                    }
                    if (Math.abs(denom) < 1e-50) denom = 1e-50;
                    atomsEnd += Math.exp(-lambdas[i] * timeS) / denom;
                }
                atomsEnd *= n0 * prodK;
            }

            if (atomsEnd < 1e-25) return;

            let currentPathStr = '';
            let primaryXs = 0;
            let contrib = 'Secondary';
            let foundFirstActivation = false;

            path.slice(1).forEach((step, idx) => {
                const t = step.type;
                if (t === 'Decay') {
                    currentPathStr += ` → ${step.iso}`;
                } else {
                    currentPathStr += ` (${t}) ${step.iso}`;
                    // Capture the XS of the FIRST activation reaction
                    if (!foundFirstActivation) {
                        primaryXs = step.xs || 0;
                        foundFirstActivation = true;
                        contrib = 'Direct';
                    }
                }
            });

            rawResults.push({
                finalIso: isos[n - 1],
                finalAtoms: atomsEnd,
                pathStr: pathPrefix ? pathPrefix + currentPathStr : isos[0] + currentPathStr,
                primaryXs: primaryXs,
                contrib: contrib,
                lamFinal: this.lambdaCache.get(isos[n - 1]) || 0
            });
        });

        return rawResults;
    }

    _formatResults(rawData) {
        // Return detailed results preserving pathway information
        // Sorted by activity descending
        const detail = rawData
            .map(item => ({
                Isotope: item.finalIso,
                Activity: item.finalAtoms * item.lamFinal,
                Atoms: item.finalAtoms,
                XS: item.primaryXs,
                Pathway: item.pathStr,
                Contribution: item.contrib
            }))
            .filter(d => d.Activity > 1e-20) // Filter negligible activities
            .sort((a, b) => b.Activity - a.Activity);

        return detail;
    }
    // =========================================================================
    // WASTE COMPLIANCE
    // =========================================================================

    /**
     * Calculates compliance against Exemption or Clearance limits.
     * @param {Object} impurities Map of { Symbol: ppm }
     * @param {string|null} mainElement Symbol of main element (optional)
     * @param {number} mainMassG Mass of the main element/sample
     * @param {number} flux Neutron flux
     * @param {number} timeS Irradiation time in seconds
     * @param {number} coolS Cooling time in seconds
     * @param {number} wasteMassG Total mass of the waste container
     * @param {string} limitType 'clearance' or 'exemption'
     */
    calculateWasteCompliance(impurities, mainElement, mainMassG, flux, timeS, coolS, wasteMassG, limitType = 'clearance') {
        const inventoryTotal = new Map();

        // 1. Prepare list of elements to simulate
        const elementsToSim = { ...impurities };
        if (mainElement) {
            // Treat main element as 1,000,000 ppm (pure)
            elementsToSim[mainElement] = 1000000.0;
        }

        // 2. Iterate and Solve
        Object.entries(elementsToSim).forEach(([sym, ppm]) => {
            const symClean = (sym || '').toString().trim();
            if (!symClean) return;

            // Calculate active mass of this element in the sample
            // If it's the main element, we take the full mass (or adjusted by purity if we wanted to be strict)
            // Logic form python: if main_elem, mass is mainMassG. Else ppm calculation.
            let massInput = 0;
            if (mainElement && symClean.toLowerCase() === mainElement.toLowerCase()) {
                massInput = mainMassG;
            } else {
                massInput = (ppm * mainMassG) / 1e6;
            }

            if (massInput <= 0) return;

            // Solve for this element
            // We use solveElement because it handles natural abundance of all parents for us
            const resList = this.solveElement(symClean, massInput, flux, timeS, coolS);

            resList.forEach(res => {
                const current = inventoryTotal.get(res.Isotope) || 0;
                inventoryTotal.set(res.Isotope, current + res.Activity);
            });
        });

        // 3. Compare Results against Limits
        const results = [];
        let sumFractions = 0.0;
        let dominantIsotope = null;
        let maxFraction = -1;

        inventoryTotal.forEach((totalBq, iso) => {
            const limit = this.getLimit(iso, limitType);

            // Skip if no limit or negligible activity
            if (limit >= 1e90 || totalBq < 1e-20) return;

            const specAct = (wasteMassG > 0) ? (totalBq / wasteMassG) : 0;
            const fraction = (limit > 0) ? (specAct / limit) : 0;

            sumFractions += fraction;
            // Identify dominant isotope for clearance time calculation
            if (fraction > maxFraction) {
                maxFraction = fraction;
                dominantIsotope = iso;
            }

            results.push({
                Isotope: iso,
                ActivityTotal: totalBq,
                SpecAct: specAct,
                Limit: limit,
                Fraction: fraction
            });
        });

        // Sort by fraction descending
        results.sort((a, b) => b.Fraction - a.Fraction);

        // 4. Calculate Compliance & Clearance Time
        const isCompliant = sumFractions <= 1.0;
        let daysToClear = 0;

        if (!isCompliant && dominantIsotope) {
            const lam = this.lambdaCache.get(dominantIsotope) || 0;
            if (lam > 0) {
                // T = -ln(1 / Sum) / lambda
                // If Sum > 1, we need to decay until Sum' <= 1
                // Assuming roughly that all decay with the dominant half-life (standard conservative approx)
                try {
                    const tSec = -Math.log(1.0 / sumFractions) / lam;
                    daysToClear = tSec / SECONDS_PER_DAY;
                } catch (e) {
                    daysToClear = -1; // Infinite/Error
                }
            } else {
                daysToClear = -1; // Infinite (stable/long-lived)
            }
        }

        return {
            results,
            summary: {
                sumIndex: sumFractions,
                isCompliant,
                daysToClear, // -1 means "infinite" or > 100 years
                totalActivity: inventoryTotal
            }
        };
    }

    // =========================================================================
    // MAX PPM (REVERSE LIMITS)
    // =========================================================================

    /**
     * Calculates the maximum allowed PPM for a list of elements.
     */
    /**
     * Calculates the maximum allowed PPM for a list of elements.
     * @param {string[]} elementsList List of element symbols
     * @param {number} flux
     * @param {number} timeS
     * @param {number} coolS
     * @param {number} wasteMassG
     * @param {number} sampleMassG
     * @param {string} limitType 'clearance' or 'exemption'
     * @param {Object} fractions Map { Symbol: FractionDecimal } (default 1.0)
     * @param {Object} wasteFractions Map { Symbol: WasteFractionDecimal } (default 1.0)
     */
    calculateMaxPPM(elementsList, flux, timeS, coolS, wasteMassG, sampleMassG, limitType = 'clearance', fractions = {}, wasteFractions = {}) {
        const rows = [];
        const uniqueElements = [...new Set(elementsList.map(e => (e || '').toString().trim()).filter(x => x))];

        uniqueElements.forEach(elemSym => {
            // Get user params for this element
            const f_elem = fractions[elemSym] !== undefined ? fractions[elemSym] : 1.0;
            const f_waste = wasteFractions[elemSym] !== undefined ? wasteFractions[elemSym] : 1.0;

            // 1. Solve for 1 gram of this element, WITHOUT MERGING parents
            const solutions = this.solveElement(elemSym, 1.0, flux, timeS, coolS, false);

            if (!solutions || solutions.length === 0) return;

            // 2. Calculate F_d0 for each isotope and total
            let sumFd0 = 0.0;
            const contribs = [];

            solutions.forEach(res => {
                const limit = this.getLimit(res.Isotope, limitType);
                if (limit >= 1e90 || res.Activity < 1e-20) return;

                // F_d0 = Specific Activity (Bq/g_element) / Limit
                const F_d0 = res.Activity / limit;
                sumFd0 += F_d0;

                contribs.push({
                    isotope: res.Isotope,
                    parent: res.Parent,
                    path: res.Pathway,
                    activity: res.Activity,
                    limit: limit,
                    fd0: F_d0
                });
            });

            if (sumFd0 <= 1e-30) return;

            // 3. Calculate Element-level stats
            // Formula: Element Limit (g_elem/g_sample) = (Limit_Total / Activity_Total) ???
            // Python Logic: elem_ppm_max = (1e6 * total_waste_mass) / (total_sample_mass * f_waste * S_E0)
            // S_E0 = sum(SpecificActivity_i / Limit_i) = sumFd0

            let elemMaxPPM = Infinity;
            if (sampleMassG > 0 && f_waste > 1e-9 && sumFd0 > 1e-30) {
                elemMaxPPM = (1e6 * wasteMassG) / (sampleMassG * f_waste * sumFd0);
            }

            // Find Dominant Isotope (Limit Iso)
            const isoSums = new Map();
            contribs.forEach(c => {
                isoSums.set(c.isotope, (isoSums.get(c.isotope) || 0) + c.fd0);
            });
            let limitIso = '';
            let maxIsoSum = -1;
            isoSums.forEach((v, k) => {
                if (v > maxIsoSum) { maxIsoSum = v; limitIso = k; }
            });

            // 4. Generate Rows
            contribs.forEach(c => {
                const share = (c.fd0 / sumFd0) * 100;

                // Isotope Max PPM (Theoretical constraint if this was the only isotope)
                // In Python: iso_ppm_by_abund = (d['Abundance (0-1)'] * elem_ppm_max) ... wait, that looks like "PPM contribution"? 
                // Actually Python logic:
                // iso_ppm_by_abund = (d['Abundance (0-1)'] * elem_ppm_max)
                // This seems like what proportion of the PPM is that isotope? 
                // Let's stick to standard interpretation: Max PPM if constrained by this single pathway?
                // Python: geomFactor / c.fd0
                // Let's use: (1e6 * wasteMassG) / (sampleMassG * f_waste * c.fd0) to be consistent

                let isoMaxPPM = Infinity;
                if (sampleMassG > 0 && f_waste > 1e-9 && c.fd0 > 1e-30) {
                    isoMaxPPM = (1e6 * wasteMassG) / (sampleMassG * f_waste * c.fd0);
                }

                // Only include significant contributors (> 0.001%)
                if (share < 0.001) return;

                rows.push({
                    Element: elemSym,
                    Parent: c.parent || elemSym,
                    Reaction: c.path || '',
                    Isotope: c.isotope,
                    IsoMaxPPM: isoMaxPPM,
                    Share: share,
                    LimitIso: limitIso,
                    LimitVal: c.limit,
                    ElemMaxPPM: elemMaxPPM,
                    WastePct: Math.round(f_waste * 100),
                    FracPct: Math.round(f_elem * 100)
                });
            });
        });

        // Sort by Element, then by Share descending
        rows.sort((a, b) => {
            if (a.Element === b.Element) return b.Share - a.Share;
            return a.Element.localeCompare(b.Element);
        });

        return rows;
    }
}
