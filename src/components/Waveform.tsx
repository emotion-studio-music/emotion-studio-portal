import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { Loop } from '../lib/player';
import { t } from '../lib/i18n';

export interface Marker { id: string; at: number; resolved: boolean; title: string }

interface Props {
  versionKey: string; // cambia solo quando cambia versione: evita di ridisegnare a vuoto
  media: HTMLAudioElement;
  peaks: number[];
  duration: number;
  color: string;
  markers: Marker[];
  loop: Loop | null;
  selectingLoop: boolean;
  onLoop: (loop: Loop) => void;
  onMarker: (id: string, at: number) => void;
  onSeek?: (t: number) => void;
}

/** Forma d'onda collegata al lettore globale, con segnaposto dei commenti e sezione in loop. */
export function Waveform(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const cb = useRef(p);
  cb.current = p;

  useEffect(() => {
    if (!box.current) return;
    const rp = RegionsPlugin.create();
    const w = WaveSurfer.create({
      container: box.current,
      media: p.media,
      peaks: p.peaks.length ? [p.peaks] : undefined,
      duration: p.duration || undefined,
      height: 96,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      cursorWidth: 2,
      cursorColor: '#F4F4F1',
      waveColor: `${p.color}55`,
      progressColor: p.color,
      normalize: false,
      plugins: [rp],
    });
    ws.current = w;
    regions.current = rp;
    w.on('interaction', (t) => cb.current.onSeek?.(t));
    rp.on('region-clicked', (r: Region, e: MouseEvent) => {
      if (r.id.startsWith('c-')) {
        e.stopPropagation();
        cb.current.onMarker(r.id.slice(2), r.start);
      }
    });
    rp.on('region-created', (r: Region) => {
      if (r.id.startsWith('c-') || r.id === 'loop') return;
      // nuova sezione disegnata trascinando: diventa il loop
      const loop = { start: r.start, end: r.end };
      r.remove();
      if (loop.end - loop.start >= 0.5) cb.current.onLoop(loop);
    });
    rp.on('region-updated', (r: Region) => {
      if (r.id === 'loop') cb.current.onLoop({ start: r.start, end: r.end });
    });
    return () => { w.destroy(); ws.current = null; regions.current = null; };
  }, [p.media, p.versionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Colore: segue l'avanzamento del brano
  useEffect(() => {
    ws.current?.setOptions({ waveColor: `${p.color}55`, progressColor: p.color });
  }, [p.color]);

  // Segnaposto dei commenti e loop
  useEffect(() => {
    const rp = regions.current;
    if (!rp) return;
    const draw = () => {
      rp.getRegions().forEach((r) => { if (r.id.startsWith('c-') || r.id === 'loop') r.remove(); });
      if (p.loop) {
        rp.addRegion({ id: 'loop', start: p.loop.start, end: p.loop.end, color: 'rgba(255,181,71,0.16)', drag: true, resize: true });
      }
      p.markers.forEach((m) => {
        // la forma d'onda vive in uno "shadow DOM": lo stile va messo direttamente sull'elemento
        const dot = document.createElement('span');
        dot.title = m.title;
        Object.assign(dot.style, {
          position: 'absolute', top: '-2px', left: '-8px', width: '16px', height: '16px', borderRadius: '8px',
          background: '#0A0A0B', border: `2px solid ${m.resolved ? '#3A3A40' : '#FFB547'}`, boxSizing: 'border-box',
          boxShadow: m.resolved ? 'none' : '0 0 10px rgba(255,181,71,.6)', cursor: 'pointer', zIndex: '6',
        });
        rp.addRegion({ id: `c-${m.id}`, start: m.at, content: dot, color: 'transparent', drag: false, resize: false });
      });
    };
    // aspetta che la forma d'onda sia disegnata
    if (ws.current?.getDuration()) draw();
    const off = ws.current?.on('ready', draw);
    return () => { off?.(); };
  }, [p.markers, p.loop, p.media, p.versionKey]);

  // Modalità "disegna il loop"
  useEffect(() => {
    const rp = regions.current;
    if (!rp || !p.selectingLoop) return;
    return rp.enableDragSelection({ color: 'rgba(255,181,71,0.22)' });
  }, [p.selectingLoop, p.media, p.versionKey]);

  return <div className={`player-wave${p.selectingLoop ? ' selecting' : ''}`} ref={box} aria-label={t('Forma d’onda: tocca per spostarti nel brano')} />;
}
