import { t } from '../lib/i18n';
export function Loading({ label }: { label?: string }) {
  return (
    <div className="center-screen" role="status" aria-live="polite">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="spinner" />
        <span className="small muted">{label ?? t('Caricamento…')}</span>
      </div>
    </div>
  );
}
