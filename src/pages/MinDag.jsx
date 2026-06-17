import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getAppointments, getCustomers, occursOnDate, formatDuration, formatRecurrence, getDayRecords, saveDayRecords, getDayKey, getApptColor, getApptPhotos, saveApptPhotos, newId, toDateStr } from '../storage.js';
import CalendarPicker from '../components/CalendarPicker.jsx';

const HOME_KEY = 'kundeapp_home_address';
const END_KEY  = 'kundeapp_end_address';
const STARTTIME_KEY = 'kundeapp_start_time';
const DEFAULT_HOME = 'Æblerosevej 8, 9430 Vadum';

// ── Haversine afstand i km ─────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── DAWA geocoding ─────────────────────────────────────────────────────────
async function geocode(address) {
  if (!address?.trim()) return null;
  try {
    const res = await fetch(
      `https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(address)}&format=json&per_side=1`
    );
    const data = await res.json();
    if (data.length > 0) {
      const [lng, lat] = data[0].adgangsadresse.adgangspunkt.koordinater;
      return { lat, lng };
    }
  } catch {}
  return null;
}

// ── Nearest-neighbor routing ───────────────────────────────────────────────
function nearestNeighborRoute(homeCoords, appts) {
  const withCoords = appts.filter(a => a.coords);
  const withoutCoords = appts.filter(a => !a.coords);
  const route = [];
  const remaining = [...withCoords];
  let current = homeCoords;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = haversine(current.lat, current.lng, remaining[0].coords.lat, remaining[0].coords.lng);
    for (let i = 1; i < remaining.length; i++) {
      const d = haversine(current.lat, current.lng, remaining[i].coords.lat, remaining[i].coords.lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    route.push({ ...remaining[bestIdx], distFromPrev: bestDist });
    current = remaining[bestIdx].coords;
    remaining.splice(bestIdx, 1);
  }
  withoutCoords.sort((a, b) => new Date(a.date) - new Date(b.date));
  return [...route, ...withoutCoords.map(a => ({ ...a, distFromPrev: null }))];
}

// ── Hjælp: format MM:SS ────────────────────────────────────────────────────
function fmtTimer(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ── Hjælp: addér minutter til HH:MM streng ────────────────────────────────
function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── Pakkeliste ─────────────────────────────────────────────────────────────
function PackingList({ appointments, date }) {
  const allEquipment = [...new Set(appointments.flatMap(a => a.equipment || []))].sort();
  if (allEquipment.length === 0) return null;

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const equipKey = `equip_${dateStr}`;

  const [checked, setChecked] = useState(() => getDayRecords()[equipKey] || []);

  const toggle = (item) => {
    const next = checked.includes(item) ? checked.filter(i => i !== item) : [...checked, item];
    setChecked(next);
    saveDayRecords({ ...getDayRecords(), [equipKey]: next });
  };

  const doneCount = checked.filter(i => allEquipment.includes(i)).length;

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          🎒 Pakkeliste
        </div>
        <div style={{ fontSize: 12, color: doneCount === allEquipment.length ? '#10B981' : '#6B7280', fontWeight: 700 }}>
          {doneCount}/{allEquipment.length} pakket
        </div>
      </div>
      {allEquipment.map((item, idx) => {
        const on = checked.includes(item);
        return (
          <div key={item} onClick={() => toggle(item)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', cursor: 'pointer',
            borderBottom: idx < allEquipment.length - 1 ? '1px solid #F3F4F6' : 'none',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${on ? '#10B981' : '#D1D5DB'}`,
              background: on ? '#10B981' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {on && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: on ? '#9CA3AF' : '#374151', textDecoration: on ? 'line-through' : 'none' }}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Dagsplan-oversigt ──────────────────────────────────────────────────────
function DagsPlan({ appointments, totalKm, startTime, onStartTimeChange, homeAddress, endAddress }) {
  if (appointments.length === 0) return null;
  const totalWorkMin = appointments.reduce((s, a) => s + (a.duration || 0), 0);
  const totalTravelMin = Math.round(totalKm * 2); // ~30 km/h → 2 min/km
  const totalMin = totalWorkMin + totalTravelMin;
  const endTime = addMinutes(startTime, totalMin);

  const routeAddrs = [
    homeAddress,
    ...appointments.map(a => a.customer?.address || a.address).filter(Boolean),
    endAddress || homeAddress,
  ];
  const mapsUrl = routeAddrs.length >= 3
    ? `https://www.google.com/maps/dir/${routeAddrs.map(a => encodeURIComponent(a)).join('/')}`
    : null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
        📋 Dagsplan
      </div>

      {/* Starttid */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>Start</span>
        <input
          type="time"
          value={startTime}
          onChange={e => onStartTimeChange(e.target.value)}
          style={{ fontSize: 18, fontWeight: 800, color: '#2563EB', background: '#EFF6FF', borderRadius: 8, padding: '4px 10px', border: 'none' }}
        />
      </div>

      {/* Tid-rækker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Arbejde</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>{formatDuration(totalWorkMin)}</div>
        </div>
        {totalKm > 0 && (
          <div style={{ flex: 1, background: '#FFF7ED', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Kørsel</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B' }}>{formatDuration(totalTravelMin)}</div>
          </div>
        )}
        <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#2563EB' }}>{formatDuration(totalMin)}</div>
        </div>
      </div>

      {/* Sluttid */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', marginBottom: mapsUrl ? 10 : 0 }}>
        <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 600 }}>Forventet slut</span>
        <span style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>{endTime}</span>
      </div>

      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          🗺 Se hele ruten i Google Maps
        </a>
      )}
    </div>
  );
}

// ── Hoved-komponent ────────────────────────────────────────────────────────
export default function MinDag() {
  const location = useLocation();
  const [homeAddress, setHomeAddress] = useState(() => localStorage.getItem(HOME_KEY) || DEFAULT_HOME);
  const [editingHome, setEditingHome] = useState(false);
  const [tempHome, setTempHome] = useState('');
  const [endAddress, setEndAddress] = useState(() => localStorage.getItem(END_KEY) || '');
  const [editingEnd, setEditingEnd] = useState(false);
  const [tempEnd, setTempEnd] = useState('');
  const [startTime, setStartTime] = useState(() => localStorage.getItem(STARTTIME_KEY) || '08:00');

  const [selectedDate, setSelectedDate] = useState(() => {
    if (location.state?.date) {
      const d = new Date(location.state.date); d.setHours(0,0,0,0); return d;
    }
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [showCal, setShowCal] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalKm, setTotalKm] = useState(0);
  const [homeReturnKm, setHomeReturnKm] = useState(0);

  const nowDay = new Date(); nowDay.setHours(0, 0, 0, 0);
  const isToday = selectedDate.getTime() === nowDay.getTime();

  const dayLabel = selectedDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  const prevDay = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  const nextDay = () => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });

  const saveStartTime = (t) => {
    setStartTime(t);
    localStorage.setItem(STARTTIME_KEY, t);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const allAppts = getAppointments();
    const customers = getCustomers();
    const custMap = Object.fromEntries(customers.map(c => [c.id, c]));

    const dayAppts = allAppts
      .filter(a => occursOnDate(a, selectedDate))
      .map(a => ({ ...a, customer: custMap[a.customerId] || null }));

    if (dayAppts.length === 0) {
      setAppointments([]);
      setTotalKm(0);
      setHomeReturnKm(0);
      setLoading(false);
      return;
    }

    const effectiveEnd = endAddress.trim() || homeAddress;
    const [homeCoords, endCoords, ...apptCoords] = await Promise.all([
      geocode(homeAddress),
      geocode(effectiveEnd),
      ...dayAppts.map(a => geocode(a.customer?.address || a.address)),
    ]);

    const enriched = dayAppts.map((a, i) => ({ ...a, coords: apptCoords[i] }));

    if (!homeCoords) {
      setAppointments(enriched.map(a => ({ ...a, distFromPrev: null })).sort((a, b) => new Date(a.date) - new Date(b.date)));
      setTotalKm(0);
      setHomeReturnKm(0);
      setLoading(false);
      return;
    }

    const routed = nearestNeighborRoute(homeCoords, enriched);
    const routedKm = routed.reduce((sum, a) => sum + (a.distFromPrev || 0), 0);
    const lastWithCoords = [...routed].reverse().find(a => a.coords);
    const effectiveEndCoords = endCoords || homeCoords;
    const returnKm = lastWithCoords
      ? haversine(lastWithCoords.coords.lat, lastWithCoords.coords.lng, effectiveEndCoords.lat, effectiveEndCoords.lng)
      : 0;
    setHomeReturnKm(returnKm);
    setTotalKm(routedKm + returnKm);
    setAppointments(routed);
    setLoading(false);
  }, [homeAddress, endAddress, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const saveHome = () => {
    localStorage.setItem(HOME_KEY, tempHome.trim());
    setHomeAddress(tempHome.trim());
    setEditingHome(false);
  };

  const saveEnd = () => {
    localStorage.setItem(END_KEY, tempEnd.trim());
    setEndAddress(tempEnd.trim());
    setEditingEnd(false);
  };

  const clearEnd = () => {
    localStorage.removeItem(END_KEY);
    setEndAddress('');
    setEditingEnd(false);
  };

  // Beregn dage med aftaler (til kalender-dots)
  const markedDates = useMemo(() => {
    if (!showCal) return null;
    const allAppts = getAppointments();
    const marked = new Set();
    // Tre måneder rundt om valgt dato
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    const end   = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 2, 0);
    const d = new Date(start);
    while (d <= end) {
      if (allAppts.some(a => occursOnDate(a, d))) marked.add(toDateStr(d));
      d.setDate(d.getDate() + 1);
    }
    return marked;
  }, [showCal, selectedDate]);

  // Kalender-portal
  const calPortal = showCal && createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) setShowCal(false); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#F9FAFB', borderRadius: '20px 20px 0 0', width: '100%', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Vælg dato</span>
          <button onClick={() => setShowCal(false)} style={{ fontSize: 26, color: '#6B7280', lineHeight: 1 }}>×</button>
        </div>
        <CalendarPicker value={selectedDate} onChange={d => { setSelectedDate(d); setShowCal(false); }} markedDates={markedDates} />
      </div>
    </div>,
    document.body
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#2563EB', padding: '18px 20px 44px', paddingTop: 'calc(18px + env(safe-area-inset-top))' }}>
        {/* Dato-navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={prevDay} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 28, lineHeight: 1, padding: '0 6px' }}>‹</button>
          <button onClick={() => setShowCal(v => !v)} style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
            {isToday ? '📅 I dag — ' : '📅 '}{dayLabel}
          </button>
          <button onClick={nextDay} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 28, lineHeight: 1, padding: '0 6px' }}>›</button>
        </div>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>
          {loading ? 'Beregner rute...' : appointments.length === 0
            ? (isToday ? 'Fri dag!' : 'Ingen aftaler')
            : `${appointments.length} aftale${appointments.length !== 1 ? 'r' : ''}`}
        </div>
        {!loading && appointments.length > 0 && totalKm > 0 && (
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
            🚗 Ca. {totalKm.toFixed(1)} km samlet køredistance
          </div>
        )}
      </div>

      {/* Bopæl-kort */}
      <div style={{ margin: '-20px 16px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 14px rgba(0,0,0,0.10)' }}>
          {/* Start */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Start
          </div>
          {editingHome ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input autoFocus
                style={{ flex: 1, fontSize: 14, borderBottom: '2px solid #2563EB', paddingBottom: 4, color: '#111827' }}
                value={tempHome} onChange={e => setTempHome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveHome(); if (e.key === 'Escape') setEditingHome(false); }}
              />
              <button onClick={saveHome} style={{ color: '#2563EB', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>Gem</button>
              <button onClick={() => setEditingHome(false)} style={{ color: '#9CA3AF', fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏠</span>
              <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{homeAddress}</span>
              <button onClick={() => { setTempHome(homeAddress); setEditingHome(true); }}
                style={{ color: '#9CA3AF', fontSize: 13, flexShrink: 0 }}>Skift</button>
            </div>
          )}

          {/* Slut */}
          <div style={{ borderTop: '1px solid #F3F4F6', margin: '10px 0 6px' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Slut
          </div>
          {editingEnd ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input autoFocus placeholder="Adresse…"
                style={{ flex: 1, fontSize: 14, borderBottom: '2px solid #2563EB', paddingBottom: 4, color: '#111827' }}
                value={tempEnd} onChange={e => setTempEnd(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEnd(); if (e.key === 'Escape') setEditingEnd(false); }}
              />
              <button onClick={saveEnd} style={{ color: '#2563EB', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>Gem</button>
              {endAddress && <button onClick={clearEnd} style={{ color: '#EF4444', fontSize: 14, flexShrink: 0 }}>Ryd</button>}
              <button onClick={() => setEditingEnd(false)} style={{ color: '#9CA3AF', fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏁</span>
              <span style={{ flex: 1, fontSize: 14, color: endAddress ? '#374151' : '#9CA3AF' }}>
                {endAddress || 'Samme som start'}
              </span>
              <button onClick={() => { setTempEnd(endAddress); setEditingEnd(true); }}
                style={{ color: '#9CA3AF', fontSize: 13, flexShrink: 0 }}>Skift</button>
            </div>
          )}
        </div>
      </div>

      {/* Indhold */}
      <div style={{ padding: '12px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ fontWeight: 500 }}>Beregner optimal rute...</div>
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>☀️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>{isToday ? 'Fri dag!' : 'Ingen aftaler'}</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>Ingen aftaler planlagt {isToday ? 'i dag' : 'denne dag'}</div>
          </div>
        ) : (
          <>
            <DagsPlan appointments={appointments} totalKm={totalKm} startTime={startTime} onStartTimeChange={saveStartTime} homeAddress={homeAddress} endAddress={endAddress} />
            <PackingList appointments={appointments} date={selectedDate} />
            {appointments.map((a, i) => (
              <AppCard key={a.id} appt={a} index={i} isFirst={i === 0} isLast={i === appointments.length - 1 && homeReturnKm === 0} date={selectedDate} />
            ))}
            {homeReturnKm > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: '#6B7280', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {endAddress ? '🏁' : '🏠'}
                  </div>
                </div>
                <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 14, padding: '12px 14px', marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>{endAddress ? 'Slut destination' : 'Hjem'}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{endAddress || homeAddress}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FFF7ED', borderRadius: 8, padding: '3px 10px', marginTop: 8 }}>
                    <span style={{ fontSize: 12 }}>🚗</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>~{homeReturnKm.toFixed(1)} km retur</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {calPortal}
    </div>
  );
}

// ── Foto-komprimering ──────────────────────────────────────────────────────
async function compressPhoto(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1000;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Aftale-kort ────────────────────────────────────────────────────────────
function AppCard({ appt, index, isFirst, isLast, date }) {
  const addr = appt.customer?.address || appt.address;
  const mapsUrl = addr ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}` : null;
  const color = getApptColor(appt);

  const dayKey = getDayKey(appt.id, date);

  const [completed, setCompleted] = useState(() => getDayRecords()[dayKey]?.completed || false);
  const [timerSeconds, setTimerSeconds] = useState(() => getDayRecords()[dayKey]?.timerSeconds || 0);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const [photos, setPhotos] = useState(() => getApptPhotos(appt.id));
  const [lightbox, setLightbox] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const toggleComplete = () => {
    const v = !completed;
    setCompleted(v);
    saveDayRecords({ ...getDayRecords(), [dayKey]: { ...getDayRecords()[dayKey], completed: v } });
  };

  const startTimer = () => {
    startTimeRef.current = Date.now() - timerSeconds * 1000;
    setTimerRunning(true);
    intervalRef.current = setInterval(() => {
      setTimerSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setTimerSeconds(elapsed);
    saveDayRecords({ ...getDayRecords(), [dayKey]: { ...getDayRecords()[dayKey], timerSeconds: elapsed } });
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
    setTimerSeconds(0);
    saveDayRecords({ ...getDayRecords(), [dayKey]: { ...getDayRecords()[dayKey], timerSeconds: 0 } });
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await compressPhoto(file);
    const updated = [...photos, { id: newId(), date: new Date().toISOString(), dataUrl }];
    try { saveApptPhotos(appt.id, updated); setPhotos(updated); }
    catch { alert('Ikke nok lagerplads til foto.'); }
    e.target.value = '';
  };

  const deletePhoto = (pid) => {
    const updated = photos.filter(p => p.id !== pid);
    saveApptPhotos(appt.id, updated);
    setPhotos(updated);
    if (lightbox) setLightbox(null);
  };

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
      {/* Tidslinje */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          background: completed ? '#10B981' : color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: completed ? 20 : 15, fontWeight: 800, flexShrink: 0, zIndex: 1,
        }}>
          {completed ? '✓' : index + 1}
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, background: '#E5E7EB', margin: '4px 0', minHeight: 20 }} />}
      </div>

      {/* Kortindhold */}
      <div style={{
        flex: 1, background: completed ? '#F0FDF4' : '#fff',
        borderRadius: 14, padding: 14, marginBottom: 10,
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)', opacity: completed ? 0.85 : 1,
        borderLeft: `3px solid ${completed ? '#10B981' : color}`,
      }}>
        {appt.distFromPrev != null && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F0FDF4', borderRadius: 8, padding: '3px 10px', marginBottom: 10 }}>
            <span style={{ fontSize: 12 }}>🚗</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
              {isFirst ? 'Fra bopæl: ' : 'Fra forrige: '}~{appt.distFromPrev.toFixed(1)} km
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: completed ? '#6B7280' : '#111827', flex: 1, textDecoration: completed ? 'line-through' : 'none' }}>
            {appt.title}
          </div>
          {appt.duration > 0 && (
            <div style={{ background: '#F0FDF4', color: '#10B981', fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>
              ⏱ {formatDuration(appt.duration)}
            </div>
          )}
        </div>

        {formatRecurrence(appt) && (
          <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>🔁 {formatRecurrence(appt)}</div>
        )}
        {appt.customer
          ? <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>👤 {appt.customer.name}</div>
          : !appt.customerId && <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>📋 Enkeltopgave</div>
        }
        {appt.price > 0 && (
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 700, marginTop: 4 }}>💰 {appt.price.toLocaleString('da-DK')} kr</div>
        )}
        {addr ? (
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, display: 'flex', gap: 4 }}>
            <span style={{ flexShrink: 0 }}>📍</span><span>{addr}</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4, fontStyle: 'italic' }}>
            Ingen adresse – kan ikke beregne afstand
          </div>
        )}
        {appt.notes && (
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, fontStyle: 'italic', borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
            {appt.notes}
          </div>
        )}

        {/* Stopur */}
        <div style={{ marginTop: 12, background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: timerRunning ? color : '#374151', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
              {fmtTimer(timerSeconds)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {timerRunning ? (
                <button onClick={stopTimer} style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700 }}>⏸ Stop</button>
              ) : (
                <button onClick={startTimer} style={{ background: '#EFF6FF', color: color, borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700 }}>▶ Start</button>
              )}
              {timerSeconds > 0 && !timerRunning && (
                <button onClick={resetTimer} style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700 }}>✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Fotos */}
        <div style={{ marginTop: 10, borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: photos.length > 0 ? 8 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              📷 Dokumentation{photos.length > 0 ? ` (${photos.length})` : ''}
            </div>
            <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 13, color: color, fontWeight: 700 }}>
              + Tilføj foto
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
          </div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {photos.map(ph => (
                <div key={ph.id} style={{ position: 'relative' }} onClick={() => setLightbox(ph)}>
                  <img src={ph.dataUrl} alt="" style={{ width: 76, height: 76, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Handlingsknapper */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {mapsUrl && (
            <a href={mapsUrl} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: color, color: '#fff', borderRadius: 10,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>🧭 Naviger</a>
          )}
          <button onClick={toggleComplete} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: completed ? '#10B981' : '#F0FDF4',
            color: completed ? '#fff' : '#10B981',
            borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700,
          }}>
            {completed ? '✓ Gennemført' : '○ Marker færdig'}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && createPortal(
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <img src={lightbox.dataUrl} alt="" style={{ maxWidth: '95vw', maxHeight: '80vh', borderRadius: 10, objectFit: 'contain' }} />
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button onClick={(e) => { e.stopPropagation(); deletePhoto(lightbox.id); }}
              style={{ background: '#EF4444', color: '#fff', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700 }}>
              🗑 Slet foto
            </button>
            <button onClick={() => setLightbox(null)}
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700 }}>
              Luk
            </button>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 10 }}>
            {new Date(lightbox.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
