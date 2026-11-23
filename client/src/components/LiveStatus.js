import { useSyncExternalStore } from 'react';
import socket from '../socket';

const subscribe = (listener) => {
  socket.on('connect', listener);
  socket.on('disconnect', listener);
  return () => {
    socket.off('connect', listener);
    socket.off('disconnect', listener);
  };
};

const connectedSnapshot = () => Boolean(socket.connected);

const LiveStatus = ({ updatedAt, stale = false, onRetry, refreshing = false }) => {
  const connected = useSyncExternalStore(subscribe, connectedSnapshot);
  const needsAttention = stale || Boolean(updatedAt && !connected);
  const live = Boolean(connected && updatedAt && !stale);
  const state = stale ? 'Refresh failed' : needsAttention ? 'Live connection interrupted' : live ? 'Live' : 'Connecting';

  return (
    <span className="workspace-live-status" data-attention={needsAttention}>
      <span className="d-inline-flex align-items-center flex-wrap gap-2" role="status">
        <span className={`chip ${live ? 'chip-ok' : 'chip-warn'}`}>{state}</span>
        {updatedAt && <span className="small text-muted">Last updated <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time></span>}
      </span>
      {needsAttention && onRetry && (
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={refreshing} onClick={() => {
          if (!socket.connected) socket.connect();
          onRetry();
        }}>{refreshing ? 'Refreshing…' : 'Retry'}</button>
      )}
    </span>
  );
};

export default LiveStatus;
