import { t } from './i18n';
// Traduce gli errori di Firebase in messaggi chiari in italiano.
export function errorMessage(e: unknown): string {
  const raw = (e as { code?: unknown })?.code;
  const code = typeof raw === 'string' ? raw : ''; // gli errori del browser hanno codici numerici
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Nome utente o password non corretti.',
    'auth/wrong-password': 'Password non corretta.',
    'auth/user-not-found': 'Nessun account con questo nome utente.',
    'auth/invalid-email': 'L’indirizzo email non è valido.',
    'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
    'auth/network-request-failed': 'Connessione assente. Controlla la rete e riprova.',
    'auth/email-already-in-use': 'Questo nome utente è già usato da un altro artista.',
    'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'auth/requires-recent-login': 'Per sicurezza esci e rientra, poi riprova.',
    'permission-denied': 'Non hai i permessi per questa operazione.',
    unavailable: 'Servizio non raggiungibile. Riprova tra poco.',
  };
  if (map[code]) return t(map[code]);
  if (e instanceof Error && e.message && !code) return t(e.message);
  return t('Qualcosa non ha funzionato. Riprova.');
}
