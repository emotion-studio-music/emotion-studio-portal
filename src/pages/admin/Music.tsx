import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useArtist, useArtists, useSettings } from '../../lib/data';
import { useComments, type Comment } from '../../lib/comments';
import { progressColor, progressOf } from '../../lib/steps';
import { SPOTLIGHT_DAYS, dayKey, releaseInfo } from '../../lib/release';
import { StepsEditor } from '../../components/StepsEditor';
import { TrackProgress } from '../../components/TrackProgress';
import {
  PROJECT_TYPES, addVersion, createProject, createTrack, deleteProject, deleteTrack, deleteVersion, moveInOrder,
  setCollaborators, trackSteps, updateProject, updateTrack, updateVersion, useFeatTracks, useProjects, useTracks, useVersions,
  type Project, type ProjectType, type Track,
} from '../../lib/music';
import { analyzeAudio, formatTime } from '../../lib/audio';
import { compressImage } from '../../lib/image';
import { ensureVersionsFolder, uploadCoverOriginal } from '../../lib/drive';
import { driveHealth, uploadToDrive, workerConfigured } from '../../lib/worker';
import { errorMessage } from '../../lib/errors';
import type { Artist } from '../../lib/types';
import { Loading } from '../../components/Loading';
import { Cover } from '../../components/Cover';
import { IconArrowLeft, IconPlus } from '../../components/Icons';

export function Music() {
  const { id } = useParams();
  const { artist, loading } = useArtist(id);
  const { projects } = useProjects(id ?? null);
  const { tracks } = useTracks(id ?? null);
  const feats = useFeatTracks(id ?? null);
  const { settings } = useSettings();
  const comments = useComments(id ?? null);
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  // progetti con tutti i brani usciti da più di 30 giorni: vanno in fondo, chiusi
  const isArchived = (p: Project) => {
    const its = tracks.filter((t) => t.projectId === p.id);
    if (!its.length) return false;
    return its.every((t) => {
      const r = releaseInfo(t, p, settings.stepTemplate);
      if (!r.released) return false;
      const d = new Date(`${r.date}T12:00`); d.setDate(d.getDate() + SPOTLIGHT_DAYS);
      return dayKey(d) <= dayKey(new Date());
    });
  };
  const active = projects.filter((p) => !isArchived(p));
  const archived = projects.filter(isArchived);
  const [drive, setDrive] = useState<string | null>(null);

  useEffect(() => {
    if (!workerConfigured) { setDrive('Drive non collegato: manca VITE_WORKER_URL nel file .env'); return; }
    driveHealth()
      .then((h) => setDrive(`Drive collegato · ${h.usedGB.toLocaleString('it-IT')} GB usati su ${h.limitGB.toLocaleString('it-IT')} GB`))
      .catch((e) => setDrive(`Drive non raggiungibile: ${errorMessage(e)}`));
  }, []);

  if (loading) return <Loading />;
  if (!artist || !id) return <div className="empty">Artista non trovato.</div>;

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to={`/admin/artisti/${id}`} className="back-link"><IconArrowLeft width={16} height={16} /> {artist.stageName}</Link>
          <h1 className="display page-title">Musica</h1>
          {drive && <span className="small muted">{drive}</span>}
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew((v) => !v)}><IconPlus width={18} height={18} /> Nuovo progetto</button>
      </div>

      {showNew && <NewProject artist={artist} onDone={() => setShowNew(false)} />}

      {projects.length === 0 && !showNew && (
        <div className="empty"><strong>Nessun progetto</strong>Crea un singolo o un EP, poi aggiungi i brani e carica le versioni.{feats.length > 0 && ' I brani in feat con altri artisti sono qui sotto.'}</div>
      )}

      {active.map((p, i) => (
        <ProjectAdmin key={p.id} artist={artist} project={p} tracks={tracks.filter((t) => t.projectId === p.id)}
          template={settings.stepTemplate} comments={comments}
          first={i === 0} last={i === active.length - 1} onMove={(dir) => moveInOrder(artist.id, 'projects', projects, active, p.id, dir)} />
      ))}

      {archived.length > 0 && (
        <section className="section">
          <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
            {showArchived ? 'Nascondi' : 'Mostra'} usciti da più di 30 giorni ({archived.length})
          </button>
          {showArchived && archived.map((p, i) => (
            <ProjectAdmin key={p.id} artist={artist} project={p} tracks={tracks.filter((t) => t.projectId === p.id)}
              template={settings.stepTemplate} comments={comments}
              first={i === 0} last={i === archived.length - 1} onMove={(dir) => moveInOrder(artist.id, 'projects', projects, archived, p.id, dir)} />
          ))}
        </section>
      )}

      {feats.length > 0 && <FeatTracks tracks={feats} template={settings.stepTemplate} />}
    </>
  );
}

