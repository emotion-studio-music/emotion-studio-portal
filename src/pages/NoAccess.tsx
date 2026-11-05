import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';

export function NoAccess() {
  const { user, logout } = useAuth();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="logo" src="/logo.png" alt="Emotion Studio" />
        <div className="card card-pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="h2">{t('Account non attivo')}</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {t('L’account {account} non è collegato a nessun artista attivo. Scrivi allo studio per riattivarlo.', { account: user?.email ?? '' })}
          </p>
          <button className="btn btn-block" onClick={() => void logout()}>{t('Esci')}</button>
        </div>
      </div>
    </div>
  );
}
