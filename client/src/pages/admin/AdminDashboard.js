import React, { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import { BarTrend } from '../../components/Charts';
import { Skeleton } from '../../components/Skeleton';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [business, setBusiness] = useState(null);
  const [nextWaitingToken, setNextWaitingToken] = useState('None');
  const [activeServingToken, setActiveServingToken] = useState('None');
  const [lastCompletedToken, setLastCompletedToken] = useState('None');
  const [prevMetrics, setPrevMetrics] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      const prevDay = new Date(`${selectedDate}T00:00:00`);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevKey = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`;

      const [metricsRes, businessRes, tokensRes, prevRes] = await Promise.all([
        api.get(`/admin/metrics?date=${selectedDate}`),
        api.get('/admin/business'),
        api.get(`/admin/tokens?date=${selectedDate}`),
        api.get(`/admin/metrics?date=${prevKey}`).catch(() => null)
      ]);

      if (prevRes && prevRes.data && prevRes.data.success) {
        setPrevMetrics(prevRes.data.metrics);
      } else {
        setPrevMetrics(null);
      }

      if (metricsRes.data.success) {
        setMetrics(metricsRes.data.metrics);
      }
      let currentBusiness = null;
      if (businessRes.data.success) {
        currentBusiness = businessRes.data.business;
        setBusiness(currentBusiness);
      }

      const prefix = currentBusiness?.queueConfig?.name ? currentBusiness.queueConfig.name.charAt(0).toUpperCase() : 'A';
      const formatTokenNum = (num) => {
        if (!num) return 'None';
        if (/^[A-Za-z]+-?\d+/.test(num)) return num;
        return `${prefix}-${num}`;
      };

      if (tokensRes.data.success) {
        const activeTokens = tokensRes.data.tokens;

        // Keep the configured shift visible and include any arrivals outside it.
        const startH = parseInt((currentBusiness?.queueConfig?.startTime || '08:00').split(':')[0], 10);
        const endH = parseInt((currentBusiness?.queueConfig?.endTime || '18:00').split(':')[0], 10);
        const buckets = Array(24).fill(0);
        activeTokens.forEach((t) => {
          const hour = new Date(t.createdAt).getHours();
          if (Number.isInteger(hour)) buckets[hour] += 1;
        });
        setHourly(buckets.map((count, hour) => ({ count, hour, label: `${String(hour).padStart(2, '0')}:00` }))
          .filter(({ count, hour }) => count > 0 || (startH <= endH ? hour >= startH && hour <= endH : hour >= startH || hour <= endH)));
        
        // Next waiting token (oldest waiting token today)
        const waiting = activeTokens.filter(t => t.status === 'waiting').sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        setNextWaitingToken(waiting[0] ? formatTokenNum(waiting[0].tokenNumber) : 'None');
        
        // Active serving token
        const serving = activeTokens.find(t => t.status === 'serving');
        setActiveServingToken(serving ? formatTokenNum(serving.tokenNumber) : 'None');
        
        // Last completed/skipped/cancelled token
        const completed = activeTokens.filter(t => t.status === 'completed' || t.status === 'skipped' || t.status === 'cancelled').sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLastCompletedToken(completed[0] ? formatTokenNum(completed[0].tokenNumber) : 'None');
      }
      setError('');
    } catch (err) {
      console.error('Error fetching dashboard details', err);
      setError('Could not retrieve dashboard information.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Re-fetch whenever selectedDate changes
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time socket connections listener
  const businessId = business?._id;
  useEffect(() => {
    if (!businessId) return;

    socket.emit('joinBusiness', businessId);
    socket.on('tokenUpdated', fetchDashboardData);

    return () => {
      socket.off('tokenUpdated', fetchDashboardData);
    };
  }, [businessId, fetchDashboardData]);

  // Formatter helper for AM/PM conversion
  const formatTime12h = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hr = parseInt(hours, 10);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;
    return `${String(hr12).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Dynamic Shift remaining calculator
  const getRemainingShiftTime = () => {
    if (!business || !business.queueConfig) return '';
    const endTime = business.queueConfig.endTime;
    const [endH, endM] = endTime.split(':').map(Number);
    
    const now = new Date();
    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    if (now > end) {
      return 'Shift closed';
    }

    const diffMs = end - now;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    return `${diffHrs}h ${diffMins}m remaining`;
  };

  // Real shift progress (0-100) from the configured start/end time
  const getShiftPercent = () => {
    const cfg = business?.queueConfig;
    if (!cfg?.startTime || !cfg?.endTime) return 0;
    const [sh, sm] = cfg.startTime.split(':').map(Number);
    const [eh, em] = cfg.endTime.split(':').map(Number);
    const now = new Date();
    const start = new Date(); start.setHours(sh, sm, 0, 0);
    const end = new Date(); end.setHours(eh, em, 0, 0);
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  };

  const todayKey = new Date().toISOString().split('T')[0];
  const isServing = activeServingToken !== 'None';

  return (
    <div className="animated-fade-in">
      {/* KYC Alert Banner */}
      {business && business.kycStatus !== 'Approved' && (
        <div className={`alert border-0 rounded-4 shadow-sm mb-4 d-flex align-items-center justify-content-between p-3 ${
          business.kycStatus === 'Rejected' || business.kycStatus === 'Resubmission Required' 
            ? 'alert-danger bg-danger text-white' 
            : business.kycStatus === 'Pending' 
              ? 'alert-warning bg-warning text-dark' 
              : 'alert-info bg-info text-white'
        }`}>
          <div className="d-flex align-items-center">
            <i className={`bi fs-4 me-3 ${
              business.kycStatus === 'Rejected' || business.kycStatus === 'Resubmission Required' 
                ? 'bi-exclamation-triangle-fill' 
                : business.kycStatus === 'Pending' 
                  ? 'bi-hourglass-split' 
                  : 'bi-info-circle-fill'
            }`}></i>
            <div>
              <h6 className="fw-bold mb-1">
                {business.kycStatus === 'Pending' ? 'KYC Pending' : 
                 business.kycStatus === 'Rejected' || business.kycStatus === 'Resubmission Required' ? 'KYC Rejected / Resubmission Required' : 
                 `KYC Status: ${business.kycStatus}`}
              </h6>
              <p className="mb-0 small fw-semibold" style={{ opacity: 0.9 }}>
                {business.kycStatus === 'Pending' ? 'Your business KYC profile is incomplete. Please complete your KYC verification to ensure uninterrupted services.' : 
                 business.kycStatus === 'Rejected' || business.kycStatus === 'Resubmission Required' ? 'Your latest KYC submission was rejected. Please review the reasons and resubmit your details.' : 
                 'Your KYC documents are currently under review by our super admin team. You will be notified once approved.'}
              </p>
            </div>
          </div>
          <Link to="/admin/kyc" className={`btn btn-sm px-4 py-2 fw-bold rounded-pill shadow-sm ${
            business.kycStatus === 'Rejected' || business.kycStatus === 'Resubmission Required' 
              ? 'btn-light text-danger' 
              : business.kycStatus === 'Pending' 
                ? 'btn-dark text-white' 
                : 'btn-light text-info'
          }`}>
            {business.kycStatus === 'Pending' || business.kycStatus === 'Rejected' || business.kycStatus === 'Resubmission Required' ? 'Complete KYC' : 'View KYC'}
          </Link>
        </div>
      )}
      <div className="workspace-heading">
        <div>
          <h1 className="fw-extrabold text-dark mb-1">Queue overview</h1>
          {business?.name && <p className="text-muted mb-0">{business.name}</p>}
        </div>
        <div className="workspace-actions">
          <label className="workspace-field">
            <span>Queue date</span>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
          <Link to="/admin/live-queue" className="btn btn-primary workspace-primary">
            Open Live Queue <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="dashboard-feature-grid mb-4">
        <section className="dash-card counter-overview" aria-label="Counter overview">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h2 className="dash-card-title">Counter overview</h2>
            <span className="text-muted small">{business?.queueConfig?.name || 'General Queue'}</span>
          </div>
          <div className="counter-current">
            <span>{selectedDate === todayKey ? 'Now serving' : 'Serving on selected date'}</span>
            {loading ? <Skeleton w={108} h={42} /> : (
              <strong className={isServing ? 'counter-token' : 'counter-idle'}>{isServing ? activeServingToken : 'No token serving'}</strong>
            )}
          </div>
          <dl className="counter-metrics">
            <div><dt>Next up</dt><dd>{loading ? <Skeleton w={40} h={18} /> : nextWaitingToken}</dd></div>
            <div><dt>Waiting</dt><dd>{loading ? <Skeleton w={30} h={18} /> : metrics?.waiting ?? '—'}</dd></div>
            <div><dt>Average wait</dt><dd>{loading ? <Skeleton w={38} h={18} /> : metrics ? `${metrics.avgWaitTimeMinutes ?? 0} min` : '—'}</dd></div>
          </dl>
          {!loading && lastCompletedToken !== 'None' && <p className="text-muted small mb-0">Last finished <strong>{lastCompletedToken}</strong></p>}
        </section>
        <section className="dash-card">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <h2 className="dash-card-title">Token arrivals</h2>
            {!loading && metrics && <span className="text-muted small tnum">{metrics.totalTokens} issued</span>}
          </div>
          <BarTrend data={hourly} loading={loading} height={180} unit="tokens" />
        </section>
      </div>

      <div className="row g-3 g-lg-4">
        {/* Today vs previous day (real data replaces the old hard-coded monthly numbers) */}
        <div className="col-md-6">
          <div className="dash-card">
            <h6 className="dash-card-title mb-3">{selectedDate === todayKey ? 'Today vs Yesterday' : 'Selected Day vs Prior Day'}</h6>
            {loading ? (
              <>
                <Skeleton h={52} r={14} className="mb-2" />
                <Skeleton h={52} r={14} className="mb-2" />
                <Skeleton h={52} r={14} />
              </>
            ) : (
              <div className="mt-auto">
                <div className="compare-row">
                  <span>Tokens issued</span>
                  <strong>{metrics?.totalTokens || 0} <small className="text-muted fw-normal">/ {prevMetrics ? prevMetrics.totalTokens : '-'}</small></strong>
                </div>
                <div className="compare-row">
                  <span>Completed</span>
                  <strong>{metrics?.completed || 0} <small className="text-muted fw-normal">/ {prevMetrics ? prevMetrics.completed : '-'}</small></strong>
                </div>
                <div className="compare-row">
                  <span>Cancelled</span>
                  <strong>{metrics?.cancelled || 0} <small className="text-muted fw-normal">/ {prevMetrics ? prevMetrics.cancelled : '-'}</small></strong>
                </div>
                <div className="small text-muted mt-2">Selected day / prior day</div>
              </div>
            )}
          </div>
        </div>

        {/* Working Hours Widget */}
        <div className="col-md-6">
          <div className="dash-card">
            <h6 className="dash-card-title mb-3">Working Hours</h6>

            <div className="row g-2 mb-4">
              <div className="col-6 border-end">
                <span className="text-muted d-block small">Open Shift</span>
                <strong className="fs-6">{formatTime12h(business?.queueConfig?.startTime)}</strong>
              </div>
              <div className="col-6 ps-3">
                <span className="text-muted d-block small">Close Shift</span>
                <strong className="fs-6">{formatTime12h(business?.queueConfig?.endTime)}</strong>
              </div>
            </div>

            <div className="mt-auto">
              <div className="d-flex justify-content-between align-items-center small mb-2">
                <span className="text-muted">Shift Progress</span>
                <span className="fw-bold text-primary">{getRemainingShiftTime()}</span>
              </div>
              <div className="shift-bar" role="progressbar" aria-valuenow={getShiftPercent()} aria-valuemin="0" aria-valuemax="100">
                <span style={{ width: `${getShiftPercent()}%` }}></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
