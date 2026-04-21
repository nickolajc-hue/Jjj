function pad(n) { return String(n).padStart(2, '0'); }

function toICSDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function makeRRule(appt) {
  if (!appt.recurrence || appt.recurrence === 'none') return null;
  let rule;
  switch (appt.recurrence) {
    case 'daily':    rule = 'FREQ=DAILY'; break;
    case 'weekly':   rule = 'FREQ=WEEKLY'; break;
    case 'biweekly': rule = 'FREQ=WEEKLY;INTERVAL=2'; break;
    case 'monthly':  rule = 'FREQ=MONTHLY'; break;
    case 'custom': {
      const w = Math.max(1, appt.recurrenceInterval || 1);
      rule = `FREQ=WEEKLY;INTERVAL=${w}`;
      break;
    }
    default: return null;
  }
  if (appt.recurrenceEndDate) {
    rule += `;UNTIL=${toICSDate(appt.recurrenceEndDate)}T235959Z`;
  }
  return `RRULE:${rule}`;
}

function nextDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function generateICS(appointments, customers = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KundeApp//KundeApp//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  appointments.forEach(appt => {
    const dtstart = toICSDate(appt.date);
    const dtend   = nextDay(appt.date);
    const customer = appt.customerId ? customers[appt.customerId] : null;
    const desc = customer ? customer.name : '';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${appt.id}@kundeapp`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${(appt.title || 'Opgave').replace(/[\\;,]/g, s => '\\' + s)}`);
    if (desc) lines.push(`DESCRIPTION:${desc.replace(/[\\;,]/g, s => '\\' + s)}`);

    const rrule = makeRRule(appt);
    if (rrule) lines.push(rrule);

    if (appt.exceptions && appt.exceptions.length > 0) {
      const exdates = appt.exceptions.map(toICSDate).join(',');
      lines.push(`EXDATE;VALUE=DATE:${exdates}`);
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
