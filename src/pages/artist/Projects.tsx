import { useAuth } from '../../lib/auth';
import { useProjects, useTracks } from '../../lib/music';
import { ProjectList } from '../../components/ProjectList';
import { Loading } from '../../components/Loading';
import { SharedTracks } from '../../components/SharedTracks';

export function Projects() {
  const { artistId } = useAuth();
  const { projects, loading } = useProjects(artistId);
  const { tracks } = useTracks(artistId);
  if (loading) return <Loading />;
  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <h1 className="display" style={{ fontSize: 44 }}>Progetti</h1>
        {projects.length === 0
          ? <div className="empty"><strong>Ancora nessun progetto</strong>Singoli ed EP compariranno qui con lo stato di ogni brano.</div>
          : <ProjectList artistId={artistId!} projects={projects} tracks={tracks} trackHref={(t) => `/brano/${t.id}`} />}
        <SharedTracks />
      </div>
    </div>
  );
}
