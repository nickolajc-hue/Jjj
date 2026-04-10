import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAppointments, saveAppointments, getCustomers, newId, RECURRENCE_LABELS, formatDuration, EQUIPMENT_LIST, getCustomEquipment, saveCustomEquipment } from '../storage.js';
import TopBar from '../components/TopBar.jsx';
import CalendarPicker from '../components/CalendarPicker.jsx';

const fld = {
  display: 'flex', alignItems: 'center', background: '#fff',
  borderRadius: 12, padding: '12px 14px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', gap: 10, marginBottom: 12,
};
const lbl = {
  fontSize: 12, fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
};

const QUICK_DURATIONS = [30, 60, 90, 120, 180];

export default function AddEditAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;
  const prefillCustomerId = location.state?.customerId || '';

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [customers, setCustomers] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [duration, setDuration] = useState('60');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState('2'); // antal uger ved 'custom'
  const [price, setPrice] = useState('');
  const [equipment, setEquipment] = useState([]);
  const [customEquipment, setCustomEquipment] = useState(() => getCustomEquipment());
  const [newEquipItem, setNewEquipItem] = useState('');

  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState(tomorrow);

  useEffect(() => {
    setCustomers(getCustomers());
    if (isEditing) {
      const a = getAppointments().find(x => x.id === id);
      if (a) {
        setTitle(a.title || '');
        setNotes(a.notes || '');
        setCustomerId(a.customerId || '');
        setDuration(String(a.duration || 60));
        setRecurrence(a.recurrence || 'none');
        setRecurrenceInterval(String(a.recurrenceInterval || 2));
        const d = new Date(a.date);
        d.setHours(0, 0, 0, 0);
        setSelectedDate(d);
        setPrice(a.price ? String(a.price) : '');
        setEquipment(a.equipment || []);
      }
    }
  }, [id]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const save = () => {
    if (!title.trim()) { alert('Aftaletitel er påkrævet.'); return; }
    if (!customerId)   { alert('Vælg en kunde til aftalen.'); return; }
    const dateObj = selectedDate;
    if (!dateObj || isNaN(dateObj.getTime())) { alert('Ugyldig dato.'); return; }

    const payload = {
      title,
      notes,
      customerId,
      date: dateObj.toISOString(),
      duration: parseInt(duration) || 60,
      recurrence,
      recurrenceInterval: recurrence === 'custom' ? (parseInt(recurrenceInterval) || 2) : null,
      price: parseFloat(price) || 0,
      equipment,
    };

    const all = getAppointments();
    if (isEditing) {
      saveAppointments(all.map(a => a.id === id ? { ...a, ...payload } : a));
    } else {
      saveAppointments([...all, { id: newId(), ...payload, createdAt: new Date().toISOString() }]);
    }
    navigate(-1);
  };

  // Kundepicker renderes via Portal for at undgå iOS Safari fixed-position bug
  const picker = showPicker && createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) setShowPicker(false); }}
    >
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Vælg kunde</span>
          <button onClick={() => setShowPicker(false)} style={{ fontSize: 26, color: '#6B7280', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {customers.length === 0
            ? <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Ingen kunder oprettet endnu</div>
            : customers.map(c => (
              <div key={c.id}
                onClick={() => { setCustomerId(c.id); setShowPicker(false); }}
                style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #F3F4F6', gap: 12, background: c.id === customerId ? '#EFF6FF' : '#fff' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 22, background: '#2563EB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
                  {c.phone && <div style={{ fontSize: 13, color: '#6B7280' }}>{c.phone}</div>}
                </div>
                {c.id === customerId && <span style={{ color: '#2563EB', fontSize: 22 }}>✓</span>}
              </div>
            ))
          }
          {/* Ekstra luft i bunden så sidstes kunde ikke skjules bag hjem-bar */}
          <div style={{ height: 32 }} />
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div>
      <TopBar title={isEditing ? 'Rediger aftale' : 'Ny aftale'} backTo={-1} />
      <div style={{ padding: 16, paddingBottom: 40 }}>

        {/* Titel */}
        <label style={lbl}>Titel *</label>
        <div style={fld}>
          <span style={{ fontSize: 18 }}>📋</span>
          <input style={{ flex: 1, fontSize: 16 }} value={title} onChange={e => setTitle(e.target.value)}
            placeholder="F.eks. Græsslåning, Rengøring..." />
        </div>

        {/* Kunde */}
        <label style={lbl}>Kunde *</label>
        <div style={{ ...fld, cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
          <span style={{ fontSize: 18 }}>👤</span>
          <span style={{ flex: 1, fontSize: 16, color: selectedCustomer ? '#111827' : '#D1D5DB' }}>
            {selectedCustomer ? selectedCustomer.name : 'Vælg kunde...'}
          </span>
          <span style={{ color: '#9CA3AF', fontSize: 18 }}>▾</span>
        </div>

        {/* Dato */}
        <label style={lbl}>Dato</label>
        <CalendarPicker value={selectedDate} onChange={setSelectedDate} />

        {/* Varighed */}
        <label style={lbl}>Opgavens varighed</label>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {QUICK_DURATIONS.map(d => (
              <button key={d} onClick={() => setDuration(String(d))} style={{
                borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, border: '2px solid',
                borderColor: duration === String(d) ? '#2563EB' : '#E5E7EB',
                background: duration === String(d) ? '#EFF6FF' : '#fff',
                color: duration === String(d) ? '#2563EB' : '#6B7280',
              }}>
                {formatDuration(d)}
              </button>
            ))}
          </div>
          <div style={fld}>
            <span style={{ fontSize: 18 }}>⏱</span>
            <input
              style={{ flex: 1, fontSize: 18, fontWeight: 700 }}
              type="number" inputMode="numeric"
              value={duration} onChange={e => setDuration(e.target.value)} placeholder="60"
            />
            <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 600 }}>minutter</span>
          </div>
          {parseInt(duration) > 0 && (
            <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600, marginTop: -6, marginBottom: 12, paddingLeft: 4 }}>
              ≈ {formatDuration(parseInt(duration))}
            </div>
          )}
        </div>

        {/* Pris */}
        <label style={lbl}>Pris</label>
        <div style={{ ...fld, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <input
            style={{ flex: 1, fontSize: 18, fontWeight: 700 }}
            type="number" inputMode="decimal"
            value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0"
          />
          <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 600 }}>kr</span>
        </div>

        {/* Redskaber */}
        <label style={lbl}>Redskaber</label>
        <div style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: customEquipment.length > 0 ? 10 : 0 }}>
            {EQUIPMENT_LIST.map(item => {
              const sel = equipment.includes(item);
              return (
                <button key={item} onClick={() => setEquipment(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item])} style={{
                  borderRadius: 20, padding: '7px 12px', fontSize: 13, fontWeight: 600, border: '2px solid',
                  borderColor: sel ? '#2563EB' : '#E5E7EB',
                  background: sel ? '#EFF6FF' : '#F9FAFB',
                  color: sel ? '#2563EB' : '#6B7280',
                }}>
                  {item}
                </button>
              );
            })}
          </div>
          {customEquipment.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6', marginBottom: 8 }}>
              {customEquipment.map(item => {
                const sel = equipment.includes(item);
                return (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', borderRadius: 20, border: `2px solid ${sel ? '#2563EB' : '#E5E7EB'}`, background: sel ? '#EFF6FF' : '#F9FAFB', overflow: 'hidden' }}>
                    <button onClick={() => setEquipment(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item])}
                      style={{ padding: '7px 10px', fontSize: 13, fontWeight: 600, color: sel ? '#2563EB' : '#6B7280' }}>
                      {item}
                    </button>
                    <button onClick={() => {
                      const next = customEquipment.filter(i => i !== item);
                      saveCustomEquipment(next);
                      setCustomEquipment(next);
                      setEquipment(prev => prev.filter(i => i !== item));
                    }} style={{ padding: '7px 8px 7px 0', fontSize: 13, color: '#EF4444', lineHeight: 1 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
            <input
              style={{ flex: 1, fontSize: 14, borderBottom: '2px solid #E5E7EB', paddingBottom: 4, color: '#111827' }}
              value={newEquipItem}
              onChange={e => setNewEquipItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const item = newEquipItem.trim();
                  if (item && ![...EQUIPMENT_LIST, ...customEquipment].includes(item)) {
                    const next = [...customEquipment, item];
                    saveCustomEquipment(next);
                    setCustomEquipment(next);
                    setEquipment(prev => [...prev, item]);
                    setNewEquipItem('');
                  }
                }
              }}
              placeholder="Tilføj nyt redskab..."
            />
            <button onClick={() => {
              const item = newEquipItem.trim();
              if (item && ![...EQUIPMENT_LIST, ...customEquipment].includes(item)) {
                const next = [...customEquipment, item];
                saveCustomEquipment(next);
                setCustomEquipment(next);
                setEquipment(prev => [...prev, item]);
                setNewEquipItem('');
              }
            }} style={{ color: '#2563EB', fontWeight: 700, fontSize: 14, flexShrink: 0, padding: '0 4px' }}>
              + Tilføj
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14, paddingLeft: 4 }}>
          Tryk ✕ på et brugerdefineret redskab for at slette det permanent
        </div>

        {/* Gentagelse */}
        <label style={lbl}>Gentagelse</label>
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 14 }}>
          {Object.entries(RECURRENCE_LABELS).map(([key, label], i, arr) => (
            <button key={key} onClick={() => setRecurrence(key)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: '13px 16px', background: recurrence === key ? '#EFF6FF' : '#fff',
              borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none',
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: recurrence === key ? '#2563EB' : '#374151' }}>
                {label}
              </span>
              {recurrence === key && <span style={{ color: '#2563EB', fontSize: 18 }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Tilpasset interval – vises kun når 'custom' er valgt */}
        {recurrence === 'custom' && (
          <div style={{ marginBottom: 14, background: '#EFF6FF', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', marginBottom: 10 }}>
              Gentages hver hvor mange uger?
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setRecurrenceInterval(v => String(Math.max(1, parseInt(v || 1) - 1)))}
                style={{ width: 40, height: 40, borderRadius: 20, background: '#fff', fontSize: 22, fontWeight: 700, color: '#2563EB', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <input
                  style={{ fontSize: 32, fontWeight: 900, color: '#2563EB', textAlign: 'center', background: 'transparent', width: '100%' }}
                  type="number" inputMode="numeric"
                  value={recurrenceInterval}
                  onChange={e => setRecurrenceInterval(e.target.value)}
                  min="1"
                />
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  {parseInt(recurrenceInterval) === 1 ? 'uge' : 'uger'}
                </div>
              </div>
              <button onClick={() => setRecurrenceInterval(v => String(parseInt(v || 1) + 1))}
                style={{ width: 40, height: 40, borderRadius: 20, background: '#fff', fontSize: 22, fontWeight: 700, color: '#2563EB', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>+</button>
            </div>
            {parseInt(recurrenceInterval) > 0 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#2563EB', fontWeight: 600, marginTop: 10 }}>
                Gentages hver {recurrenceInterval}. uge
              </div>
            )}
          </div>
        )}

        {/* Noter */}
        <label style={lbl}>Noter</label>
        <div style={{ ...fld, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, marginTop: 2 }}>📝</span>
          <textarea style={{ flex: 1, fontSize: 16, resize: 'none', height: 80 }}
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Tilføj noter..." />
        </div>

        <button onClick={save} style={{
          display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center',
          background: '#2563EB', color: '#fff', borderRadius: 14, padding: '16px 0',
          fontSize: 17, fontWeight: 700, marginTop: 8, gap: 8,
          boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
        }}>
          ✓ {isEditing ? 'Gem ændringer' : 'Opret aftale'}
        </button>
      </div>

      {picker}
    </div>
  );
}
