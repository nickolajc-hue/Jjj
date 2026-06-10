import { FIRMA } from './googleDrive.js';

function pad(n) { return String(n).padStart(2, '0'); }

function toICSDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// Returns a local-time ICS datetime string (no Z = floating/local time)
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

// Groups appointments by date and creates one timed block-event per day.
// startTime: "HH:MM" — the start of the work day (from MinDag's STARTTIME_KEY)
export function generateICS(appointments, customers = {}, startTime = '08:00') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KundeApp//KundeApp//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // Group by date (YYYY-MM-DD)
  const byDate = {};
  appointments.forEach(appt => {
    const key = appt.date.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(appt);
  });

  Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, appts]) => {
    const totalWorkMin = appts.reduce((s, a) => s + (a.duration || 60), 0);
    // Add rough travel buffer: 15 min per appointment transition
    const travelMin = Math.max(0, appts.length - 1) * 15;
    const totalMin = totalWorkMin + travelMin;

    const endTime = addMinutes(startTime, totalMin);

    const dtstart = toICSDateTime(date, startTime);
    const dtend   = toICSDateTime(date, endTime);

    const customerNames = appts
      .map(a => (a.customerId ? customers[a.customerId]?.name : null) || a.title || 'Opgave')
      .filter(Boolean)
      .join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:day-${date}@kundeapp`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${FIRMA.navn}`);
    lines.push(`DESCRIPTION:${customerNames}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
