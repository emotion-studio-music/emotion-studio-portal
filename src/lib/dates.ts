const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const DAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-11-03" nel fuso orario locale */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-03T18:00" → Date locale (null se vuoto o non valido) */
export function parseAt(at: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(at);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

export function nextDays(count: number): { key: string; dayShort: string; day: number; monthShort: string; label: string }[] {
  const out = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push({
      key: toDateKey(d),
      dayShort: i === 0 ? 'oggi' : i === 1 ? 'domani' : DAYS_SHORT[d.getDay()],
      day: d.getDate(),
      monthShort: MONTHS_SHORT[d.getMonth()],
      label: `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}`,
    });
  }
  return out;
}

/** Giorno relativo: "Oggi", "Domani" oppure "Martedì" (entro 6 giorni) o "Martedì 12" */
export function relativeDay(d: Date): string {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start) / 86_400_000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff > 1 && diff < 7) return cap(DAYS[d.getDay()]);
  return `${cap(DAYS[d.getDay()])} ${d.getDate()}`;
}

export function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function longDate(d: Date): string {
  return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthShort(d: Date): string {
  return MONTHS_SHORT[d.getMonth()];
}

/** La sessione è ancora da mostrare? (fino a 6 ore dopo l'inizio) */
export function isUpcoming(d: Date): boolean {
  return d.getTime() + 6 * 3_600_000 > Date.now();
}
