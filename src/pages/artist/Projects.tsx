import { useAuth } from '../../lib/auth';
import { useProjects, useTracks, type Track } from '../../lib/music';
import { useSettings } from '../../lib/data';
import { releaseInfo } from '../../lib/release';
import { Discography } from '../../components/ReleaseCards';
import { ProjectList } from '../../components/ProjectList';
import { Loading } from '../../components/Loading';
import { SharedTracks } from '../../components/SharedTracks';

export function Projects() {
  const { artistId } = useAuth();
  const { projects, loading } = useProjects(artistId);
  const { tracks } = useTracks(artistId);
  const { settings } = useSettings();
  const rel = (t: Track) => releaseInfo(t, projects.find((p) => p.id === t.projectId), settings.stepTemplate);
  const working = tracks.filter((t) => !rel(t).released);
  const workingProjects = projects.filter((p) => {
    const its = tracks.filter((t) => t.projectId === p.id);
    return its.length === 0 || its.some((t) => !rel(t).released);
  });
  const disco = tracks
    .map((t) => ({ t, p: projects.find((x) => x.id === t.projectId), r: rel(t) }))
    .filter((x) => x.r.inDiscography)
    .sort((a, b) => b.r.date.localeCompare(a.r.date))
    .map((x) => ({ t: x.t, p: x.p, date: x.r.date }));
  if (loading) return <Loading />;
  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <h1 className="display" style={{ fontSize: 44 }}>Progetti</h1>
        <h2 className="h2">In lavorazione</h2>
        {workingProjects.length === 0
          ? <div className="empty"><strong>{projects.length ? 'Nessun lavoro in corso' : 'Ancora nessun progetto'}</strong>Singoli ed EP in lavorazione compariranno qui con lo stato di ogni brano.</div>
          : <ProjectList artistId={artistId!} projects={workingProjects} tracks={working} trackHref={(t) => `/brano/${t.id}`} />}
        <Discography artistId={artistId!} items={disco} hrefOf={(t) => `/brano/${t.id}`} />
        <SharedTracks />
      </div>
    </div>
  );
}
