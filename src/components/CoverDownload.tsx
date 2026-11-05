import { useState } from 'react';
import { mediaUrl } from '../lib/worker';
import type { Project } from '../lib/music';
import { t } from '../lib/i18n';

/** "Scarica copertina": compare solo se lo studio ha caricato l'originale e l'ha resa scaricabile. */
export function CoverDownload({ artistId, project, small }: { artistId: string; project: Project; small?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!project.coverFileId || !project.coverDownload) return null;
  const go = async () => {
    setBusy(true); setError(null);
    try { window.location.href = await mediaUrl(artistId, project.id, true, 'cover'); }
    catch (e) { setError(e instanceof Error ? t(e.message) : t('Download non riuscito.')); }
    finally { setBusy(false); }
  };
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" className={`btn ${small ? 'btn-sm' : ''}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void go(); }} disabled={busy}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12" /><path d="m6 10 6 6 6-6" /><path d="M4 20h16" /></svg>
        {busy ? t('Preparo…') : t('Scarica copertina')}
      </button>
      {error && <span className="tiny" style={{ color: 'var(--danger)' }}>{error}</span>}
    </span>
  );
}
