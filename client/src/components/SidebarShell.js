import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo, { SidebarIcon } from './BrandLogo';
import IdentityAvatar from './IdentityAvatar';

/**
 * Shared sidebar used by both portals.
 * sections = [{ label: 'Overview', items: [{ to, icon, text }] }]
 */
const SidebarShell = ({ role, roleLabel, home, sections, showMobile, isOpen = true, onClose, onNavigate, closeButtonRef }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== role) return null;

  const handleLogout = () => {
    navigate('/logout', { replace: true });
  };

  return (
    <aside id="workspace-sidebar" className={`admin-sidebar ${showMobile ? 'show' : ''} ${!isOpen ? 'closed' : ''}`}>
      <div>
        <div className="sidebar-header">
          <NavLink className="sidebar-brand" to={home} onClick={onNavigate}>
            <BrandLogo imgHeight="34px" textClass="fs-4" />
          </NavLink>
          <button ref={closeButtonRef} type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close navigation" title="Close navigation">
            <SidebarIcon size={18} />
          </button>
        </div>

        <nav aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section">{section.label}</div>
              <ul className="sidebar-menu">
                {section.items.map((item) => (
                  <li className="sidebar-item" key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={onNavigate}
                    >
                      <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                      {item.text}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer d-lg-none">
        <div className="sidebar-user">
          <IdentityAvatar name={user.name} identity={user._id || user.email} size={38} />
          <div>
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
        </div>
        <div className="sidebar-logout">
          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <i className="bi bi-box-arrow-left"></i>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default SidebarShell;
