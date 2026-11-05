import { focusStyle } from '../../lib/types';
import { Link } from 'react-router-dom';
import { useArtist, useSettings } from '../../lib/data';
import { Loading } from '../../components/Loading';
import { useNextSession } from '../../lib/calendar';
import { useAuth } from '../../lib/auth';
import { useBadges } from '../../lib/useBadges';
import { Celebration } from '../../components/Celebration';
import { SocialLinks } from '../../components/SocialLinks';
import { SharedTracks } from '../../components/SharedTracks';
import { AddToCalendar } from '../../components/AddToCalendar';
import { JustReleased, UpcomingRelease } from '../../components/ReleaseCards';
import { dayKey, releaseInfo, spotlightTrack } from '../../lib/release';
import { useProjects, useTracks, type Track } from '../../lib/music';
import { ProjectList } from '../../components/ProjectList';
import { Cover } from '../../components/Cover';
import { fmtDay, quoteSummary, setTaskDone, todayKey, usePayments, useQuotes, useSessions, useTasks } from '../../lib/business';
import { eur } from '../../lib/money';
import { trackSteps } from '../../lib/music';
import { progressOf, progressColor } from '../../lib/steps';
import { IconArrowLeft, IconCalendar } from '../../components/Icons';
import type { NextSession } from '../../lib/types';
import { dayMonth, isUpcoming, monthShort, parseAt, relativeDay, timeOf } from '../../lib/dates';
import { getLang, locale, t } from '../../lib/i18n';

function NextSessionCard({ session }: { session: NextSession }) {
  const d = parseAt(session.at);
  // Vecchio formato (solo testo) o sessione senza data
  if (!d) {
    if (!session.note) return null;
    return (
      <div className="card session-card">
        <div className="session-icon"><IconCalendar /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="tiny muted" style={{ fontWeight: 500 }}>{t('Prossima sessione')}</span>
          <span style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'pre-line' }}>{session.note}</span>
        </div>
      </div>
    );
  }
  if (!isUpcoming(d)) return null;
  return (
    <div className="card session-card">
      <div className="session-date" aria-hidden="true">
        <small>{monthShort(d)}</small>
        <strong>{d.getDate()}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className="tiny muted" style={{ fontWeight: 500 }}>{t('Prossima sessione')}</span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {t('{giorno} ore {ora}', { giorno: relativeDay(d), ora: timeOf(d) })}{session.type ? ` · ${t(session.type)}` : ''}
        </span>
        <span className="small muted">{dayMonth(d)}{session.note ? ` — ${session.note}` : ''}</span>
        <AddToCalendar start={d} title={`Emotion Studio – ${session.type ? t(session.type) : t('Sessione')}`} />
      </div>
    </div>
  );
}

interface Props {
  artistId: string;
  /** true quando l'admin guarda l'anteprima: mostra la barra per tornare indietro */
  preview?: boolean;
}

