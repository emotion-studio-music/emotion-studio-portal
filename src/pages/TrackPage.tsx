import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useArtist, useSettings } from '../lib/data';
import { trackSteps, useProjectDoc, useProjects, useTrackDoc, useTracks, useVersions, type Version } from '../lib/music';
import { useComments } from '../lib/comments';
import { usePlayer, type PlayerTrack } from '../lib/player';
import { progressColor, progressOf } from '../lib/steps';
import { mediaUrl } from '../lib/worker';
import { formatTime } from '../lib/audio';
import { Waveform, type Marker } from '../components/Waveform';
import { Comments } from '../components/Comments';
import { TrackProgress } from '../components/TrackProgress';
import { Cover } from '../components/Cover';
import { CoverDownload } from '../components/CoverDownload';
import { quoteSummary, usePayments, useQuotes } from '../lib/business';
import { eur } from '../lib/money';
import { Loading } from '../components/Loading';
import { UploadVersion } from '../components/UploadVersion';
import { IconArrowLeft } from '../components/Icons';
import { locale, t } from '../lib/i18n';

/** shared = l'artista collegato è in feat su un brano di un altro artista (artistId = artista principale). */
interface Props { artistId: string; trackId: string; backTo: string; backLabel: string; href: string; shared?: boolean }

