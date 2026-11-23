import { useEffect, useState } from 'react';

const prefix = 'whistlez:session-report-filters:';

export const clearReportFilterSession = () => {
  try {
    const storage = window.sessionStorage;
    for (const key of Object.keys(storage)) {
      if (key.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {
    // The report still works when session storage is blocked.
  }
};

export const useReportFilters = (report, defaults) => {
  const key = prefix + report;
  const [filters, setFilters] = useState(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(key));
      return Object.fromEntries(Object.entries(defaults).map(([field, value]) => [
        field, typeof stored?.[field] === typeof value ? stored[field] : value
      ]));
    } catch {
      return defaults;
    }
  });
  const hasFilters = Object.keys(defaults).some(field => filters[field] !== defaults[field]);

  useEffect(() => {
    try {
      if (hasFilters) window.sessionStorage.setItem(key, JSON.stringify(filters));
      else window.sessionStorage.removeItem(key);
    } catch {
      // Keep the active filters in memory when session storage is blocked.
    }
  }, [filters, hasFilters, key]);

  return { filters, setFilters, hasFilters, clearFilters: () => setFilters(defaults) };
};
