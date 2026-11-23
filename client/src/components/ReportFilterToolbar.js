import React from 'react';
import FilterToolbar from './FilterToolbar';

const ReportFilterToolbar = ({ searchLabel, searchPlaceholder, search, onSearch, hasFilters, onClear, children }) => {
  return (
    <FilterToolbar className="report-filter-toolbar" columns={3}
      searchField={
        <label className="workspace-field">
          <span>{searchLabel}</span>
          <input type="search" className="form-control" placeholder={searchPlaceholder} value={search} onChange={event => onSearch(event.target.value)} />
        </label>
      }
      footer={
        <button type="button" className="btn btn-outline-secondary workspace-primary" onClick={onClear} disabled={!hasFilters}>Clear filters</button>
      }>
      {children}
    </FilterToolbar>
  );
};

export default ReportFilterToolbar;
