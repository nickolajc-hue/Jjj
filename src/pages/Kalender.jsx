import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  getAppointments, saveAppointments, newId, getCustomers, occursOnDate,
  getApptColor, formatDuration,
  getOffDays, saveOffDays,
  getWorkHours, saveWorkHours,
  getTravelTime, saveTravelTime,
  toDateStr,
} from '../storage.js';
import CalendarPicker from '../components/CalendarPicker.jsx';

const MÅNEDER = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December'];
const UGEDAGE = ['Ma','Ti','On','To','Fr','Lø','Sø'];
const WH_PRESETS = [
  { label: '4t',  min: 240 },
  { label: '6t',  min: 360 },
  { label: '7t',  min: 420 },
  { label: '8t',  min: 480 },
  { label: '9t',  min: 540 },
  { label: '10t', min: 600 },
];
const TT_PRESETS = [
  { label: '10 min', min: 10 },
  { label: '15 min', min: 15 },
  { label: '20 min', min: 20 },
  { label: '30 min', min: 30 },
  { label: '45 min', min: 45 },
  { label: '60 min', min: 60 },
];

function capColor(pct) {
  if (pct >= 100) return '#EF4444';
  if (pct >= 70)  return '#F59E0B';
  return '#10B981';
}

export default function Kalender() {
  const navigate = useNavigate();
  const today = new Date(); today.setHours(0,0,0,0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [offDays,   setOffDays]   = useState(() => getOffDays());
  const [workHours, setWorkHours] = useState(() => getWorkHours());
  const [apptsByDay, setApptsByDay] = useState({});
  const [custMap,    setCustMap]   = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [travelTime, setTravelTime] = useState(() => getTravelTime());
  const [editWH,    setEditWH]    = useState(false);
  const [whInput,   setWhInput]   = useState('');
  const [editTT,    setEditTT]    = useState(false);
  const [ttInput,   setTtInput]   = useState('');
  const [showMove,  setShowMove]  = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [viewYear, viewMonth, refreshKey]);

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

  const saveWH = (min) => {
    setWorkHours(min);
    saveWorkHours(min);
    setEditWH(false);
  };
  const saveCustomWH = () => {
    const h = parseFloat(whInput.replace(',', '.'));
    if (!isNaN(h) && h > 0) saveWH(Math.round(h * 60));
  };

  const saveTT = (min) => {
    setTravelTime(min);
    saveTravelTime(min);
    setEditTT(false);
  };
  const saveCustomTT = () => {
    const m = parseInt(ttInput);
    if (!isNaN(m) && m >= 0) saveTT(m);
  };

  const executeMove = () => {
    if (!moveTarget || !selectedDay) return;
    const srcStr = toDateStr(selectedDay);
    const tgtStr = toDateStr(moveTarget);
    if (srcStr === tgtStr) { setShowMove(false); return; }
    const selIds = new Set(selAppts.map(a => a.id));
    const result = [];
    getAppointments().forEach(a => {
      if (!selIds.has(a.id)) { result.push(a); return; }
      if (!a.recurrence || a.recurrence === 'none') {
        result.push({ ...a, date: tgtStr });
      } else {
        result.push({ ...a, exceptions: [...(a.exceptions || []), srcStr] });
        const { recurrence: _r, recurrenceInterval: _ri, recurrenceEndDate: _re, exceptions: _ex, ...rest } = a;
        result.push({ ...rest, id: newId(), date: tgtStr });
      }
    });
    saveAppointments(result);
    setShowMove(false);
    setMoveTarget(null);
    setSelectedDay(null);
    setRefreshKey(k => k + 1);
  };

  const firstDow  = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells     = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selStr    = selectedDay ? toDateStr(selectedDay) : null;
  const selAppts  = selStr ? (apptsByDay[selStr] || []) : [];
  const selIsOff  = selStr ? offDays.has(selStr) : false;
  const selIsToday = selectedDay && selectedDay.getTime() === today.getTime();
  const selWorkMin  = selAppts.reduce((s, a) => s + (a.duration || 0), 0);
  const selTravelMin = selAppts.length * travelTime;
  const selTotalMin = selWorkMin + selTravelMin;
  const selRemMin   = workHours - selTotalMin;
  const selPct      = workHours > 0 ? Math.min(100, Math.round(selTotalMin / workHours * 100)) : 0;

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

      {/* Arbejdstid-indstilling */}
      <div style={{ margin: '12px 10px 0', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⏰</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Planlagt arbejdstid</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                {workHours > 0 ? `${workHours / 60 % 1 === 0 ? workHours / 60 : (workHours / 60).toFixed(1)} timer pr. dag` : 'Ikke sat'}
              </div>
            </div>
          </div>
          <button onClick={() => { setWhInput(''); setEditWH(v => !v); }} style={{
            background: editWH ? '#F3F4F6' : '#EFF6FF', color: editWH ? '#6B7280' : '#2563EB',
            borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700,
          }}>
            {editWH ? 'Luk' : 'Skift'}
          </button>
        </div>
        {editWH && (
          <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, marginTop: 10 }}>Vælg antal timer du normalt arbejder pr. dag:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {WH_PRESETS.map(p => (
                <button key={p.min} onClick={() => saveWH(p.min)} style={{
                  borderRadius: 20, padding: '7px 16px', fontSize: 14, fontWeight: 700,
                  background: workHours === p.min ? '#2563EB' : '#F3F4F6',
                  color: workHours === p.min ? '#fff' : '#374151',
                }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" inputMode="decimal" placeholder="F.eks. 7.5"
                value={whInput} onChange={e => setWhInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCustomWH()}
                style={{ flex: 1, fontSize: 15, borderBottom: '2px solid #2563EB', paddingBottom: 4, color: '#111827' }}
              />
              <span style={{ fontSize: 13, color: '#6B7280' }}>timer</span>
              <button onClick={saveCustomWH} style={{ background: '#2563EB', color: '#fff', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700 }}>Gem</button>
            </div>
          </div>
        )}
      </div>

      {/* Kørselstid-indstilling */}
      <div style={{ margin: '8px 10px 0', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🚗</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Kørsel pr. opgave</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                {travelTime > 0 ? `${travelTime} min (frem + hjem)` : 'Ikke medregnet'}
              </div>
            </div>
          </div>
          <button onClick={() => { setTtInput(''); setEditTT(v => !v); }} style={{
            background: editTT ? '#F3F4F6' : '#EFF6FF', color: editTT ? '#6B7280' : '#2563EB',
            borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 700,
          }}>
            {editTT ? 'Luk' : 'Skift'}
          </button>
        </div>
        {editTT && (
          <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, marginTop: 10 }}>
              Gennemsnitlig kørselstid pr. opgave (inkl. hjemkørsel):
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button onClick={() => saveTT(0)} style={{
                borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700,
                background: travelTime === 0 ? '#2563EB' : '#F3F4F6',
                color: travelTime === 0 ? '#fff' : '#374151',
              }}>Ingen</button>
              {TT_PRESETS.map(p => (
                <button key={p.min} onClick={() => saveTT(p.min)} style={{
                  borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700,
                  background: travelTime === p.min ? '#2563EB' : '#F3F4F6',
                  color: travelTime === p.min ? '#fff' : '#374151',
                }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" inputMode="numeric" placeholder="F.eks. 25"
                value={ttInput} onChange={e => setTtInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCustomTT()}
                style={{ flex: 1, fontSize: 15, borderBottom: '2px solid #2563EB', paddingBottom: 4, color: '#111827' }}
              />
              <span style={{ fontSize: 13, color: '#6B7280' }}>min</span>
              <button onClick={saveCustomTT} style={{ background: '#2563EB', color: '#fff', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700 }}>Gem</button>
            </div>
          </div>
        )}
      </div>

      {/* Kalender-grid */}
      <div style={{ margin: '10px 10px 0', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        {/* Ugedage-header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
          {UGEDAGE.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 6 ? '#EF4444' : '#6B7280', padding: '7px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Dage */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => {
            const borderR = (i + 1) % 7 !== 0 ? '1px solid #F3F4F6' : 'none';
            if (!day) return (
              <div key={`e${i}`} style={{ minHeight: 62, borderBottom: '1px solid #F3F4F6', borderRight: borderR, background: '#FAFAFA' }} />
            );

            const d      = new Date(viewYear, viewMonth, day);
            const dStr   = toDateStr(d);
            const isToday = d.getTime() === today.getTime();
            const isSun  = d.getDay() === 0;
            const isSel  = selectedDay && d.getTime() === selectedDay.getTime();
            const isOff  = offDays.has(dStr);
            const dayAppts = apptsByDay[dStr] || [];
            const isPast = d < today;
            const totalMin = dayAppts.reduce((s, a) => s + (a.duration || 0), 0) + dayAppts.length * travelTime;
            const pct    = workHours > 0 && totalMin > 0 ? Math.min(100, Math.round(totalMin / workHours * 100)) : 0;

            return (
              <div key={day}
                onClick={() => setSelectedDay(isSel ? null : d)}
                style={{
                  minHeight: 62, padding: '5px 3px 0', cursor: 'pointer',
                  background: isOff ? '#FFF1F2' : isSel ? '#EFF6FF' : '#fff',
                  borderBottom: '1px solid #F3F4F6', borderRight: borderR,
                  opacity: isPast && !isToday ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Dato-cirkel */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', margin: '0 auto 2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? '#2563EB' : isSel ? '#DBEAFE' : 'transparent',
                  fontSize: 13, fontWeight: isToday ? 800 : isSel ? 700 : 400,
                  color: isToday ? '#fff' : isSun ? '#EF4444' : isOff ? '#EF4444' : '#374151',
                }}>
                  {day}
                </div>

                {isOff && (
                  <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#EF4444', letterSpacing: 0.2 }}>FRI</div>
                )}

                {!isOff && dayAppts.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', paddingBottom: 3 }}>
                    {dayAppts.slice(0, 3).map(a => (
                      <div key={a.id} style={{ width: 6, height: 6, borderRadius: '50%', background: getApptColor(a), flexShrink: 0 }} />
                    ))}
                    {dayAppts.length > 3 && <span style={{ fontSize: 8, color: '#6B7280', lineHeight: '6px' }}>+{dayAppts.length - 3}</span>}
                  </div>
                )}

                {/* Kapacitetsbar */}
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

      {/* Forklaring */}
      <div style={{ display: 'flex', gap: 14, padding: '10px 14px 4px', flexWrap: 'wrap' }}>
        {[
          { color: '#2563EB', shape: 'circle', label: 'Aftale' },
          { color: '#FFF1F2', border: '#EF4444', shape: 'rect', label: 'Fri dag' },
          { color: '#10B981', shape: 'bar', label: '<70%' },
          { color: '#F59E0B', shape: 'bar', label: '70-99%' },
          { color: '#EF4444', shape: 'bar', label: '100%+' },
        ].map(it => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
            {it.shape === 'circle' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: it.color }} />}
            {it.shape === 'rect'   && <div style={{ width: 10, height: 10, borderRadius: 2, background: it.color, border: `1px solid ${it.border}` }} />}
            {it.shape === 'bar'    && <div style={{ width: 14, height: 4, borderRadius: 2, background: it.color }} />}
            {it.label}
          </div>
        ))}
      </div>

      {/* Tilføj-knap */}
      <div style={{ padding: '6px 12px 0' }}>
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
          onClick={e => { if (e.target === e.currentTarget) { setSelectedDay(null); setShowMove(false); setMoveTarget(null); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}
        >
          <div style={{ background: '#F9FAFB', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Sheet-header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fff', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
              {showMove ? (
                <>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>Flyt alle opgaver til...</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{selAppts.length} opgave{selAppts.length !== 1 ? 'r' : ''} flyttes</div>
                  </div>
                  <button onClick={() => { setShowMove(false); setMoveTarget(null); }} style={{ fontSize: 14, color: '#6B7280', fontWeight: 600, background: '#F3F4F6', borderRadius: 20, padding: '6px 14px' }}>Annuller</button>
                </>
              ) : (
                <>
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
                  <button onClick={() => { setSelectedDay(null); setShowMove(false); }} style={{ fontSize: 28, color: '#9CA3AF', lineHeight: 1, padding: '0 4px' }}>×</button>
                </>
              )}
            </div>

            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px 32px' }}>

              {/* Flyt-dag-indhold */}
              {showMove && (
                <>
                  <CalendarPicker
                    value={moveTarget}
                    onChange={setMoveTarget}
                    offDays={offDays}
                  />
                  {moveTarget && (
                    <button onClick={executeMove} style={{
                      width: '100%', background: '#2563EB', color: '#fff', borderRadius: 14,
                      padding: '14px 0', fontSize: 16, fontWeight: 700, marginTop: 4,
                      boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                    }}>
                      Flyt {selAppts.length} opgave{selAppts.length !== 1 ? 'r' : ''} til {moveTarget.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </button>
                  )}
                </>
              )}

              {/* Kapacitetsindikator */}
              {!showMove && workHours > 0 && !selIsOff && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>⏱ Kapacitet</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: capColor(selPct) }}>
                      {selPct}% brugt
                    </span>
                  </div>
                  <div style={{ background: '#F3F4F6', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${selPct}%`, background: capColor(selPct), borderRadius: 99, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
                    <span>
                      {formatDuration(selWorkMin)} arbejde
                      {selTravelMin > 0 && ` + ${formatDuration(selTravelMin)} kørsel`}
                    </span>
                    <span style={{ color: selRemMin >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                      {selRemMin >= 0 ? `${formatDuration(selRemMin)} ledig` : `${formatDuration(-selRemMin)} overtid`}
                    </span>
                  </div>
                </div>
              )}

              {/* Fri-dag-toggle */}
              {!showMove && <button onClick={() => toggleOff(selStr)} style={{
                width: '100%', marginBottom: 14, borderRadius: 12, padding: '12px 16px',
                background: selIsOff ? '#FEE2E2' : '#F9FAFB',
                border: `2px solid ${selIsOff ? '#EF4444' : '#E5E7EB'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: selIsOff ? '#EF4444' : '#374151' }}>
                    {selIsOff ? '🔴 Fri dag (fjern markering)' : '⚪ Marker som fri dag'}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Dage du ikke kan arbejde</div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: selIsOff ? '#EF4444' : '#E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 16,
                }}>
                  {selIsOff ? '✓' : '+'}
                </div>
              </button>}

              {/* Opgave-liste */}
              {!showMove && selAppts.length > 0 && (
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
                        {a.duration > 0 && <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, marginTop: 4 }}>⏱ {formatDuration(a.duration)}</div>}
                        {a.price > 0    && <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, marginTop: 2 }}>💰 {a.price.toLocaleString('da-DK')} kr</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Handlingsknapper */}
              {!showMove && (
                <>
                  {selAppts.length > 0 && (
                    <button
                      onClick={() => { setShowMove(true); setMoveTarget(null); }}
                      style={{ width: '100%', marginBottom: 10, background: '#FEF3C7', color: '#D97706', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, border: '1.5px solid #FCD34D' }}
                    >
                      📦 Flyt alle opgaver til en anden dag
                    </button>
                  )}
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
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
