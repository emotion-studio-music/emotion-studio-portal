import { useEffect, useState } from 'react';
import { calendarNext, calendarUpcoming, type CalendarEvent } from './worker';
import type { NextSession } from './types';

/**
 * Prossima sessione dell'artista: prima dal Google Calendar dello studio,
 * altrimenti quella scritta a mano nel profilo.
 */
export function useNextSession(artistId: string | null, manual: NextSession | undefined) {
  const [fromCalendar, setFromCalendar] = useState<NextSession | null>(null);
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    if (!artistId) return;
    let alive = true;
    calendarNext(artistId)
      .then((r) => {
        if (!alive) return;
        setConfigured(r.configured);
        setFromCalendar(r.session ? { at: r.session.at, type: r.session.type, note: manual?.note ?? '' } : null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [artistId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { session: fromCalendar ?? manual ?? null, fromCalendar: !!fromCalendar, configured };
}

export function useCalendarUpcoming(enabled: boolean) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<string>('Controllo Google Calendar…');
  useEffect(() => {
    if (!enabled) return;
    calendarUpcoming()
      .then((r) => {
        setConfigured(r.configured); setEvents(r.events);
        setStatus(r.configured ? `Google Calendar collegato · ${r.events.length} eventi nei prossimi 60 giorni` : 'Google Calendar non collegato: nel Worker manca il segreto CALENDAR_ICS_URL.');
      })
      .catch((e) => setStatus(`Google Calendar non raggiungibile: ${e instanceof Error ? e.message : 'errore'} (se hai appena aggiornato, controlla di aver incollato il nuovo worker.js).`));
  }, [enabled]);
  return { events, configured, status };
}

/** Trova l'artista citato nel titolo dell'evento (stessa regola del Worker). */
export function artistInTitle<T extends { stageName: string }>(title: string, artists: T[]): T | undefined {
  const norm = (x: string) => x.toLowerCase();
  return artists.find((a) => {
    const n = norm(a.stageName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return n && new RegExp(`(^|[^\\p{L}\\p{N}])${n}($|[^\\p{L}\\p{N}])`, 'iu').test(title);
  });
}
