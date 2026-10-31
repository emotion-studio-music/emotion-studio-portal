/**
 * Calcola la forma d'onda di un file audio nel browser, una volta sola al caricamento.
 * Così gli artisti la vedono subito e l'audio parte in streaming senza scaricare tutto.
 */
export async function analyzeAudio(file: File, buckets = 1000): Promise<{ peaks: number[]; duration: number }> {
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
