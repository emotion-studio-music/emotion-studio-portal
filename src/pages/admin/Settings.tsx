import { useEffect, useState, type FormEvent } from 'react';
import { saveSettings, useSettings } from '../../lib/data';
import { emptySettings, type StudioSettings } from '../../lib/types';
import { errorMessage } from '../../lib/errors';
import { Loading } from '../../components/Loading';

export function Settings() {
  const { settings, loading } = useSettings();
  const [form, setForm] = useState<StudioSettings>(emptySettings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (!loading) setForm(settings); }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading />;
  const set = (k: keyof StudioSettings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await saveSettings({ ...form, stepTemplate: form.stepTemplate.map((x) => x.trim()).filter(Boolean) }); setMsg({ ok: true, text: 'Impostazioni salvate.' }); }
    catch (err) { setMsg({ ok: false, text: errorMessage(err) }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head"><h1 className="display page-title">Impostazioni studio</h1></div>
      <form className="form" onSubmit={submit} style={{ gap: 24, maxWidth: 720 }}>
        <section className="card card-pad form">
          <h2 className="h2">Istruzioni di pagamento</h2>
          <p className="small muted" style={{ margin: 0 }}>Gli artisti le vedono nella sezione Pagamenti. Lascia vuoto ciò che non usi.</p>
          <div className="grid-2">
            <label className="field"><span>IBAN</span><input className="input" value={form.iban} onChange={(e) => set('iban', e.target.value)} /></label>
            <label className="field"><span>Intestatario</span><input className="input" value={form.ibanHolder} onChange={(e) => set('ibanHolder', e.target.value)} /></label>
            <label className="field"><span>PayPal (email o link)</span><input className="input" value={form.paypal} onChange={(e) => set('paypal', e.target.value)} /></label>
            <label className="field"><span>Satispay (nome o numero)</span><input className="input" value={form.satispay} onChange={(e) => set('satispay', e.target.value)} /></label>
          </div>
          <label className="field"><span>Nota sotto i metodi di pagamento</span>
            <textarea className="textarea" value={form.paymentNote} onChange={(e) => set('paymentNote', e.target.value)} placeholder="Nella causale indica il tuo nome d’arte e il progetto." />
          </label>
        </section>
        <section className="card card-pad form">
          <h2 className="h2">Messaggio nella home degli artisti</h2>
          <label className="field"><span>Testo breve (facoltativo)</span>
            <textarea className="textarea" value={form.welcomeText} onChange={(e) => set('welcomeText', e.target.value)} placeholder="Studio chiuso dal 24 al 27 dicembre." />
          </label>
        </section>
        <section className="card card-pad form">
          <h2 className="h2">Percorso dei brani</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Gli step di produzione che ogni nuovo brano riceve in automatico. Uno per riga, nell’ordine giusto.
            Su ogni brano puoi poi togliere o aggiungere step. L’artista vede solo la barra di avanzamento.
          </p>
          <label className="field"><span>Step predefiniti</span>
            <textarea className="textarea" style={{ minHeight: 230 }} value={form.stepTemplate.join('\n')}
              onChange={(e) => setForm((f) => ({ ...f, stepTemplate: e.target.value.split('\n') }))} />
          </label>
        </section>
        {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</div>}
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy}>{busy ? 'Salvataggio…' : 'Salva impostazioni'}</button>
      </form>
    </>
  );
}
