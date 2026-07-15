import client from './client';

export const getSettings = () => client.get('/settings').then((res) => res.data);
export const updateSettings = (payload) => client.put('/settings', payload).then((res) => res.data);
