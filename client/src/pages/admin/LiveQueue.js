import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTokenCard } from '../../components/Skeleton';
import FormDialog from '../../components/FormDialog';
import LiveStatus from '../../components/LiveStatus';

const formatArrival = (timestamp) => new Date(timestamp).toLocaleString([], {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const getLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')
].join('-');

const CARDS_PER_PAGE = 3;

const ShiftSummary = ({ date, tokens, formatTokenNumber, stale, onClose }) => {
  const served = tokens.filter(token => token.status === 'completed');
  const outstanding = tokens.filter(token => token.status === 'serving' || token.status === 'waiting');
  const waits = served
    .filter(token => token.calledAt && token.createdAt)
    .map(token => Date.parse(token.calledAt) - Date.parse(token.createdAt))
    .filter(wait => Number.isFinite(wait) && wait >= 0);
  const average = waits.length ? Math.round(waits.reduce((total, wait) => total + wait, 0) / waits.length / 60000) : null;

  return (
    <FormDialog labelledBy="queue-shift-title" onClose={onClose}>
      <div className="modal-content">
        <header className="modal-header gap-2">
          <div>
            <h2 id="queue-shift-title" className="h5 mb-1">End-of-shift summary</h2>
            <time dateTime={date} className="small text-muted">{new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' })}</time>
          </div>
          <button type="button" className="btn-close" aria-label="Close shift summary" onClick={onClose} />
        </header>
        <div className="modal-body">
          {stale && <p className="text-warning">Showing the last successful queue update.</p>}
          <dl className="d-flex flex-wrap justify-content-between gap-3 mb-3">
            <div><dt className="small text-muted">Served</dt><dd className="h5 mb-0">{served.length}</dd></div>
            <div><dt className="small text-muted">Still waiting</dt><dd className="h5 mb-0">{tokens.filter(token => token.status === 'waiting').length}</dd></div>
            <div><dt className="small text-muted">Average wait</dt><dd className="h5 mb-0">{average === null ? '—' : `${average} min`}</dd></div>
          </dl>
          <h3 className="h6">Customers to hand off</h3>
          {outstanding.length ? (
            <ul className="list-unstyled mb-0">
              {outstanding.map(token => (
                <li key={token._id} className="d-flex flex-wrap align-items-center gap-2 border-top py-2">
                  <span className="token-pill">{formatTokenNumber(token.tokenNumber)}</span>
                  <span className="text-break">{token.customerName}</span>
                  <span className="small text-muted ms-auto">{token.status === 'serving' ? 'Serving' : 'Waiting'}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted mb-0">No customers are waiting or being served.</p>}
        </div>
      </div>
    </FormDialog>
  );
};

const QueueTicketCard = ({ number, customerName, className, children }) => (
  <details className={`kanban-card queue-ticket-card ${className}`}>
    <summary className="queue-ticket-summary">
      <span className="token-pill">{number}</span>
      <span className="kanban-card-title">{customerName}</span>
      <i className="bi bi-chevron-down" aria-hidden="true" />
    </summary>
    <div className="queue-ticket-body">{children}</div>
  </details>
);

const QueueCardPage = ({ tickets, stage, children }) => {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(tickets.length / CARDS_PER_PAGE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * CARDS_PER_PAGE;
  const visibleTickets = tickets.slice(start, start + CARDS_PER_PAGE);

  useEffect(() => {
    setPage(current => Math.min(current, lastPage));
  }, [lastPage]);

  return (
    <>
      {visibleTickets.map((ticket, index) => children(ticket, start + index))}
      {lastPage > 0 && (
        <nav className="queue-card-pagination" aria-label={`${stage} ticket pages`}>
          <span className="text-muted small" role="status">{start + 1}–{start + visibleTickets.length} of {tickets.length}</span>
          <div>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" aria-label={`View more ${stage.toLowerCase()} tickets`} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>
              View more
            </button>
          </div>
        </nav>
      )}
    </>
  );
};

const LiveQueue = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedToken = searchParams.get('ticket');
  const linkedDate = searchParams.get('date');
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queueSnapshot, setQueueSnapshot] = useState(null);
  const queueRequest = useRef(null);
  const [callPreview, setCallPreview] = useState(null);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState('');
  const toast = useToast();
  const knownIds = useRef(null);
  const [freshIds, setFreshIds] = useState(new Set());

  // Helper to extract queue display name first character as prefix
  const getQueuePrefix = () => {
    return business?.queueConfig?.name ? business.queueConfig.name.charAt(0).toUpperCase() : 'A';
  };

  const formatTokenNumber = (num) => {
    if (!num) return '';
    if (/^[A-Za-z]+-?\d+/.test(num)) return num;
    return `${getQueuePrefix()}-${num}`;
  };

  // Selected Token for Detail Drawer
  const [selectedToken, setSelectedToken] = useState(null);
  const [activeStage, setActiveStage] = useState('nextup');
  const detailsDialog = useRef(null);
  const detailsTrigger = useRef(null);
  const queueHeading = useRef(null);
  const isDetailsOpen = Boolean(selectedToken);

  useEffect(() => {
    const dialog = detailsDialog.current;
    if (isDetailsOpen && dialog && !dialog.open) dialog.showModal();
    if (!isDetailsOpen && dialog?.open) dialog.close();
  }, [isDetailsOpen]);

  const closeDetails = () => {
    detailsDialog.current?.close();
    setSelectedToken(null);
    const trigger = detailsTrigger.current;
    (trigger?.isConnected && trigger.getClientRects().length ? trigger : queueHeading.current)?.focus();
  };

  const renderDetailsButton = (token, position) => (
    <button
      type="button"
      className="btn btn-outline-secondary btn-sm queue-details-button"
      aria-label={`Details for token ${formatTokenNumber(token.tokenNumber)}`}
      onClick={(event) => {
        detailsTrigger.current = event.currentTarget;
        setSelectedToken({ token, position });
      }}
    >
      Details
    </button>
  );

  // Walk-in Modal state
  const [showModal, setShowModal] = useState(false);
  const walkInDialog = useRef(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [addingToken, setAddingToken] = useState(false);
  const [walkInError, setWalkInError] = useState('');

  useEffect(() => {
    const dialog = walkInDialog.current;
    if (showModal && dialog && !dialog.open) dialog.showModal();
    if (!showModal && dialog?.open) dialog.close();
  }, [showModal]);

  // Time ticker state (for calculating relative wait times in real-time)
  const [currentTime, setCurrentTime] = useState(new Date());

  // Date Picker states for Live Queue
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [postponeDate, setPostponeDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [postponing, setPostponing] = useState(false);

  useEffect(() => {
    if (linkedToken && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate || '') && linkedDate !== selectedDate) {
      setSelectedDate(linkedDate);
    }
  }, [linkedToken, linkedDate, selectedDate]);

  useEffect(() => {
    if (!linkedToken || (linkedDate && linkedDate !== selectedDate) || queueSnapshot?.date !== selectedDate || loading) return;
    const token = tokens.find(item => item._id === linkedToken);
    if (token) {
      const position = tokens.filter(item => item.status === 'waiting').findIndex(item => item._id === token._id) + 1;
      detailsTrigger.current = null;
      setSelectedToken({ token, position });
    }
    const params = new URLSearchParams(searchParams);
    params.delete('ticket');
    params.delete('date');
    setSearchParams(params, { replace: true });
  }, [linkedToken, linkedDate, selectedDate, queueSnapshot, loading, tokens, searchParams, setSearchParams]);

  const fetchLiveQueueData = useCallback(async () => {
    queueRequest.current?.abort();
    const request = new AbortController();
    queueRequest.current = request;
    try {
      const [tokensRes, businessRes] = await Promise.all([
        api.get(`/admin/tokens?date=${selectedDate}`, { signal: request.signal }),
        api.get('/admin/business', { signal: request.signal })
      ]);
      if (request.signal.aborted) return;
      if (!tokensRes.data.success) throw new Error('Could not retrieve live queue data.');

      setTokens(tokensRes.data.tokens);
      setQueueSnapshot({ date: selectedDate, at: new Date() });
      if (businessRes.data.success) {
        setBusiness(businessRes.data.business);
      }
      setError('');
    } catch (err) {
      if (request.signal.aborted) return;
      console.error('Error fetching live queue data', err);
      setError('Could not retrieve live queue data.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchLiveQueueData();
    return () => queueRequest.current?.abort();
  }, [fetchLiveQueueData]);

  useEffect(() => {
    // Update local clock every 10 seconds for wait timers
    const intervalClock = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);

    return () => {
      clearInterval(intervalClock);
    };
  }, []);

  // Socket listener for instantaneous updates
  const businessId = business?._id;
  useEffect(() => {
    if (!businessId) return undefined;

    const joinBusiness = () => socket.emit('joinBusiness', businessId);
    const reconnect = () => {
      joinBusiness();
      fetchLiveQueueData();
    };
    if (socket.connected) joinBusiness();
    socket.on('connect', reconnect);
    return () => socket.off('connect', reconnect);
  }, [businessId, fetchLiveQueueData]);

  useEffect(() => {
    if (!businessId) return undefined;
    socket.on('tokenUpdated', fetchLiveQueueData);
    return () => socket.off('tokenUpdated', fetchLiveQueueData);
  }, [businessId, fetchLiveQueueData]);

  // Reset the "new token" baseline when the viewed date changes
  useEffect(() => {
    knownIds.current = null;
  }, [selectedDate]);

  // Highlight tokens that appear after the first load (e.g. arriving over the socket)
  useEffect(() => {
    if (loading) return undefined;
    const ids = new Set(tokens.map((t) => t._id));
    if (knownIds.current === null) {
      knownIds.current = ids;
      return undefined;
    }
    const added = [...ids].filter((id) => !knownIds.current.has(id));
    knownIds.current = ids;
    if (added.length === 0) return undefined;
    setFreshIds(new Set(added));
    const timer = setTimeout(() => setFreshIds(new Set()), 2400);
    return () => clearTimeout(timer);
  }, [tokens, loading]);

  const handlePostponeToken = async () => {
    if (!selectedToken || !postponeDate) return;
    try {
      setPostponing(true);
      const res = await api.put(`/admin/tokens/${selectedToken.token._id}/postpone`, {
        postponedDate: postponeDate
      });
      if (res.data.success) {
        toast.success(`Token successfully postponed to ${postponeDate}`);
        closeDetails();
        fetchLiveQueueData();
      }
    } catch (err) {
      console.error('Error postponing token', err);
      toast.error(err.response?.data?.message || 'Error rescheduling token');
    } finally {
      setPostponing(false);
    }
  };

  const handleAddToken = async (e) => {
    e.preventDefault();
    if (addingToken) return;
    if (!customerName.trim() || !customerPhone.trim() || !visitPurpose.trim()) {
      setWalkInError('Enter the customer’s name, phone number, and purpose of visit.');
      return;
    }

    const arrival = new Date(`${visitDate}T${visitTime}`);
    if (!Number.isFinite(arrival.getTime()) || arrival.getTime() > Date.now()) {
      setWalkInError('Enter an arrival date and time at or before now.');
      return;
    }

    setAddingToken(true);
    setWalkInError('');

    try {
      const res = await api.post('/admin/tokens/add', {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        visitPurpose: visitPurpose.trim(),
        visitAt: arrival.toISOString(),
        visitNotes: visitNotes.trim()
      });

      if (res.data.success) {
        toast.success(`Token #${res.data.token.tokenNumber} created successfully for ${customerName}!`);
        setCustomerName('');
        setCustomerPhone('');
        setVisitPurpose('');
        setVisitDate('');
        setVisitTime('');
        setVisitNotes('');
        setShowModal(false);
        fetchLiveQueueData();
      }
    } catch (err) {
      console.error('Error creating token', err);
      setWalkInError(err.response?.data?.message || 'Could not register the token. Try again.');
    } finally {
      setAddingToken(false);
    }
  };

  const handleCallToken = async (tokenId) => {
    if (calling) return;
    setCalling(true);
    setCallError('');
    try {
      const res = await api.put(`/admin/tokens/${tokenId}/status`, { status: 'serving', expectedStatus: 'waiting' });
      if (res.data.success) {
        toast.success(`Token #${res.data.token.tokenNumber} called to serving desk.`);
        setCallPreview(null);
        await fetchLiveQueueData();
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Could not call this token. Try again.';
      if (callPreview) setCallError(message);
      else toast.error(message);
      if (err.response?.status === 409) await fetchLiveQueueData();
    } finally {
      setCalling(false);
    }
  };

  const handleCompleteToken = async (tokenId) => {
    try {
      const res = await api.put(`/admin/tokens/${tokenId}/status`, { status: 'completed' });
      if (res.data.success) {
        toast.success(`Token #${res.data.token.tokenNumber} marked completed.`);
        fetchLiveQueueData();
      }
    } catch (err) {
      console.error('Error completing token', err);
      toast.error('Failed to complete token.');
    }
  };

  const handleMoveBackToken = async (tokenId) => {
    try {
      const res = await api.put(`/admin/tokens/${tokenId}/status`, { status: 'waiting' });
      if (res.data.success) {
        toast.success(`Token #${res.data.token.tokenNumber} moved back.`);
        fetchLiveQueueData();
      }
    } catch (err) {
      console.error('Error moving token back', err);
      toast.error('Failed to move token back.');
    }
  };

  const handleCancelToken = async (tokenId) => {
    try {
      const res = await api.put(`/admin/tokens/${tokenId}/status`, { status: 'cancelled' });
      if (res.data.success) {
        toast.success(`Token #${res.data.token.tokenNumber} cancelled.`);
        fetchLiveQueueData();
      }
    } catch (err) {
      console.error('Error cancelling token', err);
      toast.error('Failed to cancel token.');
    }
  };

  // Helper: calculate minutes elapsed
  const getMinutesElapsed = (timeString) => {
    if (!timeString) return 0;
    const diffMs = currentTime - new Date(timeString);
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Helper: format clock string
  const formatClock = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
      ' | ' + date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Filter lists based on statuses
  const currentSnapshot = queueSnapshot?.date === selectedDate;
  const selectedDayTokens = currentSnapshot ? tokens : [];
  const loadingStage = loading || (!currentSnapshot && !error);
  const waitingList = selectedDayTokens.filter(t => t.status === 'waiting');
  
  // Next Up = first 2 waiting tokens
  const nextUpList = waitingList.slice(0, 2);
  
  // Remaining Waiting = waiting tokens from index 2 onwards
  const remainingWaitingList = waitingList.slice(2);
  
  const servingList = selectedDayTokens.filter(t => t.status === 'serving');
  const completedList = selectedDayTokens.filter(t => t.status === 'completed' || t.status === 'skipped' || t.status === 'cancelled' || t.status === 'postponed');

  // Wait meter: elapsed minutes vs the expected wait (service time x position in line)
  const serviceMins = business?.queueConfig?.serviceTime || 15;
  const meterFor = (createdAt, position) => {
    const expected = Math.max(serviceMins, serviceMins * position);
    const elapsed = getMinutesElapsed(createdAt);
    const pct = Math.min(100, Math.round((elapsed / expected) * 100));
    const tone = pct >= 100 ? 'is-late' : pct >= 75 ? 'is-warn' : '';
    return { pct, tone };
  };
  const nowServing = servingList[0];
  const upNext = nextUpList[0];

  // Stats aggregate counts
  const totalWaitingCount = remainingWaitingList.length;
  const nextUpCount = nextUpList.length;
  const servingCount = servingList.length;
  const completedCount = completedList.length;

  return (
    <div className="live-queue-page-container animated-fade-in position-relative">
      {/* HEADER SECTION */}
      <div className="workspace-heading">
        <div>
          <h1 ref={queueHeading} tabIndex={-1} className="fw-extrabold text-dark mb-1">Live Queue</h1>
          <p className="text-muted small mb-0 d-flex align-items-center flex-wrap gap-2">
            <span className="fw-bold text-dark">{business?.queueConfig?.name || 'General OPD Queue'}</span>
            <LiveStatus updatedAt={currentSnapshot ? queueSnapshot.at : null} stale={Boolean(error)} />
            <span className="font-monospace text-muted">{formatClock(currentTime)}</span>
          </p>
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

          <button 
            className="btn btn-primary workspace-primary"
            onClick={() => {
              if (business?.businessStatus !== 'Active') {
                toast.warning('Please complete your KYC and wait for Super Admin approval before generating tokens.');
                return;
              }
              if (!visitDate || !visitTime) {
                const now = new Date();
                setVisitDate(getLocalDate(now));
                setVisitTime(now.toTimeString().slice(0, 5));
              }
              setWalkInError('');
              setShowModal(true);
            }}
            disabled={business?.businessStatus !== 'Active'}
            aria-describedby={business && business.businessStatus !== 'Active' ? 'walk-in-unavailable' : undefined}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true"></i> Add walk-in token
          </button>
          <button type="button" className="btn btn-outline-primary workspace-primary" disabled={!currentSnapshot} onClick={() => setShowShiftSummary(true)}>
            Shift summary
          </button>
          {business && business.businessStatus !== 'Active' && <span id="walk-in-unavailable" className="small text-muted">KYC approval is required to add walk-ins.</span>}
        </div>
      </div>

      {showShiftSummary && <ShiftSummary date={selectedDate} tokens={selectedDayTokens} formatTokenNumber={formatTokenNumber}
        stale={Boolean(error)} onClose={() => setShowShiftSummary(false)} />}

      {error && (
        <div className="alert alert-danger border-0 rounded-3 small mb-4 d-flex align-items-center py-2 shadow-sm" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      {/* STAGE PROGRESS PATH ROW */}
      <div className="stage-path-container queue-stage-summary mb-4 shadow-sm">
        <div className="stage-path-item">
          <div className="stage-path-icon stat-widget-orange">
            <i className="bi bi-hourglass-split"></i>
          </div>
          <div>
            <span className="text-muted small fw-semibold d-block">Waiting</span>
            <strong className="text-dark">{totalWaitingCount}</strong>
          </div>
        </div>
        
        <div className="stage-path-line"></div>

        <div className="stage-path-item">
          <div className="stage-path-icon stat-widget-purple">
            <i className="bi bi-arrow-right-circle-fill"></i>
          </div>
          <div>
            <span className="text-muted small fw-semibold d-block">Next Up</span>
            <strong className="text-dark">{nextUpCount}</strong>
          </div>
        </div>

        <div className="stage-path-line"></div>

        <div className="stage-path-item">
          <div className="stage-path-icon stat-widget-blue">
            <i className="bi bi-person-badge-fill"></i>
          </div>
          <div>
            <span className="text-muted small fw-semibold d-block">Serving</span>
            <strong className="text-dark">{servingCount}</strong>
          </div>
        </div>

        <div className="stage-path-line"></div>

        <div className="stage-path-item">
          <div className="stage-path-icon stat-widget-green">
            <i className="bi bi-check-all"></i>
          </div>
          <div>
            <span className="text-muted small fw-semibold d-block">Completed</span>
            <strong className="text-dark">{completedCount}</strong>
          </div>
        </div>
      </div>

      {/* NOW SERVING STRIP (readable from across the room) */}
      <div className={`now-serving ${nowServing ? '' : 'is-idle'}`} aria-live="polite">
        <div style={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
          <div className="ns-label">
            {nowServing && <span className="live-dot"></span>}
            {nowServing ? 'Now serving' : 'Counter is free'}
          </div>
          {nowServing ? (
            <div className="d-flex align-items-baseline flex-wrap gap-3">
              <span key={`${nowServing._id}-${nowServing.calledAt}`} className="ns-token called-token">{formatTokenNumber(nowServing.tokenNumber)}</span>
              <span className="ns-meta">
                {nowServing.customerName} - {getMinutesElapsed(nowServing.calledAt)}m at the desk
              </span>
            </div>
          ) : (
            <div className="d-flex align-items-center flex-wrap gap-3">
              <span className="ns-token">--</span>
              <span className="ns-meta">
                {upNext ? `Up next: ${formatTokenNumber(upNext.tokenNumber)} - ${upNext.customerName}` : 'No one is waiting right now'}
              </span>
            </div>
          )}
        </div>
        <div className="ns-actions">
          {nowServing && (
            <button type="button" className="ns-btn ghost" onClick={() => handleCompleteToken(nowServing._id)}>
              Complete
            </button>
          )}
          <div className="d-grid gap-1">
            <button type="button" className="ns-btn" aria-describedby="queue-next-description" disabled={!upNext || !currentSnapshot || Boolean(error) || calling} onClick={() => {
              setCallError('');
              setCallPreview(upNext);
            }}>Call next</button>
            <span id="queue-next-description" className="ns-meta small">{currentSnapshot && !error
              ? upNext ? `${formatTokenNumber(upNext.tokenNumber)} · Serving desk` : 'No waiting tickets'
              : 'Waiting for current queue data'}</span>
          </div>
        </div>
      </div>

      {callPreview && (
        <FormDialog labelledBy="queue-call-title" busy={calling} onClose={() => setCallPreview(null)}>
          <div className="modal-content">
            <div className="modal-header"><h2 id="queue-call-title" className="h5 mb-0">Call {formatTokenNumber(callPreview.tokenNumber)}</h2></div>
            <div className="modal-body">
              <p><strong>{callPreview.customerName}</strong></p>
              <p className="mb-0 text-muted">Serving desk · {business?.queueConfig?.name || 'Current queue'}</p>
              {callError && <p className="text-danger mt-3 mb-0" role="alert">{callError}</p>}
              {!callError && upNext?._id !== callPreview._id && <p className="text-warning mt-3 mb-0" role="status">The next ticket changed. Close this preview and select Call next again.</p>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setCallPreview(null)} disabled={calling}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={calling || upNext?._id !== callPreview._id} onClick={() => handleCallToken(callPreview._id)}>{calling ? 'Calling…' : 'Call ticket'}</button>
            </div>
          </div>
        </FormDialog>
      )}
      <div className="queue-board-area">
        <div className="queue-stage-picker" role="group" aria-label="Queue stage">
          {[
            ['waiting', 'Waiting', totalWaitingCount],
            ['nextup', 'Next Up', nextUpCount],
            ['serving', 'Serving', servingCount],
            ['completed', 'Completed', completedCount],
          ].map(([stage, label, count]) => (
            <button
              key={stage}
              type="button"
              aria-pressed={stage === activeStage}
              aria-controls={`queue-stage-${stage}`}
              onClick={() => setActiveStage(stage)}
            >
              {label} <span className="kcol-count">{count}</span>
            </button>
          ))}
        </div>
        <div className="kanban-container" data-active-stage={activeStage}>
          {/* COLUMN 1: WAITING */}
          <div id="queue-stage-waiting" className="kanban-column-wrapper queue-column-waiting">
            <div className="kanban-column-header">
              <span className="kcol-title"><i className="kcol-dot"></i>Waiting <span className="kcol-count">{totalWaitingCount}</span></span>
              <i className="bi bi-three-dots text-muted"></i>
            </div>
            
            <div className="kanban-column-list">
              {loadingStage ? (
                <>
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                </>
              ) : remainingWaitingList.length > 0 ? (
                <QueueCardPage key={selectedDate} tickets={remainingWaitingList} stage="Waiting">
                  {(t, idx) => (
                    <QueueTicketCard
                      key={t._id} 
                      number={formatTokenNumber(t.tokenNumber)}
                      customerName={t.customerName}
                      className={`kanban-card-border-waiting ${freshIds.has(t._id) ? 'is-new' : ''}`}
                    >
                      <div className="kanban-card-subtext">
                        <i className="bi bi-clock me-1" aria-hidden="true"></i> Waiting {getMinutesElapsed(t.createdAt)}m
                      </div>
                      <div className="kanban-card-phone">{t.customerPhone}</div>
                      <div className={`wait-meter ${meterFor(t.createdAt, idx + 3).tone}`} role="progressbar" aria-label="Wait progress" aria-valuenow={meterFor(t.createdAt, idx + 3).pct} aria-valuemin="0" aria-valuemax="100">
                        <span style={{ width: `${meterFor(t.createdAt, idx + 3).pct}%` }}></span>
                      </div>
                      <div className="kanban-card-actions">
                        {renderDetailsButton(t, idx + 3)}
                      </div>
                    </QueueTicketCard>
                  )}
                </QueueCardPage>
              ) : (
                <div className="kanban-empty">
                  <i className="bi bi-hourglass"></i>
                  No one waiting beyond Next Up.
                </div>
              )}
            </div>
          </div>
  
          {/* COLUMN 2: NEXT UP */}
          <div id="queue-stage-nextup" className="kanban-column-wrapper queue-column-nextup">
            <div className="kanban-column-header">
              <span className="kcol-title"><i className="kcol-dot"></i>Next Up <span className="kcol-count">{nextUpCount}</span></span>
              <i className="bi bi-arrow-right-square text-muted"></i>
            </div>
  
            <div className="kanban-column-list">
              {loadingStage ? (
                <>
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                </>
              ) : nextUpList.length > 0 ? (
                <QueueCardPage key={selectedDate} tickets={nextUpList} stage="Next Up">
                  {(t, idx) => (
                    <QueueTicketCard
                      key={t._id} 
                      number={formatTokenNumber(t.tokenNumber)}
                      customerName={t.customerName}
                      className={`kanban-card-border-nextup ${freshIds.has(t._id) ? 'is-new' : ''}`}
                    >
                      <div className="kanban-card-subtext">
                        <i className="bi bi-clock me-1" aria-hidden="true"></i> Waiting {getMinutesElapsed(t.createdAt)}m
                      </div>
                      <div className="kanban-card-phone">{t.customerPhone}</div>
                      <div className={`wait-meter mb-2 ${meterFor(t.createdAt, idx + 1).tone}`} role="progressbar" aria-label="Wait progress" aria-valuenow={meterFor(t.createdAt, idx + 1).pct} aria-valuemin="0" aria-valuemax="100">
                        <span style={{ width: `${meterFor(t.createdAt, idx + 1).pct}%` }}></span>
                      </div>
                      
                      {/* Next up actions */}
                      <div className="kanban-card-actions">
                        {renderDetailsButton(t, idx + 1)}
                        <button 
                          className="btn btn-outline-secondary btn-sm flex-grow-1 py-1 rounded-3" 
                          onClick={() => handleMoveBackToken(t._id)}
                        >
                          Back
                        </button>
                        <button 
                          className="btn btn-primary btn-sm flex-grow-1 py-1 rounded-3 fw-bold"
                          onClick={() => handleCallToken(t._id)}
                        >
                          Call
                        </button>
                      </div>
                    </QueueTicketCard>
                  )}
                </QueueCardPage>
              ) : (
                <div className="kanban-empty">
                  <i className="bi bi-person-plus"></i>
                  No staged candidates.
                </div>
              )}
            </div>
          </div>
  
          {/* COLUMN 3: SERVING */}
          <div id="queue-stage-serving" className="kanban-column-wrapper queue-column-serving">
            <div className="kanban-column-header">
              <span className="kcol-title"><i className="kcol-dot"></i>Serving <span className="kcol-count">{servingCount}</span></span>
              <i className="bi bi-check-circle text-muted"></i>
            </div>
  
            <div className="kanban-column-list">
              {loadingStage ? (
                <>
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                </>
              ) : servingList.length > 0 ? (
                <QueueCardPage key={selectedDate} tickets={servingList} stage="Serving">
                  {t => (
                    <QueueTicketCard
                      key={t._id} 
                      number={formatTokenNumber(t.tokenNumber)}
                      customerName={t.customerName}
                      className="kanban-card-border-serving is-serving"
                    >
                      <div className="kanban-card-subtext text-success fw-semibold">
                        <i className="bi bi-play-circle me-1" aria-hidden="true"></i> Serving {getMinutesElapsed(t.calledAt)}m
                      </div>
                      <div className="kanban-card-phone">{t.customerPhone}</div>
  
                      {/* Serving actions */}
                      <div className="kanban-card-actions">
                        {renderDetailsButton(t, 0)}
                        <button 
                          className="btn btn-outline-secondary btn-sm flex-grow-1 py-1 rounded-3"
                          onClick={() => handleMoveBackToken(t._id)}
                        >
                          Back
                        </button>
                        <button 
                          className="btn btn-success btn-sm flex-grow-1 py-1 rounded-3 fw-bold border-0"
                          onClick={() => handleCompleteToken(t._id)}
                        >
                          Complete
                        </button>
                      </div>
                    </QueueTicketCard>
                  )}
                </QueueCardPage>
              ) : (
                <div className="kanban-empty">
                  <i className="bi bi-person-check"></i>
                  No active serving.
                </div>
              )}
            </div>
          </div>
  
          {/* COLUMN 4: COMPLETED */}
          <div id="queue-stage-completed" className="kanban-column-wrapper queue-column-completed">
            <div className="kanban-column-header">
              <span className="kcol-title"><i className="kcol-dot"></i>Completed <span className="kcol-count">{completedCount}</span></span>
              <i className="bi bi-journal-check text-muted"></i>
            </div>
  
            <div className="kanban-column-list">
              {loadingStage ? (
                <>
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                  <SkeletonTokenCard />
                </>
              ) : completedList.length > 0 ? (
                <QueueCardPage key={selectedDate} tickets={completedList} stage="Completed">
                  {t => (
                    <QueueTicketCard
                      key={t._id} 
                      number={formatTokenNumber(t.tokenNumber)}
                      customerName={t.customerName}
                      className="kanban-card-border-completed"
                    >
                      <div className="mb-2">
                        <span className={`badge rounded-pill ${
                          t.status === 'completed' ? 'bg-success-subtle text-success' : 
                          t.status === 'skipped' ? 'bg-danger-subtle text-danger' : 
                          t.status === 'cancelled' ? 'bg-danger-subtle text-danger' : 
                          'bg-warning-subtle text-warning'
                        }`} style={{ fontSize: '0.6rem' }}>
                          {t.status === 'completed' ? 'Completed' : 
                           t.status === 'skipped' ? 'Skipped' : 
                           t.status === 'cancelled' ? 'Cancelled' : 'Postponed'}
                        </span>
                      </div>
                      <div className="kanban-card-subtext">
                        Ended: {t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                      <div className="kanban-card-phone">{t.customerPhone}</div>
                      <div className="kanban-card-actions">{renderDetailsButton(t, -1)}</div>
                    </QueueTicketCard>
                  )}
                </QueueCardPage>
              ) : (
                <div className="text-center py-5 text-muted small bg-white rounded-3 border">
                  No completed history.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <dialog
        ref={detailsDialog}
        className="details-drawer queue-details-drawer"
        aria-labelledby="queue-details-title"
        onCancel={(event) => {
          event.preventDefault();
          closeDetails();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right) closeDetails();
        }}
      >
        {selectedToken && (
          <>
            <button type="button" className="details-drawer-close" onClick={closeDetails} aria-label="Close ticket details">
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
            
            <div className="text-center mb-4">
              <span className="badge bg-primary bg-gradient rounded-pill px-3 py-1.5 fw-bold mb-2">
                #{selectedToken.token.tokenNumber}
              </span>
              <h2 id="queue-details-title" className="fw-extrabold text-dark display-6 mb-1">{formatTokenNumber(selectedToken.token.tokenNumber)}</h2>
              <span className={`badge rounded-pill px-3 py-1.5 text-uppercase ${
                selectedToken.token.status === 'completed' ? 'bg-success-subtle text-success' :
                selectedToken.token.status === 'skipped' ? 'bg-danger-subtle text-danger' :
                selectedToken.token.status === 'cancelled' ? 'bg-danger-subtle text-danger' :
                selectedToken.token.status === 'postponed' ? 'bg-warning-subtle text-warning' :
                selectedToken.token.status === 'serving' ? 'bg-warning-subtle text-warning' :
                'bg-primary-subtle text-primary'
              }`} style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                {selectedToken.token.status}
              </span>
            </div>

            {/* Customer specs */}
            <div className="details-info-section">
              <h6 className="text-muted small fw-semibold text-uppercase tracking-wider mb-2">Customer Details</h6>
              <h5 className="fw-bold text-dark mb-1">{selectedToken.token.customerName}</h5>
              <p className="text-muted small mb-0"><i className="bi bi-phone me-1"></i> {selectedToken.token.customerPhone}</p>
            </div>

            {(selectedToken.token.visitPurpose || selectedToken.token.visitNotes) && (
              <div className="details-info-section">
                <h3 className="text-muted small fw-semibold text-uppercase tracking-wider mb-2">Visit details</h3>
                {selectedToken.token.visitPurpose && <p className="queue-visit-notes mb-0">{selectedToken.token.visitPurpose}</p>}
                {selectedToken.token.visitNotes && (
                  <>
                    <h4 className="text-muted small fw-semibold mt-3 mb-1">Staff notes</h4>
                    <p className="queue-visit-notes mb-0">{selectedToken.token.visitNotes}</p>
                  </>
                )}
              </div>
            )}

            {/* Ticket Info timeline */}
            <div className="details-info-section">
              <h6 className="text-muted small fw-semibold text-uppercase tracking-wider mb-3">Ticket Information</h6>
              
              <div className="list-group list-group-flush small">
                {selectedToken.token.visitAt && (
                  <div className="list-group-item bg-transparent d-flex justify-content-between gap-2 px-0 py-2 border-0 border-bottom">
                    <span className="text-muted">Arrival</span>
                    <time className="text-dark fw-bold text-end" dateTime={selectedToken.token.visitAt}>{formatArrival(selectedToken.token.visitAt)}</time>
                  </div>
                )}
                <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0 border-bottom">
                  <span className="text-muted">Registered At</span>
                  <strong className="text-dark">
                    {new Date(selectedToken.token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
                
                {selectedToken.position > 0 && (
                  <>
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0 border-bottom">
                      <span className="text-muted">Estimated Wait</span>
                      <strong className="text-primary">
                        ~{selectedToken.position * (business?.queueConfig?.serviceTime || 15)} mins
                      </strong>
                    </div>
                    <div className="list-group-item bg-transparent d-flex justify-content-between px-0 py-2 border-0">
                      <span className="text-muted">Queue Position</span>
                      <strong className="text-dark">
                        {selectedToken.position}
                        {selectedToken.position === 1 ? 'st' : selectedToken.position === 2 ? 'nd' : selectedToken.position === 3 ? 'rd' : 'th'} in Line
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="mt-auto pt-4 border-top">
              {selectedToken.token.status === 'waiting' && (
                <div className="d-grid gap-2 mb-3">
                  <button 
                    className="btn btn-outline-primary py-2.5 rounded-3 fw-bold d-flex align-items-center justify-content-center"
                    onClick={() => {
                      toast.info(`Calling client ${formatTokenNumber(selectedToken.token.tokenNumber)} via Megaphone!`);
                    }}
                  >
                    <i className="bi bi-megaphone me-2 fs-5"></i> Call Client
                  </button>
                </div>
              )}

              {selectedToken.token.status === 'waiting' && (
                <div className="border-top my-3 pt-3">
                  <label htmlFor="queue-postpone-date" className="form-label small fw-semibold text-muted text-uppercase tracking-wider">Postpone / Reschedule</label>
                  <div className="input-group mb-2">
                    <input 
                      id="queue-postpone-date"
                      type="date" 
                      className="form-control form-control-sm" 
                      value={postponeDate}
                      onChange={(e) => setPostponeDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <button 
                      className="btn btn-outline-primary btn-sm fw-bold px-3"
                      onClick={handlePostponeToken}
                      disabled={postponing}
                    >
                      {postponing ? 'Rescheduling...' : 'Postpone'}
                    </button>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                    If the customer goes outside or requests another time, move this token to any future date.
                  </p>
                </div>
              )}

              {['waiting', 'serving'].includes(selectedToken.token.status) && (
                <button 
                  className="btn btn-danger w-100 py-3 rounded-3 fw-bold"
                  onClick={() => {
                    handleCancelToken(selectedToken.token._id);
                    closeDetails();
                  }}
                >
                  Cancel Token
                </button>
              )}
            </div>
          </>
        )}
      </dialog>

      <dialog
        ref={walkInDialog}
        className="workspace-walk-in"
        aria-labelledby="queue-walk-in-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!addingToken) setShowModal(false);
        }}
      >
        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 id="queue-walk-in-title" className="h5 fw-bold mb-0">Register walk-in customer</h2>
          <button type="button" className="btn-close" aria-label="Close walk-in form" disabled={addingToken} onClick={() => setShowModal(false)}></button>
        </div>
        <form className="d-grid gap-3" onSubmit={handleAddToken}>
          {walkInError && <p className="alert alert-danger mb-0" role="alert">{walkInError}</p>}
          <fieldset className="queue-walk-in-fields">
            <legend className="portal-form-section-title"><i className="bi bi-person portal-form-icon" aria-hidden="true" /> Customer details</legend>
            <div className="queue-walk-in-pair">
              <label className="workspace-field">
                <span>Customer name (required)</span>
                <input
                  autoFocus
                  type="text"
                  autoComplete="off"
                  className="form-control"
                  placeholder="e.g. Johnathan Smith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </label>
              <label className="workspace-field">
                <span>Phone number (required)</span>
                <input
                  type="tel"
                  autoComplete="off"
                  className="form-control"
                  placeholder="e.g. +91 98765 43210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="queue-walk-in-fields">
            <legend className="portal-form-section-title"><i className="bi bi-calendar-event portal-form-icon" aria-hidden="true" /> Visit details</legend>
            <label className="workspace-field">
              <span>Purpose of visit (required)</span>
              <input type="text" className="form-control" placeholder="e.g. Consultation or pickup" value={visitPurpose} onChange={(event) => setVisitPurpose(event.target.value)} maxLength={100} required />
            </label>
            <div className="queue-walk-in-pair">
              <label className="workspace-field">
                <span>Arrival date</span>
                <input type="date" className="form-control" value={visitDate} max={getLocalDate(currentTime)} onChange={(event) => setVisitDate(event.target.value)} aria-describedby="queue-arrival-help" required />
              </label>
              <label className="workspace-field">
                <span>Arrival time</span>
                <input type="time" className="form-control" value={visitTime} onChange={(event) => setVisitTime(event.target.value)} aria-describedby="queue-arrival-help" required />
              </label>
            </div>
            <p id="queue-arrival-help" className="portal-file-detail mb-0">Record an arrival at or before now using your device’s local time. Registering adds the token to the current queue.</p>
            <label className="workspace-field">
              <span>Staff notes (optional)</span>
              <textarea className="form-control" rows={2} maxLength={300} value={visitNotes} onChange={(event) => setVisitNotes(event.target.value)} />
            </label>
          </fieldset>
          <div className="queue-walk-in-actions d-flex flex-wrap gap-2 mt-1">
            <button type="button" className="btn btn-outline-secondary flex-grow-1" disabled={addingToken} onClick={() => setShowModal(false)}>
              Close
            </button>
            <button type="submit" className="btn btn-primary workspace-primary flex-grow-1" disabled={addingToken}>
              {addingToken ? 'Registering…' : 'Register token'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};

export default LiveQueue;
