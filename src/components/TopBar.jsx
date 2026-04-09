import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ title, backTo, action }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#2563EB',
      color: '#fff',
      padding: '14px 16px',
      paddingTop: 'calc(14px + env(safe-area-inset-top))',
      gap: 12,
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {backTo && (
        <button onClick={() => navigate(backTo)} style={{ color: '#fff', padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      )}
      <span style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{title}</span>
      {action}
    </div>
  );
}
