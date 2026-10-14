import client from './client';

export const listDocuments = (type) => client.get('/documents', { params: { type } }).then((res) => res.data);
export const getDocument = (id) => client.get(`/documents/${id}`).then((res) => res.data);
export const createDocument = (payload) => client.post('/documents', payload).then((res) => res.data);
export const deleteDocument = (id) => client.delete(`/documents/${id}`).then((res) => res.data);

export const downloadDocumentPdf = async (id, docNumber) => {
  const response = await client.get(`/documents/${id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${docNumber || id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
