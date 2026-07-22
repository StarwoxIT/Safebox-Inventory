import client from './client';

export const listProducts = () => client.get('/products').then((res) => res.data);
export const listProductStock = () => client.get('/products/stock').then((res) => res.data);
export const createProduct = (payload) => client.post('/products', payload).then((res) => res.data);
export const updateProduct = (id, payload) => client.put(`/products/${id}`, payload).then((res) => res.data);
export const approveProduct = (id, decision) =>
  client.post(`/products/${id}/approve`, { decision }).then((res) => res.data);
export const deleteProduct = (id) => client.delete(`/products/${id}`).then((res) => res.data);
export const previewProductIdNormalization = () => client.get('/products/normalize-ids/preview').then((res) => res.data);
export const applyProductIdNormalization = () => client.post('/products/normalize-ids').then((res) => res.data);
