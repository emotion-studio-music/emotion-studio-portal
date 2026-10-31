import { focusStyle } from '../../lib/types';
import { Link } from 'react-router-dom';
import { useArtists } from '../../lib/data';
import { useAllDemos } from '../../lib/demos';
import { Loading } from '../../components/Loading';
import { IconPlus } from '../../components/Icons';

export function Artists() {
  const { artists, loading } = useArtists();
  const demos = useAllDemos(true);
  if (loading) return <Loading />;
  const active = artists.filter((a) => a.active);
  const inactive = artists.filter((a) => !a.active);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display page-title">Artisti</h1>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {active.length === 1 ? '1 artista attivo' : `${active.length} artisti attivi`}
          </p>
        </div>
        <Link to="/admin/artisti/nuovo" className="btn btn-primary"><IconPlus width={18} height={18} /> Nuovo artista</Link>
      </div>

      {artists.length === 0 ? (
        <div className="empty">
          <strong>Nessun artista ancora</strong>
          Crea il primo profilo: l’app genera la password e ti prepara il messaggio da mandare su WhatsApp.
        </div>
      ) : (
        <div className="artist-grid">
          {[...active, ...inactive].map((a) => (
            <Link key={a.id} to={`/admin/artisti/${a.id}`} className={`artist-tile${a.active ? '' : ' inactive'}`}>
              {a.photo ? <img src={a.photo} alt="" style={focusStyle(a.photoFocus)} /> : <span className="monogram" aria-hidden="true">{a.stageName.slice(0, 1)}</span>}
              <div className="meta">
                <span className="name">{a.stageName}</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!a.active && <span className="badge badge-off">Disattivato</span>}
                  {(() => { const n = demos.filter((d) => d.artistId === a.id && d.status === 'nuova').length; return n > 0 ? <span className="badge badge-new">{n === 1 ? '1 demo nuova' : `${n} demo nuove`}</span> : null; })()}
                  {a.genres.slice(0, 2).map((g) => <span key={g} className="badge">{g}</span>)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
