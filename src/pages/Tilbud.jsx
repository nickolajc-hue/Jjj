import React, { useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar.jsx';

// ── Vinduespriser fra prisliste ────────────────────────────────────────────
const WINDOW_TIERS = [
  { min: 0,   max: 79,  price: 150 },
  { min: 80,  max: 109, price: 163 },
  { min: 110, max: 139, price: 173 },
  { min: 140, max: 169, price: 183 },
  { min: 170, max: 199, price: 209 },
  { min: 200, max: 229, price: 229 },
  { min: 230, max: 249, price: 260 },
];

function calcWindowPrice(m2) {
  return WINDOW_TIERS.find(t => m2 >= t.min && m2 <= t.max) || null;
}

function calcAreaM2(pts) {
  if (pts.length < 3) return 0;
  const R = 6371000;
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dLng = (pts[j].lng - pts[i].lng) * (Math.PI / 180);
    const lat1 = pts[i].lat * (Math.PI / 180);
    const lat2 = pts[j].lat * (Math.PI / 180);
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((area * R * R) / 2);
}

function fmt(n, decimals = 0) {
  return n.toLocaleString('da-DK', { maximumFractionDigits: decimals });
}

export default function Tilbud() {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const drawLayerRef = useRef(null);
  const pointsRef = useRef([]);

  const [serviceType, setServiceType] = useState('grass'); // 'grass' | 'window'
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [area, setArea] = useState(null);
  const [manualM2, setManualM2] = useState('');

  // Græs-parametre
  const [speed, setSpeed] = useState('45');
  const [rate, setRate] = useState('10');
  const [setupTime, setSetupTime] = useState('10');
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // ── Init Leaflet ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const init = () => {
      if (!mapDivRef.current || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapDivRef.current, { center: [56.26, 9.50], zoom: 7 });
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri', maxZoom: 20, maxNativeZoom: 19 }
      ).addTo(map);
      drawLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    };
    if (window.L) { init(); }
    else {
      const s = document.createElement('script');
      s.id = 'leaflet-js';
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    }
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // ── Tegnetilstand ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (drawing) { map.dragging.disable(); map.doubleClickZoom.disable(); }
    else { map.dragging.enable(); map.doubleClickZoom.enable(); }
    const onClick = (e) => {
      if (!drawing) return;
      const L = window.L;
      const pts = [...pointsRef.current, e.latlng];
      pointsRef.current = pts;
      setPointCount(pts.length);
      const layer = drawLayerRef.current;
      layer.clearLayers();
      pts.forEach(p => L.circleMarker(p, { radius: 7, color: '#fff', fillColor: '#2563EB', fillOpacity: 1, weight: 2.5 }).addTo(layer));
      if (pts.length >= 2) L.polyline([...pts, pts[0]], { color: '#2563EB', weight: 2, dashArray: '6,5' }).addTo(layer);
      if (pts.length >= 3) L.polygon(pts, { color: '#2563EB', weight: 2, fillColor: '#2563EB', fillOpacity: 0.18 }).addTo(layer);
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [drawing]);

  // ── GPS-lokation ─────────────────────────────────────────────────────────
  const useGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true); setGpsError(false); setNotFound(false);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        try {
          mapRef.current?.setView([lat, lng], 19);
          const res = await fetch(
            `https://api.dataforsyningen.dk/adgangsadresser/reverse?x=${lng}&y=${lat}&format=json`
          );
          const d = await res.json();
          if (d?.vejnavn) {
            setAddress(`${d.vejnavn} ${d.husnr}, ${d.postnr} ${d.postnrnavn}`);
          }
        } catch {}
        setGpsLoading(false);
      },
      () => { setGpsLoading(false); setGpsError(true); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Adressesøgning ───────────────────────────────────────────────────────
  const searchAddress = async () => {
    if (!address.trim()) return;
    setSearching(true); setNotFound(false);
    try {
      const res = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(address)}&format=json&per_side=1`);
      const data = await res.json();
      if (data.length > 0) {
        const [lng, lat] = data[0].adgangsadresse.adgangspunkt.koordinater;
        mapRef.current?.setView([lat, lng], 19);
      } else { setNotFound(true); }
    } catch { setNotFound(true); }
    finally { setSearching(false); }
  };

  const startDrawing = () => { clearDrawing(); setDrawing(true); };
  const finishDrawing = () => {
    const pts = pointsRef.current;
    if (pts.length >= 3) { const m = calcAreaM2(pts); setArea(m); setManualM2(Math.round(m).toString()); }
    setDrawing(false);
    mapRef.current?.dragging.enable(); mapRef.current?.doubleClickZoom.enable();
  };
  const clearDrawing = () => {
    pointsRef.current = []; setPointCount(0); setArea(null); setManualM2('');
    drawLayerRef.current?.clearLayers(); setDrawing(false);
    mapRef.current?.dragging.enable(); mapRef.current?.doubleClickZoom.enable();
  };

  // ── Prisberegning (græs) ─────────────────────────────────────────────────
  const m2Val     = parseFloat(manualM2) || 0;
  const speedN    = parseFloat(speed) || 45;
  const rateN     = parseFloat(rate) || 10;
  const setupN    = parseFloat(setupTime) || 10;
  const mowingMin = m2Val > 0 ? m2Val / speedN : 0;
  const extraMin  = isNewCustomer ? setupN : 0;
  const totalMin  = mowingMin + extraMin;
  const grassPrice = totalMin * rateN;

  // ── Prisberegning (vindue) ───────────────────────────────────────────────
  const windowTier = m2Val > 0 ? calcWindowPrice(m2Val) : null;
  const overMax    = m2Val > 249;

  const SecTitle = ({ children }) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{children}</div>
  );
  const SmallInput = ({ value, onChange, suffix, label }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '8px 10px', gap: 4 }}>
        <input style={{ flex: 1, fontSize: 15, fontWeight: 700, background: 'transparent', width: 0 }}
          type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} />
        <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{suffix}</span>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar title="Tilbud" />

      {/* Service-type toggle */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 12, padding: 4, gap: 4 }}>
          <button onClick={() => setServiceType('grass')} style={{
            flex: 1, borderRadius: 9, padding: '10px 0', fontSize: 14, fontWeight: 700,
            background: serviceType === 'grass' ? '#fff' : 'transparent',
            color: serviceType === 'grass' ? '#2563EB' : '#6B7280',
            boxShadow: serviceType === 'grass' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            transition: 'all 0.15s',
          }}>
            🌿 Græsslåning
          </button>
          <button onClick={() => setServiceType('window')} style={{
            flex: 1, borderRadius: 9, padding: '10px 0', fontSize: 14, fontWeight: 700,
            background: serviceType === 'window' ? '#fff' : 'transparent',
            color: serviceType === 'window' ? '#2563EB' : '#6B7280',
            boxShadow: serviceType === 'window' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            transition: 'all 0.15s',
          }}>
            🪟 Vinduespuds
          </button>
        </div>
      </div>

      {/* Adresse */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', gap: 8 }}>
            <span>📍</span>
            <input style={{ flex: 1, fontSize: 15 }} placeholder="Adresse, postnr, by..."
              value={address} onChange={e => { setAddress(e.target.value); setNotFound(false); }}
              onKeyDown={e => e.key === 'Enter' && searchAddress()} />
            {address && <button onClick={() => setAddress('')} style={{ color: '#9CA3AF', fontSize: 18 }}>×</button>}
          </div>
          <button onClick={useGPS} disabled={gpsLoading}
            title="Brug min placering"
            style={{ background: '#F0FDF4', color: '#10B981', borderRadius: 12, padding: '0 14px', fontSize: 20, flexShrink: 0, opacity: gpsLoading ? 0.6 : 1 }}>
            {gpsLoading ? '⏳' : '🎯'}
          </button>
          <button onClick={searchAddress} disabled={searching}
            style={{ background: '#2563EB', color: '#fff', borderRadius: 12, padding: '0 18px', fontSize: 14, fontWeight: 700, flexShrink: 0, opacity: searching ? 0.7 : 1 }}>
            {searching ? '...' : 'Find'}
          </button>
        </div>
        {notFound && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 6 }}>Adressen blev ikke fundet.</div>}
        {gpsError && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 6 }}>GPS-adgang nægtet — tjek telefonens indstillinger.</div>}
      </div>

      {/* Kort */}
      <div style={{ position: 'relative', margin: '12px 16px 0' }}>
        <div ref={mapDivRef} style={{ height: '38vh', borderRadius: 14, overflow: 'hidden', background: '#E5E7EB' }} />
        {drawing && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(37,99,235,0.92)', color: '#fff', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, zIndex: 1000, whiteSpace: 'nowrap' }}>
            ✏️ Tryk på kortet ({pointCount} punkter)
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', gap: 8, zIndex: 1000 }}>
          {!drawing && (
            <button onClick={startDrawing} style={{ flex: 1, background: '#2563EB', color: '#fff', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 10px rgba(37,99,235,0.45)' }}>
              ✏️ Tegn areal
            </button>
          )}
          {drawing && pointCount < 3 && (
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 10, padding: '11px 0', fontSize: 13, textAlign: 'center' }}>
              Marker mindst 3 punkter
            </div>
          )}
          {drawing && pointCount >= 3 && (
            <button onClick={finishDrawing} style={{ flex: 1, background: '#10B981', color: '#fff', borderRadius: 10, padding: '11px 0', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 10px rgba(16,185,129,0.45)' }}>
              ✓ Afslut tegning
            </button>
          )}
          {(drawing || pointCount > 0) && (
            <button onClick={clearDrawing} style={{ background: '#EF4444', color: '#fff', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 700 }}>Ryd</button>
          )}
        </div>
      </div>

      {/* Areal */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <SecTitle>{serviceType === 'window' ? 'Vinduesareal' : 'Areal'}</SecTitle>
        {area != null && (
          <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📐</span>
            <span style={{ fontSize: 14, color: '#2563EB', fontWeight: 600 }}>Beregnet fra tegning: {fmt(Math.round(area))} m²</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', gap: 6 }}>
          <input style={{ flex: 1, fontSize: 26, fontWeight: 800, color: '#111827', background: 'transparent', width: 0 }}
            type="number" inputMode="decimal" value={manualM2}
            onChange={e => setManualM2(e.target.value)} placeholder="0" />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#6B7280' }}>m²</span>
        </div>
      </div>

      {/* ══ VINDUESPUDSNING ══════════════════════════════════════════════════ */}
      {serviceType === 'window' && m2Val > 0 && (
        <>
          {/* Prisliste */}
          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <SecTitle>Prisliste — fast aftale hver 4. uge</SecTitle>
            {WINDOW_TIERS.map(tier => {
              const isActive = m2Val >= tier.min && m2Val <= tier.max;
              return (
                <div key={tier.max} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                  background: isActive ? '#EFF6FF' : '#F9FAFB',
                  border: isActive ? '2px solid #2563EB' : '2px solid transparent',
                }}>
                  <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 400, color: isActive ? '#1D4ED8' : '#6B7280' }}>
                    {tier.min}–{tier.max} m²
                  </span>
                  <span style={{ fontSize: 15, fontWeight: isActive ? 900 : 600, color: isActive ? '#2563EB' : '#9CA3AF' }}>
                    {tier.price} kr
                  </span>
                </div>
              );
            })}
            {overMax && (
              <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
                <span style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                  Over 249 m² — kontakt for samlet pris
                </span>
              </div>
            )}
          </div>

          {/* Pris-resultat */}
          {windowTier && (
            <div style={{ margin: '12px 16px 0', background: '#2563EB', borderRadius: 14, padding: 20, boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Pris pr. gang — inkl. moms
              </div>
              <div style={{ color: '#fff', fontSize: 48, fontWeight: 900, lineHeight: 1.1 }}>
                {windowTier.price} kr
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 8 }}>
                {fmt(m2Val)} m² · fast aftale hver 4. uge · {windowTier.min}–{windowTier.max} m² trin
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ GRÆSSLÅNING ═════════════════════════════════════════════════════ */}
      {serviceType === 'grass' && (
        <>
          {/* Kundetype */}
          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <SecTitle>Kundetype</SecTitle>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setIsNewCustomer(true)} style={{
                flex: 1, borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 700, border: '2px solid',
                borderColor: isNewCustomer ? '#2563EB' : '#E5E7EB',
                background: isNewCustomer ? '#EFF6FF' : '#F9FAFB',
                color: isNewCustomer ? '#2563EB' : '#6B7280',
              }}>
                🆕 Ny kunde
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.8 }}>+{setupN} min opstilling</div>
              </button>
              <button onClick={() => setIsNewCustomer(false)} style={{
                flex: 1, borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 700, border: '2px solid',
                borderColor: !isNewCustomer ? '#2563EB' : '#E5E7EB',
                background: !isNewCustomer ? '#EFF6FF' : '#F9FAFB',
                color: !isNewCustomer ? '#2563EB' : '#6B7280',
              }}>
                🔄 Eksisterende
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.8 }}>Ingen opstilling</div>
              </button>
            </div>
          </div>

          {/* Tidsberegning */}
          {m2Val > 0 && grassPrice > 0 && (
            <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <SecTitle>Tidsberegning</SecTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Row label="Slåtid" value={`${fmt(mowingMin, 1)} min`} sub={`${fmt(m2Val)} m² ÷ ${fmt(speedN)} m²/min`} />
                {isNewCustomer && <Row label="Trailer på/af" value={`+ ${fmt(extraMin)} min`} sub="Ny kunde tillæg" accent />}
                <Row label="Total tid" value={`${fmt(totalMin, 1)} min`} bold />
              </div>
            </div>
          )}

          {/* Totalpris */}
          {m2Val > 0 && grassPrice > 0 && (
            <div style={{ margin: '12px 16px 0', background: '#2563EB', borderRadius: 14, padding: 20, boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Samlet tilbudspris
              </div>
              <div style={{ color: '#fff', fontSize: 42, fontWeight: 900, lineHeight: 1.1 }}>
                {grassPrice.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 8 }}>
                {fmt(totalMin, 1)} min × {fmt(rateN)} kr/min
              </div>
            </div>
          )}

          {/* Indstillinger */}
          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <button onClick={() => setShowSettings(s => !s)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'none', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              <span>⚙️ Juster parametre</span>
              <span style={{ color: '#9CA3AF', fontSize: 18, transform: showSettings ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
            </button>
            {showSettings && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <SmallInput label="Hastighed" value={speed} onChange={setSpeed} suffix="m²/min" />
                  <SmallInput label="Minutpris" value={rate} onChange={setRate} suffix="kr/min" />
                  <SmallInput label="Opstilling" value={setupTime} onChange={setSetupTime} suffix="min" />
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10, lineHeight: 1.5 }}>
                  Hastighed: m² pr. minut · Minutpris: din timepris ÷ 60 · Opstilling: trailer på/af
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, sub, accent, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F9FAFB' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: accent ? '#F59E0B' : '#374151' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: bold ? 800 : 600, color: accent ? '#F59E0B' : bold ? '#111827' : '#6B7280' }}>
        {value}
      </div>
    </div>
  );
}
