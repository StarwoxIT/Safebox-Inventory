const currency = process.env.CURRENCY_SYMBOL || '₦';

function formatMoney(value) {
  const number = Number(value || 0);
  return `${currency}${Math.round(number).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function baseStyles(company) {
  return `
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 10.5px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 2px solid ${company.brandColor}; padding-bottom: 10px; }
  .header img { width: 40px; height: 40px; object-fit: contain; }
  .header h1 { font-size: 16px; margin: 0 0 2px; color: ${company.brandColor}; }
  .header .meta { font-size: 10px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
  th { background: ${company.brandColorLight}; font-weight: 700; }
  tr.zebra { background: #fafafa; }
  tfoot td { font-weight: 700; background: ${company.brandColorLight}; }
  .num { text-align: right; }
`;
}

function wrap(title, meta, bodyHtml, company) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>${baseStyles(company)}</style></head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(meta)}</div>
    </div>
    <img src="${company.logoDataUri}" alt="" />
  </div>
  ${bodyHtml}
</body>
</html>`;
}

function periodLabel(from, to) {
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Up to ${to}`;
  return 'All time';
}

function buildStockMovementReportHtml(report, company) {
  const rows = report.items
    .map(
      (i, idx) => `
      <tr class="${idx % 2 === 1 ? 'zebra' : ''}">
        <td>${escapeHtml(i.date)}</td>
        <td>${escapeHtml(i.productId)}</td>
        <td>${escapeHtml(i.productName)}</td>
        <td>${escapeHtml([i.category, i.subcategory].filter(Boolean).join(' / '))}</td>
        <td>${escapeHtml(i.movementType)}</td>
        <td class="num">${i.inQty || ''}</td>
        <td class="num">${i.outQty || ''}</td>
        <td>${escapeHtml(i.condition)}</td>
        <td>${escapeHtml(i.status)}</td>
        <td>${escapeHtml(i.source || '')}</td>
        <td>${escapeHtml(i.recordedBy || '')}</td>
      </tr>`
    )
    .join('');

  const body = `
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Product ID</th><th>Product</th><th>Category / Sub-Category</th><th>Type</th>
          <th class="num">In</th><th class="num">Out</th><th>Condition</th><th>Status</th><th>Source</th><th>Recorded By</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="11" style="text-align:center; padding: 16px;">No stock movements in this period.</td></tr>`}</tbody>
      <tfoot>
        <tr><td colspan="5">Totals</td><td class="num">${report.totals.totalIn}</td><td class="num">${report.totals.totalOut}</td><td colspan="4"></td></tr>
      </tfoot>
    </table>`;

  return wrap('Stock Movement Report', `${company.name} — ${periodLabel(report.from, report.to)} — generated ${new Date().toISOString().slice(0, 10)}`, body, company);
}

function buildProductReportHtml(report, company) {
  const filterBits = [report.category, report.subcategory].filter(Boolean).join(' / ') || 'All categories';
  const rows = report.items
    .map(
      (p, idx) => `
      <tr class="${idx % 2 === 1 ? 'zebra' : ''}">
        <td>${escapeHtml(p.id)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${escapeHtml(p.subcategory || '')}</td>
        <td>${escapeHtml(p.brand || '')}</td>
        <td>${escapeHtml(p.model)}</td>
        <td>${escapeHtml(p.unit)}</td>
        <td class="num">${formatMoney(p.unitCost)}</td>
        <td class="num">${p.currentStock}</td>
        <td class="num">${p.minThreshold}</td>
        <td class="num">${p.maxThreshold}</td>
        <td>${escapeHtml(p.status)}</td>
        <td>${escapeHtml((p.createdAt || '').slice(0, 10))}</td>
      </tr>`
    )
    .join('');

  const body = `
    <table>
      <thead>
        <tr>
          <th>Product ID</th><th>Category</th><th>Sub-Category</th><th>Brand</th><th>Model</th><th>Unit</th>
          <th class="num">Unit Cost</th><th class="num">Current Stock</th><th class="num">Min</th><th class="num">Max</th><th>Status</th><th>Added</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="12" style="text-align:center; padding: 16px;">No products match this filter.</td></tr>`}</tbody>
    </table>`;

  return wrap('Product Report', `${company.name} — ${filterBits} — ${periodLabel(report.from, report.to)} — generated ${new Date().toISOString().slice(0, 10)}`, body, company);
}

module.exports = { buildStockMovementReportHtml, buildProductReportHtml };
