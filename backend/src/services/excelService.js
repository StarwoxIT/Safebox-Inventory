const ExcelJS = require('exceljs');

// columns: [{ header, key, width }], rows: array of plain objects keyed by `key`.
async function buildWorkbookBuffer(sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

module.exports = { buildWorkbookBuffer };
