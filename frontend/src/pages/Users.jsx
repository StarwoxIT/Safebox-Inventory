import { useEffect, useState } from 'react';
import { IconTrash, IconEdit, IconUsers, IconPlus, IconX } from '@tabler/icons-react';
import { register } from '../api/auth';
import { listUsers, updateUser, deleteUser } from '../api/users';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import BackButton from '../components/BackButton';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'admin', status: 'Active' });

  const loadUsers = () => {
    setLoading(true);
    listUsers()
      .then(setUsers)
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const openAddModal = () => {
    setForm({ name: '', email: '', password: '', role: 'admin' });
    setError('');
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await register(form);
      setMessage(`User ${form.name} created successfully.`);
      setForm({ name: '', email: '', password: '', role: 'admin' });
      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({ name: u.name, role: u.role, status: u.status });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateUser(editingUser.id, editForm);
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user.');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setError('');
    try {
      await deleteUser(pendingDelete.id);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove user.');
    } finally {
      setPendingDelete(null);
    }
  };

  const { page, setPage, totalPages, paginated } = usePagination(users, 10);

  return (
    <div>
      <BackButton alwaysTo="/" label="Back to Dashboard" />
      <PageHeader
        icon={IconUsers}
        title="Users"
        subtitle="Create new team members and manage their access."
        actions={
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <IconPlus size={16} /> Add User
          </button>
        }
      />

      {message && <div className="alert alert-success" role="status">{message}</div>}
      {error && !showAddModal && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="panel">
        <h2>All Users</h2>
        {loading ? (
          <div className="page-loading">Loading users...</div>
        ) : (
          <table className="editor-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paginated.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <StatusBadge type="role" value={u.role} />
                  </td>
                  <td>
                    <StatusBadge type="userStatus" value={u.status} />
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="icon-btn" onClick={() => openEdit(u)} title="Edit user" aria-label="Edit user">
                      <IconEdit size={18} />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button className="icon-btn" onClick={() => setPendingDelete(u)} title="Remove user" aria-label="Remove user">
                        <IconTrash size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {showAddModal && (
        <div className="dialog-overlay">
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
            <div className="dialog-header-row">
              <h2 className="dialog-title" id="add-user-title">Add User</h2>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Full Name
                <input name="name" value={form.name} onChange={handleChange} required />
              </label>
              <label>
                Email
                <input type="email" name="email" value={form.email} onChange={handleChange} required />
              </label>
              <label htmlFor="new-user-password">
                Password
                <PasswordInput
                  id="new-user-password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Role
                <select name="role" value={form.role} onChange={handleChange}>
                  <option value="admin">Admin (day-to-day access)</option>
                  <option value="super_admin">Super Admin (full access + approvals)</option>
                </select>
              </label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="dialog-overlay" onClick={() => setEditingUser(null)}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Edit {editingUser.name}</h2>
            <form className="form-grid" onSubmit={handleEditSubmit}>
              <label className="span-2">
                Full Name
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </label>
              <label>
                Role
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={editingUser.id === currentUser?.id}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  disabled={editingUser.id === currentUser?.id}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
              <div className="span-2 dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove user?"
        body={`Remove ${pendingDelete?.name} (${pendingDelete?.email})? They will lose access immediately.`}
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
