import { focusStyle } from '../../lib/types';
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useArtist } from '../../lib/data';
import { COOKIE_URL, PRIVACY_URL } from '../../lib/legal';
import { usernameOf } from '../../lib/username';
import { useBadges } from '../../lib/useBadges';
import { BadgeGrid } from '../../components/Celebration';
import { Loading } from '../../components/Loading';

type InstallEvt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function InstallGuide() {
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone);
  const [os, setOs] = useState<'ios' | 'android'>(isIOS ? 'ios' : 'android');
  const [prompt, setPrompt] = useState<InstallEvt | undefined>((window as unknown as { installPrompt?: InstallEvt }).installPrompt);
  if (installed) {
    return (
      <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="h2">App installata ✓</h2>
        <p className="small muted" style={{ margin: 0 }}>Stai usando Emotion Studio come app dalla schermata Home.</p>
      </section>
    );
  }
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    (window as unknown as { installPrompt?: InstallEvt }).installPrompt = undefined;
    setPrompt(undefined);
  };
  return (
    <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="h2">Installa l’app sul telefono</h2>
      <p className="small muted" style={{ margin: 0 }}>Così la apri dalla home come una normale app, a schermo intero.</p>
      {prompt && <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => void install()}>Installa ora</button>}
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

export function Profile() {
  const { artistId, user, logout } = useAuth();
  const { artist, loading } = useArtist(artistId);
  const { badges } = useBadges(artistId, artist?.createdMs ?? Date.now(), null, false);
  if (loading) return <Loading />;
  if (!artist) return null;
  const links = Object.entries(artist.links).filter(([, v]) => v);

  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {artist.photo && <span style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', flexShrink: 0 }}><img src={artist.photo} alt="" style={{ width: 72, height: 72, objectFit: 'cover', ...focusStyle(artist.photoFocus) }} /></span>}
          <div>
            <h1 className="display" style={{ fontSize: 38 }}>{artist.stageName}</h1>
            <span className="small muted">{artist.realName}</span>
          </div>
        </div>

        {artist.bio && <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#D6D6D2' }}>{artist.bio}</p>}

        <section className="card list">
          <div className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span className="muted small">Nome utente</span><span className="small" style={{ overflowWrap: 'anywhere' }}>{usernameOf(user?.email ?? '')}</span>
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

        <section className="section">
          <h2 className="h2">I miei traguardi</h2>
          <BadgeGrid badges={badges} />
        </section>

        <InstallGuide />
        <p className="small muted" style={{ margin: 0 }}>Hai perso la password? Scrivi allo studio: te ne prepara una nuova.</p>

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
