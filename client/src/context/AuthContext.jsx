import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sb_token');
    if (token) {
      api.get('/auth/me').then(u => { setUser(u); setLoading(false); }).catch(() => { localStorage.removeItem('sb_token'); setLoading(false); });
    } else { setLoading(false); }
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('sb_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    localStorage.removeItem('sb_token');
    setUser(null);
  };

  const isSA = () => user?.role === 'Super Admin';

  return <AuthCtx.Provider value={{ user, login, logout, isSA, loading }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
