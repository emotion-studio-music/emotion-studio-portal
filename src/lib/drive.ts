import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createDriveFolder, resolveArtistFolder } from './worker';
import type { Artist } from './types';
import type { Project } from './music';

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
