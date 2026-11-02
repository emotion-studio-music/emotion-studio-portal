# Emotion Studio · area artisti

Web app privata di Emotion Studio: ogni artista trova brani, progressi, sessioni e pagamenti.
Fasi completate: **A** (accesso, ruoli, profili artista, impostazioni studio, design "Notturno") **B** (progetti, brani, versioni MP3 su Google Drive, player con forma d'onda) **C** (note sulla forma d'onda, confronto A/B, loop, mini player, percorso del brano) **D** (demo degli artisti, anche registrate dal telefono) **E** (preventivi e pagamenti, sessioni, task, vista "Oggi") **F** (preventivi a clic, copertine scaricabili, app installabile, sottodominio, rifiniture) e **G1** (Google Calendar, inquadratura foto, social, traguardi).

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

---

## Fase B · Collegare Google Drive (una volta sola)

Gli MP3 stanno nel Google Drive dello studio. Un piccolo programma gratuito su Cloudflare (il "Worker")
fa da ponte: controlla chi sta ascoltando e passa l'audio all'app. Nessuno può raggiungere i file senza essere loggato.

### B1. Google Cloud: permesso di usare Drive
Vai su https://console.cloud.google.com con **emotion.studiomusic@gmail.com** e in alto seleziona il progetto **Emotion Studio**.

1. **Attiva l'API di Drive**: menu ☰ → API e servizi → Libreria → cerca **Google Drive API** → **Abilita**.
2. **Schermata di consenso**: menu ☰ → API e servizi → **Schermata consenso OAuth** (si apre "Google Auth Platform") → **Inizia**.
   - Nome app: `Emotion Studio` · Email di assistenza: quella dello studio → Avanti
   - Pubblico: **Esterno** → Avanti · Email di contatto: quella dello studio → Avanti → accetta → **Crea**
3. **Accesso ai dati** (menu a sinistra) → **Aggiungi o rimuovi ambiti** → cerca `drive.file` → spunta
   `.../auth/drive.file` ("Visualizza e gestisci i file di Google Drive che usi con questa app") → **Aggiorna** → **Salva**.
4. **Pubblico** (menu a sinistra) → **Pubblica app** → Conferma. Lo stato deve diventare **In produzione**.
   (Se resta "Test", il collegamento scade ogni 7 giorni.)
5. **Client** (menu a sinistra) → **Crea client**:
   - Tipo: **Applicazione web** · Nome: `Emotion Worker`
   - URI di reindirizzamento autorizzati → Aggiungi URI: `https://developers.google.com/oauthplayground`
   - **Crea** → copia **ID client** e **Client secret** in un posto sicuro (il secret si vede una volta sola: scarica anche il JSON).

### B2. Ottenere il "refresh token" (la chiave permanente)
1. Apri https://developers.google.com/oauthplayground
2. In alto a destra ⚙️ → spunta **Use your own OAuth credentials** → incolla ID client e Client secret → chiudi.
3. A sinistra, nel campo "Input your own scopes", scrivi `https://www.googleapis.com/auth/drive.file` → **Authorize APIs**.
4. Accedi con l'account dello studio. Compare "Google non ha verificato questa app": è normale (l'app è tua) →
   **Avanzate** → **Vai a Emotion Studio** → **Continua**.
5. Torni al Playground: clicca **Exchange authorization code for tokens** → copia il **Refresh token** (inizia con `1//`).

ID client, Client secret e Refresh token sono riservati: non metterli su GitHub né in chat.

### B3. Cloudflare: il Worker
1. Crea un account gratuito su https://dash.cloudflare.com con l'email dello studio e conferma l'email.
2. Menu a sinistra **Compute (Workers)** → **Workers e Pages** → **Crea** → **Inizia con Hello World** →
   nome `emotion-api` → **Deploy**.
