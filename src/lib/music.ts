import { useEffect, useState } from 'react';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentData, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { safeLinks } from './safeUrl';
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
  coverFileId: string | null;   // copertina originale su Drive
  coverFileName: string;
  coverDownload: boolean;       // l'artista può scaricarla
  order: number;                // posizione nell'elenco (dal più vecchio al più recente, spostabile a mano)
  createdMs: number;
}

export interface Track {
  id: string;
  projectId: string;
  title: string;
  stage: number; // vecchia fase 0–6, usata solo per convertire i brani esistenti
  steps: Step[] | null; // percorso del brano (null = brano creato prima del percorso)
  order: number; // posizione nel progetto (in ordine di aggiunta, spostabile a mano)
  awaitingReview: boolean;
  currentVersionId: string | null;
  checklist: Record<string, boolean>;
  links: { spotify?: string; apple?: string; youtube?: string }; // link agli store quando è pubblicato
  collaboratorIds: string[];   // feat: altri artisti dello studio che vedono il brano
  collaboratorUids: string[];  // i loro account (servono alle regole di sicurezza)
  ownerName: string;           // nome dell'artista principale (lo vede chi è in feat)
  ownerArtistId: string;       // id dell'artista principale (dove "vive" il brano)
  collaboratorNames: string[]; // nomi d'arte degli artisti in feat
  publishedAt: string;         // "AAAA-MM-GG": giorno in cui hai spuntato l'ultimo step ('' se non ancora)
  createdMs: number;
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
  collaboratorUids?: string[];
}

const ms = (t: unknown) => (t as Timestamp | undefined)?.toMillis?.() ?? Date.now();

const toProject = (id: string, d: DocumentData): Project => ({
  id, title: d.title ?? '', type: d.type ?? 'singolo', cover: d.cover ?? null, releaseDate: d.releaseDate ?? '',
  driveFolderId: d.driveFolderId ?? null, versionsFolderId: d.versionsFolderId ?? null,
  coverFileId: d.coverFileId ?? null, coverFileName: d.coverFileName ?? '', coverDownload: d.coverDownload ?? false,
  order: typeof d.order === 'number' ? d.order : ms(d.createdAt), createdMs: ms(d.createdAt),
});
const toTrack = (id: string, d: DocumentData, owner = ''): Track => ({
  id, projectId: d.projectId, title: d.title ?? '', stage: d.stage ?? 0, steps: Array.isArray(d.steps) ? d.steps : null,
  order: typeof d.order === 'number' ? d.order : ms(d.createdAt),
  awaitingReview: d.awaitingReview ?? false, currentVersionId: d.currentVersionId ?? null,
  checklist: d.checklist ?? {}, links: safeLinks(d.links), collaboratorIds: d.collaboratorIds ?? [], collaboratorUids: d.collaboratorUids ?? [],
  ownerName: d.ownerName ?? '', ownerArtistId: owner, collaboratorNames: d.collaboratorNames ?? [], publishedAt: d.publishedAt ?? '', createdMs: ms(d.createdAt), updatedMs: ms(d.updatedAt),
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

/**
 * Ordine di progetti e brani: dal primo creato all'ultimo. `order` vale la data di creazione finché
 * lo studio non sposta qualcosa con le frecce: allora diventa 0, 1, 2… (sempre prima dei nuovi).
 */
export const byOrder = <T extends { order: number; createdMs: number }>(a: T, b: T) => a.order - b.order || a.createdMs - b.createdMs;

export function useProjects(artistId: string | null) {
  const r = useCollection(artistId ? `artists/${artistId}/projects` : null, toProject);
  return { projects: [...r.items].sort(byOrder), loading: r.loading };
}

export function useTracks(artistId: string | null) {
  const r = useCollection(artistId ? `artists/${artistId}/tracks` : null, (id, d) => toTrack(id, d, artistId ?? ''));
  return { tracks: [...r.items].sort(byOrder), loading: r.loading };
}

export function useVersions(artistId: string | null, trackId: string | null, asCollaborator?: string) {
  const [items, setItems] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!artistId || !trackId) { setLoading(false); return; }
    setLoading(true);
    const ref = collection(db, 'artists', artistId, 'versions');
    // chi è in feat può leggere solo le versioni che lo includono: la query deve dirlo esplicitamente
    const q = asCollaborator
      ? query(ref, where('trackId', '==', trackId), where('collaboratorUids', 'array-contains', asCollaborator))
      : query(ref, where('trackId', '==', trackId));
    return onSnapshot(q, (s) => { setItems(s.docs.map((d) => toVersion(d.id, d.data()))); setLoading(false); }, () => setLoading(false));
  }, [artistId, trackId, asCollaborator]);
  return { versions: [...items].sort((a, b) => b.createdMs - a.createdMs), loading };
}

