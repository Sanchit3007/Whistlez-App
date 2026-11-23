import React, { useCallback, useState, useEffect } from 'react';
import FilterToolbar from '../../components/FilterToolbar';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import { BarTrend } from '../../components/Charts';
import IdentityAvatar from '../../components/IdentityAvatar';

const SuperAdminBusinessDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [analyticsFilter, setAnalyticsFilter] = useState('weekly');

  // Editable form states
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    phone: '',
    email: '',
    address: '',
    website: 'www.website.com',
    maxCapacity: 100,
    serviceTime: 15
  });

  const fetchDetail = useCallback(async () => {
    try {
      const res = await api.get(`/superadmin/businesses/${id}`);
      if (res.data.success) {
        const biz = res.data.business;
        setBusiness(biz);
        setStats(res.data.stats);
        setFormData({
          name: biz.name,
          category: biz.category,
          phone: biz.phone,
          email: biz.email,
          address: biz.address,
          website: biz.website || 'www.business-portal.com',
          maxCapacity: biz.maxCapacity || 150,
          serviceTime: biz.queueConfig?.serviceTime || 15
        });
      }
    } catch (err) {
      console.error('Error fetching business detail', err);
      setError('Could not retrieve business details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchDetail();
  }, [fetchDetail]);

  // Socket listener for live business queue updates
  useEffect(() => {
    if (!id) return;

    socket.emit('joinBusiness', id);

    const handleUpdate = () => {
      // live reload analytics
      fetchDetail();
    };

    socket.on('tokenUpdated', handleUpdate);

    return () => {
      socket.off('tokenUpdated', handleUpdate);
    };
  }, [id, fetchDetail]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setError('');
    setProfileFeedback(null);
    try {
      // Direct updates (Super admin updates profile details)
      const res = await api.put(`/superadmin/businesses/${id}`, {
        name: formData.name,
        category: formData.category,
        phone: formData.phone,
        address: formData.address,
        website: formData.website,
        maxCapacity: Number(formData.maxCapacity),
        queueConfig: {
          name: business.queueConfig?.name || 'General OPD Queue',
          startTime: business.queueConfig?.startTime || '09:00',
          endTime: business.queueConfig?.endTime || '18:00',
          serviceTime: Number(formData.serviceTime)
        }
      });
      if (res.data.success) {
        setProfileFeedback({ text: 'Business profile saved.' });
        setBusiness(res.data.business);
      }
    } catch (err) {
      console.error('Error updating business profile', err);
      setProfileFeedback({ error: true, text: err.response?.data?.message || 'Could not save the business profile. Try again.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`Are you absolutely sure you want to deactivate and remove ${business?.name}? This action is permanent and deletes all records.`)) {
      return;
    }
    try {
      const res = await api.delete(`/superadmin/businesses/${id}`);
      if (res.data.success) {
        alert(`${business?.name} has been successfully deactivated.`);
        navigate('/superadmin/businesses');
      }
    } catch (err) {
      console.error('Error deleting business', err);
      setError(err.response?.data?.message || 'Could not deactivate business.');
      setTimeout(() => setError(''), 5000);
    }
  };

  return (
    <div className="animated-fade-in" style={{ maxWidth: '1180px' }}>
      <nav className="d-flex align-items-center gap-2 small text-muted mb-3" aria-label="Breadcrumb">
        <button className="btn btn-link p-0 text-decoration-none text-muted fw-semibold" onClick={() => navigate('/superadmin/businesses')}>
          <i className="bi bi-arrow-left me-1"></i> Back
        </button>
        <span>/</span>
        <span>Business</span>
        <span>/</span>
        <span className="text-dark fw-semibold text-truncate">{business?.name}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1 className="fw-extrabold text-dark">{business?.name} Profile</h1>
          <p className="text-muted mb-0">Inspect operations, metrics, shift configurations, and analytics logs.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4 d-flex align-items-center py-2 shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      {/* Main Banner Graphic */}
      <div
        className="biz-hero mb-4"
        style={{
          backgroundImage: business?.backgroundImage ? `url(${business.backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="biz-hero-overlay"></div>
        <div className="biz-hero-body">
          <IdentityAvatar name={business?.name} identity={business?._id || business?.email} image={business?.logo} size={68} business />
          <div>
            <h3 className="fw-bold mb-2 text-white">{business?.name}</h3>
            <div className="d-flex flex-wrap gap-2">
              <span className="chip" style={{ background: 'rgba(255,255,255,.95)' }}>{business?.domain}</span>
              {business?.kycStatus && (
                <span className={`chip ${business.kycStatus === 'Approved' ? 'chip-ok' : business.kycStatus === 'Rejected' ? 'chip-bad' : 'chip-warn'}`}>
                  KYC: {business.kycStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tiny Analytics Metrics Summary */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card bg-white p-3 h-100">
            <span className="text-muted small">Avg. Daily Tokens</span>
            <strong className="fs-4 text-dark">
              {loading ? <span className="spinner-border spinner-border-sm text-muted"></span> : stats?.totalTokens || 0}
            </strong>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card bg-white p-3 h-100">
            <span className="text-muted small">Active Tokens</span>
            <strong className="fs-4 text-primary">
              {loading ? <span className="spinner-border spinner-border-sm text-muted"></span> : stats?.waitingTokens || 0}
            </strong>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card bg-white p-3 h-100">
            <span className="text-muted small">Completed Tokens</span>
            <strong className="fs-4 text-success">
              {loading ? <span className="spinner-border spinner-border-sm text-muted"></span> : stats?.completedTokens || 0}
            </strong>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card bg-white p-3 h-100">
            <span className="text-muted small">Missed Tokens</span>
            <strong className="fs-4 text-danger">
              {loading ? <span className="spinner-border spinner-border-sm text-muted"></span> : stats?.skippedTokens || 0}
            </strong>
          </div>
        </div>
      </div>

      {/* Information Panels Grid */}
      <form onSubmit={handleSaveChanges}>
        {loading ? (
          <div className="text-center py-5 bg-white rounded-4 border p-5 shadow-sm">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : (
          <>
        <div className="row g-4 mb-4">
          <div className="col-lg-6">
            {/* Contact Information & Operating hours */}
            <div className="card border-0 p-4 bg-white shadow-sm rounded-4 mb-4">
              <h2 className="portal-form-section-title"><i className="bi bi-telephone portal-form-icon" aria-hidden="true" /> Contact information</h2>
              <div className="mb-3">
                <label htmlFor="business-profile-street-address" className="form-label">Street address (required)</label>
                <input id="business-profile-street-address" type="text" name="address" className="form-control form-control-custom" value={formData.address} onChange={handleInputChange} required />
              </div>
              <div className="row g-2">
                <div className="col-md-6 mb-3">
                  <label htmlFor="business-profile-phone-number" className="form-label">Phone number (required)</label>
                  <input id="business-profile-phone-number" type="tel" name="phone" className="form-control form-control-custom" value={formData.phone} onChange={handleInputChange} required />
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="business-profile-email-address" className="form-label text-muted small fw-semibold">Email Address</label>
                  <input id="business-profile-email-address" type="email" name="email" className="form-control form-control-custom text-muted" value={formData.email} disabled />
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="business-profile-website" className="form-label text-muted small fw-semibold">Website</label>
                <input id="business-profile-website" type="text" name="website" className="form-control form-control-custom" value={formData.website} onChange={handleInputChange} />
              </div>
            </div>

            <div className="card border-0 p-4 bg-white shadow-sm rounded-4">
              <h2 className="portal-form-section-title"><i className="bi bi-clock portal-form-icon" aria-hidden="true" /> Operating hours</h2>
              <div className="list-group list-group-flush small">
                <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0 border-bottom">
                  <span className="text-muted">Monday - Friday</span>
                  <strong className="text-dark">{business?.queueConfig?.startTime || '09:00'} AM - {business?.queueConfig?.endTime || '18:00'} PM</strong>
                </div>
                <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0 border-bottom">
                  <span className="text-muted">Saturday</span>
                  <strong className="text-dark">09:00 AM - 08:00 PM</strong>
                </div>
                <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0">
                  <span className="text-muted">Sunday</span>
                  <strong className="text-danger fw-semibold">Emergency Services Only</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            {/* Queue Settings & Token Analytics chart */}
            <div className="card border-0 p-4 bg-white shadow-sm rounded-4 mb-4">
              <h2 className="portal-form-section-title"><i className="bi bi-gear portal-form-icon" aria-hidden="true" /> Queue settings</h2>
              <div className="row g-2">
                <div className="col-6 mb-3">
                  <label htmlFor="business-profile-max-daily-capacity" className="form-label text-muted small fw-semibold">Max Daily Capacity</label>
                  <input id="business-profile-max-daily-capacity" type="number" name="maxCapacity" className="form-control form-control-custom" value={formData.maxCapacity} onChange={handleInputChange} required />
                </div>
                <div className="col-6 mb-3">
                  <label htmlFor="business-profile-turnaround-mins" className="form-label text-muted small fw-semibold">Turnaround (mins)</label>
                  <input id="business-profile-turnaround-mins" type="number" name="serviceTime" className="form-control form-control-custom" value={formData.serviceTime} onChange={handleInputChange} required />
                </div>
              </div>
              <div>
                <label htmlFor="business-profile-announcement-setting" className="form-label">Announcement order preview</label>
                <select id="business-profile-announcement-setting" className="form-select form-control-custom" aria-describedby="announcement-preview-hint">
                  <option>Priority First</option>
                  <option>Sequential Order</option>
                </select>
                <div id="announcement-preview-hint" className="form-text">Preview the order for this visit.</div>
              </div>
            </div>

            <div className="card border-0 p-4 bg-white shadow-sm rounded-4">
              <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
                <h5 className="fw-bold text-dark mb-0">
                  <i className="bi bi-bar-chart-line text-primary me-2"></i> Token Analytics
                </h5>
                <FilterToolbar summary={analyticsFilter}>
                  {(() => {
                    const periods = ['daily', 'weekly', 'monthly', 'yearly'];
                    const currentIdx = periods.indexOf(analyticsFilter);
                    const handlePrev = () => {
                      const prevIdx = (currentIdx - 1 + periods.length) % periods.length;
                      setAnalyticsFilter(periods[prevIdx]);
                    };
                    const handleNext = () => {
                      const nextIdx = (currentIdx + 1) % periods.length;
                      setAnalyticsFilter(periods[nextIdx]);
                    };
                    const primaryColor = business?.primaryColor || 'var(--accent)';
                    return (
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-light border-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                          style={{ width: '28px', height: '28px', color: primaryColor }}
                          onClick={handlePrev}
                          title="Previous period"
                        >
                          <i className="bi bi-chevron-left fw-bold"></i>
                        </button>
                        <strong className="text-dark text-capitalize font-outfit" style={{ fontSize: '0.85rem', minWidth: '70px', textAlign: 'center' }}>
                          {analyticsFilter}
                        </strong>
                        <button
                          type="button"
                          className="btn btn-sm btn-light border-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                          style={{ width: '28px', height: '28px', color: primaryColor }}
                          onClick={handleNext}
                          title="Next period"
                        >
                          <i className="bi bi-chevron-right fw-bold"></i>
                        </button>
                      </div>
                    );
                  })()}
                </FilterToolbar>
              </div>
              
              {/* Token analytics chart */}
              {(() => {
                const currentAnalytics = stats?.analytics?.[analyticsFilter] || (
                    analyticsFilter === 'daily' ? [
                      { label: '9 AM', count: 2 },
                      { label: '10 AM', count: 4 },
                      { label: '11 AM', count: 6 },
                      { label: '12 PM', count: 3 },
                      { label: '1 PM', count: 1 },
                      { label: '2 PM', count: 5 },
                      { label: '3 PM', count: 7 },
                      { label: '4 PM', count: 4 },
                      { label: '5 PM', count: 2 },
                      { label: '6 PM', count: 0 }
                    ] : analyticsFilter === 'weekly' ? [
                      { label: 'Mon', count: 4 },
                      { label: 'Tue', count: 7 },
                      { label: 'Wed', count: 3 },
                      { label: 'Thu', count: 8 },
                      { label: 'Fri', count: 6 },
                      { label: 'Sat', count: 9 },
                      { label: 'Sun', count: 2 }
                    ] : analyticsFilter === 'monthly' ? [
                      { label: 'Week 1', count: 25 },
                      { label: 'Week 2', count: 42 },
                      { label: 'Week 3', count: 31 },
                      { label: 'Week 4', count: 50 },
                      { label: 'Week 5', count: 15 }
                    ] : [
                      { label: 'Jan', count: 120 },
                      { label: 'Feb', count: 150 },
                      { label: 'Mar', count: 180 },
                      { label: 'Apr', count: 210 },
                      { label: 'May', count: 190 },
                      { label: 'Jun', count: 240 },
                      { label: 'Jul', count: 260 },
                      { label: 'Aug', count: 230 },
                      { label: 'Sep', count: 270 },
                      { label: 'Oct', count: 290 },
                      { label: 'Nov', count: 310 },
                      { label: 'Dec', count: 340 }
                    ]
                  );
                return <BarTrend data={currentAnalytics} height={210} unit="tokens" />;
              })()}
            </div>
          </div>
        </div>

      {/* Form buttons */}
        <div className="sticky-actions d-flex flex-wrap justify-content-between align-items-center gap-2">
          {profileFeedback && <p className={`portal-save-feedback ${profileFeedback.error ? 'text-danger' : 'text-success'}`} role={profileFeedback.error ? 'alert' : 'status'}>{profileFeedback.text}</p>}
          <button 
            type="button" 
            className="btn btn-outline-danger px-4"
            onClick={handleDeactivate}
          >
            Deactivate Business
          </button>
          
          <div className="portal-form-actions">
            <button 
              type="button" 
              className="btn btn-outline-secondary px-4"
              onClick={() => navigate('/superadmin/businesses')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary px-4 border-0"
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </>
    )}
  </form>
    </div>
  );
};

export default SuperAdminBusinessDetail;
