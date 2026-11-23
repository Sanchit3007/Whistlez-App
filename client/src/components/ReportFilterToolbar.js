import React, { useId, useState } from 'react';

const ReportFilterToolbar = ({ searchLabel, searchPlaceholder, search, onSearch, hasFilters, onClear, children }) => {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className="report-filter-toolbar">
      <div className="report-filter-search-row">
        <label className="workspace-field">
          <span>{searchLabel}</span>
          <input type="search" className="form-control" placeholder={searchPlaceholder} value={search} onChange={event => onSearch(event.target.value)} />
        </label>
        <button type="button" className="btn btn-outline-primary report-filter-toggle" aria-expanded={expanded} aria-controls={panelId}
          onClick={() => setExpanded(current => !current)}>
          <i className="bi bi-funnel" aria-hidden="true" /> Filters
        </button>
      </div>
      <div id={panelId} className="report-filter-options" data-open={expanded}>
        <div className="workspace-filters report-filter-fields">{children}</div>
        <button type="button" className="btn btn-outline-secondary workspace-primary" onClick={onClear} disabled={!hasFilters}>Clear filters</button>
      </div>
    </div>
  );
};

export default ReportFilterToolbar;
