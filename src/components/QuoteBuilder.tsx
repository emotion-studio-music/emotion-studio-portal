import { useState } from 'react';
import { createPayment, createQuote, servicesTitle, todayKey } from '../lib/business';
import { createProject, createTrack, type Track } from '../lib/music';
import { eur, parseEuro } from '../lib/money';
import { errorMessage } from '../lib/errors';
import type { StudioSettings } from '../lib/types';

type PayOpt = 'niente' | 'tutto' | 'acconto' | 'chiedi';
const PAY_OPTS: { value: PayOpt; label: string }[] = [
  { value: 'niente', label: 'Ancora niente' },
  { value: 'acconto', label: 'Acconto 50% pagato oggi' },
  { value: 'tutto', label: 'Pagato tutto oggi' },
  { value: 'chiedi', label: 'Chiedi all’artista' },
];

/** Preventivo a clic: servizi, brani, tariffa, pagamento. Titolo e descrizione si scrivono da soli, ma si possono cambiare. */
export function QuoteBuilder({ artistId, settings, tracks }: { artistId: string; settings: StudioSettings; tracks: Track[] }) {
  const step = settings.priceStep > 0 ? settings.priceStep : 50;
  const [services, setServices] = useState<string[]>([]);
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState<'brano' | 'totale'>('brano');
  const [price, setPriceNum] = useState(step * 2);
  const [priceText, setPriceText] = useState(String(step * 2));
  const setPrice = (v: number | ((p: number) => number)) => {
    const next = typeof v === 'function' ? v(price) : v;
    setPriceNum(next); setPriceText(String(next).replace('.', ','));
  };
  const [pay, setPay] = useState<PayOpt>('niente');
  const [note, setNote] = useState('');
  const [customTitle, setCustomTitle] = useState<string | null>(null); // null = titolo automatico
  const [newTrack, setNewTrack] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const n = Math.max(1, trackIds.length);
  const totalCents = Math.round(price * 100) * (pricing === 'brano' ? n : 1);
  const names = trackIds.map((id) => tracks.find((t) => t.id === id)?.title).filter(Boolean) as string[];
  const autoTitle = services.length
    ? `${servicesTitle(services)}${names.length === 1 ? ` – ${names[0]}` : names.length > 1 ? ` – ${names.length} brani` : ''}`
    : '';
  const title = (customTitle ?? autoTitle).trim();

  const addTrack = async () => {
    if (!newTrack?.trim()) return;
    try {
      const p = await createProject(artistId, { title: newTrack.trim(), type: 'singolo', cover: null, releaseDate: '' });
      const t = await createTrack(artistId, p.id, newTrack.trim(), settings.stepTemplate);
      setTrackIds((l) => [...l, t.id]);
      setNewTrack(null);
    } catch (e) { setMsg({ ok: false, text: errorMessage(e) }); }
  };

  const create = async () => {
    if (!title || totalCents <= 0) return;
    setBusy(true); setMsg(null);
    try {
      const q = await createQuote(artistId, {
        title, amountCents: totalCents, projectId: null, note: note.trim(),
        services, trackIds, pricing, unitCents: pricing === 'brano' ? Math.round(price * 100) : 0,
      });
      const base = { quoteId: q.id, dueDate: '', cardLink: '', note: '' };
      if (pay === 'tutto') await createPayment(artistId, { ...base, kind: 'saldo', amountCents: totalCents, status: 'pagato', paidDate: todayKey() });
      if (pay === 'acconto') await createPayment(artistId, { ...base, kind: 'acconto', amountCents: Math.round(totalCents / 2), status: 'pagato', paidDate: todayKey() });
      if (pay === 'chiedi') await createPayment(artistId, { ...base, kind: 'saldo', amountCents: totalCents, status: 'da_pagare' });
      setMsg({ ok: true, text: `Preventivo creato: ${title} · ${eur(totalCents)}` });
      setServices([]); setTrackIds([]); setPay('niente'); setNote(''); setCustomTitle(null);
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad form">
      <h2 className="h2">Nuovo preventivo</h2>

      <div className="field"><span>1 · Servizi</span>
        <div className="pick-wrap">
          {settings.services.map((x) => <button key={x} type="button" className="pick" aria-pressed={services.includes(x)} onClick={() => setServices((l) => toggle(l, x))}>{x}</button>)}
        </div>
      </div>

      <div className="field"><span>2 · Brani</span>
        <div className="pick-wrap">
          {tracks.map((t) => <button key={t.id} type="button" className="pick" aria-pressed={trackIds.includes(t.id)} onClick={() => setTrackIds((l) => toggle(l, t.id))}>{t.title}</button>)}
          {newTrack === null ? (
            <button type="button" className="pick pick-add" onClick={() => setNewTrack('')}>+ nuovo brano</button>
          ) : (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <input className="input" style={{ minHeight: 44, width: 200 }} autoFocus value={newTrack} placeholder="Titolo" aria-label="Titolo del nuovo brano"
                onChange={(e) => setNewTrack(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addTrack(); } }} />
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => void addTrack()} disabled={!newTrack.trim()}>Crea</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => setNewTrack(null)}>✕</button>
            </span>
          )}
        </div>
      </div>

      <div className="field"><span>3 · Tariffa</span>
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          <button type="button" aria-pressed={pricing === 'brano'} onClick={() => setPricing('brano')}>A brano</button>
          <button type="button" aria-pressed={pricing === 'totale'} onClick={() => setPricing('totale')}>Totale</button>
        </div>
        <div className="pick-wrap" style={{ marginTop: 8 }}>
          {[1, 2, 3, 4, 5, 6].map((k) => <button key={k} type="button" className="pick" aria-pressed={price === step * k} onClick={() => setPrice(step * k)}>{step * k} €</button>)}
        </div>
        <div className="pick-wrap" style={{ marginTop: 8 }}>
          <button type="button" className="pick" onClick={() => setPrice((p) => Math.max(0, p - step))} aria-label={`Meno ${step} euro`}>− {step}</button>
          <input className="input" style={{ width: 110, minHeight: 44, textAlign: 'center' }} inputMode="decimal" aria-label="Importo"
            value={priceText} onChange={(e) => {
              setPriceText(e.target.value);
              const c = parseEuro(e.target.value);
              if (c !== null) setPriceNum(c / 100);
            }} />
          <button type="button" className="pick" onClick={() => setPrice((p) => p + step)} aria-label={`Più ${step} euro`}>+ {step}</button>
        </div>
      </div>

      <div className="field"><span>4 · Pagamento</span>
        <div className="pick-wrap">
          {PAY_OPTS.map((o) => <button key={o.value} type="button" className="pick" aria-pressed={pay === o.value} onClick={() => setPay(o.value)}>{o.label}</button>)}
        </div>
      </div>

      <div className="field"><span>5 · Titolo e descrizione (li vede l’artista)</span>
        <input className="input" value={customTitle ?? autoTitle} onChange={(e) => setCustomTitle(e.target.value)} maxLength={120}
          placeholder="Es. Singolo “Notte” – registrazione, mix e master" aria-label="Titolo del preventivo" />
        {customTitle !== null && autoTitle && customTitle !== autoTitle && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCustomTitle(null)}>Usa il titolo automatico</button>
        )}
        <textarea className="textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
          placeholder="Cosa comprende: 2 giorni di registrazione, mix con 2 revisioni, master per gli store…" aria-label="Descrizione del preventivo" />
      </div>

      <div className="quote-total">
        <span className="small muted">{title || 'Scegli un servizio o scrivi un titolo'}{pricing === 'brano' && trackIds.length > 1 ? ` · ${trackIds.length} × ${eur(price * 100)}` : ''}</span>
        <span className="money-big" style={{ fontSize: 36 }}>{eur(totalCents)}</span>
      </div>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</div>}
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !title || totalCents <= 0} onClick={() => void create()}>
        {busy ? 'Creo…' : 'Crea preventivo'}
      </button>
    </section>
  );
}
