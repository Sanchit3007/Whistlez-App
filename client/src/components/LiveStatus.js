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

const LiveStatus = ({ updatedAt, stale = false }) => {
  const connected = useSyncExternalStore(subscribe, connectedSnapshot);
  const live = connected && updatedAt && !stale;
  const state = !connected ? 'Reconnecting' : stale ? 'Refresh failed' : live ? 'Live' : 'Connecting';

  return (
    <span className="d-inline-flex align-items-center flex-wrap gap-2" role="status">
      <span className={`chip ${live ? 'chip-ok' : 'chip-warn'}`}>{state}</span>
      {updatedAt && <span className="small text-muted">Last updated <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time></span>}
    </span>
  );
};

export default LiveStatus;
