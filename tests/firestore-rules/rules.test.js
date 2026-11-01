// Test delle regole Firestore di Emotion Studio (emulatore).
// Esecuzione (dalla radice del progetto: l'emulatore vuole le regole dentro la cartella del progetto):
//   npx firebase emulators:exec --only firestore --project demo-emotion "cd tests/firestore-rules && npx vitest run"
// Richiede Java (>= 11) e firebase-tools.
//
// I test "Problemi corretti" sono i 9 problemi trovati nella revisione del 1 novembre 2026:
// devono passare. "Ancora aperto" usa it.fails: passa finché il problema resta (P8).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// Orario del server: le regole accettano solo questo per createdAt, reportedAt, doneAt, resolvedAt.
const NOW = () => firebase.firestore.FieldValue.serverTimestamp();

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT = 'demo-emotion';

// Utenti
const ADMIN = 'uAdmin';
const uA = 'uA';      // membro dell'artista A (attivo)
const uB = 'uB';      // membro dell'artista B (attivo)
const uC = 'uC';      // membro dell'artista C, in feat sul brano tFeat di A
const uD = 'uD';      // membro dell'artista D DISATTIVATO, rimasto in feat su tFeatD di A
const uX = 'uX';      // utente autenticato estraneo (nessun artista)

let env;

const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const A = (path) => `artists/A/${path}`;

