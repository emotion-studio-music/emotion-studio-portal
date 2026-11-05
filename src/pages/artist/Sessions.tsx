import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { fmtDay, useSessions } from '../../lib/business';
import { useTracks } from '../../lib/music';
import { IconArrowLeft } from '../../components/Icons';
import { locale, t } from '../../lib/i18n';

export function Sessions() {
  const { artistId } = useAuth();
  const sessions = useSessions(artistId).sort((a, b) => b.date.localeCompare(a.date));
  const { tracks } = useTracks(artistId);
  const total = sessions.reduce((s, x) => s + x.hours, 0);

  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))' }}>
        <Link to="/" className="back-link"><IconArrowLeft width={18} height={18} /> {t('Home')}</Link>
        <h1 className="display" style={{ fontSize: 44 }}>{t('Sessioni')}</h1>
        <div className="card card-pad money-hero">
          <span className="small muted">{t('Ore in studio')}</span>
          <span className="money-big">{total.toLocaleString(locale())} h</span>
          <span className="small muted">{sessions.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: sessions.length })}</span>
        </div>
        {sessions.length === 0 ? <div className="empty">{t('Le sessioni in studio compariranno qui.')}</div> : (
          <div className="card list">
            {sessions.map((s) => (
              <div key={s.id} className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="section-head">
                  <span style={{ fontWeight: 600 }}>{t(s.type)}</span>
                  <span className="small" style={{ fontWeight: 700 }}>{s.hours.toLocaleString(locale())} h</span>
                </div>
                <span className="tiny muted">{fmtDay(s.date)}{s.trackIds.length ? ` · ${s.trackIds.map((id) => tracks.find((tr) => tr.id === id)?.title).filter(Boolean).join(', ')}` : ''}</span>
                {s.description && <span className="small" style={{ whiteSpace: 'pre-line', color: '#D6D6D2' }}>{s.description}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
