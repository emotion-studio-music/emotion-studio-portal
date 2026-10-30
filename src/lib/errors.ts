// Traduce gli errori di Firebase in messaggi chiari in italiano.
export function errorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email o password non corrette.',
    'auth/wrong-password': 'Password non corretta.',
    'auth/user-not-found': 'Nessun account con questa email.',
    'auth/invalid-email': 'L’indirizzo email non è valido.',
    'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
    'auth/network-request-failed': 'Connessione assente. Controlla la rete e riprova.',
    'auth/email-already-in-use': 'Esiste già un account con questa email.',
    'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'auth/requires-recent-login': 'Per sicurezza esci e rientra, poi riprova.',
    'permission-denied': 'Non hai i permessi per questa operazione.',
    unavailable: 'Servizio non raggiungibile. Riprova tra poco.',
  };
  if (map[code]) return map[code];
  if (e instanceof Error && e.message && !code) return e.message;
  return 'Qualcosa non ha funzionato. Riprova.';
}
