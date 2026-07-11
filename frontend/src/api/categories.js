import client from './client';

export const listCategories = () => client.get('/categories').then((res) => res.data);
export const createCategory = (payload) => client.post('/categories', payload).then((res) => res.data);
export const updateCategory = (id, payload) => client.put(`/categories/${id}`, payload).then((res) => res.data);
export const deleteCategory = (id) => client.delete(`/categories/${id}`).then((res) => res.data);

export const listUnits = () => client.get('/units').then((res) => res.data);
export const createUnit = (payload) => client.post('/units', payload).then((res) => res.data);
export const deleteUnit = (id) => client.delete(`/units/${id}`).then((res) => res.data);
