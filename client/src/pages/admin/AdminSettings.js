import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../context/AuthContext';
import FormDialog from '../../components/FormDialog';
import UnsavedChanges from '../../components/UnsavedChanges';
import { verificationDocuments } from '../../utils/businessStatus';
import './AdminSettings.css';

const getProfileForm = (business = {}) => ({
  name: business.name || '',
  category: business.category || '',
  phone: business.phone || '',
  address: business.address || '',
  city: business.city || '',
  state: business.state || '',
  zipCode: business.zipCode || '',
  primaryColor: business.primaryColor || '#0d6efd',
  website: business.website || '',
  queueConfigName: business.queueConfig?.name || '',
  startTime: business.queueConfig?.startTime || '',
  endTime: business.queueConfig?.endTime || '',
  serviceTime: business.queueConfig?.serviceTime || 15
});

const escapePrintText = value => String(value).replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[char]));

const ProfileSummary = ({ rows }) => (
  <dl className="settings-profile-summary">
    {rows.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value || 'Not set'}</dd>
      </div>
    ))}
  </dl>
);

const AdminSettings = () => {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrFeedback, setQrFeedback] = useState(null);
  const [viewQr, setViewQr] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);
  const profileEditButton = useRef(null);
  const profileForm = useRef(null);

  const [copyStatus, setCopyStatus] = useState('');
  const fileInputRef = useRef(null);
  const copyTimeout = useRef(null);
  const hasQr = Boolean(business?.qrCode);

  useEffect(() => () => clearTimeout(copyTimeout.current), []);

  const handleCopyCode = async () => {
    if (!business?.uniqueQrCode) return;
    clearTimeout(copyTimeout.current);
    try {
      await navigator.clipboard.writeText(business.uniqueQrCode);
      setCopyStatus('copied');
      copyTimeout.current = setTimeout(() => setCopyStatus(''), 2000);
    } catch {
      setCopyStatus('failed');
    }
  };

  const [editForm, setEditForm] = useState(() => getProfileForm());

  const fetchBusiness = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/business');
      if (res.data.success) {
        setBusiness(res.data.business);
      }
    } catch (err) {
      console.error('Error fetching settings', err);
      setError('Could not fetch business configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusiness();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const finishProfileEdit = () => {
    setEditingProfile(false);
    requestAnimationFrame(() => profileEditButton.current?.focus());
  };

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    if (savingSettings || !editingProfile) return false;
    setSavingSettings(true);
    setSettingsFeedback(null);
    setError('');

    try {
      const res = await api.put('/admin/business', {
        name: editForm.name,
        category: editForm.category,
        phone: editForm.phone,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        zipCode: editForm.zipCode,
        primaryColor: editForm.primaryColor,
        website: editForm.website,
        queueConfig: {
          name: editForm.queueConfigName,
          startTime: editForm.startTime,
          endTime: editForm.endTime,
          serviceTime: Number(editForm.serviceTime)
        }
      });

      if (res.data.success) {
        setSettingsFeedback({ text: 'Business profile and queue settings saved.' });
        setBusiness(res.data.business);
        finishProfileEdit();
        return true;
      } else {
        setSettingsFeedback({ error: true, text: res.data.message || 'Could not save settings. Try again.' });
      }
    } catch (err) {
      console.error('Error updating configurations', err);
      setSettingsFeedback({ error: true, text: err.response?.data?.message || 'Could not save settings. Try again.' });
    } finally {
      setSavingSettings(false);
    }
    return false;
  };

  const updateQr = async (request, message, fallback) => {
    if (qrLoading) return;
    setQrLoading(true);
    setQrFeedback(null);
    setCopyStatus('');
    try {
      const { data } = await request();
      if (!data.success || !data.business) {
        setQrFeedback({ error: true, text: data.message || fallback });
        return;
      }
      setBusiness(data.business);
      setQrFeedback({ text: message });
    } catch (err) {
      setQrFeedback({ error: true, text: err.response?.data?.message || fallback });
    } finally {
      setQrLoading(false);
    }
  };

  const handleGenerateQR = () => updateQr(
    () => api.post('/admin/business/qr/generate'),
    hasQr ? 'New QR code saved.' : 'QR code generated and saved.',
    'Could not generate the QR code.'
  );

  const handleCustomQRUpload = (event) => {
    const file = event.currentTarget.files[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setQrFeedback({ error: true, text: 'Choose an image file for the QR code.' });
      return;
    }

    updateQr(async () => {
      const qrCode = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the image. Try the upload again.'));
        reader.readAsDataURL(file);
      });
      return api.put('/admin/business/qr', { qrCode });
    }, 'Custom QR code uploaded and saved.', 'Could not upload the QR code.');
  };

  const handleRemoveQR = () => {
    if (!window.confirm('Are you sure you want to remove the QR Code from your business?')) return;
    updateQr(() => api.delete('/admin/business/qr'), 'QR code removed.', 'Could not remove the QR code.');
  };

  // Download QR as PNG image
  const handleDownloadQR = () => {
    if (!business?.qrCode) return;
    const link = document.createElement('a');
    link.href = business.qrCode;
    link.download = `${(business.name || 'Business').replace(/\s+/g, '_')}_QRCode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Counter Standee
  const handlePrintQRStandee = () => {
    if (!business?.qrCode) return;
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) {
      setQrFeedback({ error: true, text: 'Allow pop-ups for this site to open the print standee.' });
      return;
    }
    const name = escapePrintText(business.name || 'Business');
    const category = escapePrintText(business.category || 'Service Queue');
    const qrImage = escapePrintText(business.qrCode);
    const qrId = business.uniqueQrCode ? escapePrintText(business.uniqueQrCode) : '';
    const color = /^#[\da-f]{6}$/i.test(business.primaryColor || '') ? business.primaryColor : '#0d6efd';
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Standee - ${name}</title>
          <style>
            body { font-family: 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: #fff; }
            .card { max-width: 480px; margin: 0 auto; border: 3px solid ${color}; border-radius: 24px; padding: 36px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
            .logo-text { font-size: 26px; font-weight: 800; color: #111; margin-bottom: 4px; }
            .category { font-size: 14px; text-transform: uppercase; color: #666; font-weight: 600; letter-spacing: 1px; margin-bottom: 16px; }
            .qr-frame { background: #fff; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 16px; border: 1px solid #e9ecef; }
            .qr-img { width: 260px; height: 260px; display: block; }
            .code-badge { font-family: monospace; font-size: 14px; font-weight: 700; color: #333; background: #e9ecef; padding: 6px 14px; border-radius: 8px; display: inline-block; margin-bottom: 16px; }
            .instruction-heading { font-size: 18px; font-weight: 700; color: #222; margin-bottom: 4px; }
            .instruction-sub { font-size: 13px; color: #666; margin-bottom: 20px; }
            .badge { background: ${color}; color: #fff; padding: 8px 18px; border-radius: 50px; font-weight: 700; font-size: 13px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo-text">${name}</div>
            <div class="category">${category}</div>
            <div class="qr-frame">
              <img class="qr-img" src="${qrImage}" alt="QR Code" />
            </div>
            ${qrId ? `<div class="code-badge">ID: ${qrId}</div>` : ''}
            <div class="instruction-heading">Scan to Request Token on Mobile</div>
            <div class="instruction-sub">Point your mobile camera or open WhistleApp to view live wait-times and check-in instantly.</div>
            <div><span class="badge">WhistleApp Digital Check-in</span></div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const profile = getProfileForm(business || undefined);
  const needsKycCorrection = ['Rejected', 'Resubmission Required'].includes(business?.kycStatus);
  const corrections = business?.kycDetails?.documentCorrections || [];

  return (
    <div className="animated-fade-in" style={{ maxWidth: '900px' }}>
      <div className="mb-4">
        <h1 className="fw-extrabold text-dark mb-1">Configuration Settings</h1>
        <p className="text-muted">Customize your business details, generate QR codes, and configure queue preferences.</p>
      </div>

      {error && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4 d-flex align-items-center py-2 shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      <section className="card settings-qr-section mb-4" aria-labelledby="settings-business-qr">
        <header className="settings-qr-heading">
          <div>
            <h2 id="settings-business-qr">Business Mobile QR Code</h2>
            <p className="small text-muted mb-0">Manage the QR code linked to your business queue.</p>
          </div>
          <span className={`badge rounded-pill ${hasQr ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
            <i className={`bi bi-${hasQr ? 'check-circle-fill' : 'dash-circle'} me-1`} aria-hidden="true" />
            {hasQr ? 'QR saved' : 'No QR code yet'}
          </span>
        </header>
        <div className="settings-qr-layout">
          <div className="settings-qr-preview">
            {hasQr ? (
              <>
                <div className="settings-qr-backing">
                  <img src={business.qrCode} alt={`Queue QR code for ${business.name || 'this business'}`} />
                </div>
                <p className="settings-qr-business">{business.name}</p>
                {business.uniqueQrCode && (
                  <div className="settings-qr-copy">
                    <code aria-label="QR ID">{business.uniqueQrCode}</code>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleCopyCode} aria-label="Copy QR ID">
                      <i className={`bi bi-${copyStatus === 'copied' ? 'check-lg' : 'clipboard'}`} aria-hidden="true" />
                      {copyStatus === 'copied' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
                <span className="visually-hidden" role="status">{copyStatus === 'copied' ? 'QR ID copied.' : ''}</span>
                {copyStatus === 'failed' && <p className="small text-warning mb-0" role="status">Select the QR ID to copy it manually.</p>}
                {business.qrGeneratedAt && (
                  <p className="small text-muted mb-0">Saved {new Date(business.qrGeneratedAt).toLocaleDateString()}</p>
                )}
              </>
            ) : (
              <div className="settings-qr-empty">
                <i className="bi bi-qr-code" aria-hidden="true" />
                <p className="fw-semibold mb-0">No QR to show</p>
              </div>
            )}
          </div>

          <div className="settings-qr-actions">
            {hasQr && (
              <div className="settings-qr-use" role="group" aria-label="Use the saved QR code">
                <button type="button" className="btn btn-primary settings-qr-view-button" onClick={() => setViewQr(true)} disabled={qrLoading} aria-haspopup="dialog">
                  <i className="bi bi-qr-code" aria-hidden="true" /> View QR
                </button>
                <button type="button" className="btn btn-outline-primary" onClick={handleDownloadQR} disabled={qrLoading}>
                  <i className="bi bi-download" aria-hidden="true" /> Download PNG
                </button>
                <button type="button" className="btn btn-outline-primary" onClick={handlePrintQRStandee} disabled={qrLoading}>
                  <i className="bi bi-printer" aria-hidden="true" /> Print Standee
                </button>
              </div>
            )}
            <p id="settings-qr-manage-help" className="small text-muted mb-0">
              Generate a QR code or upload your own branded image. Changes are saved to your business profile.
            </p>
            <div className="settings-qr-manage" role="group" aria-label="Replace or create a QR code" aria-describedby="settings-qr-manage-help">
              <button type="button" className={`btn ${hasQr ? 'btn-outline-secondary' : 'btn-primary'}`} onClick={handleGenerateQR} disabled={qrLoading || !business}>
                <i className="bi bi-magic" aria-hidden="true" /> {hasQr ? 'Regenerate QR Code' : 'Generate QR Code'}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => fileInputRef.current?.click()} disabled={qrLoading || !business}>
                <i className="bi bi-upload" aria-hidden="true" /> Upload Custom QR
              </button>
              <input type="file" ref={fileInputRef} className="d-none" accept="image/*" onChange={handleCustomQRUpload} aria-label="Choose a custom QR image" />
            </div>
            {hasQr && (
              <div className="settings-qr-remove">
                <button type="button" className="btn btn-outline-danger" onClick={handleRemoveQR} disabled={qrLoading}>
                  <i className="bi bi-trash3" aria-hidden="true" /> Remove QR
                </button>
              </div>
            )}
            {qrLoading && <p className="small text-muted mb-0" role="status">Updating the QR code…</p>}
            {qrFeedback && (
              <p className={`small mb-0 ${qrFeedback.error ? 'text-danger' : 'text-success'}`} role={qrFeedback.error ? 'alert' : 'status'}>
                {qrFeedback.text}
              </p>
            )}
            <div className="settings-qr-mobile-tip">
              <i className="bi bi-info-circle" aria-hidden="true" />
              <p className="small mb-0">
                <strong>Mobile check-in.</strong> Customers scan the QR with their phone to open your business queue and request a token.
                Show it on-screen with <strong>View QR</strong> or place a printed standee at the counter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {needsKycCorrection && (
        <section className="card p-3 p-md-4 mb-4" aria-labelledby="settings-kyc-heading">
          <h2 id="settings-kyc-heading" className="portal-form-section-title"><i className="bi bi-file-earmark-text portal-form-icon" aria-hidden="true" /> KYC corrections</h2>
          {business.kycDetails?.rejectionReason && <p>{business.kycDetails.rejectionReason}</p>}
          {corrections.length ? (
            <ul className="list-unstyled mb-0">
              {verificationDocuments.filter(doc => corrections.some(item => item.docType === doc.type)).map(doc => (
                <li className="d-flex flex-wrap gap-2 justify-content-between align-items-center border-top pt-2 mb-2" key={doc.type}>
                  <div><strong>{doc.label}</strong><p className="text-muted small mb-0">{corrections.find(item => item.docType === doc.type).reason}</p></div>
                  <Link className="btn btn-outline-primary" to={`/admin/kyc#${doc.id}`}>Replace {doc.label}</Link>
                </li>
              ))}
            </ul>
          ) : <Link className="btn btn-outline-primary align-self-start" to="/admin/kyc">Review KYC details</Link>}
        </section>
      )}

      {/* BUSINESS PROFILE INFO */}
      <div className="card border-0 p-4 p-md-5 bg-white shadow-sm rounded-4">
        <div className="settings-profile-header">
          <h2 className="portal-form-section-title mb-0">
            <i className="bi bi-shop portal-form-icon" aria-hidden="true" /> Business profile
          </h2>
          {!editingProfile && business && (
            <button ref={profileEditButton} type="button" className="btn btn-outline-primary" onClick={() => {
              setEditForm(getProfileForm(business));
              setSettingsFeedback(null);
              setEditingProfile(true);
            }}>
              <i className="bi bi-pencil me-1" aria-hidden="true" /> Edit
            </button>
          )}
        </div>
        {settingsFeedback && !editingProfile && <p className="text-success small mt-3 mb-0" role="status">{settingsFeedback.text}</p>}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : editingProfile ? (
          <form ref={profileForm} onSubmit={handleSaveSettings}>
            <p className="portal-file-detail mt-3">All fields are required except the accent color.</p>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label htmlFor="business-settings-business-name" className="form-label">Business name (required)</label>
                <input id="business-settings-business-name"
                  autoFocus
                  type="text"
                  name="name"
                  className="form-control form-control-custom"
                  value={editForm.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="business-settings-sub-category-speciality" className="form-label small fw-semibold text-muted">Sub-category / Speciality</label>
                <input id="business-settings-sub-category-speciality"
                  type="text"
                  name="category"
                  className="form-control form-control-custom"
                  value={editForm.category}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="business-settings-outlet-phone-number" className="form-label small fw-semibold text-muted">Outlet Phone Number</label>
                <input id="business-settings-outlet-phone-number"
                  type="tel"
                  name="phone"
                  className="form-control form-control-custom"
                  value={editForm.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="business-settings-accent-hex" className="form-label">Accent color</label>
                <div className="d-flex align-items-center">
                  <input
                    type="color"
                    aria-label="Choose accent color"
                    name="primaryColor"
                    className="form-control form-control-color me-2 border-0"
                    style={{ width: '48px', flexShrink: 0 }}
                    value={editForm.primaryColor}
                    onChange={handleInputChange}
                  />
                  <input
                    id="business-settings-accent-hex"
                    type="text"
                    name="primaryColor"
                    className="form-control form-control-custom font-monospace"
                    value={editForm.primaryColor}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="col-12">
                <label htmlFor="business-settings-street-address" className="form-label small fw-semibold text-muted">Street Address</label>
                <input id="business-settings-street-address"
                  type="text"
                  name="address"
                  className="form-control form-control-custom"
                  value={editForm.address}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label htmlFor="business-settings-city" className="form-label small fw-semibold text-muted">City</label>
                <input id="business-settings-city"
                  type="text"
                  name="city"
                  className="form-control form-control-custom"
                  value={editForm.city}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label htmlFor="business-settings-state" className="form-label small fw-semibold text-muted">State</label>
                <input id="business-settings-state"
                  type="text"
                  name="state"
                  className="form-control form-control-custom"
                  value={editForm.state}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-4">
                <label htmlFor="business-settings-zip-code" className="form-label small fw-semibold text-muted">Zip Code</label>
                <input id="business-settings-zip-code"
                  type="text"
                  name="zipCode"
                  className="form-control form-control-custom"
                  value={editForm.zipCode}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <h2 className="portal-form-section-title mt-5">
              <i className="bi bi-clock-history portal-form-icon" aria-hidden="true" /> Queue settings and schedule
            </h2>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label htmlFor="business-settings-queue-display-name" className="form-label small fw-semibold text-muted">Queue Display Name</label>
                <input id="business-settings-queue-display-name"
                  type="text"
                  name="queueConfigName"
                  className="form-control form-control-custom"
                  value={editForm.queueConfigName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="business-settings-average-turnaround-time-minutes" className="form-label small fw-semibold text-muted">Average Turnaround Time (Minutes)</label>
                <input id="business-settings-average-turnaround-time-minutes"
                  type="number"
                  name="serviceTime"
                  className="form-control form-control-custom"
                  value={editForm.serviceTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="business-settings-shift-start-time" className="form-label small fw-semibold text-muted">Shift Start Time</label>
                <input id="business-settings-shift-start-time"
                  type="time"
                  name="startTime"
                  className="form-control form-control-custom"
                  value={editForm.startTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="business-settings-shift-end-time" className="form-label small fw-semibold text-muted">Shift End Time</label>
                <input id="business-settings-shift-end-time"
                  type="time"
                  name="endTime"
                  className="form-control form-control-custom"
                  value={editForm.endTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="portal-form-actions border-top pt-4 mt-4">
              {settingsFeedback && <p className={`portal-save-feedback ${settingsFeedback.error ? 'text-danger' : 'text-success'}`} role={settingsFeedback.error ? 'alert' : 'status'}>{settingsFeedback.text}</p>}
              <button type="button" className="btn btn-outline-secondary px-4" disabled={savingSettings} onClick={() => {
                setSettingsFeedback(null);
                finishProfileEdit();
              }}>Cancel</button>
              <button
                type="submit"
                className="btn btn-premium btn-premium-primary px-5 py-2.5 shadow-sm fw-bold"
                disabled={savingSettings}
              >
                {savingSettings ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : business && (
          <>
            <ProfileSummary rows={[
              ['Business name', profile.name], ['Sub-category / Speciality', profile.category],
              ['Outlet phone number', profile.phone], ['Accent color', profile.primaryColor],
              ['Street address', profile.address], ['City', profile.city],
              ['State', profile.state], ['Zip code', profile.zipCode]
            ]} />
            <h2 className="portal-form-section-title mt-4">
              <i className="bi bi-clock-history portal-form-icon" aria-hidden="true" /> Queue settings and schedule
            </h2>
            <ProfileSummary rows={[
              ['Queue display name', profile.queueConfigName], ['Average turnaround time', `${profile.serviceTime} min`],
              ['Shift start time', profile.startTime], ['Shift end time', profile.endTime]
            ]} />
          </>
        )}
      </div>
      {viewQr && business?.qrCode && (
        <FormDialog labelledBy="settings-qr-view-title" className="settings-qr-view" onClose={() => setViewQr(false)}>
          <header className="settings-qr-view-header">
            <h2 id="settings-qr-view-title">Business QR code</h2>
            <button type="button" className="settings-qr-view-close" aria-label="Close QR view" onClick={() => setViewQr(false)}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </header>
          <div className="settings-qr-view-content">
            <div className="settings-qr-view-image">
              <img src={business.qrCode} alt={`Scan to join the queue at ${business.name || 'this business'}`} />
            </div>
            <p className="settings-qr-view-name">{business.name}</p>
            {business.uniqueQrCode && <code className="settings-qr-view-code">{business.uniqueQrCode}</code>}
          </div>
        </FormDialog>
      )}
      <UnsavedChanges
        dirty={editingProfile && Object.keys(profile).some(key => String(profile[key]) !== String(editForm[key]))}
        onSave={() => profileForm.current?.reportValidity() && handleSaveSettings()}
      />
    </div>
  );
};

export default AdminSettings;

