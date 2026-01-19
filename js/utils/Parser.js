export function parseIsotopeClean(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') {
        return { symbol: null, massNumber: null, metastable: '' };
    }
    const clean = isoStr.trim();
    // Regex 1: Letters-Numbers-Meta
    const m1 = clean.match(/^([A-Za-z]+)[-_]?(\d+)([m\d]*)$/);
    if (m1) {
        return {
            symbol: m1[1].charAt(0).toUpperCase() + m1[1].slice(1).toLowerCase(),
            massNumber: parseInt(m1[2], 10),
            metastable: m1[3] || ''
        };
    }
    // Regex 2: Numbers-Letters
    const m2 = clean.match(/^(\d+)([m]?)[-_]?([A-Za-z]+)$/);
    if (m2) {
        return {
            symbol: m2[3].charAt(0).toUpperCase() + m2[3].slice(1).toLowerCase(),
            massNumber: parseInt(m2[1], 10),
            metastable: m2[2] || ''
        };
    }
    return { symbol: null, massNumber: null, metastable: '' };
}

export function getUniqueId(symbol, massNumber, metastable) {
    if (!symbol) return 'UNKNOWN';
    return `${symbol}-${massNumber}${metastable || ''}`;
}

export function formatScientific(value, precision = 2) {
    if (value === 0) return '0';
    if (!isFinite(value)) return 'inf';
    if (Math.abs(value) < 1e-20) return '0';
    return value.toExponential(precision);
}

export function parseScientific(str) {
    if (!str || typeof str !== 'string') return 0;
    const cleaned = str.trim().toLowerCase();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}
