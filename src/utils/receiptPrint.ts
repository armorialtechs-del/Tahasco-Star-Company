import type { CompanySettings, Sale } from '../types/erp';
import { formatCurrency } from './erpLogic';

const PRINT_PAGE_STYLE_ID = 'tahasco-print-page-style';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toPdfAscii(value: string): string {
  return value
    .replaceAll('₵', 'GHS ')
    .replaceAll('·', '-')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('’', "'")
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function escapePdfString(value: string): string {
  return toPdfAscii(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = toPdfAscii(text).trim();
  if (!clean) return [''];
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function syncPrintPageStyle(paperFormat: 'a4' | 'thermal'): void {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById(PRINT_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = PRINT_PAGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent =
    paperFormat === 'thermal'
      ? `@page { size: 80mm auto; margin: 3mm; }`
      : `@page { size: A4; margin: 14mm; }`;
}

export function clearPrintPageStyle(): void {
  if (typeof document === 'undefined') return;
  const styleEl = document.getElementById(PRINT_PAGE_STYLE_ID);
  if (styleEl) styleEl.remove();
}

export interface DirectPrintResult {
  printed: boolean;
  blockedByIframe: boolean;
}

/**
 * Triggers native browser printing synchronously inside a user click gesture.
 * Never uses setTimeout or tiny hidden iframes so user activation is preserved.
 */
export function triggerDirectWindowPrint(paperFormat: 'a4' | 'thermal'): DirectPrintResult {
  syncPrintPageStyle(paperFormat);

  let beforePrintFired = false;
  const onBeforePrint = () => {
    beforePrintFired = true;
  };
  window.addEventListener('beforeprint', onBeforePrint);

  const startedAt = performance.now();
  try {
    window.print();
  } catch {
    window.removeEventListener('beforeprint', onBeforePrint);
    return { printed: false, blockedByIframe: true };
  }
  window.removeEventListener('beforeprint', onBeforePrint);

  const elapsed = performance.now() - startedAt;
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Inside sandboxed iframes without allow-modals, Chrome returns instantaneously from window.print()
  // without dispatching beforeprint.
  if (!beforePrintFired && elapsed < 25 && isInIframe) {
    return { printed: false, blockedByIframe: true };
  }

  return { printed: true, blockedByIframe: false };
}

export function buildPrintableReceiptHtml(
  sale: Sale,
  settings: CompanySettings,
  paperFormat: 'a4' | 'thermal',
): string {
  const currency = settings.currency || 'GHS';
  const isThermal = paperFormat === 'thermal';
  const logoMarkup = settings.logoDataUrl
    ? `<img src="${escapeHtml(settings.logoDataUrl)}" alt="${escapeHtml(settings.companyName)}" style="width:${isThermal ? '34px' : '48px'};height:${isThermal ? '34px' : '48px'};object-fit:contain;margin:0 auto 8px;display:block;" />`
    : `<div style="width:${isThermal ? '32px' : '42px'};height:${isThermal ? '32px' : '42px'};border-radius:8px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <svg viewBox="0 0 32 32" width="${isThermal ? '18' : '22'}" height="${isThermal ? '18' : '22'}" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 3L19.6 11.4L28.5 12.2L21.8 18.1L23.8 26.8L16 22.2L8.2 26.8L10.2 18.1L3.5 12.2L12.4 11.4L16 3Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="16" cy="16" r="2.2" fill="white"/>
        </svg>
      </div>`;

  const itemsRows = sale.items
    .map(
      (item) => `
      <tr>
        <td style="padding:6px 4px 6px 0;vertical-align:top;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(item.productName)}</div>
          <div style="font-size:${isThermal ? '10px' : '11px'};color:#64748b;font-family:monospace;">${escapeHtml(item.sku)}</div>
        </td>
        <td style="padding:6px 4px;text-align:right;font-family:monospace;vertical-align:top;">${item.quantity}</td>
        <td style="padding:6px 4px;text-align:right;font-family:monospace;vertical-align:top;">${item.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 0 6px 4px;text-align:right;font-family:monospace;font-weight:600;vertical-align:top;">${item.lineTotal.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${escapeHtml(sale.receiptNumber)} — ${escapeHtml(settings.companyName)}</title>
  <style>
    @page {
      size: ${isThermal ? '80mm auto' : 'A4'};
      margin: ${isThermal ? '3mm' : '14mm'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: ${isThermal ? '0' : '16px'};
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: ${isThermal ? '11px' : '13px'};
      line-height: 1.45;
    }
    .receipt {
      width: ${isThermal ? '74mm' : '100%'};
      max-width: ${isThermal ? '74mm' : '640px'};
      margin: 0 auto;
    }
    .section-divider {
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 3px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-variant-numeric: tabular-nums;
    }
    .toolbar {
      max-width: 640px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: flex-end;
    }
    .print-btn {
      padding: 8px 16px;
      background: #0f172a;
      color: #ffffff;
      border: 0;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="print-btn" onclick="window.print()">Print Receipt</button>
  </div>
  <div class="receipt">
    <div class="section-divider" style="text-align:center;">
      ${logoMarkup}
      <div style="font-weight:800;font-size:${isThermal ? '14px' : '20px'};letter-spacing:-0.01em;">${escapeHtml(settings.companyName)}</div>
      <div style="font-size:${isThermal ? '10px' : '12px'};color:#475569;margin-top:2px;">${escapeHtml(settings.address)}</div>
      <div style="font-size:${isThermal ? '10px' : '12px'};color:#475569;">Tel: ${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}</div>
    </div>

    <div class="section-divider" style="font-size:${isThermal ? '10.5px' : '12px'};">
      <div class="row"><span style="color:#64748b;">Receipt No:</span><span class="mono" style="font-weight:700;">${escapeHtml(sale.receiptNumber)}</span></div>
      <div class="row"><span style="color:#64748b;">Date &amp; Time:</span><span class="mono">${escapeHtml(new Date(sale.createdAt).toLocaleString())}</span></div>
      <div class="row"><span style="color:#64748b;">Cashier:</span><span style="font-weight:600;">${escapeHtml(sale.cashierName)}</span></div>
      ${sale.customerName ? `<div class="row"><span style="color:#64748b;">Customer:</span><span>${escapeHtml(sale.customerName)}</span></div>` : ''}
      ${sale.customerPhone ? `<div class="row"><span style="color:#64748b;">Customer Phone:</span><span class="mono">${escapeHtml(sale.customerPhone)}</span></div>` : ''}
    </div>

    <div class="section-divider">
      <table style="width:100%;border-collapse:collapse;text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid #cbd5e1;font-size:${isThermal ? '10px' : '11.5px'};color:#64748b;">
            <th style="padding:4px 4px 6px 0;">Item</th>
            <th style="padding:4px 4px 6px;text-align:right;">Qty</th>
            <th style="padding:4px 4px 6px;text-align:right;">Price</th>
            <th style="padding:4px 0 6px 4px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody style="font-size:${isThermal ? '10.5px' : '12px'};">
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <div class="section-divider" style="font-size:${isThermal ? '11px' : '12.5px'};">
      <div class="row"><span style="color:#475569;">Subtotal</span><span class="mono" style="font-weight:600;">${escapeHtml(formatCurrency(sale.subtotal, currency))}</span></div>
      ${sale.discountAmount > 0 ? `<div class="row" style="color:#047857;"><span>Discount</span><span class="mono">-${escapeHtml(formatCurrency(sale.discountAmount, currency))}</span></div>` : ''}
      <div class="row" style="padding-top:6px;margin-top:6px;border-top:1px solid #cbd5e1;font-weight:800;font-size:${isThermal ? '13px' : '15px'};">
        <span>Total Paid</span>
        <span class="mono">${escapeHtml(formatCurrency(sale.totalAmount, currency))}</span>
      </div>
      <div class="row" style="margin-top:6px;"><span style="color:#475569;">Payment Method</span><span style="font-weight:600;">${escapeHtml(sale.paymentMethod)}</span></div>
      <div class="row"><span style="color:#475569;">Amount Tendered</span><span class="mono">${escapeHtml(formatCurrency(sale.amountPaid, currency))}</span></div>
      <div class="row">
        <span style="color:#475569;">${sale.balanceDue > 0 ? 'Balance Due' : 'Change Given'}</span>
        <span class="mono" style="font-weight:600;">${escapeHtml(formatCurrency(sale.balanceDue > 0 ? sale.balanceDue : sale.changeGiven, currency))}</span>
      </div>
    </div>

    <div style="text-align:center;font-size:${isThermal ? '10px' : '12px'};color:#475569;">
      <p style="margin:0 0 4px;font-weight:600;color:#1e293b;">${escapeHtml(settings.receiptFooter)}</p>
      <p style="margin:0;font-size:10px;color:#94a3b8;">Official Sales Receipt · ${escapeHtml(settings.companyName)}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates a self-contained single-page vector PDF (%PDF-1.4) for any receipt
 * in either A4 (595x842 pt) or 80mm thermal (227 pt wide) format.
 */
export function buildReceiptPdfBytes(
  sale: Sale,
  settings: CompanySettings,
  paperFormat: 'a4' | 'thermal',
): Uint8Array {
  const isThermal = paperFormat === 'thermal';
  const currency = settings.currency || 'GHS';
  const pageWidth = isThermal ? 226.77 : 595.28;
  const marginX = isThermal ? 12 : 52;
  const contentWidth = pageWidth - marginX * 2;

  const commands: string[] = [];
  let cursorOffsetFromTop = isThermal ? 20 : 48;

  // Compute thermal height dynamically so long receipts never clip
  const estimatedLines =
    18 +
    sale.items.length * 2 +
    (sale.customerName ? 1 : 0) +
    (sale.customerPhone ? 1 : 0) +
    (sale.discountAmount > 0 ? 1 : 0);
  const pageHeight = isThermal ? Math.max(360, estimatedLines * 14 + 90) : 841.89;

  const toY = (topOffset: number) => (pageHeight - topOffset).toFixed(2);

  const drawText = (
    text: string,
    x: number,
    topOffset: number,
    font: 'F1' | 'F2' | 'F3',
    size: number,
    rgb: [number, number, number] = [0.06, 0.09, 0.16],
  ) => {
    commands.push(
      `BT /${font} ${size} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x.toFixed(2)} ${toY(topOffset)} Td (${escapePdfString(text)}) Tj ET`,
    );
  };

  const drawCenteredText = (
    text: string,
    topOffset: number,
    font: 'F1' | 'F2' | 'F3',
    size: number,
    rgb: [number, number, number] = [0.06, 0.09, 0.16],
  ) => {
    const clean = toPdfAscii(text);
    const charWidth = font === 'F3' ? size * 0.6 : size * 0.5;
    const estWidth = clean.length * charWidth;
    const x = Math.max(marginX, (pageWidth - estWidth) / 2);
    drawText(clean, x, topOffset, font, size, rgb);
  };

  const drawRightText = (
    text: string,
    rightX: number,
    topOffset: number,
    font: 'F1' | 'F2' | 'F3',
    size: number,
    rgb: [number, number, number] = [0.06, 0.09, 0.16],
  ) => {
    const clean = toPdfAscii(text);
    const charWidth = font === 'F3' ? size * 0.6 : size * 0.52;
    const estWidth = clean.length * charWidth;
    const x = Math.max(marginX, rightX - estWidth);
    drawText(clean, x, topOffset, font, size, rgb);
  };

  const drawDashedRule = (topOffset: number) => {
    commands.push(
      `q 0.8 0.84 0.88 RG 0.7 w [3 3] 0 d ${marginX.toFixed(2)} ${toY(topOffset)} m ${(pageWidth - marginX).toFixed(2)} ${toY(topOffset)} l S Q`,
    );
  };

  const drawSolidRule = (topOffset: number) => {
    commands.push(
      `q 0.8 0.84 0.88 RG 0.7 w ${marginX.toFixed(2)} ${toY(topOffset)} m ${(pageWidth - marginX).toFixed(2)} ${toY(topOffset)} l S Q`,
    );
  };

  // Header
  const headerSize = isThermal ? 11 : 16;
  const subSize = isThermal ? 7.5 : 9.5;
  const bodySize = isThermal ? 8 : 10;
  const lineStep = isThermal ? 12 : 16;

  drawCenteredText(settings.companyName, cursorOffsetFromTop, 'F2', headerSize);
  cursorOffsetFromTop += lineStep;
  for (const addrLine of wrapText(settings.address, isThermal ? 36 : 70)) {
    drawCenteredText(addrLine, cursorOffsetFromTop, 'F1', subSize, [0.28, 0.33, 0.41]);
    cursorOffsetFromTop += lineStep - 3;
  }
  drawCenteredText(
    `Tel: ${settings.phone} - ${settings.email}`,
    cursorOffsetFromTop,
    'F1',
    subSize,
    [0.28, 0.33, 0.41],
  );
  cursorOffsetFromTop += 10;
  drawDashedRule(cursorOffsetFromTop);
  cursorOffsetFromTop += lineStep;

  // Meta rows
  const drawKeyVal = (label: string, val: string, valFont: 'F1' | 'F2' | 'F3' = 'F1', size = bodySize) => {
    drawText(label, marginX, cursorOffsetFromTop, 'F1', size, [0.39, 0.45, 0.54]);
    drawRightText(val, pageWidth - marginX, cursorOffsetFromTop, valFont, size);
    cursorOffsetFromTop += lineStep - 1;
  };

  drawKeyVal('Receipt No:', sale.receiptNumber, 'F3');
  drawKeyVal('Date & Time:', new Date(sale.createdAt).toLocaleString(), 'F3');
  drawKeyVal('Cashier:', sale.cashierName, 'F2');
  if (sale.customerName) drawKeyVal('Customer:', sale.customerName, 'F1');
  if (sale.customerPhone) drawKeyVal('Customer Phone:', sale.customerPhone, 'F3');

  cursorOffsetFromTop += 2;
  drawDashedRule(cursorOffsetFromTop);
  cursorOffsetFromTop += lineStep;

  // Table Header
  const qtyColRight = pageWidth - marginX - (isThermal ? 78 : 150);
  const priceColRight = pageWidth - marginX - (isThermal ? 40 : 75);
  const totalColRight = pageWidth - marginX;

  drawText('Item', marginX, cursorOffsetFromTop, 'F2', subSize, [0.39, 0.45, 0.54]);
  drawRightText('Qty', qtyColRight, cursorOffsetFromTop, 'F2', subSize, [0.39, 0.45, 0.54]);
  drawRightText('Price', priceColRight, cursorOffsetFromTop, 'F2', subSize, [0.39, 0.45, 0.54]);
  drawRightText('Total', totalColRight, cursorOffsetFromTop, 'F2', subSize, [0.39, 0.45, 0.54]);
  cursorOffsetFromTop += 6;
  drawSolidRule(cursorOffsetFromTop);
  cursorOffsetFromTop += lineStep - 2;

  const maxItemChars = isThermal ? 18 : 40;
  for (const item of sale.items) {
    const nameLines = wrapText(item.productName, maxItemChars);
    drawText(nameLines[0], marginX, cursorOffsetFromTop, 'F2', bodySize);
    drawRightText(String(item.quantity), qtyColRight, cursorOffsetFromTop, 'F3', bodySize);
    drawRightText(item.unitPrice.toFixed(2), priceColRight, cursorOffsetFromTop, 'F3', bodySize);
    drawRightText(item.lineTotal.toFixed(2), totalColRight, cursorOffsetFromTop, 'F3', bodySize);
    cursorOffsetFromTop += lineStep - 3;

    if (nameLines.length > 1) {
      for (let i = 1; i < nameLines.length; i += 1) {
        drawText(nameLines[i], marginX, cursorOffsetFromTop, 'F2', bodySize);
        cursorOffsetFromTop += lineStep - 4;
      }
    }
    drawText(item.sku, marginX, cursorOffsetFromTop, 'F3', subSize - 0.5, [0.39, 0.45, 0.54]);
    cursorOffsetFromTop += lineStep - 2;
  }

  drawDashedRule(cursorOffsetFromTop);
  cursorOffsetFromTop += lineStep;

  // Totals
  drawKeyVal('Subtotal', formatCurrency(sale.subtotal, currency), 'F3');
  if (sale.discountAmount > 0) {
    drawKeyVal('Discount', `-${formatCurrency(sale.discountAmount, currency)}`, 'F3');
  }
  drawSolidRule(cursorOffsetFromTop - 6);
  cursorOffsetFromTop += 4;
  drawText('Total Paid', marginX, cursorOffsetFromTop, 'F2', isThermal ? 9.5 : 12);
  drawRightText(
    formatCurrency(sale.totalAmount, currency),
    pageWidth - marginX,
    cursorOffsetFromTop,
    'F3',
    isThermal ? 9.5 : 12,
  );
  cursorOffsetFromTop += lineStep + 2;

  drawKeyVal('Payment Method', sale.paymentMethod, 'F2');
  drawKeyVal('Amount Tendered', formatCurrency(sale.amountPaid, currency), 'F3');
  drawKeyVal(
    sale.balanceDue > 0 ? 'Balance Due' : 'Change Given',
    formatCurrency(sale.balanceDue > 0 ? sale.balanceDue : sale.changeGiven, currency),
    'F3',
  );

  cursorOffsetFromTop += 2;
  drawDashedRule(cursorOffsetFromTop);
  cursorOffsetFromTop += lineStep;

  // Footer
  for (const footLine of wrapText(settings.receiptFooter, Math.floor(contentWidth / 5.2))) {
    drawCenteredText(footLine, cursorOffsetFromTop, 'F2', subSize, [0.12, 0.16, 0.23]);
    cursorOffsetFromTop += lineStep - 3;
  }
  drawCenteredText(
    `Official Sales Receipt - ${settings.companyName}`,
    cursorOffsetFromTop + 2,
    'F1',
    subSize - 0.5,
    [0.58, 0.64, 0.72],
  );

  const streamContent = `${commands.join('\n')}\n`;
  const encoder = new TextEncoder();
  const streamByteLen = encoder.encode(streamContent).length;

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`,
    `7 0 obj\n<< /Length ${streamByteLen} >>\nstream\n${streamContent}endstream\nendobj\n`,
  ];

  const header = '%PDF-1.4\n';
  let pdfText = header;
  const offsets: number[] = [0];
  let byteCursor = encoder.encode(header).length;

  for (const obj of objects) {
    offsets.push(byteCursor);
    pdfText += obj;
    byteCursor += encoder.encode(obj).length;
  }

  const xrefOffset = byteCursor;
  pdfText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdfText += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdfText);
}

export function downloadReceiptPdf(
  sale: Sale,
  settings: CompanySettings,
  paperFormat: 'a4' | 'thermal',
): void {
  const bytes = buildReceiptPdfBytes(sale, settings, paperFormat);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Receipt-${sale.receiptNumber}-${paperFormat}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPrintableReceipt(
  sale: Sale,
  settings: CompanySettings,
  paperFormat: 'a4' | 'thermal',
): void {
  const html = buildPrintableReceiptHtml(sale, settings, paperFormat);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Receipt-${sale.receiptNumber}-${paperFormat}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
