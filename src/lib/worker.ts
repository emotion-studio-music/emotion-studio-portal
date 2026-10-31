import { auth } from './firebase';

const BASE = (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const workerConfigured = Boolean(BASE);

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!BASE) throw new Error('Il collegamento a Drive non è ancora configurato (VITE_WORKER_URL).');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sessione scaduta. Rientra nell’app.');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error('Connessione assente. Controlla la rete e riprova.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Operazione non riuscita.');
  return data as T;
}

/** URL temporaneo (3 ore) per ascoltare o scaricare una versione. */
export async function mediaUrl(artistId: string, versionId: string, download = false): Promise<string> {
  const { url } = await call<{ url: string }>('/media/token', { artistId, versionId, download });
  return url;
}

export async function createDriveFolder(name: string, parentId: string | null): Promise<string> {
  const { id } = await call<{ id: string }>('/admin/folder', { name, parentId });
  return id;
}

export interface DriveFile { id: string; name: string; size?: string; mimeType?: string }

function xhrPut(url: string, file: File, onProgress: (p: number) => void, headers: Record<string, string> = {}): Promise<DriveFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as DriveFile); } catch { reject(new Error('Risposta di Drive non leggibile.')); }
      } else {
        reject(Object.assign(new Error('Caricamento non riuscito.'), { http: xhr.status }));
      }
    };
    xhr.onerror = () => reject(Object.assign(new Error('network'), { network: true }));
    xhr.send(file);
  });
}

/** Carica un file su Drive nella cartella indicata. Prima prova diretto a Google, poi tramite il Worker. */
export async function uploadToDrive(file: File, parentId: string, onProgress: (p: number) => void): Promise<DriveFile> {
  const { uploadUrl } = await call<{ uploadUrl: string }>('/admin/upload', {
    name: file.name, mimeType: file.type || 'audio/mpeg', size: file.size, parentId,
  });
  try {
    return await xhrPut(uploadUrl, file, onProgress);
  } catch (e) {
    if (!(e as { network?: boolean }).network) throw e;
    onProgress(0);
    const token = await auth.currentUser?.getIdToken();
    return await xhrPut(`${BASE}/admin/upload-proxy?u=${encodeURIComponent(uploadUrl)}`, file, onProgress, {
      Authorization: `Bearer ${token}`,
    });
  }
}

export async function driveHealth(): Promise<{ ok: boolean; usedGB: number; limitGB: number }> {
  if (!BASE) throw new Error('Worker non configurato.');
  const res = await fetch(`${BASE}/health`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Drive non raggiungibile.');
  return data;
}
