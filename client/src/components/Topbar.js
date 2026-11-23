import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import IdentityAvatar from './IdentityAvatar';
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
  const navigate = useNavigate();
  if (!user) return null;

  const today = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const profileName = user.name?.trim();
  const firstName = profileName?.split(/\s+/)[0];
  const isSuperAdmin = user.role === 'superadmin';
  const settingsPath = isSuperAdmin ? '/superadmin/settings' : '/admin/settings';
  const profileLabel = profileName || (isSuperAdmin ? 'Super Admin Profile' : 'Admin Profile');

  const handleLogout = () => {
    navigate('/logout', { replace: true });
  };

  return (
    <header className={`topbar d-none d-lg-flex${sidebarOpen ? '' : ' topbar-sidebar-collapsed'}`}>
      <div className="topbar-intro">
        <div className="topbar-hello">{greeting()}, {firstName || 'there'}</div>
        <div className="topbar-date">{today}</div>
      </div>
      <div className="topbar-right">
        <WorkspaceNotifications user={user} />
        <div className="dropdown topbar-profile">
          <button
            id="topbar-profile-button"
            className="topbar-profile-button"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            aria-controls="topbar-profile-options"
            aria-label={`Profile menu for ${profileLabel}`}
          >
            <span className="topbar-profile-text">
              <strong>{profileLabel}</strong>
              <span>{user.email || (isSuperAdmin ? 'Super Admin' : 'Business Admin')}</span>
            </span>
            <IdentityAvatar name={profileName} identity={user._id || user.email} className="topbar-profile-avatar" />
          </button>
          <ul id="topbar-profile-options" className="dropdown-menu dropdown-menu-end topbar-profile-options" aria-labelledby="topbar-profile-button">
            <li><Link className="dropdown-item" to={settingsPath}><i className="bi bi-gear" aria-hidden="true"></i> Settings</Link></li>
            <li><hr className="dropdown-divider" /></li>
            <li><button type="button" className="dropdown-item text-danger" onClick={handleLogout}><i className="bi bi-box-arrow-right" aria-hidden="true"></i> Log out</button></li>
          </ul>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
