import type { ArtistLinks } from '../lib/types';

const NAMES: Record<keyof ArtistLinks, string> = { instagram: 'Instagram', spotify: 'Spotify', tiktok: 'TikTok', youtube: 'YouTube' };

const Icon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);

/** Pulsanti dei social dell'artista: si vedono solo quelli inseriti nel profilo. */
export function SocialLinks({ links }: { links: ArtistLinks }) {
  const items = (Object.keys(NAMES) as (keyof ArtistLinks)[]).filter((k) => links[k]);
  if (!items.length) return null;
  return (
    <div className="social-row">
      {items.map((k) => (
        <a key={k} href={links[k]} target="_blank" rel="noreferrer" className="social-btn" aria-label={NAMES[k]} title={NAMES[k]}>
          <Icon /><span>{NAMES[k]}</span>
        </a>
      ))}
    </div>
  );
}
