import React, { useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import IdentityAvatar from './IdentityAvatar';

const ProfileMenu = ({ user }) => {
  const id = useId();
  const navigate = useNavigate();
  const name = user.name?.trim();
  const isSuperAdmin = user.role === 'superadmin';
  const profileLabel = name || (isSuperAdmin ? 'Super Admin Profile' : 'Admin Profile');
  const settingsPath = isSuperAdmin ? '/superadmin/settings' : '/admin/settings';

  return (
    <div className="dropdown topbar-profile">
      <button
        id={`${id}-button`}
        className="topbar-profile-button"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-controls={`${id}-options`}
        aria-label={`Profile menu for ${profileLabel}`}
      >
        <span className="topbar-profile-text">
          <strong>{profileLabel}</strong>
          <span>{user.email || (isSuperAdmin ? 'Super Admin' : 'Business Admin')}</span>
        </span>
        <IdentityAvatar name={name} identity={user._id || user.email} className="topbar-profile-avatar" />
      </button>
      <ul id={`${id}-options`} className="dropdown-menu dropdown-menu-end topbar-profile-options" aria-labelledby={`${id}-button`}>
        <li><Link className="dropdown-item" to={settingsPath}><i className="bi bi-gear" aria-hidden="true" /> Settings</Link></li>
        <li><hr className="dropdown-divider" /></li>
        <li>
          <button type="button" className="dropdown-item text-danger" onClick={() => navigate('/logout', { replace: true })}>
            <i className="bi bi-box-arrow-right" aria-hidden="true" /> Log out
          </button>
        </li>
      </ul>
    </div>
  );
};

export default ProfileMenu;
