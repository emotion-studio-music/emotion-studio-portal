import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useArtist } from '../../lib/data';
import {
  changeUsername, createArtist, credentialsMessage, deleteArtist, resetArtistPassword, savePrivateNotes, setArtistActive, updateArtist,
  whatsappLink, type ArtistInput,
} from '../../lib/admin';
import { isUsernameAccount, slugUsername, usernameOf } from '../../lib/username';
import { generatePassword } from '../../lib/password';
import { compressImage } from '../../lib/image';
import { errorMessage } from '../../lib/errors';
import { Loading } from '../../components/Loading';
import { SessionPicker } from '../../components/SessionPicker';
import { FocusPicker } from '../../components/FocusPicker';
import { defaultFocus, emptySession } from '../../lib/types';
import { IconArrowLeft, IconCopy, IconEye, IconImage } from '../../components/Icons';

const empty: ArtistInput = {
  stageName: '', realName: '', bio: '', photo: null, photoFocus: defaultFocus, genres: [], phone: '',
  links: { instagram: '', spotify: '', tiktok: '', youtube: '' }, nextSession: emptySession,
};

interface Created { id: string; stageName: string; username: string; password: string; phone: string }

export function ArtistForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { artist, loading } = useArtist(id);
  const [form, setForm] = useState<ArtistInput>(empty);
  const [genresText, setGenresText] = useState('');
  const [email, setEmail] = useState('');        // in creazione: il nome utente
  const [userTouched, setUserTouched] = useState(false);
  const [password, setPassword] = useState(generatePassword());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const loadedId = useRef<string | null>(null);

  // Carica i dati una sola volta per artista (non sovrascrive mentre scrivi).
  useEffect(() => {
    if (!artist || loadedId.current === artist.id) return;
    loadedId.current = artist.id;
    setForm({
      stageName: artist.stageName, realName: artist.realName, bio: artist.bio, photo: artist.photo, photoFocus: artist.photoFocus,
      genres: artist.genres, phone: artist.phone, links: { ...empty.links, ...artist.links }, nextSession: artist.nextSession,
    });
    setGenresText(artist.genres.join(', '));
    setEmail(artist.memberEmails[0] ?? '');
    getDoc(doc(db, 'artists', artist.id, 'private', 'admin'))
      .then((s) => setNotes((s.data()?.notes as string) ?? ''))
      .catch(() => undefined);
  }, [artist]);

  if (!isNew && loading) return <Loading />;
  if (!isNew && !artist) return <div className="empty">Artista non trovato. <Link to="/admin">Torna all’elenco</Link></div>;

  const set = <K extends keyof ArtistInput>(k: K, v: ArtistInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLink = (k: keyof ArtistInput['links'], v: string) => setForm((f) => ({ ...f, links: { ...f.links, [k]: v } }));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try { set('photo', await compressImage(file, 1080)); set('photoFocus', defaultFocus); setError(null); } catch (e) { setError(errorMessage(e)); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(null);
    const data: ArtistInput = {
      ...form,
      stageName: form.stageName.trim(),
      genres: genresText.split(',').map((g) => g.trim()).filter(Boolean),
    };
    try {
      if (isNew) {
        const username = email.includes('@') ? email.trim().toLowerCase() : slugUsername(email);
        const newId = await createArtist(username, password, data, notes);
        setCreated({ id: newId, stageName: data.stageName, username, password, phone: data.phone });
      } else if (id) {
        await updateArtist(id, data);
        await savePrivateNotes(id, notes);
        setSaved('Modifiche salvate.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (created) return <CreatedPanel c={created} onDone={() => navigate(`/admin/artisti/${created.id}`)} />;

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/admin" className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
            <IconArrowLeft width={16} height={16} /> Artisti
          </Link>
          <h1 className="display page-title">{isNew ? 'Nuovo artista' : form.stageName || 'Artista'}</h1>
        </div>
        {!isNew && id && (
          <div className="row-actions">
            <Link to={`/admin/artisti/${id}/musica`} className="btn">Musica: progetti e brani</Link>
            <Link to={`/admin/artisti/${id}/pagamenti`} className="btn">Pagamenti</Link>
            <Link to={`/admin/artisti/${id}/lavori`} className="btn">Sessioni e task</Link>
            <Link to={`/admin/artisti/${id}/demo`} className="btn">Demo</Link>
            <Link to={`/admin/artisti/${id}/anteprima`} className="btn"><IconEye width={18} height={18} /> Vedi come lo vede l’artista</Link>
          </div>
        )}
      </div>

      <form className="form" onSubmit={submit} style={{ gap: 24 }}>
        <section className="card card-pad form">
          <h2 className="h2">Profilo</h2>
          <div className="photo-pick">
            <div className="thumb">{form.photo ? <img src={form.photo} alt="Foto profilo" /> : <IconImage />}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                {form.photo ? 'Cambia foto' : 'Carica foto'}
                <input type="file" accept="image/*" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />
              </label>
              {form.photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('photo', null)}>Rimuovi</button>}
              <small className="tiny muted">Verticale, meglio su fondo scuro. Viene ridotta in automatico.</small>
            </div>
          </div>
          {form.photo && (
            <div className="field"><span>Inquadratura: tocca il viso</span>
              <FocusPicker src={form.photo} value={form.photoFocus} onChange={(f) => set('photoFocus', f)} />
            </div>
          )}
          <div className="grid-2">
            <label className="field"><span>Nome d’arte *</span>
              <input className="input" required value={form.stageName} onChange={(e) => { set('stageName', e.target.value); if (isNew && !userTouched) setEmail(slugUsername(e.target.value)); }} />
            </label>
            <label className="field"><span>Nome e cognome</span>
              <input className="input" value={form.realName} onChange={(e) => set('realName', e.target.value)} />
            </label>
            <label className="field"><span>Telefono (WhatsApp)</span>
              <input className="input" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="347 1234567" />
            </label>
            <label className="field"><span>Generi</span>
              <input className="input" value={genresText} onChange={(e) => setGenresText(e.target.value)} placeholder="Urban, Pop" />
              <small>Separati da virgola.</small>
            </label>
          </div>
          <label className="field"><span>Biografia</span>
            <textarea className="textarea" value={form.bio} onChange={(e) => set('bio', e.target.value)} />
          </label>
          <div className="grid-2">
            <label className="field"><span>Instagram</span><input className="input" type="url" value={form.links.instagram ?? ''} onChange={(e) => setLink('instagram', e.target.value)} placeholder="https://instagram.com/…" /></label>
            <label className="field"><span>Spotify</span><input className="input" type="url" value={form.links.spotify ?? ''} onChange={(e) => setLink('spotify', e.target.value)} placeholder="https://open.spotify.com/artist/…" /></label>
            <label className="field"><span>TikTok</span><input className="input" type="url" value={form.links.tiktok ?? ''} onChange={(e) => setLink('tiktok', e.target.value)} /></label>
            <label className="field"><span>YouTube</span><input className="input" type="url" value={form.links.youtube ?? ''} onChange={(e) => setLink('youtube', e.target.value)} /></label>
          </div>
        </section>

        <section className="card card-pad form">
          <h2 className="h2">Prossima sessione</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Se usi Google Calendar collegato all’app, la prossima sessione arriva da lì in automatico (eventi con “{form.stageName || 'nome artista'}” nel titolo).
            Questo campo serve solo se non è in calendario.
          </p>
          <SessionPicker value={form.nextSession} onChange={(v) => set('nextSession', v)} />
        </section>

        <section className="card card-pad form">
          <h2 className="h2">Accesso</h2>
          {isNew ? (
            <div className="grid-2">
              <label className="field"><span>Nome utente *</span>
                <input className="input" required autoComplete="off" autoCapitalize="none" spellCheck={false} value={email}
                  onChange={(e) => { setEmail(e.target.value); setUserTouched(true); }} placeholder="jayden" />
                <small>Minuscole, senza spazi. È quello che l’artista scrive per entrare.</small>
              </label>
              <label className="field"><span>Password (scrivila tu o usa quella proposta)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} />
                  <button type="button" className="btn btn-sm" style={{ minHeight: 48 }} onClick={() => setPassword(generatePassword())}>Rigenera</button>
                </div>
                <small>Almeno 8 caratteri. L’artista non può cambiarla: la decidi tu.</small>
              </label>
            </div>
          ) : (
            <AccessControls id={id!} email={email} uid={artist!.memberUids[0] ?? ''} stageName={artist!.stageName} phone={artist!.phone} active={artist!.active} />
          )}
        </section>

        <section className="card card-pad form">
          <h2 className="h2">Note private</h2>
          <label className="field"><span>Visibili solo a te</span>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Accordi, preferenze, cose da ricordare…" />
          </label>
        </section>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {saved && <div className="alert alert-ok" role="status">{saved}</div>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Salvataggio…' : isNew ? 'Crea artista' : 'Salva modifiche'}</button>
          <Link to="/admin" className="btn btn-ghost">Annulla</Link>
        </div>
      </form>
    </>
  );
}

function AccessControls({ id, email, uid, stageName, phone, active }: { id: string; email: string; uid: string; stageName: string; phone: string; active: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPass, setNewPass] = useState<string | null>(null);
  const [draftPass, setDraftPass] = useState<string | null>(null); // password che stai scegliendo
  const [editUser, setEditUser] = useState<string | null>(null);
  const username = usernameOf(email);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); return true; } catch (e) { setMsg({ ok: false, text: errorMessage(e) }); return false; } finally { setBusy(false); }
  };
  const resetPassword = async () => {
    const p = (draftPass ?? '').trim();
    if (p.length < 8) { setMsg({ ok: false, text: 'La password deve avere almeno 8 caratteri.' }); return; }
    if (await run(() => resetArtistPassword(uid, p), 'Nuova password impostata: mandala all’artista.')) { setNewPass(p); setDraftPass(null); }
  };
  const appUrl = window.location.origin;
  const passText = newPass ? `Ciao ${stageName}, ecco i tuoi nuovi dati per Emotion Studio:\n${appUrl}\nNome utente: ${username}\nPassword: ${newPass}` : '';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="tiny muted">{isUsernameAccount(email) ? 'Nome utente' : 'Accesso (vecchio formato con email)'}</span>
          <span style={{ overflowWrap: 'anywhere', fontWeight: 600 }}>{username}</span>
        </div>
        <span className={`badge ${active ? 'badge-on' : 'badge-off'}`}>{active ? 'Attivo' : 'Disattivato'}</span>
      </div>

      {editUser !== null ? (
        <div className="inset">
          <label className="field"><span>Nuovo nome utente</span>
            <input className="input" value={editUser} autoCapitalize="none" spellCheck={false} onChange={(e) => setEditUser(e.target.value)} placeholder="jayden" />
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !slugUsername(editUser)}
              onClick={() => void run(() => changeUsername(id, uid, slugUsername(editUser)), `Nome utente cambiato in “${slugUsername(editUser)}”.`).then((ok) => ok && setEditUser(null))}>
              Salva nome utente
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}>Annulla</button>
          </div>
        </div>
      ) : null}

      {draftPass !== null && (
        <div className="inset">
          <label className="field"><span>Nuova password (scrivila tu o usa quella proposta)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={draftPass} onChange={(e) => setDraftPass(e.target.value)} autoComplete="off" spellCheck={false}
                style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} />
              <button type="button" className="btn btn-sm" style={{ minHeight: 48 }} onClick={() => setDraftPass(generatePassword())}>Proponi</button>
            </div>
            <small>Almeno 8 caratteri.</small>
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void resetPassword()}>Imposta password</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraftPass(null)}>Annulla</button>
          </div>
        </div>
      )}

      {newPass && (
        <div className="inset">
          <div className="cred-box">
            <span><span className="muted">Nome utente </span>{username}</span>
            <span><span className="muted">Password </span>{newPass}</span>
          </div>
          <div className="row-actions">
            {phone && <a className="btn btn-primary btn-sm" href={whatsappLink(phone, passText)} target="_blank" rel="noreferrer">Invia su WhatsApp</a>}
            <button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(passText)}>Copia messaggio</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {draftPass === null && <button type="button" className="btn btn-sm" disabled={busy || !uid} onClick={() => { setNewPass(null); setDraftPass(generatePassword()); }}>Nuova password</button>}
        {editUser === null && <button type="button" className="btn btn-sm" disabled={busy || !uid} onClick={() => setEditUser(isUsernameAccount(email) ? username : slugUsername(stageName))}>
          {isUsernameAccount(email) ? 'Cambia nome utente' : 'Passa a nome utente'}
        </button>}
        <button type="button" className={`btn btn-sm ${active ? 'btn-danger' : ''}`} disabled={busy}
          onClick={() => {
            if (active && !confirm('Disattivare l’artista? Non potrà più entrare finché non lo riattivi. I dati restano salvati.')) return;
            void run(() => setArtistActive(id, !active), active ? 'Artista disattivato.' : 'Artista riattivato.');
          }}>
          {active ? 'Disattiva artista' : 'Riattiva artista'}
        </button>
      </div>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</div>}
      <DeleteArtist id={id} stageName={stageName} />
    </>
  );
}

