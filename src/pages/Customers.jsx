import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, saveCustomers } from '../storage.js';
import TopBar from '../components/TopBar.jsx';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => { setCustomers(getCustomers()); }, []);

  const filtered = customers
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));

  const del = (id) => {
    if (!confirm('Slet denne kunde?')) return;
    const updated = customers.filter(c => c.id !== id);
    saveCustomers(updated);
    setCustomers(updated);
  };

  const Avatar = ({ name, size = 44 }) => (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: '#2563EB', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>{name.charAt(0).toUpperCase()}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <TopBar title="Kunder" action={
        <button onClick={() => navigate('/kunder/ny')} style={{ color: '#fff', fontSize: 28, lineHeight: 1, paddingLeft: 8 }}>+</button>
      } />

      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', gap: 8 }}>
          <span style={{ color: '#9CA3AF' }}>🔍</span>
          <input
            style={{ flex: 1, fontSize: 16 }}
            placeholder="Søg kunder..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} style={{ color: '#9CA3AF', fontSize: 18 }}>×</button>}
        </div>
      </div>

      <div style={{ padding: '12px 16px', paddingBottom: 20 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>{search ? 'Ingen kunder fundet' : 'Ingen kunder endnu'}</div>
            {!search && <div style={{ fontSize: 13, marginTop: 8 }}>Tryk på + for at tilføje</div>}
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', gap: 12 }}
              onClick={() => navigate(`/kunder/${c.id}`)}>
              <Avatar name={c.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                {c.phone && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{c.phone}</div>}
                {c.email && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>}
              </div>
              <button onClick={e => { e.stopPropagation(); del(c.id); }} style={{ padding: 8, color: '#EF4444', fontSize: 18, flexShrink: 0 }}>🗑</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
