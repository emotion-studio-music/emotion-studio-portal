import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { safeLinks } from './safeUrl';
import { defaultFocus, emptySession, emptySettings, type Artist, type NextSession, type PhotoFocus, type StudioSettings } from './types';

// Compatibile anche con la vecchia versione, dove la sessione era solo testo.
function toSession(v: unknown): NextSession {
  if (typeof v === 'string') return { ...emptySession, note: v };
  if (v && typeof v === 'object') return { ...emptySession, ...(v as Partial<NextSession>) };
  return emptySession;
}

function toArtist(id: string, d: Record<string, unknown>): Artist {
  return {
    id,
    stageName: (d.stageName as string) ?? '',
    realName: (d.realName as string) ?? '',
    bio: (d.bio as string) ?? '',
    photo: (d.photo as string) ?? null,
    photoFocus: { ...defaultFocus, ...((d.photoFocus as Partial<PhotoFocus>) ?? {}) },
    genres: (d.genres as string[]) ?? [],
    phone: (d.phone as string) ?? '',
    links: safeLinks(d.links as Artist['links']),
    nextSession: toSession(d.nextSession),
    language: d.language === 'en' ? 'en' : 'it',
    memberUids: (d.memberUids as string[]) ?? [],
    memberEmails: (d.memberEmails as string[]) ?? [],
    active: (d.active as boolean) ?? true,
    driveFolderId: (d.driveFolderId as string) ?? null,
    createdMs: (d.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? Date.now(),
  };
}

export function useArtist(id: string | null | undefined) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      doc(db, 'artists', id),
      (s) => { setArtist(s.exists() ? toArtist(s.id, s.data()) : null); setLoading(false); },
      () => { setError('Non riesco a caricare il profilo.'); setLoading(false); },
    );
  }, [id]);
  return { artist, loading, error };
}

export function useArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () => onSnapshot(query(collection(db, 'artists'), orderBy('stageName')), (s) => {
      setArtists(s.docs.map((d) => toArtist(d.id, d.data())));
      setLoading(false);
    }, () => setLoading(false)),
    [],
  );
  return { artists, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<StudioSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  useEffect(
    () => onSnapshot(doc(db, 'settings', 'studio'), (s) => {
      setSettings({ ...emptySettings, ...(s.exists() ? (s.data() as Partial<StudioSettings>) : {}) });
      setLoading(false);
    }, () => setLoading(false)),
    [],
  );
  return { settings, loading };
}

export function saveSettings(s: StudioSettings) {
  return setDoc(doc(db, 'settings', 'studio'), { ...s, updatedAt: serverTimestamp() });
}
