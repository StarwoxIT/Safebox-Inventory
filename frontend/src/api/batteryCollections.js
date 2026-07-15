import client from './client';

export const listBatteryCollections = () => client.get('/battery-collections').then((res) => res.data);
export const createBatteryCollection = (payload) => client.post('/battery-collections', payload).then((res) => res.data);
export const deleteBatteryCollection = (id) => client.delete(`/battery-collections/${id}`).then((res) => res.data);
