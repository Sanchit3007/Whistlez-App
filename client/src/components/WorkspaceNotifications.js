import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import socket from '../socket';
import './WorkspaceNotifications.css';

const kycTitles = {
  Submitted: 'KYC submitted',
  'Under Review': 'KYC under review',
  Approved: 'KYC approved',
  Rejected: 'KYC rejected',
  'Resubmission Required': 'KYC resubmission requested'
};

const notificationTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const timestamp = value => Date.parse(value) || 0;

const readAlerts = async (isSuperAdmin, signal) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const sources = [[`/${isSuperAdmin ? 'superadmin' : 'admin'}/notifications/kyc`, ({ notifications }) => notifications.map(item => ({
    id: item.id,
    title: kycTitles[item.status],
    description: item.businessName,
    occurredAt: item.occurredAt,
    link: isSuperAdmin ? '/superadmin/kyc?application=' + encodeURIComponent(item.businessId) : '/admin/kyc'
  }))]];

  if (isSuperAdmin) sources.push(
    ['/superadmin/ads', ({ ads }) => ads
      .filter(ad => ad.isActive && ad.endDate && ad.endDate >= today && ad.endDate <= weekEnd)
      .map(ad => ({
        id: `ad:${ad._id}:${ad.endDate}`,
        title: ad.name,
        description: `Campaign ends ${ad.endDate} (UTC)`,
        occurredAt: ad.updatedAt || ad.createdAt,
        link: '/superadmin/ads?campaign=' + encodeURIComponent(ad._id)
      }))]
  );
  else sources.push(
    [`/admin/tokens?date=${today}`, ({ tokens }) => tokens
      .filter(token => !token.userId)
      .map(token => ({
        id: `ticket:${token._id}`,
        title: token.customerName || `Token ${token.tokenNumber}`,
        description: `Walk-in registered · ${token.tokenNumber}`,
        occurredAt: token.createdAt,
        link: '/admin/live-queue?' + new URLSearchParams({ ticket: token._id, date: today })
      }))]
  );
  const results = await Promise.allSettled(sources.map(async ([url, toAlerts]) => {
    const { data } = await api.get(url, { signal });
    if (!data.success) throw new Error('Notification source failed');
    return toAlerts(data);
  }));
  return {
    items: results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      .sort((left, right) => timestamp(right.occurredAt) - timestamp(left.occurredAt)),
    error: results.some(result => result.status === 'rejected')
  };
};

const loadRead = storageKey => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey));
    return Array.isArray(saved)
      ? saved.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 128)
      : [];
  } catch {
    return [];
  }
};

const saveRead = async (url, ids, signal) => {
  for (let offset = 0; offset < ids.length && !signal?.aborted; offset += 500) {
    await api.patch(url, { ids: ids.slice(offset, offset + 500) }, { signal });
  }
};

const WorkspaceNotifications = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [alerts, setAlerts] = useState(null);
  const storageKey = `whistlez:notifications:${user._id || user.id || user.email || user.role}`;
  const [read, setRead] = useState(() => new Set(loadRead(storageKey)));
  const trigger = useRef(null);
  const popover = useRef(null);
  const writeSession = useRef(null);
  const titleId = useId();
  const isSuperAdmin = user.role === 'superadmin';
  const readUrl = `/${isSuperAdmin ? 'superadmin' : 'admin'}/notifications/read`;

  useEffect(() => {
    const controller = new AbortController();
    writeSession.current = controller;
    return () => controller.abort();
  }, [storageKey]);

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
    let request;
    const reload = async () => {
      if (document.hidden || !popover.current?.getClientRects().length) return;
      request?.abort();
      const current = new AbortController();
      request = current;
      const { signal } = current;
      try {
        const [result, { data }] = await Promise.all([
          readAlerts(isSuperAdmin, signal),
          api.get(readUrl, { signal })
        ]);
        if (signal.aborted) return;

        const accountRead = new Set(data.ids);
        const browserRead = loadRead(storageKey);
        setRead(previous => new Set([...previous, ...accountRead, ...browserRead]));
        setAlerts(result);

        const unsaved = browserRead.filter(id => !accountRead.has(id));
        await saveRead(readUrl, unsaved, signal).catch(() => {
          // The next refresh retries these IDs from browser storage.
        });
      } catch {
        if (!signal.aborted) setAlerts(previous => ({ items: previous?.items || [], error: true }));
      }
    };
    const events = isSuperAdmin ? ['kycSubmitted', 'businessesUpdated', 'adsUpdated'] : ['tokenUpdated', 'kycStatusUpdated'];
    const viewport = window.matchMedia?.('(max-width: 991.98px)');
    reload();
    const interval = window.setInterval(reload, 45000);
    events.forEach(event => socket.on(event, reload));
    document.addEventListener('visibilitychange', reload);
    viewport?.addEventListener('change', reload);
    return () => {
      request?.abort();
      window.clearInterval(interval);
      events.forEach(event => socket.off(event, reload));
      document.removeEventListener('visibilitychange', reload);
      viewport?.removeEventListener('change', reload);
    };
  }, [isSuperAdmin, open, readUrl, refresh, storageKey]);

  const markRead = ids => {
    setRead(previous => new Set([...previous, ...ids]));
    try {
      const browserRead = new Set([...loadRead(storageKey), ...ids]);
      window.localStorage.setItem(storageKey, JSON.stringify([...browserRead]));
    } catch {
      // Keep the current read state when browser storage is unavailable.
    }
    saveRead(readUrl, ids, writeSession.current?.signal).catch(() => {
      // The next refresh retries these IDs from browser storage.
    });
  };

  const unread = alerts?.items.filter(item => !read.has(item.id)) || [];
  return (
    <div className="workspace-notifications" ref={popover}>
      <button type="button" ref={trigger} className="btn btn-outline-secondary workspace-menu workspace-bell"
        aria-label="Notifications" aria-expanded={open} aria-controls={open ? `${titleId}-panel` : undefined}
        onClick={() => setOpen(!open)}>
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
                    <li key={item.id} className="workspace-notification-row" data-unread={!read.has(item.id)}>
                      <Link className="workspace-notification-link text-decoration-none" to={item.link} onClick={() => {
                        markRead([item.id]);
                        setOpen(false);
                      }}>
                        <span className="text-break">
                          <span className="workspace-notification-title d-block">{item.title}</span>
                          <small className="text-muted d-block">{item.description}</small>
                          {timestamp(item.occurredAt) > 0 && <time className="workspace-notification-time text-muted" dateTime={item.occurredAt}>
                            {notificationTime.format(timestamp(item.occurredAt))}
                          </time>}
                        </span>
                      </Link>
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
