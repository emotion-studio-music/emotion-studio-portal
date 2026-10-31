import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useArtist, useSettings } from '../../lib/data';
import { useTracks } from '../../lib/music';
import { PAYMENT_KIND, PAY_METHODS, fmtDay, quoteSummary, reportPaid, todayKey, usePayments, useQuotes, type Payment, type Quote } from '../../lib/business';
import { eur, paypalLink } from '../../lib/money';
import { errorMessage } from '../../lib/errors';

export function Payments() {
  const { artistId } = useAuth();
  const { artist } = useArtist(artistId);
  const { settings } = useSettings();
  const quotes = useQuotes(artistId);
  const payments = usePayments(artistId);
  const { tracks } = useTracks(artistId);
  const trackName = (id: string) => tracks.find((t) => t.id === id)?.title;

  const open = payments.filter((p) => p.status !== 'pagato').sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const totalLeft = quotes.reduce((s, q) => s + quoteSummary(q, payments).left, 0);
  const quoteOf = (p: Payment) => quotes.find((q) => q.id === p.quoteId);

  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <h1 className="display" style={{ fontSize: 44 }}>Pagamenti</h1>

        <div className="card card-pad money-hero">
          <span className="small muted">Da saldare in totale</span>
          <span className="money-big">{eur(totalLeft)}</span>
          {quotes.length === 0 && <span className="small muted">Qui troverai i preventivi dei tuoi progetti.</span>}
        </div>

        {open.length > 0 && (
          <section className="section">
            <h2 className="h2">Da pagare ora</h2>
            {open.map((p) => (
              <PayCard key={p.id} p={p} quote={quoteOf(p)} artistName={artist?.stageName ?? ''} settings={settings} artistId={artistId!} />
            ))}
          </section>
        )}

        {quotes.length > 0 && (
          <section className="section">
            <h2 className="h2">I tuoi preventivi</h2>
            {quotes.sort((a, b) => b.createdMs - a.createdMs).map((q) => {
              const s = quoteSummary(q, payments);
              const pct = q.amountCents ? Math.round((s.paid / q.amountCents) * 100) : 0;
              return (
                <div key={q.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="section-head">
                    <span style={{ fontWeight: 600 }}>{q.title}</span>
                    <span style={{ fontWeight: 700 }}>{eur(q.amountCents)}</span>
                  </div>
                  <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  <span className="small muted">Pagato {eur(s.paid)} · {s.left > 0 ? `mancano ${eur(s.left)}` : 'saldato ✓'}</span>
                  {q.trackIds.length > 0 && (
                    <div className="quote-lines">
                      {q.trackIds.map((id) => (
                        <span key={id} className="small"><span>{trackName(id) ?? 'Brano'}</span>{q.pricing === 'brano' && <span className="muted">{eur(q.unitCents)}</span>}</span>
                      ))}
                    </div>
                  )}
                  {q.note && <span className="small muted" style={{ whiteSpace: 'pre-line' }}>{q.note}</span>}
                  {s.payments.filter((p) => p.status === 'pagato').map((p) => (
                    <span key={p.id} className="tiny muted">✓ {PAYMENT_KIND[p.kind]} {eur(p.amountCents)}{p.paidDate ? ` · ${fmtDay(p.paidDate)}` : ''}{p.invoiceNumber ? ` · fattura ${p.invoiceNumber}` : ''}</span>
                  ))}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

interface PayProps { p: Payment; quote?: Quote; artistName: string; artistId: string; settings: ReturnType<typeof useSettings>['settings'] }

function PayCard({ p, quote, artistName, artistId, settings }: PayProps) {
  const [method, setMethod] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const causale = `Emotion Studio – ${artistName} – ${quote?.title ?? ''} – ${PAYMENT_KIND[p.kind]}`.replace(/ – $/, '');
  const pp = paypalLink(settings.paypal, p.amountCents);
  const late = p.dueDate && p.dueDate < todayKey();
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); }
  };

  return (
    <div className="card card-pad card-glow" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="section-head">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600 }}>{PAYMENT_KIND[p.kind]} · {quote?.title}</span>
          {p.dueDate && <span className="tiny" style={{ color: late ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>{late ? 'Scaduto il' : 'Entro il'} {fmtDay(p.dueDate)}</span>}
        </span>
        <span className="money-mid">{eur(p.amountCents)}</span>
      </div>
      {p.note && <span className="small muted">{p.note}</span>}

      {p.status === 'segnalato' ? (
        <div className="alert alert-ok">Hai segnalato il pagamento ({p.reportedMethod}). Lo studio lo conferma appena lo riceve.</div>
      ) : (
        <>
          <div className="row-actions">
            {p.cardLink && <a className="btn btn-primary btn-sm" href={p.cardLink} target="_blank" rel="noreferrer">Paga con carta</a>}
            {pp && <a className="btn btn-sm" href={pp} target="_blank" rel="noreferrer">Paga con PayPal</a>}
            {settings.iban && <button className="btn btn-sm" onClick={() => void copy('iban', settings.iban.replace(/\s/g, ''))}>{copied === 'iban' ? 'IBAN copiato ✓' : 'Copia IBAN'}</button>}
            {settings.iban && <button className="btn btn-sm" onClick={() => void copy('causale', causale)}>{copied === 'causale' ? 'Causale copiata ✓' : 'Copia causale'}</button>}
          </div>
          <div className="small muted" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {settings.iban && <span>Bonifico a {settings.ibanHolder || 'Emotion Studio'} · <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{settings.iban}</span></span>}
            {settings.iban && <span>Causale: {causale}</span>}
            {!pp && settings.paypal && <span>PayPal: {settings.paypal}</span>}
            {settings.satispay && <span>Satispay: {settings.satispay}</span>}
            {settings.paymentNote && <span style={{ whiteSpace: 'pre-line' }}>{settings.paymentNote}</span>}
          </div>
          {method === null ? (
            <button className="btn btn-block" onClick={() => setMethod('')}>Ho pagato</button>
          ) : (
            <div className="inset">
              <span className="small" style={{ fontWeight: 600 }}>Come hai pagato?</span>
              <div className="pick-wrap">
                {PAY_METHODS.map((m) => (
                  <button key={m} type="button" className="pick" aria-pressed={method === m} onClick={() => setMethod(m)}>{m}</button>
                ))}
              </div>
              <div className="row-actions">
                <button className="btn btn-primary btn-sm" disabled={!method} onClick={() => void reportPaid(artistId, p.id, method).catch((e) => setError(errorMessage(e)))}>Conferma</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMethod(null)}>Annulla</button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
  );
}
