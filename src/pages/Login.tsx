import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { errorMessage } from '../lib/errors';
import { toLoginEmail } from '../lib/username';
import { LANGS, rememberDeviceLang, setLang, t, useLang } from '../lib/i18n';

export function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const lang = useLang();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, toLoginEmail(email), password);
      } else {
        if (!email.includes('@')) {
          setInfo(t('Per una nuova password scrivi allo studio: te la prepara in un attimo.'));
          return;
        }
        await sendPasswordResetEmail(auth, email.trim());
        setInfo(t('Se l’email è registrata, riceverai un link per scegliere una nuova password. Controlla anche lo spam.'));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="logo" src="/logo.png" alt="Emotion Studio" />
        <div className="seg" role="group" aria-label="Lingua / Language" style={{ alignSelf: 'center' }}>
          {LANGS.map((l) => (
            <button key={l.value} type="button" aria-pressed={lang === l.value} onClick={() => { setLang(l.value); rememberDeviceLang(l.value); setError(null); setInfo(null); }}>{l.label}</button>
          ))}
        </div>
        <div className="card card-pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h1 className="h2">{mode === 'login' ? t('Entra nella tua area') : t('Recupera la password')}</h1>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              {mode === 'login'
                ? t('Usa il nome utente e la password che ti ha dato lo studio.')
                : t('Gli artisti chiedono una nuova password direttamente allo studio. Se entri con un’email, inseriscila qui.')}
            </p>
          </div>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>{mode === 'login' ? t('Nome utente') : 'Email'}</span>
              <input className="input" type="text" inputMode={mode === 'login' ? 'text' : 'email'} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode === 'login' && (
              <label className="field">
                <span>Password</span>
                <input className="input" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {info && <div className="alert alert-ok" role="status">{info}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? t('Attendi…') : mode === 'login' ? t('Entra') : t('Invia il link')}
            </button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}
            onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(null); setInfo(null); }}>
            {mode === 'login' ? t('Password dimenticata?') : t('Torna all’accesso')}
          </button>
        </div>
        <p className="tiny muted" style={{ textAlign: 'center', margin: 0 }}>
          {t('L’accesso è riservato agli artisti di Emotion Studio.')}
        </p>
      </div>
    </div>
  );
}
