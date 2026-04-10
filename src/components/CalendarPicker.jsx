import React, { useState } from 'react';

const UGEDAGE = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'];
const MÅNEDER = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];

// markedDates: Set<"YYYY-MM-DD"> — dates that have appointments (shows a dot)
export default function CalendarPicker({ value, onChange, markedDates }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = value || today;
  const [viewYear, setViewYear] = useState(start.getFullYear());
  const [viewMonth, setViewMonth] = useState(start.getMonth());

  const prev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selDate = value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={prev} style={{ width: 38, height: 38, borderRadius: 10, background: '#F3F4F6', fontSize: 20, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ‹
        </button>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>
          {MÅNEDER[viewMonth]} {viewYear}
        </span>
        <button onClick={next} style={{ width: 38, height: 38, borderRadius: 10, background: '#F3F4F6', fontSize: 20, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {UGEDAGE.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF', paddingBottom: 6 }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const d = new Date(viewYear, viewMonth, day);
          const isToday = d.getTime() === today.getTime();
          const isSel = selDate && d.getTime() === selDate.getTime();
          const isSun = new Date(viewYear, viewMonth, day).getDay() === 0;
          const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isMarked = markedDates && markedDates.has(dStr);
          return (
            <button key={day} onClick={() => onChange(d)} style={{
              aspectRatio: '1', borderRadius: '50%', fontSize: 13,
              fontWeight: isSel ? 800 : isToday ? 700 : 400,
              background: isSel ? '#2563EB' : isToday ? '#DBEAFE' : 'transparent',
              color: isSel ? '#fff' : isToday ? '#1D4ED8' : isSun ? '#EF4444' : '#374151',
              border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative', gap: 1,
            }}>
              <span style={{ lineHeight: 1 }}>{day}</span>
              {isMarked && (
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: isSel ? 'rgba(255,255,255,0.8)' : '#2563EB',
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