const goodNote = (over = {}) => ({
  trackId: 'tFeat', versionId: 'vFeat', authorUid: uC, authorRole: 'artist', authorName: 'C',
  text: 'Bella!', atSeconds: 12, resolved: false, collaboratorUids: [uC], createdAt: NOW(), ...over,
});
const goodDemo = (over = {}) => ({
  title: 'Idea', note: '', fileId: 'f1', fileName: 'idea.m4a', mimeType: 'audio/mp4', size: 1000, peaks: [],
  duration: 30, source: 'file', uploadedBy: uA, status: 'nuova', rating: 0, seenByAdmin: false, createdAt: NOW(), ...over,
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    const set = (p, d) => f.doc(p).set(d);
    await set(`admins/${ADMIN}`, { note: 'studio' });
    await set('settings/studio', { iban: 'IT00X0000000000000000000000', paypal: 'studio@example.com' });
    await set('settings/drive', { rootFolderId: 'root123' });
    await set('system/notify', { lastRun: 1 });
    // users/{uid}.artistId lo scrive l'app al login (uX è estraneo: nessun artista)
    const artistOf = { [uA]: 'A', [uB]: 'B', [uC]: 'C', [uD]: 'D' };
    for (const u of [uA, uB, uC, uD, uX]) {
      await set(`users/${u}`, { privacyAcceptedAt: new Date(), ...(artistOf[u] ? { artistId: artistOf[u] } : {}) });
      await set(`users/${u}/push/dev1`, { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'k', auth: 'a' });
    }
    await set('artists/A', { stageName: 'A', memberUids: [uA], memberEmails: ['a@x'], active: true });
    await set('artists/B', { stageName: 'B', memberUids: [uB], memberEmails: ['b@x'], active: true });
    await set('artists/C', { stageName: 'C', memberUids: [uC], memberEmails: ['c@x'], active: true });
    await set('artists/D', { stageName: 'D', memberUids: [uD], memberEmails: ['d@x'], active: false });
    await set('artists/D/tracks/tD', { title: 'Brano di D', collaboratorUids: [] });

    // Artista A
    await set(A('private/admin'), { note: 'solo studio' });
    await set(A('projects/pFeat'), { title: 'EP', collaboratorUids: [uC, uD] });
    await set(A('projects/pSolo'), { title: 'Solo', collaboratorUids: [] });
    await set(A('tracks/tFeat'), { title: 'Feat', projectId: 'pFeat', collaboratorUids: [uC] });
    await set(A('tracks/tFeatD'), { title: 'Feat D', projectId: 'pFeat', collaboratorUids: [uD] });
    await set(A('tracks/tSolo'), { title: 'Solo', projectId: 'pSolo', collaboratorUids: [] });
    await set(A('versions/vFeat'), { trackId: 'tFeat', mp3FileId: 'm1', collaboratorUids: [uC] });
    await set(A('versions/vSolo'), { trackId: 'tSolo', mp3FileId: 'm2', collaboratorUids: [] });
    await set(A('comments/cFeatAdmin'), { trackId: 'tFeat', authorUid: ADMIN, authorRole: 'admin', text: 'ok', resolved: false, collaboratorUids: [uC] });
    await set(A('comments/cFeatA'), { trackId: 'tFeat', authorUid: uA, authorRole: 'artist', text: 'mia', resolved: false, collaboratorUids: [uC] });
    await set(A('comments/cFeatC'), { trackId: 'tFeat', authorUid: uC, authorRole: 'artist', text: 'di C', resolved: false, collaboratorUids: [uC] });
    await set(A('comments/cSolo'), { trackId: 'tSolo', authorUid: uA, authorRole: 'artist', text: 'solo', resolved: false, collaboratorUids: [] });
    await set(A('demos/dNew'), goodDemo());
    await set(A('demos/dHeard'), goodDemo({ status: 'ascoltata', seenByAdmin: true, rating: 3 }));
    await set(A('demos/dScartata'), goodDemo({ status: 'scartata', seenByAdmin: true, rating: 1 }));
    await set(A('quotes/q1'), { title: 'Prev', totalCents: 50000 });
    await set(A('payments/pay1'), { status: 'da_pagare', amountCents: 10000 });
    await set(A('payments/pay2'), { status: 'segnalato', amountCents: 5000 });
    await set(A('tasks/kArtist'), { title: 'Testi', assignee: 'artist', done: false });
    await set(A('tasks/kAdmin'), { title: 'Mix', assignee: 'admin', done: false });
    await set(A('sessions/s1'), { start: '2026-11-02T10:00' });

    // Artista B
    await set('artists/B/private/admin', { note: 'x' });
    await set('artists/B/projects/pB', { title: 'B', collaboratorUids: [] });
    await set('artists/B/tracks/tB', { title: 'B', collaboratorUids: [] });
    await set('artists/B/versions/vB', { trackId: 'tB', collaboratorUids: [] });
    await set('artists/B/comments/cB', { trackId: 'tB', authorUid: uB, authorRole: 'artist', text: 'b', resolved: false, collaboratorUids: [] });
    await set('artists/B/demos/dB', goodDemo({ uploadedBy: uB }));
    await set('artists/B/quotes/qB', { totalCents: 1 });
    await set('artists/B/payments/payB', { status: 'da_pagare', amountCents: 1 });
    await set('artists/B/tasks/kB', { assignee: 'artist', done: false });
    await set('artists/B/sessions/sB', { start: '2026-11-02T10:00' });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(resolve(here, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

const SUBS = ['projects', 'tracks', 'versions', 'comments', 'demos', 'quotes', 'payments', 'tasks', 'sessions'];
const B_DOC = { projects: 'pB', tracks: 'tB', versions: 'vB', comments: 'cB', demos: 'dB', quotes: 'qB', payments: 'payB', tasks: 'kB', sessions: 'sB' };

// ─────────────────────────────────────────────────────────────
describe('Artista A verso i dati di B', () => {
  it('non legge il profilo di B', () => assertFails(db(uA).doc('artists/B').get()));
  it('non legge private/admin di B (né il proprio)', async () => {
    await assertFails(db(uA).doc('artists/B/private/admin').get());
    await assertFails(db(uA).doc(A('private/admin')).get());
  });
  for (const s of SUBS) {
    it(`non legge ${s} di B (doc e lista)`, async () => {
      await assertFails(db(uA).doc(`artists/B/${s}/${B_DOC[s]}`).get());
      await assertFails(db(uA).collection(`artists/B/${s}`).get());
    });
    it(`non scrive ${s} di B`, async () => {
      await assertFails(db(uA).doc(`artists/B/${s}/${B_DOC[s]}`).update({ x: 1 }));
      await assertFails(db(uA).doc(`artists/B/${s}/nuovo`).set({ x: 1 }));
      await assertFails(db(uA).doc(`artists/B/${s}/${B_DOC[s]}`).delete());
    });
  }
  it('non crea note su B, né demo su B', async () => {
    await assertFails(db(uA).collection('artists/B/comments').add(goodNote({ trackId: 'tB', authorUid: uA, collaboratorUids: [] })));
    await assertFails(db(uA).collection('artists/B/demos').add(goodDemo()));
  });
  it('non può segnare pagato un pagamento di B', () =>
    assertFails(db(uA).doc('artists/B/payments/payB').update({ status: 'segnalato', reportedMethod: 'bonifico', reportedAt: NOW() })));
  for (const g of ['tracks', 'comments', 'demos', 'payments', 'tasks', 'quotes', 'versions', 'sessions', 'projects']) {
    it(`collectionGroup ${g} senza filtro: negata`, () => assertFails(db(uA).collectionGroup(g).get()));
  }
  it('collectionGroup tracks filtrata sul proprio uid: consentita (feat)', () =>
    assertSucceeds(db(uA).collectionGroup('tracks').where('collaboratorUids', 'array-contains', uA).get()));
  it('collectionGroup tracks filtrata su uid altrui: negata', () =>
    assertFails(db(uA).collectionGroup('tracks').where('collaboratorUids', 'array-contains', uC).get()));
  it('A legge invece tutti i propri dati', async () => {
    await assertSucceeds(db(uA).doc('artists/A').get());
    for (const s of SUBS) await assertSucceeds(db(uA).collection(A(s)).get());
  });
});

// ─────────────────────────────────────────────────────────────
describe('Collaboratore in feat (uC su tFeat di A)', () => {
  const c = () => db(uC);
  it('legge brano, versione, progetto in feat', async () => {
    await assertSucceeds(c().doc(A('tracks/tFeat')).get());
    await assertSucceeds(c().doc(A('versions/vFeat')).get());
    await assertSucceeds(c().doc(A('projects/pFeat')).get());
  });
  it('legge le note del brano con query filtrata', () =>
    assertSucceeds(c().collection(A('comments')).where('trackId', '==', 'tFeat').where('collaboratorUids', 'array-contains', uC).get()));
  it('query note senza filtro collaboratorUids: negata', () =>
    assertFails(c().collection(A('comments')).where('trackId', '==', 'tFeat').get()));
  it('NON legge profilo A, altri brani, versioni di altri brani, progetto solo, note altrui', async () => {
    await assertFails(c().doc('artists/A').get());
    await assertFails(c().doc(A('tracks/tSolo')).get());
    await assertFails(c().doc(A('versions/vSolo')).get());
    await assertFails(c().doc(A('projects/pSolo')).get());
    await assertFails(c().doc(A('comments/cSolo')).get());
    await assertFails(c().collection(A('tracks')).get());
    await assertFails(c().collection(A('versions')).get());
  });
  for (const s of ['payments', 'demos', 'quotes', 'tasks', 'sessions']) {
    it(`NON legge ${s} di A`, () => assertFails(c().collection(A(s)).get()));
  }
  it('NON legge private/admin di A', () => assertFails(c().doc(A('private/admin')).get()));

  it('crea una nota valida sul brano in feat', () => assertSucceeds(c().collection(A('comments')).add(goodNote())));
  it('nota con collaboratorUids falsificato: negata', async () => {
    await assertFails(c().collection(A('comments')).add(goodNote({ collaboratorUids: [uC, uB] })));
    await assertFails(c().collection(A('comments')).add(goodNote({ collaboratorUids: [] })));
  });
  it('nota con authorRole admin / authorUid altrui / resolved true: negata', async () => {
    await assertFails(c().collection(A('comments')).add(goodNote({ authorRole: 'admin' })));
    await assertFails(c().collection(A('comments')).add(goodNote({ authorUid: uA })));
    await assertFails(c().collection(A('comments')).add(goodNote({ resolved: true })));
  });
  it('nota con testo vuoto o > 2000: negata', async () => {
    await assertFails(c().collection(A('comments')).add(goodNote({ text: '' })));
    await assertFails(c().collection(A('comments')).add(goodNote({ text: 'x'.repeat(2001) })));
  });
  it("nota con trackId contenente '/': negata", () =>
    assertFails(c().collection(A('comments')).add(goodNote({ trackId: 'tFeat/../tSolo' }))));
  it('nota su brano non in feat / inesistente: negata', async () => {
    await assertFails(c().collection(A('comments')).add(goodNote({ trackId: 'tSolo', collaboratorUids: [] })));
    await assertFails(c().collection(A('comments')).add(goodNote({ trackId: 'nonEsiste', collaboratorUids: [] })));
  });
  it('modifica testo della propria nota: ok; di note altrui: no', async () => {
    await assertSucceeds(c().doc(A('comments/cFeatC')).update({ text: 'corretto', editedAt: NOW() }));
    await assertFails(c().doc(A('comments/cFeatA')).update({ text: 'hack' }));
    await assertFails(c().doc(A('comments/cFeatAdmin')).update({ text: 'hack' }));
  });
  it('su note altrui può cambiare solo resolved*', async () => {
    await assertSucceeds(c().doc(A('comments/cFeatAdmin')).update({ resolved: true, resolvedBy: uC, resolvedAt: NOW() }));
    await assertFails(c().doc(A('comments/cFeatA')).update({ resolved: true, authorRole: 'admin' }));
    await assertFails(c().doc(A('comments/cFeatA')).update({ collaboratorUids: [uC, uB] }));
  });
  it('cancella solo le proprie note', async () => {
    await assertSucceeds(c().doc(A('comments/cFeatC')).delete());
    await assertFails(c().doc(A('comments/cFeatA')).delete());
    await assertFails(c().doc(A('comments/cSolo')).delete());
  });
  it('non può modificare brano o versione in feat', async () => {
    await assertFails(c().doc(A('tracks/tFeat')).update({ title: 'x' }));
    await assertFails(c().doc(A('tracks/tFeat')).update({ collaboratorUids: [uC, uB] }));
    await assertFails(c().doc(A('versions/vFeat')).update({ downloadEnabled: true }));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Membro A e note: falsificazioni', () => {
  it('nota con collaboratorUids inventato: negata', () =>
    assertFails(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA, trackId: 'tSolo', collaboratorUids: [uB] }))));
  it('nota con collaboratorUids copiato correttamente: ok', () =>
    assertSucceeds(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA }))));
  it('nota senza collaboratori (anche su demo): ok', () =>
    assertSucceeds(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA, trackId: 'demo:dNew', collaboratorUids: [] }))));
  it('nota authorRole admin / resolved true / atSeconds stringa: negata', async () => {
    await assertFails(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA, authorRole: 'admin', collaboratorUids: [] })));
    await assertFails(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA, resolved: true, collaboratorUids: [] })));
    await assertFails(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA, atSeconds: 'x', collaboratorUids: [] })));
  });
  it('non modifica il testo di note dello studio', () =>
    assertFails(db(uA).doc(A('comments/cFeatAdmin')).update({ text: 'x' })));
  it('non cancella note dello studio', () => assertFails(db(uA).doc(A('comments/cFeatAdmin')).delete()));
});