/** Brani di altri artisti in cui questo artista è in feat: si gestiscono nella Musica dell'artista principale. */
function FeatTracks({ tracks, template }: { tracks: Track[]; template: string[] }) {
  return (
    <section className="section">
      <div>
        <h2 className="h2">Collaborazioni</h2>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Brani in feat caricati nel profilo di un altro artista. È lo stesso brano: versioni, note e percorso si gestiscono lì.
        </p>
      </div>
      <div className="card project-card">
        {tracks.map((t) => (
          <div key={`${t.ownerArtistId}-${t.id}`} className="track-row" style={{ gap: 12 }}>
            <div className="track-row-head" style={{ flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{t.title}</span>
                <span className="tiny muted">brano di {t.ownerName || 'un altro artista'}{t.collaboratorNames.length ? ` · feat. ${t.collaboratorNames.join(', ')}` : ''}</span>
              </span>
              <div className="row-actions">
                <Link className="btn btn-sm" to={`/admin/artisti/${t.ownerArtistId}/brani/${t.id}`}>Ascolta</Link>
                <Link className="btn btn-sm" to={`/admin/artisti/${t.ownerArtistId}/musica`}>Gestisci{t.ownerName ? ` in ${t.ownerName}` : ''}</Link>
              </div>
            </div>
            <TrackProgress progress={progressOf(trackSteps(t, template))} />
          </div>
        ))}
      </div>
    </section>
  );
}

function NewProject({ artist, onDone }: { artist: Artist; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProjectType>('singolo');
  const [releaseDate, setReleaseDate] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverDownload, setCoverDownload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const ref = await createProject(artist.id, { title: title.trim(), type, releaseDate, cover, coverDownload });
      if (coverFile && workerConfigured) await uploadCoverOriginal(artist, { id: ref.id, title: title.trim(), driveFolderId: null }, coverFile);
      onDone();
    }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  };

  return (
    <form className="card card-pad form" onSubmit={submit}>
      <h2 className="h2">Nuovo progetto</h2>
      <ProjectFields title={title} setTitle={setTitle} type={type} setType={setType}
        releaseDate={releaseDate} setReleaseDate={setReleaseDate} cover={cover} setCover={setCover} setError={setError}
        setCoverFile={setCoverFile} coverDownload={coverDownload} setCoverDownload={setCoverDownload} />
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="row-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creo…' : 'Crea progetto'}</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>Annulla</button>
      </div>
    </form>
  );
}

interface FieldsProps {
  title: string; setTitle: (v: string) => void;
  type: ProjectType; setType: (v: ProjectType) => void;
  releaseDate: string; setReleaseDate: (v: string) => void;
  cover: string | null; setCover: (v: string | null) => void;
  setError: (v: string | null) => void;
  setCoverFile: (f: File | null) => void;
  coverDownload: boolean; setCoverDownload: (v: boolean) => void;
}

function ProjectFields(p: FieldsProps) {
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { p.setCover(await compressImage(f, 600, 0.82)); p.setCoverFile(f); } catch (e) { p.setError(errorMessage(e)); }
  };
  return (
    <>
      <div className="photo-pick">
        <Cover src={p.cover} title={p.title || 'Copertina'} />
        <div className="row-actions">
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
            {p.cover ? 'Cambia copertina' : 'Carica copertina'}
            <input type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {p.cover && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { p.setCover(null); p.setCoverFile(null); }}>Rimuovi</button>}
        </div>
      </div>
      <label className="check" style={{ alignItems: 'center' }}>
        <input type="checkbox" checked={p.coverDownload} onChange={(e) => p.setCoverDownload(e.target.checked)} />
        <span className="small">L’artista può scaricare la copertina originale (piena qualità, salvata su Drive)</span>
      </label>
      <div className="grid-2">
        <label className="field"><span>Titolo *</span>
          <input className="input" required value={p.title} onChange={(e) => p.setTitle(e.target.value)} />
        </label>
        <label className="field"><span>Uscita prevista</span>
          <input className="input" type="date" value={p.releaseDate} onChange={(e) => p.setReleaseDate(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Tipo</span>
        <div className="pick-wrap">
          {PROJECT_TYPES.map((t) => (
            <button key={t.value} type="button" className="pick" aria-pressed={p.type === t.value} onClick={() => p.setType(t.value)}>{t.label}</button>
          ))}
        </div>
      </div>
    </>
  );
}

interface ProjectAdminProps {
  artist: Artist; project: Project; tracks: Track[]; template: string[]; comments: Comment[];
  first: boolean; last: boolean; onMove: (dir: -1 | 1) => Promise<void>;
}

function ProjectAdmin({ artist, project, tracks, template, comments, first, last, onMove }: ProjectAdminProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [type, setType] = useState<ProjectType>(project.type);
  const [releaseDate, setReleaseDate] = useState(project.releaseDate);
  const [cover, setCover] = useState<string | null>(project.cover);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverDownload, setCoverDownload] = useState(project.coverDownload);
  const [saving, setSaving] = useState(false);
  const [newTrack, setNewTrack] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setError(null);
    setSaving(true);
    try {
      await updateProject(artist.id, project.id, { title: title.trim(), type, releaseDate, cover, coverDownload, ...(cover ? {} : { coverFileId: null, coverFileName: '' }) });
      if (coverFile && workerConfigured) await uploadCoverOriginal(artist, project, coverFile);
      setCoverFile(null);
      setEditing(false);
    } catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!confirm(`Eliminare il progetto "${project.title}"?`)) return;
    try { await deleteProject(artist.id, project.id); } catch (err) { setError(errorMessage(err)); }
  };
  const move = (p: Promise<void>) => { setError(null); p.catch((err) => setError(errorMessage(err))); };
  const addTrack = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTrack.trim()) return;
    try { await createTrack(artist.id, project.id, newTrack.trim(), template); setNewTrack(''); }
    catch (err) { setError(errorMessage(err)); }
  };

  return (
    <section className="card project-card">
      {editing ? (
        <form className="card-pad form" onSubmit={save}>
          <ProjectFields title={title} setTitle={setTitle} type={type} setType={setType}
            releaseDate={releaseDate} setReleaseDate={setReleaseDate} cover={cover} setCover={setCover} setError={setError}
            setCoverFile={setCoverFile} coverDownload={coverDownload} setCoverDownload={setCoverDownload} />
          {cover && !coverFile && !project.coverFileId && <span className="tiny muted">Per rendere scaricabile la copertina in piena qualità ricaricala una volta: ora c’è solo la versione piccola.</span>}
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Annulla</button>
            <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => void remove()}>Elimina progetto</button>
          </div>
        </form>
      ) : (
        <div className="project-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <Cover src={project.cover} title={project.title} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="tiny muted" style={{ fontWeight: 600 }}>{PROJECT_TYPES.find((t) => t.value === project.type)?.label}{project.releaseDate ? ` · uscita ${new Date(project.releaseDate).toLocaleDateString('it-IT')}` : ''}{project.coverFileId ? (project.coverDownload ? ' · copertina scaricabile' : ' · copertina su Drive') : ''}</span>
              <span className="h2">{project.title}</span>
            </div>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sposta su il progetto ${project.title}`} disabled={first} onClick={() => move(onMove(-1))}>↑</button>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sposta giù il progetto ${project.title}`} disabled={last} onClick={() => move(onMove(1))}>↓</button>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>Modifica</button>
          </div>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ margin: '0 16px 16px' }} role="alert">{error}</div>}

      {tracks.map((t, i) => (
        <TrackAdmin key={t.id} artist={artist} project={project} track={t} template={template}
          openNotes={comments.filter((c) => c.trackId === t.id && !c.resolved && c.authorRole === 'artist').length}
          first={i === 0} last={i === tracks.length - 1}
          onMove={(dir) => move(moveInOrder(artist.id, 'tracks', tracks, tracks, t.id, dir))} />
      ))}

      <form className="track-row" onSubmit={addTrack} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <input className="input" placeholder="Titolo del nuovo brano" value={newTrack} onChange={(e) => setNewTrack(e.target.value)} aria-label="Titolo del nuovo brano" />
        <button className="btn btn-sm" style={{ minHeight: 48 }} disabled={!newTrack.trim()}>Aggiungi brano</button>
      </form>
    </section>
  );
}

