const puppeteer = require('puppeteer');
const { buildQuotationHtml, buildProposalHtml } = require('../templates/quotationTemplate');
const { buildStockMovementReportHtml, buildProductReportHtml } = require('../templates/reportTemplate');
const { buildDocumentHtml } = require('../templates/documentTemplate');
const { getCompanyProfile } = require('./companyService');

let browserPromise = null;

function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Docker/Render-style containers give /dev/shm very little space by
      // default; Chromium's default shared-memory usage overflows it and
      // crashes, especially on heavier multi-page renders. This routes
      // that usage to /tmp instead.
      '--disable-dev-shm-usage',
    ],
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = launchBrowser();
  }
  return browserPromise;
}

async function renderHtmlToPdf(html, pdfOptions = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 'load' (not 'networkidle0') is the right signal for static, embedded
    // data-URI content - and a longer timeout gives headroom on slow/shared
    // free-tier CPUs where the heavier multi-page proposal can take a while.
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      ...pdfOptions,
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

function renderQuotationPdf(quotation, job) {
  return renderHtmlToPdf(buildQuotationHtml(quotation, job, getCompanyProfile()));
}

function renderProposalPdf(job, quotations) {
  return renderHtmlToPdf(buildProposalHtml(job, quotations, getCompanyProfile()));
}

const reportPdfOptions = {
  landscape: true,
  margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
};

function renderStockMovementReportPdf(report) {
  return renderHtmlToPdf(buildStockMovementReportHtml(report, getCompanyProfile()), reportPdfOptions);
}

function renderProductReportPdf(report) {
  return renderHtmlToPdf(buildProductReportHtml(report, getCompanyProfile()), reportPdfOptions);
}

function renderDocumentPdf(doc) {
  return renderHtmlToPdf(buildDocumentHtml(doc, getCompanyProfile()));
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

module.exports = {
  renderQuotationPdf,
  renderProposalPdf,
  renderStockMovementReportPdf,
  renderProductReportPdf,
  renderDocumentPdf,
  closeBrowser,
};
