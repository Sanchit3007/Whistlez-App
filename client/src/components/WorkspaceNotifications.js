import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import socket from '../socket';
import './WorkspaceNotifications.css';

const newestFirst = (left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt);

const readAlerts = async (isSuperAdmin, signal) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const sources = isSuperAdmin ? [
    ['/superadmin/kyc-requests', ({ kycRequests }) => [...kycRequests]
      .filter(application => ['Submitted', 'Under Review'].includes(application.kycStatus))
      .sort(newestFirst).slice(0, 5).map(application => ({
        id: `kyc:${application._id}:${application.updatedAt || application.kycStatus}`,
        title: application.name,
        description: 'KYC application ready for review',
        link: '/superadmin/kyc?application=' + encodeURIComponent(application._id)
      }))],
    ['/superadmin/ads', ({ ads }) => ads
      .filter(ad => ad.isActive && ad.endDate && ad.endDate >= today && ad.endDate <= weekEnd)
      .sort((left, right) => left.endDate.localeCompare(right.endDate)).slice(0, 5).map(ad => ({
        id: `ad:${ad._id}:${ad.endDate}`,
        title: ad.name,
        description: `Campaign ends ${ad.endDate} (UTC)`,
        link: '/superadmin/ads?campaign=' + encodeURIComponent(ad._id)
      }))]
  ] : [
    ['/admin/business', ({ business }) => ['Rejected', 'Resubmission Required'].includes(business?.kycStatus) ? [{
      id: `business:${business._id}:${business.updatedAt || business.kycStatus}`,
      title: 'KYC needs your attention',
      description: 'Review the requested corrections',
      link: '/admin/kyc'
    }] : []],
    [`/admin/tokens?date=${today}`, ({ tokens }) => [...tokens]
      .filter(token => token.status === 'waiting' && !token.userId)
      .sort(newestFirst).slice(0, 5).map(token => ({
        id: `ticket:${token._id}`,
        title: token.customerName || `Token ${token.tokenNumber}`,
        description: `Waiting ticket · ${token.tokenNumber}`,
        link: '/admin/live-queue?' + new URLSearchParams({ ticket: token._id, date: today })
      }))]
  ];
  const results = await Promise.allSettled(sources.map(async ([url, toAlerts]) => {
    const { data } = await api.get(url, { signal });
    if (!data.success) throw new Error('Notification source failed');
    return toAlerts(data);
  }));
  return {
    items: results.flatMap(result => result.status === 'fulfilled' ? result.value : []),
    error: results.some(result => result.status === 'rejected')
  };
};

const loadRead = storageKey => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
};

const WorkspaceNotifications = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [alerts, setAlerts] = useState(null);
  const storageKey = `whistlez:notifications:${user._id || user.id || user.email || user.role}`;
  const [read, setRead] = useState(() => loadRead(storageKey));
  const trigger = useRef(null);
  const popover = useRef(null);
  const titleId = useId();
  const isSuperAdmin = user.role === 'superadmin';

  useEffect(() => {
    if (!open) return undefined;
    const dismissOutside = event => {
      if (!popover.current?.contains(event.target)) setOpen(false);
    };
    const dismissOnEscape = event => {
      if (event.key !== 'Escape' || !popover.current?.contains(event.target)) return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const request = new AbortController();
    readAlerts(isSuperAdmin, request.signal).then(result => {
      if (!request.signal.aborted) setAlerts(result);
    });
    const events = isSuperAdmin ? ['kycSubmitted', 'businessesUpdated', 'adsUpdated'] : ['tokenUpdated', 'kycStatusUpdated'];
    const reload = () => setRefresh(current => current + 1);
    events.forEach(event => socket.on(event, reload));
    return () => {
      request.abort();
      events.forEach(event => socket.off(event, reload));
    };
  }, [isSuperAdmin, open, refresh]);

  const markRead = ids => {
    const updated = new Set([...loadRead(storageKey), ...read, ...ids]);
    setRead(updated);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...updated].slice(-250)));
    } catch {
      // Keep the current read state when browser storage is unavailable.
    }
  };

  const unread = alerts?.items.filter(item => !read.has(item.id)) || [];
  return (
    <div className="workspace-notifications" ref={popover}>
      <button type="button" ref={trigger} className="btn btn-outline-secondary workspace-menu workspace-bell"
        aria-label="Notifications" aria-expanded={open} aria-controls={open ? `${titleId}-panel` : undefined} onClick={() => {
          if (!open) {
            setAlerts(null);
            setRead(loadRead(storageKey));
          }
          setOpen(!open);
        }}>
        <i className="bi bi-bell" aria-hidden="true" />
        {unread.length > 0 && <span className="workspace-bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <section className="workspace-notifications-card" id={`${titleId}-panel`} aria-labelledby={titleId}>
            <header className="workspace-notifications-heading">
              <h2 id={titleId} className="h6 mb-0">Notifications</h2>
              {unread.length > 0 && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => markRead(unread.map(item => item.id))}>
                Mark all as read
              </button>}
            </header>
            <div className="workspace-notifications-list">
              {!alerts && <p className="text-muted mb-0" role="status">Loading notifications…</p>}
              {alerts?.error && (
                <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                  <p className="text-warning mb-0" role="status">Some notifications could not be loaded.</p>
                  <button type="button" className="btn btn-outline-secondary workspace-primary" onClick={() => {
                    setAlerts(null);
                    setRefresh(current => current + 1);
                  }}>Retry</button>
                </div>
              )}
              {alerts && !alerts.error && alerts.items.length === 0 && <p className="text-muted mb-0">You’re caught up.</p>}
              {!!alerts?.items.length && (
                <ul className="list-unstyled mb-0">
                  {alerts.items.map(item => (
                    <li key={item.id} className="workspace-notification-row">
                      <Link className="workspace-notification-link text-decoration-none" to={item.link} onClick={() => {
                        markRead([item.id]);
                        setOpen(false);
                      }}>
                        <span className="text-break"><strong className="d-block">{item.title}</strong><small className="text-muted">{item.description}</small></span>
                      </Link>
                      {read.has(item.id) ? <small className="text-muted">Read</small> : (
                        <button type="button" className="btn btn-sm btn-outline-primary"
                          aria-label={`Mark ${item.title} as read`} onClick={() => markRead([item.id])}>Mark as read</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
        </section>
      )}
    </div>
  );
};

export default WorkspaceNotifications;
