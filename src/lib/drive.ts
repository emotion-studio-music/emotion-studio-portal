import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createDriveFolder, resolveArtistFolder, uploadToDrive } from './worker';
import type { Artist } from './types';
import type { Project } from './music';

/** Cartella del progetto su Drive: Emotion Studio – App / Artista / Progetto (la crea se manca). */
export async function ensureProjectFolder(artist: Artist, project: Pick<Project, 'id' | 'title' | 'driveFolderId'>): Promise<string> {
  if (project.driveFolderId) return project.driveFolderId;
  let artistFolder = artist.driveFolderId;
  if (!artistFolder) {
    const r = await resolveArtistFolder(artist.id);
    artistFolder = r.artistFolderId;
    await updateDoc(doc(db, 'artists', artist.id), { driveFolderId: artistFolder });
    if (r.rootId) await setDoc(doc(db, 'settings', 'drive'), { rootFolderId: r.rootId }, { merge: true });
  }
  const id = await createDriveFolder(project.title, artistFolder);
  await updateDoc(doc(db, 'artists', artist.id, 'projects', project.id), { driveFolderId: id });
  return id;
}

/** Carica la copertina originale (piena qualità) nella cartella del progetto. */
export async function uploadCoverOriginal(artist: Artist, project: Pick<Project, 'id' | 'title' | 'driveFolderId'>, file: File) {
  const folder = await ensureProjectFolder(artist, project);
  const up = await uploadToDrive(file, folder, () => undefined);
  await updateDoc(doc(db, 'artists', artist.id, 'projects', project.id), { coverFileId: up.id, coverFileName: file.name });
}

/** Crea (se mancano) le cartelle Drive: Emotion Studio – App / Artista / Progetto / Versioni. */
export async function ensureVersionsFolder(artist: Artist, project: Project): Promise<string> {
  if (project.versionsFolderId) return project.versionsFolderId;

  let artistFolder = artist.driveFolderId;
  if (!artistFolder) {
    const r = await resolveArtistFolder(artist.id);
    artistFolder = r.artistFolderId;
    await updateDoc(doc(db, 'artists', artist.id), { driveFolderId: artistFolder });
    if (r.rootId) await setDoc(doc(db, 'settings', 'drive'), { rootFolderId: r.rootId }, { merge: true });
  }

  let projectFolder = project.driveFolderId;
  if (!projectFolder) projectFolder = await createDriveFolder(project.title, artistFolder);
  const versionsFolder = await createDriveFolder('Versioni', projectFolder);
  await updateDoc(doc(db, 'artists', artist.id, 'projects', project.id), {
    driveFolderId: projectFolder, versionsFolderId: versionsFolder,
  });
  return versionsFolder;
}
