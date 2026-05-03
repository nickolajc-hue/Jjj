const CLIENT_ID = '243575332428-69692bubcsahm1pvpsgpb7vjaa5rvnha.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');
const SCOPE_VER = 'v5'; // bump when scopes change to force re-auth

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
  // Force re-auth if scopes have changed
  if (localStorage.getItem('g_scope_ver') !== SCOPE_VER) {
    ['g_tok','g_exp','g_folder','g_sheet'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('g_scope_ver', SCOPE_VER);
  }
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

async function getSheet() {
  const cached = localStorage.getItem('g_sheet');
  if (cached) return JSON.parse(cached);

  const name = 'GronRude_Regnskab_2025';
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const res = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);

  if (res.files.length === 0) throw new Error(`Kunne ikke finde dokumentet "${name}" i dit Google Drev`);

  const id = res.files[0].id;

  const meta = await api(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties(title,sheetId)`);
  const sheets = meta.sheets.map(s => s.properties);
  const found = sheets.find(s => s.title.toLowerCase() === 'bilag');
  if (!found) throw new Error(`Fandt ingen fane der hedder "Bilag" i ${name}. Faner: ${sheets.map(s=>s.title).join(', ')}`);

  const result = { id, tab: found.title, tabId: found.sheetId };
  localStorage.setItem('g_sheet', JSON.stringify(result));
  return result;
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
// Serial number avoids locale issues (Danish Sheets uses ; not , in formulas)
function sheetsSerial(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
}
function sheetsDate(d) {
  return sheetsSerial(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function sheetsDateFromStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return sheetsSerial(y, m, d);
}
function fmtKr(n) {
  return n.toLocaleString('da-DK') + ' kr';
}

// ── Share doc publicly (anyone with link can view) ─────────────────────────
async function shareDoc(fileId) {
  await api(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
}

function mimeEncode(str) {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(str)))}?=`;
}

// ── Send invoice email via Gmail API ───────────────────────────────────────
async function sendInvoiceEmail({ to, custName, nr, service, amount, due, docUrl }) {
  const subject = mimeEncode(`Faktura ${nr} fra ${FIRMA.navn}`);
  const body = [
    `Kære ${custName},`,
    '',
    `Tak for dit besøg! Herunder finder du faktura ${nr} for ${service}.`,
    '',
    `Faktura nr.:     ${nr}`,
    `Beløb:           ${fmtKr(amount)} (momsfritaget)`,
    `Forfaldsdato:    ${fmtDate(due)}`,
    '',
    'Beløbet bedes indbetalt til:',
    `Reg.nr. ${FIRMA.bankReg}  /  Kontonr. ${FIRMA.bankKonto}`,
    `Husk at angive faktura nr. ${nr} ved bankoverførsel.`,
    '',
    `Se faktura online: ${docUrl}`,
    '',
    'Med venlig hilsen',
    FIRMA.navn,
    `Tlf: ${FIRMA.telefon}`,
    FIRMA.email,
  ].join('\n');

  const mime = [
    `From: ${mimeEncode(FIRMA.navn)} <${FIRMA.email}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    body,
  ].join('\r\n');

  // base64url encode
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await api('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  });
}

// ── Build formatted Google Doc ─────────────────────────────────────────────
async function buildDoc(folderId, { nr, date, due, amount, service, custName, custAddr, custPhone }) {
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
  seg(`${pad('Momsfritaget (CVR: ' + FIRMA.cvr + ')', '')}\n`,          { size: 10, color: GRAY });
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

  return { docUrl: `https://docs.google.com/document/d/${docId}/edit`, docId };
}

// ── Bilag 2026 folder for receipt photos ──────────────────────────────────
async function getBilagFolder() {
  const cached = localStorage.getItem('g_bilag_folder');
  if (cached) return cached;
  const name = 'Bilag 2026';
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
  localStorage.setItem('g_bilag_folder', id);
  return id;
}

async function uploadPhoto(file, expenseDate, expenseDesc) {
  const folderId = await getBilagFolder();
  const token = await signIn();
  const ext = (file.name || 'jpg').split('.').pop();
  const safeName = expenseDesc.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, '_').slice(0, 40);
  const metadata = JSON.stringify({ name: `Kvittering_${expenseDate}_${safeName}.${ext}`, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  const data = await res.json();
  await shareDoc(data.id);
  return data.webViewLink;
}

// ── Write expense to Udgifter sheet ───────────────────────────────────────
export async function writeExpense(expense, photoFile) {
  const { id: sheetId } = await getSheet();
  const meta = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(title)`);
  const tabs = meta.sheets.map(s => s.properties.title);
  const udTab = tabs.find(t => t.toLowerCase().includes('udgift'));
  if (!udTab) throw new Error(`Ingen fane med "udgift" — faner: ${tabs.join(', ')}`);

  let photoUrl = '';
  if (photoFile) {
    try { photoUrl = await uploadPhoto(photoFile, expense.date, expense.description); }
    catch (e) { console.warn('Foto upload fejl:', e.message); }
  }

  const tab = encodeURIComponent(udTab);
  const check = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!B3:B200`);
  const filled = (check.values || []).filter(r => r && r[0]);
  const row = 3 + filled.length;

  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!B${row}:J${row}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[
          sheetsDateFromStr(expense.date),                                                  // B Dato
          expense.description,                                                               // C Leverandør
          expense.type === 'kørsel' ? `${expense.fra || ''}→${expense.til || ''}` : '',    // D Beskrivelse
          expense.category,                                                                  // E Kategori
          expense.amount,                                                                    // F Beløb ekskl. moms
          0,                                                                                 // G Moms (momsfritaget)
          '',                                                                                // H Betalingsmetode
          expense.type === 'kørsel' ? `${expense.km} km × ${expense.rate} kr/km` : '',     // I Kørsel info
          photoUrl,                                                                          // J Foto link
        ]],
      }),
    }
  );
}

