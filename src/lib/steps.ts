import { STAGES } from './stages';

/** Percorso del brano: step che spunta solo lo studio. L'artista vede solo la barra. */
export interface Step { id: string; label: string; done: boolean }

export const DEFAULT_STEPS = [
  'Provino ricevuto',
  'Registrazione voci',
  'Produzione / arrangiamento',
  'Mix',
  'Master',
  'Copertina',
  'Metadati e crediti',
  'Caricamento sul distributore',
  'Pubblicato',
];

export const newStepId = () => Math.random().toString(36).slice(2, 10);

export function stepsFromTemplate(template: string[]): Step[] {
  const list = template.length ? template : DEFAULT_STEPS;
  return list.map((label) => ({ id: newStepId(), label, done: false }));
}

/** Brani creati prima del percorso: ricava gli step dalla vecchia fase (0–6). */
export function stepsFromLegacyStage(stage: number, template: string[]): Step[] {
  const steps = stepsFromTemplate(template);
  const doneCount = stage >= 6 ? steps.length : Math.round(((stage + 1) / 7) * steps.length);
  return steps.map((s, i) => ({ ...s, done: i < doneCount }));
}

export interface Progress { pct: number; label: string; complete: boolean; done: number; total: number }

export function progressOf(steps: Step[]): Progress {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next = steps.find((s) => !s.done);
  if (!total) return { pct: 0, label: 'In preparazione', complete: false, done, total };
  if (!next) return { pct: 100, label: steps[total - 1].label, complete: true, done, total };
  return { pct, label: next.label, complete: false, done, total };
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colore della barra: dal grigio (0%) all'arancio fino all'ambra (100%). */
export function progressColor(pct: number): string {
  const colors = STAGES.map((s) => s.color);
  const x = Math.max(0, Math.min(1, pct / 100)) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(x));
  const t = x - i;
  const a = hexToRgb(colors[i]);
  const b = hexToRgb(colors[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
