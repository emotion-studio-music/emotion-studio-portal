import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useArtist } from '../../lib/data';
import { useProjects, useTracks } from '../../lib/music';
import {
  PAYMENT_KIND, SESSION_TYPES, createPayment, createQuote, createSession, createTask, deletePayment, deleteQuote,
  deleteSession, deleteTask, fmtDay, quoteSummary, setTaskDone, todayKey, updatePayment, usePayments, useQuotes,
  useSessions, useTasks, type Payment, type PaymentKind, type Quote,
} from '../../lib/business';
import { eur, parseEuro } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { Loading } from '../../components/Loading';
import { IconArrowLeft } from '../../components/Icons';

type Tab = 'pagamenti' | 'sessioni' | 'task';

export function Manage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'pagamenti';
  const { artist, loading } = useArtist(id);
  if (loading) return <Loading />;
  if (!artist || !id) return <div className="empty">Artista non trovato.</div>;

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to={`/admin/artisti/${id}`} className="back-link"><IconArrowLeft width={16} height={16} /> {artist.stageName}</Link>
          <h1 className="display page-title">Lavori e pagamenti</h1>
        </div>
      </div>
      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
        {(['pagamenti', 'sessioni', 'task'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-pressed={tab === t} aria-selected={tab === t} onClick={() => setParams({ tab: t })}>
            {t === 'pagamenti' ? 'Pagamenti' : t === 'sessioni' ? 'Sessioni' : 'Task'}
          </button>
        ))}
      </div>
      {tab === 'pagamenti' && <PaymentsTab artistId={id} />}
      {tab === 'sessioni' && <SessionsTab artistId={id} />}
      {tab === 'task' && <TasksTab artistId={id} />}
    </>
  );
}

// ───────── Pagamenti ─────────

function PaymentsTab({ artistId }: { artistId: string }) {
  const quotes = useQuotes(artistId).sort((a, b) => b.createdMs - a.createdMs);
  const payments = usePayments(artistId);
  const { projects } = useProjects(artistId);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [projectId, setProjectId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const total = quotes.reduce((s, q) => s + q.amountCents, 0);
  const left = quotes.reduce((s, q) => s + quoteSummary(q, payments).left, 0);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseEuro(amount);
    if (!title.trim() || cents === null) { setError('Inserisci titolo e importo (es. 350 o 350,50).'); return; }
    setError(null);
    try { await createQuote(artistId, { title: title.trim(), amountCents: cents, projectId: projectId || null, note: note.trim() }); setTitle(''); setAmount(''); setNote(''); setProjectId(''); }
    catch (err) { setError(errorMessage(err)); }
  };

  return (
    <>
      <div className="grid-2">
        <div className="card card-pad stat-card"><span className="tiny muted">Preventivi totali</span><span className="money-mid">{eur(total)}</span></div>
        <div className="card card-pad stat-card"><span className="tiny muted">Ancora da incassare</span><span className="money-mid" style={{ color: left ? 'var(--accent-soft)' : 'var(--ok)' }}>{eur(left)}</span></div>
      </div>

      <form className="card card-pad form" onSubmit={add}>
        <h2 className="h2">Nuovo preventivo</h2>
        <div className="grid-2">
          <label className="field"><span>Per cosa</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Singolo “Notte Blu” – produzione, mix e master" /></label>
          <label className="field"><span>Importo concordato (€)</span><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="600" /></label>
        </div>
        <div className="grid-2">
          <label className="field"><span>Progetto (facoltativo)</span>
            <select className="select" style={{ minHeight: 48 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Nessuno</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="field"><span>Nota visibile all’artista</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Include 2 revisioni del mix" /></label>
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Crea preventivo</button>
      </form>

      {quotes.map((q) => <QuoteCard key={q.id} artistId={artistId} q={q} payments={payments} />)}
    </>
  );
}

function QuoteCard({ artistId, q, payments }: { artistId: string; q: Quote; payments: Payment[] }) {
  const s = quoteSummary(q, payments);
  const [kind, setKind] = useState<PaymentKind>(s.payments.length ? 'saldo' : 'acconto');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [card, setCard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pct = q.amountCents ? Math.round((s.paid / q.amountCents) * 100) : 0;
  const run = (p: Promise<unknown>) => p.catch((e) => setError(errorMessage(e)));

  const add = async (status: 'da_pagare' | 'pagato') => {
    const cents = parseEuro(amount || (kind === 'saldo' ? String(s.left / 100) : ''));
    if (cents === null || cents === 0) { setError('Inserisci un importo.'); return; }
    if (card && !/^https:\/\//.test(card)) { setError('Il link di pagamento deve iniziare con https://'); return; }
    setError(null);
    await run(createPayment(artistId, {
      quoteId: q.id, kind, amountCents: cents, status, dueDate: due, cardLink: card.trim(), note: '',
      ...(status === 'pagato' ? { paidDate: todayKey() } : {}),
    }));
    setAmount(''); setDue(''); setCard(''); setKind('saldo');
  };

  return (
    <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="section-head">
        <span className="h3">{q.title}</span>
        <span style={{ fontWeight: 700 }}>{eur(q.amountCents)}</span>
      </div>
      <div className="progress"><div style={{ width: `${pct}%` }} /></div>
      <span className="small muted">Incassato {eur(s.paid)} · {s.left > 0 ? `mancano ${eur(s.left)}` : 'saldato ✓'}</span>

      {s.payments.length > 0 && (
        <div className="inset" style={{ gap: 0 }}>
          {s.payments.map((p) => <PaymentRow key={p.id} artistId={artistId} p={p} run={run} />)}
        </div>
      )}

      <div className="inset">
        <span className="small" style={{ fontWeight: 600 }}>Chiedi un pagamento o registra un incasso</span>
        <div className="pick-wrap">
          {(['acconto', 'saldo', 'altro'] as PaymentKind[]).map((k) => (
            <button key={k} type="button" className="pick" aria-pressed={kind === k} onClick={() => setKind(k)}>{PAYMENT_KIND[k]}</button>
          ))}
        </div>
        <div className="grid-2">
          <label className="field"><span>Importo (€)</span><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={kind === 'saldo' && s.left ? String(s.left / 100).replace('.', ',') : '150'} /></label>
          <label className="field"><span>Entro il (facoltativo)</span><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
        <label className="field"><span>Link per pagare con carta (facoltativo)</span>
          <input className="input" value={card} onChange={(e) => setCard(e.target.value)} placeholder="https://… generato da Nexi, SumUp, Stripe…" />
        </label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="row-actions">
          <button className="btn btn-primary btn-sm" onClick={() => void add('da_pagare')}>Chiedi all’artista</button>
          <button className="btn btn-sm" onClick={() => void add('pagato')}>Registra come già incassato</button>
          {s.payments.length === 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm('Eliminare il preventivo?')) void run(deleteQuote(artistId, q.id)); }}>Elimina preventivo</button>
          )}
        </div>
      </div>
    </section>
  );
}

