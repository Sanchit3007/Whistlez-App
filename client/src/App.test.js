import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

beforeEach(() => {
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  localStorage.setItem('whizle-theme', 'light');
});

afterEach(() => {
  localStorage.removeItem('whizle-theme');
  jest.restoreAllMocks();
});

test('opens the sign-in screen in the shared home theme', () => {
  render(<App />);

  expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-portal', 'business');
  expect(document.documentElement).toHaveAttribute('data-theme-section', 'home');
});

test('uses dark mode for Super Admin even with an old light-mode preference', () => {
  render(
    <MemoryRouter initialEntries={['/superadmin/dashboard']}>
      <ThemeProvider>
        <span>Super Admin</span>
      </ThemeProvider>
    </MemoryRouter>
  );

  expect(document.documentElement).toHaveAttribute('data-portal', 'superadmin');
  expect(document.documentElement).toHaveAttribute('data-theme-section', 'home');
  expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

test('keeps queue colors for Admin and the home theme across Super Admin tabs', () => {
  localStorage.setItem('whizle-theme', 'dark');
  render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <ThemeProvider>
        <Link to="/admin/live-queue">Live Queue</Link>
        <Link to="/superadmin/trending">Trending</Link>
        <Link to="/superadmin/live-mobile">Live Trend Mobile</Link>
      </ThemeProvider>
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole('link', { name: 'Live Queue' }));
  expect(document.documentElement).toHaveAttribute('data-theme-section', 'tokens');

  fireEvent.click(screen.getByRole('link', { name: 'Trending' }));
  expect(document.documentElement).toHaveAttribute('data-theme-section', 'home');
  fireEvent.click(screen.getByRole('link', { name: 'Live Trend Mobile' }));
  expect(document.documentElement).toHaveAttribute('data-theme-section', 'home');
  expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
});
