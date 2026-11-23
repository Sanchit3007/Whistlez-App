import React from 'react';
import { useAuth } from '../context/AuthContext';
import ProfileMenu from './ProfileMenu';
import WorkspaceNotifications from './WorkspaceNotifications';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/** Desktop-only top bar shown above page content (mobile uses .mobile-admin-header). */
const Topbar = ({ sidebarOpen = true }) => {
  const { user } = useAuth();
  if (!user) return null;

  const today = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const profileName = user.name?.trim();
  const firstName = profileName?.split(/\s+/)[0];

  return (
    <header className={`topbar d-none d-lg-flex${sidebarOpen ? '' : ' topbar-sidebar-collapsed'}`}>
      <div className="topbar-intro">
        <div className="topbar-hello">{greeting()}, {firstName || 'there'}</div>
        <div className="topbar-date">{today}</div>
      </div>
      <div className="topbar-right">
        <WorkspaceNotifications user={user} />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
};

export default Topbar;
