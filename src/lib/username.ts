/**
 * Gli artisti entrano con NOME UTENTE + password decisi dallo studio.
 * Firebase vuole comunque un'email: la costruiamo noi su un sottodominio di efamusic.it
 * che non riceve posta (jayden → jayden@artisti.efamusic.it). Nessuna email arriva mai a nessuno.
 */
export const USER_DOMAIN = 'artisti.efamusic.it';

export function slugUsername(input: string): string {
  return input.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '.').replace(/^[.-]+|[.-]+$/g, '').slice(0, 40);
}

/** Quello che si scrive nel login → email per Firebase. Con la @ resta com'è (accesso dello studio). */
export function toLoginEmail(input: string): string {
  const v = input.trim().toLowerCase();
  return v.includes('@') ? v : `${slugUsername(v)}@${USER_DOMAIN}`;
}

/** Email interna → nome utente da mostrare. */
export function usernameOf(email: string): string {
  return email.endsWith(`@${USER_DOMAIN}`) ? email.slice(0, -USER_DOMAIN.length - 1) : email;
}

export const isUsernameAccount = (email: string) => email.endsWith(`@${USER_DOMAIN}`);