3. **Modifica codice** → cancella tutto → incolla il contenuto del file `worker/worker.js` di questo progetto → **Deploy**.
4. Torna al Worker → **Impostazioni** → **Variabili e segreti** → **Aggiungi** (una per volta):

   | Tipo | Nome | Valore |
   |---|---|---|
   | Testo | `FIREBASE_PROJECT_ID` | `emotion-studio` |
   | Testo | `ALLOWED_ORIGINS` | `https://emotion-studio.web.app,https://emotion-studio.firebaseapp.com,http://localhost:5173,https://emotionstudio.efamusic.it` |
   | Segreto | `GOOGLE_CLIENT_ID` | l'ID client |
   | Segreto | `GOOGLE_CLIENT_SECRET` | il Client secret |
   | Segreto | `GOOGLE_REFRESH_TOKEN` | il Refresh token |
   | Segreto | `SIGNING_KEY` | una frase casuale lunga, almeno 32 caratteri (inventala, non serve ricordarla) |

   → **Deploy**/Salva.
5. Copia l'indirizzo del Worker (tipo `https://emotion-api.NOME.workers.dev`) e aprilo aggiungendo `/health`.
   Deve comparire: `{"ok":true,"drive":"collegato",...}`

### B4. Collegare l'app al Worker
1. Nel file `.env` aggiungi una riga: `VITE_WORKER_URL=https://emotion-api.NOME.workers.dev` (senza `/` finale).
2. Riavvia `npm run dev` (Ctrl+C e di nuovo `npm run dev`). Nel pannello Musica di un artista deve comparire "Drive collegato".
3. Quando funziona, pubblica con `npm run deploy`.

### Come caricare una nuova versione
Admin → artista → **Musica: progetti e brani** → crea un progetto (singolo/EP/album) → aggiungi i brani →
sul brano **Versioni** → scegli l'MP3 → nome (es. "Mix v2") → note → **Carica versione**.
L'app calcola la forma d'onda, crea le cartelle su Drive (`Emotion Studio – App / Artista / Progetto / Versioni`),
carica il file e segna il brano "Da ascoltare" per l'artista. La fase del brano (Ricevuto → Pubblicato) si cambia dal menu a tendina.

Carica MP3 a 320 kbps: pesano circa 10 MB e partono subito anche da telefono.

### Cosa fare se lo spazio Drive finisce
In alto nella pagina Musica vedi lo spazio usato. Quando serve: sposta sul NAS le cartelle dei progetti
consegnati da più di un anno e cancellale da Drive (svuota anche il Cestino di Drive). Nell'app le versioni archiviate
mostreranno un errore di riproduzione: puoi toglierle dal brano con **Elimina** (storico e note restano).

### Se qualcosa non va
- **"Drive non collegato"** → manca `VITE_WORKER_URL` nel `.env`, o non hai riavviato `npm run dev`.
- **"Drive non raggiungibile"** → apri `.../health` del Worker: se dice "Collegamento a Google Drive non riuscito",
  rifai B2 e aggiorna `GOOGLE_REFRESH_TOKEN` nel Worker. Controlla che l'app in Google Auth Platform sia **In produzione**.
- **Errore di accesso al Worker dal sito pubblicato** → controlla che l'indirizzo del sito sia in `ALLOWED_ORIGINS`.

---

## Fase C · Come si usa

**Percorso del brano** – Ogni brano ha una lista di step (Provino ricevuto → … → Pubblicato) che spunti solo tu:
Admin → artista → Musica → sotto il brano tocca la barra "Percorso: x/y step · modifica". Puoi spuntare, riordinare (↑ ↓),
togliere (✕) o aggiungere step solo per quel brano. Gli step predefiniti dei nuovi brani si cambiano in
**Impostazioni studio → Percorso dei brani** (uno per riga). L'artista vede solo la barra con la percentuale e "Siamo a: …".
I brani creati prima di questa fase vengono convertiti in automatico la prima volta che spunti uno step.

**Note di revisione** – Nella pagina del brano: tocca la forma d'onda (o metti in pausa) nel punto giusto e scrivi la nota.
La nota compare come pallino sulla forma d'onda: toccandolo il brano salta lì. "Senza tempo" crea una nota generale.
Le note valgono per la versione che stai ascoltando. Tu e l'artista potete spuntarle come "Risolto".
Nel pannello Musica, accanto al brano, compare "N note da risolvere" quando l'artista ha scritto qualcosa.

