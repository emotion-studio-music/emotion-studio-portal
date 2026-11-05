import { progressOf } from './steps';
import { trackSteps, type Project, type Track } from './music';
import { t } from './i18n';

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
    { id: 'primo-brano', emoji: '🎙️', title: t('Primo brano in studio'), desc: t('Il viaggio è cominciato.'), unlocked: tracks.length > 0 },
    { id: 'prima-demo', emoji: '💡', title: t('Prima demo inviata'), desc: t('Le idee migliori partono da un memo.'), unlocked: demos > 0 },
    { id: 'primo-master', emoji: '🎚️', title: t('Primo master'), desc: t('Suona come deve suonare.'), unlocked: mastered },
    { id: 'ore-10', emoji: '⏱️', title: t('10 ore in studio'), desc: t('La costanza fa la differenza.'), unlocked: hours >= 10 },
    { id: 'ore-50', emoji: '🔥', title: t('50 ore in studio'), desc: t('Ormai sei di casa.'), unlocked: hours >= 50 },
    { id: 'ore-100', emoji: '🏆', title: t('100 ore in studio'), desc: t('Un vero professionista.'), unlocked: hours >= 100 },
    { id: 'anno-1', emoji: '🎂', title: t('Un anno con Emotion Studio'), desc: t('Grazie per la fiducia.'), unlocked: years >= 1 },
  ];
  for (const x of published) {
    list.push({
      id: `pubblicato:${x.t.id}`, emoji: '🚀', title: t('“{titolo}” è sugli store', { titolo: x.t.title }),
      desc: t('Il tuo brano è ufficialmente disponibile sulle piattaforme. Condividilo!'), unlocked: true, trackId: x.t.id, big: true,
    });
  }
  for (const p of projects.filter((p) => p.type !== 'singolo')) {
    const its = all.filter((x) => x.t.projectId === p.id);
    if (its.length > 1 && its.every((x) => x.p.complete)) {
      list.push({ id: `progetto:${p.id}`, emoji: '💿', title: p.type === 'ep' ? t('EP “{titolo}” completato', { titolo: p.title }) : t('Album “{titolo}” completato', { titolo: p.title }), desc: t('Un intero progetto uscito. Enorme.'), unlocked: true, big: true });
    }
  }
  if (published.length === 0) {
    list.push({ id: 'primo-pubblicato', emoji: '🚀', title: t('Primo brano sugli store'), desc: t('Si sblocca quando il tuo primo brano esce.'), unlocked: false });
  }
  return list;
}
