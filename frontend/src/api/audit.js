import client from './client';

export const getAuditLog = (limit = 50, offset = 0) =>
  client.get('/audit', { params: { limit, offset } }).then((res) => res.data);
