import { STAGES } from '../lib/stages';

/** Barra a 7 segmenti: ogni fase completata prende il suo colore, dal grigio all'ambra. */
export function StageBar({ stage }: { stage: number }) {
  return (
    <div className="stagebar" role="img" aria-label={`Fase: ${STAGES[stage]?.label ?? ''}`}>
      {STAGES.map((s, i) => (
        <span key={s.key} style={i <= stage ? { background: STAGES[i].color } : undefined} />
      ))}
    </div>
  );
}

export function StageLabel({ stage }: { stage: number }) {
  const s = STAGES[stage];
  return (
    <span className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#C9C9CE' }}>
      <span className="dot" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
      {s.label}
    </span>
  );
}
