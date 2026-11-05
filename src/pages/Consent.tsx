import { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/errors';
import { cookieUrl, policyOnlyItalian, privacyUrl } from '../lib/legal';
import { t } from '../lib/i18n';

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
          <h1 className="h2">{t('Prima di iniziare')}</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {t('Qui trovi i tuoi brani, le versioni da ascoltare e lo stato dei lavori. I brani restano tuoi: lo studio li conserva solo per lavorarci insieme. L’app usa solo cookie tecnici.')}
          </p>
          {policyOnlyItalian() && (
            <p className="tiny muted" style={{ margin: 0 }}>
              The Privacy and Cookie Policy are currently available in Italian only (your browser can translate them).
              In short: the studio keeps your tracks and details only to work with you, never shares them for marketing,
              and you can ask for them to be deleted at any time.
            </p>
          )}
          <label className="check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span className="small">
              {t('Ho letto e accetto la')} <a href={privacyUrl()} target="_blank" rel="noreferrer">Privacy Policy</a> {t('e la')} <a href={cookieUrl()} target="_blank" rel="noreferrer">Cookie Policy</a>.
            </span>
          </label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={!checked || busy} onClick={() => void accept()}>
            {busy ? t('Attendi…') : t('Continua')}
          </button>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => void logout()}>{t('Esci')}</button>
        </div>
      </div>
    </div>
  );
}
