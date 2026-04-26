import React, { useState, useRef } from 'react';
import { getExpenses, saveExpenses, newId } from '../storage.js';
import { writeExpense, isConnected } from '../googleDrive.js';

const KATEGORIER = ['Brændstof', 'Arbejdstøj', 'Værktøj', 'Kontorartikler', 'Telefon/Internet', 'Forsikring', 'Andet'];
const STATS_TAKST = 3.81;

const labelStyle = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', fontSize: 15, borderBottom: '2px solid #E5E7EB', paddingBottom: 6, color: '#111827', background: 'transparent' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Udgift() {
  const [mode, setMode] = useState('kvittering');
  const [date, setDate] = useState(todayStr);
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Andet');
  const [amount, setAmount] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [fra, setFra] = useState('');
  const [til, setTil] = useState('');
  const [km, setKm] = useState('');
  const [rate, setRate] = useState(String(STATS_TAKST));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [expenses, setExpenses] = useState(() =>
    getExpenses().sort((a, b) => b.date.localeCompare(a.date))
  );
  const photoRef = useRef(null);

  const kmAmount = km && rate ? Math.round(parseFloat(km.replace(',', '.')) * parseFloat(rate.replace(',', '.'))) : 0;
  const finalAmount = mode === 'kørsel' ? kmAmount : Math.round(parseFloat(amount.replace(',', '.')) || 0);
  const canSave = desc.trim() && finalAmount > 0;

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const expense = {
      id: newId(),
      type: mode,
      date,
      description: desc.trim(),
      category: mode === 'kørsel' ? 'Kørsel' : category,
      amount: finalAmount,
      fra: mode === 'kørsel' ? fra.trim() : '',
      til: mode === 'kørsel' ? til.trim() : '',
      km: mode === 'kørsel' ? parseFloat(km) || 0 : 0,
      rate: mode === 'kørsel' ? parseFloat(rate) || 0 : 0,
      createdAt: new Date().toISOString(),
    };

    const updated = [expense, ...getExpenses()];
    saveExpenses(updated);
    setExpenses(updated.sort((a, b) => b.date.localeCompare(a.date)));

    let sheetOk = false;
    if (isConnected()) {
      try { await writeExpense(expense); sheetOk = true; }
      catch (err) { console.warn('Sheets:', err.message); }
    }

    setDesc(''); setAmount(''); setFra(''); setTil(''); setKm(''); setPhotoPreview(null);
    setSaving(false);
    setSavedMsg(sheetOk ? '✅ Gemt og sendt til regnskab' : '✅ Gemt lokalt');
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleDelete = (id) => {
    const updated = getExpenses().filter(e => e.id !== id);
    saveExpenses(updated);
    setExpenses(updated.sort((a, b) => b.date.localeCompare(a.date)));
  };

  const totalUdgifter = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div style={{ paddingBottom: 40, minHeight: '100%', background: '#F9FAFB' }}>

      {/* Header */}
      <div style={{ background: '#059669', padding: '18px 20px 22px', paddingTop: 'calc(18px + env(safe-area-inset-top))' }}>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>Udgifter</div>
        {expenses.length > 0 && (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>
            {expenses.length} poster · {totalUdgifter.toLocaleString('da-DK')} kr i alt
          </div>
        )}
      </div>

      <div style={{ padding: '16px 14px 0' }}>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 16 }}>
          {[['kvittering', '🧾 Kvittering'], ['kørsel', '🚗 Kørsel']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: mode === m ? '#059669' : 'transparent',
              color: mode === m ? '#fff' : '#6B7280',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Dato</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>

          {mode === 'kvittering' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Beskrivelse</label>
                <input value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Hvad er udgiften?" style={inputStyle} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Kategori</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {KATEGORIER.map(k => (
                    <button key={k} onClick={() => setCategory(k)} style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: category === k ? '#059669' : '#F3F4F6',
                      color: category === k ? '#fff' : '#374151',
                    }}>{k}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Beløb (kr)</label>
                <input type="number" inputMode="decimal" value={amount}
                  onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Kvittering billede (valgfri)</label>
                <input ref={photoRef} type="file" accept="image/*" capture="environment"
                  onChange={handlePhoto} style={{ display: 'none' }} />
                <button onClick={() => photoRef.current?.click()} style={{
                  width: '100%', padding: '12px', borderRadius: 12,
                  border: '2px dashed #A7F3D0', background: '#F0FDF4',
                  color: '#059669', fontSize: 13, fontWeight: 700,
                }}>
                  📷 Tag billede af kvittering
                </button>
                {photoPreview && (
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <img src={photoPreview} alt="" style={{ width: '100%', borderRadius: 10, maxHeight: 220, objectFit: 'cover' }} />
                    <button onClick={() => setPhotoPreview(null)} style={{
                      position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)',
                      color: '#fff', borderRadius: '50%', width: 28, height: 28, fontSize: 18, lineHeight: '28px', textAlign: 'center',
                    }}>×</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fra</label>
                  <input value={fra} onChange={e => setFra(e.target.value)} placeholder="Startsted" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Til</label>
                  <input value={til} onChange={e => setTil(e.target.value)} placeholder="Destination" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Kilometer</label>
                <input type="number" inputMode="decimal" value={km}
                  onChange={e => setKm(e.target.value)} placeholder="0" style={inputStyle} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={labelStyle}>Takst (kr/km)</span>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>Statens takst 2025: 3,81</span>
                </div>
                <input type="number" inputMode="decimal" value={rate}
                  onChange={e => setRate(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ marginBottom: kmAmount > 0 ? 14 : 0 }}>
                <label style={labelStyle}>Formål / Beskrivelse</label>
                <input value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Fx: Besøg hos kunde" style={inputStyle} />
              </div>

              {kmAmount > 0 && (
                <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 2 }}>Beregnet kørselsgodtgørelse</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#065F46', lineHeight: 1 }}>{kmAmount.toLocaleString('da-DK')} kr</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{km} km × {rate} kr/km</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving || !canSave} style={{
          width: '100%', padding: '15px 0', borderRadius: 14, fontSize: 16, fontWeight: 700,
          background: savedMsg ? '#065F46' : '#059669',
          color: '#fff', opacity: !canSave ? 0.45 : 1,
          boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
        }}>
          {saving ? '⏳ Gemmer...' : savedMsg || '+ Gem udgift'}
        </button>

        {/* Expenses list */}
        {expenses.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Gemte udgifter
            </div>
            {expenses.map(exp => (
              <div key={exp.id} style={{
                background: '#fff', borderRadius: 12, padding: '11px 14px', marginBottom: 8,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{exp.type === 'kørsel' ? '🚗' : '🧾'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.description}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {new Date(exp.date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {exp.category && exp.category !== 'Kørsel' ? ` · ${exp.category}` : ''}
                    {exp.type === 'kørsel' && exp.km > 0 ? ` · ${exp.km} km` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', flexShrink: 0 }}>
                  {exp.amount.toLocaleString('da-DK')} kr
                </div>
                <button onClick={() => handleDelete(exp.id)}
                  style={{ color: '#D1D5DB', fontSize: 20, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
