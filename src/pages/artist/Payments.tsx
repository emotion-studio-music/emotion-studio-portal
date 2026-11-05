import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useArtist, useSettings } from '../../lib/data';
import { useTracks } from '../../lib/music';
import { PAYMENT_KIND, PAY_METHODS, fmtDay, quoteSummary, reportPaid, todayKey, usePayments, useQuotes, type Payment, type Quote } from '../../lib/business';
import { eur, paypalLink } from '../../lib/money';
import { errorMessage } from '../../lib/errors';
import { getLang, t } from '../../lib/i18n';

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
        <h1 className="display" style={{ fontSize: 44 }}>{t('Pagamenti')}</h1>

        <div className="card card-pad money-hero">
          <span className="small muted">{t('Da saldare in totale')}</span>
          <span className="money-big">{eur(totalLeft)}</span>
          {quotes.length === 0 && <span className="small muted">{t('Qui troverai i preventivi dei tuoi progetti.')}</span>}
        </div>

        {open.length > 0 && (
          <section className="section">
            <h2 className="h2">{t('Da pagare ora')}</h2>
            {open.map((p) => (
              <PayCard key={p.id} p={p} quote={quoteOf(p)} artistName={artist?.stageName ?? ''} settings={settings} artistId={artistId!} />
            ))}
          </section>
        )}

        {quotes.length > 0 && (
          <section className="section">
            <h2 className="h2">{t('I tuoi preventivi')}</h2>
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
                  <span className="small muted">{t('Pagato {importo}', { importo: eur(s.paid) })} · {s.left > 0 ? t('mancano {importo}', { importo: eur(s.left) }) : t('saldato ✓')}</span>
                  {q.trackIds.length > 0 && (
                    <div className="quote-lines">
                      {q.trackIds.map((id) => (
                        <span key={id} className="small"><span>{trackName(id) ?? t('Brano')}</span>{q.pricing === 'brano' && <span className="muted">{eur(q.unitCents)}</span>}</span>
                      ))}
                    </div>
                  )}
                  {q.note && <span className="small muted" style={{ whiteSpace: 'pre-line' }}>{q.note}</span>}
                  {s.payments.filter((p) => p.status === 'pagato').map((p) => (
                    <span key={p.id} className="tiny muted">✓ {t(PAYMENT_KIND[p.kind])} {eur(p.amountCents)}{p.paidDate ? ` · ${fmtDay(p.paidDate)}` : ''}{p.invoiceNumber ? ` · ${t('fattura {numero}', { numero: p.invoiceNumber })}` : ''}</span>
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

const ICONS: Record<string, JSX.Element> = {
  Bonifico: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" /></svg>,
  PayPal: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12.5h2" /><path d="M3 9.5h18" /></svg>,
  Carta: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /><path d="M6 15h4" /></svg>,
  Satispay: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></svg>,
};

interface PayProps { p: Payment; quote?: Quote; artistName: string; artistId: string; settings: ReturnType<typeof useSettings>['settings'] }

function PayCard({ p, quote, artistName, artistId, settings }: PayProps) {
  const pp = paypalLink(settings.paypal, p.amountCents);
  const methods = [
    settings.iban ? 'Bonifico' : null,
    settings.paypal ? 'PayPal' : null,
    p.cardLink ? 'Carta' : null,
    settings.satispay ? 'Satispay' : null,
  ].filter(Boolean) as string[];
  const [chosen, setChosen] = useState<string | null>(methods.length === 1 ? methods[0] : null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const causale = `Emotion Studio – ${artistName} – ${quote?.title ?? ''} – ${PAYMENT_KIND[p.kind]}`.replace(/ – $/, '');
  const late = p.dueDate && p.dueDate < todayKey();
  const payNote = (getLang() === 'en' && settings.paymentNoteEn.trim()) || settings.paymentNote;
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); } catch { setCopied(null); }
  };

  return (
    <div className="card card-pad card-glow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-head">
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600 }}>{t(PAYMENT_KIND[p.kind])} · {quote?.title}</span>
          {p.dueDate && <span className="tiny" style={{ color: late ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>{late ? t('Scaduto il {data}', { data: fmtDay(p.dueDate) }) : t('Entro il {data}', { data: fmtDay(p.dueDate) })}</span>}
        </span>
        <span className="money-mid">{eur(p.amountCents)}</span>
      </div>
      {p.note && <span className="small muted">{p.note}</span>}

      {p.status === 'segnalato' ? (
        <div className="alert alert-ok">{t('Hai segnalato il pagamento ({metodo}). Lo studio lo conferma appena lo riceve.', { metodo: t(p.reportedMethod ?? '') })}</div>
      ) : (
        <>
          <div className="field" style={{ gap: 10 }}>
            <span>{t('Come vuoi pagare?')}</span>
            <div className="pay-methods" role="group" aria-label={t('Metodo di pagamento')}>
              {methods.map((m) => (
                <button key={m} type="button" className="pay-method" aria-pressed={chosen === m} onClick={() => setChosen(m)}>
                  {ICONS[m]}<span>{t(m)}</span>
                </button>
              ))}
            </div>
          </div>

          {chosen === 'Bonifico' && (
            <div className="inset">
              <span className="tiny muted">{t('Intestato a')}</span>
              <span style={{ fontWeight: 600 }}>{settings.ibanHolder || 'Emotion Studio'}</span>
              <span className="tiny muted">IBAN</span>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', overflowWrap: 'anywhere' }}>{settings.iban}</span>
              <span className="tiny muted">{t('Causale')}</span>
              <span>{causale}</span>
              <div className="row-actions">
                <button className="btn btn-sm" onClick={() => void copy('iban', settings.iban.replace(/\s/g, ''))}>{copied === 'iban' ? t('IBAN copiato ✓') : t('Copia IBAN')}</button>
                <button className="btn btn-sm" onClick={() => void copy('causale', causale)}>{copied === 'causale' ? t('Causale copiata ✓') : t('Copia causale')}</button>
              </div>
            </div>
          )}
          {chosen === 'PayPal' && (
            <div className="inset">
              {pp ? (
                <>
                  <a className="btn btn-primary btn-block" href={pp} target="_blank" rel="noreferrer">{t('Paga {importo} con PayPal', { importo: eur(p.amountCents) })}</a>
                  <span className="tiny muted">{t('Si apre PayPal con l’importo già inserito. Puoi usare il saldo PayPal o una carta collegata.')}</span>
                </>
              ) : (
                <>
                  <span className="tiny muted">{t('Invia {importo} a', { importo: eur(p.amountCents) })}</span>
                  <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{settings.paypal}</span>
                  <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void copy('pp', settings.paypal)}>{copied === 'pp' ? t('Copiato ✓') : t('Copia indirizzo PayPal')}</button>
                </>
              )}
            </div>
          )}
          {chosen === 'Carta' && p.cardLink && (
            <div className="inset">
              <a className="btn btn-primary btn-block" href={p.cardLink} target="_blank" rel="noreferrer">{t('Paga {importo} con carta', { importo: eur(p.amountCents) })}</a>
              <span className="tiny muted">{t('Si apre la pagina di pagamento sicura del circuito dello studio.')}</span>
            </div>
          )}
          {chosen === 'Satispay' && (
            <div className="inset">
              <span className="tiny muted">{t('Invia {importo} con Satispay a', { importo: eur(p.amountCents) })}</span>
              <span style={{ fontWeight: 600 }}>{settings.satispay}</span>
              <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => void copy('sp', settings.satispay)}>{copied === 'sp' ? t('Copiato ✓') : t('Copia')}</button>
            </div>
          )}
          {payNote && <span className="small muted" style={{ whiteSpace: 'pre-line' }}>{payNote}</span>}

          {!confirming ? (
            <button className="btn btn-block" onClick={() => setConfirming(true)}>{t('Ho pagato')}</button>
          ) : (
            <div className="inset">
              <span className="small" style={{ fontWeight: 600 }}>{t('Come hai pagato?')}</span>
              <div className="pick-wrap" role="group" aria-label={t('Come hai pagato?')}>
                {PAY_METHODS.map((m) => (
                  <button key={m} type="button" className="pick" aria-pressed={(chosen ?? '') === m} onClick={() => setChosen(m)}>{t(m)}</button>
                ))}
              </div>
              <div className="row-actions">
                <button className="btn btn-primary btn-sm" disabled={!chosen} onClick={() => void reportPaid(artistId, p.id, chosen!).catch((e) => setError(errorMessage(e)))}>{t('Conferma')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>{t('Annulla')}</button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
  );
}
