import { progressOf } from './steps';
import { trackSteps, type Project, type Track } from './music';

/** Quanti giorni un brano resta in evidenza ("Appena uscito") nella home dell'artista. */
export const SPOTLIGHT_DAYS = 30;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00`); d.setDate(d.getDate() + n); return dayKey(d); };

export interface ReleaseInfo {
  complete: boolean;      // tutti gli step spuntati
  date: string;           // giorno di uscita ('' se non si sa)
  released: boolean;      // completo e la data di uscita è arrivata
  upcoming: boolean;      // ha una data di uscita futura
  inDiscography: boolean; // uscito da almeno un giorno
  daysToRelease: number;
}

/** Il giorno di uscita: la data del progetto se c'è, altrimenti quando hai spuntato l'ultimo step. */
export function releaseInfo(t: Track, project: Project | undefined, template: string[]): ReleaseInfo {
  const complete = progressOf(trackSteps(t, template)).complete;
  const today = dayKey(new Date());
  const fallback = t.publishedAt || (complete ? dayKey(new Date(t.updatedMs)) : '');
  const date = project?.releaseDate || fallback;
  const released = complete && !!date && date <= today;
  const upcoming = !!date && date > today;
  const days = date ? Math.round((new Date(`${date}T12:00`).getTime() - new Date(`${today}T12:00`).getTime()) / 86_400_000) : 0;
  return { complete, date, released, upcoming, inDiscography: released && date < today, daysToRelease: days };
}

/**
 * Il brano "Appena uscito" da mettere in evidenza: il più recente uscito negli ultimi 30 giorni.
 * Se nel frattempo esce un altro brano dello stesso artista, prende il suo posto.
 */
export function spotlightTrack(tracks: Track[], projects: Project[], template: string[]) {
  const today = dayKey(new Date());
  const out = tracks
    .map((t) => ({ t, p: projects.find((x) => x.id === t.projectId), r: releaseInfo(t, projects.find((x) => x.id === t.projectId), template) }))
    .filter((x) => x.r.released && addDays(x.r.date, SPOTLIGHT_DAYS) > today)
    .sort((a, b) => b.r.date.localeCompare(a.r.date) || b.t.updatedMs - a.t.updatedMs);
  return out[0] ?? null;
}
