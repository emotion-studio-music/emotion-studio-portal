import { useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 10 * 60;

function pickMime(): string {
  const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined') return '';
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

export function extFor(mime: string) {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  return 'audio';
}

/** Registrazione dal microfono del telefono o del computer. */
export function useRecorder() {
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number>(0);
  const raf = useRef<number>(0);
  const ctx = useRef<AudioContext | null>(null);

  const cleanup = () => {
    window.clearInterval(timer.current);
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close();
    ctx.current = null;
    setLevel(0);
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    setError(null); setBlob(null); setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Questo browser non può registrare. Usa Safari su iPhone o Chrome su Android, oppure carica un file.');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        setBlob(new Blob(chunks, { type: r.mimeType || mime || 'audio/mp4' }));
        setState('done');
        cleanup();
      };
      rec.current = r;
      r.start(1000);
      setState('recording');
      const t0 = Date.now();
      timer.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        setSeconds(sec);
        if (sec >= MAX_SECONDS) r.stop();
      }, 250);
      // indicatore di livello del microfono
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const c = new Ctx();
      ctx.current = c;
      void c.resume().catch(() => undefined);
      const an = c.createAnalyser();
      an.fftSize = 512;
      c.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        raf.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      cleanup();
      setError('Non ho accesso al microfono. Controlla i permessi del browser e riprova.');
      setState('idle');
    }
  };

  const stop = () => rec.current?.state === 'recording' && rec.current.stop();
  const reset = () => { setBlob(null); setSeconds(0); setState('idle'); };

  return { state, seconds, level, blob, error, start, stop, reset, maxSeconds: MAX_SECONDS };
}
