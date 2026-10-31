import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useArtist, useSettings } from '../lib/data';
import { useComments } from '../lib/comments';
import { DEMO_STATUS, artistStatusLabel, deleteDemo, demoAsVersion, promoteDemo, removeDemo, updateDemo, useDemos } from '../lib/demos';
import { useProjects } from '../lib/music';
import { usePlayer, type PlayerTrack } from '../lib/player';
import { mediaUrl } from '../lib/worker';
import { formatTime } from '../lib/audio';
import { errorMessage } from '../lib/errors';
import { Waveform, type Marker } from '../components/Waveform';
import { Comments } from '../components/Comments';
import { Stars } from '../components/Stars';
import { Loading } from '../components/Loading';
import { IconArrowLeft } from '../components/Icons';

const DEMO_COLOR = '#C9703A';

interface Props { artistId: string; demoId: string; backTo: string; backLabel: string; href: string }

export function DemoPage({ artistId, demoId, backTo, backLabel, href }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const { artist } = useArtist(artistId);
  const { demos, loading } = useDemos(artistId);
  const comments = useComments(artistId, `demo:${demoId}`);
  const pl = usePlayer();
  const dummy = useMemo(() => new Audio(), []);
  const [error, setError] = useState<string | null>(null);

  const demo = demos.find((d) => d.id === demoId);
  const version = useMemo(() => (demo ? demoAsVersion(demo) : null), [demo?.id, demo?.peaks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadedHere = pl.track?.trackId === `demo:${demoId}`;
  const info: PlayerTrack | null = demo ? {
    artistId, trackId: `demo:${demoId}`, title: demo.title, artistName: artist?.stageName ?? '', cover: artist?.photo ?? null, color: DEMO_COLOR, href,
  } : null;

  // carica nel lettore senza interrompere un altro brano che sta suonando
  useEffect(() => {
    if (info && version && !loadedHere && !pl.playing) void pl.open(info, version, false);
  }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // lo studio la apre: da "nuova" diventa "ascoltata"
  useEffect(() => {
    if (isAdmin && demo && demo.status === 'nuova') void updateDemo(artistId, demo.id, { status: 'ascoltata', seenByAdmin: true }).catch(() => undefined);
  }, [isAdmin, demo?.id, demo?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers: Marker[] = useMemo(() => comments
    .filter((c) => c.atSeconds !== null)
    .map((c) => ({ id: c.id, at: c.atSeconds!, resolved: c.resolved, title: `${c.authorName}: ${c.text.slice(0, 60)}` })),
  [comments]);

  if (loading) return <Loading />;
  if (!demo || !version || !info) return <div className="stack"><div className="empty">Demo non trovata. <Link to={backTo}>Torna indietro</Link></div></div>;

  const playHere = (at?: number) => {
    if (loadedHere) { if (at !== undefined) pl.seek(at, true); else pl.toggle(); return; }
    void pl.open(info, version, true).then(() => {
      if (at === undefined) return;
      const a = pl.audio('A');
      const go = () => { a.currentTime = at; };
      if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    });
  };
  const run = (p: Promise<unknown>) => p.catch((e) => setError(errorMessage(e)));
  const playing = loadedHere && pl.playing;
  const time = loadedHere ? pl.time : 0;
  const duration = (loadedHere ? pl.duration : 0) || demo.duration;

  return (
    <div className="artist-main" style={{ position: 'relative', isolation: 'isolate' }}>
      <div className="track-hero" style={{ ['--glow-color' as string]: `${DEMO_COLOR}55` }}>
        <Link to={backTo} className="back-link"><IconArrowLeft width={18} height={18} /> {backLabel}</Link>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">Demo{isAdmin && artist ? ` di ${artist.stageName}` : ''} · {new Date(demo.createdMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}{demo.source === 'registrazione' ? ' · registrata in app' : ''}</span>
          <h1 className="display" style={{ fontSize: 'clamp(34px, 10vw, 48px)', overflowWrap: 'anywhere' }}>{demo.title}</h1>
          {!isAdmin && <span className={`badge${demo.status === 'selezionata' ? ' badge-star' : ''}`} style={{ alignSelf: 'flex-start' }}>{artistStatusLabel(demo.status)}</span>}
        </div>
      </div>

      <div className="stack" style={{ paddingTop: 22 }}>
        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!loadedHere && pl.track && (
            <div className="alert" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>Sta suonando “{pl.track.title}”. Premi play per ascoltare questa demo.</div>
          )}
          <Waveform versionKey={`${demo.id}-${loadedHere ? 'on' : 'x'}`} media={loadedHere ? pl.audio('A') : dummy}
            peaks={demo.peaks} duration={demo.duration} color={DEMO_COLOR} markers={markers} loop={null} selectingLoop={false}
            onLoop={() => undefined} onMarker={(_, at) => playHere(at)} onSeek={(t) => { if (!loadedHere) playHere(t); }} />
          <div className="player-bar">
            <button className="play-btn" onClick={() => playHere()} aria-label={playing ? 'Pausa' : 'Riproduci'} style={{ background: DEMO_COLOR }}>
              {playing
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>}
            </button>
            <span className="player-time">{formatTime(time)} <span className="muted">/ {formatTime(duration)}</span></span>
          </div>
          {loadedHere && pl.error && <div className="alert alert-error" role="alert">{pl.error}</div>}
          {demo.note && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="tiny muted" style={{ fontWeight: 600 }}>{isAdmin ? 'Nota dell’artista' : 'La tua nota'}</span>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{demo.note}</p>
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="row-actions">
            <button className="btn btn-sm" onClick={() => void run(mediaUrl(artistId, demo.id, true, 'demo').then((u) => { window.location.href = u; }))}>Scarica</button>
            {!isAdmin && demo.status === 'nuova' && (
              <DeleteButton onDelete={() => run(deleteDemo(artistId, demo.id))} />
            )}
          </div>
        </section>

        {isAdmin && <AdminDemoTools artistId={artistId} demoId={demo.id} rating={demo.rating} status={demo.status} trackId={demo.trackId} title={demo.title} run={run} />}

        {user && (
          <Comments artistId={artistId} trackId={`demo:${demo.id}`} versionId={demo.id} versionLabel="questa demo"
            comments={comments} time={time} uid={user.uid} role={isAdmin ? 'admin' : 'artist'}
            authorName={isAdmin ? 'Emotion Studio' : (artist?.stageName ?? 'Artista')} onSeek={(t) => playHere(t)} highlight={null} />
        )}
      </div>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => Promise<unknown> }) {
  const navigate = useNavigate();
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => {
      if (confirm('Ritirare questa demo? Lo studio non la vedrà più.')) void onDelete().then(() => navigate('/carica'));
    }}>Ritira la demo</button>
  );
}

interface ToolsProps {
  artistId: string; demoId: string; rating: number; status: string; trackId: string | null; title: string;
  run: (p: Promise<unknown>) => Promise<unknown>;
}

function AdminDemoTools({ artistId, demoId, rating, status, trackId, title, run }: ToolsProps) {
  const { projects } = useProjects(artistId);
  const { settings } = useSettings();
  const { demos } = useDemos(artistId);
  const navigate = useNavigate();
  const [target, setTarget] = useState<string>('nuovo');
  const [single, setSingle] = useState(title);
  const [busy, setBusy] = useState(false);
  const pl = usePlayer();
  const demo = demos.find((d) => d.id === demoId);

  const remove = async () => {
    if (!demo) return;
    const msg = demo.trackId
      ? 'Eliminare la demo dall’app? Il file resta su Drive perché è usato dal brano creato da questa demo.'
      : 'Eliminare la demo? Sparisce dall’app anche per l’artista e il file va nel Cestino di Drive (recuperabile per 30 giorni).';
    if (!confirm(msg)) return;
    if (pl.track?.trackId === `demo:${demo.id}`) pl.close();
    await removeDemo(demo);
    navigate(`/admin/artisti/${artistId}/demo`);
  };

  const promote = async () => {
    if (!demo) return;
    setBusy(true);
    try {
      const tid = await promoteDemo(demo, target === 'nuovo' ? { newSingle: single.trim() || title } : { projectId: target }, settings.stepTemplate);
      navigate(`/admin/artisti/${artistId}/brani/${tid}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad form">
      <h2 className="h2">Valutazione</h2>
      <Stars value={rating} onChange={(v) => void run(updateDemo(artistId, demoId, { rating: v }))} size={28} />
      <div className="pick-wrap" role="group" aria-label="Stato della demo">
        {DEMO_STATUS.map((s) => (
          <button key={s.value} type="button" className="pick" aria-pressed={status === s.value}
            onClick={() => void run(updateDemo(artistId, demoId, { status: s.value }))}>{s.label}</button>
        ))}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>L’artista non vede mai “Scartata”: per lui la demo risulta “Ascoltata”.</p>

      <div className="inset">
        <span style={{ fontWeight: 600 }}>Porta in studio</span>
        {trackId ? (
          <Link className="btn btn-sm" style={{ alignSelf: 'flex-start' }} to={`/admin/artisti/${artistId}/brani/${trackId}`}>Apri il brano creato da questa demo</Link>
        ) : (
          <>
            <span className="small muted">Crea il brano con il percorso già pronto e la demo come primo ascolto.</span>
            <select className="select" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Dove creare il brano">
              <option value="nuovo">Nuovo singolo</option>
              {projects.map((p) => <option key={p.id} value={p.id}>Aggiungi a “{p.title}”</option>)}
            </select>
            {target === 'nuovo' && (
              <input className="input" value={single} onChange={(e) => setSingle(e.target.value)} aria-label="Titolo del singolo" placeholder="Titolo del singolo" />
            )}
            <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void run(promote())}>
              {busy ? 'Creo il brano…' : 'Porta in studio'}
            </button>
          </>
        )}
      </div>
      <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void run(remove())}>Elimina demo</button>
    </section>
  );
}
