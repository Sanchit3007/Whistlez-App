import React from 'react';

/** Shimmering placeholder. <Skeleton w="60%" h={14} /> */
export const Skeleton = ({ w = '100%', h = 14, r = 8, className = '', style = {} }) => (
  <span
    className={`skel ${className}`}
    style={{ width: w, height: h, borderRadius: r, ...style }}
    aria-hidden="true"
  />
);

/** Placeholder shaped like a queue card. */
export const SkeletonTokenCard = () => (
  <div className="kanban-card skel-card" aria-hidden="true">
    <Skeleton w={70} h={22} className="mb-2" />
    <Skeleton w="62%" h={13} className="mb-2" />
    <Skeleton w="40%" h={11} className="mb-3" />
    <Skeleton w="100%" h={8} r={99} />
  </div>
);

/** Placeholder for a KPI card. */
export const SkeletonStat = () => (
  <div className="kpi" aria-hidden="true">
    <div className="kpi-main">
      <Skeleton w={90} h={11} className="mb-2" />
      <Skeleton w={70} h={28} r={10} />
    </div>
    <Skeleton w={46} h={46} r={14} />
  </div>
);

export default Skeleton;