export function TrackPage({ artistId, trackId, backTo, backLabel, href, shared }: Props) {
  const { user, role, artistId: myArtistId } = useAuth();
  const uid = user?.uid ?? '';
  const { artist: me } = useArtist(role === 'artist' ? myArtistId : null);
  const { artist } = useArtist(shared ? null : artistId);
  const { settings } = useSettings();
  const { tracks, loading: tLoading } = useTracks(shared ? null : artistId);
  const single = useTrackDoc(shared ? artistId : null, trackId);
  const loading = shared ? single.loading : tLoading;
  const { projects } = useProjects(shared ? null : artistId);
  const { versions, loading: vLoading } = useVersions(artistId, trackId, shared ? uid : undefined);
  const comments = useComments(artistId, trackId, shared ? uid : undefined);
  const quotes = useQuotes(shared ? null : artistId);
  const payments = usePayments(shared ? null : artistId);
  const quote = quotes.find((q) => q.trackIds.includes(trackId));
  const quoteLeft = quote ? quoteSummary(quote, payments).left : 0;
  const pl = usePlayer();
  const dummy = useMemo(() => new Audio(), []);

  const [selected, setSelected] = useState<string | null>(null);
  const [selectingLoop, setSelectingLoop] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const track = shared ? single.track : tracks.find((t) => t.id === trackId);
  const sharedProject = useProjectDoc(shared ? artistId : null, track?.projectId);
  const project = shared ? sharedProject : projects.find((p) => p.id === track?.projectId);
  const progress = progressOf(track ? trackSteps(track, settings.stepTemplate) : []);
  const color = progressColor(progress.pct);
  const loadedHere = pl.track?.trackId === trackId;

  // versione iniziale: quella attuale scelta dallo studio, altrimenti la più recente
  useEffect(() => {
    if (selected || !versions.length) return;
    if (loadedHere && pl.versions.A) { setSelected(pl.versions.A.id); return; }
    setSelected(track?.currentVersionId && versions.some((v) => v.id === track.currentVersionId) ? track.currentVersionId : versions[0].id);
  }, [versions, track, selected, loadedHere, pl.versions.A]);

  const selectedVersion = versions.find((v) => v.id === selected) ?? null;
  const info: PlayerTrack | null = track ? {
    artistId, trackId, title: track.title, artistName: artist?.stageName ?? track.ownerName, cover: project?.cover ?? null, color, href,
  } : null;

  // carica la versione nel lettore, senza interrompere un altro brano che sta suonando
  useEffect(() => {
    if (!info || !selectedVersion) return;
    if (loadedHere) {
      const a = pl.versions.A;
      if (a?.id !== selectedVersion.id || a.mp3FileId !== selectedVersion.mp3FileId) void pl.open(info, selectedVersion, pl.playing);
    } else if (!pl.playing) {
      void pl.open(info, selectedVersion, false);
    }
  }, [selectedVersion?.id, selectedVersion?.mp3FileId, info?.trackId]); // eslint-disable-line react-hooks/exhaustive-deps

  // colore e copertina aggiornati nel mini player
  useEffect(() => {
    if (loadedHere) pl.updateTrack({ color, cover: project?.cover ?? null });
  }, [color, project?.cover, loadedHere]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown: Version | null = loadedHere ? pl.activeVersion : selectedVersion;
  const markers: Marker[] = useMemo(() => comments
    .filter((c) => c.versionId === shown?.id && c.atSeconds !== null)
    .map((c) => ({ id: c.id, at: c.atSeconds!, resolved: c.resolved, title: `${c.authorName}: ${c.text.slice(0, 60)}` })),
  [comments, shown?.id]);

  if (loading) return <Loading />;
  if (!track || !info) return <div className="stack"><div className="empty">{t('Brano non trovato.')} <Link to={backTo}>{t('Torna indietro')}</Link></div></div>;

  const playHere = (at?: number) => {
    if (!selectedVersion) return;
    if (loadedHere) { if (at !== undefined) pl.seek(at, true); else pl.toggle(); return; }
    void pl.open(info, selectedVersion, true).then(() => {
      if (at === undefined) return;
      const a = pl.audio('A');
      const go = () => { a.currentTime = at; };
      if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    });
  };

  const download = async () => {
    if (!shown) return;
    setDlBusy(true); setDlError(null);
    try { window.location.href = await mediaUrl(artistId, shown.id, true); }
    catch (e) { setDlError(e instanceof Error ? t(e.message) : t('Download non riuscito.')); }
    finally { setDlBusy(false); }
  };

  const onMarker = (id: string, at: number) => {
    setHighlight(id);
    playHere(at);
    setTimeout(() => document.getElementById(`nota-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const others = versions.filter((v) => v.id !== pl.versions.A?.id);
  const time = loadedHere ? pl.time : 0;
  const duration = (loadedHere ? pl.duration : 0) || shown?.duration || 0;
  const playing = loadedHere && pl.playing;

  return (
    <div className="artist-main" style={{ position: 'relative', isolation: 'isolate' }}>
      <div className="track-hero" style={{ ['--glow-color' as string]: `${color}59` }}>
        <Link to={backTo} className="back-link"><IconArrowLeft width={18} height={18} /> {t(backLabel)}</Link>
        <Cover src={project?.cover ?? null} title={project?.title ?? track.title} className="track-cover cover" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">
            {project?.title}
            {shared && track.ownerName ? ` · ${t('brano di {nome}', { nome: track.ownerName })}` : ''}
            {!shared && track.collaboratorNames.length ? ` · feat. ${track.collaboratorNames.join(', ')}` : ''}
          </span>
          <h1 className="display" style={{ fontSize: 'clamp(36px, 11vw, 52px)', overflowWrap: 'anywhere' }}>{track.title}</h1>
        </div>
        <TrackProgress progress={progress} />
        {(track.links.spotify || track.links.apple || track.links.youtube) && (
          <div className="row-actions">
            {track.links.spotify && <a className="btn btn-primary btn-sm" href={track.links.spotify} target="_blank" rel="noreferrer">{t('Ascolta su Spotify')}</a>}
            {track.links.apple && <a className="btn btn-sm" href={track.links.apple} target="_blank" rel="noreferrer">Apple Music</a>}
            {track.links.youtube && <a className="btn btn-sm" href={track.links.youtube} target="_blank" rel="noreferrer">YouTube</a>}
          </div>
        )}
        {(project || quote) && (
          <div className="row-actions">
            {project && <CoverDownload artistId={artistId} project={project} small />}
            {quote && (
              <span className="small muted">
                {t('Preventivo')}: {quote.title} · {quoteLeft > 0 ? t('mancano {importo}', { importo: eur(quoteLeft) }) : t('saldato ✓')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="stack" style={{ paddingTop: 22 }}>
        {vLoading ? null : versions.length === 0 ? (
          <div className="empty"><strong>{t('Nessuna versione da ascoltare')}</strong>{t('Quando lo studio carica il primo mix lo trovi qui.')}</div>
        ) : (
          <>
            <div className="version-pills" role="group" aria-label={t('Versioni')}>
              {versions.map((v) => (
                <button key={v.id} type="button" className="pick" aria-pressed={v.id === (loadedHere ? pl.versions.A?.id : selected)}
                  onClick={() => setSelected(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>

            {shown && (
              <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <h2 className="h2">{shown.label}</h2>
                  <span className="tiny muted">{t('Caricata il {data}', { data: new Date(shown.createdMs).toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) })}</span>
                </div>

                {!loadedHere && pl.track && (
                  <div className="alert" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                    {t('Sta suonando “{titolo}”. Premi play per ascoltare questo brano.', { titolo: pl.track.title })}
                  </div>
                )}

                <Waveform
                  versionKey={`${shown.id}-${loadedHere ? pl.active : 'x'}`}
                  media={loadedHere ? pl.audio(pl.active) : dummy}
                  peaks={shown.peaks}
                  duration={shown.duration}
                  color={color}
                  markers={markers}
                  loop={loadedHere ? pl.loop : null}
                  selectingLoop={selectingLoop && loadedHere}
                  onLoop={(l) => { pl.setLoop(l); setSelectingLoop(false); }}
                  onMarker={onMarker}
                  onSeek={(t) => { if (!loadedHere) playHere(t); }}
                />

                <div className="player-bar">
                  <button className="play-btn" onClick={() => playHere()} aria-label={playing ? t('Pausa') : t('Riproduci')} style={{ background: color }}>
                    {playing
                      ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>}
                  </button>
                  <span className="player-time">{formatTime(time)} <span className="muted">/ {formatTime(duration)}</span></span>
                </div>
                {loadedHere && pl.error && <div className="alert alert-error" role="alert">{pl.error}</div>}

                {loadedHere && (
                  <div className="tools">
                    {/* Confronto A/B */}
                    <div className="tool">
                      <span className="tiny muted" style={{ fontWeight: 600 }}>{t('Confronto A/B')}</span>
                      {pl.versions.B ? (
                        <div className="row-actions">
                          <div className="seg" role="group" aria-label={t('Versione in ascolto')}>
                            <button type="button" aria-pressed={pl.active === 'A'} onClick={() => pl.switchTo('A')}>A · {pl.versions.A?.label}</button>
                            <button type="button" aria-pressed={pl.active === 'B'} onClick={() => pl.switchTo('B')} disabled={pl.loadingB}>B · {pl.versions.B.label}</button>
                          </div>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void pl.setCompare(null)}>{t('Chiudi')}</button>
                        </div>
                      ) : others.length ? (
                        <select className="select" value="" aria-label={t('Confronta con un’altra versione')}
                          onChange={(e) => { const v = versions.find((x) => x.id === e.target.value); if (v) void pl.setCompare(v); }}>
                          <option value="" disabled>{t('Confronta con…')}</option>
                          {others.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                      ) : <span className="small muted">{t('Serve almeno un’altra versione.')}</span>}
                    </div>

                    {/* Loop */}
                    <div className="tool">
                      <span className="tiny muted" style={{ fontWeight: 600 }}>Loop</span>
                      {pl.loop ? (
                        <div className="row-actions">
                          <button type="button" className="pick" aria-pressed={pl.loopOn} onClick={() => pl.setLoopOn(!pl.loopOn)}>
                            {formatTime(pl.loop.start)} → {formatTime(pl.loop.end)}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => pl.setLoop(null)}>{t('Rimuovi')}</button>
                        </div>
                      ) : selectingLoop ? (
                        <div className="row-actions">
                          <span className="small" style={{ color: 'var(--amber)' }}>{t('Trascina sulla forma d’onda la parte da ripetere')}</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectingLoop(false)}>{t('Annulla')}</button>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-sm" onClick={() => setSelectingLoop(true)}>{t('Scegli una sezione')}</button>
                      )}
                    </div>
                  </div>
                )}

                {shown.notes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="tiny muted" style={{ fontWeight: 600 }}>{t('Note dello studio')}</span>
                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{shown.notes}</p>
                  </div>
                )}
                {shown.downloadEnabled && (
                  <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => void download()} disabled={dlBusy}>
                    {dlBusy ? t('Preparo il file…') : t('Scarica MP3')}
                  </button>
                )}
                {dlError && <div className="alert alert-error" role="alert">{dlError}</div>}
              </section>
            )}

            {role === 'admin' && !shared && artist && project && (
              <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="small muted">Hai sistemato il brano dopo le note?</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setUploadOpen((v) => !v)} aria-expanded={uploadOpen}>
                    {uploadOpen ? 'Chiudi' : versions.length ? 'Carica versione aggiornata' : 'Carica MP3'}
                  </button>
                </div>
                {uploadOpen && (
                  <UploadVersion artist={artist} project={project} track={track} count={versions.length}
                    current={versions.find((v) => v.id === track.currentVersionId) ?? versions[0]} />
                )}
              </section>
            )}

            {shown && user && (
              <Comments
                artistId={artistId}
                trackId={trackId}
                versionId={shown.id}
                versionLabel={shown.label}
                comments={comments.filter((c) => c.versionId === shown.id)}
                time={time}
                uid={user.uid}
                role={role === 'admin' ? 'admin' : 'artist'}
                authorName={role === 'admin' ? 'Emotion Studio' : (me?.stageName ?? t('Artista'))}
                onSeek={(t) => playHere(t)}
                highlight={highlight}
                collaboratorUids={track.collaboratorUids}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
