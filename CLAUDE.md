# Emotion Studio · area artisti — guida per Claude

Web app privata dello studio di registrazione Emotion Studio. Due ruoli: **admin** (lo studio, Riccardo) e **artista**.
Gli artisti vedono brani, versioni MP3, percorso del brano, demo, sessioni, pagamenti, traguardi. Tutta la UI è in **italiano**.
Il proprietario non è uno sviluppatore: `README.md` è la sua guida passo-passo (una sezione per fase A → G2b + revisioni).

## Comandi

- `npm install` · `npm run dev` (http://localhost:5173)
- `npm run build` → `tsc -b && vite build` (controllo dei tipi; non c'è linter)
- Test delle regole Firestore (emulatore, serve Java), **dalla radice** (l'emulatore rifiuta regole fuori dalla cartella del progetto):
  `npx firebase emulators:exec --only firestore --project demo-emotion "cd tests/firestore-rules && npx vitest run"`.
  Ogni modifica a `firestore.rules` va verificata così; aggiungere i test in `tests/firestore-rules/rules.test.js`.
- `npm run check:i18n` → segnala le frasi passate a `t()` senza traduzione in `src/lib/en.ts`.
- `npm run deploy` → build + `firebase deploy` (pubblica insieme **hosting, `firestore.rules` e `firestore.indexes.json`**). Progetto Firebase: `emotion-studio`.
- Il **Worker non ha wrangler**: si aggiorna copiando a mano `worker/worker.js` nell'editor di Cloudflare (`emotion-api`) → Deploy.
  Se modifichi il Worker, dillo esplicitamente all'utente.

## Stack

React 18 + Vite 6 + TypeScript strict (`noUnusedLocals/Parameters`), react-router-dom 7, Firebase JS SDK 12 (Auth email/password + Firestore, regione europe-west8), wavesurfer.js 7. Nessuna libreria UI: CSS a mano in `src/styles/global.css` (design system "Notturno", tema scuro, variabili `--accent` arancio `#F16D2F`, `--amber`, ecc.). PWA: `public/manifest.webmanifest` + `public/sw.js` (cache solo della shell, gestisce le push). Piano gratuito Firebase Spark: **minimizzare le letture** (query mirate, niente listener inutili).

## Struttura

- `src/App.tsx` — `Gate`: login → ruolo → rotte admin (`/admin/...`, default `/admin/oggi`) o artista (`/`, `/progetti`, `/brano/:trackId`, `/feat/:ownerId/:trackId`, `/carica`, `/demo/:demoId`, `/sessioni`, `/pagamenti`, `/profilo`). L'artista deve accettare la privacy (`Consent`) prima di entrare. Senza `.env` mostra `Setup`.
- `src/lib/` — logica e accesso dati (hook `useX` con `onSnapshot`, funzioni create/update/delete):
  - `firebase.ts` config da `VITE_*` · `auth.tsx` `AuthProvider`/`useAuth` (ruolo, `artistId`, `privacyAccepted`)
  - `data.ts` artisti e `settings/studio` · `music.ts` progetti, brani, versioni, feat (`setCollaborators`) · `demos.ts` · `comments.ts` · `business.ts` preventivi, pagamenti, task, sessioni · `steps.ts` percorso brano · `release.ts` uscite/spotlight 30 gg · `badges.ts` traguardi · `push.ts` · `player.tsx` player globale + mini player
  - `admin.ts` creazione/disattivazione artisti, reset password, cambio nome utente
  - `worker.ts` client del Worker · `username.ts` · `money.ts` · `safeUrl.ts` · `errors.ts` (codici Firebase → messaggi italiani)
- `src/pages/` (`admin/`, `artist/`, più `TrackPage`, `DemoPage`, `Login`…) · `src/components/` (Waveform, MiniPlayer, QuoteBuilder, StepsEditor…)
- `worker/worker.js` — Cloudflare Worker unico, JS puro senza dipendenze.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json` (hosting SPA + header di sicurezza).

## Modello dati (Firestore)

- `admins/{uid}` — admin = esiste il documento (creato a mano). `users/{uid}` (privacy) e `users/{uid}/push/{id}` (iscrizioni push).
- `settings/studio` (IBAN, PayPal, testi, `stepTemplate`, `services`, `priceStep`), `settings/drive`, `system/notify` (`lastRun` del cron).
- `artists/{id}`: profilo, `memberUids[]` (account che lo rappresentano, pronto per i duo), `memberEmails`, `active`, `driveFolderId`, foto come data URL WebP.
  Sottoraccolte: `private/admin` (note solo admin), `projects`, `tracks`, `versions`, `comments`, `demos`, `quotes`, `payments`, `tasks`, `sessions`.
- Artista = uid in `memberUids` di un artista con `active == true`. `users/{uid}.artistId` (scritto da `auth.tsx` al login) dice alle regole a quale artista appartiene l'utente: `isActiveArtistUser()` lo verifica e serve per `settings/*` e per i feat.
- Date di creazione/segnalazione scritte dall'artista (`createdAt`, `reportedAt`, `doneAt`, `resolvedAt`) devono essere `serverTimestamp()`: le regole accettano solo `request.time`.
- **Feat**: il brano vive solo sotto l'artista principale; `collaboratorUids` è **denormalizzato** su track, sue versions, suoi comments e sul project. Va sempre aggiornato con `setCollaborators` (anche quando un artista viene disattivato).
- Note sulle demo: `comments` con `trackId = "demo:<demoId>"`.
- Importi in **centesimi** (`amountCents`, `parseEuro`/`eur`); date "giorno" come stringhe `YYYY-MM-DD`; sessioni `YYYY-MM-DDTHH:mm` ora di Roma.
- Stati: pagamenti `da_pagare → segnalato → pagato`; demo `nuova | ascoltata | selezionata | scartata` (l'artista non vede mai "scartata").
- Eliminando brano/versione/demo vanno eliminate anche le sue note (batch), altrimenti restano in "Oggi".

## Auth

Gli artisti entrano con **nome utente**: diventa l'email fittizia `nome@artisti.efamusic.it` (`username.ts`); se il login contiene `@` resta un'email vera (admin). Account creati dal Worker con service account (`/admin/create-user`); fallback da browser con seconda istanza Firebase (`admin.ts`). Gli artisti non cambiano la password da soli.

## Worker (`emotion-api`)

- Verifica l'ID token Firebase (JWKS) e **legge Firestore con il token dell'utente**, quindi le regole valgono anche lì. `requireAdmin` = lettura di `admins/{uid}`.
- Drive (account studio, OAuth refresh token, scope `drive.file`): cartelle `Emotion Studio – App / Artista / Progetto / Versioni` e `/Demo`, ritrovate via `appProperties` (`emotionRoot`, `emotionArtist`, `emotionDemos`, `emotionDemoOf`).
- Streaming: `/media/token` → URL `/media/{fileId}` firmato HMAC (`SIGNING_KEY`), valido 3 ore, con Range (iPhone).
- Upload resumable: il Worker apre la sessione, il browser carica diretto su Google; fallback via `*/upload-proxy` (max 90 MB). Demo max 100 MB, solo audio/video.
- Calendario: legge l'iCal segreto (`CALENDAR_ICS_URL`), associa eventi all'artista se il **titolo contiene il nome d'arte**; cache 5 min.
- Push: Web Push/VAPID implementato a mano (RFC 8291). `scheduled` (cron `*/5 * * * *`) → `notifyRun` legge le novità con il service account da `system/notify.lastRun`, max ~12 invii per giro. Endpoint push solo verso servizi noti (`isPushService`).
- Env: `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS` (CORS), `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, `SIGNING_KEY`, `FIREBASE_SA_JSON`, `CALENDAR_ICS_URL`, `VAPID_PUBLIC_KEY/PRIVATE_KEY`.
- Frontend `.env` (vedi `.env.example`): `VITE_FIREBASE_*`, `VITE_WORKER_URL`, `VITE_VAPID_PUBLIC_KEY`.

## Regole importanti

- **Sicurezza nelle `firestore.rules`**, non nel client: l'artista legge solo i propri dati; scrive solo campi precisi (note proprie, demo nuove, "Ho pagato", spunta task) con `onlyChanges([...])`/`keys().hasOnly(...)`. Ogni nuovo campo scritto dall'artista va aggiunto alle regole; ogni nuova query (soprattutto `collectionGroup`) può richiedere un indice in `firestore.indexes.json` e una regola `match /{path=**}/...`.
- Link inseriti dagli utenti (social, store, pagamento) passano da `safeUrl`/`safeLinks` (solo http/https).
- Mai segreti nel repo o in chat: `.env`, `service-account*.json` sono in `.gitignore`. La chiave VAPID privata sta solo nel Worker.
- **Lingua**: l'admin vede sempre l'italiano; un artista vede la lingua del suo profilo (`artists.language`: `it` | `en`, impostata da `auth.tsx` con `setLang`). Ogni testo che può vedere un artista (pagine `artist/`, `TrackPage`, `DemoPage`, `Login`, `Consent`, `NoAccess` e i componenti che usano) va scritto in italiano dentro `t('…')` da `src/lib/i18n.ts`, con `{variabili}` per i valori, e la traduzione va aggiunta in `src/lib/en.ts`; poi `npm run check:i18n`. Date con `locale()`/`dates.ts`, importi con `eur()`. Non chiamare `t` una variabile locale (es. `tracks.map((t) => …)`): nasconde la funzione. Le notifiche del Worker hanno i testi in entrambe le lingue (`langOfArtist`).
- Testi UI, messaggi d'errore e commenti nel codice in **italiano**, tono semplice e amichevole. Mantenere lo stile esistente: moduli piccoli, commenti brevi in italiano, niente nuove dipendenze senza motivo.
- Attenzione a iPhone/Safari (autoplay bloccato, zoom sugli input, push solo da app installata iOS ≥ 16.4).
- Quando una modifica richiede passi manuali (deploy Worker, nuove variabili, cron, console Firebase/Google), aggiornare `README.md` con istruzioni per non sviluppatori, nello stile delle sezioni esistenti.
- Commit: messaggi brevi in italiano a nome della fase (es. "Fase G2b", "Revisione sicurezza"); si lavora su `main`.
