import { useRef } from 'react';
import { focusStyle, type PhotoFocus } from '../lib/types';

/** Tocca il viso nella foto: l'app lo terrà inquadrato ovunque. Lo zoom avvicina. */
export function FocusPicker({ src, value, onChange }: { src: string; value: PhotoFocus; onChange: (f: PhotoFocus) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    onChange({ ...value, x, y });
  };
  return (
    <div className="focus-picker">
      <div className="focus-source" ref={box} onPointerDown={pick} role="button" tabIndex={0} aria-label="Tocca il punto da tenere inquadrato">
        <img src={src} alt="" draggable={false} />
        <span className="focus-dot" style={{ left: `${value.x}%`, top: `${value.y}%` }} />
      </div>
      <div className="focus-previews">
        <span className="tiny muted">Anteprime</span>
        <div className="focus-prev tall"><img src={src} alt="" style={focusStyle(value)} /></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="focus-prev square"><img src={src} alt="" style={focusStyle(value)} /></div>
          <div className="focus-prev round"><img src={src} alt="" style={focusStyle(value)} /></div>
        </div>
        <label className="field" style={{ gap: 4 }}><span>Zoom</span>
          <input type="range" min={1} max={2.5} step={0.05} value={value.zoom} onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })} />
        </label>
      </div>
    </div>
  );
}
