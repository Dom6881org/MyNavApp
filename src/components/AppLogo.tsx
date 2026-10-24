import React from 'react';

const AppLogo: React.FC = () => (
  <svg className="app-logo" viewBox="0 0 48 48" role="img" aria-label="MyNavApp" focusable="false">
    <title>MyNavApp</title>
    <defs>
      <linearGradient id="app-logo-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1f9caa" />
        <stop offset="1" stopColor="#1b4f8f" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#app-logo-bg)" />
    <circle cx="24" cy="24" r="16.5" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />
    <path d="M24 5 28.2 24 24 43 19.8 24Z" fill="#fff" fillOpacity=".92" />
    <path d="M5 24 24 19.8 43 24 24 28.2Z" fill="#fff" fillOpacity=".5" />
    <path d="M24 5 28.2 24H19.8Z" fill="#ffb454" />
    <circle cx="24" cy="24" r="2.6" fill="#1b4f8f" stroke="#fff" strokeWidth="1.5" />
  </svg>
);

export default AppLogo;
