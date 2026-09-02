const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getStockMovementReport, getProductReport } = require('../services/reportService');
const { buildWorkbookBuffer } = require('../services/excelService');
const { renderStockMovementReportPdf, renderProductReportPdf } = require('../services/pdfService');

const router = express.Router();

const STOCK_MOVEMENT_COLUMNS = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Product ID', key: 'productId', width: 14 },
  { header: 'Product', key: 'productName', width: 26 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Sub-Category', key: 'subcategory', width: 16 },
  { header: 'Type', key: 'movementType', width: 22 },
  { header: 'In', key: 'inQty', width: 10 },
  { header: 'Out', key: 'outQty', width: 10 },
  { header: 'Condition', key: 'condition', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Source', key: 'source', width: 20 },
  { header: 'Recorded By', key: 'recordedBy', width: 18 },
];

const PRODUCT_COLUMNS = [
  { header: 'Product ID', key: 'id', width: 14 },
  { header: 'Category', key: 'category', width: 16 },
  { header: 'Sub-Category', key: 'subcategory', width: 16 },
  { header: 'Brand', key: 'brand', width: 16 },
  { header: 'Model', key: 'model', width: 26 },
  { header: 'Unit', key: 'unit', width: 10 },
  { header: 'Unit Cost', key: 'unitCost', width: 14 },
  { header: 'Current Stock', key: 'currentStock', width: 14 },
  { header: 'Min Threshold', key: 'minThreshold', width: 14 },
  { header: 'Max Threshold', key: 'maxThreshold', width: 14 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Added', key: 'createdAt', width: 18 },
];

router.get('/stock-movements', authenticate, (req, res) => {
  const { from, to } = req.query;
  res.json(getStockMovementReport({ from, to }));
});

router.get('/stock-movements/export', authenticate, async (req, res) => {
  const { from, to, format } = req.query;
  const report = getStockMovementReport({ from, to });
  try {
    if (format === 'pdf') {
      const pdfBuffer = await renderStockMovementReportPdf(report);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="stock-movement-report.pdf"' });
      return res.send(pdfBuffer);
    }
    const buffer = await buildWorkbookBuffer('Stock Movements', STOCK_MOVEMENT_COLUMNS, report.items);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="stock-movement-report.xlsx"',
    });
    res.send(buffer);
  } catch (err) {
    console.error('Stock movement report export failed:', err);
    res.status(500).json({ error: 'Failed to generate report.', detail: err.message });
  }
});

router.get('/products', authenticate, (req, res) => {
  const { category, subcategory, from, to } = req.query;
  res.json(getProductReport({ category, subcategory, from, to }));
});

router.get('/products/export', authenticate, async (req, res) => {
  const { category, subcategory, from, to, format } = req.query;
  const report = getProductReport({ category, subcategory, from, to });
  try {
    if (format === 'pdf') {
      const pdfBuffer = await renderProductReportPdf(report);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="product-report.pdf"' });
      return res.send(pdfBuffer);
    }
    const buffer = await buildWorkbookBuffer('Products', PRODUCT_COLUMNS, report.items);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="product-report.xlsx"',
    });
    res.send(buffer);
  } catch (err) {
    console.error('Product report export failed:', err);
    res.status(500).json({ error: 'Failed to generate report.', detail: err.message });
  }
});

module.exports = router;
