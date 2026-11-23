import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LiveStatus from './LiveStatus';

const QueueCounterDisplay = ({ counter, date, serving, next, updatedAt, stale, refreshing, onRetry }) => {
  const screen = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === screen.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  return (
    <main className="queue-counter-display" ref={screen}>
      <header className="queue-counter-header">
        <Link className="btn btn-outline-secondary workspace-primary" to="/admin/live-queue">Back to Live Queue</Link>
        {document.fullscreenEnabled && <button type="button" className="btn btn-outline-secondary workspace-primary" onClick={() => {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else screen.current?.requestFullscreen().catch(() => {});
        }}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>}
      </header>
      <div className="queue-counter-body">
        <h1>{counter || 'Serving desk'}</h1>
        <time dateTime={date} className="small text-muted">{new Date(date).toLocaleDateString(undefined, { dateStyle: 'long', timeZone: 'UTC' })}</time>
        <section className="queue-counter-tokens" aria-live="polite">
          <div>
            <p>{updatedAt ? 'Now serving' : stale ? 'Queue unavailable' : 'Loading queue'}</p>
            <strong>{serving || '—'}</strong>
          </div>
          <div>
            <p>Up next</p>
            <strong>{next || '—'}</strong>
          </div>
        </section>
        <LiveStatus updatedAt={updatedAt} stale={stale} refreshing={refreshing} onRetry={onRetry} />
      </div>
    </main>
  );
};

export default QueueCounterDisplay;
