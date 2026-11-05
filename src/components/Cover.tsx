import { t } from '../lib/i18n';
/** Copertina del progetto, o una copertina tipografica se manca l'immagine. */
export function Cover({ src, title, className = 'cover' }: { src: string | null; title: string; className?: string }) {
  if (src) return <img className={className} src={src} alt={t('Copertina di {titolo}', { titolo: title })} style={{ padding: 0 }} />;
  return <div className={className} aria-hidden="true"><span>{title}</span></div>;
}
