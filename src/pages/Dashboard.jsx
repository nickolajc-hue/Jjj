import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers, getAppointments, occursOnDate, calcExpectedIncome } from '../storage.js';

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

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

function formatKr(amount) {
  return amount.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' kr';
}
function formatShortDate(d) {
  return new Date(d).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function IncomeChart({ appointments }) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return {
      label: MONTH_SHORT[d.getMonth()],
      shortYear: i > 0 && d.getMonth() === 0 ? String(d.getFullYear()).slice(2) : null,
      income: calcExpectedIncome(appointments, d, end),
      isCurrent: i === 0,
    };
  });

  const maxIncome = Math.max(...months.map(m => m.income), 1);
  const hasAny = months.some(m => m.income > 0);

  if (!hasAny) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0 4px', color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>
        Tilføj priser til dine aftaler for at se grafen
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150, paddingTop: 8 }}>
      {months.map((m, i) => {
        const barPct = m.income > 0 ? Math.max((m.income / maxIncome) * 90, 5) : 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {/* Beløb over søjlen */}
            <div style={{ fontSize: 8, fontWeight: 700, color: m.isCurrent ? '#2563EB' : '#6B7280', marginBottom: 2, textAlign: 'center', lineHeight: 1.2, minHeight: 12 }}>
              {m.income >= 1000
                ? `${(m.income / 1000 % 1 === 0 ? m.income / 1000 : (m.income / 1000).toFixed(1))}k`
                : m.income > 0 ? m.income : ''}
            </div>
            {/* Søjle */}
            <div style={{
              width: '100%',
              height: m.income > 0 ? `${barPct}%` : 2,
              background: m.isCurrent ? '#2563EB' : m.income > 0 ? '#93C5FD' : '#F3F4F6',
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.3s ease',
            }} />
            {/* Måneds-label */}
            <div style={{ fontSize: 9, fontWeight: m.isCurrent ? 800 : 400, color: m.isCurrent ? '#2563EB' : '#9CA3AF', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
              {m.label}
              {m.shortYear && <div style={{ fontSize: 8, color: '#C4C4C4' }}>{m.shortYear}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ customers: 0, upcoming: 0, today: 0 });
  const [income, setIncome] = useState({ monthly: 0, yearly: 0 });
  const [appointments, setAppointments] = useState([]);
  const [nextAppts, setNextAppts] = useState([]);

  useEffect(() => {
    const customers = getCustomers();
    const appts = getAppointments();
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

    const todayCount = appts.filter(a => occursOnDate(a, todayStart)).length;
    const upcomingCount = appts.filter(a => {
      const d = new Date(a.date); d.setHours(0, 0, 0, 0);
      return d >= todayStart;
    }).length;

    const enriched = appts.map(a => ({ ...a, customerName: customerMap[a.customerId] || 'Ukendt' }));
    const upcoming = enriched
      .filter(a => { const d = new Date(a.date); d.setHours(0, 0, 0, 0); return d >= todayStart; })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    setCounts({ customers: customers.length, upcoming: upcomingCount, today: todayCount });
    setIncome({
      monthly: calcExpectedIncome(appts, monthStart, monthEnd),
      yearly: calcExpectedIncome(appts, yearStart, yearEnd),
    });
    setAppointments(appts);
    setNextAppts(upcoming.slice(0, 5));
  }, []);

  return (
    <div style={s.pb}>
      <div style={s.header}>
        <div style={s.greeting}>God dag! 👋</div>
        <div style={s.sub}>Her er dit overblik</div>
      </div>

      {/* Tællerstatistik */}
      <div style={s.statsRow}>
        <div style={{ ...s.stat, background: '#EFF6FF' }} onClick={() => navigate('/kunder')}>
          <span style={{ fontSize: 22 }}>👥</span>
          <span style={{ ...s.statNum, color: '#2563EB' }}>{counts.customers}</span>
          <span style={s.statLabel}>Kunder</span>
        </div>
        <div style={{ ...s.stat, background: '#F0FDF4' }} onClick={() => navigate('/aftaler')}>
          <span style={{ fontSize: 22 }}>📅</span>
          <span style={{ ...s.statNum, color: '#10B981' }}>{counts.upcoming}</span>
          <span style={s.statLabel}>Kommende</span>
        </div>
        <div style={{ ...s.stat, background: '#FFF7ED' }} onClick={() => navigate('/min-dag')}>
          <span style={{ fontSize: 22 }}>⏰</span>
          <span style={{ ...s.statNum, color: '#F59E0B' }}>{counts.today}</span>
          <span style={s.statLabel}>I dag</span>
        </div>
      </div>

      {/* Indkomst */}
      <div style={s.section}>
        <div style={s.sectionTitle}>💰 Forventet indkomst</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Denne måned
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#10B981' }}>
              {formatKr(income.monthly)}
            </div>
          </div>
          <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Dette år
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#2563EB' }}>
              {formatKr(income.yearly)}
            </div>
          </div>
        </div>
        {/* Graf: næste 12 måneder */}
        <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Næste 12 måneder
          </div>
          <IncomeChart appointments={appointments} />
        </div>
      </div>

      {/* Næste aftaler */}
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
              {a.price > 0 && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginRight: 8 }}>
                  {a.price.toLocaleString('da-DK')} kr
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hurtige handlinger */}
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