**Confronto A/B** – Nella pagina del brano, "Confronta con…" sceglie una seconda versione; i pulsanti A e B passano
dall'una all'altra restando nello stesso punto del brano.

**Loop** – "Scegli una sezione", poi trascina sulla forma d'onda la parte da ripetere. Il loop si può spostare e allungare
trascinandone i bordi; toccando il pulsante con i tempi lo accendi e spegni.

**Mini player** – Se esci dalla pagina del brano la musica continua: in basso compare il mini player
(tocca per tornare al brano, ✕ per chiudere).

> Dopo aver installato la Fase C pubblica anche le nuove regole di sicurezza: `npm run deploy` lo fa in automatico.

---

## Fase D · Demo degli artisti

**Aggiornare il Worker (obbligatorio con la Fase D)** – Cloudflare → Workers e Pages → `emotion-api` → **Modifica codice** →
cancella tutto → incolla il nuovo `worker/worker.js` → **Deploy**. Le variabili restano quelle di prima.

**Lato artista** – Tab **Demo** in basso: "Carica un file" (memo vocale, M4A, MP3, WAV, fino a 100 MB) oppure
"Registra adesso" (pulsante rosso, massimo 10 minuti), titolo e nota → **Invia allo studio**. In "Le mie demo" vede lo stato:
*Inviata allo studio*, *Ascoltata*, *⭐ Selezionata per lo studio*. Finché non l'hai aperta può ritirarla.

**Lato studio** – Voce **Demo** nel menu (con il numero delle nuove) e badge "N demo nuove" sui riquadri degli artisti.
Aprendo una demo diventa "Ascoltata". Puoi darle da 1 a 5 stelle, cambiare stato (Da ascoltare, Ascoltata, Selezionata, Scartata),
lasciare note sulla forma d'onda, scaricarla, eliminarla (il file va nel Cestino di Drive per 30 giorni) e premere **Porta in studio**: crea il brano (in un nuovo singolo o in un progetto esistente)
con il percorso già pronto e la demo come prima versione. L'artista non vede mai "Scartata": per lui resta "Ascoltata".

I file finiscono su Drive in `Emotion Studio – App / Artista / Demo`, sempre di proprietà dello studio.

---

## Fase E · Pagamenti, sessioni, task e vista "Oggi"

**Oggi** (prima voce del menu, con il numero delle cose in sospeso) – pagamenti segnalati dagli artisti da confermare,
note degli artisti da risolvere, demo nuove, task scaduti o tuoi, pagamenti scaduti, sessioni dei prossimi 7 giorni.

