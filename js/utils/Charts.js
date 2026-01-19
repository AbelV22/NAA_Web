/**
 * Charts.js - Chart rendering utilities using Chart.js (loaded via CDN)
 * No npm installation required - Chart.js is loaded from CDN in index.html
 */

// Chart instances registry (for cleanup)
const chartInstances = new Map();

/**
 * Destroy existing chart on a canvas before creating a new one
 */
function destroyChart(canvasId) {
    if (chartInstances.has(canvasId)) {
        chartInstances.get(canvasId).destroy();
        chartInstances.delete(canvasId);
    }
}

/**
 * Modern color palette for charts
 */
const CHART_COLORS = [
    'rgba(0, 212, 255, 0.8)',   // Cyan
    'rgba(0, 255, 136, 0.8)',   // Green
    'rgba(255, 107, 107, 0.8)', // Red
    'rgba(255, 193, 7, 0.8)',   // Yellow
    'rgba(156, 39, 176, 0.8)',  // Purple
    'rgba(255, 87, 34, 0.8)',   // Orange
    'rgba(3, 169, 244, 0.8)',   // Light Blue
    'rgba(76, 175, 80, 0.8)',   // Light Green
    'rgba(233, 30, 99, 0.8)',   // Pink
    'rgba(121, 85, 72, 0.8)'    // Brown
];

const CHART_BORDERS = CHART_COLORS.map(c => c.replace('0.8', '1'));

/**
 * Render a pie chart showing isotope contribution to total activity
 */
export function renderActivityPieChart(canvasId, results, maxItems = 8) {
    if (!window.Chart) {
        console.warn('Chart.js not loaded');
        return;
    }

    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Take top N isotopes, group rest as "Other"
    const sorted = [...results].sort((a, b) => b.Activity - a.Activity);
    const top = sorted.slice(0, maxItems);
    const other = sorted.slice(maxItems);

    const totalActivity = results.reduce((sum, r) => sum + r.Activity, 0);

    const labels = top.map(r => r.Isotope || r.isotope);
    const data = top.map(r => r.Activity);

    if (other.length > 0) {
        labels.push('Other');
        data.push(other.reduce((sum, r) => sum + r.Activity, 0));
    }

    const chart = new window.Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: CHART_COLORS.slice(0, labels.length),
                borderColor: CHART_BORDERS.slice(0, labels.length),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#e0e0e0',
                        font: { size: 11 },
                        padding: 10
                    }
                },
                title: {
                    display: true,
                    text: 'Activity Distribution',
                    color: '#00d4ff',
                    font: { size: 14, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const pct = ((ctx.raw / totalActivity) * 100).toFixed(1);
                            return `${ctx.label}: ${ctx.raw.toExponential(2)} Bq (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    chartInstances.set(canvasId, chart);
    return chart;
}

/**
 * Render a bar chart comparing activity vs limit (for waste compliance)
 */
export function renderComplianceBarChart(canvasId, results, maxItems = 10) {
    if (!window.Chart) {
        console.warn('Chart.js not loaded');
        return;
    }

    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Sort by fraction (highest non-compliance risk first)
    const sorted = [...results]
        .filter(r => r.fraction !== undefined && r.fraction > 0)
        .sort((a, b) => b.fraction - a.fraction)
        .slice(0, maxItems);

    if (sorted.length === 0) return;

    const labels = sorted.map(r => r.isotope || r.Isotope);
    const fractions = sorted.map(r => r.fraction * 100); // Show actual % (no cap)

    // Color: green if < 100%, red if >= 100%
    const colors = fractions.map(f => f >= 100
        ? 'rgba(255, 107, 107, 0.8)'
        : 'rgba(0, 255, 136, 0.8)');

    const chart = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '% of Limit',
                data: fractions,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#e0e0e0' },
                    title: {
                        display: true,
                        text: '% of Limit (100% = at limit)',
                        color: '#aaa'
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e0e0e0', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Compliance Status by Isotope',
                    color: '#00d4ff',
                    font: { size: 14, weight: 'bold' }
                },
                annotation: {
                    annotations: {
                        limitLine: {
                            type: 'line',
                            xMin: 100,
                            xMax: 100,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'Limit',
                                position: 'end'
                            }
                        }
                    }
                }
            }
        }
    });

    chartInstances.set(canvasId, chart);
    return chart;
}

/**
 * Render a line chart showing activity decay over time
 */
export function renderDecayChart(canvasId, isotope, initialActivity, halfLifeSeconds, maxDays = 365) {
    if (!window.Chart) {
        console.warn('Chart.js not loaded');
        return;
    }

    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
    gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0.02)');

    const lambda = Math.log(2) / halfLifeSeconds;
    const halfLifeDays = halfLifeSeconds / 86400;
    const points = 60;
    const maxSeconds = maxDays * 86400;

    const timePoints = [];
    const activityPoints = [];

    for (let i = 0; i <= points; i++) {
        const t = (maxSeconds / points) * i;
        const days = t / 86400;
        const activity = initialActivity * Math.exp(-lambda * t);

        timePoints.push(days);
        activityPoints.push(activity);
    }

    // Format half-life for display
    let halfLifeStr;
    if (halfLifeDays < 1) {
        const hours = halfLifeDays * 24;
        halfLifeStr = hours < 1 ? `${(hours * 60).toFixed(1)} min` : `${hours.toFixed(1)} h`;
    } else if (halfLifeDays < 365) {
        halfLifeStr = `${halfLifeDays.toFixed(1)} days`;
    } else {
        halfLifeStr = `${(halfLifeDays / 365).toFixed(1)} years`;
    }

    const chart = new window.Chart(canvas, {
        type: 'line',
        data: {
            labels: timePoints,
            datasets: [{
                label: `${isotope}`,
                data: activityPoints,
                borderColor: 'rgba(0, 212, 255, 1)',
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: '#00d4ff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: {
                        color: 'rgba(255,255,255,0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#888',
                        font: { size: 10 },
                        maxTicksLimit: 8,
                        callback: (val) => val.toFixed(0)
                    },
                    title: {
                        display: true,
                        text: 'Cooling Time (days)',
                        color: '#aaa',
                        font: { size: 11 }
                    }
                },
                y: {
                    type: 'logarithmic',
                    grid: {
                        color: 'rgba(255,255,255,0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#888',
                        font: { size: 10 },
                        maxTicksLimit: 5,
                        callback: (val) => {
                            const exp = Math.log10(val);
                            if (Number.isInteger(exp)) {
                                return `10^${exp}`;
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Activity (Bq)',
                        color: '#aaa',
                        font: { size: 11 }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: [`${isotope} Decay`, `t½ = ${halfLifeStr}`],
                    color: '#00d4ff',
                    font: { size: 12, weight: '600' },
                    padding: { bottom: 10 }
                },
                tooltip: {
                    backgroundColor: 'rgba(20, 30, 50, 0.95)',
                    titleColor: '#00d4ff',
                    bodyColor: '#e0e0e0',
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        title: (items) => `Day ${items[0].parsed.x.toFixed(1)}`,
                        label: (ctx) => `Activity: ${ctx.parsed.y.toExponential(2)} Bq`
                    }
                }
            }
        }
    });

    chartInstances.set(canvasId, chart);
    return chart;
}
