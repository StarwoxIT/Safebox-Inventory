import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui';
import { useState, useEffect } from 'react';
import api from '../utils/api';

const NavItem = ({ to, icon, label, badge }) => {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 12px',
        borderRadius: 'var(--border-radius-md)',
        fontSize: 13,
        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
        background: active ? 'var(--sidebar-active-bg)' : 'transparent',
        fontWeight: active ? 500 : 400,
        textDecoration: 'none',
        marginBottom: 2,
        position: 'relative',
        borderLeft: active ? '3px solid var(--brand-accent)' : '3px solid transparent',
        paddingLeft: active ? 9 : 12,
        transition: 'background .12s, color .12s',
      }}
    >
      <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{
          background: '#F5A623',
          color: '#0F3D26',
          fontSize: 9,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 8,
          minWidth: 16,
          textAlign: 'center',
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
};

const NavSection = ({ label }) => (
  <div style={{
    fontSize: 9,
    fontWeight: 600,
    color: 'var(--sidebar-section-text)',
    textTransform: 'uppercase',
    letterSpacing: '.1em',
    padding: '10px 12px 4px',
  }}>
    {label}
  </div>
);

export default function Layout({ children }) {
  const { user, logout, isSA } = useAuth();
  const nav = useNavigate();
  const [pending, setPending] = useState({ total: 0 });

  useEffect(() => {
    if (isSA()) {
      api.get('/dashboard').then(d => setPending({ total: d.pendingApprovals })).catch(() => {});
    }
  }, []);

  const handleLogout = async () => { await logout(); nav('/login'); };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      color: 'var(--color-text-primary)',
      background: 'var(--color-background-secondary)',
    }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Logo area */}
        <div style={{
          padding: '14px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img src="/logo.png" style={{ height: 36, display: 'block' }} alt="SafeBox Energy" />
        </div>

        {/* Nav items */}
        <div style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          <NavSection label="Overview" />
          <NavItem to="/" icon="layout-dashboard" label="Dashboard" />

          <NavSection label="Warehouse" />
          <NavItem to="/inventory" icon="package" label="Product catalogue" />
          <NavItem to="/movements" icon="arrows-exchange" label="Stock movements" />
          <NavItem to="/returns" icon="arrow-back-up" label="Returns & recon." />

          <NavSection label="Operations" />
          <NavItem to="/projects" icon="building-factory" label="Projects" />
          <NavItem to="/materials" icon="tool" label="Project materials" />
          <NavItem to="/project-costs" icon="receipt" label="Other project costs" />
          <NavItem to="/engineers" icon="hardhat" label="Engineers" />
          <NavItem to="/battery-collections" icon="battery-charging" label="Battery collections" />

          {isSA() && <>
            <NavSection label="Administration" />
            <NavItem to="/approvals" icon="circle-check" label="Approvals" badge={pending.total} />
            <NavItem to="/categories" icon="tags" label="Categories" />
            <NavItem to="/users" icon="users" label="Users" />
            <NavItem to="/audit" icon="file-text" label="Audit trail" />
          </>}

          <NavSection label="System" />
          <NavItem to="/settings" icon="settings" label="Settings" />
          <NavItem to="/change-password" icon="lock" label="Change password" />
        </div>

        {/* User area */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'rgba(0,0,0,0.15)',
        }}>
          <Avatar name={user?.name} role={user?.role} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--sidebar-text)' }}>{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--sidebar-text)',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <i className="ti ti-logout" aria-hidden="true" style={{ fontSize: 16 }} />
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ padding: 24 }}>{children}</div>
      </main>
    </div>
  );
}
