const CUSTOMERS_KEY = 'kundeapp_customers';
const APPOINTMENTS_KEY = 'kundeapp_appointments';

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

export function occursOnDate(appt, targetDate) {
  const start = new Date(appt.date);
  const target = new Date(targetDate);
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (t < s) return false;
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
  switch (appt.recurrence) {
    case 'daily': return today;
    case 'weekly': {
      const rem = diff % 7;
      const d = new Date(today);
      if (rem !== 0) d.setDate(d.getDate() + (7 - rem));
      return d;
    }
    case 'biweekly': {
      const rem = diff % 14;
      const d = new Date(today);
      if (rem !== 0) d.setDate(d.getDate() + (14 - rem));
      return d;
    }
    case 'monthly': {
      const d = new Date(today);
      d.setDate(start.getDate());
      if (d < today) d.setMonth(d.getMonth() + 1);
      return d;
    }
    case 'custom': {
      const weeks = Math.max(1, appt.recurrenceInterval || 1);
      const period = weeks * 7;
      const rem = diff % period;
      const d = new Date(today);
      if (rem !== 0) d.setDate(d.getDate() + (period - rem));
      return d;
    }
    default: return start;
  }
}
