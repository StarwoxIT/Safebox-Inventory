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

function invoiceDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return String(value || '');

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${day}${suffix} ${date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
}

function invoiceStyles(company) {
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #292929; margin: 0; font-size: 14px; }
  .invoice-page { width: 210mm; height: 297mm; position: relative; overflow: visible; padding: 44mm 26mm 8mm 14mm; display: flex; flex-direction: column; }
  .invoice-page:before { content: ''; position: absolute; left: 8.5mm; top: 63mm; bottom: 6mm; border-left: 1px solid ${company.brandColorLight}; }
  .top-accent { position: absolute; z-index: 2; top: 0; left: 0; width: 112mm; height: 15mm; background: ${company.brandColor}; clip-path: polygon(0 0, 100% 0, 91% 100%, 0 100%); }
  .top-accent:before { content: ''; position: absolute; top: 0; right: 0; width: 17mm; height: 12mm; background: #79b53b; clip-path: polygon(0 0, 100% 0, 100% 100%); }
  .top-accent-stripe { position: absolute; z-index: 2; left: 0; top: 20.8mm; width: 86mm; height: 3mm; background: ${company.brandColor}; clip-path: polygon(0 0, 100% 0, 96% 100%, 0 100%); }
  .top-accent-stripe:after { content: ''; position: absolute; top: 0; right: 0; width: 4mm; height: 100%; background: #79b53b; clip-path: polygon(100% 0, 100% 100%, 0 0); }
  .invoice-brand { position: absolute; top: 7mm; right: 15mm; display: flex; align-items: flex-start; gap: 2mm; color: #555; font-size: 12px; line-height: 1.25; }
  .invoice-brand img { width: 13mm; height: 13mm; object-fit: contain; }
  .invoice-brand strong { color: #659853; font-size: 13px; letter-spacing: .35px; }
  .invoice-heading { display: flex; align-items: flex-start; margin-bottom: 8mm; }
  .invoice-heading h1 { margin: 0; font-size: 40px; line-height: 1; }
  .invoice-details { position: relative; display: grid; grid-template-columns: 70% 30%; margin-bottom: 14mm; line-height: 1.45; min-height: 19mm; }
  .invoice-details:before { content: ''; position: absolute; left: -5.5mm; top: 0; width: 4mm; height: 4mm; border-radius: 50%; background: ${company.brandColor}; }
  .invoice-details .client { font-size: 15px; }
  .invoice-details .client > div { display: grid; grid-template-columns: 22mm minmax(0, 1fr); column-gap: 2mm; }
  .invoice-details .client strong { display: block; justify-self: start; }
  .invoice-details .date { align-self: center; text-align: left; font-size: 15px; }
  .invoice-items { position: relative; }
  .invoice-watermark { position: absolute; z-index: 0; width: 82mm; height: 82mm; object-fit: contain; opacity: .055; left: 50%; top: 50%; transform: translate(-50%, -50%); }
  table.invoice-table { width: 100%; border-collapse: collapse; position: relative; z-index: 1; }
  table.invoice-table thead { height: 10mm; }
  table.invoice-table tbody { height: 36.5mm; }
  table.invoice-table th { padding: 2mm; border-top: 1px solid ${company.brandColor}; border-bottom: 1px solid ${company.brandColor}; background: ${company.brandColor}; color: #292929; text-align: left; font-size: 13px; letter-spacing: .7px; }
  table.invoice-table th:first-child { padding-left: 21mm; }
  table.invoice-table tr { border-bottom: 1px solid #e4e4e4; }
  table.invoice-table td { padding: 2mm; border-bottom: 1px solid #e4e4e4; font-size: 14px; vertical-align: top; }
  table.invoice-table .quantity, table.invoice-table .amount { text-align: right; white-space: nowrap; }
  table.invoice-table .description { width: 68%; }
  table.invoice-table .quantity { width: 12%; }
  table.invoice-table .amount { width: 20%; }
  .invoice-totals { position: relative; z-index: 1; width: 73mm; margin: 7mm 0 0 auto; font-size: 14px; }
  .invoice-totals .row { display: flex; justify-content: space-between; gap: 4mm; padding: 1.1mm 0; border-bottom: 1px solid #d9d9d9; }
  .invoice-totals .row span:first-child { font-weight: 700; text-transform: uppercase; }
  .invoice-totals .balance { color: ${company.brandColor}; font-weight: 700; }
  .invoice-lower { margin-top: 8mm; display: flex; flex-direction: column; }
  .invoice-notes { min-height: 14mm; font-size: 14px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  .invoice-signatures { display: flex; justify-content: space-around; gap: 20mm; margin-top: 10mm; }
  .invoice-signature { flex: 1; border-top: 1px solid ${company.brandColor}; padding-top: 2mm; text-align: center; font-size: 14px; font-weight: 700; }
  .invoice-signature .client-signature-name { display: block; padding-top: 1mm; font: inherit; text-transform: inherit; }
  .account-details { margin-top: 10mm; text-align: center; font-size: 14px; line-height: 1.5; }
  .account-details strong { display: block; margin-bottom: 1mm; }
  .invoice-footer { margin-top: 8mm; text-align: center; font-size: 14px; white-space: nowrap; }
`;
}

function buildDocumentHtml(doc, company) {
  const isReceipt = doc.type === 'receipt';
  const rows = doc.items
    .map(
      (item) => `
      <tr>
        <td class="description">${escapeHtml(item.description)}</td>
        <td class="quantity">${escapeHtml(item.quantity)}</td>
        <td class="amount">${formatMoney(item.total)}</td>
      </tr>`
    )
    .join('');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>${invoiceStyles(company)}</style></head>
<body>
  <div class="invoice-page">
    <div class="top-accent"></div>
    <div class="top-accent-stripe"></div>
    <img class="invoice-watermark" src="${company.logoDataUri}" alt="" />
    <div class="invoice-brand">
      <img src="${company.logoDataUri}" alt="" />
      <div><strong>SAFEBOX SOLUTIONS</strong>
        <div>Edo State Head Office,</div>
        <div>Edo Innovation Hub</div>
        <div>59, I.C.E. Road, Benin</div>
        <div>RC8365029</div>
      </div>
    </div>
    <div class="invoice-heading">
      <h1>${isReceipt ? 'RECEIPT' : 'INVOICE'}</h1>
    </div>
    <div class="invoice-details">
      <div class="client">
        <div><strong>NAME:</strong><span>${escapeHtml(doc.clientName || '')}</span></div>
        <div><strong>CONTACT:</strong><span>${escapeHtml(doc.clientContact || '')}</span></div>
        <div><strong>ADDRESS:</strong><span>${escapeHtml(doc.clientAddress || '')}</span></div>
      </div>
      <div class="date"><strong>DATE:</strong> ${escapeHtml(invoiceDate(doc.issueDate))}</div>
    </div>
    <div class="invoice-items">
      <table class="invoice-table">
        <thead><tr><th>ITEM DESCRIPTION</th><th class="quantity">QTY</th><th class="amount">AMOUNT</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="invoice-totals">
        ${isReceipt
    ? `<div class="row"><span>Subtotal:</span><span>${formatMoney(doc.subtotal)}</span></div>
        <div class="row"><span>Grand Total:</span><span>${formatMoney(doc.grandTotal)}</span></div>
        <div class="row"><span>Amount Paid:</span><span>${formatMoney(doc.amountPaid)}</span></div>`
    : `<div class="row"><span>Total Amount:</span><span>${formatMoney(doc.grandTotal)}</span></div>
        <div class="row"><span>Amount Deposited:</span><span>${formatMoney(doc.amountPaid)}</span></div>
        <div class="row balance"><span>Balance Remaining:</span><span>${formatMoney(doc.balance)}</span></div>`}
      </div>
    </div>
    <div class="invoice-lower">
      <div class="invoice-notes">${escapeHtml(doc.notes || '')}</div>
      <div class="invoice-signatures">
        <div class="invoice-signature"><span class="client-signature-name">${escapeHtml(doc.clientName || '')}</span></div>
        <div class="invoice-signature">SAFEBOX SOLUTIONS</div>
      </div>
      <div class="account-details">
        <strong>ACCOUNT DETAILS:</strong>
        SAFEBOX SOLUTIONS<br />
        1024852459<br />
        UNITED BANK FOR AFRICA
      </div>
      <div class="invoice-footer">+2348135651507 | operations@safeboxsolutions.com | www.safeboxenergy.com</div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildDocumentHtml };
