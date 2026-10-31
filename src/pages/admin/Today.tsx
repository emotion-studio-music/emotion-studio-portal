import { Link } from 'react-router-dom';
import { useToday } from '../../lib/today';
import { useArtists } from '../../lib/data';
import { PAYMENT_KIND, fmtDay, setTaskDone, todayKey, updatePayment, type Task } from '../../lib/business';
import { eur } from '../../lib/money';
import { formatTime } from '../../lib/audio';
import { isUpcoming, longDate, parseAt, timeOf } from '../../lib/dates';
import { artistInTitle, useCalendarUpcoming } from '../../lib/calendar';

export function Today() {
  const t = useToday();
  const { artists } = useArtists();
  const name = (id: string) => artists.find((a) => a.id === id)?.stageName ?? '';
  const cal = useCalendarUpcoming(true);
  const calSessions = cal.events
    .map((e) => ({ e, a: artistInTitle(e.title, artists.filter((x) => x.active)), d: parseAt(e.at) }))
    .filter((x) => x.d && x.d.getTime() - Date.now() < 7 * 86_400_000);
  const upcoming = artists
    .map((a) => ({ a, d: parseAt(a.nextSession.at) }))
    .filter((x) => x.a.active && x.d && isUpcoming(x.d) && x.d.getTime() - Date.now() < 7 * 86_400_000)
    .sort((x, y) => x.d!.getTime() - y.d!.getTime());
  const greeting = new Date().getHours() < 13 ? 'Buongiorno' : new Date().getHours() < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display page-title">{greeting}</h1>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            {t.count === 0 ? 'Niente in sospeso: sei in pari.' : t.count === 1 ? '1 cosa richiede la tua attenzione.' : `${t.count} cose richiedono la tua attenzione.`}
          </p>
        </div>
      </div>

      {t.reported.length > 0 && (
        <Block title="Pagamenti da confermare" hint="Gli artisti dicono di aver pagato: controlla e conferma.">
          {t.reported.map((p) => (
            <div key={p.id} className="today-row">
              <span><strong>{name(p.artistId)}</strong> · {PAYMENT_KIND[p.kind]} {eur(p.amountCents)} · {p.reportedMethod}</span>
              <div className="row-actions">
                <button className="btn btn-primary btn-sm" onClick={() => void updatePayment(p.artistId, p.id, { status: 'pagato', paidDate: todayKey() })}>Conferma incasso</button>
                <Link className="btn btn-ghost btn-sm" to={`/admin/artisti/${p.artistId}/gestione`}>Apri</Link>
              </div>
            </div>
          ))}
        </Block>
      )}

      {t.notes.length > 0 && (
        <Block title="Note degli artisti da risolvere">
          {t.notes.slice(0, 20).map((c) => {
            const demo = c.trackId?.startsWith('demo:');
            const href = demo ? `/admin/artisti/${c.artistId}/demo/${c.trackId.slice(5)}` : `/admin/artisti/${c.artistId}/brani/${c.trackId}`;
            return (
              <Link key={c.id} to={href} className="today-row link">
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span><strong>{c.authorName || name(c.artistId)}</strong>{demo ? ' · su una demo' : ''}{c.atSeconds !== null ? ` · a ${formatTime(c.atSeconds)}` : ''}</span>
                  <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</span>
                </span>
                <span className="tiny muted">{new Date(c.createdMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
              </Link>
            );
          })}
        </Block>
      )}

      {t.demos.length > 0 && (
        <Block title="Demo nuove">
          {t.demos.map((d) => (
            <Link key={d.id} to={`/admin/artisti/${d.artistId}/demo/${d.id}`} className="today-row link">
              <span><strong>{name(d.artistId)}</strong> · {d.title}</span>
              <span className="tiny muted">{formatTime(d.duration)}</span>
            </Link>
          ))}
        </Block>
      )}

      {(t.myTasks.length > 0 || t.artistTasks.length > 0) && (
        <Block title="Task">
          {t.myTasks.map((k) => <TaskRow key={k.id} k={k} who="Tocca a te" name={name(k.artistId)} />)}
          {t.artistTasks.map((k) => <TaskRow key={k.id} k={k} who="Tocca all’artista" name={name(k.artistId)} />)}
        </Block>
      )}

      {t.overduePayments.length > 0 && (
        <Block title="Pagamenti scaduti">
          {t.overduePayments.map((p) => (
            <Link key={p.id} to={`/admin/artisti/${p.artistId}/gestione`} className="today-row link">
              <span><strong>{name(p.artistId)}</strong> · {PAYMENT_KIND[p.kind]} {eur(p.amountCents)}</span>
              <span className="tiny" style={{ color: 'var(--danger)' }}>scaduto il {fmtDay(p.dueDate)}</span>
            </Link>
          ))}
        </Block>
      )}

      <Block title="Sessioni nei prossimi 7 giorni" hint={cal.status}>
 {cal.configured ? (calSessions.length === 0 ? <span className="small muted">Nessun impegno in calendario.</span> : calSessions.map(({ e, a, d }) => (
          a ? (
            <Link key={`${e.at}-${e.title}`} to={`/admin/artisti/${a.id}`} className="today-row link">
              <span><strong>{a.stageName}</strong> · {e.title}</span>
              <span className="small muted">{longDate(d!)}{e.allDay ? '' : ` · ${timeOf(d!)}`}</span>
            </Link>
          ) : (
            <div key={`${e.at}-${e.title}`} className="today-row">
              <span className="muted">{e.title} <span className="tiny">· non è un artista dell’app</span></span>
              <span className="small muted">{longDate(d!)}{e.allDay ? '' : ` · ${timeOf(d!)}`}</span>
            </div>
          )
        ))) : upcoming.length === 0 ? <span className="small muted">Nessuna sessione in programma.</span> : upcoming.map(({ a, d }) => (
          <Link key={a.id} to={`/admin/artisti/${a.id}`} className="today-row link">
            <span><strong>{a.stageName}</strong>{a.nextSession.type ? ` · ${a.nextSession.type}` : ''}</span>
            <span className="small muted">{longDate(d!)} · {timeOf(d!)}</span>
          </Link>
        ))}
      </Block>
    </>
  );
}

function TaskRow({ k, who, name }: { k: Task; who: string; name: string }) {
  const late = k.dueDate && k.dueDate < todayKey();
  const isToday = k.dueDate === todayKey();
  return (
    <label className="today-row check" style={{ alignItems: 'center' }}>
      <input type="checkbox" checked={k.done} onChange={(e) => void setTaskDone(k.artistId, k.id, e.target.checked)} />
      <span style={{ flex: 1 }}>
        <strong>{name}</strong> · {k.title}
        <span className="tiny" style={{ display: 'block', color: late ? 'var(--danger)' : isToday ? 'var(--amber)' : 'var(--muted)' }}>
          {who}{k.dueDate ? ` · ${late ? 'scaduto il' : isToday ? 'scade oggi' : 'entro'} ${isToday ? '' : fmtDay(k.dueDate)}` : ''}
        </span>
      </span>
      <Link to={`/admin/artisti/${k.artistId}/gestione?tab=task`} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>Apri</Link>
    </label>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 className="h2">{title}</h2>
      {hint && <span className="small muted">{hint}</span>}
      <div className="list" style={{ marginTop: 6 }}>{children}</div>
    </section>
  );
}
