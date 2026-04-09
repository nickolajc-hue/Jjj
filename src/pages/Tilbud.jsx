import React, { useState, useEffect, useRef } from 'react';
import TopBar from '../components/TopBar.jsx';

// Spherical excess formula – accurate enough for property-sized polygons
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

export default function Tilbud() {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const drawLayerRef = useRef(null);
  const pointsRef = useRef([]);

  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [area, setArea] = useState(null);
  const [manualM2, setManualM2] = useState('');
  const [pricePerM2, setPricePerM2] = useState('100');

  // ── Init Leaflet map ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const init = () => {
      if (!mapDivRef.current || mapRef.current) return;
      const L = window.L;
      const map = L.map(mapDivRef.current, { center: [56.26, 9.50], zoom: 7 });

      // ESRI World Imagery – aerial/satellite, free, no API key
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 20, maxNativeZoom: 19 }
      ).addTo(map);

      // Optional: add a label overlay so street names are visible
      L.tileLayer(
        'https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png',
        { attribution: '© Stamen', maxZoom: 20, opacity: 0.6 }
      ).addTo(map);

      drawLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    };

    if (window.L) {
      init();
    } else {
      const s = document.createElement('script');
      s.id = 'leaflet-js';
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    }

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // ── Drawing mode: map click → add point ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drawing) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
    }

    const onClick = (e) => {
      if (!drawing) return;
      const L = window.L;
      const pts = [...pointsRef.current, e.latlng];
      pointsRef.current = pts;
      setPointCount(pts.length);

      const layer = drawLayerRef.current;
      layer.clearLayers();

      // Markers
      pts.forEach((p) =>
        L.circleMarker(p, {
          radius: 7, color: '#fff', fillColor: '#2563EB', fillOpacity: 1, weight: 2.5,
        }).addTo(layer)
      );

      // Closing dashed line from last to first
      if (pts.length >= 2) {
        L.polyline([...pts, pts[0]], { color: '#2563EB', weight: 2, dashArray: '6,5' }).addTo(layer);
      }

      // Polygon fill
      if (pts.length >= 3) {
        L.polygon(pts, {
          color: '#2563EB', weight: 2, fillColor: '#2563EB', fillOpacity: 0.18,
        }).addTo(layer);
      }
    };

    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [drawing]);

  // ── Address search via DAWA (gratis dansk adresse-API) ─────────────────
  const searchAddress = async () => {
    if (!address.trim()) return;
    setSearching(true);
    setNotFound(false);
    try {
      const res = await fetch(
        `https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(address)}&format=json&per_side=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const [lng, lat] = data[0].adgangsadresse.adgangspunkt.koordinater;
        mapRef.current?.setView([lat, lng], 19);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const startDrawing = () => {
    clearDrawing();
    setDrawing(true);
  };

  const finishDrawing = () => {
    const pts = pointsRef.current;
    if (pts.length >= 3) {
      const m2 = calcAreaM2(pts);
      setArea(m2);
      setManualM2(Math.round(m2).toString());
    }
    setDrawing(false);
    mapRef.current?.dragging.enable();
    mapRef.current?.doubleClickZoom.enable();
  };

  const clearDrawing = () => {
    pointsRef.current = [];
    setPointCount(0);
    setArea(null);
    setManualM2('');
    drawLayerRef.current?.clearLayers();
    setDrawing(false);
    mapRef.current?.dragging.enable();
    mapRef.current?.doubleClickZoom.enable();
  };

  const m2 = parseFloat(manualM2) || 0;
  const pris = parseFloat(pricePerM2) || 0;
  const total = m2 * pris;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 32 }}>
      <TopBar title="Tilbud" />

      {/* Address */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', gap: 8 }}>
            <span>📍</span>
            <input
              style={{ flex: 1, fontSize: 15 }}
              placeholder="Søgågade 12, 8000 Aarhus..."
              value={address}
              onChange={e => { setAddress(e.target.value); setNotFound(false); }}
              onKeyDown={e => e.key === 'Enter' && searchAddress()}
            />
            {address && <button onClick={() => setAddress('')} style={{ color: '#9CA3AF', fontSize: 18 }}>×</button>}
          </div>
          <button
            onClick={searchAddress}
            disabled={searching}
            style={{ background: '#2563EB', color: '#fff', borderRadius: 12, padding: '0 18px', fontSize: 14, fontWeight: 700, flexShrink: 0, opacity: searching ? 0.7 : 1 }}
          >
            {searching ? '...' : 'Find'}
          </button>
        </div>
        {notFound && (
          <div style={{ color: '#EF4444', fontSize: 13, marginTop: 6, paddingLeft: 4 }}>
            Adressen blev ikke fundet. Prøv at skrive mere præcist.
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ position: 'relative', margin: '12px 16px 0' }}>
        <div
          ref={mapDivRef}
          style={{ height: '42vh', borderRadius: 14, overflow: 'hidden', background: '#E5E7EB' }}
        />

        {/* Drawing badge */}
        {drawing && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(37,99,235,0.92)', color: '#fff', borderRadius: 20,
            padding: '6px 16px', fontSize: 12, fontWeight: 600, zIndex: 1000, whiteSpace: 'nowrap',
          }}>
            ✏️ Tryk på kortet for at placere punkter ({pointCount})
          </div>
        )}

        {/* Map controls */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', gap: 8, zIndex: 1000 }}>
          {!drawing && (
            <button onClick={startDrawing} style={{
              flex: 1, background: '#2563EB', color: '#fff', borderRadius: 10,
              padding: '11px 0', fontSize: 14, fontWeight: 700,
              boxShadow: '0 2px 10px rgba(37,99,235,0.45)',
            }}>
              ✏️ Tegn areal
            </button>
          )}
          {drawing && pointCount < 3 && (
            <div style={{
              flex: 1, background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 10,
              padding: '11px 0', fontSize: 13, textAlign: 'center',
            }}>
              Marker mindst 3 punkter
            </div>
          )}
          {drawing && pointCount >= 3 && (
            <button onClick={finishDrawing} style={{
              flex: 1, background: '#10B981', color: '#fff', borderRadius: 10,
              padding: '11px 0', fontSize: 14, fontWeight: 700,
              boxShadow: '0 2px 10px rgba(16,185,129,0.45)',
            }}>
              ✓ Afslut tegning
            </button>
          )}
          {(drawing || pointCount > 0) && (
            <button onClick={clearDrawing} style={{
              background: '#EF4444', color: '#fff', borderRadius: 10,
              padding: '11px 14px', fontSize: 14, fontWeight: 700,
            }}>
              Ryd
            </button>
          )}
        </div>
      </div>

      {/* Areal */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Areal</div>

        {area != null && (
          <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📐</span>
            <span style={{ fontSize: 14, color: '#2563EB', fontWeight: 600 }}>
              Beregnet fra tegning: {Math.round(area).toLocaleString('da-DK')} m²
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', gap: 6 }}>
          <input
            style={{ flex: 1, fontSize: 24, fontWeight: 800, color: '#111827', background: 'transparent', width: 0 }}
            type="number"
            inputMode="decimal"
            value={manualM2}
            onChange={e => setManualM2(e.target.value)}
            placeholder="0"
          />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#6B7280' }}>m²</span>
        </div>
        {!area && (
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
            Du kan tegne på kortet ovenfor eller indtaste m² manuelt
          </div>
        )}
      </div>

      {/* Pris pr. m² */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Pris pr. m²</div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderRadius: 10, padding: '10px 14px', gap: 6 }}>
          <input
            style={{ flex: 1, fontSize: 24, fontWeight: 800, color: '#111827', background: 'transparent', width: 0 }}
            type="number"
            inputMode="decimal"
            value={pricePerM2}
            onChange={e => setPricePerM2(e.target.value)}
            placeholder="0"
          />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#6B7280' }}>kr/m²</span>
        </div>
      </div>

      {/* Totalpris */}
      {m2 > 0 && pris > 0 && (
        <div style={{
          margin: '12px 16px 0', background: '#2563EB', borderRadius: 14, padding: 20,
          boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Samlet tilbudspris
          </div>
          <div style={{ color: '#fff', fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
            {total.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 8 }}>
            {m2.toLocaleString('da-DK')} m² × {pris.toLocaleString('da-DK')} kr/m²
          </div>
        </div>
      )}
    </div>
  );
}
