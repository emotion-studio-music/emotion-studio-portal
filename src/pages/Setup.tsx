export function Setup() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img className="logo" src="/logo.png" alt="Emotion Studio" />
        <div className="card card-pad" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h1 className="h2">Manca la configurazione</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Crea il file <code>.env</code> partendo da <code>.env.example</code> e incolla i dati della tua app
            Web di Firebase. Poi riavvia con <code>npm run dev</code>. Trovi i passaggi nel README.
          </p>
        </div>
      </div>
    </div>
  );
}