// ─────────────────────────────────────────────────────────────
describe('Utente estraneo (uX) e non autenticato', () => {
  it('non autenticato: non legge settings, artists, users, admins', async () => {
    await assertFails(db(null).doc('settings/studio').get());
    await assertFails(db(null).doc('artists/A').get());
    await assertFails(db(null).doc(`users/${uA}`).get());
    await assertFails(db(null).doc(`admins/${ADMIN}`).get());
    await assertFails(db(null).collection('artists').get());
  });
  it('estraneo: non legge artists (doc e lista), users altrui, push altrui, admins', async () => {
    await assertFails(db(uX).doc('artists/A').get());
    await assertFails(db(uX).collection('artists').get());
    await assertFails(db(uX).collection('artists').where('memberUids', 'array-contains', uA).get());
    await assertFails(db(uX).doc(`users/${uA}`).get());
    await assertFails(db(uX).doc(`users/${uA}/push/dev1`).get());
    await assertFails(db(uX).doc(`users/${uA}/push/dev1`).set({ endpoint: 'https://evil' }));
    await assertFails(db(uX).doc(`admins/${ADMIN}`).get());
    await assertFails(db(uX).collection('admins').get());
  });
  it('estraneo: query artisti filtrata sul proprio uid restituisce 0 ma è permessa', () =>
    assertSucceeds(db(uX).collection('artists').where('memberUids', 'array-contains', uX).where('active', '==', true).get()));
  it('estraneo: gestisce solo users/{proprio}', async () => {
    await assertSucceeds(db(uX).doc(`users/${uX}`).set({ privacyAcceptedAt: new Date() }));
    await assertSucceeds(db(uX).doc(`users/${uX}/push/d2`).set({ endpoint: 'https://fcm.googleapis.com/y', p256dh: 'k', auth: 'a', device: 'x', createdAt: NOW() }));
  });
  it('estraneo: non scrive system/notify né settings', async () => {
    await assertFails(db(uX).doc('system/notify').set({ lastRun: 0 }));
    await assertFails(db(uX).doc('system/notify').get());
    await assertFails(db(uX).doc('settings/studio').set({ iban: 'IT99' }));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Artista disattivato (uD, artists/D active=false)', () => {
  it('non legge il proprio profilo né le sottoraccolte', async () => {
    await assertFails(db(uD).doc('artists/D').get());
    await assertFails(db(uD).doc('artists/D/tracks/tD').get());
    await assertFails(db(uD).collection('artists/D/tracks').get());
  });
  it('non crea demo né note sul proprio artista', async () => {
    await assertFails(db(uD).collection('artists/D/demos').add(goodDemo({ uploadedBy: uD })));
    await assertFails(db(uD).collection('artists/D/comments').add(goodNote({ authorUid: uD, trackId: 'tD', collaboratorUids: [] })));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Escalation di privilegi (artista A)', () => {
  const a = () => db(uA);
  it('non crea admins/{proprio uid}', () => assertFails(a().doc(`admins/${uA}`).set({ x: true })));
  it('non modifica il proprio artista (memberUids, active, altro)', async () => {
    await assertFails(a().doc('artists/A').update({ memberUids: [uA, uB] }));
    await assertFails(a().doc('artists/A').update({ active: true }));
    await assertFails(a().doc('artists/A').update({ stageName: 'Nuovo' }));
    await assertFails(a().doc('artists/E').set({ memberUids: [uA], active: true }));
  });
  it('non scrive private/admin', () => assertFails(a().doc(A('private/admin')).set({ note: 'x' })));
  it('pagamento: segnalato ok, pagato no', async () => {
    await assertFails(a().doc(A('payments/pay1')).update({ status: 'pagato', reportedMethod: 'bonifico', reportedAt: NOW() }));
    await assertSucceeds(a().doc(A('payments/pay1')).update({ status: 'segnalato', reportedMethod: 'bonifico', reportedAt: NOW() }));
  });
  it('pagamento: non cambia amountCents insieme allo status', () =>
    assertFails(a().doc(A('payments/pay1')).update({ status: 'segnalato', reportedMethod: 'bonifico', reportedAt: NOW(), amountCents: 1 })));
  it('pagamento: già segnalato non si porta a pagato; non si crea né cancella', async () => {
    await assertFails(a().doc(A('payments/pay2')).update({ status: 'pagato' }));
    await assertFails(a().collection(A('payments')).add({ status: 'pagato', amountCents: 1 }));
    await assertFails(a().doc(A('payments/pay1')).delete());
  });
  it('pagamento: reportedMethod troppo lungo: negato', () =>
    assertFails(a().doc(A('payments/pay1')).update({ status: 'segnalato', reportedMethod: 'x'.repeat(41), reportedAt: NOW() })));
  it('demo: creazione valida ok', () => assertSucceeds(a().collection(A('demos')).add(goodDemo())));
  it('demo: status selezionata / seenByAdmin true / rating 5 / uploadedBy altrui / campi extra: negata', async () => {
    await assertFails(a().collection(A('demos')).add(goodDemo({ status: 'selezionata' })));
    await assertFails(a().collection(A('demos')).add(goodDemo({ seenByAdmin: true })));
    await assertFails(a().collection(A('demos')).add(goodDemo({ rating: 5 })));
    await assertFails(a().collection(A('demos')).add(goodDemo({ uploadedBy: uB })));
    await assertFails(a().collection(A('demos')).add(goodDemo({ adminNote: 'x' })));
    await assertFails(a().collection(A('demos')).add(goodDemo({ title: 'x'.repeat(121) })));
  });
  it('demo: non modifica status/rating/seenByAdmin della propria demo', async () => {
    await assertFails(a().doc(A('demos/dNew')).update({ status: 'selezionata' }));
    await assertFails(a().doc(A('demos/dNew')).update({ rating: 5 }));
    await assertFails(a().doc(A('demos/dNew')).update({ seenByAdmin: true }));
    await assertFails(a().doc(A('demos/dNew')).update({ title: 'ok', status: 'selezionata' }));
    await assertSucceeds(a().doc(A('demos/dNew')).update({ title: 'ok', note: 'nota' }));
  });
  it('demo: non cancella demo già ascoltata; cancella la nuova', async () => {
    await assertFails(a().doc(A('demos/dHeard')).delete());
    await assertSucceeds(a().doc(A('demos/dNew')).delete());
  });
  it('task: spunta solo i propri e solo done/doneAt', async () => {
    await assertSucceeds(a().doc(A('tasks/kArtist')).update({ done: true, doneAt: NOW() }));
    await assertFails(a().doc(A('tasks/kAdmin')).update({ done: true }));
    await assertFails(a().doc(A('tasks/kArtist')).update({ title: 'altro' }));
    await assertFails(a().doc(A('tasks/kArtist')).update({ assignee: 'admin' }));
    await assertFails(a().collection(A('tasks')).add({ assignee: 'artist', done: false }));
  });
  it('non scrive system/notify', async () => {
    await assertFails(a().doc('system/notify').set({ lastRun: 0 }));
    await assertFails(a().doc('system/notify').update({ lastRun: 0 }));
  });
  it('non scrive brani, versioni, progetti, preventivi, sessioni propri', async () => {
    await assertFails(a().doc(A('tracks/tSolo')).update({ collaboratorUids: [uB] }));
    await assertFails(a().doc(A('versions/vSolo')).update({ downloadEnabled: true }));
    await assertFails(a().doc(A('projects/pSolo')).update({ coverDownload: true }));
    await assertFails(a().doc(A('quotes/q1')).update({ totalCents: 0 }));
    await assertFails(a().doc(A('sessions/s1')).delete());
  });
});

// ─────────────────────────────────────────────────────────────
describe('Admin', () => {
  const ad = () => db(ADMIN);
  it('legge e scrive tutto ciò che serve', async () => {
    await assertSucceeds(ad().doc(`admins/${ADMIN}`).get());
    await assertSucceeds(ad().collection('artists').get());
    await assertSucceeds(ad().doc('artists/A').update({ active: true }));
    await assertSucceeds(ad().doc('artists/N').set({ memberUids: [], active: true }));
    await assertSucceeds(ad().doc(A('private/admin')).set({ note: 'y' }));
    for (const s of SUBS) {
      await assertSucceeds(ad().collection(A(s)).get());
      await assertSucceeds(ad().doc(A(`${s}/nuovo`)).set({ x: 1 }));
      await assertSucceeds(ad().doc(A(`${s}/nuovo`)).delete());
    }
    await assertSucceeds(ad().doc('settings/studio').set({ iban: 'IT11' }));
    await assertSucceeds(ad().doc(`users/${uA}`).get());
  });
  for (const g of ['tracks', 'comments', 'demos', 'payments', 'tasks', 'quotes']) {
    it(`collectionGroup ${g}: consentita`, () => assertSucceeds(ad().collectionGroup(g).get()));
  }
  it('collectionGroup comments filtrata resolved==false (vista Oggi)', () =>
    assertSucceeds(ad().collectionGroup('comments').where('resolved', '==', false).get()));
  it('non può creare altri admin dal client (by design)', () => assertFails(ad().doc('admins/nuovo').set({ x: 1 })));
});

// ─────────────────────────────────────────────────────────────
// Problemi trovati nella revisione e corretti: se uno di questi fallisce, il problema è tornato.
describe('Problemi corretti (regressione)', () => {
  it('[P1] utente estraneo NON dovrebbe leggere settings/studio (IBAN, PayPal)', () =>
    assertFails(db(uX).doc('settings/studio').get()));
  it('[P1] utente estraneo NON dovrebbe leggere settings/drive', () =>
    assertFails(db(uX).doc('settings/drive').get()));
  it('[P2] artista disattivato NON dovrebbe leggere settings/studio', () =>
    assertFails(db(uD).doc('settings/studio').get()));
  it('[P3] artista disattivato ancora in collaboratorUids NON dovrebbe leggere il brano in feat', async () => {
    await assertFails(db(uD).doc(A('tracks/tFeatD')).get());
    await assertFails(db(uD).doc(A('projects/pFeat')).get());
  });
  it('[P3] artista disattivato NON dovrebbe vedere i feat via collectionGroup', () =>
    assertFails(db(uD).collectionGroup('tracks').where('collaboratorUids', 'array-contains', uD).get()));
  it('[P3] artista disattivato NON dovrebbe poter scrivere note sul brano in feat', () =>
    assertFails(db(uD).collection(A('comments')).add(goodNote({ authorUid: uD, trackId: 'tFeatD', collaboratorUids: [uD] }))));
  it('[P4] modifica nota: testo > 2000 dovrebbe essere negato', () =>
    assertFails(db(uA).doc(A('comments/cSolo')).update({ text: 'x'.repeat(5000) })));
  it('[P4] modifica nota: testo non stringa (oggetto) dovrebbe essere negato', () =>
    assertFails(db(uA).doc(A('comments/cSolo')).update({ text: { a: 1 } })));
  it('[P4] modifica nota del collaboratore: testo > 2000 dovrebbe essere negato', () =>
    assertFails(db(uC).doc(A('comments/cFeatC')).update({ text: 'x'.repeat(5000) })));
  it('[P5] resolved: il valore dovrebbe essere booleano e resolvedBy = chi lo fa', async () => {
    await assertFails(db(uA).doc(A('comments/cFeatAdmin')).update({ resolved: 'si' }));
    await assertFails(db(uA).doc(A('comments/cFeatAdmin')).update({ resolved: true, resolvedBy: ADMIN }));
  });
  it('[P6] creazione nota: campi extra arbitrari dovrebbero essere negati', () =>
    assertFails(db(uC).collection(A('comments')).add(goodNote({ authorName: 'Emotion Studio', extra: 'x'.repeat(500000) }))));
  it('[P6] creazione nota in feat: atSeconds non numerico dovrebbe essere negato', () =>
    assertFails(db(uC).collection(A('comments')).add(goodNote({ atSeconds: { x: 1 } }))));
  it('[P7] demo: modifica titolo oltre 120 o non stringa dovrebbe essere negata', async () => {
    await assertFails(db(uA).doc(A('demos/dNew')).update({ title: 'x'.repeat(5000) }));
    await assertFails(db(uA).doc(A('demos/dNew')).update({ title: { a: 1 } }));
  });
  it('[P7] demo: creazione con note/peaks enormi o di tipo errato dovrebbe essere negata', () =>
    assertFails(db(uA).collection(A('demos')).add(goodDemo({ note: { a: 1 }, peaks: 'x'.repeat(500000) }))));
  it('[P7] demo già ascoltata: titolo/nota non dovrebbero più cambiare (commento regola)', () =>
    assertFails(db(uA).doc(A('demos/dHeard')).update({ title: 'cambiato' })));
  it('[P9] task: done dovrebbe essere booleano', () =>
    assertFails(db(uA).doc(A('tasks/kArtist')).update({ done: 'boh' })));
});

// ─────────────────────────────────────────────────────────────
describe('Altri controlli aggiunti con le correzioni', () => {
  it('artista attivo e collaboratore leggono settings/studio', async () => {
    await assertSucceeds(db(uA).doc('settings/studio').get());
    await assertSucceeds(db(uC).doc('settings/drive').get());
  });
  it('artistId falsificato in users/{proprio}: non apre settings né i dati di quell\'artista', async () => {
    await assertSucceeds(db(uX).doc(`users/${uX}`).set({ artistId: 'A' }, { merge: true }));
    await assertFails(db(uX).doc('settings/studio').get());
    await assertFails(db(uX).doc('artists/A').get());
  });
  it('"Ho pagato" con una data scelta dall\'artista: negato', () =>
    assertFails(db(uA).doc(A('payments/pay1')).update({ status: 'segnalato', reportedMethod: 'bonifico', reportedAt: new Date('2100-01-01') })));
  it('demo o nota con createdAt nel futuro: negate', async () => {
    await assertFails(db(uA).collection(A('demos')).add(goodDemo({ createdAt: new Date('2100-01-01') })));
    await assertFails(db(uA).collection(A('comments')).add(goodNote({ authorUid: uA, collaboratorUids: [], createdAt: new Date('2100-01-01') })));
  });
  it('demo: source sconosciuta o fileId strano: negata', async () => {
    await assertFails(db(uA).collection(A('demos')).add(goodDemo({ source: 'altro' })));
    await assertFails(db(uA).collection(A('demos')).add(goodDemo({ fileId: '../x' })));
  });
  it('task: togliere la spunta ok; doneAt scelto dall\'artista no', async () => {
    await assertSucceeds(db(uA).doc(A('tasks/kArtist')).update({ done: false, doneAt: null }));
    await assertFails(db(uA).doc(A('tasks/kArtist')).update({ done: true, doneAt: new Date('2100-01-01') }));
  });
  it('note: riaprire una nota ok; resolvedAt scelto dall\'artista no', async () => {
    await assertSucceeds(db(uA).doc(A('comments/cFeatAdmin')).update({ resolved: true, resolvedBy: uA, resolvedAt: NOW() }));
    await assertSucceeds(db(uA).doc(A('comments/cFeatAdmin')).update({ resolved: false, resolvedBy: null, resolvedAt: null }));
    await assertFails(db(uA).doc(A('comments/cFeatAdmin')).update({ resolved: true, resolvedBy: uA, resolvedAt: new Date('2100-01-01') }));
  });
  it('iscrizione push: campi extra o indirizzo non https negati', async () => {
    await assertFails(db(uA).doc(`users/${uA}/push/d3`).set({ endpoint: 'http://fcm.googleapis.com/y', p256dh: 'k', auth: 'a' }));
    await assertFails(db(uA).doc(`users/${uA}/push/d3`).set({ endpoint: 'https://fcm.googleapis.com/y', p256dh: 'k', auth: 'a', extra: 1 }));
    await assertSucceeds(db(uA).doc(`users/${uA}/push/dev1`).delete());
  });
});

// ─────────────────────────────────────────────────────────────
// Ancora aperto: le regole non possono nascondere singoli campi. Per risolverlo stato interno e
// stelle delle demo vanno spostati in un documento solo studio (modifica al modello dati).
describe('Ancora aperto', () => {
  it.fails('[P8] artista NON dovrebbe vedere le demo "scartata" né il loro rating', () =>
    assertFails(db(uA).doc(A('demos/dScartata')).get()));
});
