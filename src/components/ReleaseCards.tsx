import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, Track } from '../lib/music';
import { Cover } from './Cover';
import { CoverDownload } from './CoverDownload';

const fmt = (key: string) => new Date(`${key}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

function StoreButtons({ t, primary }: { t: Track; primary?: boolean }) {
  return (
    <>
      {t.links.spotify && <a className={`btn btn-sm${primary ? ' btn-primary' : ''}`} href={t.links.spotify} target="_blank" rel="noreferrer">Spotify</a>}
      {t.links.apple && <a className="btn btn-sm" href={t.links.apple} target="_blank" rel="noreferrer">Apple Music</a>}
      {t.links.youtube && <a className="btn btn-sm" href={t.links.youtube} target="_blank" rel="noreferrer">YouTube</a>}
    </>
  );
}

/** Riquadro grande "Appena uscito": resta in home 30 giorni, o finché non esce un altro brano. */
export function JustReleased({ artistId, t, p, date, href }: { artistId: string; t: Track; p?: Project; date: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const link = t.links.spotify || t.links.apple || t.links.youtube || '';
  const share = async () => {
    const text = `Ascolta “${t.title}”, è uscito! 🔥`;
    try {
      if (navigator.share) await navigator.share({ title: t.title, text, url: link || undefined });
      else { await navigator.clipboard.writeText(link ? `${text} ${link}` : text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* condivisione annullata */ }
  };
  return (
    <section className="card card-glow released-card">
      <Link to={href} className="released-cover"><Cover src={p?.cover ?? null} title={p?.title ?? t.title} className="cover released-img" /></Link>
      <div className="released-body">
        <span className="hero-kicker">Appena uscito · {fmt(date)}</span>
        <Link to={href} className="h2" style={{ color: 'var(--text)', fontSize: 28 }}>{t.title}</Link>
        {p && p.type !== 'singolo' && <span className="small muted">dall’{p.type === 'ep' ? 'EP' : 'album'} “{p.title}”</span>}
        <div className="row-actions">
          <StoreButtons t={t} primary />
          <button className="btn btn-sm" onClick={() => void share()}>{copied ? 'Link copiato ✓' : 'Condividi'}</button>
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
        <span className="hero-kicker">In uscita</span>
        <span className="h2">{p.title}</span>
        <span className="small muted">{days === 1 ? 'Esce domani' : `Esce tra ${days} giorni`} · {fmt(p.releaseDate)}</span>
      </div>
    </section>
  );
}

/** Discografia: tutti i brani usciti, dal giorno dopo l'uscita. */
export function Discography({ artistId, items, hrefOf }: { artistId: string; items: { t: Track; p?: Project; date: string }[]; hrefOf: (t: Track) => string }) {
  if (!items.length) return null;
  return (
    <section className="section">
      <h2 className="h2">Discografia</h2>
      <div className="disco-grid">
        {items.map(({ t, p, date }) => (
          <div key={t.id} className="card disco-item">
            <Link to={hrefOf(t)}><Cover src={p?.cover ?? null} title={p?.title ?? t.title} className="cover disco-img" /></Link>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
              <Link to={hrefOf(t)} style={{ color: 'var(--text)', fontWeight: 600 }}>{t.title}</Link>
              <span className="tiny muted">{fmt(date)}</span>
              <div className="row-actions"><StoreButtons t={t} /></div>
              {p && <CoverDownload artistId={artistId} project={p} small />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
