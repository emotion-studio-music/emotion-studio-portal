import { useEffect, useState } from 'react';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentData, type Timestamp,
} from 'firebase/firestore';
import { trashDemoFile } from './worker';
import { db } from './firebase';
import { addVersion, createProject, createTrack, type Version } from './music';

export type DemoStatus = 'nuova' | 'ascoltata' | 'selezionata' | 'scartata';

export const DEMO_STATUS: { value: DemoStatus; label: string }[] = [
  { value: 'nuova', label: 'Da ascoltare' },
  { value: 'ascoltata', label: 'Ascoltata' },
  { value: 'selezionata', label: 'Selezionata' },
  { value: 'scartata', label: 'Scartata' },
];

/** Cosa vede l'artista: "scartata" per lui resta semplicemente "Ascoltata". */
export function artistStatusLabel(s: DemoStatus): string {
  if (s === 'nuova') return 'Inviata allo studio';
  if (s === 'selezionata') return '⭐ Selezionata per lo studio';
  return 'Ascoltata';
}

export interface Demo {
  id: string;
  artistId: string;
  title: string;
  note: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  peaks: number[];
  duration: number;
  source: 'file' | 'registrazione';
  status: DemoStatus;
  rating: number;
  trackId: string | null;
  uploadedBy: string;
  createdMs: number;
}

const toDemo = (id: string, artistId: string, d: DocumentData): Demo => ({
  id, artistId, title: d.title ?? '', note: d.note ?? '', fileId: d.fileId ?? '', fileName: d.fileName ?? '',
  mimeType: d.mimeType ?? '', size: d.size ?? 0, peaks: d.peaks ?? [], duration: d.duration ?? 0,
  source: d.source ?? 'file', status: d.status ?? 'nuova', rating: d.rating ?? 0, trackId: d.trackId ?? null,
  uploadedBy: d.uploadedBy ?? '', createdMs: (d.createdAt as Timestamp | undefined)?.toMillis?.() ?? Date.now(),
});

export function useDemos(artistId: string | null) {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!artistId) { setLoading(false); return; }
    return onSnapshot(collection(db, 'artists', artistId, 'demos'), (s) => {
      setDemos(s.docs.map((d) => toDemo(d.id, artistId, d.data())).sort((a, b) => b.createdMs - a.createdMs));
      setLoading(false);
    }, () => setLoading(false));
  }, [artistId]);
  return { demos, loading };
}

/** Tutte le demo di tutti gli artisti (solo admin). */
export function useAllDemos(enabled: boolean) {
  const [demos, setDemos] = useState<Demo[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(collectionGroup(db, 'demos'), (s) => {
      setDemos(s.docs.map((d) => toDemo(d.id, d.ref.parent.parent?.id ?? '', d.data())).sort((a, b) => b.createdMs - a.createdMs));
    }, () => setDemos([]));
  }, [enabled]);
  return demos;
}

/** La demo trattata come una "versione" per riusare lo stesso lettore. */
export function demoAsVersion(d: Demo): Version {
  return {
    id: d.id, trackId: `demo:${d.id}`, projectId: '', label: 'Demo', mp3FileId: d.fileId, fileName: d.fileName,
    size: d.size, peaks: d.peaks, duration: d.duration, downloadEnabled: true, notes: d.note, createdMs: d.createdMs, kind: 'demo',
  };
}

export function createDemo(artistId: string, data: Omit<Demo, 'id' | 'artistId' | 'status' | 'rating' | 'trackId' | 'createdMs'>) {
  return addDoc(collection(db, 'artists', artistId, 'demos'), {
    ...data, status: 'nuova', rating: 0, seenByAdmin: false, createdAt: serverTimestamp(),
  });
}

export function updateDemo(artistId: string, id: string, data: Partial<Pick<Demo, 'title' | 'note' | 'status' | 'rating' | 'trackId'>> & { seenByAdmin?: boolean }) {
  return updateDoc(doc(db, 'artists', artistId, 'demos', id), data);
}

export function deleteDemo(artistId: string, id: string) {
  return deleteDoc(doc(db, 'artists', artistId, 'demos', id));
}

/**
 * Elimina una demo (solo studio): via dall'app per tutti, con le sue note.
 * Il file va nel Cestino di Drive, tranne se la demo è diventata un brano (lì serve ancora).
 */
export async function removeDemo(demo: Demo) {
  if (!demo.trackId) await trashDemoFile(demo.artistId, demo.id);
  const notes = await getDocs(query(collection(db, 'artists', demo.artistId, 'comments'), where('trackId', '==', `demo:${demo.id}`)));
  const batch = writeBatch(db);
  notes.forEach((n) => batch.delete(n.ref));
  batch.delete(doc(db, 'artists', demo.artistId, 'demos', demo.id));
  await batch.commit();
}

/**
 * "Porta in studio": crea il brano (in un progetto esistente o in un nuovo singolo),
 * collega la demo come primo ascolto e la segna come selezionata.
 */
export async function promoteDemo(demo: Demo, target: { projectId: string } | { newSingle: string }, template: string[]) {
  let projectId: string;
  if ('projectId' in target) projectId = target.projectId;
  else projectId = (await createProject(demo.artistId, { title: target.newSingle, type: 'singolo', cover: null, releaseDate: '' })).id;
  const title = 'newSingle' in target ? target.newSingle : demo.title;
  const track = await createTrack(demo.artistId, projectId, title, template);
  await addVersion(demo.artistId, {
    trackId: track.id, projectId, label: 'Demo', mp3FileId: demo.fileId, fileName: demo.fileName, size: demo.size,
    peaks: demo.peaks, duration: demo.duration, downloadEnabled: false, notes: demo.note,
  });
  // il brano nasce già "ascoltato": non serve segnalarlo all'artista come novità
  await updateDoc(doc(db, 'artists', demo.artistId, 'tracks', track.id), { awaitingReview: false, fromDemoId: demo.id });
  await updateDemo(demo.artistId, demo.id, { status: 'selezionata', trackId: track.id, seenByAdmin: true });
  return track.id;
}