interface TrackAdminProps {
  artist: Artist; project: Project; track: Track; template: string[]; openNotes: number;
  first: boolean; last: boolean; onMove: (dir: -1 | 1) => void;
}

function TrackAdmin({ artist, project, track, template, openNotes, first, last, onMove }: TrackAdminProps) {
  const [open, setOpen] = useState(false);
  const [featOpen, setFeatOpen] = useState(false);
  const { artists } = useArtists();
  const others = artists.filter((a) => a.id !== artist.id && a.active);
  const featNames = track.collaboratorIds.map((id) => artists.find((a) => a.id === id)?.stageName).filter(Boolean);
  const [stepsOpen, setStepsOpen] = useState(false);
  const { versions } = useVersions(artist.id, open ? track.id : null);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.catch((e) => setError(errorMessage(e)));
  const steps = trackSteps(track, template);
  const progress = progressOf(steps);

  return (
    <div className="track-row" style={{ gap: 12 }}>
      <div className="track-row-head" style={{ flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{track.title}</span>
          {featNames.length > 0 && <span className="badge badge-star">feat. {featNames.join(', ')}</span>}
          {openNotes > 0 && (
            <Link to={`/admin/artisti/${artist.id}/brani/${track.id}`} className="badge" style={{ background: 'rgba(241,109,47,.15)', color: 'var(--accent-soft)' }}>
              {openNotes === 1 ? '1 nota da risolvere' : `${openNotes} note da risolvere`}
            </Link>
          )}
        </span>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sposta su ${track.title}`} disabled={first} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sposta giù ${track.title}`} disabled={last} onClick={() => onMove(1)}>↓</button>
          <label className="check" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={track.awaitingReview} onChange={(e) => void run(updateTrack(artist.id, track.id, { awaitingReview: e.target.checked }))} />
            <span className="small">Da ascoltare</span>
          </label>
          <Link className="btn btn-sm" to={`/admin/artisti/${artist.id}/brani/${track.id}`}>Ascolta</Link>
          {!open && <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Carica MP3</button>}
          <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? 'Chiudi' : 'Versioni'}</button>
        </div>
      </div>

      <button type="button" className="progress-toggle" onClick={() => setStepsOpen((v) => !v)} aria-expanded={stepsOpen}>
        <TrackProgress progress={progress} compact />
        <span className="tiny" style={{ color: progressColor(progress.pct), fontWeight: 600 }}>
          {stepsOpen ? 'Chiudi il percorso' : `Percorso: ${progress.done}/${progress.total} step · modifica`}
        </span>
      </button>
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setFeatOpen((v) => !v)} aria-expanded={featOpen}>
        {featOpen ? 'Chiudi feat' : featNames.length ? 'Modifica feat' : '+ Feat con un altro artista'}
      </button>
      {featOpen && (
        <div className="inset">
          <span className="small" style={{ fontWeight: 600 }}>Artisti in feat</span>
          <span className="tiny muted">Vedranno questo brano nel loro profilo (versioni, player, note e avanzamento). Lo carichi una volta sola, qui.</span>
          {others.length === 0 ? <span className="small muted">Non ci sono altri artisti attivi.</span> : (
            <div className="pick-wrap">
              {others.map((a) => {
                const on = track.collaboratorIds.includes(a.id);
                return (
                  <button key={a.id} type="button" className="pick" aria-pressed={on}
                    onClick={() => void run(setCollaborators(artist.id, artist.stageName, track,
                      on ? track.collaboratorIds.filter((x) => x !== a.id) : [...track.collaboratorIds, a.id]))}>
                    {a.stageName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {stepsOpen && (
        <div className="inset">
          <StepsEditor steps={steps} onChange={(next) => {
            const nowComplete = progressOf(next).complete;
            // il giorno in cui spunti l'ultimo step diventa la data di uscita (se il progetto non ne ha una)
            const publishedAt = nowComplete ? (track.publishedAt || dayKey(new Date())) : '';
            void run(updateTrack(artist.id, track.id, { steps: next, publishedAt }));
          }} />
          <span className="tiny muted">L’artista vede solo la barra e il prossimo step, non questa lista. Quando spunti tutti gli step, per lui scatta la festa “Il tuo brano è sugli store”.</span>
          <StoreLinks links={track.links} onSave={(links) => void run(updateTrack(artist.id, track.id, { links }))} />
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {open && (
        <div className="inset">
          {versions.length === 0 && <span className="small muted">Nessuna versione caricata.</span>}
          {versions.map((v) => (
            <div key={v.id} className="version-row">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>{v.label}{track.currentVersionId === v.id ? ' · attuale' : ''}</span>
                <span className="tiny muted">{new Date(v.createdMs).toLocaleDateString('it-IT')} · {formatTime(v.duration)} · {v.fileName}</span>
              </div>
              <div className="row-actions">
                <label className="check" style={{ alignItems: 'center' }}>
                  <input type="checkbox" checked={v.downloadEnabled} onChange={(e) => void run(updateVersion(artist.id, v.id, { downloadEnabled: e.target.checked }))} />
                  <span className="small">Download</span>
                </label>
                {track.currentVersionId !== v.id && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void run(updateTrack(artist.id, track.id, { currentVersionId: v.id }))}>Rendi attuale</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  if (confirm(`Togliere "${v.label}" dall'app? Il file resta su Drive.`)) void run(deleteVersion(artist.id, v.id));
                }}>Elimina</button>
              </div>
            </div>
          ))}
          <UploadVersion artist={artist} project={project} track={track} count={versions.length} />
          <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
            if (confirm(`Eliminare il brano "${track.title}" e tutte le sue versioni dall'app? I file restano su Drive.`)) void run(deleteTrack(artist.id, track.id));
          }}>Elimina brano</button>
        </div>
      )}
    </div>
  );
}

function StoreLinks({ links, onSave }: { links: Track['links']; onSave: (l: Track['links']) => void }) {
  const [v, setV] = useState(links);
  const changed = JSON.stringify(v) !== JSON.stringify(links);
  return (
    <div className="form" style={{ gap: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
      <span className="small" style={{ fontWeight: 600 }}>Link agli store (quando è uscito)</span>
      <div className="grid-2">
        <input className="input" placeholder="Link Spotify" value={v.spotify ?? ''} onChange={(e) => setV({ ...v, spotify: e.target.value.trim() })} />
        <input className="input" placeholder="Link Apple Music" value={v.apple ?? ''} onChange={(e) => setV({ ...v, apple: e.target.value.trim() })} />
      </div>
      <input className="input" placeholder="Link YouTube" value={v.youtube ?? ''} onChange={(e) => setV({ ...v, youtube: e.target.value.trim() })} />
      {changed && <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => onSave(v)}>Salva link</button>}
    </div>
  );
}

type Step = 'idle' | 'analisi' | 'cartelle' | 'upload' | 'salvataggio' | 'fatto';
const STEP_TEXT: Record<Step, string> = {
  idle: '', analisi: 'Calcolo la forma d’onda…', cartelle: 'Preparo le cartelle su Drive…',
  upload: 'Carico su Drive…', salvataggio: 'Salvo la versione…', fatto: 'Versione caricata: l’artista la trova in “Da ascoltare”.',
};

function UploadVersion({ artist, project, track, count }: { artist: Artist; project: Project; track: Track; count: number }) {
  const suggested = `Mix v${count + 1}`;
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [downloadEnabled, setDownloadEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== 'idle' && step !== 'fatto';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') { setError('Carica un file MP3.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Il file supera 200 MB.'); return; }
    setError(null); setProgress(0);
    try {
      setStep('analisi');
      const { peaks, duration } = await analyzeAudio(file);
      setStep('cartelle');
      const folder = await ensureVersionsFolder(artist, project);
      setStep('upload');
      const uploaded = await uploadToDrive(file, folder, setProgress);
      setStep('salvataggio');
      await addVersion(artist.id, {
        trackId: track.id, projectId: project.id, label: label.trim() || suggested, mp3FileId: uploaded.id,
        fileName: file.name, size: file.size, peaks, duration, downloadEnabled, notes: notes.trim(),
        collaboratorUids: track.collaboratorUids,
      });
      setStep('fatto'); setFile(null); setLabel(''); setNotes('');
    } catch (err) {
      setError(errorMessage(err)); setStep('idle');
    }
  };

  return (
    <form className="form" onSubmit={submit} style={{ gap: 12, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
      <span style={{ fontWeight: 600 }}>Carica una nuova versione</span>
      <input className="input" type="file" accept=".mp3,audio/mpeg" disabled={busy}
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStep('idle'); }} aria-label="File MP3" />
      <div className="grid-2">
        <label className="field"><span>Nome versione</span>
          <input className="input" value={label} placeholder={suggested} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
        </label>
        <label className="check" style={{ alignSelf: 'end', minHeight: 48, alignItems: 'center' }}>
          <input type="checkbox" checked={downloadEnabled} onChange={(e) => setDownloadEnabled(e.target.checked)} disabled={busy} />
          <span className="small">Permetti all’artista di scaricare l’MP3</span>
        </label>
      </div>
      <label className="field"><span>Note per l’artista</span>
        <textarea className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy}
          placeholder="Voce alzata nel ritornello, basso più pulito." />
      </label>
      {step !== 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
          <span className="small">{STEP_TEXT[step]}{step === 'upload' ? ` ${Math.round(progress * 100)}%` : ''}</span>
          {busy && <div className="progress"><div style={{ width: `${step === 'upload' ? progress * 100 : step === 'salvataggio' ? 100 : 8}%` }} /></div>}
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!file || busy}>Carica versione</button>
    </form>
  );
}
