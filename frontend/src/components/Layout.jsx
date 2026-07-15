import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconBriefcase,
  IconBoxSeam,
  IconArrowsExchange,
  IconTags,
  IconRotateClockwise2,
  IconBattery,
  IconCashBanknote,
  IconShieldCheck,
  IconUsers,
  IconBuildingFactory2,
  IconHistory,
  IconSettings,
  IconLock,
  IconLogout,
  IconMenu2,
  IconX,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StatusBadge from './StatusBadge';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSuperAdmin = user?.role === 'super_admin';

  const navGroups = [
    {
      label: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true }],
    },
    {
      label: 'Projects & Quotes',
      items: [{ to: '/projects', label: 'Projects', icon: IconBriefcase }],
    },
    {
      label: 'Inventory',
      items: [
        { to: '/products', label: 'Products', icon: IconBoxSeam },
        { to: '/stock-movements', label: 'Stock Movements', icon: IconArrowsExchange },
        { to: '/categories', label: 'Categories & Units', icon: IconTags },
        { to: '/returns', label: 'Returns', icon: IconRotateClockwise2 },
        { to: '/battery-collections', label: 'Battery Collections', icon: IconBattery },
      ],
    },
  ];

  if (isSuperAdmin) {
    navGroups.splice(2, 0, {
      label: 'Payments',
      items: [{ to: '/payment-tracker', label: 'Payment Tracker', icon: IconCashBanknote }],
    });
  }

  const adminItems = [];
  if (isSuperAdmin) {
    adminItems.push({ to: '/approvals', label: 'Approvals', icon: IconShieldCheck });
  }
  if (user?.role === 'admin' || isSuperAdmin) {
    adminItems.push({ to: '/company-profile', label: 'Company Profile', icon: IconBuildingFactory2 });
  }
  if (isSuperAdmin) {
    adminItems.push({ to: '/users', label: 'Users', icon: IconUsers });
    adminItems.push({ to: '/audit-trail', label: 'Audit Trail', icon: IconHistory });
  }
  adminItems.push({ to: '/settings', label: 'Settings', icon: IconSettings });
  adminItems.push({ to: '/change-password', label: 'Change Password', icon: IconLock });
  if (adminItems.length > 0) {
    navGroups.push({ label: 'Admin', items: adminItems });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-btn mobile-only" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
          {menuOpen ? <IconX size={22} /> : <IconMenu2 size={22} />}
        </button>
        <div className="brand">
          <img src="/safebox-icon.png" alt="" className="brand-icon" />
          <span>Safebox Portal</span>
        </div>
        <div className="topbar-user">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode">
            {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
          <span className="user-name">{user?.name}</span>
          <StatusBadge type="role" value={user?.role} />
          <button className="icon-btn" onClick={handleLogout} title="Log out" aria-label="Log out">
            <IconLogout size={20} />
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <nav>
            {navGroups.map((group) => (
              <div className="nav-group" key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
