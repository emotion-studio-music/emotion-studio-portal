import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { artistStatusLabel, createDemo, useDemos } from '../../lib/demos';
import { analyzeAudio, formatTime, readDuration } from '../../lib/audio';
import { extFor, useRecorder } from '../../lib/recorder';
import { uploadDemo, workerConfigured } from '../../lib/worker';
import { errorMessage } from '../../lib/errors';

type Step = 'idle' | 'analisi' | 'upload' | 'salvataggio' | 'fatto';
const MAX = 100 * 1024 * 1024;

export function Upload() {
  const { artistId, user } = useAuth();
  const { demos } = useDemos(artistId);
  const rec = useRecorder();
  const [mode, setMode] = useState<'file' | 'registra'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== 'idle' && step !== 'fatto';

  const blob: Blob | null = mode === 'file' ? file : rec.blob;
  const previewUrl = useMemo(() => (rec.blob ? URL.createObjectURL(rec.blob) : null), [rec.blob]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pickFile = (f: File | undefined) => {
    setError(null); setStep('idle');
    if (!f) { setFile(null); return; }
    if (/\.(amr|3gp|3gpp)$/i.test(f.name)) { setError('Questo formato (.amr / .3gp) non si può ascoltare nel browser. Esporta o registra in M4A o MP3.'); return; }
    if (f.size > MAX) { setError('Il file supera i 100 MB.'); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!blob || !artistId || !user) return;
    setError(null); setProgress(0);
    try {
      setStep('analisi');
      let peaks: number[] = [];
      let duration = 0;
      if (blob.size < 40 * 1024 * 1024) {
        try { ({ peaks, duration } = await analyzeAudio(blob)); } catch { duration = await readDuration(blob); }
      } else {
        duration = await readDuration(blob);
      }
      const name = mode === 'file' && file ? file.name : `${(title || 'Registrazione').replace(/[^\w\- àèéìòù]/gi, '').slice(0, 60)}.${extFor(blob.type)}`;
      setStep('upload');
      const up = await uploadDemo(blob, name, artistId, setProgress);
      setStep('salvataggio');
      await createDemo(artistId, {
        title: title.trim() || 'Demo senza titolo', note: note.trim(), fileId: up.id, fileName: name,
        mimeType: blob.type || 'audio/mp4', size: blob.size, peaks, duration,
        source: mode === 'file' ? 'file' : 'registrazione', uploadedBy: user.uid,
      });
      setStep('fatto');
      setFile(null); setTitle(''); setNote(''); rec.reset();
    } catch (err) {
      setError(errorMessage(err)); setStep('idle');
    }
  };

  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <div>
          <h1 className="display" style={{ fontSize: 44 }}>Demo</h1>
          <p className="small muted" style={{ margin: '8px 0 0' }}>Manda allo studio le tue idee: un memo vocale, un provino o una registrazione fatta adesso.</p>
        </div>

        {!workerConfigured && <div className="alert alert-error">Il caricamento non è ancora attivo. Scrivi allo studio.</div>}

        <form className="card card-pad form" onSubmit={submit}>
          <div className="seg" role="group" aria-label="Come vuoi mandare la demo" style={{ alignSelf: 'flex-start' }}>
            <button type="button" aria-pressed={mode === 'file'} onClick={() => setMode('file')} disabled={busy}>Carica un file</button>
            <button type="button" aria-pressed={mode === 'registra'} onClick={() => setMode('registra')} disabled={busy}>Registra adesso</button>
          </div>

          {mode === 'file' ? (
            <label className="drop">
              <input type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.aif,.aiff,.ogg,.webm" onChange={(e) => pickFile(e.target.files?.[0])} disabled={busy} />
              <strong>{file ? file.name : 'Scegli un file audio'}</strong>
              <span className="small muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Memo vocale, M4A, MP3, WAV · fino a 100 MB'}</span>
            </label>
          ) : (
            <div className="recorder">
              {rec.state !== 'done' ? (
                <>
                  <button type="button" className={`rec-btn${rec.state === 'recording' ? ' on' : ''}`}
                    onClick={() => (rec.state === 'recording' ? rec.stop() : void rec.start())}
                    aria-label={rec.state === 'recording' ? 'Ferma la registrazione' : 'Inizia a registrare'}>
                    <span />
                  </button>
                  <span className="rec-time">{formatTime(rec.seconds)}</span>
                  <div className="rec-level" aria-hidden="true"><div style={{ width: `${Math.min(100, rec.level * 140)}%` }} /></div>
                  <span className="small muted">{rec.state === 'recording' ? 'Sto registrando… tocca per fermare' : 'Tocca il pulsante rosso per iniziare (max 10 minuti)'}</span>
                </>
              ) : (
                <>
                  {previewUrl && <audio controls src={previewUrl} style={{ width: '100%' }} />}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={rec.reset} disabled={busy}>Rifai la registrazione</button>
                </>
              )}
              {rec.error && <div className="alert alert-error" role="alert">{rec.error}</div>}
            </div>
          )}

          <label className="field"><span>Titolo</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Idea ritornello" disabled={busy} />
          </label>
          <label className="field"><span>Nota per lo studio (facoltativa)</span>
            <textarea className="textarea" style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
              placeholder="Il beat è preso da YouTube, la strofa è da sistemare…" disabled={busy} />
          </label>

          {step !== 'idle' && (
            <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="small">
                {step === 'analisi' && 'Preparo la demo…'}
                {step === 'upload' && `Invio allo studio… ${Math.round(progress * 100)}%`}
                {step === 'salvataggio' && 'Quasi fatto…'}
                {step === 'fatto' && 'Demo inviata! Lo studio la ascolterà presto.'}
              </span>
              {busy && <div className="progress"><div style={{ width: `${step === 'upload' ? progress * 100 : step === 'salvataggio' ? 100 : 6}%` }} /></div>}
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn btn-primary" disabled={!blob || busy || !workerConfigured}>Invia allo studio</button>
        </form>

        <section className="section">
          <h2 className="h2">Le mie demo</h2>
          {demos.length === 0 ? (
            <div className="empty">Non hai ancora mandato demo.</div>
          ) : (
            <div className="card list">
              {demos.map((d) => (
                <Link key={d.id} to={`/demo/${d.id}`} className="demo-row">
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{d.title}</span>
                    <span className="tiny muted">{new Date(d.createdMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {formatTime(d.duration)}{d.source === 'registrazione' ? ' · registrata in app' : ''}</span>
                  </span>
                  <span className={`badge${d.status === 'selezionata' ? ' badge-star' : ''}`}>{artistStatusLabel(d.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
