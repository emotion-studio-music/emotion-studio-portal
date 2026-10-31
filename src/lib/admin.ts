import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { createUserOnServer, updateUserOnServer } from './worker';
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

export function setArtistActive(id: string, active: boolean) {
  return updateDoc(doc(db, 'artists', id), { active, updatedAt: serverTimestamp() });
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
