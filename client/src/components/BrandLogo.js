import React from 'react';
import logo from '../assets/logo.png';

export const BrandText = ({ className = 'fs-4' }) => (
  <span className={`brand-text ${className}`} aria-label="whistlez">
    wh<span className="brand-i-wrap"><span className="brand-i-dot"></span>&#305;</span>stlez
  </span>
);

export const BrandLogo = ({ imgHeight = '36px', textClass = 'fs-4', showImage = true }) => (
  <div className="d-flex align-items-center">
    {showImage && (
      <img 
        src={logo} 
        alt="whistlez" 
        className="me-2 rounded-2" 
        style={{ height: imgHeight, width: 'auto', objectFit: 'contain' }} 
      />
    )}
    <BrandText className={textClass} />
  </div>
);

export const SidebarIcon = () => (
  <svg 
    width="20"
    height="20"
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

export default BrandLogo;
