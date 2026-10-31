import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useArtist, useSettings } from '../lib/data';
import { trackSteps, useProjects, useTracks, useVersions, type Version } from '../lib/music';
import { useComments } from '../lib/comments';
import { usePlayer, type PlayerTrack } from '../lib/player';
import { progressColor, progressOf } from '../lib/steps';
import { mediaUrl } from '../lib/worker';
import { formatTime } from '../lib/audio';
import { Waveform, type Marker } from '../components/Waveform';
import { Comments } from '../components/Comments';
import { TrackProgress } from '../components/TrackProgress';
import { Cover } from '../components/Cover';
import { Loading } from '../components/Loading';
import { IconArrowLeft } from '../components/Icons';

interface Props { artistId: string; trackId: string; backTo: string; backLabel: string; href: string }

export function TrackPage({ artistId, trackId, backTo, backLabel, href }: Props) {
  const { user, role } = useAuth();
  const { artist } = useArtist(artistId);
  const { settings } = useSettings();
  const { tracks, loading } = useTracks(artistId);
  const { projects } = useProjects(artistId);
  const { versions, loading: vLoading } = useVersions(artistId, trackId);
  const comments = useComments(artistId, trackId);
  const pl = usePlayer();
  const dummy = useMemo(() => new Audio(), []);

  const [selected, setSelected] = useState<string | null>(null);
  const [selectingLoop, setSelectingLoop] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  const track = tracks.find((t) => t.id === trackId);
  const project = projects.find((p) => p.id === track?.projectId);
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
    artistId, trackId, title: track.title, artistName: artist?.stageName ?? '', cover: project?.cover ?? null, color, href,
  } : null;

  // carica la versione nel lettore, senza interrompere un altro brano che sta suonando
  useEffect(() => {
    if (!info || !selectedVersion) return;
    if (loadedHere) {
      if (pl.versions.A?.id !== selectedVersion.id) void pl.open(info, selectedVersion, pl.playing);
    } else if (!pl.playing) {
      void pl.open(info, selectedVersion, false);
    }
  }, [selectedVersion?.id, info?.trackId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if (!track || !info) return <div className="stack"><div className="empty">Brano non trovato. <Link to={backTo}>Torna indietro</Link></div></div>;

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
    catch (e) { setDlError(e instanceof Error ? e.message : 'Download non riuscito.'); }
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
        <Link to={backTo} className="back-link"><IconArrowLeft width={18} height={18} /> {backLabel}</Link>
        <Cover src={project?.cover ?? null} title={project?.title ?? track.title} className="track-cover cover" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">{project?.title}</span>
          <h1 className="display" style={{ fontSize: 'clamp(36px, 11vw, 52px)', overflowWrap: 'anywhere' }}>{track.title}</h1>
        </div>
        <TrackProgress progress={progress} />
      </div>

      <div className="stack" style={{ paddingTop: 22 }}>
        {vLoading ? null : versions.length === 0 ? (
          <div className="empty"><strong>Nessuna versione da ascoltare</strong>Quando lo studio carica il primo mix lo trovi qui.</div>
        ) : (
          <>
            <div className="version-pills" role="group" aria-label="Versioni">
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
                  <span className="tiny muted">Caricata il {new Date(shown.createdMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
                </div>

                {!loadedHere && pl.track && (
                  <div className="alert" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                    Sta suonando “{pl.track.title}”. Premi play per ascoltare questo brano.
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
                  <button className="play-btn" onClick={() => playHere()} aria-label={playing ? 'Pausa' : 'Riproduci'} style={{ background: color }}>
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
                      <span className="tiny muted" style={{ fontWeight: 600 }}>Confronto A/B</span>
                      {pl.versions.B ? (
                        <div className="row-actions">
                          <div className="seg" role="group" aria-label="Versione in ascolto">
                            <button type="button" aria-pressed={pl.active === 'A'} onClick={() => pl.switchTo('A')}>A · {pl.versions.A?.label}</button>
                            <button type="button" aria-pressed={pl.active === 'B'} onClick={() => pl.switchTo('B')} disabled={pl.loadingB}>B · {pl.versions.B.label}</button>
                          </div>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void pl.setCompare(null)}>Chiudi</button>
                        </div>
                      ) : others.length ? (
                        <select className="select" value="" aria-label="Confronta con un'altra versione"
                          onChange={(e) => { const v = versions.find((x) => x.id === e.target.value); if (v) void pl.setCompare(v); }}>
                          <option value="" disabled>Confronta con…</option>
                          {others.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                      ) : <span className="small muted">Serve almeno un’altra versione.</span>}
                    </div>

                    {/* Loop */}
                    <div className="tool">
                      <span className="tiny muted" style={{ fontWeight: 600 }}>Loop</span>
                      {pl.loop ? (
                        <div className="row-actions">
                          <button type="button" className="pick" aria-pressed={pl.loopOn} onClick={() => pl.setLoopOn(!pl.loopOn)}>
                            {formatTime(pl.loop.start)} → {formatTime(pl.loop.end)}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => pl.setLoop(null)}>Rimuovi</button>
                        </div>
                      ) : selectingLoop ? (
                        <div className="row-actions">
                          <span className="small" style={{ color: 'var(--amber)' }}>Trascina sulla forma d’onda la parte da ripetere</span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectingLoop(false)}>Annulla</button>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-sm" onClick={() => setSelectingLoop(true)}>Scegli una sezione</button>
                      )}
                    </div>
                  </div>
                )}

                {shown.notes && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="tiny muted" style={{ fontWeight: 600 }}>Note dello studio</span>
                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{shown.notes}</p>
                  </div>
                )}
                {shown.downloadEnabled && (
                  <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => void download()} disabled={dlBusy}>
                    {dlBusy ? 'Preparo il file…' : 'Scarica MP3'}
                  </button>
                )}
                {dlError && <div className="alert alert-error" role="alert">{dlError}</div>}
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
                authorName={role === 'admin' ? 'Emotion Studio' : (artist?.stageName ?? 'Artista')}
                onSeek={(t) => playHere(t)}
                highlight={highlight}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
