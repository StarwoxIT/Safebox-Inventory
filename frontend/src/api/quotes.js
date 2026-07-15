import client from './client';

export const listQuotesForProject = (projectId) => client.get(`/quotes/${projectId}`).then((res) => res.data);
export const getQuoteDetail = (id) => client.get(`/quotes/detail/${id}`).then((res) => res.data);
export const getQuoteVersions = (id) => client.get(`/quotes/${id}/versions`).then((res) => res.data);
export const createQuote = (payload) => client.post('/quotes', payload).then((res) => res.data);
export const updateQuote = (id, payload) => client.put(`/quotes/${id}`, payload).then((res) => res.data);
export const deleteQuote = (id) => client.delete(`/quotes/${id}`).then((res) => res.data);
export const selectQuote = (id, selected = true) =>
  client.put(`/quotes/${id}/select`, { selected }).then((res) => res.data);

export const getQuotePdfUrl = (id) => {
  const base = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${base}/quotes/${id}/pdf`;
};

export const downloadQuotePdf = async (id) => {
  const response = await client.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `quotation-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
