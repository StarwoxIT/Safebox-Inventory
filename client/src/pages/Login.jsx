import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Left Panel */}
      <div style={{
        width: '40%',
        background: 'linear-gradient(160deg, #0F3D26 0%, #0F3D26 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 40px',
        color: '#fff',
        flexShrink: 0,
      }} className="login-left">
        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <img src="/logo.png" alt="SafeBox Energy" style={{ height: 44, display: 'block' }} />
        </div>

        {/* Tagline */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 12,
            color: '#FFFFFF',
          }}>
            Powering Nigeria's<br />Solar Future
          </div>
          <div style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6,
            marginBottom: 40,
          }}>
            Complete inventory control for your solar energy business
          </div>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { icon: '⚡', title: 'Real-time stock tracking', desc: 'Monitor inventory levels across all product categories' },
              { icon: '📊', title: 'Project management', desc: 'Track materials and engineers across every installation' },
              { icon: '🔒', title: 'Role-based access', desc: 'Granular permissions with full audit trail' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  fontSize: 20,
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#FFFFFF', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 40 }}>
          &copy; 2025 SafeBox Energy
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFFFFF',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginBottom: 6,
            }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Sign in to SafeBox Energy IMS
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            {/* Email field */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: 6,
              }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <i className="ti ti-mail" aria-hidden="true" style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 16,
                  color: 'var(--color-text-tertiary)',
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@safebox.ng"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--color-border-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                    fontSize: 14,
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#0F3D26'}
                  onBlur={e => e.target.style.borderColor = 'var(--color-border-secondary)'}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: 6,
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <i className="ti ti-lock" aria-hidden="true" style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 16,
                  color: 'var(--color-text-tertiary)',
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 38px',
                    border: '1px solid var(--color-border-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                    fontSize: 14,
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#0F3D26'}
                  onBlur={e => e.target.style.borderColor = 'var(--color-border-secondary)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#0F3D26',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`ti ti-eye${showPassword ? '-off' : ''}`} style={{ fontSize: 16 }} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: '#FCEBEB',
                border: '1px solid #F7C1C1',
                borderRadius: 'var(--border-radius-md)',
                color: '#A32D2D',
                fontSize: 13,
                marginBottom: 16,
              }}>
                <i className="ti ti-alert-circle" aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#154D30' : '#0F3D26',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background .15s',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = '#154D30'; }}
              onMouseLeave={e => { if (!loading) e.target.style.background = '#0F3D26'; }}
            >
              {loading ? (
                <>
                  <i className="ti ti-loader-2" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in…
                </>
              ) : (
                <>
                  <i className="ti ti-login" aria-hidden="true" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: '1px solid var(--color-border-tertiary)',
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}>
            &copy; 2025 SafeBox Energy. All rights reserved.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
