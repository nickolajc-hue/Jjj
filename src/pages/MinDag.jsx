import React, { useState, useEffect, useCallback } from 'react';
import { getAppointments, getCustomers } from '../storage.js';

const HOME_KEY = 'kundeapp_home_address';
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
// Returnerer aftaler i optimal rækkefølge fra startpunkt
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

  // Aftaler uden adresse til sidst, sorteret efter tidspunkt
  withoutCoords.sort((a, b) => new Date(a.date) - new Date(b.date));
  return [...route, ...withoutCoords.map(a => ({ ...a, distFromPrev: null }))];
}

export default function MinDag() {
  const [homeAddress, setHomeAddress] = useState(
    () => localStorage.getItem(HOME_KEY) || DEFAULT_HOME
  );
  const [editingHome, setEditingHome] = useState(false);
  const [tempHome, setTempHome] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalKm, setTotalKm] = useState(0);

  const today = new Date();
  const todayLabel = today.toLocaleDateString('da-DK', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // ── Hent og sorter dagens aftaler ────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const allAppts = getAppointments();
    const customers = getCustomers();
    const custMap = Object.fromEntries(customers.map(c => [c.id, c]));

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const todayAppts = allAppts
      .filter(a => { const d = new Date(a.date); return d >= todayStart && d < todayEnd; })
      .map(a => ({ ...a, customer: custMap[a.customerId] || null }));

    if (todayAppts.length === 0) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    // Geocode bopæl og alle kundeadresser parallelt
    const [homeCoords, ...apptCoords] = await Promise.all([
      geocode(homeAddress),
      ...todayAppts.map(a => geocode(a.customer?.address)),
    ]);

    const enriched = todayAppts.map((a, i) => ({ ...a, coords: apptCoords[i] }));

    if (!homeCoords) {
      // Kan ikke beregne rute – sorter på tidspunkt
      setAppointments(enriched.map(a => ({ ...a, distFromPrev: null })).sort((a, b) => new Date(a.date) - new Date(b.date)));
      setLoading(false);
      return;
    }

    const routed = nearestNeighborRoute(homeCoords, enriched);
    const km = routed.reduce((sum, a) => sum + (a.distFromPrev || 0), 0);
    setTotalKm(km);
    setAppointments(routed);
    setLoading(false);
  }, [homeAddress]);

  useEffect(() => { load(); }, [load]);

  const saveHome = () => {
    localStorage.setItem(HOME_KEY, tempHome.trim());
    setHomeAddress(tempHome.trim());
    setEditingHome(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#2563EB', padding: '18px 20px 44px', paddingTop: 'calc(18px + env(safe-area-inset-top))' }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, textTransform: 'capitalize', marginBottom: 4 }}>
          {todayLabel}
        </div>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>
          {loading ? 'Beregner rute...' : appointments.length === 0 ? 'Fri dag!' : `${appointments.length} aftale${appointments.length !== 1 ? 'r' : ''} i dag`}
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
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Start / bopæl
          </div>
          {editingHome ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                autoFocus
                style={{ flex: 1, fontSize: 14, borderBottom: '2px solid #2563EB', paddingBottom: 4, color: '#111827' }}
                value={tempHome}
                onChange={e => setTempHome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveHome(); if (e.key === 'Escape') setEditingHome(false); }}
              />
              <button onClick={saveHome} style={{ color: '#2563EB', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>Gem</button>
              <button onClick={() => setEditingHome(false)} style={{ color: '#9CA3AF', fontSize: 14, flexShrink: 0 }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🏠</span>
              <span style={{ flex: 1, fontSize: 14, color: '#374151' }}>{homeAddress}</span>
              <button
                onClick={() => { setTempHome(homeAddress); setEditingHome(true); }}
                style={{ color: '#9CA3AF', fontSize: 13, flexShrink: 0 }}
              >Skift</button>
            </div>
          )}
        </div>
      </div>

      {/* Aftaler */}
      <div style={{ padding: '14px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div style={{ fontWeight: 500 }}>Beregner optimal rute...</div>
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>☀️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>Fri dag!</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>Ingen aftaler planlagt i dag</div>
          </div>
        ) : (
          appointments.map((a, i) => (
            <AppCard key={a.id} appt={a} index={i} isFirst={i === 0} isLast={i === appointments.length - 1} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Aftale-kort ────────────────────────────────────────────────────────────
function AppCard({ appt, index, isFirst, isLast }) {
  const time = new Date(appt.date).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  const addr = appt.customer?.address;
  const mapsUrl = addr
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(addr)}&dirflg=d`
    : null;

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 0 }}>
      {/* Tidslinje */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          background: '#2563EB', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, flexShrink: 0, zIndex: 1,
        }}>
          {index + 1}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: '#E5E7EB', margin: '4px 0', minHeight: 20 }} />
        )}
      </div>

      {/* Kortindhold */}
      <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        {/* Afstand fra forrige */}
        {appt.distFromPrev != null && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F0FDF4', borderRadius: 8, padding: '3px 10px', marginBottom: 10 }}>
            <span style={{ fontSize: 12 }}>🚗</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
              {isFirst ? 'Fra bopæl: ' : 'Fra forrige: '}~{appt.distFromPrev.toFixed(1)} km
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', flex: 1 }}>{appt.title}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#2563EB', flexShrink: 0 }}>{time}</div>
        </div>

        {appt.customer && (
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>👤 {appt.customer.name}</div>
        )}

        {addr ? (
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, display: 'flex', gap: 4 }}>
            <span style={{ flexShrink: 0 }}>📍</span>
            <span>{addr}</span>
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

        {mapsUrl && (
          <a
            href={mapsUrl}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
              background: '#2563EB', color: '#fff', borderRadius: 10,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}
          >
            🧭 Naviger
          </a>
        )}
      </div>
    </div>
  );
}
