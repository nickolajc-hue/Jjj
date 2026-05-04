import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers } from '../storage.js';
import { createManualInvoice, sendInvoice, markInvoicePaid, isConnected } from '../googleDrive.js';

const DRAFTS_KEY = 'invoice_drafts';

function loadDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); }
  catch { return []; }
}
function saveDrafts(drafts) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

const s = {
  wrap:    { paddingBottom: 32, minHeight: '100dvh', background: '#F9FAFB' },
  header:  { background: '#2563EB', color: '#fff', padding: '16px 20px 20px', paddingTop: 'calc(16px + env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 12 },
  back:    { fontSize: 22, background: 'none', color: '#fff', padding: '0 4px' },
  title:   { fontSize: 20, fontWeight: 800 },
  card:    { background: '#fff', margin: '14px 16px 0', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  label:   { fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input:   { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box', background: '#FAFAFA' },
  row:     { display: 'flex', gap: 8, alignItems: 'flex-start' },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12 },
  lineCard: { background: '#F3F4F6', borderRadius: 10, padding: '10px 12px', marginBottom: 8 },
  addBtn:  { width: '100%', border: '2px dashed #D1D5DB', borderRadius: 10, padding: '10px 0', color: '#6B7280', fontWeight: 700, fontSize: 14, background: 'none', marginTop: 4 },
  removeBtn: { background: '#FEE2E2', color: '#EF4444', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-end' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '2px solid #E5E7EB' },
  primaryBtn: { flex: 1, background: '#2563EB', color: '#fff', borderRadius: 12, padding: '14px 0', fontSize: 16, fontWeight: 800 },
  secondaryBtn: { flex: 1, background: '#F0FDF4', color: '#059669', borderRadius: 12, padding: '14px 0', fontSize: 16, fontWeight: 800, border: '1.5px solid #86EFAC' },
};

function newLine() { return { id: Date.now() + Math.random(), desc: '', amount: '' }; }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function draftLabel(draft, customers) {
  let name = '';
  if (draft.custMode === 'pick') {
    name = customers.find(c => c.id === draft.selectedCustId)?.name || 'Ukendt kunde';
  } else {
    name = draft.manualCust?.name || 'Ukendt kunde';
  }
  const total = (draft.lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const saved = new Date(draft.savedAt);
  const dateStr = `${saved.getDate()}/${saved.getMonth()+1}`;
  return { name, total, dateStr };
}

export default function ManuelFaktura() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [drafts, setDrafts] = useState(loadDrafts);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [custMode, setCustMode] = useState('pick');
  const [selectedCustId, setSelectedCustId] = useState('');
  const [manualCust, setManualCust] = useState({ name: '', email: '', address: '', phone: '' });
  const [date, setDate] = useState(todayISO());
  const [lines, setLines] = useState([newLine()]);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);

  useEffect(() => { setCustomers(getCustomers()); }, []);

  const customer = custMode === 'pick'
    ? customers.find(c => c.id === selectedCustId) || null
    : manualCust.name ? manualCust : null;

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const validLines = lines.filter(l => l.desc.trim() && Number(l.amount) > 0);
  const canCreate = customer && validLines.length > 0 && date;
  const hasFormContent = (custMode === 'pick' ? !!selectedCustId : !!manualCust.name) ||
    lines.some(l => l.desc.trim() || l.amount);

  const updateLine = (id, field, val) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  const removeLine = id => setLines(prev => prev.filter(l => l.id !== id));

  const handleSaveDraft = () => {
    const draft = {
      id: activeDraftId || `draft_${Date.now()}`,
      savedAt: new Date().toISOString(),
      custMode, selectedCustId, manualCust, date, lines,
    };
    const next = activeDraftId
      ? drafts.map(d => d.id === activeDraftId ? draft : d)
      : [draft, ...drafts];
    saveDrafts(next);
    setDrafts(next);
    setActiveDraftId(draft.id);
    setShowDrafts(true);
  };

  const handleLoadDraft = (draft) => {
    setCustMode(draft.custMode);
    setSelectedCustId(draft.selectedCustId || '');
    setManualCust(draft.manualCust || { name: '', email: '', address: '', phone: '' });
    setDate(draft.date || todayISO());
    setLines(draft.lines?.length ? draft.lines : [newLine()]);
    setActiveDraftId(draft.id);
    setResult(null);
    setShowDrafts(false);
  };

  const handleDeleteDraft = (id) => {
    const next = drafts.filter(d => d.id !== id);
    saveDrafts(next);
    setDrafts(next);
    if (activeDraftId === id) setActiveDraftId(null);
  };

  const handleCreate = async (withEmail) => {
    if (!canCreate) return;
    setBusy(withEmail ? 'send' : 'create');
    try {
      const res = await createManualInvoice({
        customer,
        date: new Date(date + 'T12:00:00'),
        lines: validLines.map(l => ({ desc: l.desc.trim(), amount: Number(l.amount) })),
        sendEmail: withEmail,
      });
      setResult({ ...res, draftId: activeDraftId });
    } catch (err) {
      alert(`Fejl: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleSendEmail = async () => {
    if (!result || !customer?.email) return;
    setSendingEmail(true);
    try {
      await sendInvoice({
        customer,
        appointment: { date: date + 'T12:00:00', price: total, title: validLines.length === 1 ? validLines[0].desc : `${validLines.length} ydelser` },
        nr: result.nr, docUrl: result.docUrl,
      });
      setResult(r => ({ ...r, emailSent: true }));
    } catch (err) {
      alert(`Fejl ved afsendelse: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!result) return;
    setMarkingPaid(true);
    try {
      await markInvoicePaid(result.nr);
      const now = new Date();
      setResult(r => ({ ...r, paid: true, paidDate: `${now.getDate()}/${now.getMonth()+1}-${now.getFullYear()}` }));
    } catch (err) {
      alert(`Fejl: ${err.message}`);
    } finally {
      setMarkingPaid(false);
    }
  };

  const resetForm = (keepDraft = false) => {
    setResult(null);
    setLines([newLine()]);
    setSelectedCustId('');
    setManualCust({ name: '', email: '', address: '', phone: '' });
    setDate(todayISO());
    if (!keepDraft) setActiveDraftId(null);
    setShowDrafts(true);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>‹</button>
        <span style={s.title}>Manuel faktura</span>
      </div>

      {!isConnected() && (
        <div style={{ margin: '16px 16px 0', background: '#FEF3C7', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#92400E' }}>
          ⚠️ Du er ikke forbundet til Google. Gå til Indstillinger for at logge ind.
        </div>
      )}

      {/* Kladder */}
      {!result && drafts.length > 0 && (
        <div style={s.card}>
          <button
            onClick={() => setShowDrafts(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', textAlign: 'left' }}
          >
            <span style={s.sectionTitle}>📂 Gemte kladder ({drafts.length})</span>
            <span style={{ fontSize: 18, color: '#9CA3AF' }}>{showDrafts ? '▾' : '▸'}</span>
          </button>
          {showDrafts && drafts.map(draft => {
            const { name, total: dTotal, dateStr } = draftLabel(draft, customers);
            const isActive = draft.id === activeDraftId;
            return (
              <div key={draft.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: '1px solid #F3F4F6' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#2563EB' : '#111' }}>
                    {isActive ? '✏️ ' : ''}{name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    Gemt {dateStr} · {dTotal > 0 ? dTotal.toLocaleString('da-DK') + ' kr' : 'Ingen beløb'}
                  </div>
                </div>
                <button onClick={() => handleLoadDraft(draft)}
                  style={{ background: '#EFF6FF', color: '#2563EB', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {isActive ? 'Redigér' : 'Åbn'}
                </button>
                <button onClick={() => handleDeleteDraft(draft.id)}
                  style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: 8, padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>
                  ×
                </button>
              </div>
            );
          })}
          {!showDrafts && (
            <button onClick={() => setShowDrafts(true)}
              style={{ marginTop: 4, fontSize: 13, color: '#2563EB', background: 'none', fontWeight: 600 }}>
              Vis {drafts.length} kladde{drafts.length !== 1 ? 'r' : ''}
            </button>
          )}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div style={{ margin: '16px 16px 0', background: result.paid ? '#ECFDF5' : '#D1FAE5', borderRadius: 14, padding: '14px 16px', border: result.paid ? '1.5px solid #6EE7B7' : 'none' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
            {result.paid ? '💰' : '✅'} Faktura {result.nr} oprettet
          </div>
          <a href={result.docUrl} target="_blank" rel="noreferrer"
            style={{ color: '#059669', fontWeight: 700, fontSize: 14, textDecoration: 'underline' }}>
            Åbn faktura i Google Docs
          </a>
          {result.paid ? (
            <div style={{ marginTop: 8, fontWeight: 700, color: '#065F46' }}>✅ Betalt {result.paidDate}</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {customer?.email && !result.emailSent && (
                <button onClick={handleSendEmail} disabled={sendingEmail}
                  style={{ flex: 1, background: '#059669', color: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, opacity: sendingEmail ? 0.6 : 1 }}>
                  {sendingEmail ? '⏳ Sender...' : '📧 Send til kunde'}
                </button>
              )}
              {result.emailSent && (
                <div style={{ flex: 1, textAlign: 'center', color: '#065F46', fontSize: 13, fontWeight: 700, padding: '10px 0' }}>
                  📧 Sendt til {customer?.email}
                </div>
              )}
              <button onClick={handleMarkPaid} disabled={markingPaid}
                style={{ flex: 1, background: '#F59E0B', color: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, opacity: markingPaid ? 0.6 : 1 }}>
                {markingPaid ? '⏳...' : '💰 Markér betalt'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {result.draftId && (
              <button onClick={() => handleDeleteDraft(result.draftId)}
                style={{ flex: 1, background: '#FEE2E2', color: '#EF4444', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
                🗑 Slet kladde
              </button>
            )}
            <button onClick={() => resetForm(false)}
              style={{ flex: 1, background: '#F3F4F6', color: '#374151', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
              + Ny faktura
            </button>
          </div>
        </div>
      )}

      {!result && (
        <>
          {/* Aktiv kladde banner */}
          {activeDraftId && (
            <div style={{ margin: '14px 16px 0', background: '#EFF6FF', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#1D4ED8', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✏️ Redigerer kladde</span>
              <button onClick={() => resetForm(false)} style={{ background: 'none', color: '#6B7280', fontSize: 13 }}>Ny tom</button>
            </div>
          )}

          {/* Kunde */}
          <div style={s.card}>
            <div style={s.sectionTitle}>👤 Kunde</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setCustMode('pick')}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: 13,
                  background: custMode === 'pick' ? '#2563EB' : '#F3F4F6',
                  color:      custMode === 'pick' ? '#fff'     : '#374151' }}>
                Vælg kunde
              </button>
              <button onClick={() => setCustMode('manual')}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: 13,
                  background: custMode === 'manual' ? '#2563EB' : '#F3F4F6',
                  color:      custMode === 'manual' ? '#fff'     : '#374151' }}>
                Indtast manuelt
              </button>
            </div>

            {custMode === 'pick' && (
              <>
                <div style={s.label}>Vælg eksisterende kunde</div>
                <select value={selectedCustId} onChange={e => setSelectedCustId(e.target.value)}
                  style={{ ...s.input, color: selectedCustId ? '#111' : '#9CA3AF' }}>
                  <option value="">— Vælg kunde —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.address ? ` · ${c.address}` : ''}</option>
                  ))}
                </select>
                {customers.find(c => c.id === selectedCustId)?.email && (
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                    📧 {customers.find(c => c.id === selectedCustId).email}
                  </div>
                )}
              </>
            )}

            {custMode === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['name','Navn *'],['email','Email'],['address','Adresse'],['phone','Telefon']].map(([f, lbl]) => (
                  <div key={f}>
                    <div style={s.label}>{lbl}</div>
                    <input style={s.input} value={manualCust[f]}
                      onChange={e => setManualCust(p => ({ ...p, [f]: e.target.value }))}
                      type={f === 'email' ? 'email' : 'text'} placeholder={lbl.replace(' *','')} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dato */}
          <div style={s.card}>
            <div style={s.label}>Dato</div>
            <input style={s.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Linjer */}
          <div style={s.card}>
            <div style={s.sectionTitle}>📝 Ydelser</div>
            {lines.map((l) => (
              <div key={l.id} style={s.lineCard}>
                <div style={{ ...s.row, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.label}>Beskrivelse</div>
                    <input style={s.input} value={l.desc} placeholder="F.eks. Havearbejde dag 1"
                      onChange={e => updateLine(l.id, 'desc', e.target.value)} />
                  </div>
                  {lines.length > 1 && (
                    <button style={{ ...s.removeBtn, marginTop: 16 }} onClick={() => removeLine(l.id)}>×</button>
                  )}
                </div>
                <div>
                  <div style={s.label}>Beløb (kr)</div>
                  <input style={s.input} type="number" inputMode="decimal" value={l.amount} placeholder="0"
                    onChange={e => updateLine(l.id, 'amount', e.target.value)} />
                </div>
              </div>
            ))}
            <button style={s.addBtn} onClick={() => setLines(prev => [...prev, newLine()])}>
              + Tilføj linje
            </button>

            <div style={s.totalRow}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#2563EB' }}>
                {total.toLocaleString('da-DK')} kr
              </span>
            </div>
          </div>

          {/* Gem kladde + opret-knapper */}
          <div style={{ margin: '10px 16px 0' }}>
            <button onClick={handleSaveDraft} disabled={!hasFormContent}
              style={{ width: '100%', background: '#F3F4F6', color: '#374151', borderRadius: 12, padding: '12px 0', fontSize: 15, fontWeight: 700, marginBottom: 10, opacity: hasFormContent ? 1 : 0.4 }}>
              💾 {activeDraftId ? 'Gem kladde (opdater)' : 'Gem som kladde'}
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleCreate(false)} disabled={!canCreate || !!busy}
                style={{ ...s.secondaryBtn, opacity: !canCreate || !!busy ? 0.5 : 1 }}>
                {busy === 'create' ? '⏳ Opretter...' : '🧾 Bare opret'}
              </button>
              <button onClick={() => handleCreate(true)}
                disabled={!canCreate || !!busy || !customer?.email}
                title={!customer?.email ? 'Ingen email på kunden' : ''}
                style={{ ...s.primaryBtn, opacity: !canCreate || !!busy || !customer?.email ? 0.5 : 1 }}>
                {busy === 'send' ? '⏳ Sender...' : '📧 Opret og send'}
              </button>
            </div>
            {customer && !customer.email && (
              <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
                Kunden har ingen email — brug "Bare opret"
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
