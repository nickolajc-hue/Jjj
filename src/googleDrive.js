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

// ── Build formatted Google Doc ─────────────────────────────────────────────
async function buildDoc(folderId, { nr, date, due, amount, exclMoms, moms, service, custName, custAddr, custPhone }) {
  const GRAY = { red: 0.55, green: 0.55, blue: 0.55 };
  const BLUE = { red: 0.15, green: 0.37, blue: 0.92 };
  const LINE = '─'.repeat(54);

  // pad(label, value) — left label, right-padded value in 54 chars
  const pad = (label, value) => {
    const total = 54;
    const spaces = Math.max(1, total - label.length - value.length);
    return label + ' '.repeat(spaces) + value;
  };

  const parts = [];
  let idx = 1;
  const seg = (text, fmt = {}) => {
    const start = idx;
    idx += text.length;
    parts.push({ text, start, end: idx, ...fmt });
  };

  // ── Content ────────────────────────────────────────────────────────────
  seg(`${FIRMA.navn}\n`,                                                { bold: true, size: 20, color: BLUE });
  seg(`${FIRMA.adresse}\n`,                                             { size: 10, color: GRAY });
  seg(`Tlf: ${FIRMA.telefon}   ·   ${FIRMA.email}\n`,                  { size: 10, color: GRAY });
  seg(`CVR: ${FIRMA.cvr}\n`,                                            { size: 10, color: GRAY });
  seg('\n');
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg('FAKTURA\n',                                                      { bold: true, size: 26, center: true });
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg('\n');
  seg(`${pad('Faktura nr.:', nr)}\n`,                                   { size: 11 });
  seg(`${pad('Dato:', fmtDate(date))}\n`,                               { size: 11 });
  seg(`${pad('Forfaldsdato:', fmtDate(due))}\n`,                        { size: 11 });
  seg('\n');
  seg('Faktureres til:\n',                                              { bold: true, size: 11, color: GRAY });
  seg(`${custName}\n`,                                                  { bold: true, size: 13 });
  if (custAddr)  seg(`${custAddr}\n`,                                   { size: 11 });
  if (custPhone) seg(`${custPhone}\n`,                                  { size: 11 });
  seg('\n');
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg(`${pad('Beskrivelse', 'Beløb')}\n`,                               { bold: true, size: 11 });
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg(`${pad(service, fmtKr(amount))}\n`,                               { size: 11 });
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg('\n');
  seg(`${pad('Subtotal ekskl. moms:', fmtKr(exclMoms))}\n`,            { size: 11 });
  seg(`${pad('Moms 25%:', fmtKr(moms))}\n`,                            { size: 11 });
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg(`${pad('TOTAL DKK:', fmtKr(amount))}\n`,                         { bold: true, size: 13 });
  seg(`${LINE}\n`,                                                      { color: GRAY });
  seg('\n');
  seg(`Betalingsbetingelser: Netto ${FIRMA.betalingsfrist} dage — Forfaldsdato: ${fmtDate(due)}\n`, { bold: true, size: 10 });
  seg('\n');
  seg(`Beløbet indbetales på bankkonto:\n`,                             { size: 10 });
  seg(`Reg.nr. ${FIRMA.bankReg}  /  Kontonr. ${FIRMA.bankKonto}\n`,    { size: 10 });
  seg(`Faktura nr. ${nr} bedes angivet ved bankoverførsel\n`,           { size: 10 });
  seg('\n');
  seg(`${FIRMA.navn}  ·  ${FIRMA.adresse}  ·  CVR: ${FIRMA.cvr}  ·  ${FIRMA.email}\n`,
    { size: 9, color: GRAY, center: true });

  const fullText = parts.map(p => p.text).join('');

  // ── Create file ───────────────────────────────────────────────────────────
  const docFile = await api('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    body: JSON.stringify({
      name: `Faktura ${nr} - ${custName}`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    }),
  });
  const docId = docFile.id;

  // Insert all text
  await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: fullText } }],
    }),
  });

  // ── Apply formatting ───────────────────────────────────────────────────────
  const requests = [];

  for (const p of parts) {
    const textEnd = p.end - 1; // exclude \n from text styling
    if (textEnd > p.start) {
      const textStyle = {};
      const fields = [];
      if (p.bold)  { textStyle.bold = true; fields.push('bold'); }
      if (p.size)  { textStyle.fontSize = { magnitude: p.size, unit: 'PT' }; fields.push('fontSize'); }
      if (p.color) { textStyle.foregroundColor = { color: { rgbColor: p.color } }; fields.push('foregroundColor'); }
      if (fields.length > 0) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: p.start, endIndex: textEnd },
            textStyle, fields: fields.join(','),
          },
        });
      }
    }

    const paraStyle = {};
    const paraFields = [];
    if (p.center) { paraStyle.alignment = 'CENTER'; paraFields.push('alignment'); }
    if (paraFields.length > 0) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: p.start, endIndex: p.end },
          paragraphStyle: paraStyle,
          fields: paraFields.join(','),
        },
      });
    }
  }

  if (requests.length > 0) {
    await api(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  }

  return `https://docs.google.com/document/d/${docId}/edit`;
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

  // ── Formatted Google Doc ───────────────────────────────────────────────
  const docUrl = await buildDoc(folderId, { nr, date, due, amount, exclMoms, moms, service, custName, custAddr, custPhone });

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

  return { nr, docUrl };
}
