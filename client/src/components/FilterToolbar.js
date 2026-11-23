import React, { useId } from 'react';

const FilterToolbar = ({ searchField, columns = 1, className = '', footer, children }) => {
  const panelId = useId();

  return (
    <div className={`dropdown filter-toolbar${searchField ? ' filter-toolbar-with-search' : ''} ${className}`} style={{ '--filter-columns': columns, '--filter-width': `${columns}fr` }}>
      {searchField}
      <button type="button" className="btn btn-outline-primary filter-toggle" aria-expanded="false" aria-controls={panelId}
        data-bs-toggle="dropdown" data-bs-auto-close="outside" data-bs-offset="0,8">
        <i className="bi bi-funnel" aria-hidden="true" /> Filters
      </button>
      <div id={panelId} className="dropdown-menu dropdown-menu-end filter-options">
        <div className="filter-card-heading d-lg-none" aria-hidden="true">Filters</div>
        <div className="filter-fields">{children}</div>
        {footer}
      </div>
    </div>
  );
};

export default FilterToolbar;
