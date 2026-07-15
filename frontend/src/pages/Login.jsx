import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { IconBolt, IconBoxSeam, IconShieldCheck } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <img src="/safebox-icon.png" alt="Safebox" className="auth-brand-logo" />
          <h1>Safebox Portal</h1>
          <p>One place to manage projects, inventory, quotations and payments.</p>
          <ul className="auth-brand-features">
            <li><IconBolt size={18} /> Track EaaS, installment and outright payments</li>
            <li><IconBoxSeam size={18} /> Real-time inventory and stock control</li>
            <li><IconShieldCheck size={18} /> Full approvals and audit trail</li>
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <img src="/safebox-icon.png" alt="Safebox Energy" className="auth-logo" />
          <h1>Safebox Portal</h1>
          <p className="auth-subtitle">Sign in to manage projects, inventory and payments</p>

          {error && <div className="alert alert-error">{error}</div>}

          <label htmlFor="login-email">
            Email
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </label>

          <label htmlFor="login-password">
            Password
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          <div className="auth-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
