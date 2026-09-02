const currency = process.env.CURRENCY_SYMBOL || '₦';

function formatMoney(value) {
  const number = Number(value || 0);
  return `${currency}${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm; display: flex; flex-direction: column; }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .top-row img { width: 46px; height: 46px; object-fit: contain; }
  .company-block { text-align: left; font-size: 10.5px; line-height: 1.5; }
  .company-block .name { font-size: 15px; font-weight: 800; color: ${company.brandColor}; }
  .doc-title-block { text-align: right; }
  .doc-title-block .title { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: ${company.brandColor}; }
  .doc-title-block .num { font-size: 12px; font-weight: 700; margin-top: 4px; }
  .doc-title-block .date { font-size: 10.5px; color: #555; }
  .bill-to { margin-bottom: 20px; font-size: 11.5px; line-height: 1.6; }
  .bill-to .label { font-size: 9.5px; letter-spacing: 0.5px; text-transform: uppercase; color: #777; margin-bottom: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.items th { background: ${company.brandColor}; color: #fff; text-align: left; padding: 8px 10px; font-size: 10.5px; }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #e2e2e2; font-size: 11px; }
  table.items tr.zebra td { background: ${company.brandColorLight}; }
  .num { text-align: right; }
  .totals { width: 260px; margin-left: auto; margin-top: 12px; font-size: 11.5px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
  .totals .grand { font-weight: 800; font-size: 14px; border-bottom: 2px solid ${company.brandColor}; }
  .totals .balance { font-weight: 800; color: ${company.brandColor}; }
  .notes { margin-top: 28px; font-size: 10.5px; color: #444; line-height: 1.6; }
  .footer { margin-top: auto; padding-top: 16px; border-top: 1px solid #e2e2e2; font-size: 9.5px; color: #777; display: flex; justify-content: space-between; }
`;
}

// doc: { type, docNumber, issueDate, clientName, clientAddress, clientContact, items,
//        subtotal, vatPercent, vatAmount, grandTotal, amountPaid, balance, notes }
function buildDocumentHtml(doc, company) {
  const title = doc.type === 'receipt' ? 'RECEIPT' : 'INVOICE';
  const rows = doc.items
    .map(
      (item, idx) => `
      <tr class="${idx % 2 === 1 ? 'zebra' : ''}">
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatMoney(item.unit_cost)}</td>
        <td class="num">${formatMoney(item.total)}</td>
      </tr>`
    )
    .join('');

  const showVat = Number(doc.vatPercent) > 0;
  const showBalance = doc.type === 'invoice' && Number(doc.balance) > 0;

  const body = `
  <div class="page">
    <div class="top-row">
      <div class="company-block">
        <div class="name">${escapeHtml(company.name)}</div>
        ${company.addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        <div>${escapeHtml(company.email)} · ${escapeHtml(company.phone)}</div>
      </div>
      <div class="doc-title-block">
        <div class="title">${title}</div>
        <div class="num">${escapeHtml(doc.docNumber)}</div>
        <div class="date">${escapeHtml(doc.issueDate)}</div>
      </div>
    </div>

    <div class="bill-to">
      <div class="label">${doc.type === 'receipt' ? 'Received From / Client' : 'Bill To'}</div>
      <div><strong>${escapeHtml(doc.clientName || '—')}</strong></div>
      ${doc.clientAddress ? `<div>${escapeHtml(doc.clientAddress)}</div>` : ''}
      ${doc.clientContact ? `<div>${escapeHtml(doc.clientContact)}</div>` : ''}
    </div>

    <table class="items">
      <thead>
        <tr><th>#</th><th>Item / Description</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatMoney(doc.subtotal)}</span></div>
      ${showVat ? `<div class="row"><span>VAT (${doc.vatPercent}%)</span><span>${formatMoney(doc.vatAmount)}</span></div>` : ''}
      <div class="row grand"><span>Grand Total</span><span>${formatMoney(doc.grandTotal)}</span></div>
      ${doc.type === 'receipt' ? `<div class="row"><span>Amount Paid</span><span>${formatMoney(doc.amountPaid)}</span></div>` : ''}
      ${showBalance ? `<div class="row balance"><span>Balance Remaining</span><span>${formatMoney(doc.balance)}</span></div>` : ''}
    </div>

    ${doc.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(doc.notes)}</div>` : ''}

    <div class="footer">
      <span>${escapeHtml(company.regNumber)}</span>
      <span>${doc.type === 'receipt' ? 'Thank you for your payment.' : 'Thank you for your business.'}</span>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>${baseStyles(company)}</style></head>
<body>${body}</body>
</html>`;
}

module.exports = { buildDocumentHtml };
