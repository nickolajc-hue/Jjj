import { FIRMA } from './googleDrive.js';
import { occursOnDate } from './storage.js';

const TZID = 'Europe/Copenhagen';

function pad(n) { return String(n).padStart(2, '0'); }

function toICSDateTime(dateStr, hhmm) {
  const d = new Date(dateStr);
  const [hh, mm] = hhmm.split(':').map(Number);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;
}

function addMinutes(hhmm, minutes) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const VTIMEZONE_CPH = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n');

// Expands all appointments (including recurring) into concrete (date, appt) pairs
// within the window [from, to].
function expandAppointments(appointments, from, to) {
  const result = {}; // date string -> [appt, ...]
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const dateStr = dateToStr(cursor);
    appointments.forEach(appt => {
      if (occursOnDate(appt, cursor)) {
        if (!result[dateStr]) result[dateStr] = [];
        result[dateStr].push(appt);
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// Groups appointments by date and creates one timed block-event per day.
// startTime: "HH:MM" — same value as shown in Min dag's Dagsplan.
// Expands recurring appointments over 30 days back to 365 days forward.
export function generateICS(appointments, customers = {}, startTime = '08:00') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KundeApp//KundeApp//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    VTIMEZONE_CPH,
  ];

  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);

  const byDate = expandAppointments(appointments, from, to);

  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, appts]) => {
    const totalWorkMin = appts.reduce((s, a) => s + (a.duration || 0), 0);
    const endTime = totalWorkMin > 0 ? addMinutes(startTime, totalWorkMin) : addMinutes(startTime, 60);

    const dtstart = toICSDateTime(date, startTime);
    const dtend   = toICSDateTime(date, endTime);

    const customerNames = appts
      .map(a => (a.customerId ? customers[a.customerId]?.name : null) || a.title || 'Opgave')
      .filter(Boolean)
      .join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:day-${date}@kundeapp`);
    lines.push(`DTSTART;TZID=${TZID}:${dtstart}`);
    lines.push(`DTEND;TZID=${TZID}:${dtend}`);
    lines.push(`SUMMARY:${FIRMA.navn}`);
    lines.push(`DESCRIPTION:${customerNames}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
