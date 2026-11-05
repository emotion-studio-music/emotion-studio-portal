import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { setCollaborators, type Track } from './music';
import { auth, db, firebaseConfig } from './firebase';
import { createUserOnServer, deleteUserOnServer, trashArtistFolder, updateUserOnServer, workerConfigured } from './worker';
import { toLoginEmail } from './username';
import type { Artist } from './types';

export type ArtistInput = Omit<Artist, 'id' | 'memberUids' | 'memberEmails' | 'active' | 'driveFolderId' | 'createdMs'>;

/**
 * Crea l'account dell'artista (email + password) e il suo profilo.
 * Usa una seconda istanza di Firebase, così l'admin resta collegato.
 */
async function createAccount(email: string, password: string): Promise<string> {
  // 1) dal Worker, se ha il service account (così la registrazione dall'esterno può restare chiusa)
  try {
    const uid = await createUserOnServer(email, password);
    if (uid) return uid;
  } catch (e) {
    if ((e as Error).message?.includes('Esiste già')) throw e;
  }
  // 2) altrimenti dal browser, con una seconda istanza di Firebase (l'admin resta collegato)
  const secondary = initializeApp(firebaseConfig, `crea-artista-${Date.now()}`);
  try {
    const secAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    await signOut(secAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}

/** username: nome utente scelto dallo studio (oppure un'email vera, se preferisci). */
export async function createArtist(username: string, password: string, data: ArtistInput, privateNotes: string) {
  const cleanEmail = toLoginEmail(username);
  const uid = await createAccount(cleanEmail, password);
  const ref = await addDoc(collection(db, 'artists'), {
    ...data,
    memberUids: [uid],
    memberEmails: [cleanEmail],
    active: true,
    driveFolderId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'artists', ref.id, 'private', 'admin'), { notes: privateNotes });
  return ref.id;
}

export function updateArtist(id: string, data: Partial<ArtistInput>) {
  return updateDoc(doc(db, 'artists', id), { ...data, updatedAt: serverTimestamp() });
}

/**
 * Attiva/disattiva un artista. Disattivandolo lo togliamo anche dai brani di altri artisti in cui era in feat,
 * così non può più leggerli in nessun modo.
 */
export async function setArtistActive(id: string, active: boolean) {
  await updateDoc(doc(db, 'artists', id), { active, updatedAt: serverTimestamp() });
  if (active) return;
  const a = await getDoc(doc(db, 'artists', id));
  const uids = (a.data()?.memberUids as string[] | undefined) ?? [];
  for (const uid of uids) {
    const shared = await getDocs(query(collectionGroup(db, 'tracks'), where('collaboratorUids', 'array-contains', uid)));
    for (const t of shared.docs) {
      const ownerId = t.ref.parent.parent?.id;
      if (!ownerId) continue;
      const owner = await getDoc(doc(db, 'artists', ownerId));
      const track = { ...t.data(), id: t.id, projectId: t.data().projectId } as unknown as Track;
      await setCollaborators(ownerId, (owner.data()?.stageName as string) ?? '', track,
        ((t.data().collaboratorIds as string[] | undefined) ?? []).filter((x) => x !== id));
    }
  }
}

const ARTIST_DATA = ['projects', 'tracks', 'versions', 'comments', 'demos', 'quotes', 'payments', 'tasks', 'sessions', 'private'];

/**
 * Elimina per sempre un artista: lo toglie dai feat degli altri, cancella tutti i suoi dati nell'app
 * e il suo account. Con withDrive la sua cartella su Drive va nel Cestino (si svuota da sola dopo 30 giorni).
 * Ritorna gli avvisi per le parti non riuscite (i dati nell'app vengono comunque eliminati).
 */
export async function deleteArtist(id: string, withDrive: boolean): Promise<string[]> {
  const warnings: string[] = [];
  const a = await getDoc(doc(db, 'artists', id));
  const uids = (a.data()?.memberUids as string[] | undefined) ?? [];
  await setArtistActive(id, false); // via dai feat sui brani degli altri artisti
  if (withDrive) {
    try { await trashArtistFolder(id); } catch (e) { warnings.push(`Cartella su Drive non eliminata: ${(e as Error).message}`); }
  }
  for (const name of ARTIST_DATA) {
    const docs = (await getDocs(collection(db, 'artists', id, name))).docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'artists', id));
  for (const uid of uids) {
    if (!workerConfigured) { warnings.push('Account non eliminato: il Worker non è collegato.'); break; }
    try { await deleteUserOnServer(uid); } catch (e) { warnings.push(`Account non eliminato: ${(e as Error).message}`); }
  }
  return warnings;
}

export function savePrivateNotes(id: string, notes: string) {
  return setDoc(doc(db, 'artists', id, 'private', 'admin'), { notes }, { merge: true });
}

export function sendReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/[^\d]/g, '');
  const num = digits.length === 10 && digits.startsWith('3') ? `39${digits}` : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export function credentialsMessage(stageName: string, username: string, password: string, appUrl: string) {
  return `Ciao ${stageName}! Benvenuto in Emotion Studio 🎧\n` +
    `Da oggi trovi brani, progressi, demo e sessioni nella tua area riservata:\n${appUrl}\n\n` +
    `Nome utente: ${username}\nPassword: ${password}\n\n` +
    `Conserva questo messaggio. Nel Profilo trovi come installare l'app sul telefono.`;
}

/** Nuova password generata dallo studio (serve il service account nel Worker). */
export async function resetArtistPassword(uid: string, password: string) {
  await updateUserOnServer(uid, { password });
}

/** Cambia il nome utente: aggiorna l'account e il profilo dell'artista. */
export async function changeUsername(artistId: string, uid: string, username: string) {
  const email = toLoginEmail(username);
  await updateUserOnServer(uid, { email });
  await updateDoc(doc(db, 'artists', artistId), { memberEmails: [email], updatedAt: serverTimestamp() });
  return email;
}