**Pagamenti** e **Sessioni e task** (dal profilo dell'artista, due pulsanti separati):
- *Pagamenti*: crei un **preventivo** (per cosa, importo concordato, progetto). Poi **chiedi all'artista** un acconto o il saldo
  (con scadenza e, se vuoi, un link per pagare con carta generato da Nexi/SumUp/Stripe) oppure **registri un incasso** già ricevuto.
  Quando l'artista preme "Ho pagato" lo vedi in Oggi: controlli e premi **Conferma incasso**. Puoi annotare il numero di fattura.
- *Sessioni*: data, ore, tipo, brani lavorati e cosa avete fatto. L'artista vede lo storico e il totale delle ore.
- *Task*: cose da fare per l'artista (le vede in home e le spunta) o per te (le vedi in Oggi).

**Lato artista** – Pagamenti: totale da saldare, richieste aperte con i pulsanti **Paga con carta** (se hai messo il link),
**Paga con PayPal** (importo già inserito, se in Impostazioni c'è un link paypal.me), **Copia IBAN**, **Copia causale**
("Emotion Studio – Artista – Progetto – Acconto") e **Ho pagato**. In home: task da spuntare, "Da saldare" e "Ore in studio".

Le fatture continui a emetterle dal tuo programma: nell'app annoti solo il numero.

---

## Fase F · Preventivi a clic, copertine, app installabile, sottodominio

**Aggiorna il Worker** (Cloudflare → `emotion-api` → Modifica codice → incolla `worker/worker.js` → Deploy): serve per scaricare le copertine.

**Preventivi a clic** – Nel profilo dell'artista → "Pagamenti": tocchi i servizi, i brani (o "+ nuovo brano"), "A brano" o "Totale",
la tariffa (pulsanti a scatti di 50 €, − / +, oppure un importo a mano) e il pagamento ("Ancora niente", "Acconto 50% pagato oggi",
"Pagato tutto oggi", "Chiedi all'artista"). Il titolo e il totale si scrivono da soli. Servizi e scatto si cambiano in Impostazioni studio.

**Copertine scaricabili** – Quando carichi la copertina di un progetto, l'app tiene la versione piccola per la grafica e salva
l'**originale** su Drive (cartella del progetto). Spunta "L'artista può scaricare la copertina" e all'artista compare **Scarica copertina**
nel progetto e nella pagina del brano. Le copertine caricate prima della Fase F vanno ricaricate una volta.

**App installabile** – Il sito ora si installa come app (icona, schermo intero, apertura veloce). Su Android/Chrome nel Profilo
compare **Installa ora**; su iPhone si usa Safari → Condividi → Aggiungi alla schermata Home (la guida è nel Profilo).

### Sottodominio emotionstudio.efamusic.it
1. Console Firebase → **Hosting** → **Aggiungi dominio personalizzato** → scrivi `emotionstudio.efamusic.it` → Continua.
2. Firebase ti mostra uno o più **record DNS** (di solito un TXT e un A, o un CNAME). Tienili aperti.
3. Nel pannello del fornitore del dominio efamusic.it (dove lo rinnovi) apri la gestione **DNS** e aggiungi quei record
   **identici**, con nome/host `emotionstudio`. Il sottodominio non costa nulla.
4. Torna su Firebase e premi **Verifica**. Il certificato https può richiedere da qualche minuto a 24 ore.
5. Firebase → Authentication → **Impostazioni → Domini autorizzati** → **Aggiungi dominio** → `emotionstudio.efamusic.it`.
6. Nel Worker la variabile `ALLOWED_ORIGINS` contiene già `https://emotionstudio.efamusic.it`: controlla solo che ci sia.
7. Da quel momento dai agli artisti il nuovo indirizzo. Anche `emotion-studio.web.app` continua a funzionare.

### Nome utente e password degli artisti
Gli artisti entrano con un **nome utente** (es. `jayden`) e la password che decidi tu: niente email.
Dietro le quinte l'app usa un indirizzo interno che non riceve posta (`jayden@artisti.efamusic.it`).
L'artista non può cambiare la password: se la perde, dal suo profilo admin premi **Nuova password** e gliela mandi su WhatsApp.
Per "Nuova password" e "Cambia nome utente" serve la chiave del service account nel Worker (passaggi qui sotto).
Gli artisti creati prima con un'email inventata: apri il profilo → **Passa a nome utente**.

### Chiave del service account (consigliata) e registrazioni chiuse
1. Firebase → Impostazioni progetto → **Account di servizio** → **Genera nuova chiave privata** → si scarica un file JSON.
2. Cloudflare → `emotion-api` → Impostazioni → Variabili e segreti → **Aggiungi** → tipo *Segreto*, nome `FIREBASE_SA_JSON`,
   valore: **tutto il contenuto** del file JSON (aprilo con TextEdit/Blocco note, copia e incolla) → Deploy.
3. Prova "Nuova password" su un artista: se funziona, la chiave è a posto (ora anche gli account li crea il Worker).
4. Firebase → Authentication → Impostazioni → **Azioni utente** → togli la spunta a **Abilita creazione (registrazione)** → Salva.
5. Cancella il file JSON dal computer: è una chiave riservata (resta solo dentro Cloudflare).

---

## Fase G1 · Google Calendar, inquadratura foto, social, traguardi

**Aggiorna il Worker** (Cloudflare → `emotion-api` → Modifica codice → incolla `worker/worker.js` → Deploy).

**Google Calendar dello studio**
1. Su computer apri calendar.google.com con l'account dello studio → ingranaggio → **Impostazioni**.
2. A sinistra, in "Impostazioni dei miei calendari", clicca il calendario dove fissi le sessioni.
3. Scorri fino a **Integra il calendario** → copia **Indirizzo segreto in formato iCal** (finisce con `basic.ics`).
4. Cloudflare → `emotion-api` → Impostazioni → Variabili e segreti → Aggiungi → *Segreto* `CALENDAR_ICS_URL` → incolla → Deploy.
5. Regola: nel **titolo** dell'evento scrivi il nome d'arte dell'artista, es. "Jayden – Registrazione".
   L'app riconosce il nome e il tipo (Registrazione, Mix, Mastering, Produzione, Consulenza).

Risultato: in **Oggi** le sessioni dei prossimi 7 giorni arrivano dal calendario; nella **home dell'artista** la
"Prossima sessione" si compila da sola. Ogni artista vede solo i propri eventi; gli eventi senza nome di un artista vengono ignorati.
Le modifiche al calendario compaiono nell'app entro pochi minuti. L'indirizzo iCal è riservato: se lo condividi per errore,
in Google Calendar puoi "Reimpostare" l'indirizzo e aggiornare il segreto.

**Inquadratura foto** – Nel profilo artista, dopo aver caricato la foto, **tocca il viso**: l'app lo tiene inquadrato
nell'header, nei riquadri e nell'avatar rotondo (con anteprime). Lo zoom avvicina.

**Social** – I link inseriti nel profilo (Instagram, Spotify, TikTok, YouTube) compaiono come pulsanti nella home dell'artista.

**Traguardi** – Si sbloccano da soli: primo brano, prima demo, primo master, 10/50/100 ore in studio, un anno con lo studio,
brano sugli store (quando spunti tutti gli step del percorso), EP/album completato. Per i traguardi nuovi l'artista vede una
festa a schermo intero con coriandoli; nel Profilo c'è la bacheca "I miei traguardi".
Nel pannello Musica, sotto il percorso del brano, puoi incollare i **link a Spotify / Apple Music / YouTube**:
compaiono nella festa e nella pagina del brano.

---

## Fase G2a · Feat tra artisti e "Aggiungi al calendario"

**Feat** – Pannello Musica dell'artista principale → sul brano **+ Feat con un altro artista** → tocca gli artisti in collaborazione.
Il brano resta in un solo posto (carichi le versioni una volta): gli artisti in feat lo trovano in **Collaborazioni**
(home e Progetti) con player, versioni, note di revisione e avanzamento. Le note scritte da loro le vedi in "Oggi" come le altre.
Preventivi e pagamenti restano separati per artista. Per togliere un feat, tocca di nuovo il nome.

**Aggiungi al calendario** – Nel riquadro "Prossima sessione" l'artista ha due pulsanti: **Google Calendar** e
**iPhone / altri** (file calendario con promemoria un'ora prima).

**Ciclo di vita del brano (home dell'artista)**
- *In uscita*: se il progetto ha una data di uscita futura, in home compare il conto alla rovescia.
- *Appena uscito*: dal giorno di uscita, il brano è in evidenza in cima alla home per **30 giorni**, con Spotify/Apple/YouTube,
  **Condividi** e copertina. Se nel frattempo esce un altro brano dell'artista, prende il suo posto.
- *Discografia*: dal giorno dopo l'uscita il brano compare anche in Progetti → Discografia, dove resta per sempre.
  Dalla home "I miei progetti" spariscono i brani usciti: restano solo i lavori in corso.
- Il giorno di uscita è la **data di uscita del progetto**; se non c'è, il giorno in cui hai spuntato l'ultimo step.
- Nel tuo pannello Musica i progetti usciti da più di 30 giorni vanno in fondo, in "Mostra usciti".

> Con questa fase cambiano regole e indici del database: `npm run deploy` li pubblica. Dopo il primo deploy
> Firebase impiega qualche minuto a preparare i nuovi indici: se "Collaborazioni" non compare subito, riprova poco dopo.

---

## Fase G2b · Notifiche push

**Chi riceve cosa** (entro circa 5 minuti dall'evento)
- *Tu*: note di revisione scritte dagli artisti, demo nuove, "Ho pagato" da confermare.
- *Artista*: nuova versione da ascoltare, note dello studio (anche sulle demo), richiesta di pagamento, nuova cosa da fare,
  brano uscito. Gli artisti in feat ricevono anche quelle del brano condiviso.

**Configurazione (una volta sola)**
1. Nel Terminale, nella cartella del progetto: `npx web-push generate-vapid-keys` → stampa una *Public Key* e una *Private Key*.
2. Nel file `.env` aggiungi: `VITE_VAPID_PUBLIC_KEY=` seguito dalla Public Key.
3. Cloudflare → `emotion-api` → Impostazioni → Variabili e segreti:
   - *Testo* `VAPID_PUBLIC_KEY` = la Public Key
   - *Segreto* `VAPID_PRIVATE_KEY` = la Private Key (riservata: non metterla nel `.env`, non mandarla in chat)
4. Cloudflare → `emotion-api` → **Modifica codice** → incolla il nuovo `worker/worker.js` → Deploy.
5. Cloudflare → `emotion-api` → Impostazioni → **Trigger** → **Eventi cron** → Aggiungi → `*/5 * * * *` (ogni 5 minuti) → Salva.
   Serve anche il segreto `FIREBASE_SA_JSON` (già inserito nella Fase F).
6. `npm run deploy` (pubblica app, regole e nuovi indici).

**Attivarle**
- Tu (Mac, Chrome/Safari): Impostazioni studio → **Notifiche** → Attiva → **Invia una prova**.
- Artisti: Profilo → **Notifiche** → Attiva. Su **iPhone** funzionano solo dall'app installata sulla schermata Home
  (iOS 16.4 o successivo): prima si installa, poi si apre dall'icona e si attivano.
- Ogni dispositivo si attiva a parte (telefono, computer).

---

## Revisione di sicurezza (1 novembre 2026)

Corretto in questo aggiornamento:
- **Notifiche di prova**: il Worker invia solo ai servizi di notifica veri (Google, Apple, Mozilla, Microsoft), non a indirizzi qualsiasi.
- **Note sui brani in feat**: un artista non può più aggiungere a una nota collaboratori inventati; l'elenco deve coincidere con quello del brano.
- **Link salvati** (social, store, pagamento con carta): l'app accetta solo link `http/https`.
- **Artista disattivato**: viene tolto automaticamente dai feat sui brani degli altri artisti.

Revisione funzionale (stesso giorno), corretto:
- **iPhone**: se il play parte dopo il caricamento e Safari lo blocca, il brano resta in pausa senza messaggi d'errore (basta un tocco).
- **iPhone**: niente più zoom automatico toccando i menu a tendina; niente scorrimento orizzontale nella pagina del brano.
- **Importi**: "1.250" ora vale 1.250 € (prima 1,25 €); nel preventivo a clic si possono scrivere anche i decimali con la virgola.
- **Note orfane**: eliminando un brano o una versione si eliminano anche le sue note (prima restavano in "Oggi").
- **Oggi**: legge solo le note non risolte, per consumare meno letture del piano gratuito.
- **Notifica "è uscito"**: parte solo per i brani appena usciti, non per quelli vecchi modificati più tardi.
- **Registrazione dal telefono**: l'indicatore del microfono ora si muove anche su iPhone.

Da fare a mano (consigliato): Firebase → Authentication → Impostazioni → **Azioni utente** → togli
**Abilita creazione (registrazione)**. Ora che il Worker crea gli account, nessuno può più registrarsi da solo
(oggi un estraneo potrebbe creare un account e leggere le istruzioni di pagamento dello studio).

Limiti noti, accettati:
- I link di ascolto/download valgono 3 ore: chi li riceve può usarli in quel tempo.
- Chi conosce l'indirizzo `/health` del Worker vede solo lo spazio Drive usato.
- Un artista potrebbe caricare molte demo (100 MB ciascuna): tieni d'occhio lo spazio Drive nel pannello Musica.
- Le regole di sicurezza sono state riviste sul codice; un test automatico con l'emulatore Firebase si può fare con Claude Code.

### Regole di sicurezza: correzioni e test automatici

Corretto nelle regole (si pubblicano con `npm run deploy`):
- **Impostazioni dello studio** (IBAN, PayPal): le leggono solo lo studio e gli artisti attivi, non più qualsiasi account.
- **Artista disattivato**: non vede più i brani in feat né le impostazioni, anche se è rimasto nell'elenco del feat.
- **Note, demo, task, "Ho pagato"**: l'app accetta solo testi della lunghezza giusta e la data del momento
  (prima si poteva scrivere una data nel futuro e far arrivare notifiche ogni 5 minuti).

Dopo il deploy ogni artista deve solo riaprire l'app una volta: l'app salva in automatico a quale artista appartiene.
Chi ha l'app già aperta in quel momento potrebbe non vedere l'IBAN finché non la ricarica.

Ancora da fare: un artista esperto, con gli strumenti per sviluppatori, può ancora vedere se una sua demo è "Scartata" e le stelle.

## Test delle regole

Sono test automatici che provano a "forzare" il database come farebbe un artista curioso o un estraneo
(leggere i dati di un altro artista, segnare pagato un pagamento, ecc.) e controllano che le regole dicano di no.
Girano su un database finto sul tuo computer: non toccano i dati veri.

**Cosa ti serve (una volta sola)**
- **Java** (es. Temurin: `brew install --cask temurin`). Per controllare: `java -version`.
- **firebase-tools** (già installato nella sezione 5).
- Le librerie dei test: nel Terminale, nella cartella del progetto, `cd tests/firestore-rules && npm install && cd ../..`

**Eseguirli** – sempre dalla **cartella principale del progetto** (non da `tests/firestore-rules`: da lì l'emulatore
rifiuta il file delle regole):
```
npx firebase emulators:exec --only firestore --project demo-emotion "cd tests/firestore-rules && npx vitest run"
```

**Come leggere il risultato** – deve finire con `Tests  114 passed | 1 expected fail`. "Expected fail" è il punto ancora
da fare (le demo "Scartata"), è normale. Se compare una riga con `×` o `failed`, una regola non protegge più qualcosa:
non pubblicare con `npm run deploy` finché non è sistemata.

Eseguili ogni volta che cambi `firestore.rules`, prima di `npm run deploy`.

## Cosa arriva nelle prossime fasi

- Idee future: riepilogo email per lo studio, promemoria sessione il giorno prima

---

### Note tecniche (per chi ti aiuta)

- React 18 + Vite 6 + TypeScript, Firebase JS SDK 12 (Auth email/password + Firestore), wavesurfer.js 7.
- Backend: un solo Cloudflare Worker (`worker/worker.js`) che verifica il token Firebase, legge Firestore con il token dell'utente (quindi valgono le regole) e fa da proxy verso Drive (scope `drive.file`) con URL firmati HMAC validi 3 ore e supporto Range.
- Upload: sessione resumable aperta dal Worker, il browser invia il file direttamente a Google; se il browser lo blocca, ripiego tramite il Worker (max 90 MB).
- Forma d'onda calcolata nel browser dell'admin al caricamento (1000 picchi) e salvata nella versione: il player non scarica l'audio per disegnarla.
- Gli account artista vengono creati dal browser dell'admin tramite una seconda istanza Firebase (`src/lib/admin.ts`), così l'admin resta loggato. Più avanti (Fase F) la creazione passerà al Worker con service account, per poter disattivare la registrazione dal client.
- Ruoli: admin = documento in `admins/{uid}`; artista = `uid` in `artists.memberUids` con `active == true` (pronto per i duo).
- Foto profilo: compressa nel browser (max 720 px, WebP) e salvata come data URL nel documento artista. Si può spostare su Drive in una fase successiva.
- Comandi: `npm run dev`, `npm run build`, `npm run deploy` (build + `firebase deploy`).
