import { useState, type FormEvent } from 'react';
import { addComment, deleteComment, setResolved, type Comment } from '../lib/comments';
import { formatTime } from '../lib/audio';
import { errorMessage } from '../lib/errors';
import { locale, t } from '../lib/i18n';

interface Props {
  artistId: string;
  trackId: string;
  versionId: string;
  versionLabel: string;
  comments: Comment[]; // già filtrati per questa versione
  time: number;
  uid: string;
  role: 'admin' | 'artist';
  authorName: string;
  onSeek: (t: number) => void;
  highlight: string | null;
  collaboratorUids?: string[]; // feat: le note le vedono anche gli artisti in collaborazione
}

export function Comments(p: Props) {
  const [text, setText] = useState('');
  const [general, setGeneral] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = p.comments.filter((c) => !c.resolved);
  const list = (showResolved ? p.comments : open).slice().sort((a, b) =>
    (a.atSeconds ?? Infinity) - (b.atSeconds ?? Infinity) || a.createdMs - b.createdMs);
  const resolvedCount = p.comments.length - open.length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try {
      await addComment(p.artistId, {
        trackId: p.trackId, versionId: p.versionId, authorUid: p.uid, authorRole: p.role, authorName: p.authorName,
        text, atSeconds: general ? null : Math.round(p.time * 10) / 10,
      }, p.collaboratorUids ?? []);
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-head">
        <h2 className="h2">{t('Note di revisione')}</h2>
        <span className="small muted">{open.length === 1 ? t('1 da risolvere') : t('{n} da risolvere', { n: open.length })}</span>
      </div>

      <form className="form" onSubmit={submit} style={{ gap: 10 }}>
        <div className="row-actions" style={{ justifyContent: 'space-between' }}>
          <span className="small" style={{ fontWeight: 600 }}>
            {general ? t('Nota generale su {versione}', { versione: p.versionLabel }) : <>{t('Nota a')} <span className="time-chip static">{formatTime(p.time)}</span> {t('di {versione}', { versione: p.versionLabel })}</>}
          </span>
          <label className="check" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={general} onChange={(e) => setGeneral(e.target.checked)} />
            <span className="small">{t('Senza tempo')}</span>
          </label>
        </div>
        <textarea className="textarea" style={{ minHeight: 80 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          placeholder={general ? t('Scrivi una nota su tutto il brano…') : t('Tocca la forma d’onda o metti in pausa nel punto giusto, poi scrivi qui…')}
          aria-label={t('Testo della nota')} />
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy || !text.trim()}>{busy ? t('Invio…') : t('Aggiungi nota')}</button>
      </form>

      {list.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>{open.length === 0 && resolvedCount > 0 ? t('Tutte le note sono risolte.') : t('Ancora nessuna nota su questa versione.')}</p>
      ) : (
        <ul className="comment-list">
          {list.map((c) => (
            <li key={c.id} id={`nota-${c.id}`} className={`comment${c.resolved ? ' resolved' : ''}${p.highlight === c.id ? ' highlight' : ''}`}>
              <div className="comment-head">
                {c.atSeconds !== null
                  ? <button type="button" className="time-chip" onClick={() => p.onSeek(c.atSeconds!)} aria-label={t('Vai a {tempo}', { tempo: formatTime(c.atSeconds) })}>{formatTime(c.atSeconds)}</button>
                  : <span className="time-chip static">{t('Generale')}</span>}
                <span className="small" style={{ fontWeight: 600, color: c.authorRole === 'admin' ? 'var(--amber)' : 'var(--text)' }}>{c.authorName}</span>
                <span className="tiny muted">{new Date(c.createdMs).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</span>
              </div>
              <p className="comment-text">{c.text}</p>
              <div className="row-actions">
                <label className="check" style={{ alignItems: 'center' }}>
                  <input type="checkbox" checked={c.resolved} onChange={(e) => void setResolved(p.artistId, c.id, e.target.checked, p.uid).catch((err) => setError(errorMessage(err)))} />
                  <span className="small">{t('Risolto')}</span>
                </label>
                {(c.authorUid === p.uid || p.role === 'admin') && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                    if (confirm(t('Eliminare questa nota?'))) void deleteComment(p.artistId, c.id).catch((err) => setError(errorMessage(err)));
                  }}>{t('Elimina')}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {resolvedCount > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? t('Nascondi le note risolte') : t('Mostra le note risolte ({n})', { n: resolvedCount })}
        </button>
      )}
    </section>
  );
}
