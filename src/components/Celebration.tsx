import { useMemo } from 'react';
import type { Badge } from '../lib/badges';
import type { Track } from '../lib/music';

const COLORS = ['#FFB547', '#F16D2F', '#E2452B', '#F4F4F1', '#FF8A4C'];

/** Festa a schermo intero quando si sblocca un traguardo. */
export function Celebration({ badge, track, onClose }: { badge: Badge; track?: Track; onClose: () => void }) {
  const confetti = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.6,
    color: COLORS[i % COLORS.length], rot: Math.random() * 360, w: 6 + Math.random() * 6,
  })), []);
  const links = track?.links ?? {};
  return (
    <div className="celebration" role="dialog" aria-modal="true" aria-label={badge.title} onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span key={i} style={{ left: `${c.left}%`, background: c.color, width: c.w, height: c.w * 1.6, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }} />
        ))}
      </div>
      <div className="celebration-card" onClick={(e) => e.stopPropagation()}>
        <div className="badge-medal big" aria-hidden="true">{badge.emoji}</div>
        <span className="hero-kicker">Nuovo traguardo</span>
        <h2 className="display" style={{ fontSize: 'clamp(30px, 8vw, 44px)', textAlign: 'center' }}>{badge.title}</h2>
        <p className="muted" style={{ margin: 0, textAlign: 'center' }}>{badge.desc}</p>
        <div className="row-actions" style={{ justifyContent: 'center' }}>
          {links.spotify && <a className="btn btn-primary btn-sm" href={links.spotify} target="_blank" rel="noreferrer">Ascolta su Spotify</a>}
          {links.apple && <a className="btn btn-sm" href={links.apple} target="_blank" rel="noreferrer">Apple Music</a>}
          {links.youtube && <a className="btn btn-sm" href={links.youtube} target="_blank" rel="noreferrer">YouTube</a>}
        </div>
        <button className="btn btn-block" onClick={onClose}>Grande! 🎉</button>
      </div>
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <div className="badge-grid">
      {badges.map((b) => (
        <div key={b.id} className={`badge-tile${b.unlocked ? '' : ' locked'}`} title={b.desc}>
          <div className="badge-medal" aria-hidden="true">{b.unlocked ? b.emoji : '🔒'}</div>
          <span className="small" style={{ fontWeight: 600, textAlign: 'center' }}>{b.title}</span>
        </div>
      ))}
    </div>
  );
}
