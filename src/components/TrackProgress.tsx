import { progressColor, type Progress } from '../lib/steps';
import { t } from '../lib/i18n';

/** Barra di avanzamento del brano: è tutto quello che vede l'artista. */
export function TrackProgress({ progress, compact }: { progress: Progress; compact?: boolean }) {
  const color = progressColor(progress.pct);
  const text = progress.complete ? `${t(progress.label)} 🎉` : t('Siamo a: {step}', { step: t(progress.label) });
  return (
    <div className="tprogress" role="img" aria-label={t('Avanzamento {pct}%. {testo}', { pct: progress.pct, testo: text })}>
      <div className="tprogress-head">
        <span className={compact ? 'tiny' : 'small'} style={{ fontWeight: 600, color: '#D6D6D2' }}>{text}</span>
        <span className={compact ? 'tiny' : 'small'} style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{progress.pct}%</span>
      </div>
      <div className="tprogress-track">
        <div className="tprogress-fill" style={{ width: `${Math.max(progress.pct, 2)}%`, background: `linear-gradient(90deg, #5B5F6A, ${color})`, boxShadow: progress.pct > 0 ? `0 0 14px ${color}66` : 'none' }} />
      </div>
    </div>
  );
}
