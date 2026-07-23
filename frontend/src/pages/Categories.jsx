import { useEffect, useState } from 'react';
import { IconPlus, IconTrash, IconTags, IconX } from '@tabler/icons-react';
import { listCategories, createCategory, updateCategory, deleteCategory, listUnits, createUnit, deleteUnit } from '../api/categories';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import usePagination from '../hooks/usePagination';
import BackButton from '../components/BackButton';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [categorySubs, setCategorySubs] = useState('');
  const [unitName, setUnitName] = useState('');
  const [error, setError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editSubs, setEditSubs] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listCategories(), listUnits()])
      .then(([c, u]) => { setCategories(c); setUnits(u); })
      .catch(() => setError('Failed to load categories.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toSubList = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

  const openAddCategoryModal = () => {
    setCategoryName('');
    setCategorySubs('');
    setError('');
    setShowAddCategoryModal(true);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createCategory({ name: categoryName, subcategories: toSubList(categorySubs) });
      setCategoryName('');
      setCategorySubs('');
      setShowAddCategoryModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add category.');
    }
  };

  const openEditSubs = (c) => {
    setEditingCategory(c);
    setEditSubs((c.subcategories || []).map((s) => s.name).join(', '));
  };

  const handleSaveSubs = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateCategory(editingCategory.id, { subcategories: toSubList(editSubs) });
      setEditingCategory(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update sub-categories.');
    }
  };

  const categoriesPagination = usePagination(categories, 10);
  const unitsPagination = usePagination(units, 10);

  const openAddUnitModal = () => {
    setUnitName('');
    setError('');
    setShowAddUnitModal(true);
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createUnit({ name: unitName });
      setUnitName('');
      setShowAddUnitModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add unit.');
    }
  };

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader icon={IconTags} title="Categories & Units" subtitle="Lookups used across the product catalog." />
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="panel">
        <div className="page-header-row">
          <h2>Categories</h2>
          <button type="button" className="btn btn-secondary" onClick={openAddCategoryModal}>
            <IconPlus size={16} /> Add Category
          </button>
        </div>
        {loading ? (
          <SkeletonRows rows={3} columns={2} />
        ) : categories.length === 0 ? (
          <EmptyState title="No categories yet" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Sub-Categories</th><th /></tr></thead>
              <tbody>
                {categoriesPagination.paginated.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.subcategories?.map((s) => s.name).join(', ') || '-'}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="icon-btn" title="Edit sub-categories" aria-label="Edit sub-categories" onClick={() => openEditSubs(c)}>
                        <IconPlus size={18} />
                      </button>
                      <button className="icon-btn" title="Delete" aria-label="Delete category" onClick={() => deleteCategory(c.id).then(load)}>
                        <IconTrash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={categoriesPagination.page} totalPages={categoriesPagination.totalPages} onPageChange={categoriesPagination.setPage} />
          </div>
        )}
        {editingCategory && (
          <div className="dialog-overlay" onClick={() => setEditingCategory(null)}>
            <div className="dialog-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2 className="dialog-title">Sub-Categories for {editingCategory.name}</h2>
              <form onSubmit={handleSaveSubs}>
                <label>
                  Sub-Categories (comma-separated)
                  <textarea value={editSubs} onChange={(e) => setEditSubs(e.target.value)} rows={3} style={{ width: '100%' }} />
                </label>
                <div className="dialog-actions" style={{ marginTop: 12 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingCategory(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showAddCategoryModal && (
          <div className="dialog-overlay">
            <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="add-category-title">
              <div className="dialog-header-row">
                <h2 className="dialog-title" id="add-category-title">Add Category</h2>
                <button type="button" className="icon-btn" onClick={() => setShowAddCategoryModal(false)} aria-label="Close">
                  <IconX size={18} />
                </button>
              </div>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <form className="form-grid" onSubmit={handleAddCategory}>
                <label>
                  New Category
                  <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                </label>
                <label>
                  Sub-Categories (comma-separated)
                  <input value={categorySubs} onChange={(e) => setCategorySubs(e.target.value)} placeholder="e.g. Lithium (LiFePO4), Lead Acid (AGM), Gel" />
                </label>
                <div className="span-2 dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddCategoryModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="page-header-row">
          <h2>Units</h2>
          <button type="button" className="btn btn-secondary" onClick={openAddUnitModal}>
            <IconPlus size={16} /> Add Unit
          </button>
        </div>
        {units.length === 0 ? (
          <EmptyState title="No units yet" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th /></tr></thead>
              <tbody>
                {unitsPagination.paginated.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>
                      <button className="icon-btn" title="Delete" aria-label="Delete unit" onClick={() => deleteUnit(u.id).then(load)}>
                        <IconTrash size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={unitsPagination.page} totalPages={unitsPagination.totalPages} onPageChange={unitsPagination.setPage} />
          </div>
        )}
        {showAddUnitModal && (
          <div className="dialog-overlay">
            <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="add-unit-title">
              <div className="dialog-header-row">
                <h2 className="dialog-title" id="add-unit-title">Add Unit</h2>
                <button type="button" className="icon-btn" onClick={() => setShowAddUnitModal(false)} aria-label="Close">
                  <IconX size={18} />
                </button>
              </div>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <form className="form-grid" onSubmit={handleAddUnit}>
                <label className="span-2">
                  New Unit
                  <input value={unitName} onChange={(e) => setUnitName(e.target.value)} required />
                </label>
                <div className="span-2 dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddUnitModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
