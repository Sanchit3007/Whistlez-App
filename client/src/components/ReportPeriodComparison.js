import React, { useEffect, useId, useState } from 'react';
import { api } from '../context/AuthContext';
import { BarTrend } from './Charts';
import FilterToolbar from './FilterToolbar';

const dayMs = 86400000;
const dateKey = timestamp => new Date(timestamp).toISOString().slice(0, 10);
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const averageWait = (tokens) => {
  const waits = tokens.map(token => Date.parse(token.calledAt) - Date.parse(token.createdAt))
    .filter(value => Number.isFinite(value) && value >= 0);
  return waits.length ? Math.round(waits.reduce((sum, wait) => sum + wait, 0) / waits.length / 60000) : null;
};
const rangeLabel = (start, end) => `${shortDate.format(start)} – ${shortDate.format(end - dayMs)}`;

const ReportPeriodComparison = ({ queue = false, compact = false }) => {
  const titleId = useId();
  const [days, setDays] = useState(7);
  const [today] = useState(() => Date.parse(dateKey(Date.now())));
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const currentStart = today - days * dayMs;
  const previousStart = currentStart - days * dayMs;

  useEffect(() => {
    const request = new AbortController();
    const params = queue ? { startDate: dateKey(today - 60 * dayMs), endDate: dateKey(today - dayMs) } : undefined;
    api.get(queue ? '/admin/tokens' : '/superadmin/businesses', { params, signal: request.signal })
      .then(({ data }) => {
        const items = queue ? data.tokens : data.businesses;
        if (!data.success || !Array.isArray(items)) throw new Error('Could not load report comparison.');
        if (!request.signal.aborted) setRecords(items);
      })
      .catch(() => {
        if (!request.signal.aborted) setError(true);
      });
    return () => request.abort();
  }, [queue, retry, today]);

  const periodValue = (start, end) => {
    if (!records) return null;
    const selected = records.filter(record => {
      const created = Date.parse(record.createdAt);
      return created >= start && created < end;
    });
    return queue ? averageWait(selected) : selected.length;
  };
  const current = periodValue(currentStart, today);
  const previous = periodValue(previousStart, currentStart);
  const difference = current !== null && previous !== null ? current - previous : null;
  const unit = queue ? 'min' : '';
  const format = value => value === null ? '—' : `${value.toLocaleString()}${unit ? ' ' + unit : ''}`;
  const formattedChange = difference === 0 ? 'No change' : `${difference > 0 ? '+' : '−'}${format(Math.abs(difference))}`;
  const values = [
    { label: 'Previous period', count: previous, range: rangeLabel(previousStart, currentStart) },
    { label: 'Current period', count: current, range: rangeLabel(currentStart, today) }
  ];

  return (
    <section className={`card p-3 p-md-4 mb-3 report-period-comparison${compact ? ' report-period-comparison-compact' : ''}`} aria-labelledby={titleId}>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <h2 id={titleId} className="h5 mb-1">{queue ? 'Average wait comparison' : 'Business registrations comparison'}</h2>
          <p className="small text-muted mb-0">{queue ? 'Average time from ticket creation to first call' : 'New businesses registered'} · Complete days in UTC</p>
        </div>
        <FilterToolbar>
          <label className="workspace-field">
            <span>Comparison period</span>
            <select className="form-select" value={days} onChange={event => setDays(Number(event.target.value))}>
              <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            </select>
          </label>
        </FilterToolbar>
      </div>
      {error ? (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <p className="small text-muted mb-0" role="status">Could not load the comparison.</p>
          <button type="button" className="btn btn-outline-secondary workspace-primary" onClick={() => {
            setError(false);
            setRetry(value => value + 1);
          }}>Retry</button>
        </div>
      ) : !records ? <p className="small text-muted mb-0" role="status">Loading comparison…</p> : (
        <>
          <div className="report-period-summary">
            <dl>
              {values.slice().reverse().map((item, index) => (
                <div key={item.label} className={index === 0 ? 'report-period-current' : 'report-period-previous'}>
                  <dt>{item.label} <span>{item.range}</span></dt>
                  <dd>{format(item.count)}</dd>
                </div>
              ))}
              {compact && difference !== null && (
                <div className="report-period-change">
                  <dt>Change <span>Compared with previous</span></dt>
                  <dd aria-live="polite">{formattedChange}</dd>
                </div>
              )}
            </dl>
            {!compact && difference !== null && <p className="small mb-0" role="status">
              {formattedChange} compared with the previous period
            </p>}
            {queue && difference === null && <p className="small text-muted mb-0">Average wait requires recorded call times.</p>}
          </div>
          {values.some(item => item.count !== null) && <BarTrend height={compact ? 'var(--registration-chart-height)' : 150} data={values.filter(item => item.count !== null)} unit={unit} />}
        </>
      )}
    </section>
  );
};

export default ReportPeriodComparison;
