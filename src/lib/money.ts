import { locale } from './i18n';

const fmts: Record<string, Intl.NumberFormat> = {};

/** 125000 → "1.250,00 €" (in inglese "€1,250.00") */
export const eur = (cents: number) => {
  const l = locale();
  fmts[l] ??= new Intl.NumberFormat(l, { style: 'currency', currency: 'EUR' });
  return fmts[l].format((cents || 0) / 100);
};

/** "1.250,50" / "1250.5" / "1250" → 125050 (centesimi). null se non valido. */
export function parseEuro(input: string): number | null {
  let s = input.replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.250" all'italiana = 1250
  const n = Number(s);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Link PayPal.me con importo già inserito, se nelle impostazioni c'è un link paypal.me */
export function paypalLink(setting: string, cents: number): string | null {
  const m = /paypal\.me\/([A-Za-z0-9_.-]+)/i.exec(setting);
  if (!m) return null;
  return `https://www.paypal.me/${m[1]}/${(cents / 100).toFixed(2)}EUR`;
}
