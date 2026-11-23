import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../context/AuthContext';
import ReportFilterToolbar from '../../components/ReportFilterToolbar';
import ReportPeriodComparison from '../../components/ReportPeriodComparison';
import { downloadCsv } from '../../utils/downloadCsv';
import { useReportFilters } from '../../utils/reportFilterSession';
import './SuperAdminReports.css';

const defaultFilters = { searchQuery: '', userRole: 'all', businessStatus: 'all', adStatus: 'all' };
const formatDate = value => value ? new Date(value).toLocaleString() : '';

const reports = [
  {
    id: 'users',
    title: 'Users',
    description: 'Registered accounts, email addresses, and roles.',
    icon: 'people',
    filter: 'userRole',
    headers: ['Name', 'Email', 'Role', 'Registered At'],
    matches: (user, role, search) => (role === 'all' || user.role === role) && search(user.name, user.email),
    row: user => [user.name, user.email, user.role, formatDate(user.createdAt)]
  },
  {
    id: 'businesses',
    title: 'Businesses',
    description: 'Business profiles, linked admins, and registration dates.',
    icon: 'shop-window',
    filter: 'businessStatus',
    headers: ['Business Name', 'Domain', 'Admin Name', 'Admin Email', 'City', 'State', 'Address', 'Registered At'],
    matches: (business, status, search) => (status === 'all' || business.businessStatus === status) &&
      search(business.name, business.admin?.name, business.admin?.email),
    row: business => [
      business.name, business.domain, business.admin?.name || 'N/A', business.admin?.email || 'N/A',
      business.city, business.state, business.address, formatDate(business.createdAt)
    ]
  },
  {
    id: 'ads',
    title: 'Ads',
    description: 'Campaign placements, targeting, views, and clicks.',
    icon: 'megaphone',
    filter: 'adStatus',
    headers: ['Ad Campaign Name', 'Placements', 'Active Status', 'URL', 'Views', 'Clicks', 'CTR (%)', 'Targeting Type', 'Created At'],
    matches: (ad, status, search) => (status === 'all' || Boolean(ad.isActive) === (status === 'active')) && search(ad.name, ad.url),
    row: ad => [
      ad.name,
      ad.positions?.length ? ad.positions.join(' | ') : ad.position || 'N/A',
      ad.isActive ? 'Active' : 'Inactive',
      ad.url,
      ad.views || 0,
      ad.clicks || 0,
      ad.views > 0 ? ((ad.clicks / ad.views) * 100).toFixed(2) + '%' : '0.00%',
      ad.targeting?.type || 'GLOBAL',
      formatDate(ad.createdAt)
    ]
  }
];

const SuperAdminReports = () => {
  const { filters, setFilters, hasFilters, clearFilters } = useReportFilters('system', defaultFilters);
  const [feedback, setFeedback] = useState({});
  const activeDownloads = useRef(new Map());
  const query = filters.searchQuery.trim().toLowerCase();
  const matchesSearch = (...fields) => !query || fields.some(field => field?.toLowerCase().includes(query));

  useEffect(() => {
    const downloads = activeDownloads.current;
    return () => {
      downloads.forEach(request => request.abort());
      downloads.clear();
    };
  }, []);

  const downloadReport = async (report, selection) => {
    if (activeDownloads.current.has(report.id)) return;
    const request = new AbortController();
    activeDownloads.current.set(report.id, request);
    const notify = (state, message) => setFeedback(current => ({
      ...current,
      [report.id]: { state, message, selection }
    }));
    notify('pending', 'Preparing CSV…');

    try {
      const { data } = await api.get(`/superadmin/${report.id}`, { signal: request.signal });
      if (request.signal.aborted) return;
      if (!data.success || !Array.isArray(data[report.id])) throw new Error('Invalid report response');
      const rows = data[report.id].filter(record => report.matches(record, filters[report.filter], matchesSearch)).map(report.row);
      if (!rows.length) {
        notify('empty', 'No matching rows.');
        return;
      }
      downloadCsv(report.headers, rows, `whistle_${report.id}_${new Date().toISOString().slice(0, 10)}`);
      notify('ready', `CSV prepared · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`);
    } catch {
      if (!request.signal.aborted) notify('error', 'Could not prepare the CSV. Try again.');
    } finally {
      if (activeDownloads.current.get(report.id) === request) activeDownloads.current.delete(report.id);
    }
  };

  return (
    <div className="animated-fade-in system-reports">
      <div className="page-head">
        <div>
          <h1 className="fw-extrabold text-dark">Global System Reports</h1>
          <p className="text-muted mb-0">Compare business registrations and export report data.</p>
        </div>
      </div>

      <ReportPeriodComparison compact />

      <section className="card p-3 p-md-4" aria-labelledby="system-report-exports">
        <h2 id="system-report-exports" className="h5 mb-3">Export data</h2>
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

        <ul className="list-unstyled mb-0 system-report-list">
          {reports.map(report => {
            const selection = JSON.stringify([query, filters[report.filter]]);
            const status = feedback[report.id];
            const preparing = status?.state === 'pending';
            const message = preparing || status?.selection === selection ? status?.message : '';
            return (
              <li key={report.id} className="system-report-row">
                <div className="system-report-info">
                  <i className={`bi bi-${report.icon} system-report-icon`} aria-hidden="true" />
                  <div>
                    <h3 className="h6 mb-1">{report.title}</h3>
                    <p className="small text-muted mb-0">{report.description}</p>
                  </div>
                </div>
                <div className="system-report-actions">
                  <button type="button" className="btn btn-outline-primary workspace-primary"
                    aria-label={`Download ${report.title.toLowerCase()} CSV`} disabled={preparing}
                    onClick={() => downloadReport(report, selection)}>
                    <i className="bi bi-download me-1" aria-hidden="true" /> Download CSV
                  </button>
                  <p className={`small mb-0 ${status?.state === 'error' ? 'text-danger' : 'text-muted'}`} role="status">
                    {message}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default SuperAdminReports;
