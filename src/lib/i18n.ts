import { useSyncExternalStore } from 'react';
import { EN } from './en';

/**
 * Lingua dell'app dell'artista. Lo studio vede sempre l'italiano; un artista vede la lingua scelta
 * nel suo profilo (campo `language`). Le frasi si scrivono in italiano nel codice e si passano a t():
 * la traduzione inglese sta in en.ts (stessa frase italiana come chiave). `npm run check:i18n`
 * segnala le frasi senza traduzione.
 */
export type Lang = 'it' | 'en';
export const LANGS: { value: Lang; label: string }[] = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
];

let current: Lang = 'it';
const listeners = new Set<() => void>();

export const getLang = () => current;
export const locale = () => (current === 'en' ? 'en-GB' : 'it-IT');

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

/** Lingua da usare prima del login: quella scelta qui l'ultima volta, altrimenti quella del telefono. */
export function deviceLang(): Lang {
  try {
    const saved = localStorage.getItem('lingua');
    if (saved === 'it' || saved === 'en') return saved;
  } catch { /* navigazione privata */ }
  return navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function rememberDeviceLang(l: Lang) {
  try { localStorage.setItem('lingua', l); } catch { /* navigazione privata */ }
}

/** Traduce una frase italiana. {nome} viene sostituito con vars.nome. In italiano resta com'è. */
export function t(it: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (EN[it] ?? it) : it;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Per i componenti che devono ridisegnarsi quando cambia la lingua (es. la schermata di accesso). */
export function useLang(): Lang {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, getLang);
}
