import { t } from '../lib/i18n';
/** "Aggiungi al calendario": Google Calendar (link) e iPhone/Apple/Outlook (file .ics). */
export function AddToCalendar({ start, title, hours = 2 }: { start: Date; title: string; hours?: number }) {
  const end = new Date(start.getTime() + hours * 3_600_000);
  const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const details = t('Sessione in studio – trovi tutti i dettagli nell’app Emotion Studio.');
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${utc(start)}/${utc(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent('Emotion Studio')}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Emotion Studio//App//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${utc(start)}-${Math.random().toString(36).slice(2)}@emotionstudio`, `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${title.replace(/[,;]/g, ' ')}`, `DESCRIPTION:${details}`,
    'LOCATION:Emotion Studio', 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${t('Sessione in studio tra un’ora')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  return (
    <div className="row-actions" style={{ marginTop: 6 }}>
      <a className="btn btn-sm" href={google} target="_blank" rel="noreferrer">+ Google Calendar</a>
      <a className="btn btn-sm" href={icsHref} download="emotion-studio.ics">{t('+ iPhone / altri')}</a>
    </div>
  );
}
