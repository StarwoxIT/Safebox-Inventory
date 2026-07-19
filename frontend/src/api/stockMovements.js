import client from './client';

export const listStockMovements = () => client.get('/stock-movements').then((res) => res.data);
export const createStockMovement = (payload) => client.post('/stock-movements', payload).then((res) => res.data);
export const updateStockMovement = (id, payload) => client.put(`/stock-movements/${id}`, payload).then((res) => res.data);
export const approveStockMovement = (id, decision) =>
  client.post(`/stock-movements/${id}/approve`, { decision }).then((res) => res.data);
export const deleteStockMovement = (id) => client.delete(`/stock-movements/${id}`).then((res) => res.data);
