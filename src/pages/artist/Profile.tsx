import { useState, type FormEvent } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../../lib/auth';
import { useArtist } from '../../lib/data';
import { errorMessage } from '../../lib/errors';
import { COOKIE_URL, PRIVACY_URL } from '../../lib/legal';
import { Loading } from '../../components/Loading';

function InstallGuide() {
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [os, setOs] = useState<'ios' | 'android'>(isIOS ? 'ios' : 'android');
  return (
    <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="h2">Installa l’app sul telefono</h2>
      <p className="small muted" style={{ margin: 0 }}>Così la apri dalla home come una normale app, a schermo intero.</p>
      <div className="seg" role="group" aria-label="Sistema operativo">
        <button type="button" aria-pressed={os === 'ios'} onClick={() => setOs('ios')}>iPhone</button>
        <button type="button" aria-pressed={os === 'android'} onClick={() => setOs('android')}>Android</button>
      </div>
      {os === 'ios' ? (
        <ol className="steps">
          <li>Apri questa pagina con <strong>Safari</strong> (non funziona da altri browser).</li>
          <li>Tocca il pulsante <strong>Condividi</strong> (il quadrato con la freccia in su).</li>
          <li>Scorri e scegli <strong>Aggiungi alla schermata Home</strong>.</li>
          <li>Tocca <strong>Aggiungi</strong>. Apri l’app dall’icona Emotion ed entra di nuovo con email e password.</li>
        </ol>
      ) : (
        <ol className="steps">
          <li>Apri questa pagina con <strong>Chrome</strong>.</li>
          <li>Tocca il menu <strong>⋮</strong> in alto a destra.</li>
          <li>Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.</li>
          <li>Conferma: trovi l’icona Emotion tra le tue app.</li>
        </ol>
      )}
    </section>
  );
}

function ChangePassword() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (next.length < 8) { setMsg({ ok: false, text: 'La nuova password deve avere almeno 8 caratteri.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      setCurrent(''); setNext('');
      setMsg({ ok: true, text: 'Password cambiata.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad">
      <form className="form" onSubmit={submit}>
        <h2 className="h2">Cambia password</h2>
        <label className="field"><span>Password attuale</span>
          <input className="input" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="field"><span>Nuova password</span>
          <input className="input" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
          <small>Almeno 8 caratteri.</small>
        </label>
        {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Attendi…' : 'Cambia password'}</button>
      </form>
    </section>
  );
}

export function Profile() {
  const { artistId, user, logout } = useAuth();
  const { artist, loading } = useArtist(artistId);
  if (loading) return <Loading />;
  if (!artist) return null;
  const links = Object.entries(artist.links).filter(([, v]) => v);

  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {artist.photo && <img src={artist.photo} alt="" style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover', objectPosition: '50% 30%' }} />}
          <div>
            <h1 className="display" style={{ fontSize: 38 }}>{artist.stageName}</h1>
            <span className="small muted">{artist.realName}</span>
          </div>
        </div>

        {artist.bio && <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#D6D6D2' }}>{artist.bio}</p>}

        <section className="card list">
          <div className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span className="muted small">Email di accesso</span><span className="small" style={{ overflowWrap: 'anywhere' }}>{user?.email}</span>
          </div>
          {artist.phone && (
            <div className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span className="muted small">Telefono</span><span className="small">{artist.phone}</span>
            </div>
          )}
          {links.map(([k, v]) => (
            <div key={k} className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span className="muted small" style={{ textTransform: 'capitalize' }}>{k}</span>
              <a className="small" href={v} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>Apri</a>
            </div>
          ))}
        </section>
        <p className="tiny muted" style={{ margin: '-18px 0 0' }}>Per modificare questi dati scrivi allo studio.</p>

        <InstallGuide />
        <ChangePassword />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <button className="btn btn-danger" onClick={() => void logout()}>Esci</button>
          <span className="tiny muted">
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy Policy</a> · <a href={COOKIE_URL} target="_blank" rel="noreferrer">Cookie Policy</a>
          </span>
        </div>
      </div>
    </div>
  );
}
