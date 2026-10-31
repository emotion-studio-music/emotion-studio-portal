import { Link } from 'react-router-dom';
import type { Project, Track } from '../lib/music';
import { typeLabel } from '../lib/music';
import { TrackProgress } from './TrackProgress';
import { useSettings } from '../lib/data';
import { trackSteps } from '../lib/music';
import { progressOf } from '../lib/steps';
import { Cover } from './Cover';
import { CoverDownload } from './CoverDownload';

interface Props {
  artistId: string;
  projects: Project[];
  tracks: Track[];
  trackHref: (t: Track) => string;
}

export function ProjectList({ artistId, projects, tracks, trackHref }: Props) {
  const { settings } = useSettings();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {projects.map((p) => {
        const list = tracks.filter((t) => t.projectId === p.id);
        return (
          <div key={p.id} className="card project-card">
            <div className="project-head">
              <Cover src={p.cover} title={p.title} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span className="tiny muted" style={{ fontWeight: 600 }}>
                  {typeLabel(p.type)} · {list.length === 1 ? '1 brano' : `${list.length} brani`}
                </span>
                <span className="h2" style={{ overflowWrap: 'anywhere' }}>{p.title}</span>
                {p.releaseDate && <span className="small muted">Uscita prevista {new Date(p.releaseDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                <div style={{ marginTop: 4 }}><CoverDownload artistId={artistId} project={p} small /></div>
              </div>
            </div>
            {list.map((t) => (
              <Link key={t.id} to={trackHref(t)} className="track-row">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span>
                <TrackProgress progress={progressOf(trackSteps(t, settings.stepTemplate))} compact />
              </Link>
            ))}
            {list.length === 0 && <div className="track-row small muted">Nessun brano ancora.</div>}
          </div>
        );
      })}
    </div>
  );
}
