import React, { useState } from 'react';
import { api } from '../../context/AuthContext';
import ReportFilterToolbar from '../../components/ReportFilterToolbar';
import { downloadCsv } from '../../utils/downloadCsv';
import { useReportFilters } from '../../utils/reportFilterSession';

const defaultFilters = { searchQuery: '', userRole: 'all', businessStatus: 'all', adStatus: 'all' };

const SuperAdminReports = () => {
  const [downloadingUsers, setDownloadingUsers] = useState(false);
  const [downloadingBusinesses, setDownloadingBusinesses] = useState(false);
  const [downloadingAds, setDownloadingAds] = useState(false);
  const [error, setError] = useState('');
  const { filters, setFilters, hasFilters, clearFilters } = useReportFilters('system', defaultFilters);
  const query = filters.searchQuery.trim().toLowerCase();
  const matchesSearch = (...fields) => !query || fields.some(field => field?.toLowerCase().includes(query));

  const handleDownloadUsers = async () => {
    try {
      setDownloadingUsers(true);
      setError('');
      const res = await api.get('/superadmin/users');
      if (res.data.success) {
        const users = res.data.users.filter(user =>
          (filters.userRole === 'all' || user.role === filters.userRole) && matchesSearch(user.name, user.email)
        );
        const headers = ['Name', 'Email', 'Role', 'Registered At'];
        const rows = users.map(u => [
          u.name,
          u.email,
          u.role,
          u.createdAt ? new Date(u.createdAt).toLocaleString() : ''
        ]);
        downloadCsv(headers, rows, `whistle_users_${new Date().toISOString().split('T')[0]}`);
      }
    } catch (err) {
      console.error('Error downloading users report', err);
      setError('Failed to compile users report.');
    } finally {
      setDownloadingUsers(false);
    }
  };

  const handleDownloadBusinesses = async () => {
    try {
      setDownloadingBusinesses(true);
      setError('');
      const res = await api.get('/superadmin/businesses');
      if (res.data.success) {
        const businesses = res.data.businesses.filter(business =>
          (filters.businessStatus === 'all' || business.businessStatus === filters.businessStatus) &&
          matchesSearch(business.name, business.admin?.name, business.admin?.email)
        );
        const headers = ['Business Name', 'Domain', 'Admin Name', 'Admin Email', 'City', 'State', 'Address', 'Registered At'];
        const rows = businesses.map(b => [
          b.name,
          b.domain,
          b.admin?.name || 'N/A',
          b.admin?.email || 'N/A',
          b.city,
          b.state,
          b.address,
          b.createdAt ? new Date(b.createdAt).toLocaleString() : ''
        ]);
        downloadCsv(headers, rows, `whistle_businesses_${new Date().toISOString().split('T')[0]}`);
      }
    } catch (err) {
      console.error('Error downloading business report', err);
      setError('Failed to compile business report.');
    } finally {
      setDownloadingBusinesses(false);
    }
  };

  const handleDownloadAds = async () => {
    try {
      setDownloadingAds(true);
      setError('');
      const res = await api.get('/superadmin/ads');
      if (res.data.success) {
        const ads = res.data.ads.filter(ad =>
          (filters.adStatus === 'all' || Boolean(ad.isActive) === (filters.adStatus === 'active')) && matchesSearch(ad.name, ad.url)
        );
        const headers = ['Ad Campaign Name', 'Placements', 'Active Status', 'URL', 'Views', 'Clicks', 'CTR (%)', 'Targeting Type', 'Created At'];
        const rows = ads.map(ad => {
          const ctr = ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(2) : '0.00';
          const placements = ad.positions && ad.positions.length 
            ? ad.positions.join(' | ') 
            : (ad.position || 'N/A');
          return [
            ad.name,
            placements,
            ad.isActive ? 'Active' : 'Inactive',
            ad.url,
            ad.views || 0,
            ad.clicks || 0,
            `${ctr}%`,
            ad.targeting?.type || 'GLOBAL',
            ad.createdAt ? new Date(ad.createdAt).toLocaleString() : ''
          ];
        });
        downloadCsv(headers, rows, `whistle_ads_${new Date().toISOString().split('T')[0]}`);
      }
    } catch (err) {
      console.error('Error downloading ads report', err);
      setError('Failed to compile ads report.');
    } finally {
      setDownloadingAds(false);
    }
  };

  return (
    <div className="animated-fade-in">
      <div className="page-head">
        <div>
          <h1 className="fw-extrabold text-dark">Global System Reports</h1>
          <p className="text-muted mb-0">Search and filter report rows before exporting.</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4">
          {error}
        </div>
      )}

      <section className="card p-3 p-md-4 mb-3" aria-label="Report filters">
        <ReportFilterToolbar searchLabel="Search reports" searchPlaceholder="User, business, or campaign"
          search={filters.searchQuery} onSearch={value => setFilters({ ...filters, searchQuery: value })}
          hasFilters={hasFilters} onClear={clearFilters}>
          <label className="workspace-field">
            <span>User role</span>
            <select className="form-select" value={filters.userRole} onChange={event => setFilters({ ...filters, userRole: event.target.value })}>
              <option value="all">All roles</option><option value="admin">Admin</option><option value="superadmin">Super Admin</option>
            </select>
          </label>
          <label className="workspace-field">
            <span>Business status</span>
            <select className="form-select" value={filters.businessStatus} onChange={event => setFilters({ ...filters, businessStatus: event.target.value })}>
              <option value="all">All statuses</option><option>Active</option><option>Pending Verification</option><option>Suspended</option>
            </select>
          </label>
          <label className="workspace-field">
            <span>Ad activation</span>
            <select className="form-select" value={filters.adStatus} onChange={event => setFilters({ ...filters, adStatus: event.target.value })}>
              <option value="all">All campaigns</option><option value="active">Enabled</option><option value="inactive">Disabled</option>
            </select>
          </label>
        </ReportFilterToolbar>
      </section>

      <div className="report-grid">
        {/* Card 1: Users Reports */}
        <div>
          <div className="card border-0 p-4 bg-white shadow-sm rounded-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="stat-widget-icon stat-widget-blue mb-3">
                <i className="bi bi-people-fill fs-3"></i>
              </div>
              <h5 className="fw-bold text-dark mb-2">Users Reports</h5>
              <p className="text-muted small mb-4">
                Extract summaries of registered administrators, staff logs, and user roles counts.
              </p>
            </div>
            <button 
              className="btn btn-outline-primary w-100 py-2 fw-bold"
              onClick={handleDownloadUsers}
              disabled={downloadingUsers}
            >
              <i className="bi bi-download me-1"></i> {downloadingUsers ? 'Downloading...' : 'Download Excel'}
            </button>
          </div>
        </div>

        {/* Card 2: Business Reports */}
        <div>
          <div className="card border-0 p-4 bg-white shadow-sm rounded-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="stat-widget-icon stat-widget-green mb-3">
                <i className="bi bi-shop-window fs-3"></i>
              </div>
              <h5 className="fw-bold text-dark mb-2">Business Report</h5>
              <p className="text-muted small mb-4">
                Detailed breakdowns of outlets registrations, domains, active queues, and usage limits.
              </p>
            </div>
            <button 
              className="btn btn-outline-primary w-100 py-2 fw-bold"
              onClick={handleDownloadBusinesses}
              disabled={downloadingBusinesses}
            >
              <i className="bi bi-download me-1"></i> {downloadingBusinesses ? 'Downloading...' : 'Download Excel'}
            </button>
          </div>
        </div>

        {/* Card 3: Ads Reports */}
        <div>
          <div className="card border-0 p-4 bg-white shadow-sm rounded-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="stat-widget-icon stat-widget-purple mb-3">
                <i className="bi bi-megaphone-fill fs-3"></i>
              </div>
              <h5 className="fw-bold text-dark mb-2">Ads Report</h5>
              <p className="text-muted small mb-4">
                Performance tracking sheet aggregating campaign views, active status, duration and priority specs.
              </p>
            </div>
            <button 
              className="btn btn-outline-primary w-100 py-2 fw-bold"
              onClick={handleDownloadAds}
              disabled={downloadingAds}
            >
              <i className="bi bi-download me-1"></i> {downloadingAds ? 'Downloading...' : 'Download Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminReports;
