import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAppointments, saveAppointments, getCustomers, formatDuration, RECURRENCE_LABELS, nextOccurrence } from '../storage.js';
import TopBar from '../components/TopBar.jsx';

const RECURRENCE_ICONS = { daily: '🔁', weekly: '🔁', biweekly: '🔁', monthly: '🔁' };

export default function Appointments() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);

  useEffect(() => { load(); }, []);

  const load = () => {
    const customers = getCustomers();
    const appointments = getAppointments();
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const enriched = appointments.map(a => ({
      ...a,
      customerName: customerMap[a.customerId] || 'Ukendt kunde',
      nextDate: nextOccurrence(a),
    }));

    const upcoming = enriched
      .filter(a => a.nextDate >= today)
      .sort((a, b) => a.nextDate - b.nextDate);

    const past = enriched
      .filter(a => a.nextDate < today && (!a.recurrence || a.recurrence === 'none'))
      .sort((a, b) => b.nextDate - a.nextDate);

    const result = [];
    if (upcoming.length) result.push({ title: 'Kommende', data: upcoming });
    if (past.length)     result.push({ title: 'Tidligere', data: past });
    setSections(result);
  };

  const del = (id) => {
    if (!confirm('Slet denne aftale?')) return;
    saveAppointments(getAppointments().filter(a => a.id !== id));
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <TopBar title="Aftaler" action={
        <button onClick={() => navigate('/aftaler/ny')} style={{ color: '#fff', fontSize: 28, lineHeight: 1, paddingLeft: 8 }}>+</button>
      } />

      <div style={{ padding: '12px 16px', paddingBottom: 24 }}>
        {sections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>Ingen aftaler endnu</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Tryk på + for at oprette en aftale</div>
          </div>
        ) : sections.map(sec => (
          <div key={sec.title}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, padding: '16px 0 8px' }}>{sec.title}</div>
            {sec.data.map(a => {
              const d = a.nextDate;
              const isPast = sec.title === 'Tidligere';
              const hasRecurrence = a.recurrence && a.recurrence !== 'none';
              return (
                <div key={a.id} onClick={() => navigate(`/aftaler/${a.id}/rediger`)}
                  style={{ display: 'flex', alignItems: 'flex-start', background: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', opacity: isPast ? 0.7 : 1, gap: 12, cursor: 'pointer' }}>
                  {/* Dato-boks */}
                  <div style={{ width: 48, height: 52, borderRadius: 10, background: isPast ? '#F3F4F6' : '#EFF6FF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: isPast ? '#9CA3AF' : '#2563EB', lineHeight: 1 }}>{d.getDate()}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isPast ? '#9CA3AF' : '#2563EB', textTransform: 'uppercase' }}>
                      {d.toLocaleDateString('da-DK', { month: 'short' })}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>👤 {a.customerName}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {a.duration > 0 && (
                        <span style={{ background: '#F0FDF4', color: '#10B981', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '2px 8px' }}>
                          ⏱ {formatDuration(a.duration)}
                        </span>
                      )}
                      {hasRecurrence && (
                        <span style={{ background: '#FFF7ED', color: '#F59E0B', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '2px 8px' }}>
                          🔁 {RECURRENCE_LABELS[a.recurrence]}
                        </span>
                      )}
                    </div>
                    {a.notes && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' }}>{a.notes}</div>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); del(a.id); }} style={{ color: '#EF4444', fontSize: 18, padding: 4, flexShrink: 0 }}>🗑</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