function CreatedPanel({ c, onDone }: { c: Created; onDone: () => void }) {
  const appUrl = window.location.origin;
  const text = credentialsMessage(c.stageName, c.username, c.password, appUrl);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 className="display page-title">{c.stageName} è dentro</h1>
      <p className="muted" style={{ margin: 0 }}>
        Account creato. Manda le credenziali all’artista: la password la vedi solo adesso.
      </p>
      <div className="cred-box">
        <span><span className="muted">Indirizzo </span>{appUrl}</span>
        <span><span className="muted">Nome utente </span>{c.username}</span>
        <span><span className="muted">Password </span>{c.password}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {c.phone && (
          <a className="btn btn-primary" href={whatsappLink(c.phone, text)} target="_blank" rel="noreferrer">Invia su WhatsApp</a>
        )}
        <button className="btn" onClick={() => void copy()}><IconCopy width={18} height={18} /> {copied ? 'Messaggio copiato' : 'Copia messaggio'}</button>
        <button className="btn btn-ghost" onClick={onDone}>Vai al profilo</button>
      </div>
    </div>
  );
}

/** Elimina per sempre l'artista: si conferma scrivendo il nome d'arte. */
function DeleteArtist({ id, stageName }: { id: string; stageName: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [withDrive, setWithDrive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = typed.trim().toLowerCase() === stageName.trim().toLowerCase() && stageName.trim() !== '';

  const remove = async () => {
    setBusy(true); setError(null);
    try {
      const warnings = await deleteArtist(id, withDrive);
      if (warnings.length) alert(`Artista eliminato.\n\n${warnings.join('\n')}`);
      navigate('/admin', { replace: true });
    } catch (e) {
      setError(errorMessage(e)); setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => setOpen(true)}>
        Elimina artista…
      </button>
    );
  }
  return (
    <div className="inset" style={{ borderColor: 'var(--danger)' }}>
      <strong>Eliminare per sempre {stageName}?</strong>
      <span className="small muted">
        Spariscono dall’app profilo, progetti, brani, versioni, note, demo, preventivi, pagamenti, sessioni e task, e l’artista non può più entrare.
        Non si può annullare. Se vuoi solo togliergli l’accesso usa “Disattiva artista”.
      </span>
      <label className="check" style={{ alignItems: 'center' }}>
        <input type="checkbox" checked={withDrive} onChange={(e) => setWithDrive(e.target.checked)} disabled={busy} />
        <span className="small">Sposta nel Cestino di Drive anche la sua cartella (MP3, demo, copertine). Il Cestino si svuota da solo dopo 30 giorni: fino ad allora puoi recuperarla.</span>
      </label>
      <label className="field"><span>Per confermare scrivi “{stageName}”</span>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} />
      </label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="row-actions">
        <button type="button" className="btn btn-danger btn-sm" disabled={!ok || busy} onClick={() => void remove()}>{busy ? 'Elimino…' : 'Elimina per sempre'}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setOpen(false); setTyped(''); }}>Annulla</button>
      </div>
    </div>
  );
}
