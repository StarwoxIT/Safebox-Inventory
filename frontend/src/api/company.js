import client from './client';

export const getCompanyProfile = () => client.get('/company').then((res) => res.data);
export const updateCompanyProfile = (payload) => client.put('/company', payload).then((res) => res.data);
