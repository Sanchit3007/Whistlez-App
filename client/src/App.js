import React, { useState, useEffect, useRef } from 'react';
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import AdminSidebar from './components/AdminSidebar';
import SuperAdminSidebar from './components/SuperAdminSidebar';
import BrandLogo, { SidebarIcon } from './components/BrandLogo';
import IdentityAvatar from './components/IdentityAvatar';
import Topbar from './components/Topbar';
import WorkspaceNotifications from './components/WorkspaceNotifications';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ToastProvider';

// Public Pages
import Login from './pages/Login';
import SignupWizard from './pages/SignupWizard';

// Admin Pages (Reorganized folder)
import AdminDashboard from './pages/admin/AdminDashboard';
import LiveQueue from './pages/admin/LiveQueue';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminKyc from './pages/admin/AdminKyc';
import AdminTimeSlots from './pages/admin/AdminTimeSlots';

// Super Admin Pages (Reorganized folder)
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminUsers from './pages/superadmin/SuperAdminUsers';
import SuperAdminBusinesses from './pages/superadmin/SuperAdminBusinesses';
import SuperAdminBusinessDetail from './pages/superadmin/SuperAdminBusinessDetail';
import SuperAdminKyc from './pages/superadmin/SuperAdminKyc';
import SuperAdminRingtones from './pages/superadmin/SuperAdminRingtones';
import SuperAdminAds from './pages/superadmin/SuperAdminAds';
import SuperAdminReports from './pages/superadmin/SuperAdminReports';
import SuperAdminSettings from './pages/superadmin/SuperAdminSettings';
import SuperAdminTrending from './pages/superadmin/SuperAdminTrending';
import SuperAdminLiveMobile from './pages/superadmin/SuperAdminLiveMobile';

// Protector for authenticated routes with role verification (RBAC)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard'} replace />;
  }

  if (user.role === 'admin' || user.role === 'superadmin') {
    return <AuthenticatedWorkspace user={user}>{children}</AuthenticatedWorkspace>;
  }

  return children;
};

const AuthenticatedWorkspace = ({ user, children }) => {
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mobileMenu = useRef(null);
  const desktopMenu = useRef(null);
  const sidebarClose = useRef(null);
  const isSuperAdmin = user.role === 'superadmin';
  const Sidebar = isSuperAdmin ? SuperAdminSidebar : AdminSidebar;

  const closeMobile = () => {
    setMobileSidebar(false);
    mobileMenu.current?.focus();
  };

  useEffect(() => {
    if (!mobileSidebar) return undefined;
    const focusFrame = requestAnimationFrame(() => sidebarClose.current?.focus({ preventScroll: true }));
    const desktop = window.matchMedia('(min-width: 992px)');
    const handleResize = (event) => {
      if (event.matches) setMobileSidebar(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileSidebar(false);
        mobileMenu.current?.focus();
      }
    };
    desktop.addEventListener('change', handleResize);
    document.addEventListener('keydown', handleEscape);
    return () => {
      cancelAnimationFrame(focusFrame);
      desktop.removeEventListener('change', handleResize);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileSidebar]);

  const toggleDesktop = (open) => {
    setSidebarOpen(open);
    requestAnimationFrame(() => (open ? sidebarClose : desktopMenu).current?.focus());
  };

  return (
    <div className="min-vh-100 app-shell">
      <header className="mobile-admin-header">
        <div className="d-flex align-items-center gap-2">
          <button
            ref={mobileMenu}
            type="button"
            className="btn btn-light border workspace-menu"
            aria-label={mobileSidebar ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileSidebar}
            aria-controls="workspace-sidebar"
            onClick={() => mobileSidebar ? closeMobile() : setMobileSidebar(true)}
          >
            <i className="bi bi-list fs-4" aria-hidden="true"></i>
          </button>
          <BrandLogo imgHeight="28px" textClass="fs-5" />
        </div>
        <div className="d-flex align-items-center gap-2">
          <WorkspaceNotifications user={user} />
          <IdentityAvatar name={user.name} identity={user._id || user.email} size={38} label={user.name || user.email || 'Signed-in profile'} />
        </div>
      </header>

      {mobileSidebar && <div className="details-drawer-overlay show workspace-nav-overlay" aria-hidden="true" onClick={closeMobile} />}

      <Sidebar
        showMobile={mobileSidebar}
        isOpen={sidebarOpen}
        closeButtonRef={sidebarClose}
        onNavigate={() => { if (mobileSidebar) closeMobile(); }}
        onClose={() => mobileSidebar ? closeMobile() : toggleDesktop(false)}
      />

      {!sidebarOpen && (
        <button
          ref={desktopMenu}
          type="button"
          className="btn btn-light bg-white border rounded-3 position-fixed d-none d-lg-flex workspace-desktop-menu"
          onClick={() => toggleDesktop(true)}
          title="Open navigation"
          aria-label="Open navigation"
          aria-controls="workspace-sidebar"
        >
          <SidebarIcon size={20} className="text-dark" />
        </button>
      )}

      <main className={`admin-content-layout${sidebarOpen ? ' workspace-sidebar-open' : ''}`} inert={mobileSidebar}>
        <Topbar sidebarOpen={sidebarOpen} />
        <div className="p-3 p-md-4 pt-lg-3">
          {children}
        </div>
      </main>
    </div>
  );
};

// Redirects logged-in users away from auth pages
const PublicRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    return <Navigate to={user.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard'} replace />;
  }

  return children;
};

// Root index redirect route helper
const RootRedirect = () => {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) return null;
  
  if (isAuthenticated) {
    return <Navigate to={user.role === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard'} replace />;
  }
  
  return <Navigate to="/login" replace />;
};

// Scroll restorer component on route change transitions
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const AppTheme = () => (
  <ThemeProvider>
    <ScrollToTop />
    <Outlet />
  </ThemeProvider>
);

const LogoutRoute = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);
  return null;
};

const router = createBrowserRouter(createRoutesFromElements(
    <Route element={<AppTheme />}>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignupWizard />
              </PublicRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/live-queue"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <LiveQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/time-slots"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminTimeSlots />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/kyc"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminKyc />
              </ProtectedRoute>
            }
          />

          {/* Super Admin Protected Routes */}
          <Route
            path="/superadmin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/kyc"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminKyc />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/users"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/businesses"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminBusinesses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/businesses/:id"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminBusinessDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/ringtones"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminRingtones />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/ads"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminAds />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/reports"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/settings"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/trending"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminTrending />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin/live-mobile"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminLiveMobile />
              </ProtectedRoute>
            }
          />

          {/* Root Redirect handler */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/logout" element={<LogoutRoute />} />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
));

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
