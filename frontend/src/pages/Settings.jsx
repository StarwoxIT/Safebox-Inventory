import { useEffect, useState } from 'react';
import { IconSettings } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { getSettings, updateSettings } from '../api/settings';
import PageHeader from '../components/PageHeader';
import BackButton from '../components/BackButton';

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setMessage('');
    setError('');
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setMessage('Settings saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    }
  };

  if (loading) return <div className="page-loading">Loading settings...</div>;

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader icon={IconSettings} title="Settings" subtitle="System preferences and configuration." />
      </div>
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="panel">
        <h2>Company Information</h2>
        <div className="form-grid">
          <label>
            Company Name
            <input value={settings.company_name || ''} onChange={(e) => set('company_name', e.target.value)} disabled={!isSuperAdmin} />
          </label>
          <label>
            Company Email
            <input type="email" value={settings.company_email || ''} onChange={(e) => set('company_email', e.target.value)} disabled={!isSuperAdmin} />
          </label>
        </div>
      </div>

      <div className="panel">
        <h2>Regional Preferences</h2>
        <div className="form-grid">
          <label>
            Currency
            <select value={settings.currency || 'NGN'} onChange={(e) => set('currency', e.target.value)} disabled={!isSuperAdmin}>
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label>
            Timezone
            <select value={settings.timezone || 'Africa/Lagos'} onChange={(e) => set('timezone', e.target.value)} disabled={!isSuperAdmin}>
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </label>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="panel">
          <h2>Approval Workflow</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={settings.require_approval !== 'false'}
              onChange={(e) => set('require_approval', String(e.target.checked))}
            />
            Require super admin approval for new products and stock movements
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={settings.low_stock_alert !== 'false'}
              onChange={(e) => set('low_stock_alert', String(e.target.checked))}
            />
            Show low-stock alerts on the dashboard
          </label>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
