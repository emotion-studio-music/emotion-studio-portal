import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/data';
import { trackSteps, useSharedTracks } from '../lib/music';
import { progressOf } from '../lib/steps';
import { TrackProgress } from './TrackProgress';

/** Brani di altri artisti dello studio in cui sei in feat. */
export function SharedTracks() {
  const { user } = useAuth();
  const tracks = useSharedTracks(user?.uid ?? null);
  const { settings } = useSettings();
  if (!tracks.length) return null;
  return (
    <section className="section">
      <h2 className="h2">Collaborazioni</h2>
      <div className="card">
        {tracks.map((t) => (
          <Link key={`${t.ownerArtistId}-${t.id}`} to={`/feat/${t.ownerArtistId}/${t.id}`} className="track-row" style={{ borderTop: 'none' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span>
              <span className="tiny muted">con {t.ownerName || 'un altro artista'}{t.awaitingReview ? ' · nuova versione da ascoltare' : ''}</span>
            </span>
            <TrackProgress progress={progressOf(trackSteps(t, settings.stepTemplate))} compact />
          </Link>
        ))}
      </div>
    </section>
  );
}