export function ArtistHome({ artistId, preview }: Props) {
  const { artist, loading } = useArtist(artistId);
  const { settings } = useSettings();
  const nextSession = useNextSession(artistId, artist?.nextSession);
  const { user } = useAuth();
  const badgeState = useBadges(artistId, artist?.createdMs ?? Date.now(), user?.uid ?? null, !preview);
  const party = badgeState.fresh[0];
  const { projects } = useProjects(artistId);
  const { tracks } = useTracks(artistId);
  const toListen = tracks.filter((t) => t.awaitingReview);
  // Ciclo di vita: in lavorazione → in uscita → appena uscito (30 giorni) → discografia
  const rel = (t: Track) => releaseInfo(t, projects.find((p) => p.id === t.projectId), settings.stepTemplate);
  const workingTracks = tracks.filter((t) => !rel(t).released);
  const workingProjects = projects.filter((p) => {
    const its = tracks.filter((t) => t.projectId === p.id);
    return its.length === 0 || its.some((t) => !rel(t).released);
  });
  const spot = spotlightTrack(tracks, projects, settings.stepTemplate);
  const today = dayKey(new Date());
  const upcomingProjects = projects.filter((p) => p.releaseDate && p.releaseDate > today)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  const tasks = useTasks(artistId);
  const myTasks = tasks.filter((t) => t.assignee === 'artist' && !t.done)
    .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const quotes = useQuotes(artistId);
  const payments = usePayments(artistId);
  const left = quotes.reduce((sum, q) => sum + quoteSummary(q, payments).left, 0);
  const sessions = useSessions(artistId);
  const hours = sessions.reduce((sum, x) => sum + x.hours, 0);
  const lastSession = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const welcome = (getLang() === 'en' && settings.welcomeTextEn.trim()) || settings.welcomeText;
  const trackHref = (t: Track) => (preview ? `/admin/artisti/${artistId}/brani/${t.id}` : `/brano/${t.id}`);
  if (loading) return <Loading />;
  if (!artist) return <div className="stack"><div className="empty">{t('Profilo non trovato.')}</div></div>;

  return (
    <div className="artist-main">
      {party && <Celebration badge={party} track={badgeState.tracks.find((t) => t.id === party.trackId)} onClose={() => badgeState.dismiss(party.id)} />}
      <header className="hero">
        {artist.photo
          ? <img className="hero-photo" src={artist.photo} alt="" style={focusStyle(artist.photoFocus)} />
          : <div className="hero-fallback" />}
        <div className="hero-top">
          {preview
            ? <Link to={`/admin/artisti/${artist.id}`} className="btn btn-sm" style={{ background: 'rgba(10,10,11,.6)' }}><IconArrowLeft width={18} height={18} /> Esci dall’anteprima</Link>
            : <img src="/logo.png" alt="Emotion Studio" />}
        </div>
        <div className="hero-bottom">
          <span className="hero-kicker">{t('Artista di Emotion Studio')}</span>
          <h1 className="display hero-name">{artist.stageName}</h1>
          <SocialLinks links={artist.links} />
          {artist.genres.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {artist.genres.map((g) => <span key={g} className="chip">{g}</span>)}
            </div>
          )}
        </div>
      </header>

      <div className="stack">
        <NextSessionCard session={nextSession.session ?? artist.nextSession} />

        {spot && <JustReleased artistId={artistId} t={spot.t} p={spot.p} date={spot.r.date} href={trackHref(spot.t)} />}
        {upcomingProjects.slice(0, 1).map((p) => (
          <UpcomingRelease key={p.id} p={p} days={Math.round((new Date(`${p.releaseDate}T12:00`).getTime() - new Date(`${today}T12:00`).getTime()) / 86_400_000)} />
        ))}

        {welcome && (
          <p className="small muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{welcome}</p>
        )}

        <section className="section">
          <div className="section-head">
            <h2 className="h2">{t('Da ascoltare')}</h2>
            {toListen.length > 0 && <span className="small muted">{toListen.length === 1 ? t('1 brano ti aspetta') : t('{n} brani ti aspettano', { n: toListen.length })}</span>}
          </div>
          {toListen.length === 0 ? (
            <div className="empty">
              <strong>{t('Nessuna versione nuova')}</strong>
              {t('Quando lo studio carica un mix o un master lo trovi qui, pronto da ascoltare.')}
            </div>
          ) : toListen.map((tr) => {
            const p = projects.find((x) => x.id === tr.projectId);
            return (
              <Link key={tr.id} to={trackHref(tr)} className="card card-glow listen-card">
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Cover src={p?.cover ?? null} title={p?.title ?? tr.title} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 17, fontWeight: 600 }}>{tr.title}</span>
                    <span className="small muted">{p?.title} · {t('nuova versione')}</span>
                    {(() => { const pr = progressOf(trackSteps(tr, settings.stepTemplate)); return (
                      <span className="tiny" style={{ fontWeight: 600, color: progressColor(pr.pct) }}>{pr.pct}% · {pr.complete ? t(pr.label) : t('Siamo a: {step}', { step: t(pr.label) })}</span>
                    ); })()}
                  </div>
                </div>
                <span className="btn btn-primary btn-block">{t('Ascolta')}</span>
              </Link>
            );
          })}
        </section>

        <section className="section">
          <div className="section-head">
            <h2 className="h2">{t('I miei progetti')}</h2>
            {!preview && projects.length > 0 && <Link to="/progetti" className="small" style={{ fontWeight: 600 }}>{t('Tutti e discografia')}</Link>}
          </div>
          {workingProjects.length === 0 ? (
            <div className="empty">
              <strong>{projects.length ? t('Nessun lavoro in corso') : t('Ancora nessun progetto')}</strong>
              {t('Singoli ed EP compariranno qui con lo stato di ogni brano, da “Ricevuto” a “Pubblicato”.')}
            </div>
          ) : (
            <ProjectList artistId={artistId} projects={workingProjects.slice(0, 2)} tracks={workingTracks} trackHref={trackHref} />
          )}
        </section>

        <SharedTracks previewOf={preview ? artistId : undefined} />

        <section className="section">
          <h2 className="h2">{t('Da fare')}</h2>
          {myTasks.length === 0 ? (
            <div className="empty">
              <strong>{t('Tutto in ordine')}</strong>
              {t('Qui vedrai le cose da preparare prima della prossima sessione.')}
            </div>
          ) : (
            <div className="card list">
              {myTasks.map((task) => (
                <label key={task.id} className="check task-row">
                  <input type="checkbox" checked={task.done} disabled={preview} onChange={(e) => void setTaskDone(artistId, task.id, e.target.checked)} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 500, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--faint)' : 'var(--text)' }}>{task.title}</span>
                    {task.dueDate && !task.done && <span className="tiny" style={{ fontWeight: 600, color: task.dueDate < todayKey() ? 'var(--danger)' : 'var(--accent-soft)' }}>{task.dueDate < todayKey() ? t('Scaduto il {data}', { data: fmtDay(task.dueDate) }) : t('Entro {data}', { data: fmtDay(task.dueDate) })}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <Link to={preview ? '#' : '/pagamenti'} className="card card-pad stat-card">
            <span className="tiny muted" style={{ fontWeight: 500 }}>{t('Da saldare')}</span>
            <span className="money-mid">{eur(left)}</span>
            <span className="tiny muted">{left > 0 ? t('Vedi come pagare') : t('Sei in pari ✓')}</span>
          </Link>
          <Link to={preview ? '#' : '/sessioni'} className="card card-pad stat-card">
            <span className="tiny muted" style={{ fontWeight: 500 }}>{t('Ore in studio')}</span>
            <span className="money-mid">{hours.toLocaleString(locale())} h</span>
            <span className="tiny muted">{lastSession ? t('Ultima: {data}', { data: fmtDay(lastSession.date) }) : t('Nessuna sessione ancora')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
