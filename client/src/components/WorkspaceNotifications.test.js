import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../context/AuthContext';
import WorkspaceNotifications from './WorkspaceNotifications';

jest.mock('../context/AuthContext', () => ({
  api: { get: jest.fn(), patch: jest.fn() }
}));
jest.mock('../socket', () => ({ on: jest.fn(), off: jest.fn() }));

const earlier = { id: 'kyc:business:earlier', businessId: 'business', status: 'Submitted' };
const latest = { id: 'kyc:business:latest', businessId: 'business', status: 'Approved' };

const openNotifications = (role, accountId) => {
  const view = render(
    <MemoryRouter>
      <WorkspaceNotifications user={{ _id: accountId, role }} />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
  return view;
};

const mockApi = () => {
  let ids = [];
  let notifications = [earlier];
  api.get.mockImplementation(async () => ({
    data: { success: true, notifications, ads: [], tokens: [], ids }
  }));
  api.patch.mockImplementation(async (url, body) => {
    ids = [...new Set([...ids, ...body.ids])];
    return { data: { success: true } };
  });
  return updates => { notifications = updates; };
};

beforeEach(() => {
  window.localStorage.clear();
  jest.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}]);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

test.each(['admin', 'superadmin'])('keeps read notifications after signing back in as %s', async role => {
  const updateNotifications = mockApi();
  const firstVisit = openNotifications(role, 'account');
  fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
  expect(api.patch).toHaveBeenCalledWith(
    `/${role}/notifications/read`,
    { ids: [earlier.id] },
    expect.any(Object)
  );
  firstVisit.unmount();
  window.localStorage.clear();
  updateNotifications([earlier, latest]);

  openNotifications(role, 'account');
  const earlierLink = await screen.findByRole('link', { name: 'KYC submitted' });
  expect(earlierLink.closest('li')).toHaveAttribute('data-unread', 'false');
  expect(screen.getByRole('link', { name: 'KYC approved' }).closest('li')).toHaveAttribute('data-unread', 'true');
});

test('carries the current account’s browser read history into its saved read history', async () => {
  mockApi();
  localStorage.setItem('whistlez:notifications:account', JSON.stringify([earlier.id]));
  localStorage.setItem('whistlez:notifications:another-account', JSON.stringify([latest.id]));

  openNotifications('admin', 'account');
  const link = await screen.findByRole('link', { name: 'KYC submitted' });
  expect(link.closest('li')).toHaveAttribute('data-unread', 'false');
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
  expect(api.patch).toHaveBeenCalledWith('/admin/notifications/read', { ids: [earlier.id] }, expect.any(Object));
});
