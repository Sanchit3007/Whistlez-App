import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import BrandLogo from '../components/BrandLogo';
import PasswordField from '../components/PasswordField';
import { useToast } from '../components/ToastProvider';

const previewWaits = [3, 6, 9];

const QueuePreview = () => {
  const [serving, setServing] = useState(104);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let timer;

    const updateTimer = () => {
      clearInterval(timer);
      if (!reducedMotion?.matches) {
        timer = setInterval(() => setServing(token => token + 1), 2600);
      }
    };

    updateTimer();
    reducedMotion?.addEventListener('change', updateTimer);
    return () => {
      clearInterval(timer);
      reducedMotion?.removeEventListener('change', updateTimer);
    };
  }, []);

  return (
    <section className="qp" aria-label="Live queue demo">
      <div className="qp-head">
        <span className="qp-preview-label">Live queue preview</span>
        <span className="qp-counter">Counter 1</span>
      </div>
      <div className="qp-serving">
        <span className="qp-serving-label"><i className="bi bi-circle-fill" aria-hidden="true"></i> Now serving</span>
        <strong className="qp-token" key={serving}>A-{serving}</strong>
      </div>
      <ol className="qp-list" aria-label="Upcoming demo tickets">
        {previewWaits.map((wait, index) => {
          const token = serving + index + 1;
          return (
            <li key={token} style={{ '--qp-position': index, '--qp-entry-delay': serving === 104 ? `${index * 150}ms` : '0ms' }}>
              <div className="qp-ticket">
                <strong className="qp-pill">A-{token}</strong>
                <span>{index === 0 ? 'Next up' : 'Waiting'}</span>
                <span className="qp-wait">~{wait} min</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    const activeField = document.activeElement;
    if (e.currentTarget.contains(activeField) && activeField.matches('input')) activeField.blur();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      if (result.user.role === 'superadmin') {
        navigate('/superadmin/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      setError(result.message || 'Login failed. Please check credentials.');
    }
  };

  return (
    <div className="auth-page animated-fade-in">
      {/* Form panel */}
      <main className="auth-panel">
        <div className="auth-card">
          <div className="d-lg-none auth-mobile-brand">
            <BrandLogo imgHeight="32px" textClass="fs-4" />
          </div>

          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-sub">Sign in to manage queues and campaigns</p>

          {error && (
            <div className="alert alert-danger border-0 rounded-3 small mb-4 d-flex align-items-center py-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-5 text-danger"></i>
              <div className="fw-semibold text-dark">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label className="form-label" htmlFor="loginEmail">Email Address</label>
            <div className="auth-field mb-3">
              <i className="bi bi-envelope"></i>
              <input
                id="loginEmail"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label className="form-label" htmlFor="loginPassword">Password</label>
            <PasswordField
              id="loginPassword"
              className="mb-3"
              showLock
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="d-flex justify-content-between align-items-center mb-4 small">
              <div className="form-check d-flex align-items-center gap-2 m-0">
                <input
                  type="checkbox"
                  className="form-check-input m-0"
                  id="rememberCheck"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label className="form-check-label text-muted" htmlFor="rememberCheck" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="btn btn-link text-primary text-decoration-none p-0 small fw-bold"
                style={{ minHeight: 0 }}
                onClick={() => toast.info('Please contact support@whistlez.com for credential recovery.', { title: 'Forgot password' })}
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" className="btn btn-primary w-100 fw-bold auth-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <p className="text-center text-muted small mt-4 mb-0">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary fw-bold text-decoration-none">Sign up</Link>
          </p>
        </div>
      </main>

      <aside className="auth-hero">
        <div className="auth-hero-glow auth-hero-glow-a d-none d-lg-block"></div>
        <div className="auth-hero-glow auth-hero-glow-b d-none d-lg-block"></div>
        <div className="auth-hero-inner">
          <div className="d-none d-lg-block">
            <div className="auth-hero-brand d-flex align-items-center gap-2">
              <span className="auth-hero-logo"><img src={logo} alt="whistlez" /></span>
              <span className="fs-3 fw-bold text-white" style={{ letterSpacing: '-0.02em' }}>whistlez</span>
            </div>
            <h1 className="auth-hero-title">Run every queue.<br />Reach every screen.</h1>
            <p className="auth-hero-text">One platform for live token queues, campaigns and trending content, built to feel instant on any device.</p>
          </div>
          <QueuePreview />
        </div>
      </aside>
    </div>
  );
};

export default Login;
