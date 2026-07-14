import { useState } from 'react';
import { IconLock } from '@tabler/icons-react';
import { changePassword } from '../api/auth';
import PageHeader from '../components/PageHeader';
import PasswordInput from '../components/PasswordInput';
import BackButton from '../components/BackButton';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setMessage('Password changed successfully.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader icon={IconLock} title="Change Password" subtitle="Update your own account password." />
      </div>
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form className="panel form-grid" style={{ maxWidth: 480 }} onSubmit={handleSubmit}>
        <label className="span-2" htmlFor="current-password">
          Current Password
          <PasswordInput
            id="current-password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="span-2" htmlFor="new-password">
          New Password
          <PasswordInput
            id="new-password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <label className="span-2" htmlFor="confirm-password">
          Confirm New Password
          <PasswordInput
            id="confirm-password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <div className="span-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
