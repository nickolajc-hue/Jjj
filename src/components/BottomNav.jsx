import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/overblik', label: 'Overblik', icon: (active) => (
    <svg width="24" height="24" fill={active ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  )},
  { to: '/kunder', label: 'Kunder', icon: (active) => (
    <svg width="24" height="24" fill={active ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  )},
  { to: '/aftaler', label: 'Aftaler', icon: (active) => (
    <svg width="24" height="24" fill={active ? '#2563EB' : '#9CA3AF'} viewBox="0 0 24 24">
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
    </svg>
  )},
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
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '10px 0',
              gap: 3,
            }}>
              {icon(isActive)}
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: isActive ? '#2563EB' : '#9CA3AF',
              }}>{label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
