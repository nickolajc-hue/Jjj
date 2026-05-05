import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchInvoices, markInvoicePaid, sendInvoiceFromSheet, sendReminder } from '../googleDrive.js';
import { getCustomers } from '../storage.js';

function rykkerstatus(dueISO) {
  if (!dueISO) return null;
  const due = new Date(dueISO + 'T00:00:00Z');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / 86400000);
  const dueFmt = `${due.getUTCDate()}/${due.getUTCMonth()+1}-${due.getUTCFullYear()}`;
  if (diff < -3)  return { color: '#10B981', text: `Forfalder ${dueFmt}`,                              overdue: false };
  if (diff < 0)   return { color: '#F59E0B', text: `Forfalder om ${-diff} dag${-diff!==1?'e':''}`,     overdue: false };
  if (diff === 0) return { color: '#EF4444', text: 'Forfalder i dag!',                                 overdue: true  };
  return          { color: '#EF4444', text: `${diff} dag${diff!==1?'e':''} forsinket`,                 overdue: true  };
}

const FILTER_TABS = ['Alle', 'Ubetalt', 'Betalt'];

export default function Fakturaer() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [filter, setFilter]     = useState('Alle');
  const [markingNr, setMarkingNr]   = useState(null);
  const [sendingNr, setSendingNr]   = useState(null);
  const [reminderNr, setReminderNr] = useState(null);

  const load = () => {
    setLoading(true); setErr(null);
    fetchInvoices()
      .then(r => setInvoices([...r].reverse())) // newest first
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = (invoices || []).filter(inv => {
    if (filter === 'Betalt')  return !!inv.paidDate;
    if (filter === 'Ubetalt') return !inv.paidDate;
    return true;
  });

  const findEmail = (inv) => {
    const cust = getCustomers().find(c => c.name?.toLowerCase() === inv.kunde?.toLowerCase());
    return cust?.email || null;
  };

  const handleMarkPaid = async (inv) => {
    setMarkingNr(inv.nr);
    try {
      await markInvoicePaid(inv.nr);
      const now = new Date();
      const paidDate = `${now.getDate()}/${now.getMonth()+1}-${now.getFullYear()}`;
      setInvoices(prev => prev.map(i => i.nr === inv.nr ? { ...i, paidDate } : i));
    } catch (e) { alert(`Fejl: ${e.message}`); }
    finally { setMarkingNr(null); }
  };

  const handleSend = async (inv) => {
    const email = findEmail(inv);
    if (!email) { alert(`Ingen email på "${inv.kunde}". Tilføj email på kunden.`); return; }
    setSendingNr(inv.nr);
    try {
      await sendInvoiceFromSheet({ custEmail: email, custName: inv.kunde, nr: inv.nr, service: inv.service, beloeb: inv.beloeb, dueISO: inv.dueISO, docUrl: inv.docUrl });
      alert(`Faktura sendt til ${email}`);
    } catch (e) { alert(`Fejl: ${e.message}`); }
    finally { setSendingNr(null); }
  };

  const handleReminder = async (inv) => {
    const email = findEmail(inv);
    if (!email) { alert(`Ingen email på "${inv.kunde}". Tilføj email på kunden.`); return; }
    setReminderNr(inv.nr);
    try {
      await sendReminder({ custName: inv.kunde, custEmail: email, nr: inv.nr, amount: inv.beloeb, dueISO: inv.dueISO });
      alert(`Rykker sendt til ${email}`);
    } catch (e) { alert(`Fejl: ${e.message}`); }
    finally { setReminderNr(null); }
  };

  const totals = invoices ? {
    alle:    invoices.length,
    ubetalt: invoices.filter(i => !i.paidDate).length,
    betalt:  invoices.filter(i => !!i.paidDate).length,
    udestående: invoices.filter(i => !i.paidDate).reduce((s, i) => s + i.beloeb, 0),
  } : null;

  return (
    <div style={{ paddingBottom: 32, minHeight: '100dvh', background: '#F9FAFB' }}>
      {/* Header */}
      <div style={{ background: '#2563EB', color: '#fff', padding: '16px 20px 20px', paddingTop: 'calc(16px + env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 22, background: 'none', color: '#fff', padding: '0 4px' }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Fakturaer</div>
          {totals && (
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
              {totals.alle} i alt · {totals.ubetalt} ubetalt · {totals.udestående > 0 ? totals.udestående.toLocaleString('da-DK') + ' kr udestående' : 'intet udestående'}
            </div>
          )}
        </div>
        <button onClick={load} style={{ fontSize: 20, background: 'none', color: '#fff', opacity: 0.8 }}>↻</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 16px' }}>
        {FILTER_TABS.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{ flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 700,
              color: filter === t ? '#2563EB' : '#6B7280',
              borderBottom: filter === t ? '2.5px solid #2563EB' : '2.5px solid transparent',
              background: 'none' }}>
            {t}
            {invoices && (
              <span style={{ marginLeft: 4, fontSize: 11, color: filter === t ? '#2563EB' : '#9CA3AF' }}>
                ({t === 'Alle' ? totals.alle : t === 'Ubetalt' ? totals.ubetalt : totals.betalt})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 14 }}>Henter fakturaer...</div>
      )}
      {err && (
        <div style={{ margin: '16px', background: '#FEE2E2', borderRadius: 12, padding: '14px', color: '#991B1B', fontSize: 13 }}>
          ⚠️ {err}
        </div>
      )}
      {!loading && !err && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 14 }}>
          {filter === 'Betalt' ? 'Ingen betalte fakturaer endnu' : filter === 'Ubetalt' ? '✅ Ingen udestående fakturaer' : 'Ingen fakturaer fundet'}
        </div>
      )}
      {!loading && filtered.map(inv => {
        const rs = inv.paidDate ? null : rykkerstatus(inv.dueISO);
        const email = findEmail(inv);
        return (
          <div key={inv.nr} style={{ background: '#fff', margin: '10px 16px 0', borderRadius: 14, padding: '14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${inv.paidDate ? '#10B981' : rs?.overdue ? '#EF4444' : '#2563EB'}` }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{inv.nr}</div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 1 }}>{inv.kunde}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: inv.paidDate ? '#10B981' : '#111' }}>
                  {inv.beloeb.toLocaleString('da-DK')} kr
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{inv.date}</div>
              </div>
            </div>

            {/* Service */}
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{inv.service}</div>

            {/* Status badge */}
            {inv.paidDate ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#D1FAE5', color: '#065F46', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>
                ✅ Betalt {inv.paidDate}
              </div>
            ) : rs ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: rs.overdue ? '#FEE2E2' : '#FEF3C7', color: rs.overdue ? '#991B1B' : '#92400E', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>
                {rs.overdue ? '⚠️' : '🕐'} {rs.text}
              </div>
            ) : null}

            {/* Action buttons — row 1: Se faktura + Send igen (always) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {inv.docUrl ? (
                <a href={inv.docUrl} target="_blank" rel="noreferrer"
                  style={{ flex: 1, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>
                  📄 Se faktura
                </a>
              ) : (
                <div style={{ flex: 1, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                  📄 Ingen fil
                </div>
              )}
              <button onClick={() => handleSend(inv)} disabled={sendingNr === inv.nr || !email}
                title={!email ? 'Ingen email på kunden' : ''}
                style={{ flex: 1, background: email ? '#EFF6FF' : '#F3F4F6', color: email ? '#2563EB' : '#9CA3AF', border: email ? '1px solid #BFDBFE' : 'none', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, opacity: sendingNr === inv.nr ? 0.6 : 1 }}>
                {sendingNr === inv.nr ? '⏳' : '📧 Send igen'}
              </button>
            </div>

            {/* Action buttons — row 2: Rykker + Betalt (unpaid only) */}
            {!inv.paidDate && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {rs?.overdue ? (
                  <button onClick={() => handleReminder(inv)} disabled={reminderNr === inv.nr}
                    style={{ flex: 1, background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, opacity: reminderNr === inv.nr ? 0.6 : 1 }}>
                    {reminderNr === inv.nr ? '⏳' : '📨 Rykker'}
                  </button>
                ) : (
                  <div style={{ flex: 1 }} />
                )}
                <button onClick={() => handleMarkPaid(inv)} disabled={markingNr === inv.nr}
                  style={{ flex: 1, background: '#F59E0B', color: '#fff', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, opacity: markingNr === inv.nr ? 0.6 : 1 }}>
                  {markingNr === inv.nr ? '⏳' : '💰 Betalt'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Ny faktura knap */}
      <div style={{ margin: '16px' }}>
        <button onClick={() => navigate('/faktura/manuel')}
          style={{ width: '100%', background: '#2563EB', color: '#fff', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 800 }}>
          + Ny faktura
        </button>
      </div>
    </div>
  );
}
