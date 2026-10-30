# Emotion Studio · area artisti

Web app privata di Emotion Studio: ogni artista trova brani, progressi, sessioni e pagamenti.
Questa è la **Fase A**: accesso, ruoli, profili artista, impostazioni studio e design "Notturno".

Questa guida è scritta per chi non è sviluppatore. Basta seguire i passaggi in ordine.

---

## 1. Cosa ti serve sul computer (una volta sola)

1. **Node.js** versione LTS: scaricalo da https://nodejs.org e installalo con le impostazioni predefinite.
2. **GitHub Desktop**: https://desktop.github.com, poi accedi con l'account GitHub dello studio.
3. Un **terminale**: su Windows usa "Prompt dei comandi" o "PowerShell", su Mac "Terminale".

Per controllare che Node sia installato, nel terminale scrivi `node -v`: deve comparire un numero tipo `v22…`.

## 2. Metti il codice nel repository GitHub

1. Apri GitHub Desktop → **File → Clone repository** → scegli `emotion-studio-app` → scegli una cartella sul computer.
2. Copia **dentro quella cartella** tutti i file di questo pacchetto (estrai lo zip).
3. In GitHub Desktop compare l'elenco dei file nuovi: scrivi "Fase A" nel riquadro in basso a sinistra, premi **Commit to main** e poi **Push origin**.

## 3. Prepara Firebase (console.firebase.google.com)

**Accesso con email e password**
- Authentication → Metodo di accesso → **Email/password** → Attiva (solo la prima opzione) → Salva.
- Authentication → Modelli → in basso cambia la lingua dei modelli in **Italiano** (così l'email "reimposta password" arriva in italiano).

**Database**
- Firestore Database deve essere già creato (modalità produzione, regione europe-west8 Milano).

**Configurazione dell'app**
- Impostazioni progetto (ingranaggio) → Le tue app → la tua app Web → **Configurazione SDK** → "Config".
- Nella cartella del progetto, copia il file `.env.example` e rinomina la copia in `.env`.
- Apri `.env` con il Blocco note e incolla i valori, senza virgolette. Esempio:
  ```
  VITE_FIREBASE_API_KEY=AIzaSy...
  VITE_FIREBASE_AUTH_DOMAIN=emotion-studio-xxxx.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=emotion-studio-xxxx
  VITE_FIREBASE_STORAGE_BUCKET=emotion-studio-xxxx.firebasestorage.app
  VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
  VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
  ```
- Apri anche il file `.firebaserc` e sostituisci `INSERISCI-ID-PROGETTO-FIREBASE` con il tuo **ID progetto** (lo stesso di `VITE_FIREBASE_PROJECT_ID`).

Il file `.env` non viene caricato su GitHub (è escluso apposta).

**Crea il tuo account amministratore**
1. Authentication → Utenti → **Aggiungi utente**: la tua email e una password tua.
2. Copia l'**UID utente** che compare nella tabella (una lunga sigla).
3. Firestore Database → **Avvia raccolta** → ID raccolta: `admins` → ID documento: incolla il tuo UID → aggiungi un campo `nome` (stringa) con valore `Riccardo` → Salva.

Solo chi ha un documento in `admins` vede il pannello di gestione.

## 4. Provala sul computer

Nel terminale, entra nella cartella del progetto (es. `cd Documenti\emotion-studio-app`) e scrivi:

```
npm install
npm run dev
```

Apri l'indirizzo che compare (di solito http://localhost:5173) ed entra con il tuo account admin.
Per fermarla premi `Ctrl + C` nel terminale.

## 5. Pubblicala online (Firebase Hosting)

La prima volta:

```
npm install -g firebase-tools
firebase login
```

(si apre il browser: accedi con emotion.studiomusic@gmail.com)

Poi, ogni volta che vuoi pubblicare un aggiornamento:

```
npm run deploy
```

Questo comando prepara l'app e pubblica insieme **sito, regole di sicurezza e indici del database**.
L'app sarà su `https://ID-PROGETTO.web.app`. Il sottodominio `emotionstudio.efamusic.it` lo colleghiamo nella Fase F.

> La prima volta, dopo il deploy, aspetta qualche minuto: Firebase deve costruire l'indice del database. Finché non è pronto, un artista potrebbe vedere "Account non attivo".

## 6. Come aggiungere un artista

1. Entra come admin → **Nuovo artista**.
2. Compila nome d'arte, email, telefono, foto, generi, bio e link. La password è già generata (puoi rigenerarla).
3. Premi **Crea artista**: compare la schermata con le credenziali.
4. Premi **Invia su WhatsApp** (si apre WhatsApp con il messaggio pronto) oppure **Copia messaggio**.

La password la vedi solo in quel momento. Se l'artista la perde: apri il suo profilo → **Invia email per nuova password**, oppure lui stesso usa "Password dimenticata?" nella schermata di accesso.

Per vedere l'app esattamente come la vede l'artista: profilo artista → **Vedi come lo vede l'artista**.

Per togliere l'accesso a un artista: profilo → **Disattiva artista**. I suoi dati restano salvati e puoi riattivarlo quando vuoi.

## 7. Dove sono i dati

- **Firestore** (console Firebase → Firestore Database):
  - `artists` → un documento per artista (profilo, foto compressa, prossima sessione)
  - `artists/…/private/admin` → le tue note private (gli artisti non possono leggerle)
  - `settings/studio` → istruzioni di pagamento e messaggio in home
  - `users` → data di accettazione della privacy di ogni artista
  - `admins` → chi è amministratore
- **Account** → console Firebase → Authentication → Utenti.
- La sicurezza è garantita dalle regole nel file `firestore.rules`: ogni artista legge solo i propri dati, anche se qualcuno provasse a forzare l'app.

## 8. Costi

Tutto sul piano gratuito Spark di Firebase, nessuna carta richiesta. Con 5–10 artisti si resta molto sotto i limiti
(50.000 letture e 20.000 scritture al giorno, 1 GB di dati).

## Cosa arriva nelle prossime fasi

- **B** – progetti, brani, versioni MP3 da Google Drive e player con forma d'onda (con il Worker Cloudflare)
- **C** – commenti sulla forma d'onda, confronto A/B, loop, mini player
- **D** – caricamento provini dagli artisti
- **E** – task, sessioni, preventivi e pagamenti, checklist di uscita, vista "Da fare oggi"
- **F** – installazione come app, sottodominio, rifiniture e animazioni

---

### Note tecniche (per chi ti aiuta)

- React 18 + Vite + TypeScript, Firebase JS SDK v11 (Auth email/password + Firestore). Nessun backend in Fase A.
- Gli account artista vengono creati dal browser dell'admin tramite una seconda istanza Firebase (`src/lib/admin.ts`), così l'admin resta loggato. In Fase B la creazione passerà al Worker Cloudflare con service account, per poter disattivare la registrazione dal client.
- Ruoli: admin = documento in `admins/{uid}`; artista = `uid` in `artists.memberUids` con `active == true` (pronto per i duo).
- Foto profilo: compressa nel browser (max 720 px, WebP) e salvata come data URL nel documento artista. In Fase B si può spostare su Drive.
- Comandi: `npm run dev`, `npm run build`, `npm run deploy` (build + `firebase deploy`).
