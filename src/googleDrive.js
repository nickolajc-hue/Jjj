const CLIENT_ID = '38149856270-tevvf2jl1juim7b0tpai3jn9l84jaq0r.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

export const FIRMA = {
  navn:            'GrønRude',
  cvr:             '39722208',
  adresse:         'Æblerosevej 8, 9430 Vadum',
  telefon:         '93928929',
  email:           'groenrude@gmail.com',
  bankReg:         '7449',
  bankKonto:       '4081107',
  betalingsfrist:  8,
};

// ── OAuth ──────────────────────────────────────────────────────────────────
function loadGis() {
  return new Promise(resolve => {
    if (window.google?.accounts) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

export async function signIn() {
  await loadGis();
  const tok    = localStorage.getItem('g_tok');
  const expiry = parseInt(localStorage.getItem('g_exp') || '0');
  if (tok && Date.now() < expiry - 120_000) return tok;

  return new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: r => {
        if (r.error) return reject(new Error(r.error));
        localStorage.setItem('g_tok', r.access_token);
        localStorage.setItem('g_exp', String(Date.now() + r.expires_in * 1000));
        resolve(r.access_token);
      },
    });
    tc.requestAccessToken({ prompt: tok ? '' : 'consent' });
  });
}

export function signOut() {
  ['g_tok', 'g_exp', 'g_folder', 'g_sheet'].forEach(k => localStorage.removeItem(k));
}

export function isConnected() {
  return !!localStorage.getItem('g_tok') && Date.now() < parseInt(localStorage.getItem('g_exp') || '0');
}

// ── API helper ─────────────────────────────────────────────────────────────
async function api(url, opts = {}) {
  const token = await signIn();
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Drive helpers ──────────────────────────────────────────────────────────
async function getFolder() {
  const cached = localStorage.getItem('g_folder');
  if (cached) return cached;

  const name = 'Fakturaer 2026';
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);

  let id;
  if (res.files.length > 0) {
    id = res.files[0].id;
  } else {
    const f = await api('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
    });
    id = f.id;
  }
  localStorage.setItem('g_folder', id);
  return id;
}

async function getSheet(folderId) {
  const cached = localStorage.getItem('g_sheet');
  if (cached) return cached;

  const name = 'Regnskab 2026';
  const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
  const res = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);

  let id;
  if (res.files.length > 0) {
    id = res.files[0].id;
  } else {
    const f = await api('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [folderId] }),
    });
    id = f.id;
    await api(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/A1?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({
        values: [['Faktura nr', 'Dato', 'Forfald', 'Kunde', 'Ydelse', 'Ekskl. moms', 'Moms 25%', 'Inkl. moms', 'Betalt']],
      }),
    });
  }
  localStorage.setItem('g_sheet', id);
  return id;
}

// ── Invoice number ─────────────────────────────────────────────────────────
function nextNr() {
  const year = new Date().getFullYear();
  const key  = `inv_seq_${year}`;
  const n    = (parseInt(localStorage.getItem(key) || '0')) + 1;
  localStorage.setItem(key, String(n));
  return `${year}-${String(n).padStart(3, '0')}`;
}

function fmtDate(d) {
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtKr(n) {
  return n.toLocaleString('da-DK') + ' kr';
}

// ── Main: create invoice ───────────────────────────────────────────────────
export async function createInvoice({ appointment, customer }) {
  const folderId = await getFolder();
  const sheetId  = await getSheet(folderId);

  const nr        = nextNr();
  const date      = new Date();
  const due       = new Date(date); due.setDate(due.getDate() + FIRMA.betalingsfrist);
  const amount    = appointment.price || 0;
  const exclMoms  = Math.round(amount / 1.25);
  const moms      = amount - exclMoms;
  const service   = appointment.title || 'Haveservice';
  const custName  = customer?.name    || '';
  const custAddr  = customer?.address || '';
  const custPhone = customer?.phone   || '';

  // ── Google Doc ─────────────────────────────────────────────────────────
  const line  = '─'.repeat(50);
  const dline = '═'.repeat(50);
  const text  = [
    FIRMA.navn,
    FIRMA.adresse,
    `Tlf: ${FIRMA.telefon}   |   E-mail: ${FIRMA.email}`,
    `CVR: ${FIRMA.cvr}`,
    '',
    dline,
    'F A K T U R A',
    dline,
    '',
    `Faktura nr.:   ${nr}`,
    `Dato:          ${fmtDate(date)}`,
    `Forfalder:     ${fmtDate(due)}`,
    '',
    'Faktureres til:',
    custName,
    custAddr,
    custPhone,
    '',
    line,
    'Beskrivelse                                  Beløb',
    line,
    service,
    '',
    `Ekskl. moms:                    ${fmtKr(exclMoms)}`,
    `Moms (25%):                     ${fmtKr(moms)}`,
    line,
    `TOTAL inkl. moms:               ${fmtKr(amount)}`,
    line,
    '',
    `Betales til:   Reg. ${FIRMA.bankReg}   Konto: ${FIRMA.bankKonto}`,
    `Betalingsfrist: ${FIRMA.betalingsfrist} dage netto`,
    `Reference:     Faktura ${nr}`,
    '',
    'Tak for handlen!',
    FIRMA.navn,
  ].join('\n');

  const docFile = await api('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    body: JSON.stringify({
      name: `Faktura ${nr} - ${custName}`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    }),
  });

  await api(`https://docs.googleapis.com/v1/documents/${docFile.id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text } }],
    }),
  });

  // ── Google Sheet row ───────────────────────────────────────────────────
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[nr, fmtDate(date), fmtDate(due), custName, service, exclMoms, moms, amount, 'Nej']],
      }),
    }
  );

  return { nr, docUrl: `https://docs.google.com/document/d/${docFile.id}/edit` };
}
