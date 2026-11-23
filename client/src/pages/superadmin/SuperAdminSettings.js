import React, { useState } from 'react';

const SuperAdminSettings = () => {
  const [systemName, setSystemName] = useState('Whistlez Systems');
  const [maxUploadLimit, setMaxUploadLimit] = useState(10); // MB
  const [supportEmail, setSupportEmail] = useState('support@whistlez.com');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    setSuccess('Settings preview updated.');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="animated-fade-in" style={{ maxWidth: '920px' }}>
      <div className="page-head">
        <div>
          <h1 className="fw-extrabold text-dark">Global System Settings</h1>
          <p className="text-muted mb-0">Preview platform settings for this visit.</p>
        </div>
      </div>

      <div className="card border-0 p-4 p-md-5 bg-white shadow-sm rounded-4">
        <form onSubmit={handleSave}>
          <h2 className="portal-form-section-title">
            <i className="bi bi-gear portal-form-icon" aria-hidden="true" /> Platform details
          </h2>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label htmlFor="platform-settings-platform-title-name" className="form-label">Platform title (required)</label>
              <input id="platform-settings-platform-title-name" 
                type="text" 
                className="form-control form-control-custom"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                required
              />
            </div>
            
            <div className="col-md-6">
              <label htmlFor="platform-settings-support-contact-email" className="form-label">Support email (required)</label>
              <input id="platform-settings-support-contact-email" 
                type="email" 
                className="form-control form-control-custom"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                required
              />
            </div>

            <div className="col-md-6">
              <label htmlFor="platform-settings-max-audio-upload-size-mb" className="form-label">Audio upload limit in MB (required)</label>
              <input id="platform-settings-max-audio-upload-size-mb" 
                type="number" 
                className="form-control form-control-custom"
                value={maxUploadLimit}
                onChange={(e) => setMaxUploadLimit(Number(e.target.value))}
                required
              />
            </div>

            <div className="col-12">
              <h2 className="portal-form-section-title mt-3">
                <i className="bi bi-shield-check portal-form-icon" aria-hidden="true" /> Availability
              </h2>
              <label htmlFor="platform-settings-maintenance" className="form-label">Maintenance mode</label>
              <div
                className={`d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 rounded-3 border ${maintenanceMode ? 'border-danger-subtle bg-danger-subtle' : 'bg-light'}`}
              >
                <div className="d-flex align-items-center gap-3">
                  <span className={`chip ${maintenanceMode ? 'chip-bad' : 'chip-ok'}`}>
                    <i className="bi bi-circle-fill" style={{ fontSize: '.5rem' }}></i>
                    {maintenanceMode ? 'Offline' : 'Online'}
                  </span>
                  <span className="small text-muted">
                    {maintenanceMode ? 'Offline - System Locked' : 'Online - Operational'}
                  </span>
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    id="platform-settings-maintenance"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="portal-form-actions border-top pt-4 mt-4">
            {success && <p className="portal-save-feedback text-success" role="status">{success}</p>}
            <button type="submit" className="btn btn-primary px-4 fw-bold border-0">
              Update preview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminSettings;
