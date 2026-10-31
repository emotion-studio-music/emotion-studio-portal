/**
 * Calcola la forma d'onda di un file audio nel browser, una volta sola al caricamento.
 * Così gli artisti la vedono subito e l'audio parte in streaming senza scaricare tutto.
 */
export async function analyzeAudio(file: Blob, buckets = 1000): Promise<{ peaks: number[]; duration: number }> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const len = buffer.length;
    const step = Math.max(1, Math.floor(len / buckets));
    const raw: number[] = [];
    for (let b = 0; b < buckets; b++) {
      const start = b * step;
      const end = Math.min(len, start + step);
      let max = 0;
      for (let i = start; i < end; i += 4) {
        for (const ch of channels) {
          const v = Math.abs(ch[i]);
          if (v > max) max = v;
        }
      }
      raw.push(max);
    }
    const top = Math.max(...raw, 0.0001);
    return { peaks: raw.map((v) => Math.round((v / top) * 1000) / 1000), duration: Math.round(buffer.duration * 100) / 100 };
  } catch {
    throw new Error('Non riesco a leggere questo file audio. Usa un MP3.');
  } finally {
    void ctx.close();
  }
}

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Durata letta dal browser, quando la forma d'onda non si può calcolare (file molto grandi). */
export function readDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    const done = (d: number) => { URL.revokeObjectURL(url); resolve(isFinite(d) ? Math.round(d * 100) / 100 : 0); };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.src = url;
    setTimeout(() => done(a.duration || 0), 8000);
  });
}
