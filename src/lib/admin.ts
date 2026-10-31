import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { createUserOnServer } from './worker';
import type { Artist } from './types';

export type ArtistInput = Omit<Artist, 'id' | 'memberUids' | 'memberEmails' | 'active' | 'driveFolderId'>;

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

export async function createArtist(email: string, password: string, data: ArtistInput, privateNotes: string) {
  const cleanEmail = email.trim().toLowerCase();
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

export function credentialsMessage(stageName: string, email: string, password: string, appUrl: string) {
  return `Ciao ${stageName}! Benvenuto in Emotion Studio 🎧\n` +
    `Da oggi trovi brani, progressi e sessioni nella tua area riservata:\n${appUrl}\n\n` +
    `Email: ${email}\nPassword: ${password}\n\n` +
    `Al primo accesso puoi cambiarla dal tuo Profilo. Dal profilo trovi anche come installare l'app sul telefono.`;
}
