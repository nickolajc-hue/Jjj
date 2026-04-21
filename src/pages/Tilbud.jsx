import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { getCustomers, saveCustomers, getAppointments, saveAppointments, getQuotes, saveQuotes, newId } from '../storage.js';

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

// ── Hækkeklip-prismodel ───────────────────────────────────────────────────
const H_SURCHARGE = {
  height:  { '0-200': 0, '201-250': 10, '251-300': 25, '301-350': 35 },
  width:   { '0-50': 0, '51-100': 10, '101-150': 20, '151-200': 30 },
  topCut:  { '0-50': 0, '51-100': 20, '101-150': 25, '151-200': 30 },
  sideCut: { '0-25': 0, '26-50': 20, '51-75': 40, '76-100': 60, '101-125': 80 },
};

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
  const navigate = useNavigate();
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const drawLayerRef = useRef(null);
  const pointsRef = useRef([]);

  const [serviceType, setServiceType] = useState('grass'); // 'grass' | 'window' | 'hedge'
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

  // Hækkeklip
  const [hMeters,    setHMeters]    = useState('');
  const [hService,   setHService]   = useState('standard'); // 'standard'|'side_top'|'both'
  const [hHeight,    setHHeight]    = useState('0-200');
  const [hWidth,     setHWidth]     = useState('0-50');
  const [hTopCut,    setHTopCut]    = useState('0-50');
  const [hSideCut,   setHSideCut]   = useState('0-25');
  const [hDifficult, setHDifficult] = useState(false);
  const [hDiffM,     setHDiffM]     = useState('');
  const [hDebris,    setHDebris]    = useState('yes');

  // Gem tilbud
  const [customers, setCustomers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveCustomerId, setSaveCustomerId] = useState('');
  const [createAppt, setCreateAppt] = useState(false);
  const [apptDate, setApptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [savedMsg, setSavedMsg] = useState(false);
  const [quoteApptOpen, setQuoteApptOpen] = useState(null);
  const [quoteApptDate, setQuoteApptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showNewCust,    setShowNewCust]    = useState(false);
  const [newCustName,    setNewCustName]    = useState('');
  const [newCustPhone,   setNewCustPhone]   = useState('');
  const [newCustAddr,    setNewCustAddr]    = useState('');
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const loadQuotes = () => setQuotes([...getQuotes()].reverse());
  useEffect(() => { setCustomers(getCustomers()); loadQuotes(); }, []);

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

  // ── Prisberegning (hæk) ──────────────────────────────────────────────────
  const hM          = parseFloat(hMeters) || 0;
  const hBase       = hService === 'standard' ? 70 : hService === 'side_top' ? 90 : 120;
  const hHeightAdd  = H_SURCHARGE.height[hHeight]  || 0;
  const hWidthAdd   = H_SURCHARGE.width[hWidth]    || 0;
  const hTopAdd     = H_SURCHARGE.topCut[hTopCut]  || 0;
  const hSideAdd    = H_SURCHARGE.sideCut[hSideCut]|| 0;
  const hPricePerM  = hBase + hHeightAdd + hWidthAdd + hTopAdd + hSideAdd;
  const hDiffFee    = hDifficult ? (parseFloat(hDiffM) || 0) * 50 : 0;
  const hRaw        = hM > 0 ? hM * hPricePerM + hDiffFee : 0;
  const hedgeTotal  = hRaw > 0 ? Math.round(hDebris === 'no' ? hRaw * 0.8 : hRaw) : 0;

  const currentPrice = serviceType === 'grass' ? (m2Val > 0 ? Math.round(grassPrice) : 0)
                     : serviceType === 'window' ? (windowTier?.price || 0)
                     : serviceType === 'hedge'  ? hedgeTotal
                     : 0;

  const saveQuoteAndAppt = () => {
    const label = serviceType === 'grass' ? 'Græsslåning' : serviceType === 'window' ? 'Vinduespudsning' : 'Hækkeklip';
    const cust  = customers.find(c => c.id === saveCustomerId);
    saveQuotes([...getQuotes(), {
      id: newId(),
      type: serviceType,
      createdAt: new Date().toISOString(),
      customerId: saveCustomerId || null,
      totalPrice: currentPrice,
    }]);
    if (createAppt) {
      saveAppointments([...getAppointments(), {
        id: newId(),
        customerId: saveCustomerId || undefined,
        title: cust ? `${label} – ${cust.name}` : label,
        date: apptDate,
        duration: 0,
        recurrence: 'none',
        price: currentPrice,
        color: serviceType === 'grass' ? 'green' : 'blue',
        equipment: serviceType === 'grass' ? ['Plæneklipper'] : [],
        notes: '',
      }]);
    }
    setSavedMsg(true);
    setSaveOpen(false);
    loadQuotes();
    setTimeout(() => setSavedMsg(false), 4000);
  };

  const deleteQuote = (id) => {
    saveQuotes(getQuotes().filter(q => q.id !== id));
    loadQuotes();
  };

  const createApptFromQuote = (q) => {
    const cust = customers.find(c => c.id === q.customerId);
    const label = q.type === 'grass' ? 'Græsslåning' : q.type === 'window' ? 'Vinduespudsning' : 'Hækkeklip';
    saveAppointments([...getAppointments(), {
      id: newId(),
      customerId: q.customerId || undefined,
      title: cust ? `${label} – ${cust.name}` : label,
      date: quoteApptDate,
      duration: 0,
      recurrence: 'none',
      price: q.totalPrice,
      color: q.type === 'grass' ? 'green' : q.type === 'hedge' ? 'teal' : 'blue',
      equipment: q.type === 'grass' ? ['Plæneklipper'] : q.type === 'hedge' ? ['Hækkeklipper'] : [],
      notes: '',
    }]);
    deleteQuote(q.id);
    setQuoteApptOpen(null);
  };

  const createNewCustomer = (onCreated) => {
    if (!newCustName.trim()) return;
    const c = { id: newId(), name: newCustName.trim(), phone: newCustPhone.trim(), address: newCustAddr.trim(), email: '', company: '', notes: '' };
    const updated = [...getCustomers(), c];
    saveCustomers(updated);
    setCustomers(updated);
    onCreated(c.id);
    setNewCustName(''); setNewCustPhone(''); setNewCustAddr('');
    setShowNewCust(false);
  };

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
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 12, padding: 4, gap: 3 }}>
          {[
            { id: 'grass',  label: '🌿 Græs'  },
            { id: 'window', label: '🪟 Vindue' },
            { id: 'hedge',  label: '✂️ Hæk'   },
            { id: 'saved',  label: quotes.length > 0 ? `📋 ${quotes.length}` : '📋 Gemte' },
          ].map(t => (
            <button key={t.id} onClick={() => { setServiceType(t.id); if (t.id === 'saved') loadQuotes(); }} style={{
              flex: 1, borderRadius: 9, padding: '10px 0', fontSize: 12, fontWeight: 700,
              background: serviceType === t.id ? '#fff' : 'transparent',
              color: serviceType === t.id ? '#2563EB' : '#6B7280',
              boxShadow: serviceType === t.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Adresse + kort (kun for græs og vindue) */}
      {serviceType !== 'hedge' && serviceType !== 'saved' && (<>
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

      </>)}

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

      {/* ══ HÆKKEKLIP ════════════════════════════════════════════════════════ */}
      {serviceType === 'hedge' && (
        <>
          {/* Meter-inputs per højde */}
          <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <SecTitle>Antal meter hæk</SecTitle>
            {/* Kolonneoverskrifter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1 }} />
              <div style={{ width: 80, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>1 SIDE</div>
              <div style={{ width: 80, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6B7280' }}>2 SIDER</div>
            </div>
            {HEDGE_TIERS.map(t => {
              const m1 = hedgeM[`${t.id}_1`];
              const m2 = hedgeM[`${t.id}_2`];
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{t.label}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{t.price1} kr/m · {t.price2} kr/m</span>
                      {t.note && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>{t.note}</span>}
                    </div>
                  </div>
                  {/* 1 side input */}
                  <div style={{ width: 80, display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '7px 8px', gap: 3, border: m1 ? '1.5px solid #2563EB' : '1.5px solid transparent' }}>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      value={m1}
                      onChange={e => setHedgeM(prev => ({ ...prev, [`${t.id}_1`]: e.target.value }))}
                      style={{ flex: 1, fontSize: 15, fontWeight: 700, background: 'transparent', textAlign: 'right', width: 0 }}
                    />
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>m</span>
                  </div>
                  {/* 2 sider input */}
                  <div style={{ width: 80, display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '7px 8px', gap: 3, border: m2 ? '1.5px solid #2563EB' : '1.5px solid transparent' }}>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      value={m2}
                      onChange={e => setHedgeM(prev => ({ ...prev, [`${t.id}_2`]: e.target.value }))}
                      style={{ flex: 1, fontSize: 15, fontWeight: 700, background: 'transparent', textAlign: 'right', width: 0 }}
                    />
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>m</span>
                  </div>
                </div>
              );
            })}
            {/* >261 cm */}
            <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>Over 261 cm — kontakt for tilbud</span>
            </div>
          </div>

          {/* Valgfrie tillæg */}
          {klippesum > 0 && (
            <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <SecTitle>Tillæg</SecTitle>

              {/* Torne-/stikhæk */}
              <div style={{ marginBottom: 10 }}>
                <button onClick={() => setTorneTillæg(v => !v)} style={{
                  width: '100%', borderRadius: 10, padding: '11px 14px', marginBottom: torneTillæg ? 8 : 0,
                  background: torneTillæg ? '#EFF6FF' : '#F9FAFB', border: `2px solid ${torneTillæg ? '#2563EB' : 'transparent'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: torneTillæg ? '#2563EB' : '#374151' }}>{torneTillæg ? '✓ ' : ''}Torne-/stikhæk</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Tjørn, berberis m.fl. · +6 kr/m</div>
                  </div>
                  {torneTillæg && torneM && <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>+{fmt((parseFloat(torneM)||0)*6)} kr</span>}
                </button>
                {torneTillæg && (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', gap: 6 }}>
                    <input type="number" inputMode="decimal" placeholder="0" value={torneM} onChange={e => setTorneM(e.target.value)}
                      style={{ flex: 1, fontSize: 16, fontWeight: 700, background: 'transparent' }} />
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>meter</span>
                  </div>
                )}
              </div>

              {/* Forvokset */}
              <div style={{ marginBottom: 10 }}>
                <button onClick={() => setForvokset(v => !v)} style={{
                  width: '100%', borderRadius: 10, padding: '11px 14px',
                  background: forvokset ? '#EFF6FF' : '#F9FAFB', border: `2px solid ${forvokset ? '#2563EB' : 'transparent'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: forvokset ? '#2563EB' : '#374151' }}>{forvokset ? '✓ ' : ''}Forvokset hæk</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Ikke klippet 12–24 mdr · +10% på klippesum</div>
                  </div>
                  {forvokset && <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>+{fmt(forvoksetFee)} kr</span>}
                </button>
              </div>

              {/* Ekstra bred */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>Ekstra bred hæk</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: bredTillæg !== 'none' ? 8 : 0 }}>
                  {[
                    { val: 'none',   label: 'Ingen',        sub: '' },
                    { val: 'medium', label: '1,0–1,5 m',    sub: '+6 kr/m' },
                    { val: 'wide',   label: '> 1,5 m',      sub: '+12 kr/m' },
                  ].map(o => (
                    <button key={o.val} onClick={() => setBredTillæg(o.val)} style={{
                      flex: 1, borderRadius: 10, padding: '9px 6px', fontSize: 12, fontWeight: 700,
                      background: bredTillæg === o.val ? '#EFF6FF' : '#F9FAFB',
                      border: `2px solid ${bredTillæg === o.val ? '#2563EB' : 'transparent'}`,
                      color: bredTillæg === o.val ? '#2563EB' : '#374151',
                    }}>
                      {o.label}
                      {o.sub && <div style={{ fontSize: 10, fontWeight: 500, color: bredTillæg === o.val ? '#60A5FA' : '#9CA3AF', marginTop: 1 }}>{o.sub}</div>}
                    </button>
                  ))}
                </div>
                {bredTillæg !== 'none' && (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', gap: 6 }}>
                    <input type="number" inputMode="decimal" placeholder="0" value={bredM} onChange={e => setBredM(e.target.value)}
                      style={{ flex: 1, fontSize: 16, fontWeight: 700, background: 'transparent' }} />
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>meter</span>
                    {bredM && <span style={{ fontSize: 13, fontWeight: 700, color: '#2563EB' }}>+{fmt(bredFee)} kr</span>}
                  </div>
                )}
              </div>

              {/* Skråning */}
              <div>
                <button onClick={() => setSkraaningTillæg(v => !v)} style={{
                  width: '100%', borderRadius: 10, padding: '11px 14px', marginBottom: skraaningTillæg ? 8 : 0,
                  background: skraaningTillæg ? '#EFF6FF' : '#F9FAFB', border: `2px solid ${skraaningTillæg ? '#2563EB' : 'transparent'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: skraaningTillæg ? '#2563EB' : '#374151' }}>{skraaningTillæg ? '✓ ' : ''}Skråning / svært tilgængeligt</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>+15–30 kr/m</div>
                  </div>
                  {skraaningTillæg && skraaningM && <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB' }}>+{fmt(skraaningFee)} kr</span>}
                </button>
                {skraaningTillæg && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {[15, 20, 25, 30].map(r => (
                        <button key={r} onClick={() => setSkraaningRate(r)} style={{
                          flex: 1, borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700,
                          background: skraaningRate === r ? '#2563EB' : '#F3F4F6',
                          color: skraaningRate === r ? '#fff' : '#374151',
                        }}>{r} kr/m</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', gap: 6 }}>
                      <input type="number" inputMode="decimal" placeholder="0" value={skraaningM} onChange={e => setSkraaningM(e.target.value)}
                        style={{ flex: 1, fontSize: 16, fontWeight: 700, background: 'transparent' }} />
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>meter</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Beregning + totalpris */}
          {hedgeTotal > 0 && (
            <>
              <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <SecTitle>Beregning</SecTitle>
                {hedgeLines.map(l => (
                  <Row key={l.key} label={l.label} value={`${fmt(l.total)} kr`} sub={`${fmt(l.meters, 1)} m × ${l.pricePerM} kr/m`} />
                ))}
                {skammelFee > 0 && <Row label="Skammel (181–210 cm)" value={`+${fmt(skammelFee)} kr`} accent />}
                {stigeFee   > 0 && <Row label="Stige (211–260 cm)"   value={`+${fmt(stigeFee)} kr`} accent />}
                {kørselFee  > 0 && <Row label="Kørsel & opstart"     value={`+${fmt(kørselFee)} kr`} sub={`Klippesum ${fmt(klippesum)} kr`} />}
                {torneFee   > 0 && <Row label={`Torne-/stikhæk (${fmt(parseFloat(torneM)||0,1)} m)`} value={`+${fmt(torneFee)} kr`} />}
                {forvoksetFee>0 && <Row label="Forvokset (+10%)"      value={`+${fmt(forvoksetFee)} kr`} />}
                {bredFee    > 0 && <Row label={`Ekstra bred (${bredTillæg==='medium'?'1,0–1,5 m':'>1,5 m'})`} value={`+${fmt(bredFee)} kr`} />}
                {skraaningFee>0 && <Row label={`Skråning (${skraaningRate} kr/m)`} value={`+${fmt(skraaningFee)} kr`} />}
                {hedgeTotal === 1499 && klippesum + skammelFee + stigeFee + kørselFee + torneFee + forvoksetFee + bredFee + skraaningFee < 1499 && (
                  <Row label="Minimumspris" value="1.499 kr" sub="Gælder pr. opgave" accent />
                )}
                <Row label="Total inkl. moms" value={`${fmt(hedgeTotal)} kr`} bold />
              </div>

              <div style={{ margin: '12px 16px 0', background: '#2563EB', borderRadius: 14, padding: 20, boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Samlet tilbudspris inkl. moms
                </div>
                <div style={{ color: '#fff', fontSize: 48, fontWeight: 900, lineHeight: 1.1 }}>
                  {hedgeTotal.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 8 }}>
                  {hedgeLines.length} {hedgeLines.length === 1 ? 'linje' : 'linjer'} · {hedgeLines.reduce((s, l) => s + l.meters, 0).toFixed(0)} m i alt
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ GEMTE TILBUD ═════════════════════════════════════════════════════ */}
      {serviceType === 'saved' && (
        <div style={{ padding: '12px 16px 0' }}>
          {quotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Ingen gemte tilbud endnu</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Gem et tilbud fra Græs, Vindue eller Hæk</div>
            </div>
          ) : quotes.map(q => {
            const cust     = customers.find(c => c.id === q.customerId);
            const typeIcon  = q.type === 'grass' ? '🌿' : q.type === 'window' ? '🪟' : '✂️';
            const typeLabel = q.type === 'grass' ? 'Græsslåning' : q.type === 'window' ? 'Vinduespudsning' : 'Hækkeklip';
            const isOpen    = quoteApptOpen === q.id;
            return (
              <div key={q.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{typeIcon} {typeLabel}</div>
                    {cust && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>👤 {cust.name}</div>}
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                      {new Date(q.createdAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#2563EB' }}>
                    {q.totalPrice.toLocaleString('da-DK')} kr
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setQuoteApptOpen(isOpen ? null : q.id); setQuoteApptDate(new Date().toISOString().split('T')[0]); }}
                    style={{ flex: 1, background: isOpen ? '#F3F4F6' : '#2563EB', color: isOpen ? '#6B7280' : '#fff', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700 }}
                  >
                    {isOpen ? '× Annuller' : '+ Opret aftale'}
                  </button>
                  <button
                    onClick={() => deleteQuote(q.id)}
                    style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
                  >
                    Slet
                  </button>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, background: '#F9FAFB', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>Aftaledato</div>
                    <input
                      type="date" value={quoteApptDate} onChange={e => setQuoteApptDate(e.target.value)}
                      style={{ width: '100%', fontSize: 15, fontWeight: 600, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #E5E7EB', boxSizing: 'border-box', marginBottom: 10 }}
                    />
                    <button
                      onClick={() => createApptFromQuote(q)}
                      style={{ width: '100%', background: '#10B981', color: '#fff', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}
                    >
                      ✓ Bekræft aftale
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ GEM TILBUD ═══════════════════════════════════════════════════════ */}
      {currentPrice > 0 && serviceType !== 'saved' && (
        <div style={{ padding: '10px 16px 0' }}>
          {savedMsg ? (
            <div style={{ background: '#D1FAE5', borderRadius: 14, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>✅ Gemt!</div>
              {createAppt && <div style={{ fontSize: 13, color: '#059669', marginTop: 4 }}>Aftale oprettet i kalenderen</div>}
            </div>
          ) : (
            <button onClick={() => setSaveOpen(v => !v)} style={{
              width: '100%', borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 700,
              background: saveOpen ? '#F3F4F6' : '#10B981',
              color: saveOpen ? '#6B7280' : '#fff',
              boxShadow: saveOpen ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
            }}>
              {saveOpen ? '× Luk' : '💾 Gem tilbud'}
            </button>
          )}
        </div>
      )}

      {saveOpen && currentPrice > 0 && (
        <div style={{ margin: '8px 16px 16px', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>

          {/* Kunde */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Tilknyt kunde
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 8 }}>
            <button onClick={() => setSaveCustomerId('')} style={{
              padding: '10px 14px', borderRadius: 10, textAlign: 'left', fontSize: 14,
              fontWeight: saveCustomerId === '' ? 700 : 500,
              background: saveCustomerId === '' ? '#EFF6FF' : '#F9FAFB',
              border: `2px solid ${saveCustomerId === '' ? '#2563EB' : 'transparent'}`,
              color: saveCustomerId === '' ? '#2563EB' : '#6B7280',
            }}>Ingen kunde</button>
            {customers.map(c => (
              <button key={c.id} onClick={() => setSaveCustomerId(c.id)} style={{
                padding: '10px 14px', borderRadius: 10, textAlign: 'left', fontSize: 14,
                fontWeight: saveCustomerId === c.id ? 700 : 500,
                background: saveCustomerId === c.id ? '#EFF6FF' : '#F9FAFB',
                border: `2px solid ${saveCustomerId === c.id ? '#2563EB' : 'transparent'}`,
                color: saveCustomerId === c.id ? '#2563EB' : '#374151',
              }}>
                {c.name}
                {c.address && <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 6 }}>{c.address}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setShowNewCust(v => !v)} style={{
            width: '100%', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
            background: showNewCust ? '#F3F4F6' : '#F0FDF4',
            border: `2px solid ${showNewCust ? 'transparent' : '#10B981'}`,
            color: showNewCust ? '#6B7280' : '#059669', fontSize: 14, fontWeight: 700, textAlign: 'left',
          }}>
            {showNewCust ? '× Annuller' : '+ Ny kunde'}
          </button>
          {showNewCust && (
            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input placeholder="Navn *" value={newCustName} onChange={e => setNewCustName(e.target.value)}
                style={{ fontSize: 15, fontWeight: 600, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} />
              <input placeholder="Telefon (valgfrit)" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                inputMode="tel"
                style={{ fontSize: 14, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} />
              <input placeholder="Adresse (valgfrit)" value={newCustAddr} onChange={e => setNewCustAddr(e.target.value)}
                style={{ fontSize: 14, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '2px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} />
              <button onClick={() => createNewCustomer(id => setSaveCustomerId(id))} disabled={!newCustName.trim()} style={{
                background: newCustName.trim() ? '#10B981' : '#E5E7EB', color: newCustName.trim() ? '#fff' : '#9CA3AF',
                borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700,
              }}>Opret kunde</button>
            </div>
          )}

          {/* Opret aftale toggle */}
          <button onClick={() => setCreateAppt(v => !v)} style={{
            width: '100%', borderRadius: 10, padding: '12px 14px', marginBottom: createAppt ? 10 : 14,
            background: createAppt ? '#EFF6FF' : '#F9FAFB',
            border: `2px solid ${createAppt ? '#2563EB' : '#E5E7EB'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: createAppt ? '#2563EB' : '#374151' }}>
                {createAppt ? '✓ ' : ''}Opret aftale direkte
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Tilføj til din kalender med det samme</div>
            </div>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: createAppt ? '#2563EB' : '#E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14,
            }}>
              {createAppt ? '✓' : '+'}
            </div>
          </button>

          {createAppt && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Aftaledato</div>
              <input
                type="date"
                value={apptDate}
                onChange={e => setApptDate(e.target.value)}
                style={{ width: '100%', fontSize: 15, fontWeight: 600, background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', border: '2px solid #E5E7EB', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <button onClick={saveQuoteAndAppt} style={{
            width: '100%', background: '#10B981', color: '#fff', borderRadius: 12,
            padding: '14px 0', fontSize: 15, fontWeight: 700,
            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
          }}>
            ✓ Gem
          </button>
        </div>
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
