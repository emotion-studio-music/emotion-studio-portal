import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/data';
import { trackSteps, useFeatTracks, useSharedTracks } from '../lib/music';
import { progressOf } from '../lib/steps';
import { TrackProgress } from './TrackProgress';
import { t } from '../lib/i18n';

/**
 * Brani di altri artisti dello studio in cui sei in feat.
 * Con `previewOf` (anteprima dello studio) mostra quelli dell'artista indicato.
 */
export function SharedTracks({ previewOf }: { previewOf?: string }) {
  const { user } = useAuth();
  const mine = useSharedTracks(previewOf ? null : user?.uid ?? null);
  const preview = useFeatTracks(previewOf ?? null);
  const tracks = previewOf ? preview : mine;
  const { settings } = useSettings();
  if (!tracks.length) return null;
  return (
    <section className="section">
      <h2 className="h2">{t('Collaborazioni')}</h2>
      <div className="card">
        {tracks.map((track) => (
          <Link key={`${track.ownerArtistId}-${track.id}`} to={previewOf ? `/admin/artisti/${track.ownerArtistId}/brani/${track.id}` : `/feat/${track.ownerArtistId}/${track.id}`} className="track-row" style={{ borderTop: 'none' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{track.title}</span>
              <span className="tiny muted">{t('con {nome}', { nome: track.ownerName || t('un altro artista') })}{track.awaitingReview ? ` · ${t('nuova versione da ascoltare')}` : ''}</span>
            </span>
            <TrackProgress progress={progressOf(trackSteps(track, settings.stepTemplate))} compact />
          </Link>
        ))}
      </div>
    </section>
  );
}