function PaymentRow({ artistId, p, run }: { artistId: string; p: Payment; run: (x: Promise<unknown>) => void }) {
  const [invoice, setInvoice] = useState(p.invoiceNumber);
  const label = p.status === 'pagato' ? 'Incassato' : p.status === 'segnalato' ? `Segnalato dall’artista (${p.reportedMethod})` : 'In attesa';
  return (
    <div className="version-row">
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 600 }}>{PAYMENT_KIND[p.kind]} · {eur(p.amountCents)}</span>
        <span className="tiny" style={{ color: p.status === 'pagato' ? 'var(--ok)' : p.status === 'segnalato' ? 'var(--amber)' : 'var(--muted)', fontWeight: 600 }}>
          {label}{p.dueDate && p.status !== 'pagato' ? ` · entro ${fmtDay(p.dueDate)}` : ''}{p.paidDate ? ` · ${fmtDay(p.paidDate)}` : ''}
        </span>
      </span>
      <div className="row-actions">
        <input className="input" style={{ width: 130, minHeight: 40, padding: '6px 10px', fontSize: 14 }} value={invoice} placeholder="N° fattura"
          aria-label="Numero fattura" onChange={(e) => setInvoice(e.target.value)} onBlur={() => invoice !== p.invoiceNumber && run(updatePayment(artistId, p.id, { invoiceNumber: invoice.trim() }))} />
        {p.status !== 'pagato'
          ? <button className="btn btn-primary btn-sm" onClick={() => run(updatePayment(artistId, p.id, { status: 'pagato', paidDate: todayKey() }))}>Conferma incasso</button>
          : <button className="btn btn-ghost btn-sm" onClick={() => run(updatePayment(artistId, p.id, { status: 'da_pagare', paidDate: '' }))}>Annulla incasso</button>}
        <button className="btn btn-ghost btn-sm" aria-label="Elimina" onClick={() => { if (confirm('Eliminare questa voce?')) run(deletePayment(artistId, p.id)); }}>✕</button>
      </div>
    </div>
  );
}

// ───────── Sessioni ─────────

