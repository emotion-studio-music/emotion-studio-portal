import { useState, type FormEvent } from 'react';
import { newStepId, type Step } from '../lib/steps';

/** Lista degli step del brano, solo per l'admin. */
export function StepsEditor({ steps, onChange }: { steps: Step[]; onChange: (s: Step[]) => void }) {
  const [label, setLabel] = useState('');
  const toggle = (id: string) => onChange(steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  const remove = (id: string) => onChange(steps.filter((s) => s.id !== id));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onChange([...steps, { id: newStepId(), label: label.trim(), done: false }]);
    setLabel('');
  };
  return (
    <div className="steps-editor">
      {steps.map((s, i) => (
        <div key={s.id} className="step-row">
          <label className="check" style={{ alignItems: 'center', flex: 1 }}>
            <input type="checkbox" checked={s.done} onChange={() => toggle(s.id)} />
            <span style={{ textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--faint)' : 'var(--text)' }}>{s.label}</span>
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sposta su ${s.label}`} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Sposta giù ${s.label}`} onClick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</button>
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Togli ${s.label}`} onClick={() => remove(s.id)}>✕</button>
          </div>
        </div>
      ))}
      <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aggiungi uno step solo per questo brano" aria-label="Nuovo step" />
        <button className="btn btn-sm" style={{ minHeight: 48 }} disabled={!label.trim()}>Aggiungi</button>
      </form>
    </div>
  );
}
