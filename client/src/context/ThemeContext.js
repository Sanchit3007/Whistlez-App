import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ThemeProvider = ({ children }) => {
  const { pathname } = useLocation();
  const portal = /^\/superadmin(?:\/|$)/i.test(pathname) ? 'superadmin' : 'business';
  const section = /^\/admin\/(live-queue|time-slots|reports)(?:\/|$)/i.test(pathname) ? 'tokens' : 'home';

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.setAttribute('data-bs-theme', 'dark');
    root.setAttribute('data-portal', portal);
    root.setAttribute('data-theme-section', section);
    const meta = document.querySelector('meta[name="theme-color"]');
    const toolbarColor = window.getComputedStyle(root).getPropertyValue('--toolbar-color').trim();
    if (meta && toolbarColor) meta.setAttribute('content', toolbarColor);
  }, [portal, section]);

  return children;
};
