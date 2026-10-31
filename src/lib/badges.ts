import { progressOf } from './steps';
import { trackSteps, type Project, type Track } from './music';

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  unlocked: boolean;
  trackId?: string;
  big?: boolean; // traguardo importante: festa a schermo intero
}

interface Input {
  createdMs: number;
  tracks: Track[];
  projects: Project[];
  demos: number;
  hours: number;
  template: string[];
}

/** Traguardi calcolati dai dati dell'artista: si sbloccano da soli. */
export function computeBadges({ createdMs, tracks, projects, demos, hours, template }: Input): Badge[] {
  const prog = (t: Track) => {
    const steps = trackSteps(t, template);
    return { steps, p: progressOf(steps) };
  };
  const all = tracks.map((t) => ({ t, ...prog(t) }));
  const published = all.filter((x) => x.p.complete);
  const mastered = all.some((x) => x.steps.some((s) => s.done && /master/i.test(s.label)));
  const years = (Date.now() - createdMs) / (365.25 * 86_400_000);

  const list: Badge[] = [
    { id: 'primo-brano', emoji: '🎙️', title: 'Primo brano in studio', desc: 'Il viaggio è cominciato.', unlocked: tracks.length > 0 },
    { id: 'prima-demo', emoji: '💡', title: 'Prima demo inviata', desc: 'Le idee migliori partono da un memo.', unlocked: demos > 0 },
    { id: 'primo-master', emoji: '🎚️', title: 'Primo master', desc: 'Suona come deve suonare.', unlocked: mastered },
    { id: 'ore-10', emoji: '⏱️', title: '10 ore in studio', desc: 'La costanza fa la differenza.', unlocked: hours >= 10 },
    { id: 'ore-50', emoji: '🔥', title: '50 ore in studio', desc: 'Ormai sei di casa.', unlocked: hours >= 50 },
    { id: 'ore-100', emoji: '🏆', title: '100 ore in studio', desc: 'Un vero professionista.', unlocked: hours >= 100 },
    { id: 'anno-1', emoji: '🎂', title: 'Un anno con Emotion Studio', desc: 'Grazie per la fiducia.', unlocked: years >= 1 },
  ];
  for (const x of published) {
    list.push({
      id: `pubblicato:${x.t.id}`, emoji: '🚀', title: `“${x.t.title}” è sugli store`,
      desc: 'Il tuo brano è ufficialmente disponibile sulle piattaforme. Condividilo!', unlocked: true, trackId: x.t.id, big: true,
    });
  }
  for (const p of projects.filter((p) => p.type !== 'singolo')) {
    const its = all.filter((x) => x.t.projectId === p.id);
    if (its.length > 1 && its.every((x) => x.p.complete)) {
      list.push({ id: `progetto:${p.id}`, emoji: '💿', title: `${p.type === 'ep' ? 'EP' : 'Album'} “${p.title}” completato`, desc: 'Un intero progetto uscito. Enorme.', unlocked: true, big: true });
    }
  }
  if (published.length === 0) {
    list.push({ id: 'primo-pubblicato', emoji: '🚀', title: 'Primo brano sugli store', desc: 'Si sblocca quando il tuo primo brano esce.', unlocked: false });
  }
  return list;
}
