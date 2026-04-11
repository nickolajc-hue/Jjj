import React, { useState } from 'react';
import { getApptColor } from '../storage.js';

const MÅNEDER = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
const UGEDAGE = ['Ma','Ti','On','To','Fr','Lø','Sø'];

function capColor(pct) {
  if (pct >= 100) return '#EF4444';
  if (pct >= 70)  return '#F59E0B';
  return '#10B981';
}

// Props:
//   value       – Date, valgt dato
//   onChange    – (date) => void
//   apptsByDay  – { "YYYY-MM-DD": [aftaler] }
//   offDays     – Set<"YYYY-MM-DD">
//   workHours   – minutter pr. dag (0 = ingen kapacitetsbar)
//   travelTime  – minutter kørsel pr. opgave (0 = ingen)
export default function FullCalendarPicker({ value, onChange, apptsByDay = {}, offDays, workHours = 0, travelTime = 0 }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const init  = value || today;
  const [viewYear,  setViewYear]  = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDow  = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells     = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selDate = value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12 }}>

      {/* Måned-navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
        <button onClick={prev} style={{ width: 36, height: 36, borderRadius: 10, background: '#F3F4F6', fontSize: 20, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>{MÅNEDER[viewMonth]} {viewYear}</span>
        <button onClick={next} style={{ width: 36, height: 36, borderRadius: 10, background: '#F3F4F6', fontSize: 20, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      {/* Ugedage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
        {UGEDAGE.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i === 6 ? '#EF4444' : '#9CA3AF', padding: '5px 0' }}>{d}</div>
        ))}
      </div>

      {/* Dage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          const borderR = (i + 1) % 7 !== 0 ? '1px solid #F3F4F6' : 'none';
          if (!day) return <div key={`e${i}`} style={{ minHeight: 52, borderBottom: '1px solid #F3F4F6', borderRight: borderR, background: '#FAFAFA' }} />;

          const d     = new Date(viewYear, viewMonth, day);
          const dStr  = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = d.getTime() === today.getTime();
          const isSel   = selDate && d.getTime() === selDate.getTime();
          const isSun   = d.getDay() === 0;
          const isOff   = offDays && offDays.has(dStr);
          const dayAppts = apptsByDay[dStr] || [];
          const totalMin = dayAppts.reduce((s, a) => s + (a.duration || 0), 0) + dayAppts.length * (travelTime || 0);
          const pct = workHours > 0 && totalMin > 0 ? Math.min(100, Math.round(totalMin / workHours * 100)) : 0;

          return (
            <div key={day} onClick={() => onChange(d)} style={{
              minHeight: 52, padding: '4px 2px 0', cursor: 'pointer',
              background: isOff ? '#FFF1F2' : isSel ? '#EFF6FF' : '#fff',
              borderBottom: '1px solid #F3F4F6', borderRight: borderR,
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Dato-cirkel */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%', margin: '0 auto 1px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSel ? '#2563EB' : isToday ? '#DBEAFE' : 'transparent',
                fontSize: 12, fontWeight: isSel || isToday ? 700 : 400,
                color: isSel ? '#fff' : isToday ? '#1D4ED8' : isOff || isSun ? '#EF4444' : '#374151',
              }}>
                {day}
              </div>

              {isOff && <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#EF4444', lineHeight: 1.2 }}>FRI</div>}

              {!isOff && dayAppts.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 2, paddingBottom: 2 }}>
                  {dayAppts.slice(0, 3).map(a => (
                    <div key={a.id} style={{ width: 5, height: 5, borderRadius: '50%', background: getApptColor(a), flexShrink: 0 }} />
                  ))}
                  {dayAppts.length > 3 && <span style={{ fontSize: 7, color: '#6B7280', lineHeight: '5px' }}>+</span>}
                </div>
              )}

              {/* Flex-spacer + kapacitetsbar */}
              <div style={{ flex: 1 }} />
              {pct > 0 && (
                <div style={{ height: 3, background: '#F3F4F6' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: capColor(pct) }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
