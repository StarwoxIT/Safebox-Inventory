import { useEffect, useRef, useState } from 'react';
import { IconUpload, IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import { getCompanyProfile, updateCompanyProfile } from '../api/company';
import BackButton from '../components/BackButton';

export default function CompanyProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    getCompanyProfile()
      .then(setProfile)
      .catch(() => setError('Failed to load company profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleField = (field, value) => setProfile((prev) => ({ ...prev, [field]: value }));

  const handleAddressLine = (index, value) => {
    setProfile((prev) => {
      const lines = [...prev.addressLines];
      lines[index] = value;
      return { ...prev, addressLines: lines };
    });
  };

  const addAddressLine = () => setProfile((prev) => ({ ...prev, addressLines: [...prev.addressLines, ''] }));
  const removeAddressLine = (index) =>
    setProfile((prev) => ({ ...prev, addressLines: prev.addressLines.filter((_, i) => i !== index) }));

  const handleProductLine = (index, value) => {
    setProfile((prev) => {
      const list = [...prev.productsList];
      list[index] = value;
      return { ...prev, productsList: list };
    });
  };

  const addProductLine = () => setProfile((prev) => ({ ...prev, productsList: [...prev.productsList, ''] }));
  const removeProductLine = (index) =>
    setProfile((prev) => ({ ...prev, productsList: prev.productsList.filter((_, i) => i !== index) }));

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleField('productPhotoDataUri', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateCompanyProfile(profile);
      setProfile(updated);
      setMessage('Company profile updated. New quotation PDFs will use this content.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save company profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading">Loading company profile...</div>;
  if (!profile) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <h1 className="page-title">Company Profile</h1>
        <p className="page-subtitle">
          This content appears on the "Who We Are" page of every generated proposal PDF.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="panel form-grid">
          <label>
            Company Name
            <input value={profile.name} onChange={(e) => handleField('name', e.target.value)} required />
          </label>
          <label>
            Registration Number
            <input value={profile.regNumber || ''} onChange={(e) => handleField('regNumber', e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={profile.email || ''} onChange={(e) => handleField('email', e.target.value)} />
          </label>
          <label>
            Phone
            <input value={profile.phone || ''} onChange={(e) => handleField('phone', e.target.value)} />
          </label>

          <div className="span-2">
            <label>Address Lines</label>
            {profile.addressLines.map((line, i) => (
              <div className="repeatable-row" key={i}>
                <input value={line} onChange={(e) => handleAddressLine(i, e.target.value)} />
                <button type="button" className="icon-btn" onClick={() => removeAddressLine(i)}>
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addAddressLine}>
              <IconPlus size={14} /> Add Line
            </button>
          </div>
        </div>

        <div className="panel form-grid">
          <label className="span-2">
            Who We Are
            <textarea rows={3} value={profile.whoWeAre || ''} onChange={(e) => handleField('whoWeAre', e.target.value)} />
          </label>
          <label>
            Our Mission
            <textarea rows={3} value={profile.mission || ''} onChange={(e) => handleField('mission', e.target.value)} />
          </label>
          <label>
            Our Vision
            <textarea rows={3} value={profile.vision || ''} onChange={(e) => handleField('vision', e.target.value)} />
          </label>
        </div>

        <div className="panel">
          <h2>Products &amp; Services</h2>
          <div className="form-grid">
            <label className="span-2">
              Products Intro
              <textarea
                rows={3}
                value={profile.productsIntro || ''}
                onChange={(e) => handleField('productsIntro', e.target.value)}
              />
            </label>
            <label className="span-2">
              Products Note
              <textarea
                rows={2}
                value={profile.productsNote || ''}
                onChange={(e) => handleField('productsNote', e.target.value)}
              />
            </label>
          </div>

          <label>Product / Service List</label>
          {profile.productsList.map((item, i) => (
            <div className="repeatable-row" key={i}>
              <input value={item} onChange={(e) => handleProductLine(i, e.target.value)} />
              <button type="button" className="icon-btn" onClick={() => removeProductLine(i)}>
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addProductLine}>
            <IconPlus size={14} /> Add Item
          </button>
        </div>

        <div className="panel">
          <h2>Page Photo</h2>
          <p className="page-subtitle">Shown alongside the products section on the profile page.</p>
          {profile.productPhotoDataUri && (
            <img src={profile.productPhotoDataUri} alt="Company" className="profile-photo-preview" />
          )}
          <div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <IconUpload size={16} /> Upload New Photo
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          <IconDeviceFloppy size={16} /> {saving ? 'Saving...' : 'Save Company Profile'}
        </button>
      </form>
    </div>
  );
}
