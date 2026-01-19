/**
 * PDF.js - PDF Export utilities using jsPDF (loaded via CDN)
 * No npm installation required - jsPDF is loaded from CDN in index.html
 */

/**
 * Export results to PDF
 * @param {string} title - Report title
 * @param {Array} results - Array of result objects
 * @param {Object} summary - Optional summary data
 */
export function exportToPDF(title, results, summary = null) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        console.error('jsPDF not loaded');
        alert('PDF Export library not loaded. Please check your internet connection.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Load Logo - path relative to index.html in premium_app/
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous'; // Enable CORS for canvas usage
    logoImg.src = './public/assets/itm_logo_claim_white_rgb_high-res.png';

    logoImg.onload = () => {
        renderPdf(doc, title, results, summary, logoImg);
    };

    logoImg.onerror = () => {
        console.warn('Logo not found at public/assets/..., rendering without logo');
        renderPdf(doc, title, results, summary, null);
    };
}

function renderPdf(doc, title, results, summary, logoImg) {
    // Header background
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, 210, 30, 'F');

    // Logo
    if (logoImg) {
        // Logo normally appears at top left
        const aspect = logoImg.width / logoImg.height;
        const h = 15;
        const w = h * aspect;
        doc.addImage(logoImg, 'PNG', 14, 7, w, h);
    }

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');

    // If logo exists, position title to the right, otherwise left
    const titleX = logoImg ? 200 : 14;
    const align = logoImg ? 'right' : 'left';

    doc.text('Thermal NAA Tool', titleX, 15, { align: align });

    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('ITM Medical Isotopes GmbH', titleX, 22, { align: align });

    // Date (below header)
    doc.setTextColor(100, 100, 100);
    doc.text(new Date().toLocaleString(), 200, 36, { align: 'right' });

    let y = 45;

    // Summary section
    if (summary) {
        doc.setTextColor(0, 51, 102);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 14, y);
        y += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        Object.entries(summary).forEach(([key, value]) => {
            const displayKey = key.replace(/([A-Z])/g, ' $1').trim();
            doc.text(`${displayKey}: ${value}`, 14, y);
            y += 6;
        });
        y += 8;
    }

    // Results table
    if (results && results.length > 0) {
        doc.setTextColor(0, 51, 102);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Results', 14, y);
        y += 8;

        // Custom Columns Layout
        // Page width ~210mm. Margins 14mm. Usable ~182mm.
        // Columns: Pathway (90mm), XS (25mm), Activity (35mm), Atoms (30mm)
        const colDefs = [
            { header: 'Reaction Pathway', key: 'Pathway', x: 14, w: 90 },
            { header: 'Cross Sec.', key: 'Cross Section', x: 104, w: 25, align: 'right' },
            { header: 'Activity (Bq)', key: 'Activity (Bq)', x: 139, w: 35, align: 'right' },
            { header: 'Atoms', key: 'Atoms', x: 184, w: 20, align: 'right' }
        ];

        // Table Header Row
        doc.setFillColor(230, 230, 230);
        doc.rect(14, y - 5, 186, 8, 'F');

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        colDefs.forEach(col => {
            const xPos = col.align === 'right' ? col.x + col.w : col.x;
            doc.text(col.header, xPos, y, { align: col.align || 'left' });
        });
        y += 8;

        // Data Rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        results.slice(0, 50).forEach((row, idx) => {
            if (y > 275) {
                doc.addPage();
                y = 20;
            }

            // Alternate shading
            if (idx % 2 === 0) {
                doc.setFillColor(248, 248, 248);
                doc.rect(14, y - 4, 186, 6, 'F');
            }

            colDefs.forEach(col => {
                let text = String(row[col.key] || '-');

                // Sanitize text for PDF font compatibility
                if (col.key === 'Pathway') {
                    // Replace gamma with 'g' to prevent encoding issues in standard PDF fonts
                    text = text.replace(/γ/g, 'g')
                        .replace(/n,γ/g, 'n,g')
                        .replace(/\u03B3/g, 'g');

                    // Simple truncation if too long
                    if (text.length > 60) text = text.substring(0, 57) + '...';
                }

                const xPos = col.align === 'right' ? col.x + col.w : col.x;
                doc.text(text, xPos, y, { align: col.align || 'left' });
            });
            y += 6;
        });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Powered by ITM Medical Isotopes', 14, 290);
    }

    // Save
    const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
}

/**
 * Create an export button element
 */
export function createExportButton(onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.style.cssText = 'margin-left: auto; display: flex; align-items: center; gap: 6px;';
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Export PDF
    `;
    btn.addEventListener('click', onClick);
    return btn;
}
