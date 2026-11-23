import React from 'react';
import SidebarShell from './SidebarShell';

const sections = [
  {
    label: 'Overview',
    items: [
      { to: '/superadmin/dashboard', icon: 'bi-grid', text: 'Dashboard' }
    ]
  },
  {
    label: 'Management',
    items: [
      { to: '/superadmin/users', icon: 'bi-people', text: 'Users' },
      { to: '/superadmin/businesses', icon: 'bi-briefcase', text: 'Business' },
      { to: '/superadmin/kyc', icon: 'bi-shield-lock', text: 'KYC Reviews' }
    ]
  },
  {
    label: 'Content',
    items: [
      { to: '/superadmin/ringtones', icon: 'bi-music-note-list', text: 'Whistlez Ringtone' },
      { to: '/superadmin/ads', icon: 'bi-megaphone', text: 'Ads' },
      { to: '/superadmin/trending', icon: 'bi-graph-up-arrow', text: 'Trending' },
      { to: '/superadmin/live-mobile', icon: 'bi-phone', text: 'Live Trend Mobile' }
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/superadmin/reports', icon: 'bi-bar-chart-line', text: 'Reports' },
      { to: '/superadmin/settings', icon: 'bi-gear', text: 'Settings' }
    ]
  }
];

const SuperAdminSidebar = (props) => (
  <SidebarShell
    role="superadmin"
    roleLabel="Super Admin"
    home="/superadmin/dashboard"
    sections={sections}
    {...props}
  />
);

export default SuperAdminSidebar;
