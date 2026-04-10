import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  getAppointments, getCustomers, occursOnDate,
  getApptColor, formatDuration,
  getOffDays, saveOffDays,
  toDateStr,
} from '../storage.js';

const MÅNEDER = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
const UGEDAGE = ['Ma','Ti','On','To','Fr','Lø','Sø'];

export default function Kalender() {
  const navigate = useNavigate();
  const today = new Date(); today.setHours(0,0,0,0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [offDays,   setOffDays]   = useState(() => getOffDays());
  const [apptsByDay, setApptsByDay] = useState({});
  const [custMap,   setCustMap]   = useState({});
  const [selectedDay, setSelectedDay] = useState(null);

  // Genindlæs aftaler for den viste måned
  useEffect(() => {
    const allAppts = getAppointments();
    const custs    = getCustomers();
    setCustMap(Object.fromEntries(custs.map(c => [c.id, c])));

    const map = {};
    const d = new Date(viewYear, viewMonth, 1);
    while (d.getMonth() === viewMonth) {
      const appts = allAppts.filter(a => occursOnDate(a, d));
      if (appts.length > 0) map[toDateStr(new Date(d))] = appts;
      d.setDate(d.getDate() + 1);
    }
    setApptsByDay(map);
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggleOff = (dStr) => {
    const next = new Set(offDays);
    if (next.has(dStr)) next.delete(dStr); else next.add(dStr);
    setOffDays(next);
    saveOffDays(next);
  };

  // Byg celle-array (mandag-start)
  const firstDow  = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells     = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selStr      = selectedDay ? toDateStr(selectedDay) : null;
  const selAppts    = selStr ? (apptsByDay[selStr] || []) : [];
  const selIsOff    = selStr ? offDays.has(selStr) : false;
  const selIsToday  = selectedDay && selectedDay.getTime() === today.getTime();

  return (
    <div style={{ paddingBottom: 32, minHeight: '100%', background: '#F9FAFB' }}>

      {/* Header */}
      <div style={{ background: '#2563EB', padding: '18px 20px 20px', paddingTop: 'calc(18px + env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={prevMonth} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 32, lineHeight: 1, padding: '0 8px' }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 21, fontWeight: 800 }}>{MÅNEDER[viewMonth]}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600 }}>{viewYear}</div>
          </div>
          <button onClick={nextMonth} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 32, lineHeight: 1, padding: '0 8px' }}>›</button>
        </div>
      </div>

      {/* Kalender */}
      <div style={{ margin: '12px 10px 0', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>

        {/* Ugedage-header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
          {UGEDAGE.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 6 ? '#EF4444' : '#6B7280', padding: '7px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Dage-grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => {
            const borderR = (i + 1) % 7 !== 0 ? '1px solid #F3F4F6' : 'none';
            if (!day) return (
              <div key={`e${i}`} style={{ minHeight: 58, borderBottom: '1px solid #F3F4F6', borderRight: borderR, background: '#FAFAFA' }} />
            );

            const d    = new Date(viewYear, viewMonth, day);
            const dStr = toDateStr(d);
            const isToday = d.getTime() === today.getTime();
            const isSun   = d.getDay() === 0;
            const isSel   = selectedDay && d.getTime() === selectedDay.getTime();
            const isOff   = offDays.has(dStr);
            const dayAppts = apptsByDay[dStr] || [];
            const isPast  = d < today;

            return (
              <div key={day}
                onClick={() => setSelectedDay(isSel ? null : d)}
                style={{
                  minHeight: 58, padding: '5px 3px 4px', cursor: 'pointer',
                  background: isOff ? '#FFF1F2' : isSel ? '#EFF6FF' : '#fff',
                  borderBottom: '1px solid #F3F4F6',
                  borderRight: borderR,
                  opacity: isPast && !isToday ? 0.55 : 1,
                }}
              >
                {/* Dato-cirkel */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  margin: '0 auto 3px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? '#2563EB' : isSel ? '#DBEAFE' : 'transparent',
                  fontSize: 13,
                  fontWeight: isToday ? 800 : isSel ? 700 : 400,
                  color: isToday ? '#fff' : isSun ? '#EF4444' : isOff ? '#EF4444' : '#374151',
                }}>
                  {day}
                </div>

                {/* Fri-badge */}
                {isOff && (
                  <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#EF4444', letterSpacing: 0.2 }}>
                    FRI
                  </div>
                )}

                {/* Aftale-dots */}
                {!isOff && dayAppts.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', paddingTop: isOff ? 0 : 1 }}>
                    {dayAppts.slice(0, 3).map(a => (
                      <div key={a.id} style={{ width: 6, height: 6, borderRadius: '50%', background: getApptColor(a), flexShrink: 0 }} />
                    ))}
                    {dayAppts.length > 3 && (
                      <span style={{ fontSize: 8, color: '#6B7280', lineHeight: '6px' }}>+{dayAppts.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Forklaring */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 14px 4px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} />
          Aftale
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#FFF1F2', border: '1px solid #EF4444' }} />
          Fri dag
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>Tryk på en dag for detaljer</div>
      </div>

      {/* Tilføj-knap */}
      <div style={{ padding: '8px 12px 0' }}>
        <button onClick={() => navigate('/aftaler/ny')} style={{
          width: '100%', background: '#2563EB', color: '#fff', borderRadius: 14,
          padding: '14px 0', fontSize: 16, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
        }}>
          + Ny opgave
        </button>
      </div>

      {/* Dag-bottomsheet */}
      {selectedDay && createPortal(
        <div
          onClick={e => { if (e.target === e.currentTarget) setSelectedDay(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}
        >
          <div style={{ background: '#F9FAFB', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Sheet-header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fff', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, textTransform: 'capitalize' }}>
                  {selectedDay.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {selIsToday && <span style={{ marginLeft: 8, fontSize: 12, background: '#2563EB', color: '#fff', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>I dag</span>}
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {selAppts.length > 0 ? `${selAppts.length} opgave${selAppts.length !== 1 ? 'r' : ''}` : 'Ingen opgaver'}
                  {selIsOff ? ' · Fri dag' : ''}
                </div>
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ fontSize: 28, color: '#9CA3AF', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px 32px' }}>

              {/* Fri-dag-toggle */}
              <button
                onClick={() => toggleOff(selStr)}
                style={{
                  width: '100%', marginBottom: 14, borderRadius: 12, padding: '12px 16px',
                  background: selIsOff ? '#FEE2E2' : '#F9FAFB',
                  border: `2px solid ${selIsOff ? '#EF4444' : '#E5E7EB'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: selIsOff ? '#EF4444' : '#374151' }}>
                    {selIsOff ? '🔴 Fri dag (fjern markering)' : '⚪ Marker som fri dag'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {selIsOff ? 'Tryk for at fjerne fri dag' : 'Dage du ikke kan arbejde'}
                  </div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: selIsOff ? '#EF4444' : '#E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16,
                }}>
                  {selIsOff ? '✓' : '+'}
                </div>
              </button>

              {/* Opgave-liste */}
              {selAppts.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Opgaver
                  </div>
                  {selAppts.map(a => {
                    const cust = custMap[a.customerId];
                    const col  = getApptColor(a);
                    return (
                      <div key={a.id} onClick={() => navigate(`/aftaler/${a.id}/rediger`)}
                        style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 8, borderLeft: `3px solid ${col}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</div>
                        {cust
                          ? <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>👤 {cust.name}</div>
                          : !a.customerId && <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>📋 Enkeltopgave</div>
                        }
                        {a.duration > 0 && (
                          <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, marginTop: 4 }}>⏱ {formatDuration(a.duration)}</div>
                        )}
                        {a.price > 0 && (
                          <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, marginTop: 2 }}>💰 {a.price.toLocaleString('da-DK')} kr</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Handlingsknapper */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setSelectedDay(null); navigate('/min-dag', { state: { date: selectedDay.toISOString() } }); }}
                  style={{ flex: 1, background: '#EFF6FF', color: '#2563EB', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700 }}
                >
                  📅 Åbn Min dag
                </button>
                <button
                  onClick={() => { setSelectedDay(null); navigate('/aftaler/ny', { state: { date: selectedDay.toISOString() } }); }}
                  style={{ flex: 1, background: '#2563EB', color: '#fff', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700 }}
                >
                  + Ny opgave
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
