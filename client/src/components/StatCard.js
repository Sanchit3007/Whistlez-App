import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Sparkline from './Sparkline';
import { SkeletonStat } from './Skeleton';

export const useCountUp = (target, duration = 700) => {
  const [val, setVal] = useState(typeof target === 'number' ? 0 : target);
  const prev = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) return undefined;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); prev.current = target; return undefined; }
    const from = prev.current;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step); else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return typeof target === 'number' ? val : target;
};

const Arrow = ({ up }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
  </svg>
);

/**
 * KPI card.
 *  value   number | string      (numbers count up)
 *  trend   { pct: number, label?: string, invert?: bool }   invert = lower is better (e.g. wait time)
 *  spark   number[]             real series only
 *  action  { to: string, label: string }
 */
const StatCard = ({ label, value, suffix, icon, tone = 'blue', loading = false, spark, trend, title, action }) => {
  const shown = useCountUp(typeof value === 'number' ? value : NaN);
  if (loading) return <SkeletonStat />;

  const isNum = typeof value === 'number';
  let chip = null;
  if (trend && typeof trend.pct === 'number' && Number.isFinite(trend.pct)) {
    const up = trend.pct > 0;
    const flat = trend.pct === 0;
    const good = flat ? null : trend.invert ? !up : up;
    chip = (
      <span className={`kpi-trend ${flat ? 'is-flat' : good ? 'is-good' : 'is-bad'}`}>
        {!flat && <Arrow up={up} />}
        {Math.abs(trend.pct)}%<span className="kpi-trend-label"> {trend.label || 'vs yesterday'}</span>
      </span>
    );
  }

  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-main">
        <span className="kpi-label">{label}</span>
        <div className="kpi-value" title={title || (isNum ? undefined : String(value))}>
          <span className={isNum ? '' : 'text-truncate d-block'}>{isNum ? shown : value}</span>
          {suffix && <span className="kpi-suffix">{suffix}</span>}
        </div>
        {chip}
        {action && (
          <Link className="kpi-action" to={action.to}>
            <span>{action.label}</span>
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </Link>
        )}
      </div>
      <div className="kpi-side">
        {icon && <span className="kpi-icon" aria-hidden="true"><i className={`bi ${icon}`}></i></span>}
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>
    </div>
  );
};

export default StatCard;
