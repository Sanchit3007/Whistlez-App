import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({
  success: () => {}, error: () => {}, info: () => {}, warning: () => {}, dismiss: () => {}
});

const ICONS = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M8 12.5l2.7 2.7L16.2 9.5" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4M12 17h.01" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 11v5.5M12 7.5h.01" />
    </svg>
  )
};

const Toast = ({ toast, onClose }) => {
  const timer = useRef(null);
  const start = useCallback(() => {
    if (toast.duration > 0) timer.current = setTimeout(() => onClose(toast.id), toast.duration);
  }, [toast.duration, toast.id, onClose]);
  const stop = () => clearTimeout(timer.current);

  useEffect(() => { start(); return stop; }, [start]);

  return (
    <div
      className={`wz-toast wz-toast-${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={stop}
      onMouseLeave={start}
      style={{ '--toast-ms': `${toast.duration}ms` }}
    >
      <span className="wz-toast-icon">{ICONS[toast.type]}</span>
      <div className="wz-toast-body">
        {toast.title && <div className="wz-toast-title">{toast.title}</div>}
        <div className="wz-toast-msg">{toast.message}</div>
      </div>
      <button type="button" className="wz-toast-close" onClick={() => onClose(toast.id)} aria-label="Dismiss notification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {toast.duration > 0 && <span className="wz-toast-bar" />}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message, opts = {}) => {
    if (!message) return null;
    const id = ++idRef.current;
    const duration = opts.duration ?? (type === 'error' ? 6000 : 4000);
    setToasts((list) => [...list.slice(-3), { id, type, message, title: opts.title, duration }]);
    return id;
  }, []);

  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
    warning: (m, o) => push('warning', m, o),
    dismiss
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="wz-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => <Toast key={t.id} toast={t} onClose={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
