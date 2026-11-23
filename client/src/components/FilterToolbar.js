import React, { useId, useState } from 'react';

const FilterToolbar = ({ searchField, columns = 1, className = '', footer, summary, children }) => {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className={`filter-toolbar${searchField ? ' filter-toolbar-with-search' : ''} ${className}`} style={{ '--filter-columns': columns, '--filter-width': `${columns}fr` }}>
      <div className="filter-search-row">
        {searchField}
        <button type="button" className="btn btn-outline-primary filter-toggle" aria-expanded={expanded} aria-controls={panelId}
          onClick={() => setExpanded(current => !current)}>
          <i className="bi bi-funnel" aria-hidden="true" /> Filters{summary && <span className="filter-summary">{summary}</span>}
        </button>
      </div>
      <div id={panelId} className="filter-options" data-open={expanded}>
        <div className="filter-fields">{children}</div>
        {footer}
      </div>
    </div>
  );
};

export default FilterToolbar;