// ── Write SUMPRODUCT formulas to Oversigt tab ─────────────────────────────
async function setupOversigt(sheetId, bilagTabName) {
  const meta = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(title)`);
  const tabs = meta.sheets.map(s => s.properties.title);
  const oversigtTab = tabs.find(t => t.toLowerCase() === 'oversigt');
  if (!oversigtTab) return;
  const udTab = tabs.find(t => t.toLowerCase().includes('udgift'));

  const cols = 'BCDEFGHIJKLM'.split('');
  const row5 = [], row6 = [], row7 = [], row8 = [];

  for (let m = 1; m <= 12; m++) {
    const col = cols[m - 1];
    row5.push(`=SUMPRODUCT((${bilagTabName}!$B$3:$B$200<>"")*(MONTH(${bilagTabName}!$B$3:$B$200)=${m})*(YEAR(${bilagTabName}!$B$3:$B$200)=YEAR(TODAY()))*${bilagTabName}!$F$3:$F$200)`);
    row6.push(udTab
      ? `=SUMPRODUCT((${udTab}!$B$3:$B$200<>"")*(MONTH(${udTab}!$B$3:$B$200)=${m})*(YEAR(${udTab}!$B$3:$B$200)=YEAR(TODAY()))*${udTab}!$F$3:$F$200)`
      : '0');
    row7.push(`=${col}5-${col}6`);
    row8.push('0');
  }

  const ovEncoded = encodeURIComponent(oversigtTab);
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${ovEncoded}!B5:M8?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [row5, row6, row7, row8] }) }
  );
  localStorage.setItem('g_oversigt_v3', '1');
}

// ── Fetch actual revenue + expenses from sheet ────────────────────────────
export async function fetchRegnskab() {
  const { id: sheetId, tab: bilagTabName } = await getSheet();
  const meta = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties(title)`);
  const tabs = meta.sheets.map(s => s.properties.title);
  const udTabName = tabs.find(t => t.toLowerCase().includes('udgift'));

  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  // Read B-F columns; dates come back as serial numbers with UNFORMATTED_VALUE
  const bilagEnc = encodeURIComponent(bilagTabName);
  const bilagRes = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${bilagEnc}!B3:F200?valueRenderOption=UNFORMATTED_VALUE`);
  const udRes = udTabName
    ? await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(udTabName)}!B3:F200?valueRenderOption=UNFORMATTED_VALUE`)
    : null;

  // Convert Google Sheets serial date to JS Date (UTC)
  function fromSerial(s) {
    const n = Number(s);
    if (!n || isNaN(n)) return null;
    return new Date((n - 25569) * 86400 * 1000);
  }

  function sumRows(rows, amtIdx, year, month) {
    return (rows || []).reduce((acc, r) => {
      const d = fromSerial(r?.[0]);
      if (!d) return acc;
      if (d.getUTCFullYear() !== year) return acc;
      if (month && d.getUTCMonth() + 1 !== month) return acc;
      return acc + (parseFloat(r[amtIdx]) || 0);
    }, 0);
  }

  const bilagRows = (bilagRes.values || []).filter(r => r?.[0]);
  const udRows = (udRes?.values || []).filter(r => r?.[0]);

  // Bilag: B=Dato(0), F=Beløb ekskl. moms(4)
  // Udgifter: B=Dato(0), F=Beløb(4)
  return {
    omsætning: {
      monthly: Math.round(sumRows(bilagRows, 4, curYear, curMonth)),
      yearly:  Math.round(sumRows(bilagRows, 4, curYear, null)),
    },
    udgifter: {
      monthly: Math.round(sumRows(udRows, 4, curYear, curMonth)),
      yearly:  Math.round(sumRows(udRows, 4, curYear, null)),
    },
  };
}

