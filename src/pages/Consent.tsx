import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/errors';
import { PRIVACY_URL, COOKIE_URL } from '../lib/legal';

export function Consent() {
  const { user, refresh, logout } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        privacyAcceptedAt: serverTimestamp(),
        privacyVersion: '2026-10',
      }, { merge: true });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="logo" src="/logo.png" alt="Emotion Studio" />
        <div className="card card-pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h1 className="h2">Prima di iniziare</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Qui trovi i tuoi brani, le versioni da ascoltare e lo stato dei lavori. I brani restano tuoi:
            lo studio li conserva solo per lavorarci insieme. L’app usa solo cookie tecnici.
          </p>
          <label className="check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span className="small">
              Ho letto e accetto la <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> e
              la <a href={COOKIE_URL} target="_blank" rel="noreferrer">Cookie Policy</a>.
            </span>
          </label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={!checked || busy} onClick={() => void accept()}>
            {busy ? 'Attendi…' : 'Continua'}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => void logout()}>Esci</button>
        </div>
      </div>
    </div>
  );
}
