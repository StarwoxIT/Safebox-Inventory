import client from './client';

export const listDocuments = (type) => client.get('/documents', { params: { type } }).then((res) => res.data);
export const getDocument = (id) => client.get(`/documents/${id}`).then((res) => res.data);
export const createDocument = (payload) => client.post('/documents', payload).then((res) => res.data);
export const deleteDocument = (id) => client.delete(`/documents/${id}`).then((res) => res.data);
export const getDocumentPdf = (id) => client.get(`/documents/${id}/pdf`, { responseType: 'blob' }).then((res) => res.data);
export const previewDocumentPdf = (payload) =>
  client.post('/documents/preview/pdf', payload, { responseType: 'blob' }).then((res) => res.data);

export const downloadDocumentPdf = async (id, docNumber) => {
  const pdf = await getDocumentPdf(id);
  const url = window.URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${docNumber || id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