// ── Mark an invoice as paid in the sheet ─────────────────────────────────
export async function markInvoicePaid(nr) {
  const { id: sheetId, tab: sheetTab } = await getSheet();
  const tab = encodeURIComponent(sheetTab);
  const res = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!I3:I200`);
  const rows = res.values || [];
  const rowIdx = rows.findIndex(r => r?.[0] === nr);
  if (rowIdx === -1) throw new Error(`Faktura ${nr} ikke fundet i regnearket`);
  const writeRow = 3 + rowIdx;
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!J${writeRow}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [[sheetsDate(new Date())]] }) }
  );
}

// ── Fetch all invoices from the Bilag sheet ───────────────────────────────
export async function fetchInvoices() {
  const { id: sheetId, tab: sheetTab } = await getSheet();
  const tab = encodeURIComponent(sheetTab);
  const res = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!B3:J200?valueRenderOption=UNFORMATTED_VALUE`);
  function fromSerial(s) {
    const n = Number(s);
    if (!n || isNaN(n)) return null;
    const d = new Date((n - 25569) * 86400 * 1000);
    return `${d.getUTCDate()}/${d.getUTCMonth() + 1}-${d.getUTCFullYear()}`;
  }
  return (res.values || [])
    .filter(r => r?.[7]) // must have invoice number in column I (index 7)
    .map(r => ({
      date:     fromSerial(r[0]),
      kunde:    r[1] || '',
      service:  r[2] || '',
      beloeb:   Number(r[4]) || 0,
      nr:       r[7] || '',
      paidDate: r[8] ? fromSerial(r[8]) : null,
    }));
}

// ── Send email for an already-created invoice ─────────────────────────────
export async function sendInvoice({ customer, appointment, nr, docUrl }) {
  const amount   = appointment.price || 0;
  const service  = appointment.title || 'Haveservice';
  const custName = customer?.name    || '';
  const date     = appointment.date ? new Date(appointment.date) : new Date();
  const due      = new Date(date); due.setDate(due.getDate() + FIRMA.betalingsfrist);
  await sendInvoiceEmail({ to: customer.email, custName, nr, service, amount, due, docUrl });
}

// ── Main: create invoice ───────────────────────────────────────────────────
export async function createInvoice({ appointment, customer, sendEmail = true }) {
  const folderId = await getFolder();
  const { id: sheetId, tab: sheetTab, tabId } = await getSheet();

  const nr        = nextNr();
  const date      = appointment.date ? new Date(appointment.date) : new Date();
  const due       = new Date(date); due.setDate(due.getDate() + FIRMA.betalingsfrist);
  const amount    = appointment.price || 0;
  const service   = appointment.title || 'Haveservice';
  const custName  = customer?.name    || '';
  const custAddr  = customer?.address || '';
  const custPhone = customer?.phone   || '';

  // ── Formatted Google Doc ───────────────────────────────────────────────
  const { docUrl, docId } = await buildDoc(folderId, { nr, date, due, amount, service, custName, custAddr, custPhone });

  await shareDoc(docId);

  // ── Google Sheet row — find første tomme datarække ────────────────────
  const tab = encodeURIComponent(sheetTab);
  // Scan all data columns B–I; write after the last row that has ANY content
  const colCheck = await api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!B3:I200`);
  const rows = colCheck.values || [];
  let writeOffset = rows.length; // default: after all returned rows
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]?.some(c => c !== undefined && c !== null && c !== '')) {
      writeOffset = i; // first empty row
      break;
    }
  }
  const writeRow = 3 + writeOffset;
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tab}!B${writeRow}:I${writeRow}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[sheetsDate(date), custName, service, service, amount, 'Momsfritaget', amount, nr]],
      }),
    }
  );

  // ── Apply d/m date format to Bilag column B (non-critical) ──────────────
  if (tabId != null) {
    api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: { sheetId: tabId, startRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 },
            cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'd"/"m"-"yyyy' } } },
            fields: 'userEnteredFormat.numberFormat',
          },
        }],
      }),
    }).catch(() => {});
  }

  // ── Oversigt formulas (write once) ────────────────────────────────────
  if (!localStorage.getItem('g_oversigt_v3')) {
    setupOversigt(sheetId, sheetTab).catch(() => {});
  }

  // ── Send email via Gmail ───────────────────────────────────────────────
  let emailSent = false;
  if (sendEmail && customer?.email) {
    await sendInvoiceEmail({ to: customer.email, custName, nr, service, amount, due, docUrl });
    emailSent = true;
  }

  return { nr, docUrl, emailSent };
}
