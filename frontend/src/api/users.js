import client from './client';

export const listUsers = () => client.get('/users').then((res) => res.data);
export const updateUser = (id, payload) => client.put(`/users/${id}`, payload).then((res) => res.data);
export const deleteUser = (id) => client.delete(`/users/${id}`).then((res) => res.data);
