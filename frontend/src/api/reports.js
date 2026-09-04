import client from './client';

export const getStockMovementReport = (params) => client.get('/reports/stock-movements', { params }).then((res) => res.data);
export const getProductReport = (params) => client.get('/reports/products', { params }).then((res) => res.data);

async function downloadFile(url, params, filename) {
  const response = await client.get(url, { params, responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export const exportStockMovementReport = (params, format) =>
  downloadFile('/reports/stock-movements/export', { ...params, format }, `stock-movement-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);

export const exportProductReport = (params, format) =>
  downloadFile('/reports/products/export', { ...params, format }, `product-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
