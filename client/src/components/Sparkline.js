import React, { useId } from 'react';

/**
 * Tiny SVG trend line. Colour comes from CSS (currentColor), so it follows the theme.
 * data: array of numbers (real data only; renders nothing for fewer than 2 points).
 */
const Sparkline = ({ data = [], width = 104, height = 36, className = '' }) => {
  const gid = useId().replace(/:/g, '');
  if (!Array.isArray(data) || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [
    pad + i * step,
    max === min ? height - pad - 1 : height - pad - ((v - min) / range) * (height - pad * 2)
  ]);

  // smooth curve (Catmull-Rom to Bezier)
  const path = pts.reduce((d, p, i, a) => {
    if (i === 0) return `M${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const p0 = a[i - 2] || a[i - 1];
    const p1 = a[i - 1];
    const p2 = p;
    const p3 = a[i + 1] || p;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    return `${d} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }, '');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg className={`spark ${className}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend">
      <defs>
        <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${gid})`} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" />
    </svg>
  );
};

export default Sparkline;