/** Un solo brano (serve a chi è in feat, che non può leggere tutti i brani dell'altro artista). */
export function useTrackDoc(artistId: string | null, trackId: string | null) {
  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!artistId || !trackId) { setLoading(false); return; }
    return onSnapshot(doc(db, 'artists', artistId, 'tracks', trackId),
      (s) => { setTrack(s.exists() ? toTrack(s.id, s.data(), artistId) : null); setLoading(false); },
      () => { setTrack(null); setLoading(false); });
  }, [artistId, trackId]);
  return { track, loading };
}

export function useProjectDoc(artistId: string | null, projectId: string | null | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  useEffect(() => {
    if (!artistId || !projectId) return;
    return onSnapshot(doc(db, 'artists', artistId, 'projects', projectId),
      (s) => setProject(s.exists() ? toProject(s.id, s.data()) : null), () => setProject(null));
  }, [artistId, projectId]);
  return project;
}

/** Solo studio: brani di altri artisti in cui questo artista è in feat (per il suo pannello e l'anteprima). */
export function useFeatTracks(artistId: string | null) {
  const [tracks, setTracks] = useState<Track[]>([]);
  useEffect(() => {
    if (!artistId) return;
    return onSnapshot(query(collectionGroup(db, 'tracks'), where('collaboratorIds', 'array-contains', artistId)),
      (s) => setTracks(s.docs.map((d) => toTrack(d.id, d.data(), d.ref.parent.parent?.id ?? ''))
        .sort((a, b) => a.createdMs - b.createdMs)), () => setTracks([]));
  }, [artistId]);
  return tracks;
}

/** Brani di altri artisti in cui questo account è in feat. */
export function useSharedTracks(uid: string | null) {
  const [tracks, setTracks] = useState<Track[]>([]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collectionGroup(db, 'tracks'), where('collaboratorUids', 'array-contains', uid)),
      (s) => setTracks(s.docs.map((d) => toTrack(d.id, d.data(), d.ref.parent.parent?.id ?? ''))
        .sort((a, b) => a.createdMs - b.createdMs)), () => setTracks([]));
  }, [uid]);
  return tracks;
}

// ── scritture (solo admin, garantito dalle regole) ──

