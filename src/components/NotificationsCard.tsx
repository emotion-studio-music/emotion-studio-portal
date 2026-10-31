import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, testPush, type PushState } from '../lib/push';
import { errorMessage } from '../lib/errors';

const TEXT: Record<PushState, string> = {
  'non-supportato': 'Questo browser non supporta le notifiche. Su computer usa Chrome, Edge o Safari aggiornati.',
  'installa-prima': 'Su iPhone le notifiche funzionano solo dall’app installata: prima aggiungila alla schermata Home (guida qui sotto), poi aprila da lì e torna in questa pagina.',
  'non-configurato': 'Le notifiche non sono ancora configurate dallo studio.',
  bloccato: 'Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser o del telefono (Notifiche → Emotion Studio).',
  spento: 'Ricevi un avviso quando c’è qualcosa di nuovo, senza aprire l’app.',
  attivo: 'Attive su questo dispositivo.',
};

/** Notifiche su questo dispositivo: attiva, prova, disattiva. */
export function NotificationsCard({ who }: { who: 'artist' | 'admin' }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refresh = () => void pushState().then(setState).catch(() => setState('non-supportato'));
  useEffect(refresh, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorMessage(e) }); } finally { setBusy(false); refresh(); }
  };
  const list = who === 'artist'
    ? 'nuove versioni da ascoltare, note dello studio, richieste di pagamento, cose da fare, brano uscito'
    : 'note degli artisti, demo nuove, pagamenti segnalati';

  return (
    <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="section-head">
        <h2 className="h2">Notifiche</h2>
        {state === 'attivo' && <span className="badge badge-on">Attive</span>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{state ? TEXT[state] : 'Controllo…'}</p>
      {(state === 'spento' || state === 'attivo') && <p className="tiny muted" style={{ margin: 0 }}>Ti avvisiamo per: {list}.</p>}
      <div className="row-actions">
        {state === 'spento' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(enablePush, 'Notifiche attivate. Prova a mandarne una!')}>Attiva notifiche</button>}
        {state === 'attivo' && <button className="btn btn-sm" disabled={busy} onClick={() => void run(testPush, 'Notifica di prova inviata: dovrebbe arrivare tra pochi secondi.')}>Invia una prova</button>}
        {state === 'attivo' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(disablePush, 'Notifiche disattivate su questo dispositivo.')}>Disattiva</button>}
      </div>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</div>}
    </section>
  );
}
