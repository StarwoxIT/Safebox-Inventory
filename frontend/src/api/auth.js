import client from './client';

export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((res) => res.data);

export const register = (payload) =>
  client.post('/auth/register', payload).then((res) => res.data);

export const me = () => client.get('/auth/me').then((res) => res.data);

export const changePassword = (currentPassword, newPassword) =>
  client
    .put('/auth/change-password', { current_password: currentPassword, new_password: newPassword })
    .then((res) => res.data);
