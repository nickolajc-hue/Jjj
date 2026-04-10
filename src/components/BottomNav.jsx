import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  {
    to: '/min-dag', label: 'Min dag',
    icon: (a) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill={a ? '#2563EB' : '#9CA3AF'}>
        <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79zM4 10.5H1v2h3zm9-9.95h-2V3.5h2zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79zM20 10.5v2h3v-2zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41z"/>
      </svg>
    ),
  },
  {
    to: '/overblik', label: 'Overblik',
    icon: (a) => (
      <svg width="23" height="23" fill={a ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    to: '/kunder', label: 'Kunder',
    icon: (a) => (
      <svg width="23" height="23" fill={a ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    to: '/aftaler', label: 'Aftaler',
    icon: (a) => (
      <svg width="23" height="23" fill={a ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
        <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
      </svg>
    ),
  },
  {
    to: '/tilbud', label: 'Tilbud',
    icon: (a) => (
      <svg width="23" height="23" fill={a ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
        <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  return (
    <nav style={{
      display: 'flex',
      borderTop: '1px solid #F3F4F6',
      backgroundColor: '#fff',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} style={{ flex: 1, textDecoration: 'none' }}>
          {({ isActive }) => (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 2 }}>
              {icon(isActive)}
              <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#2563EB' : '#9CA3AF' }}>{label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
