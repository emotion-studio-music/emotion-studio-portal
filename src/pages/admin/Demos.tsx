import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEMO_STATUS, useAllDemos, type DemoStatus } from '../../lib/demos';
import { useArtists } from '../../lib/data';
import { formatTime } from '../../lib/audio';
import { Stars } from '../../components/Stars';
import { IconArrowLeft } from '../../components/Icons';

type Filter = DemoStatus | 'tutte';

/** Demo di tutti gli artisti, o di uno solo se nell'indirizzo c'è l'artista. */
export function Demos() {
  const { id } = useParams();
  const all = useAllDemos(true);
  const { artists } = useArtists();
  const [filter, setFilter] = useState<Filter>('nuova');
  const [sort, setSort] = useState<'data' | 'stelle'>('data');

  const scoped = id ? all.filter((d) => d.artistId === id) : all;
  const count = (s: Filter) => (s === 'tutte' ? scoped.length : scoped.filter((d) => d.status === s).length);
  const list = useMemo(() => {
    const l = filter === 'tutte' ? scoped : scoped.filter((d) => d.status === filter);
    return [...l].sort((a, b) => (sort === 'stelle' ? b.rating - a.rating || b.createdMs - a.createdMs : b.createdMs - a.createdMs));
  }, [scoped, filter, sort]);
  const name = (aid: string) => artists.find((a) => a.id === aid)?.stageName ?? '';

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {id && <Link to={`/admin/artisti/${id}`} className="back-link"><IconArrowLeft width={16} height={16} /> {name(id)}</Link>}
          <h1 className="display page-title">Demo</h1>
          <span className="small muted">{count('nuova') === 1 ? '1 demo da ascoltare' : `${count('nuova')} demo da ascoltare`}</span>
        </div>
        <div className="seg" role="group" aria-label="Ordina">
          <button type="button" aria-pressed={sort === 'data'} onClick={() => setSort('data')}>Più recenti</button>
          <button type="button" aria-pressed={sort === 'stelle'} onClick={() => setSort('stelle')}>Più stelle</button>
        </div>
      </div>

      <div className="pick-wrap" role="group" aria-label="Filtra per stato">
        {[...DEMO_STATUS.map((s) => ({ value: s.value as Filter, label: s.label })), { value: 'tutte' as Filter, label: 'Tutte' }].map((s) => (
          <button key={s.value} type="button" className="pick" aria-pressed={filter === s.value} onClick={() => setFilter(s.value)}>
            {s.label} · {count(s.value)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty">{filter === 'nuova' ? 'Nessuna demo nuova: sei in pari.' : 'Nessuna demo in questo elenco.'}</div>
      ) : (
        <div className="card list">
          {list.map((d) => (
            <Link key={`${d.artistId}-${d.id}`} to={`/admin/artisti/${d.artistId}/demo/${d.id}`} className="demo-row">
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{d.title}</span>
                <span className="tiny muted">
                  {!id && <><strong style={{ color: 'var(--text)' }}>{name(d.artistId)}</strong> · </>}
                  {new Date(d.createdMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {formatTime(d.duration)}
                  {d.source === 'registrazione' ? ' · registrata in app' : ''}{d.note ? ' · con nota' : ''}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {d.rating > 0 && <Stars value={d.rating} size={14} />}
                <span className={`badge${d.status === 'nuova' ? ' badge-new' : d.status === 'selezionata' ? ' badge-star' : ''}`}>
                  {DEMO_STATUS.find((s) => s.value === d.status)?.label}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
