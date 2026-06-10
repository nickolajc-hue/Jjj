import { FIRMA } from './googleDrive.js';

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

// Groups appointments by date and creates one timed block-event per day.
// startTime: "HH:MM" — same value as shown in Min dag's Dagsplan
export function generateICS(appointments, customers = {}, startTime = '08:00') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KundeApp//KundeApp//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    VTIMEZONE_CPH,
  ];

  // Group by date (YYYY-MM-DD)
  const byDate = {};
  appointments.forEach(appt => {
    const key = appt.date.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(appt);
  });

  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, appts]) => {
    // Same formula as Min dag: sum of durations, no travel (can't geocode here)
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
