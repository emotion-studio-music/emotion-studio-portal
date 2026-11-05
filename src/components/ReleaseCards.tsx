import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, Track } from '../lib/music';
import { locale, t } from '../lib/i18n';
import { Cover } from './Cover';
import { CoverDownload } from './CoverDownload';

const fmt = (key: string) => new Date(`${key}T12:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });

function StoreButtons({ track, primary }: { track: Track; primary?: boolean }) {
  return (
    <>
      {track.links.spotify && <a className={`btn btn-sm${primary ? ' btn-primary' : ''}`} href={track.links.spotify} target="_blank" rel="noreferrer">Spotify</a>}
      {track.links.apple && <a className="btn btn-sm" href={track.links.apple} target="_blank" rel="noreferrer">Apple Music</a>}
      {track.links.youtube && <a className="btn btn-sm" href={track.links.youtube} target="_blank" rel="noreferrer">YouTube</a>}
    </>
  );
}

/** Riquadro grande "Appena uscito": resta in home 30 giorni, o finché non esce un altro brano. */
export function JustReleased({ artistId, t: track, p, date, href }: { artistId: string; t: Track; p?: Project; date: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const link = track.links.spotify || track.links.apple || track.links.youtube || '';
  const share = async () => {
    const text = t('Ascolta “{titolo}”, è uscito! 🔥', { titolo: track.title });
    try {
      if (navigator.share) await navigator.share({ title: track.title, text, url: link || undefined });
      else { await navigator.clipboard.writeText(link ? `${text} ${link}` : text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* condivisione annullata */ }
  };
  return (
    <section className="card card-glow released-card">
      <Link to={href} className="released-cover" aria-label={track.title}><Cover src={p?.cover ?? null} title={p?.title ?? track.title} className="cover released-img" /></Link>
      <div className="released-body">
        <span className="hero-kicker">{t('Appena uscito · {data}', { data: fmt(date) })}</span>
        <Link to={href} className="h2" style={{ color: 'var(--text)', fontSize: 28 }}>{track.title}</Link>
        {p && p.type !== 'singolo' && <span className="small muted">{p.type === 'ep' ? t('dall’EP “{titolo}”', { titolo: p.title }) : t('dall’album “{titolo}”', { titolo: p.title })}</span>}
        <div className="row-actions">
          <StoreButtons track={track} primary />
          <button className="btn btn-sm" onClick={() => void share()}>{copied ? t('Link copiato ✓') : t('Condividi')}</button>
          {p && <CoverDownload artistId={artistId} project={p} small />}
        </div>
      </div>
    </section>
  );
}

/** "In uscita": progetto con data di pubblicazione futura, con il conto alla rovescia. */
export function UpcomingRelease({ p, days }: { p: Project; days: number }) {
  return (
    <section className="card card-pad upcoming-card">
      <Cover src={p.cover} title={p.title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="hero-kicker">{t('In uscita')}</span>
        <span className="h2">{p.title}</span>
        <span className="small muted">{days === 1 ? t('Esce domani') : t('Esce tra {n} giorni', { n: days })} · {fmt(p.releaseDate)}</span>
      </div>
    </section>
  );
}

/** Discografia: tutti i brani usciti, dal giorno dopo l'uscita. */
export function Discography({ artistId, items, hrefOf }: { artistId: string; items: { t: Track; p?: Project; date: string }[]; hrefOf: (t: Track) => string }) {
  if (!items.length) return null;
  return (
    <section className="section">
      <h2 className="h2">{t('Discografia')}</h2>
      <div className="disco-grid">
        {items.map(({ t: track, p, date }) => (
          <div key={track.id} className="card disco-item">
            <Link to={hrefOf(track)} aria-label={track.title}><Cover src={p?.cover ?? null} title={p?.title ?? track.title} className="cover disco-img" /></Link>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
              <Link to={hrefOf(track)} style={{ color: 'var(--text)', fontWeight: 600 }}>{track.title}</Link>
              <span className="tiny muted">{fmt(date)}</span>
              <div className="row-actions"><StoreButtons track={track} /></div>
              {p && <CoverDownload artistId={artistId} project={p} small />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
