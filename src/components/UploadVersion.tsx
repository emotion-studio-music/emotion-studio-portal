import { useState, type FormEvent } from 'react';
import { addVersion, replaceVersionFile, type Project, type Track, type Version } from '../lib/music';
import { analyzeAudio } from '../lib/audio';
import { ensureVersionsFolder } from '../lib/drive';
import { uploadToDrive } from '../lib/worker';
import { errorMessage } from '../lib/errors';
import type { Artist } from '../lib/types';

type Step = 'idle' | 'analisi' | 'cartelle' | 'upload' | 'salvataggio' | 'fatto';
const STEP_TEXT: Record<Step, string> = {
  idle: '', analisi: 'Calcolo la forma d’onda…', cartelle: 'Preparo le cartelle su Drive…',
  upload: 'Carico su Drive…', salvataggio: 'Salvo la versione…', fatto: 'Fatto: l’artista la trova in “Da ascoltare” e riceve la notifica.',
};

interface UploadVersionProps { artist: Artist; project: Project; track: Track; count: number; current: Version | undefined }

/** Carica la prima versione di un brano, una versione nuova, oppure sostituisce l'MP3 di quella attuale. */
export function UploadVersion({ artist, project, track, count, current }: UploadVersionProps) {
  const suggested = `Mix v${count + 1}`;
  // "sostituisci": stesso nome e stesse note, solo il file nuovo · "nuova": versione in più, confrontabile con A/B
  const [mode, setMode] = useState<'sostituisci' | 'nuova'>('sostituisci');
  const replacing = !!current && mode === 'sostituisci';
  const [oldKept, setOldKept] = useState(false); // il file vecchio non è stato tolto da Drive
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [downloadEnabled, setDownloadEnabled] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== 'idle' && step !== 'fatto';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') { setError('Carica un file MP3.'); return; }
    if (file.size > 200 * 1024 * 1024) { setError('Il file supera 200 MB.'); return; }
    setError(null); setProgress(0); setOldKept(false);
    try {
      setStep('analisi');
      const { peaks, duration } = await analyzeAudio(file);
      setStep('cartelle');
      const folder = await ensureVersionsFolder(artist, project);
      setStep('upload');
      const uploaded = await uploadToDrive(file, folder, setProgress);
      setStep('salvataggio');
      if (replacing) {
        const cleaned = await replaceVersionFile(artist.id, current, { mp3FileId: uploaded.id, fileName: file.name, size: file.size, peaks, duration });
        setOldKept(!cleaned);
      } else {
        await addVersion(artist.id, {
          trackId: track.id, projectId: project.id, label: label.trim() || suggested, mp3FileId: uploaded.id,
          fileName: file.name, size: file.size, peaks, duration, downloadEnabled, notes: notes.trim(),
          collaboratorUids: track.collaboratorUids,
        }, !track.currentVersionId);
      }
      setStep('fatto'); setFile(null); setLabel(''); setNotes('');
    } catch (err) {
      setError(errorMessage(err)); setStep('idle');
    }
  };

  return (
    <form className="form" onSubmit={submit} style={{ gap: 12, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
      <span style={{ fontWeight: 600 }}>{current ? 'Carica la versione aggiornata' : 'Carica la prima versione'}</span>
      {current && (
        <>
          <div className="seg" role="group" aria-label="Come caricarla" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            <button type="button" aria-pressed={mode === 'sostituisci'} onClick={() => setMode('sostituisci')} disabled={busy}>Sostituisci “{current.label}”</button>
            <button type="button" aria-pressed={mode === 'nuova'} onClick={() => setMode('nuova')} disabled={busy}>Aggiungi come {suggested}</button>
          </div>
          <span className="tiny muted">
            {replacing
              ? `Il file di “${current.label}” viene sostituito: stesso nome, le note restano. All’artista arriva la notifica. Il file vecchio va nel Cestino di Drive (si svuota da solo dopo 30 giorni).`
              : 'Resta anche la versione precedente: l’artista può confrontarle con A/B.'}
          </span>
        </>
      )}
      <input className="input" type="file" accept=".mp3,audio/mpeg" disabled={busy}
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStep('idle'); }} aria-label="File MP3" />
      {!replacing && <div className="grid-2">
        <label className="field"><span>Nome versione</span>
          <input className="input" value={label} placeholder={suggested} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
        </label>
        <label className="check" style={{ alignSelf: 'end', minHeight: 48, alignItems: 'center' }}>
          <input type="checkbox" checked={downloadEnabled} onChange={(e) => setDownloadEnabled(e.target.checked)} disabled={busy} />
          <span className="small">Permetti all’artista di scaricare l’MP3</span>
        </label>
      </div>}
      {!replacing && <label className="field"><span>Note per l’artista</span>
        <textarea className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy}
          placeholder="Voce alzata nel ritornello, basso più pulito." />
      </label>}
      {step !== 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
          <span className="small">{STEP_TEXT[step]}{step === 'upload' ? ` ${Math.round(progress * 100)}%` : ''}</span>
          {busy && <div className="progress"><div style={{ width: `${step === 'upload' ? progress * 100 : step === 'salvataggio' ? 100 : 8}%` }} /></div>}
        </div>
      )}
      {oldKept && <div className="alert alert-error" role="alert">Versione sostituita, ma il file vecchio è rimasto su Drive: puoi eliminarlo a mano dalla cartella del progetto.</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!file || busy}>{replacing ? 'Sostituisci il file' : 'Carica versione'}</button>
    </form>
  );
}