export function createProject(artistId: string, data: Pick<Project, 'title' | 'type' | 'cover' | 'releaseDate'> & { coverDownload?: boolean }) {
  return addDoc(collection(db, 'artists', artistId, 'projects'), {
    coverFileId: null, coverFileName: '', coverDownload: false,
    ...data, driveFolderId: null, versionsFolderId: null, order: Date.now(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
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

/** Il nuovo brano va in fondo al suo progetto. */
export function createTrack(artistId: string, projectId: string, title: string, template: string[]) {
  return addDoc(collection(db, 'artists', artistId, 'tracks'), {
    projectId, title, stage: 0, steps: stepsFromTemplate(template), order: Date.now(), awaitingReview: false, currentVersionId: null, checklist: {},
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export function updateTrack(artistId: string, id: string, data: Partial<Omit<Track, 'id' | 'updatedMs'>>) {
  return updateDoc(doc(db, 'artists', artistId, 'tracks', id), { ...data, updatedAt: serverTimestamp() });
}

/**
 * Frecce ↑ ↓: sposta `id` di un posto rispetto ai vicini in `visible` (l'elenco che vede lo studio)
 * e salva il nuovo ordine di tutto `all` come 0, 1, 2…
 */
export async function moveInOrder(artistId: string, col: 'projects' | 'tracks', all: { id: string }[], visible: { id: string }[], id: string, dir: -1 | 1) {
  const i = visible.findIndex((x) => x.id === id);
  const other = visible[i + dir];
  if (i < 0 || !other) return;
  const ids = all.map((x) => x.id);
  const a = ids.indexOf(id);
  const b = ids.indexOf(other.id);
  [ids[a], ids[b]] = [ids[b], ids[a]];
  const batch = writeBatch(db);
  ids.forEach((x, n) => batch.update(doc(db, 'artists', artistId, col, x), { order: n }));
  await batch.commit();
}

/** Elimina il brano e le sue versioni dall'app. I file restano su Drive. */
export async function deleteTrack(artistId: string, id: string) {
  const versions = await getDocs(query(collection(db, 'artists', artistId, 'versions'), where('trackId', '==', id)));
  const notes = await getDocs(query(collection(db, 'artists', artistId, 'comments'), where('trackId', '==', id)));
  const batch = writeBatch(db);
  versions.forEach((v) => batch.delete(v.ref));
  notes.forEach((n) => batch.delete(n.ref));
  batch.delete(doc(db, 'artists', artistId, 'tracks', id));
  await batch.commit();
}

export async function addVersion(artistId: string, data: Omit<Version, 'id' | 'createdMs'>) {
  const ref = await addDoc(collection(db, 'artists', artistId, 'versions'), { collaboratorUids: [], ...data, createdAt: serverTimestamp() });
  await updateTrack(artistId, data.trackId, { currentVersionId: ref.id, awaitingReview: true });
  return ref.id;
}

/**
 * Sostituisce l'MP3 di una versione con quello sistemato: stesso nome, stesse note, file nuovo.
 * createdAt torna ad "adesso", così la versione risale in cima e all'artista arriva la notifica.
 * Il file vecchio resta su Drive.
 */
export async function replaceVersionFile(artistId: string, version: Version, file: Pick<Version, 'mp3FileId' | 'fileName' | 'size' | 'peaks' | 'duration'>) {
  await updateDoc(doc(db, 'artists', artistId, 'versions', version.id), { ...file, createdAt: serverTimestamp(), replacedAt: serverTimestamp() });
  await updateTrack(artistId, version.trackId, { currentVersionId: version.id, awaitingReview: true });
}

export function updateVersion(artistId: string, id: string, data: Partial<Pick<Version, 'label' | 'notes' | 'downloadEnabled'>>) {
  return updateDoc(doc(db, 'artists', artistId, 'versions', id), data);
}

/** Toglie la versione dall'app insieme alle sue note (il file resta su Drive). */
export async function deleteVersion(artistId: string, id: string) {
  const notes = await getDocs(query(collection(db, 'artists', artistId, 'comments'), where('versionId', '==', id)));
  const batch = writeBatch(db);
  notes.forEach((n) => batch.delete(n.ref));
  batch.delete(doc(db, 'artists', artistId, 'versions', id));
  await batch.commit();
}

/**
 * Feat: imposta gli altri artisti che vedono questo brano. Copia i loro account sul brano,
 * sulle sue versioni, sulle note e sul progetto, così le regole di sicurezza li lasciano leggere.
 */
export async function setCollaborators(ownerId: string, ownerName: string, track: Track, collaboratorIds: string[]) {
  const uids: string[] = [];
  const names: string[] = [];
  for (const id of collaboratorIds) {
    const a = await getDoc(doc(db, 'artists', id));
    uids.push(...((a.data()?.memberUids as string[] | undefined) ?? []));
    if (a.data()?.stageName) names.push(a.data()!.stageName as string);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'artists', ownerId, 'tracks', track.id), { collaboratorIds, collaboratorUids: uids, collaboratorNames: names, ownerName, updatedAt: serverTimestamp() });
  const versions = await getDocs(query(collection(db, 'artists', ownerId, 'versions'), where('trackId', '==', track.id)));
  versions.forEach((v) => batch.update(v.ref, { collaboratorUids: uids }));
  const notes = await getDocs(query(collection(db, 'artists', ownerId, 'comments'), where('trackId', '==', track.id)));
  notes.forEach((c) => batch.update(c.ref, { collaboratorUids: uids }));
  // il progetto (titolo e copertina) lo vede chi è in feat in almeno un brano
  const siblings = await getDocs(query(collection(db, 'artists', ownerId, 'tracks'), where('projectId', '==', track.projectId)));
  const projectUids = new Set(uids);
  siblings.forEach((t) => { if (t.id !== track.id) ((t.data().collaboratorUids as string[] | undefined) ?? []).forEach((u) => projectUids.add(u)); });
  batch.update(doc(db, 'artists', ownerId, 'projects', track.projectId), { collaboratorUids: [...projectUids] });
  await batch.commit();
}
