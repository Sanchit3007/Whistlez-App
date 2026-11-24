import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '../../context/AuthContext';
import SuperAdminDashboard from './SuperAdminDashboard';
import SuperAdminUsers from './SuperAdminUsers';

jest.mock('../../context/AuthContext', () => ({ api: { get: jest.fn() } }));
jest.mock('../../socket', () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn() }));
jest.mock('../../components/Charts', () => ({ BarTrend: () => null }));

test('links to each management page and opens Manage Admins with the Business Admin filter selected', async () => {
  const users = [
    { _id: 'one', name: 'Sam Lee', role: 'admin' },
    { _id: 'two', name: 'Chris Patel', role: 'superadmin' }
  ];
  api.get.mockResolvedValue({ data: { success: true, metrics: {}, businesses: [], users } });

  render(
    <MemoryRouter initialEntries={['/superadmin/dashboard']}>
      <Routes>
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/superadmin/users" element={<SuperAdminUsers />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole('link', { name: 'Manage Businesses' })).toHaveAttribute('href', '/superadmin/businesses');
  expect(screen.getByRole('link', { name: 'Manage Ads' })).toHaveAttribute('href', '/superadmin/ads');
  fireEvent.click(screen.getByRole('link', { name: 'Manage Admins' }));

  const roleFilter = screen.getByRole('combobox', { name: 'Role' });
  expect(roleFilter).toHaveValue('admin');
  expect(await screen.findByText('Sam Lee')).toBeInTheDocument();
  expect(screen.queryByText('Chris Patel')).not.toBeInTheDocument();
  fireEvent.change(roleFilter, { target: { value: 'all' } });
  expect(screen.getByText('Chris Patel')).toBeInTheDocument();
});
