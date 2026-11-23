import React, { useState, useEffect } from 'react';
import { api } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import { Skeleton } from '../../components/Skeleton';
import { AreaTrend, StatusDonut, Legend } from '../../components/Charts';
import { downloadCsv } from '../../utils/downloadCsv';
import ReportFilterToolbar from '../../components/ReportFilterToolbar';
import { useReportFilters } from '../../utils/reportFilterSession';

const defaultFilters = { filterStatus: 'all', searchQuery: '', startDate: '', endDate: '' };

const ticketStatusTones = {
  completed: 'success',
  skipped: 'danger',
  cancelled: 'danger',
  postponed: 'warning',
  serving: 'warning',
};

const TicketStatus = ({ status }) => {
  const tone = ticketStatusTones[status] || 'primary';
  return <span className={`badge bg-${tone}-subtle text-${tone}-emphasis workspace-status`}>{status}</span>;
};

const AdminReports = () => {
  const [tokens, setTokens] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const { filters, setFilters, hasFilters, clearFilters } = useReportFilters('queue', defaultFilters);
  const { filterStatus, searchQuery, startDate, endDate } = filters;
  const [loadedRange, setLoadedRange] = useState(null);
  const [reportError, setReportError] = useState('');
  const range = `${startDate}:${endDate}`;
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  const prefix = business?.queueConfig?.name ? business.queueConfig.name.charAt(0).toUpperCase() : 'A';
  const formatTokenNumber = (num) => {
    if (!num) return '';
    if (/^[A-Za-z]+-?\d+/.test(num)) return num;
    return `${prefix}-${num}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  useEffect(() => {
    const controller = new AbortController();
    if (invalidRange) return () => controller.abort();
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setReportError('');
        const params = startDate || endDate ? { startDate: startDate || undefined, endDate: endDate || undefined } : { all: true };
        const [res, businessRes] = await Promise.all([
          api.get('/admin/tokens', { params, signal: controller.signal }),
          api.get('/admin/business', { signal: controller.signal })
        ]);
        if (!res.data.success) throw new Error('Could not load the report.');
        setTokens(res.data.tokens);
        setLoadedRange(range);
        if (businessRes.data.success) {
          setBusiness(businessRes.data.business);
        }
      } catch (err) {
        if (!controller.signal.aborted) setReportError('Could not load the report for this date range.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchHistory();
    return () => controller.abort();
  }, [startDate, endDate, invalidRange, range]);

  const handleDownloadCSV = () => {
    if (!exportReady || !filteredTokens.length) return;
    const headers = ['Token Number', 'Customer Name', 'Customer Phone', 'Status', 'Created At', 'Called At', 'Completed At'];
    const rows = filteredTokens.map(t => [
      formatTokenNumber(t.tokenNumber),
      t.customerName,
      t.customerPhone,
      t.status.toUpperCase(),
      new Date(t.createdAt).toLocaleString(),
      t.calledAt ? new Date(t.calledAt).toLocaleString() : 'N/A',
      t.completedAt ? new Date(t.completedAt).toLocaleString() : 'N/A'
    ]);
    
    downloadCsv(headers, rows, `Whistlez_Queue_Report_${startDate || 'all'}_to_${endDate || 'all'}`);
  };

  const filteredTokens = tokens.filter((t) => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesSearch = 
      (t.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatTokenNumber(t.tokenNumber).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.customerPhone || '').includes(searchQuery);
    return matchesStatus && matchesSearch;
  });
  const exportReady = !loading && !invalidRange && loadedRange === range && !reportError;

  const totals = tokens.length;
  const completed = tokens.filter(t => t.status === 'completed').length;
  const skipped = tokens.filter(t => t.status === 'skipped').length;
  const cancelled = tokens.filter(t => t.status === 'cancelled').length;
  const waiting = tokens.filter(t => t.status === 'waiting').length;

  // ---- Chart data: all values come from the loaded tokens ----
  const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const distinctDays = new Set(tokens.map((t) => dayKey(t.createdAt)));
  const trendByHour = distinctDays.size <= 1;
  let trendData = [];
  if (tokens.length > 0) {
    if (trendByHour) {
      const hours = tokens.map((t) => new Date(t.createdAt).getHours());
      const lo = Math.min(...hours);
      const hi = Math.max(...hours, lo + 1);
      trendData = Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: `${String(lo + i).padStart(2, '0')}:00`, count: 0 }));
      hours.forEach((h) => { trendData[h - lo].count += 1; });
    } else {
      const counts = {};
      tokens.forEach((t) => { const k = dayKey(t.createdAt); counts[k] = (counts[k] || 0) + 1; });
      trendData = Object.keys(counts).sort().map((k) => ({
        label: new Date(`${k}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' }),
        count: counts[k]
      }));
    }
  }
  const statusData = [
    { name: 'Completed', value: completed, color: '#10b981' },
    { name: 'Waiting', value: waiting, color: '#8b5cf6' },
    { name: 'Serving', value: tokens.filter((t) => t.status === 'serving').length, color: '#f59e0b' },
    { name: 'Cancelled / Skipped', value: cancelled + skipped, color: '#f43f5e' },
    { name: 'Postponed', value: tokens.filter((t) => t.status === 'postponed').length, color: '#94a3b8' }
  ];

  return (
    <div className="animated-fade-in">
      <div className="workspace-heading">
        <div>
          <h1 className="fw-extrabold text-dark mb-1">Reports & Logs</h1>
          <p className="text-muted mb-0">Analyze your business performance and ticket logs history.</p>
        </div>
      </div>

      {/* Reports Metrics Summary */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <StatCard label="All generated" value={totals} icon="bi-ticket-perforated-fill" tone="blue" loading={loading} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Completed" value={completed} icon="bi-check2-circle" tone="green" loading={loading} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Cancelled/Skipped" value={cancelled + skipped} icon="bi-x-circle" tone="orange" loading={loading} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Active Waiting" value={waiting} icon="bi-hourglass-split" tone="purple" loading={loading} />
        </div>
      </div>

      {/* Charts (built from the loaded ticket logs) */}
      <div className="row g-3 g-lg-4 mb-4">
        <div className="col-lg-8">
          <div className="dash-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <h6 className="dash-card-title">{trendByHour ? 'Tokens by hour' : 'Tokens by day'}</h6>
              <span className="chip">{trendData.reduce((n, d) => n + d.count, 0)} tokens</span>
            </div>
            <AreaTrend data={trendData} loading={loading} height={250} unit="tokens" />
          </div>
        </div>
        <div className="col-lg-4">
          <div className="dash-card">
            <h6 className="dash-card-title mb-3">Status breakdown</h6>
            <StatusDonut data={statusData} loading={loading} height={200} centerLabel="Tokens" />
            {!loading && <Legend items={statusData} />}
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="card p-3 p-md-4 mb-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className="h5 fw-bold mb-0 text-dark">Ticket logs</h2>
          <button type="button" className="btn btn-outline-primary workspace-primary" onClick={handleDownloadCSV} disabled={!exportReady || filteredTokens.length === 0} aria-describedby="report-export-count">
            <i className="bi bi-download" aria-hidden="true"></i> Export CSV
          </button>
        </div>
        <p id="report-export-count" className="text-muted small" role="status">
          {invalidRange ? 'Choose an end date on or after the start date.' : reportError || (exportReady ? `${filteredTokens.length} ${filteredTokens.length === 1 ? 'row' : 'rows'} match the current filters` : 'Loading report rows…')}
        </p>
        <ReportFilterToolbar searchLabel="Search tickets" searchPlaceholder="Name, token, or phone"
          search={searchQuery} onSearch={value => setFilters({ ...filters, searchQuery: value })}
          hasFilters={hasFilters} onClear={clearFilters}>
          <label className="workspace-field">
            <span>From</span>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </label>
          <label className="workspace-field">
            <span>To</span>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </label>
          <label className="workspace-field">
            <span>Status</span>
            <select 
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilters({ ...filters, filterStatus: e.target.value })}
            >
              <option value="all">All Statuses</option>
              <option value="waiting">Waiting</option>
              <option value="serving">Serving</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="cancelled">Cancelled</option>
              <option value="postponed">Postponed</option>
            </select>
          </label>
        </ReportFilterToolbar>

        <div className="workspace-compact-list">
          {loading ? (
            <div role="status" className="text-muted p-3">Loading ticket logs…</div>
          ) : filteredTokens.length > 0 ? (
            filteredTokens.map((token) => (
              <details className="workspace-compact-item" key={token._id}>
                <summary>
                  <span className="workspace-record-name">
                    <strong>{formatTokenNumber(token.tokenNumber)}</strong>
                    <span className="text-muted">{token.customerName}</span>
                  </span>
                  <TicketStatus status={token.status} />
                </summary>
                <dl className="workspace-record-details">
                  <dt>Phone</dt><dd>{token.customerPhone || '—'}</dd>
                  <dt>Created</dt><dd>{formatDateTime(token.createdAt)}</dd>
                  {token.calledAt && <><dt>Served</dt><dd>{formatDateTime(token.calledAt)}</dd></>}
                </dl>
              </details>
            ))
          ) : (
            <p className="text-center py-4 text-muted mb-0">No matching token records found.</p>
          )}
        </div>

        <div className="table-responsive workspace-comparison-table">
          <table className="table table-hover align-middle">
            <thead>
              <tr className="table-light text-muted small">
                <th scope="col">TOKEN NO</th>
                <th scope="col">CUSTOMER</th>
                <th scope="col">PHONE</th>
                <th scope="col">STATUS</th>
                <th scope="col" className="text-end">TIMINGS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} aria-hidden="true">
                    <td><Skeleton w={64} h={22} r={99} /></td>
                    <td><Skeleton w="70%" h={14} /></td>
                    <td><Skeleton w="60%" h={14} /></td>
                    <td><Skeleton w={78} h={20} r={99} /></td>
                    <td className="text-end"><Skeleton w="55%" h={12} /></td>
                  </tr>
                ))
              ) : filteredTokens.length > 0 ? (
                filteredTokens.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <span className="badge bg-primary-subtle text-primary rounded-pill fw-bold">
                        {formatTokenNumber(t.tokenNumber)}
                      </span>
                    </td>
                    <td><strong className="text-dark">{t.customerName}</strong></td>
                    <td>{t.customerPhone}</td>
                    <td>
                      <TicketStatus status={t.status} />
                    </td>
                    <td className="text-end text-muted small">
                      Created: {formatDateTime(t.createdAt)}
                      {t.calledAt && ` | Served: ${formatDateTime(t.calledAt)}`}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-muted small">
                    No matching token records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
