import client from './client';

export const listReturns = () => client.get('/returns').then((res) => res.data);
export const createReturn = (payload) => client.post('/returns', payload).then((res) => res.data);
export const updateReturn = (id, payload) => client.put(`/returns/${id}`, payload).then((res) => res.data);
export const deleteReturn = (id) => client.delete(`/returns/${id}`).then((res) => res.data);
