const fmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** 125000 → "€ 1.250,00" */
export const eur = (cents: number) => fmt.format((cents || 0) / 100);

/** "1.250,50" / "1250.5" / "1250" → 125050 (centesimi). null se non valido. */
export function parseEuro(input: string): number | null {
  let s = input.replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
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
