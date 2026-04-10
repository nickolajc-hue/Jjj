const CUSTOMERS_KEY = 'kundeapp_customers';
const APPOINTMENTS_KEY = 'kundeapp_appointments';
const DAY_RECORDS_KEY = 'kundeapp_day_records';

export function getCustomers() {
  try { return JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]'); }
  catch { return []; }
}
export function saveCustomers(c) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(c));
}
export function getAppointments() {
  try { return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY) || '[]'); }
  catch { return []; }
}
export function saveAppointments(a) {
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(a));
}
export function newId() {
  return crypto.randomUUID();
}
export function getDayRecords() {
  try { return JSON.parse(localStorage.getItem(DAY_RECORDS_KEY) || '{}'); }
  catch { return {}; }
}
export function saveDayRecords(r) {
  localStorage.setItem(DAY_RECORDS_KEY, JSON.stringify(r));
}
export function getDayKey(appointmentId, date) {
  const d = new Date(date);
  return `${appointmentId}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const CUSTOM_EQUIPMENT_KEY = 'kundeapp_custom_equipment';
export function getCustomEquipment() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_EQUIPMENT_KEY) || '[]'); }
  catch { return []; }
}
export function saveCustomEquipment(items) {
  localStorage.setItem(CUSTOM_EQUIPMENT_KEY, JSON.stringify(items));
}

export const APPOINTMENT_COLORS = [
  { id: 'blue',   hex: '#2563EB' },
  { id: 'green',  hex: '#16A34A' },
  { id: 'orange', hex: '#EA580C' },
  { id: 'red',    hex: '#DC2626' },
  { id: 'purple', hex: '#7C3AED' },
  { id: 'pink',   hex: '#DB2777' },
  { id: 'teal',   hex: '#0891B2' },
  { id: 'gray',   hex: '#4B5563' },
];

export function getApptColor(appt) {
  const c = APPOINTMENT_COLORS.find(c => c.id === appt?.color);
  return c ? c.hex : '#2563EB';
}

const PHOTOS_KEY = 'kundeapp_photos';
export function getApptPhotos(apptId) {
  try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || '{}')[apptId] || []; }
  catch { return []; }
}
export function saveApptPhotos(apptId, photos) {
  try {
    const all = JSON.parse(localStorage.getItem(PHOTOS_KEY) || '{}');
    localStorage.setItem(PHOTOS_KEY, JSON.stringify({ ...all, [apptId]: photos }));
  } catch { throw new Error('storage_full'); }
}

export const RECURRENCE_LABELS = {
  none:     'Ingen gentagelse',
  daily:    'Daglig',
  weekly:   'Ugentlig',
  biweekly: 'Hver 2. uge',
  monthly:  'Månedlig',
  custom:   'Tilpasset interval',
};

export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} ${h === 1 ? 'time' : 'timer'}`;
  return `${h} t ${m} min`;
}

export function formatRecurrence(appt) {
  if (!appt.recurrence || appt.recurrence === 'none') return null;
  if (appt.recurrence === 'custom') {
    const w = appt.recurrenceInterval || 1;
    return `Hver ${w}. uge`;
  }
  return RECURRENCE_LABELS[appt.recurrence] || null;
}

export const EQUIPMENT_LIST = [
  'Plæneklipper', 'Kantklipper', 'Hækkeklipper', 'Løvblæser',
  'Greensuge', 'Trillebør', 'Rive', 'Spade', 'Vandslange',
  'Trailer', 'Stige', 'Motorsav',
];

export function calcExpectedIncome(appointments, startDate, endDate) {
  return appointments.reduce((sum, a) => {
    if (!a.price || a.price <= 0) return sum;
    let count = 0;
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    while (d < end) {
      if (occursOnDate(a, d)) count++;
      d.setDate(d.getDate() + 1);
    }
    return sum + a.price * count;
  }, 0);
}

export function occursOnDate(appt, targetDate) {
  const start = new Date(appt.date);
  const target = new Date(targetDate);
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (t < s) return false;

  // Respekter slutdato
  if (appt.recurrenceEndDate) {
    const e = new Date(appt.recurrenceEndDate); e.setHours(0, 0, 0, 0);
    if (t > e) return false;
  }

  if (!appt.recurrence || appt.recurrence === 'none') return s.getTime() === t.getTime();

  const diffDays = Math.round((t - s) / 86400000);
  switch (appt.recurrence) {
    case 'daily':    return true;
    case 'weekly':   return diffDays % 7 === 0;
    case 'biweekly': return diffDays % 14 === 0;
    case 'monthly':  return s.getDate() === t.getDate() &&
      (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth()) >= 0;
    case 'custom': {
      const weeks = Math.max(1, appt.recurrenceInterval || 1);
      return diffDays % (weeks * 7) === 0;
    }
    default: return false;
  }
}

export function nextOccurrence(appt) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(appt.date);
  start.setHours(0, 0, 0, 0);

  if (!appt.recurrence || appt.recurrence === 'none') return start;
  if (start >= today) return start;

  const diff = Math.ceil((today - start) / 86400000);
  let next;
  switch (appt.recurrence) {
    case 'daily': next = today; break;
    case 'weekly': {
      const rem = diff % 7;
      next = new Date(today);
      if (rem !== 0) next.setDate(next.getDate() + (7 - rem));
      break;
    }
    case 'biweekly': {
      const rem = diff % 14;
      next = new Date(today);
      if (rem !== 0) next.setDate(next.getDate() + (14 - rem));
      break;
    }
    case 'monthly': {
      next = new Date(today);
      next.setDate(start.getDate());
      if (next < today) next.setMonth(next.getMonth() + 1);
      break;
    }
    case 'custom': {
      const weeks = Math.max(1, appt.recurrenceInterval || 1);
      const period = weeks * 7;
      const rem = diff % period;
      next = new Date(today);
      if (rem !== 0) next.setDate(next.getDate() + (period - rem));
      break;
    }
    default: return start;
  }

  // Respekter slutdato
  if (appt.recurrenceEndDate) {
    const endD = new Date(appt.recurrenceEndDate); endD.setHours(0, 0, 0, 0);
    if (next > endD) return endD;
  }
  return next;
}
