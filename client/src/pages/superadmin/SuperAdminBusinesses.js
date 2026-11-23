import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import IdentityAvatar from '../../components/IdentityAvatar';
import { PENDING_VERIFICATION } from '../../utils/businessStatus';

const SuperAdminBusinesses = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const pendingVerification = new URLSearchParams(search).get('status') === 'pending-verification';
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [kycFilter, setKycFilter] = useState('all');
  const [urlFilter, setUrlFilter] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const filterType = params.get('filter');
    const filterVal = params.get('value');
    const filterLabel = params.get('label');
    
    if (filterType && filterVal) {
      setUrlFilter({
        type: filterType,
        value: filterVal,
        label: filterLabel || filterVal
      });
    } else {
      setUrlFilter(null);
    }
  }, [search]);

  const fetchBusinesses = async () => {
    try {
      const res = await api.get('/superadmin/businesses');
      if (res.data.success) {
        setBusinesses(res.data.businesses);
      }
    } catch (err) {
      console.error('Error fetching businesses list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  // Socket listener for real-time businesses updates
  useEffect(() => {
    socket.emit('joinSuperAdmin');

    const handleUpdate = () => {
      fetchBusinesses();
    };

    socket.on('businessesUpdated', handleUpdate);

    return () => {
      socket.off('businessesUpdated', handleUpdate);
    };
  }, []);

  const filteredBusinesses = businesses.filter((b) => {
    if (pendingVerification && b.businessStatus !== PENDING_VERIFICATION) return false;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = [b.name, b.domain].some(value => value?.toLowerCase().includes(query));
    
    if (urlFilter) {
      const createdDate = new Date(b.createdAt);
      if (urlFilter.type === 'daily') {
        const todayStr = new Date().toDateString();
        return matchesSearch && 
               createdDate.toDateString() === todayStr && 
               createdDate.getHours() === Number(urlFilter.value);
      } else if (urlFilter.type === 'weekly') {
        return matchesSearch && createdDate.toDateString() === urlFilter.value;
      } else if (urlFilter.type === 'monthly') {
        const [year, month] = urlFilter.value.split('-').map(Number);
        return matchesSearch && 
               createdDate.getFullYear() === year && 
               createdDate.getMonth() === month;
      } else if (urlFilter.type === 'yearly') {
        return matchesSearch && createdDate.getFullYear() === Number(urlFilter.value);
      }
    }

    let matchesTime = true;
    if (timeFilter !== 'all') {
      const createdDate = new Date(b.createdAt);
      const now = new Date();
      if (timeFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesTime = createdDate >= oneWeekAgo;
      } else if (timeFilter === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesTime = createdDate >= oneMonthAgo;
      }
    }

    let matchesKyc = true;
    const status = b.kycStatus || 'Pending';
    if (kycFilter === 'Pending') matchesKyc = status === 'Pending';
    else if (kycFilter === 'Submitted') matchesKyc = status === 'Submitted' || status === 'Under Review';
    else if (kycFilter === 'Approved') matchesKyc = status === 'Approved';
    else if (kycFilter === 'Rejected') matchesKyc = status === 'Rejected' || status === 'Resubmission Required';

    return matchesSearch && matchesTime && matchesKyc;
  });

  return (
    <div className="animated-fade-in">
      <div className="workspace-heading">
        <div>
          <h1 className="fw-extrabold text-dark mb-1">Business Clients</h1>
          <p className="text-muted mb-0">Find businesses and manage their queue settings.</p>
        </div>
      </div>

      {pendingVerification && (
        <div className="card p-3 mb-3 d-flex flex-row flex-wrap align-items-center justify-content-between gap-2">
          <strong>Awaiting verification</strong>
          <Link className="btn btn-outline-primary btn-sm" to="/superadmin/businesses">Show all businesses</Link>
        </div>
      )}

      {/* Active URL Filter Banner */}
      {urlFilter && (
        <div className="alert alert-info border-0 rounded-4 shadow-sm p-3 mb-4 d-flex flex-wrap gap-2 justify-content-between align-items-center" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <div>
            <i className="bi bi-funnel-fill me-2 fs-5"></i>
            Showing businesses registered in <strong>{urlFilter.label}</strong> (growth chart selection)
          </div>
          <button 
            className="btn btn-sm btn-outline-primary fw-bold text-uppercase rounded-3 px-3 py-1" 
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            onClick={() => navigate('/superadmin/businesses')}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Search Header */}
      <div className="card p-3 p-md-4 mb-4">
        <div className="workspace-filters business-filters">
          <label className="workspace-field business-search">
            <span>Search businesses</span>
            <input 
              type="search"
              className="form-control"
              placeholder="Business name or domain"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <label className="workspace-field">
            <span>Registration period</span>
            <select 
              className="form-select"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </label>
          <label className="workspace-field">
            <span>KYC status</span>
            <select 
              className="form-select"
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
            >
              <option value="all">All KYC Status</option>
              <option value="Pending">Pending KYC</option>
              <option value="Submitted">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
        </div>
      </div>

      {/* Grid of Business Cards */}
      <div className="row g-4">
        {loading ? (
          <div className="col-12 text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        ) : filteredBusinesses.length > 0 ? (
          filteredBusinesses.map((b) => (
            <div className="col-12 col-md-6 col-xxl-4" key={b._id}>
              <div className="card business-directory-card bg-white p-3 p-md-4 h-100 d-flex flex-column justify-content-between border-top" style={{ borderTopColor: b.primaryColor || 'var(--accent)' }}>
                <div>
                  <div className="d-flex align-items-center mb-3">
                    <IdentityAvatar name={b.name} identity={b._id || b.email} image={b.logo} size={44} business className="me-3" />
                    <div className="business-identity">
                      <h2 className="h5 fw-bold text-dark mb-0">{b.name}</h2>
                      <span className="text-muted small d-block">{b.domain}</span>
                    </div>
                  </div>

                  <div className="list-group list-group-flush border-top pt-2 mb-4 small">
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0">
                      <span className="text-muted">Owner</span>
                      <strong className="text-dark">{b.admin?.name || 'N/A'}</strong>
                    </div>
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0 align-items-center">
                      <span className="text-muted">KYC Status</span>
                      <span className={`badge rounded-pill ${b.kycStatus === 'Approved' ? 'bg-success' : b.kycStatus === 'Submitted' || b.kycStatus === 'Under Review' ? 'bg-warning text-dark' : b.kycStatus === 'Rejected' || b.kycStatus === 'Resubmission Required' ? 'bg-danger' : 'bg-secondary'}`} style={{ fontSize: '0.7rem' }}>
                        {b.kycStatus || 'Pending'}
                      </span>
                    </div>
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0">
                      <span className="text-muted">Domain</span>
                      <strong className="text-dark">{b.domain || 'N/A'}</strong>
                    </div>
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0">
                      <span className="text-muted">Location</span>
                      <strong className="text-dark">{b.city}, {b.state}</strong>
                    </div>
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0">
                      <span className="text-muted">Registered</span>
                      <strong className="text-dark">{new Date(b.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-auto">
                  <button 
                    className="btn btn-outline-primary workspace-primary w-100"
                    onClick={() => navigate(`/superadmin/businesses/${b._id}`)}
                  >
                    Manage business
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-12 text-center py-5 text-muted bg-white rounded-4 border shadow-sm">
            <i className="bi bi-shop fs-1 mb-2 text-muted d-block"></i>
            No business clients found matching your search.
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminBusinesses;
