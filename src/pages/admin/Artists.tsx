import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { focusStyle, type Artist } from '../../lib/types';
import { useArtists } from '../../lib/data';
import { useAllDemos } from '../../lib/demos';
import { usePayments, useQuotes } from '../../lib/business';
import { artistInTitle, useCalendarUpcoming } from '../../lib/calendar';
import { useRecentActivity } from '../../lib/activity';
import { isUpcoming, parseAt, relativeDay, timeOf } from '../../lib/dates';
import { eur } from '../../lib/money';
import { Loading } from '../../components/Loading';
import { IconPlus } from '../../components/Icons';

type Sort = 'nome' | 'recenti' | 'attivita' | 'demo' | 'saldo';
type Filter = 'tutti' | 'attivi' | 'disattivati' | 'demo' | 'pagamenti' | 'sessione';
type View = 'riquadri' | 'elenco';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'nome', label: 'Nome A–Z' },
  { value: 'recenti', label: 'Più recenti' },
  { value: 'attivita', label: 'Attività recente' },
  { value: 'demo', label: 'Demo da ascoltare' },
  { value: 'saldo', label: 'Saldo da incassare' },
];
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'attivi', label: 'Attivi' },
  { value: 'disattivati', label: 'Disattivati' },
  { value: 'demo', label: 'Con demo nuove' },
  { value: 'pagamenti', label: 'Con pagamenti in sospeso' },
  { value: 'sessione', label: 'Con sessione nei prossimi 7 giorni' },
];

// Ultima scelta di ordinamento e vista, ricordata su questo dispositivo.
function remembered<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
}
function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* navigazione privata: pazienza */ }
}

