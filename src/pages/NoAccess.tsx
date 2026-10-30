import { useAuth } from '../lib/auth';

export function NoAccess() {
  const { user, logout } = useAuth();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="logo" src="/logo.png" alt="Emotion Studio" />
        <div className="card card-pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="h2">Account non attivo</h1>
          <p className="small muted" style={{ margin: 0 }}>
            L’account {user?.email} non è collegato a nessun artista attivo. Scrivi allo studio per riattivarlo.
          </p>
          <button className="btn btn-block" onClick={() => void logout()}>Esci</button>
        </div>
      </div>
    </div>
  );
}
