import React, { useCallback, useState, useEffect, useRef } from 'react';
import FilterToolbar from '../../components/FilterToolbar';
import { Link, useNavigate } from 'react-router-dom';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import { BarTrend } from '../../components/Charts';
import StatCard from '../../components/StatCard';
import IdentityAvatar from '../../components/IdentityAvatar';
import LiveStatus from '../../components/LiveStatus';
import { needsKycReview, PENDING_VERIFICATION } from '../../utils/businessStatus';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [growthFilter, setGrowthFilter] = useState('Weekly');
  const [trendingData, setTrendingData] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(true);
  const activeRequest = useRef(null);

  const fetchDashboardData = useCallback(async () => {
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    const config = { signal: request.signal };
    setRefreshing(true);
    try {
      const [metricsRes, bizRes, usersRes, trendingRes] = await Promise.all([
        api.get('/superadmin/metrics', config),
        api.get('/superadmin/businesses', config),
        api.get('/superadmin/users', config),
        api.get('/trending', config).catch(() => ({ data: { success: false } }))
      ]);
      if (request.signal.aborted) return;
      if (![metricsRes, bizRes, usersRes].every(response => response.data.success)) throw new Error('Incomplete dashboard response.');

      if (metricsRes.data.success) {
        setMetrics(metricsRes.data.metrics);
      }
      if (trendingRes.data.success) {
        setTrendingData(trendingRes.data);
      }
      if (bizRes.data.success) {
        setAllBusinesses(bizRes.data.businesses);
        setBusinesses(bizRes.data.businesses.slice(0, 5)); // show top 5
      }
      if (usersRes.data.success) {
        setUsers(usersRes.data.users.slice(0, 5)); // show top 5
      }
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      if (request.signal.aborted) return;
      console.error('Error fetching dashboard details', err);
      setError('Could not retrieve super admin dashboard statistics.');
    } finally {
      if (!request.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    return () => activeRequest.current?.abort();
  }, [fetchDashboardData]);

  // Socket listener for real-time superadmin updates
  useEffect(() => {
    const joinSuperAdmin = () => socket.emit('joinSuperAdmin');
    const reconnect = () => {
      joinSuperAdmin();
      fetchDashboardData();
    };
    const updateEvents = [
      'metricsUpdated', 'businessesUpdated', 'usersUpdated', 'trendingUpdated',
      'trendingRotationUpdated', 'trendingRankingsRecalculated',
    ];

    if (socket.connected) joinSuperAdmin();
    socket.on('connect', reconnect);
    updateEvents.forEach(event => socket.on(event, fetchDashboardData));

    return () => {
      socket.off('connect', reconnect);
      updateEvents.forEach(event => socket.off(event, fetchDashboardData));
    };
  }, [fetchDashboardData]);

  // Hourly Daily Growth Calculator (9 AM to 6 PM today)
  const getDailyChartData = () => {
    const hours = [];
    for (let i = 9; i <= 18; i++) {
      hours.push({
        label: `${i > 12 ? i - 12 : i} ${i >= 12 ? 'PM' : 'AM'}`,
        hour: i,
        count: 0
      });
    }

    const todayStr = new Date().toDateString();
    allBusinesses.forEach(b => {
      const bDate = new Date(b.createdAt);
      if (bDate.toDateString() === todayStr) {
        const hr = bDate.getHours();
        const match = hours.find(h => h.hour === hr);
        if (match) {
          match.count++;
        }
      }
    });

    const max = Math.max(...hours.map(h => h.count), 1);
    return hours.map(h => ({
      label: h.label,
      val: `${Math.max(10, Math.round((h.count / max) * 100))}%`,
      count: h.count,
      filterType: 'daily',
      filterValue: h.hour
    }));
  };

  // Rolling 7-day Weekly Growth Calculator
  const getWeeklyChartData = () => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push({
        dateString: d.toDateString(),
        label: d.toLocaleDateString([], { weekday: 'short' }),
        count: 0
      });
    }

    allBusinesses.forEach(b => {
      const bDateString = new Date(b.createdAt).toDateString();
      const match = days.find(d => d.dateString === bDateString);
      if (match) {
        match.count++;
      }
    });

    const max = Math.max(...days.map(d => d.count), 1);
    return days.map(d => ({
      label: d.label,
      val: `${Math.max(10, Math.round((d.count / max) * 100))}%`,
      count: d.count,
      filterType: 'weekly',
      filterValue: d.dateString
    }));
  };

  // Rolling 6-month Monthly Growth Calculator
  const getMonthlyChartData = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString([], { month: 'short' }),
        count: 0
      });
    }

    allBusinesses.forEach(b => {
      const bDate = new Date(b.createdAt);
      const match = months.find(m => m.year === bDate.getFullYear() && m.month === bDate.getMonth());
      if (match) {
        match.count++;
      }
    });

    const max = Math.max(...months.map(m => m.count), 1);
    return months.map(m => ({
      label: m.label,
      val: `${Math.max(10, Math.round((m.count / max) * 100))}%`,
      count: m.count,
      filterType: 'monthly',
      filterValue: `${m.year}-${m.month}`
    }));
  };

  // Yearly Growth Calculator (last 5 years)
  const getYearlyChartData = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let i = 4; i >= 0; i--) {
      years.push({
        label: `${currentYear - i}`,
        year: currentYear - i,
        count: 0
      });
    }

    allBusinesses.forEach(b => {
      const bYear = new Date(b.createdAt).getFullYear();
      const match = years.find(y => y.year === bYear);
      if (match) {
        match.count++;
      }
    });

    const max = Math.max(...years.map(y => y.count), 1);
    return years.map(y => ({
      label: y.label,
      val: `${Math.max(10, Math.round((y.count / max) * 100))}%`,
      count: y.count,
      filterType: 'yearly',
      filterValue: y.year
    }));
  };

  const chartData = 
    growthFilter === 'Daily' ? getDailyChartData() :
    growthFilter === 'Weekly' ? getWeeklyChartData() :
    growthFilter === 'Monthly' ? getMonthlyChartData() :
    getYearlyChartData();

  const handleBarClick = (item) => {
    navigate(`/superadmin/businesses?filter=${item.filterType}&value=${item.filterValue}&label=${item.label}`);
  };
  const pendingReviews = allBusinesses.filter(needsKycReview).length;
  const pendingBusinesses = allBusinesses.filter(business => business.businessStatus === PENDING_VERIFICATION).length;

  return (
    <div className="animated-fade-in">
      <div className="workspace-heading">
        <div>
          <h1 className="fw-extrabold text-dark mb-1">Platform overview</h1>
          <p className="text-muted mb-0">Monitor registered businesses, accounts, and campaigns.</p>
          <LiveStatus updatedAt={updatedAt} stale={Boolean(error)} refreshing={refreshing} onRetry={fetchDashboardData} />
        </div>
        <div className="workspace-actions">
          <Link to="/superadmin/kyc" className="btn btn-primary workspace-primary">
            Review KYC <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <StatCard label="Businesses" value={metrics?.totalBusinesses || 0} icon="bi-shop-window" loading={loading} />
        </div>

        <div className="col-6 col-xl-3">
          <StatCard label="Business admins" value={metrics?.totalAdmins || 0} icon="bi-people-fill" tone="purple" loading={loading} />
        </div>

        <div className="col-6 col-xl-3">
          <StatCard label="Active ads" value={metrics?.totalAds || 0} icon="bi-megaphone-fill" tone="green" loading={loading} />
        </div>

        <div className="col-6 col-xl-3">
          <div className="dash-card h-100 p-3 super-trending-summary">
            <div className="w-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-muted small fw-bold">TRENDING</span>
                <i className="bi bi-graph-up-arrow" style={{ color: '#fd7e14' }}></i>
              </div>
              
              {loading ? (
                <div className="text-center py-2">
                  <div className="spinner-border spinner-border-sm text-muted"></div>
                </div>
              ) : (
                <div className="small">
                  <div className="d-flex justify-content-between align-items-center mb-1 text-muted">
                    <span>Active Topics:</span>
                    <strong className="text-dark">{trendingData?.topics?.length || 0}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-1 text-muted">
                    <span>Top topic</span>
                    <strong className="text-dark text-truncate ms-1" style={{ maxWidth: '110px' }} title={trendingData?.currentlyTrending?.heading || 'None'}>
                      {trendingData?.currentlyTrending?.heading || 'None'}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-1 text-muted">
                    <span>Total Whizles:</span>
                    <strong className="text-dark">
                      {trendingData?.topics?.reduce((sum, t) => sum + (t.whizlesCount || 0), 0) || 0}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center text-muted">
                    <span>Status:</span>
                    <strong className={trendingData?.topics?.length > 0 ? 'text-success' : 'text-danger'}>
                      {trendingData?.topics?.length > 0 ? 'Active' : 'Inactive'}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-feature-grid mb-3">
        <section className="dash-card attention-panel" aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="dash-card-title mb-2">Needs attention</h2>
          <Link className="attention-row" to="/superadmin/kyc">
            <i className="bi bi-shield-check" aria-hidden="true"></i>
            <span>KYC review queue</span>
            <strong>{loading || error ? '—' : pendingReviews}</strong>
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </Link>
          <Link className="attention-row" to="/superadmin/businesses?status=pending-verification">
            <i className="bi bi-shop-window" aria-hidden="true"></i>
            <span>Awaiting verification</span>
            <strong>{loading || error ? '—' : pendingBusinesses}</strong>
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </Link>
        </section>
        <div>
          <div className="card border-0 p-3 p-md-4 bg-white shadow-sm rounded-4 h-100">
            <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
              <h2 className="dash-card-title">Business registrations</h2>
              <FilterToolbar>
                <select
                  className="form-select form-select-sm"
                  style={{ width: '120px' }}
                  value={growthFilter}
                  aria-label="Growth reporting period"
                  onChange={(e) => setGrowthFilter(e.target.value)}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </FilterToolbar>
            </div>
            
            <BarTrend
              data={chartData}
              loading={loading}
              height={230}
              unit="registered"
              onBarClick={handleBarClick}
            />
          </div>
        </div>

      </div>
      <nav className="dashboard-shortcuts mb-4" aria-label="Management shortcuts">
        <Link to="/superadmin/ringtones"><i className="bi bi-music-note-list" aria-hidden="true"></i> Ringtones</Link>
        <Link to="/superadmin/ads"><i className="bi bi-megaphone" aria-hidden="true"></i> Ads</Link>
        <Link to="/superadmin/users"><i className="bi bi-people" aria-hidden="true"></i> Users</Link>
        <Link to="/superadmin/trending"><i className="bi bi-graph-up-arrow" aria-hidden="true"></i> Trending</Link>
      </nav>

      {/* Row 3: Recent Users directory */}
      <div className="card border-0 p-4 bg-white shadow-sm rounded-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-bold mb-0 text-dark">Recent Users</h6>
          <Link to="/superadmin/users" className="text-primary text-decoration-none small fw-bold">View All</Link>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr className="table-light text-muted small">
                <th scope="col" style={{ width: '60px' }}>ID</th>
                <th scope="col">NAME</th>
                <th scope="col">EMAIL</th>
                <th scope="col">ROLE</th>
                <th scope="col">JOINED</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((u, index) => (
                  <tr key={u._id}>
                    <td><span className="text-muted">{String(users.length - index).padStart(2, '0')}</span></td>
                    <td>
                      <div className="d-flex align-items-center">
                        <IdentityAvatar name={u.name} identity={u._id || u.email} size={32} className="me-2" />
                        <span className="fw-bold text-dark">{u.name}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge rounded-pill workspace-status ${u.role === 'superadmin' ? 'bg-primary' : 'bg-light text-dark border'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="text-muted small">{new Date(u.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted small">No active users logged.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Recent Businesses directory */}
      <div className="card border-0 p-4 bg-white shadow-sm rounded-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-bold mb-0 text-dark">Recent Businesses</h6>
          <Link to="/superadmin/businesses" className="text-primary text-decoration-none small fw-bold">View All</Link>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr className="table-light text-muted small">
                <th scope="col" style={{ width: '60px' }}>ID</th>
                <th scope="col">BUSINESS NAME</th>
                <th scope="col">EMAIL</th>
                <th scope="col">PHONE NUMBER</th>
                <th scope="col">REGISTERED DATE</th>
                <th scope="col" className="text-end">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : businesses.length > 0 ? (
                businesses.map((b, index) => (
                  <tr key={b._id}>
                    <td><span className="text-muted">{String(businesses.length - index).padStart(2, '0')}</span></td>
                    <td>
                      <div className="d-flex align-items-center">
                        <IdentityAvatar name={b.name} identity={b._id || b.email} image={b.logo} size={32} business className="me-2" />
                        <span className="fw-bold text-dark">{b.name}</span>
                      </div>
                    </td>
                    <td>{b.email}</td>
                    <td>{b.phone}</td>
                    <td className="text-muted small">{new Date(b.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="text-end">
                      <Link to={`/superadmin/businesses/${b._id}`} className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted small">No businesses registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
