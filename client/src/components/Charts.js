import React, { useId } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip
} from 'recharts';
import { Skeleton } from './Skeleton';

/* Colours come from CSS variables (see enhance.css) so charts follow light/dark + your theme. */

const ChartTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0];
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label || row.name}</div>
      <div className="chart-tip-value">
        {row.value}{unit && <span> {unit}</span>}
      </div>
    </div>
  );
};

const ChartLoading = ({ height }) => (
  <div className="d-flex align-items-end gap-2 w-100" style={{ height }} aria-hidden="true">
    {[40, 65, 50, 85, 60, 95, 45].map((h, i) => (
      <Skeleton key={i} w="100%" h={`${h}%`} r={10} />
    ))}
  </div>
);

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11 },
  className: 'chart-axis'
};

/** Rounded gradient bars with tooltip. data: [{ label, count }] */
export const BarTrend = ({ data = [], height = 220, loading = false, onBarClick, dataKey = 'count', unit = '' }) => {
  const gid = useId().replace(/:/g, '');
  if (loading) return <ChartLoading height={height} />;
  return (
    <div className="chart-wrap" style={{ height }} role="img" aria-label="Bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={`bar-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--chart-1)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--chart-2)' }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.72} />
          <ReferenceLine y={0} className="chart-zero-line" />
          <XAxis dataKey="label" interval="preserveStartEnd" {...axisProps} />
          <YAxis allowDecimals={false} width={44} {...axisProps} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ className: 'chart-cursor' }} />
          <Bar
            dataKey={dataKey}
            fill={`url(#bar-${gid})`}
            radius={[8, 8, 3, 3]}
            maxBarSize={34}
            animationDuration={650}
            style={onBarClick ? { cursor: 'pointer' } : undefined}
            onClick={onBarClick ? (d) => onBarClick(d && d.payload ? d.payload : d) : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Smooth gradient area. data: [{ label, count }] */
export const AreaTrend = ({ data = [], height = 240, loading = false, dataKey = 'count', unit = '' }) => {
  const gid = useId().replace(/:/g, '');
  if (loading) return <ChartLoading height={height} />;
  return (
    <div className="chart-wrap" style={{ height }} role="img" aria-label="Trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 14, right: 12, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--chart-1)', stopOpacity: 0.38 }} />
              <stop offset="100%" style={{ stopColor: 'var(--chart-1)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 5" className="chart-grid" />
          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={18} {...axisProps} />
          <YAxis allowDecimals={false} width={44} {...axisProps} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            className="chart-line"
            strokeWidth={2.5}
            fill={`url(#area-${gid})`}
            activeDot={{ r: 5, className: 'chart-dot' }}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Donut with a centre total. data: [{ name, value, color }] */
export const StatusDonut = ({ data = [], height = 220, loading = false, centerLabel = 'Total' }) => {
  if (loading) return <div className="d-flex justify-content-center"><Skeleton w={height * 0.8} h={height * 0.8} r={999} /></div>;
  const total = data.reduce((n, d) => n + (d.value || 0), 0);
  const shown = total > 0 ? data.filter((d) => d.value > 0) : [{ name: 'No data', value: 1, color: 'var(--line)' }];
  return (
    <div className="donut-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={shown} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={shown.length > 1 ? 3 : 0}
               cornerRadius={6} stroke="none" animationDuration={700}>
            {shown.map((d, i) => <Cell key={i} style={{ fill: d.color }} />)}
          </Pie>
          {total > 0 && <Tooltip content={<ChartTooltip />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center">
        <strong>{total}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
};

export const Legend = ({ items = [] }) => (
  <ul className="chart-legend">
    {items.map((d) => (
      <li key={d.name}>
        <i style={{ background: d.color }}></i>
        <span>{d.name}</span>
        <strong>{d.value}</strong>
      </li>
    ))}
  </ul>
);
