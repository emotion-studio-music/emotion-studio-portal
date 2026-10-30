import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { errorMessage } from '../lib/errors';

export function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo('Se l’email è registrata, riceverai un link per scegliere una nuova password. Controlla anche lo spam.');
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
        <div className="card card-pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h1 className="h2">{mode === 'login' ? 'Entra nella tua area' : 'Recupera la password'}</h1>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              {mode === 'login'
                ? 'Usa l’email e la password che ti ha dato lo studio.'
                : 'Inserisci la tua email: ti mandiamo un link per sceglierne una nuova.'}
            </p>
          </div>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" autoComplete="email" inputMode="email" required
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
              {busy ? 'Attendi…' : mode === 'login' ? 'Entra' : 'Invia il link'}
            </button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}
            onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(null); setInfo(null); }}>
            {mode === 'login' ? 'Password dimenticata?' : 'Torna all’accesso'}
          </button>
        </div>
        <p className="tiny muted" style={{ textAlign: 'center', margin: 0 }}>
          L’accesso è riservato agli artisti di Emotion Studio.
        </p>
      </div>
    </div>
  );
}
