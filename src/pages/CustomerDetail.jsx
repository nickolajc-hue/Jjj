import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomers, getAppointments, getQuotes, saveQuotes, formatDuration, formatRecurrence, occursOnDate, getApptColor } from '../storage.js';
import TopBar from '../components/TopBar.jsx';

function formatDate(d) {
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function gapLabel(days) {
  if (days === 0) return null;
  if (days === 7)  return '1 uge';
  if (days === 14) return '2 uger';
  if (days % 7 === 0) return `${days / 7} uger`;
  if (days === 1)  return '1 dag';
  return `${days} dage`;
}

const S = {
  section: { background: '#fff', margin: '14px 16px 0', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6', gap: 12 },
};

function ApptCard({ a, dateLabel, color, icon, bg }) {
  const navigate = useNavigate();
  return (
    <div onClick={() => navigate(`/aftaler/${a.id}/rediger`)}
      style={{ background: bg || '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 6, borderLeft: `3px solid ${color}`, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
        <span style={{ fontSize: 18, flexShrink: 0, marginLeft: 6 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{dateLabel}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
        {a.duration > 0 && <span style={{ background: '#D1FAE5', color: '#059669', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>⏱ {formatDuration(a.duration)}</span>}
        {formatRecurrence(a) && <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>🔁 {formatRecurrence(a)}</span>}
        {a.price > 0 && <span style={{ background: '#F0FDF4', color: '#16A34A', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 6px' }}>💰 {a.price.toLocaleString('da-DK')} kr</span>}
      </div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast]         = useState([]);
  const [showAllPast, setShowAllPast] = useState(false);
  const [quotes, setQuotes]     = useState([]);

  useEffect(() => {
    const c = getCustomers().find(x => x.id === id);
    setCustomer(c);
    const appts = getAppointments().filter(a => a.customerId === id);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Kommende forekomster: næste 3 måneder
    const horizon = new Date(today); horizon.setMonth(horizon.getMonth() + 3);
    const upArr = [];
    appts.forEach(a => {
      const d = new Date(today);
      while (d <= horizon) {
        if (occursOnDate(a, d)) upArr.push({ ...a, _date: new Date(d) });
        d.setDate(d.getDate() + 1);
      }
    });
    upArr.sort((a, b) => a._date - b._date);
    setUpcoming(upArr);

    // Afsluttede forekomster: de seneste 3 måneder
    const pastStart = new Date(today); pastStart.setMonth(pastStart.getMonth() - 3);
    const pastArr = [];
    appts.forEach(a => {
      const startFrom = new Date(Math.max(pastStart.getTime(), new Date(a.date).setHours(0,0,0,0)));
      const d = new Date(startFrom);
      while (d < today) {
        if (occursOnDate(a, d)) pastArr.push({ ...a, _date: new Date(d) });
        d.setDate(d.getDate() + 1);
      }
    });
    pastArr.sort((a, b) => b._date - a._date);
    setPast(pastArr);

    const customerQuotes = getQuotes().filter(q => q.customerId === id);
    customerQuotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setQuotes(customerQuotes);
  }, [id]);

  if (!customer) return <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Kunde ikke fundet</div>;

  const visiblePast = showAllPast ? past : past.slice(0, 5);

  return (
    <div style={{ paddingBottom: 40 }}>
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
          <div style={{ color: '#9CA3AF', fontSize: 14, fontStyle: 'italic' }}>Ingen kommende aftaler de næste 3 måneder</div>
        ) : upcoming.map((a, i) => {
          const prev = i > 0 ? upcoming[i - 1] : null;
          const gapDays = prev ? Math.round((a._date - prev._date) / 86400000) : null;
          const label = gapLabel(gapDays);
          return (
            <React.Fragment key={`${a.id}_${a._date.toISOString()}`}>
              {label && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{label}</span>
                  <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                </div>
              )}
              <ApptCard
                a={a}
                dateLabel={formatDate(a._date)}
                color={getApptColor(a)}
                icon="🕐"
                bg="#EFF6FF"
              />
            </React.Fragment>
          );
        })}
      </div>

      {/* Gemte tilbud */}
      {quotes.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Gemte tilbud</div>
          {quotes.map(q => {
            const typeIcon  = q.type === 'grass' ? '🌿' : q.type === 'window' ? '🪟' : '✂️';
            const p = q.params || {};
            const hedgeLabel = (p.klipOn && p.beskæringOn) ? 'Hækkeklip + Beskæring'
                             : p.beskæringOn ? 'Beskæring'
                             : p.subType === 'beskæring' ? 'Beskæring'
                             : 'Hækkeklip';
            const typeLabel = q.type === 'grass' ? 'Græsslåning' : q.type === 'window' ? 'Vinduespudsning' : hedgeLabel;
            const disc = p.discount || 0;
            const deleteQuote = () => {
              if (!confirm('Slet dette tilbud?')) return;
              saveQuotes(getQuotes().filter(x => x.id !== q.id));
              setQuotes(prev => prev.filter(x => x.id !== q.id));
            };
            return (
              <div key={q.id} style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: '3px solid #2563EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{typeIcon} {typeLabel}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {new Date(q.createdAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {disc > 0 && <div style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>-{disc}% rabat</div>}
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#2563EB' }}>{q.totalPrice.toLocaleString('da-DK')} kr</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => navigate('/tilbud')}
                    style={{ flex: 1, background: '#EFF6FF', color: '#2563EB', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700 }}
                  >
                    Se i tilbud
                  </button>
                  <button
                    onClick={deleteQuote}
                    style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700 }}
                  >
                    Slet
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past appointments */}
      {past.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Afsluttede aftaler</div>
          {visiblePast.map(a => (
            <ApptCard
              key={`${a.id}_${a._date.toISOString()}`}
              a={a}
              dateLabel={formatDate(a._date)}
              color={getApptColor(a)}
              icon="✅"
              bg="#F0FDF4"
            />
          ))}
          {past.length > 5 && (
            <button
              onClick={() => setShowAllPast(v => !v)}
              style={{ width: '100%', marginTop: 6, color: '#6B7280', fontSize: 13, fontWeight: 600, background: '#F3F4F6', borderRadius: 10, padding: '9px 0' }}
            >
              {showAllPast ? 'Vis færre' : `Vis alle ${past.length} afsluttede`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
