import React from 'react';
import SidebarShell from './SidebarShell';

const sections = [
  {
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', icon: 'bi-grid', text: 'Dashboard' },
      { to: '/admin/live-queue', icon: 'bi-people', text: 'Live Queue' },
      { to: '/admin/time-slots', icon: 'bi-calendar-check', text: 'Time Slots' }
    ]
  },
  {
    label: 'Business',
    items: [
      { to: '/admin/reports', icon: 'bi-bar-chart-line', text: 'Reports' },
      { to: '/admin/settings', icon: 'bi-gear', text: 'Settings' },
      { to: '/admin/kyc', icon: 'bi-shield-check', text: 'KYC & Verification' }
    ]
  }
];

const AdminSidebar = (props) => (
  <SidebarShell
    role="admin"
    roleLabel="Business Admin"
    home="/admin/dashboard"
    sections={sections}
    {...props}
  />
);

export default AdminSidebar;
