import { useSettings } from '../../lib/data';

export function Payments() {
  const { settings } = useSettings();
  const hasAny = settings.iban || settings.paypal || settings.satispay;
  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <h1 className="display" style={{ fontSize: 44 }}>Pagamenti</h1>
        <div className="empty">
          <strong>Nessun importo da saldare</strong>
          Preventivi, acconti e saldi dei tuoi progetti compariranno qui.
        </div>
        {hasAny && (
          <section className="card list">
            <div className="card-pad"><h2 className="h2">Come pagare</h2></div>
            {settings.iban && (
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="tiny muted">Bonifico{settings.ibanHolder ? ` intestato a ${settings.ibanHolder}` : ''}</span>
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', overflowWrap: 'anywhere' }}>{settings.iban}</span>
                <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => void navigator.clipboard?.writeText(settings.iban.replace(/\s/g, ''))}>Copia IBAN</button>
              </div>
            )}
            {settings.paypal && (
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="tiny muted">PayPal</span><span style={{ overflowWrap: 'anywhere' }}>{settings.paypal}</span>
              </div>
            )}
            {settings.satispay && (
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="tiny muted">Satispay</span><span>{settings.satispay}</span>
              </div>
            )}
            {settings.paymentNote && (
              <div className="card-pad small muted" style={{ whiteSpace: 'pre-line' }}>{settings.paymentNote}</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
