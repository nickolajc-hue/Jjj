import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomers, getAppointments, formatDuration, RECURRENCE_LABELS, nextOccurrence } from '../storage.js';
import TopBar from '../components/TopBar.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const S = {
  section: { background: '#fff', margin: '14px 16px 0', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6', gap: 12 },
  apptCard: { display: 'flex', alignItems: 'flex-start', background: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
  apptPast: { background: '#F0FDF4' },
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const c = getCustomers().find(x => x.id === id);
    setCustomer(c);
    const now = new Date();
    const appts = getAppointments().filter(a => a.customerId === id).sort((a, b) => nextOccurrence(a) - nextOccurrence(b));
    setAppointments(appts);
  }, [id]);

  if (!customer) return <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Kunde ikke fundet</div>;

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = appointments.filter(a => nextOccurrence(a) >= today);
  const past = appointments.filter(a => nextOccurrence(a) < today && (!a.recurrence || a.recurrence === 'none'));

  return (
    <div style={{ paddingBottom: 32 }}>
      <TopBar title={customer.name} backTo="/kunder" action={
        <button onClick={() => navigate(`/kunder/${id}/rediger`)} style={{ color: '#fff', fontSize: 14, fontWeight: 600, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '6px 14px' }}>Rediger</button>
      } />

      {/* Header */}
      <div style={{ background: '#2563EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 32px', marginTop: -1 }}>
        <div style={{ width: 80, height: 80, borderRadius: 40, background: 'rgba(255,255,255,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, marginBottom: 10 }}>
          {customer.name.charAt(0).toUpperCase()}
        </div>
        {customer.company && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{customer.company}</div>}
      </div>

      {/* Contact */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Kontakt</div>
        {customer.phone && (
          <a href={`tel:${customer.phone}`} style={S.row}>
            <span style={{ fontSize: 20 }}>📞</span>
            <span style={{ flex: 1, fontSize: 15, color: '#2563EB' }}>{customer.phone}</span>
            <span style={{ color: '#D1D5DB' }}>›</span>
          </a>
        )}
        {customer.email && (
          <a href={`mailto:${customer.email}`} style={S.row}>
            <span style={{ fontSize: 20 }}>✉️</span>
            <span style={{ flex: 1, fontSize: 15, color: '#2563EB' }}>{customer.email}</span>
            <span style={{ color: '#D1D5DB' }}>›</span>
          </a>
        )}
        {customer.address && (
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <span style={{ fontSize: 15 }}>{customer.address}</span>
          </div>
        )}
        {!customer.phone && !customer.email && !customer.address && (
          <div style={{ color: '#9CA3AF', fontSize: 14, fontStyle: 'italic' }}>Ingen kontaktoplysninger</div>
        )}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Noter</div>
          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 1.6, color: '#374151' }}>{customer.notes}</div>
        </div>
      )}

      {/* Upcoming appointments */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={S.sectionTitle}>Kommende aftaler</div>
          <button onClick={() => navigate(`/kunder/${id}/ny-aftale`)} style={{ color: '#2563EB', fontSize: 13, fontWeight: 600 }}>+ Ny aftale</button>
        </div>
        {upcoming.length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 14, fontStyle: 'italic' }}>Ingen kommende aftaler</div>
        ) : upcoming.map(a => (
          <div key={a.id} style={S.apptCard}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🕐</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{formatDate(nextOccurrence(a).toISOString())}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {a.duration > 0 && <span style={{ background: '#D1FAE5', color: '#059669', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>⏱ {formatDuration(a.duration)}</span>}
                {a.recurrence && a.recurrence !== 'none' && <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>🔁 {RECURRENCE_LABELS[a.recurrence]}</span>}
              </div>
              {a.notes && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{a.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Past appointments */}
      {past.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Tidligere aftaler</div>
          {past.map(a => (
            <div key={a.id} style={{ ...S.apptCard, ...S.apptPast }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{formatDate(a.date)}</div>
                {a.duration > 0 && <span style={{ fontSize: 11, color: '#6B7280' }}>⏱ {formatDuration(a.duration)}</span>}
                {a.notes && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{a.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
