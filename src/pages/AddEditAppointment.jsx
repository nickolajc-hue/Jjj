import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAppointments, saveAppointments, getCustomers, newId } from '../storage.js';
import TopBar from '../components/TopBar.jsx';

const fieldStyle = {
  display: 'flex', alignItems: 'center', background: '#fff',
  borderRadius: 12, padding: '12px 14px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', gap: 10, marginBottom: 12,
};
const labelStyle = {
  fontSize: 12, fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6,
};

export default function AddEditAppointment() {
  const { id } = useParams();           // appointment id when editing
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;

  // prefilled customer from route state (when navigating from customer detail)
  const prefillCustomerId = location.state?.customerId || '';

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [customers, setCustomers] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  // Date/time – default to now + 1 hour
  const initDate = new Date(Date.now() + 3600000);
  const pad = n => String(n).padStart(2, '0');
  const [day, setDay] = useState(pad(initDate.getDate()));
  const [month, setMonth] = useState(pad(initDate.getMonth() + 1));
  const [year, setYear] = useState(String(initDate.getFullYear()));
  const [hour, setHour] = useState(pad(initDate.getHours()));
  const [minute, setMinute] = useState(pad(initDate.getMinutes()));

  useEffect(() => {
    setCustomers(getCustomers());
    if (isEditing) {
      const a = getAppointments().find(x => x.id === id);
      if (a) {
        setTitle(a.title || '');
        setNotes(a.notes || '');
        setCustomerId(a.customerId || '');
        const d = new Date(a.date);
        setDay(pad(d.getDate()));
        setMonth(pad(d.getMonth() + 1));
        setYear(String(d.getFullYear()));
        setHour(pad(d.getHours()));
        setMinute(pad(d.getMinutes()));
      }
    }
  }, [id]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const save = () => {
    if (!title.trim()) { alert('Aftaletitel er påkrævet.'); return; }
    if (!customerId) { alert('Vælg en kunde til aftalen.'); return; }
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    if (isNaN(dateObj.getTime())) { alert('Ugyldig dato/tid.'); return; }

    const all = getAppointments();
    if (isEditing) {
      saveAppointments(all.map(a => a.id === id ? { ...a, title, notes, customerId, date: dateObj.toISOString() } : a));
    } else {
      saveAppointments([...all, { id: newId(), title, notes, customerId, date: dateObj.toISOString(), createdAt: new Date().toISOString() }]);
    }
    navigate(-1);
  };

  const DtCell = ({ label, value, onChange, maxLen }) => (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <input
        style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', width: '100%', background: 'transparent' }}
        value={value} onChange={e => onChange(e.target.value)}
        inputMode="numeric" maxLength={maxLen}
      />
    </div>
  );

  return (
    <div>
      <TopBar title={isEditing ? 'Rediger aftale' : 'Ny aftale'} backTo={-1} />
      <div style={{ padding: 16, paddingBottom: 32 }}>

        {/* Title */}
        <label style={labelStyle}>Titel *</label>
        <div style={fieldStyle}>
          <span style={{ fontSize: 18 }}>📋</span>
          <input style={{ flex: 1, fontSize: 16 }} value={title} onChange={e => setTitle(e.target.value)} placeholder="F.eks. Møde, Service, Rengøring..." />
        </div>

        {/* Customer */}
        <label style={labelStyle}>Kunde *</label>
        <div style={{ ...fieldStyle, cursor: 'pointer' }} onClick={() => setShowPicker(true)}>
          <span style={{ fontSize: 18 }}>👤</span>
          <span style={{ flex: 1, fontSize: 16, color: selectedCustomer ? '#111827' : '#D1D5DB' }}>
            {selectedCustomer ? selectedCustomer.name : 'Vælg kunde...'}
          </span>
          <span style={{ color: '#9CA3AF' }}>▾</span>
        </div>

        {/* Date */}
        <label style={labelStyle}>Dato</label>
        <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>
          <DtCell label="Dag" value={day} onChange={setDay} maxLen={2} />
          <span style={{ color: '#D1D5DB', fontSize: 22, fontWeight: 300 }}>/</span>
          <DtCell label="Måned" value={month} onChange={setMonth} maxLen={2} />
          <span style={{ color: '#D1D5DB', fontSize: 22, fontWeight: 300 }}>/</span>
          <DtCell label="År" value={year} onChange={setYear} maxLen={4} />
        </div>

        {/* Time */}
        <label style={labelStyle}>Tidspunkt</label>
        <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>
          <DtCell label="Time" value={hour} onChange={setHour} maxLen={2} />
          <span style={{ color: '#D1D5DB', fontSize: 22, fontWeight: 300 }}>:</span>
          <DtCell label="Minut" value={minute} onChange={setMinute} maxLen={2} />
        </div>

        {/* Notes */}
        <label style={labelStyle}>Noter</label>
        <div style={{ ...fieldStyle, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, marginTop: 2 }}>📝</span>
          <textarea style={{ flex: 1, fontSize: 16, resize: 'none', height: 80 }}
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Tilføj noter om aftalen..." />
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

      {/* Customer picker modal */}
      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Vælg kunde</span>
              <button onClick={() => setShowPicker(false)} style={{ fontSize: 22, color: '#6B7280' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto' }}>
              {customers.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Ingen kunder oprettet endnu</div>
              ) : customers.map(c => (
                <div key={c.id} onClick={() => { setCustomerId(c.id); setShowPicker(false); }}
                  style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #F3F4F6', gap: 12, cursor: 'pointer', background: c.id === customerId ? '#EFF6FF' : '#fff' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: '#2563EB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                    {c.phone && <div style={{ fontSize: 13, color: '#6B7280' }}>{c.phone}</div>}
                  </div>
                  {c.id === customerId && <span style={{ color: '#2563EB', fontSize: 20 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
