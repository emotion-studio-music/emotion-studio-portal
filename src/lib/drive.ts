import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { createDriveFolder } from './worker';
import type { Artist } from './types';
import type { Project } from './music';

const ROOT_NAME = 'Emotion Studio – App';

/** Crea (se mancano) le cartelle Drive: Emotion Studio – App / Artista / Progetto / Versioni. */
export async function ensureVersionsFolder(artist: Artist, project: Project): Promise<string> {
  if (project.versionsFolderId) return project.versionsFolderId;

  const settingsRef = doc(db, 'settings', 'drive');
  let rootId = (await getDoc(settingsRef)).data()?.rootFolderId as string | undefined;
  if (!rootId) {
    rootId = await createDriveFolder(ROOT_NAME, null);
    await setDoc(settingsRef, { rootFolderId: rootId }, { merge: true });
  }

  let artistFolder = artist.driveFolderId;
  if (!artistFolder) {
    artistFolder = await createDriveFolder(artist.stageName, rootId);
    await updateDoc(doc(db, 'artists', artist.id), { driveFolderId: artistFolder });
  }

  let projectFolder = project.driveFolderId;
  if (!projectFolder) projectFolder = await createDriveFolder(project.title, artistFolder);
  const versionsFolder = await createDriveFolder('Versioni', projectFolder);
  await updateDoc(doc(db, 'artists', artist.id, 'projects', project.id), {
    driveFolderId: projectFolder, versionsFolderId: versionsFolder,
  });
  return versionsFolder;
}