/** Ricerca senza accenti e maiuscole: "jose" trova "José". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Row {
  a: Artist;
  newDemos: number;
  owedCents: number;      // da incassare: residuo dei preventivi o richieste aperte, il più alto dei due
  openPayments: number;   // richieste da pagare o segnalate
  next: Date | null;      // prossima sessione (calendario, altrimenti quella scritta nel profilo)
  activityMs: number;
}

export function Artists() {
  const { artists, loading } = useArtists();
  // demo, pagamenti e calendario li carica già il pannello: queste letture sono condivise
  const demos = useAllDemos(true);
  const payments = usePayments('tutti');
  const quotes = useQuotes('tutti');
  const cal = useCalendarUpcoming(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tutti');
  const [sort, setSortState] = useState<Sort>(() => remembered('artisti.ordina', SORTS.map((s) => s.value), 'nome'));
  const [view, setViewState] = useState<View>(() => remembered('artisti.vista', ['riquadri', 'elenco'] as const, 'riquadri'));
  const setSort = (v: Sort) => { setSortState(v); remember('artisti.ordina', v); };
  const setView = (v: View) => { setViewState(v); remember('artisti.vista', v); };
  const activity = useRecentActivity(sort === 'attivita');

  const rows = useMemo<Row[]>(() => {
    const calNext: Record<string, Date> = {};
    for (const e of cal.events) {
      const a = artistInTitle(e.title, artists);
      const d = parseAt(e.at);
      if (a && d && isUpcoming(d) && !calNext[a.id]) calNext[a.id] = d;
    }
    return artists.map((a) => {
      const mine = payments.filter((p) => p.artistId === a.id);
      const open = mine.filter((p) => p.status !== 'pagato');
      const residual = quotes.filter((x) => x.artistId === a.id).reduce((sum, x) => {
        const paid = mine.filter((p) => p.quoteId === x.id && p.status === 'pagato').reduce((s, p) => s + p.amountCents, 0);
        return sum + Math.max(0, x.amountCents - paid);
      }, 0);
      const manual = parseAt(a.nextSession.at);
      const next = calNext[a.id] ?? (manual && isUpcoming(manual) ? manual : null);
      const myDemos = demos.filter((d) => d.artistId === a.id);
      return {
        a,
        newDemos: myDemos.filter((d) => d.status === 'nuova').length,
        owedCents: Math.max(residual, open.reduce((s, p) => s + p.amountCents, 0)),
        openPayments: open.length,
        next,
        activityMs: Math.max(activity[a.id] ?? 0, ...myDemos.map((d) => d.createdMs), 0),
      };
    });
  }, [artists, payments, quotes, demos, cal.events, activity]);

  if (loading) return <Loading />;

  const in7 = Date.now() + 7 * 86_400_000;
  const matchesFilter = (r: Row, f: Filter) => {
    switch (f) {
      case 'attivi': return r.a.active;
      case 'disattivati': return !r.a.active;
      case 'demo': return r.newDemos > 0;
      case 'pagamenti': return r.openPayments > 0;
      case 'sessione': return !!r.next && r.next.getTime() <= in7;
      default: return true;
    }
  };
  const needle = fold(q.trim());
  const found = rows.filter((r) => !needle || fold(r.a.stageName).includes(needle) || fold(r.a.realName).includes(needle));
  const byName = (x: Row, y: Row) => x.a.stageName.localeCompare(y.a.stageName, 'it', { sensitivity: 'base' });
  const compare: Record<Sort, (x: Row, y: Row) => number> = {
    nome: byName,
    recenti: (x, y) => y.a.createdMs - x.a.createdMs || byName(x, y),
    attivita: (x, y) => y.activityMs - x.activityMs || byName(x, y),
    demo: (x, y) => y.newDemos - x.newDemos || byName(x, y),
    saldo: (x, y) => y.owedCents - x.owedCents || byName(x, y),
  };
  // i disattivati vanno sempre in fondo
  const list = found.filter((r) => matchesFilter(r, filter))
    .sort((x, y) => Number(!x.a.active) - Number(!y.a.active) || compare[sort](x, y));
  const active = artists.filter((a) => a.active).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display page-title">Artisti</h1>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {active === 1 ? '1 artista attivo' : `${active} artisti attivi`}
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
        <>
          <div className="artists-tools">
            <input className="input" type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
              placeholder="Cerca per nome d’arte o nome reale" aria-label="Cerca artista" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="artists-tools-row">
              <label className="artists-sort">
                <span className="small muted">Ordina per</span>
                <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <div className="seg" role="group" aria-label="Vista">
                <button type="button" aria-pressed={view === 'riquadri'} onClick={() => setView('riquadri')}>Riquadri</button>
                <button type="button" aria-pressed={view === 'elenco'} onClick={() => setView('elenco')}>Elenco</button>
              </div>
            </div>
            <div className="artists-filters" role="group" aria-label="Filtri">
              {FILTERS.map((f) => {
                const n = found.filter((r) => matchesFilter(r, f.value)).length;
                return (
                  <button key={f.value} type="button" className="pick" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                    {f.label}{f.value !== 'tutti' && ` · ${n}`}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="small muted" role="status" style={{ margin: 0 }}>
            {list.length === 0 ? 'Nessun artista corrisponde.' : list.length === 1 ? '1 artista' : `${list.length} artisti`}
          </p>

          {list.length > 0 && (view === 'riquadri' ? (
            <div className="artist-grid">
              {list.map((r) => (
                <Link key={r.a.id} to={`/admin/artisti/${r.a.id}`} className={`artist-tile${r.a.active ? '' : ' inactive'}`}>
                  {r.a.photo ? <img src={r.a.photo} alt="" style={focusStyle(r.a.photoFocus)} /> : <span className="monogram" aria-hidden="true">{r.a.stageName.slice(0, 1)}</span>}
                  <div className="meta">
                    <span className="name">{r.a.stageName}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!r.a.active && <span className="badge badge-off">Disattivato</span>}
                      {r.newDemos > 0 && <span className="badge badge-new">{r.newDemos === 1 ? '1 demo nuova' : `${r.newDemos} demo nuove`}</span>}
                      {r.a.genres.slice(0, 2).map((g) => <span key={g} className="badge">{g}</span>)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <ul className="artist-list" aria-label="Elenco artisti">
              {list.map((r) => (
                <li key={r.a.id}>
                  <Link to={`/admin/artisti/${r.a.id}`} className={`artist-line${r.a.active ? '' : ' inactive'}`}>
                    <span className="artist-line-name">
                      <strong>{r.a.stageName}</strong>
                      {r.a.realName && <span className="tiny muted">{r.a.realName}</span>}
                    </span>
                    <span className="artist-line-badges">
                      <span className={`badge ${r.a.active ? 'badge-on' : 'badge-off'}`}>{r.a.active ? 'Attivo' : 'Disattivato'}</span>
                      {r.newDemos > 0 && <span className="badge badge-new">{r.newDemos === 1 ? '1 demo' : `${r.newDemos} demo`}</span>}
                    </span>
                    <span className="artist-line-cell">
                      <span className="tiny muted">Da incassare</span>
                      <span className="small" style={{ fontWeight: 600, color: r.owedCents ? 'var(--text)' : 'var(--muted)' }}>{r.owedCents ? eur(r.owedCents) : '—'}</span>
                    </span>
                    <span className="artist-line-cell">
                      <span className="tiny muted">Prossima sessione</span>
                      <span className="small">{r.next ? `${relativeDay(r.next)} · ${timeOf(r.next)}` : '—'}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </>
      )}
    </>
  );
}
