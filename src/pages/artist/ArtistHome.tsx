import { Link } from 'react-router-dom';
import { useArtist, useSettings } from '../../lib/data';
import { Loading } from '../../components/Loading';
import { IconArrowLeft, IconCalendar } from '../../components/Icons';
import type { NextSession } from '../../lib/types';
import { isUpcoming, longDate, monthShort, parseAt, relativeDay, timeOf } from '../../lib/dates';

function NextSessionCard({ session }: { session: NextSession }) {
  const d = parseAt(session.at);
  // Vecchio formato (solo testo) o sessione senza data
  if (!d) {
    if (!session.note) return null;
    return (
      <div className="card session-card">
        <div className="session-icon"><IconCalendar /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="tiny muted" style={{ fontWeight: 500 }}>Prossima sessione</span>
          <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'pre-line' }}>{session.note}</span>
        </div>
      </div>
    );
  }
  if (!isUpcoming(d)) return null;
  return (
    <div className="card session-card">
      <div className="session-date" aria-hidden="true">
        <small>{monthShort(d)}</small>
        <strong>{d.getDate()}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className="tiny muted" style={{ fontWeight: 500 }}>Prossima sessione</span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {relativeDay(d)} ore {timeOf(d)}{session.type ? ` · ${session.type}` : ''}
        </span>
        <span className="small muted">{longDate(d)}{session.note ? ` — ${session.note}` : ''}</span>
      </div>
    </div>
  );
}

interface Props {
  artistId: string;
  /** true quando l'admin guarda l'anteprima: mostra la barra per tornare indietro */
  preview?: boolean;
}

export function ArtistHome({ artistId, preview }: Props) {
  const { artist, loading } = useArtist(artistId);
  const { settings } = useSettings();
  if (loading) return <Loading />;
  if (!artist) return <div className="stack"><div className="empty">Profilo non trovato.</div></div>;

  return (
    <div className="artist-main">
      <header className="hero">
        {artist.photo
          ? <img className="hero-photo" src={artist.photo} alt="" />
          : <div className="hero-fallback" />}
        <div className="hero-top">
          {preview
            ? <Link to={`/admin/artisti/${artist.id}`} className="btn btn-sm" style={{ background: 'rgba(10,10,11,.6)' }}><IconArrowLeft width={18} height={18} /> Esci dall’anteprima</Link>
            : <img src="/logo.png" alt="Emotion Studio" />}
        </div>
        <div className="hero-bottom">
          <span className="hero-kicker">Artista di Emotion Studio</span>
          <h1 className="display hero-name">{artist.stageName}</h1>
          {artist.genres.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {artist.genres.map((g) => <span key={g} className="chip">{g}</span>)}
            </div>
          )}
        </div>
      </header>

      <div className="stack">
        <NextSessionCard session={artist.nextSession} />

        {settings.welcomeText && (
          <p className="small muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{settings.welcomeText}</p>
        )}

        <section className="section">
          <div className="section-head"><h2 className="h2">Da ascoltare</h2></div>
          <div className="empty">
            <strong>Nessuna versione nuova</strong>
            Quando lo studio carica un mix o un master lo trovi qui, pronto da ascoltare e commentare.
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">I miei progetti</h2>
            {!preview && <Link to="/progetti" className="small" style={{ fontWeight: 600 }}>Vedi tutti</Link>}
          </div>
          <div className="empty">
            <strong>Ancora nessun progetto</strong>
            Singoli ed EP compariranno qui con lo stato di ogni brano, da “Ricevuto” a “Pubblicato”.
          </div>
        </section>

        <section className="section">
          <h2 className="h2">Da fare</h2>
          <div className="empty">
            <strong>Tutto in ordine</strong>
            Qui vedrai le cose da preparare prima della prossima sessione.
          </div>
        </section>
      </div>
    </div>
  );
}