function SessionsTab({ artistId }: { artistId: string }) {
  const sessions = useSessions(artistId).sort((a, b) => b.date.localeCompare(a.date));
  const { tracks } = useTracks(artistId);
  const [date, setDate] = useState(todayKey());
  const [hours, setHours] = useState('3');
  const [type, setType] = useState(SESSION_TYPES[0]);
  const [description, setDescription] = useState('');
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const total = sessions.reduce((s, x) => s + x.hours, 0);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const h = Number(hours.replace(',', '.'));
    if (!date || !(h > 0)) { setError('Inserisci data e ore.'); return; }
    setError(null);
    try { await createSession(artistId, { date, hours: h, type, description: description.trim(), trackIds }); setDescription(''); setTrackIds([]); }
    catch (err) { setError(errorMessage(err)); }
  };

  return (
    <>
      <div className="card card-pad stat-card" style={{ alignSelf: 'flex-start', minWidth: 220 }}>
        <span className="tiny muted">Ore totali</span><span className="money-mid">{total.toLocaleString('it-IT')} h</span>
      </div>
      <form className="card card-pad form" onSubmit={add}>
        <h2 className="h2">Registra una sessione</h2>
        <div className="grid-2">
          <label className="field"><span>Data</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <div className="field"><span>Ore</span>
            <div className="pick-wrap">
              {['1', '2', '3', '4', '6', '8'].map((h) => <button key={h} type="button" className="pick" aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>)}
              <input className="input" style={{ width: 90, minHeight: 44 }} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Ore" />
            </div>
          </div>
        </div>
        <div className="field"><span>Tipo</span>
          <div className="pick-wrap">{SESSION_TYPES.map((t) => <button key={t} type="button" className="pick" aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>)}</div>
        </div>
        {tracks.length > 0 && (
          <div className="field"><span>Brani lavorati</span>
            <div className="pick-wrap">{tracks.map((t) => (
              <button key={t.id} type="button" className="pick" aria-pressed={trackIds.includes(t.id)}
                onClick={() => setTrackIds((l) => (l.includes(t.id) ? l.filter((x) => x !== t.id) : [...l, t.id]))}>{t.title}</button>
            ))}</div>
          </div>
        )}
        <label className="field"><span>Cosa avete fatto (lo vede l’artista)</span>
          <textarea className="textarea" style={{ minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Registrate le strofe e il ritornello, doppie sul ritornello." />
        </label>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Salva sessione</button>
      </form>
      {sessions.length > 0 && (
        <div className="card list">
          {sessions.map((s) => (
            <div key={s.id} className="card-pad version-row">
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{fmtDay(s.date)} · {s.type} · {s.hours.toLocaleString('it-IT')} h</span>
                {s.description && <span className="small muted">{s.description}</span>}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Eliminare la sessione?')) void deleteSession(artistId, s.id); }}>Elimina</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───────── Task ─────────

function TasksTab({ artistId }: { artistId: string }) {
  const tasks = useTasks(artistId).sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const { tracks } = useTracks(artistId);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<'artist' | 'admin'>('artist');
  const [due, setDue] = useState('');
  const [trackId, setTrackId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try { await createTask(artistId, { title: title.trim(), assignee, dueDate: due, trackId: trackId || null }); setTitle(''); setDue(''); setTrackId(''); }
    catch (err) { setError(errorMessage(err)); }
  };

  return (
    <>
      <form className="card card-pad form" onSubmit={add}>
        <h2 className="h2">Nuovo task</h2>
        <label className="field"><span>Cosa c’è da fare</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mandare il testo definitivo" /></label>
        <div className="grid-2">
          <div className="field"><span>Chi</span>
            <div className="seg" style={{ alignSelf: 'flex-start' }}>
              <button type="button" aria-pressed={assignee === 'artist'} onClick={() => setAssignee('artist')}>Artista</button>
              <button type="button" aria-pressed={assignee === 'admin'} onClick={() => setAssignee('admin')}>Studio (io)</button>
            </div>
          </div>
          <label className="field"><span>Entro il (facoltativo)</span><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
        {tracks.length > 0 && (
          <label className="field"><span>Brano (facoltativo)</span>
            <select className="select" style={{ minHeight: 48 }} value={trackId} onChange={(e) => setTrackId(e.target.value)}>
              <option value="">Nessuno</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
        )}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!title.trim()}>Aggiungi task</button>
      </form>
      {tasks.length > 0 && (
        <div className="card list">
          {tasks.map((t) => (
            <div key={t.id} className="card-pad version-row">
              <label className="check" style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={t.done} onChange={(e) => void setTaskDone(artistId, t.id, e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--faint)' : 'var(--text)' }}>{t.title}</span>
                  <span className="tiny muted">{t.assignee === 'artist' ? 'Artista' : 'Studio'}{t.dueDate ? ` · entro ${fmtDay(t.dueDate)}` : ''}{t.trackId ? ` · ${tracks.find((x) => x.id === t.trackId)?.title ?? ''}` : ''}</span>
                </span>
              </label>
              <button className="btn btn-ghost btn-sm" aria-label="Elimina task" onClick={() => void deleteTask(artistId, t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
