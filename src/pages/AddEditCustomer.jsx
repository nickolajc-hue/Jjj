import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomers, saveCustomers, newId } from '../storage.js';
import TopBar from '../components/TopBar.jsx';

const fieldStyle = {
  display: 'flex', alignItems: 'center', background: '#fff',
  borderRadius: 12, padding: '12px 14px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', gap: 10, marginBottom: 12,
};

export default function AddEditCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', address: '', notes: '' });

  useEffect(() => {
    if (id) {
      const c = getCustomers().find(x => x.id === id);
      if (c) setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', company: c.company || '', address: c.address || '', notes: c.notes || '' });
    }
  }, [id]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const save = () => {
    if (!form.name.trim()) { alert('Kundenavn er påkrævet.'); return; }
    const all = getCustomers();
    if (isEditing) {
      saveCustomers(all.map(c => c.id === id ? { ...c, ...form } : c));
      navigate(`/kunder/${id}`);
    } else {
      saveCustomers([...all, { id: newId(), ...form, createdAt: new Date().toISOString() }]);
      navigate('/kunder');
    }
  };

  const fields = [
    { key: 'name', icon: '👤', label: 'Navn *', type: 'text', placeholder: 'Fulde navn' },
    { key: 'phone', icon: '📞', label: 'Telefon', type: 'tel', placeholder: '+45 12 34 56 78' },
    { key: 'email', icon: '✉️', label: 'Email', type: 'email', placeholder: 'email@eksempel.dk' },
    { key: 'company', icon: '🏢', label: 'Virksomhed', type: 'text', placeholder: 'Virksomhedsnavn' },
    { key: 'address', icon: '📍', label: 'Adresse', type: 'text', placeholder: 'Vejnavn, postnr, by' },
  ];

  return (
    <div>
      <TopBar title={isEditing ? 'Rediger kunde' : 'Ny kunde'} backTo={isEditing ? `/kunder/${id}` : '/kunder'} />
      <div style={{ padding: 16, paddingBottom: 32 }}>
        {fields.map(({ key, icon, label, type, placeholder }) => (
          <div key={key}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{label}</label>
            <div style={fieldStyle}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <input style={{ flex: 1, fontSize: 16, color: '#111827' }} type={type} value={form[key]} onChange={set(key)} placeholder={placeholder} />
            </div>
          </div>
        ))}

        <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Noter</label>
        <div style={{ ...fieldStyle, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>📝</span>
          <textarea
            style={{ flex: 1, fontSize: 16, color: '#111827', resize: 'none', height: 80 }}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Tilføj noter om kunden..."
          />
        </div>

        <button onClick={save} style={{
          display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center',
          background: '#2563EB', color: '#fff', borderRadius: 14, padding: '16px 0',
          fontSize: 17, fontWeight: 700, marginTop: 8, gap: 8,
          boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
        }}>
          <span>✓</span> {isEditing ? 'Gem ændringer' : 'Opret kunde'}
        </button>
      </div>
    </div>
  );
}
