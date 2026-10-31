import { useEffect, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentData, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { stepsFromLegacyStage, stepsFromTemplate, type Step } from './steps';

export type ProjectType = 'singolo' | 'ep' | 'album';
export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'singolo', label: 'Singolo' },
  { value: 'ep', label: 'EP' },
  { value: 'album', label: 'Album' },
];
export const typeLabel = (t: ProjectType) => PROJECT_TYPES.find((p) => p.value === t)?.label ?? t;

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  cover: string | null;
  releaseDate: string; // "2026-12-01" o ''
  driveFolderId: string | null;
  versionsFolderId: string | null;
  createdMs: number;
}

export interface Track {
  id: string;
  projectId: string;
  title: string;
  stage: number; // vecchia fase 0–6, usata solo per convertire i brani esistenti
  steps: Step[] | null; // percorso del brano (null = brano creato prima del percorso)
  order: number;
  awaitingReview: boolean;
  currentVersionId: string | null;
  checklist: Record<string, boolean>;
  updatedMs: number;
}

export interface Version {
  id: string;
  trackId: string;
  projectId: string;
  label: string;
  mp3FileId: string;
  fileName: string;
  size: number;
  peaks: number[];
  duration: number;
  downloadEnabled: boolean;
  notes: string;
  createdMs: number;
  kind?: 'demo'; // le demo usano lo stesso lettore
}

const ms = (t: unknown) => (t as Timestamp | undefined)?.toMillis?.() ?? Date.now();

const toProject = (id: string, d: DocumentData): Project => ({
  id, title: d.title ?? '', type: d.type ?? 'singolo', cover: d.cover ?? null, releaseDate: d.releaseDate ?? '',
  driveFolderId: d.driveFolderId ?? null, versionsFolderId: d.versionsFolderId ?? null, createdMs: ms(d.createdAt),
});
const toTrack = (id: string, d: DocumentData): Track => ({
  id, projectId: d.projectId, title: d.title ?? '', stage: d.stage ?? 0, steps: Array.isArray(d.steps) ? d.steps : null, order: d.order ?? 0,
  awaitingReview: d.awaitingReview ?? false, currentVersionId: d.currentVersionId ?? null,
  checklist: d.checklist ?? {}, updatedMs: ms(d.updatedAt),
});
const toVersion = (id: string, d: DocumentData): Version => ({
  id, trackId: d.trackId, projectId: d.projectId, label: d.label ?? '', mp3FileId: d.mp3FileId ?? '',
  fileName: d.fileName ?? '', size: d.size ?? 0, peaks: d.peaks ?? [], duration: d.duration ?? 0,
  downloadEnabled: d.downloadEnabled ?? false, notes: d.notes ?? '', createdMs: ms(d.createdAt),
});

function useCollection<T>(path: string | null, map: (id: string, d: DocumentData) => T, filter?: [string, string]) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `${path}|${filter?.join('=')}`;
  useEffect(() => {
    if (!path) { setLoading(false); return; }
    setLoading(true);
    const ref = collection(db, path);
    const q = filter ? query(ref, where(filter[0], '==', filter[1])) : ref;
    return onSnapshot(q, (s) => { setItems(s.docs.map((d) => map(d.id, d.data()))); setLoading(false); }, () => setLoading(false));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { items, loading };
}

export function useProjects(artistId: string | null) {
  const r = useCollection(artistId ? `artists/${artistId}/projects` : null, toProject);
  return { projects: [...r.items].sort((a, b) => b.createdMs - a.createdMs), loading: r.loading };
}

export function useTracks(artistId: string | null) {
  const r = useCollection(artistId ? `artists/${artistId}/tracks` : null, toTrack);
  return { tracks: [...r.items].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)), loading: r.loading };
}

export function useVersions(artistId: string | null, trackId: string | null) {
  const r = useCollection(artistId && trackId ? `artists/${artistId}/versions` : null, toVersion, trackId ? ['trackId', trackId] : undefined);
  return { versions: [...r.items].sort((a, b) => b.createdMs - a.createdMs), loading: r.loading };
}

// ── scritture (solo admin, garantito dalle regole) ──

export function createProject(artistId: string, data: Pick<Project, 'title' | 'type' | 'cover' | 'releaseDate'>) {
  return addDoc(collection(db, 'artists', artistId, 'projects'), {
    ...data, driveFolderId: null, versionsFolderId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export function updateProject(artistId: string, id: string, data: Partial<Omit<Project, 'id' | 'createdMs'>>) {
  return updateDoc(doc(db, 'artists', artistId, 'projects', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProject(artistId: string, id: string) {
  const tracks = await getDocs(query(collection(db, 'artists', artistId, 'tracks'), where('projectId', '==', id)));
  if (!tracks.empty) throw new Error('Prima elimina i brani di questo progetto.');
  await deleteDoc(doc(db, 'artists', artistId, 'projects', id));
}

/** Gli step del brano: quelli salvati oppure, per i brani vecchi, ricavati dalla fase. */
export function trackSteps(t: Track, template: string[]): Step[] {
  return t.steps ?? stepsFromLegacyStage(t.stage, template);
}

export function createTrack(artistId: string, projectId: string, title: string, order: number, template: string[]) {
  return addDoc(collection(db, 'artists', artistId, 'tracks'), {
    projectId, title, stage: 0, steps: stepsFromTemplate(template), order, awaitingReview: false, currentVersionId: null, checklist: {},
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export function updateTrack(artistId: string, id: string, data: Partial<Omit<Track, 'id' | 'updatedMs'>>) {
  return updateDoc(doc(db, 'artists', artistId, 'tracks', id), { ...data, updatedAt: serverTimestamp() });
}

/** Elimina il brano e le sue versioni dall'app. I file restano su Drive. */
export async function deleteTrack(artistId: string, id: string) {
  const versions = await getDocs(query(collection(db, 'artists', artistId, 'versions'), where('trackId', '==', id)));
  const batch = writeBatch(db);
  versions.forEach((v) => batch.delete(v.ref));
  batch.delete(doc(db, 'artists', artistId, 'tracks', id));
  await batch.commit();
}

export async function addVersion(artistId: string, data: Omit<Version, 'id' | 'createdMs'>) {
  const ref = await addDoc(collection(db, 'artists', artistId, 'versions'), { ...data, createdAt: serverTimestamp() });
  await updateTrack(artistId, data.trackId, { currentVersionId: ref.id, awaitingReview: true });
  return ref.id;
}

export function updateVersion(artistId: string, id: string, data: Partial<Pick<Version, 'label' | 'notes' | 'downloadEnabled'>>) {
  return updateDoc(doc(db, 'artists', artistId, 'versions', id), data);
}

export function deleteVersion(artistId: string, id: string) {
  return deleteDoc(doc(db, 'artists', artistId, 'versions', id));
}
