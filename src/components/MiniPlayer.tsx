import { useLocation, useNavigate } from 'react-router-dom';
import { usePlayer } from '../lib/player';
import { Cover } from './Cover';

/** Mini player fisso: la musica continua mentre navighi. Tocca per tornare al brano. */
export function MiniPlayer({ bottom }: { bottom: string }) {
  const pl = usePlayer();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!pl.track || pathname === pl.track.href) return null;
  const v = pl.activeVersion;
  const dur = pl.duration || v?.duration || 0;
  const pct = dur ? Math.min(100, (pl.time / dur) * 100) : 0;

  return (
    <div className="mini-player" style={{ bottom }}>
      <div className="mini-progress"><div style={{ width: `${pct}%`, background: pl.track.color }} /></div>
      <div className="mini-inner">
        <button className="mini-open" onClick={() => navigate(pl.track!.href)} aria-label={`Apri ${pl.track.title}`}>
          <Cover src={pl.track.cover} title={pl.track.title} className="cover mini-cover" />
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left' }}>
            <span className="mini-title">{pl.track.title}</span>
            <span className="tiny muted">{v?.label}{pl.versions.B ? ` · ${pl.active}` : ''}{pl.loopOn ? ' · loop' : ''}</span>
          </span>
        </button>
        <button className="mini-play" onClick={pl.toggle} aria-label={pl.playing ? 'Pausa' : 'Riproduci'}>
          {pl.playing
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>}
        </button>
        <button className="mini-close" onClick={pl.close} aria-label="Chiudi il lettore">✕</button>
      </div>
    </div>
  );
}
