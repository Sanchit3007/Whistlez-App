import React, { useState } from 'react';

const eyeOpen = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const eyeClosed = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

const PasswordField = ({ id, label = 'password', className = '', showLock = false, ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`auth-field ${className}`}>
      {showLock && <i className="bi bi-lock" aria-hidden="true" />}
      <input {...inputProps} id={id} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="auth-eye"
        onClick={() => setVisible(current => !current)}
        aria-controls={id}
        aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
      >
        {visible ? eyeClosed : eyeOpen}
      </button>
    </div>
  );
};

export default PasswordField;
