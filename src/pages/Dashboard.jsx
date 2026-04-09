import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, getAppointments } from '../storage.js';

const s = {
  header: { background: '#2563EB', color: '#fff', padding: '24px 20px 48px', paddingTop: 'calc(24px + env(safe-area-inset-top))' },
  greeting: { fontSize: 26, fontWeight: 800 },
  sub: { fontSize: 14, opacity: 0.75, marginTop: 4 },
  statsRow: { display: 'flex', gap: 10, margin: '-24px 16px 0', position: 'relative', zIndex: 1 },
  stat: { flex: 1, borderRadius: 14, padding: '14px 10px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer' },
  statNum: { fontSize: 28, fontWeight: 800, display: 'block', marginTop: 6 },
  statLabel: { fontSize: 11, fontWeight: 600, color: '#6B7280', marginTop: 2, display: 'block' },
  section: { background: '#fff', margin: '16px 16px 0', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  apptCard: { display: 'flex', alignItems: 'center', padding: '10px 0 10px 10', borderBottom: '1px solid #F3F4F6', borderLeft: '3px solid #2563EB', borderRadius: 4, marginBottom: 4 },
  apptTime: { fontSize: 11, color: '#6B7280', fontWeight: 600, width: 56, flexShrink: 0 },
  apptTitle: { fontSize: 14, fontWeight: 600 },
  apptCustomer: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  actionsRow: { display: 'flex', gap: 12 },
  actionBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '18px 0', cursor: 'pointer', gap: 6 },
  actionLabel: { fontSize: 13, fontWeight: 600, color: '#374151' },
  pb: { paddingBottom: 20 },
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}
function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ customers: 0, upcoming: 0, today: 0 });
  const [todayAppts, setTodayAppts] = useState([]);
  const [nextAppts, setNextAppts] = useState([]);

  useEffect(() => {
    const customers = getCustomers();
    const appointments = getAppointments();
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const enriched = appointments.map(a => ({ ...a, customerName: customerMap[a.customerId] || 'Ukendt' }));
    const today = enriched.filter(a => { const d = new Date(a.date); return d >= todayStart && d < todayEnd; }).sort((a, b) => new Date(a.date) - new Date(b.date));
    const upcoming = enriched.filter(a => new Date(a.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));

    setCounts({ customers: customers.length, upcoming: upcoming.length, today: today.length });
    setTodayAppts(today);
    setNextAppts(upcoming.slice(0, 5));
  }, []);

  return (
    <div style={s.pb}>
      <div style={s.header}>
        <div style={s.greeting}>God dag! 👋</div>
        <div style={s.sub}>Her er dit overblik</div>
      </div>

      <div style={s.statsRow}>
        <div style={{ ...s.stat, background: '#EFF6FF' }} onClick={() => navigate('/kunder')}>
          <span style={{ fontSize: 24 }}>👥</span>
          <span style={{ ...s.statNum, color: '#2563EB' }}>{counts.customers}</span>
          <span style={s.statLabel}>Kunder</span>
        </div>
        <div style={{ ...s.stat, background: '#F0FDF4' }} onClick={() => navigate('/aftaler')}>
          <span style={{ fontSize: 24 }}>📅</span>
          <span style={{ ...s.statNum, color: '#10B981' }}>{counts.upcoming}</span>
          <span style={s.statLabel}>Kommende</span>
        </div>
        <div style={{ ...s.stat, background: '#FFF7ED' }} onClick={() => navigate('/aftaler')}>
          <span style={{ fontSize: 24 }}>⏰</span>
          <span style={{ ...s.statNum, color: '#F59E0B' }}>{counts.today}</span>
          <span style={s.statLabel}>I dag</span>
        </div>
      </div>

      {todayAppts.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>I dag</div>
          {todayAppts.map(a => (
            <div key={a.id} style={{ ...s.apptCard, borderLeftColor: '#F59E0B' }}>
              <div style={s.apptTime}>{formatTime(a.date)}</div>
              <div>
                <div style={s.apptTitle}>{a.title}</div>
                <div style={s.apptCustomer}>{a.customerName}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {nextAppts.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Næste aftaler</div>
          {nextAppts.map(a => (
            <div key={a.id} style={s.apptCard}>
              <div style={s.apptTime}>{formatShortDate(a.date)}</div>
              <div style={{ flex: 1 }}>
                <div style={s.apptTitle}>{a.title}</div>
                <div style={s.apptCustomer}>{a.customerName}</div>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginRight: 8 }}>{formatTime(a.date)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>Hurtige handlinger</div>
        <div style={s.actionsRow}>
          <button style={s.actionBtn} onClick={() => navigate('/kunder/ny')}>
            <span style={{ fontSize: 24 }}>👤</span>
            <span style={s.actionLabel}>Ny kunde</span>
          </button>
          <button style={s.actionBtn} onClick={() => navigate('/aftaler/ny')}>
            <span style={{ fontSize: 24 }}>📆</span>
            <span style={s.actionLabel}>Ny aftale</span>
          </button>
        </div>
      </div>
    </div>
  );
}
