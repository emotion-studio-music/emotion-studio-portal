import { useEffect, useState } from 'react';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Comment {
  id: string;
  trackId: string;
  versionId: string;
  authorUid: string;
  authorRole: 'admin' | 'artist';
  authorName: string;
  text: string;
  atSeconds: number | null; // null = commento generale
  resolved: boolean;
  createdMs: number;
}

/** Note scritte dagli artisti e non ancora risolte, di tutti gli artisti (solo admin). */
export function useOpenArtistNotes(enabled: boolean) {
  const [items, setItems] = useState<(Comment & { artistId: string })[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(collectionGroup(db, 'comments'), (s) => setItems(s.docs
      .map((d) => {
        const x = d.data();
        return {
          id: d.id, artistId: d.ref.parent.parent?.id ?? '', trackId: x.trackId, versionId: x.versionId, authorUid: x.authorUid,
          authorRole: x.authorRole, authorName: x.authorName ?? '', text: x.text ?? '',
          atSeconds: typeof x.atSeconds === 'number' ? x.atSeconds : null, resolved: x.resolved ?? false,
          createdMs: (x.createdAt as Timestamp | undefined)?.toMillis?.() ?? Date.now(),
        };
      })
      .filter((c) => c.authorRole === 'artist' && !c.resolved)
      .sort((a, b) => b.createdMs - a.createdMs)), () => setItems([]));
  }, [enabled]);
  return items;
}

/** Commenti di un artista (tutti) o di un solo brano. */
export function useComments(artistId: string | null, trackId?: string, asCollaborator?: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  useEffect(() => {
    if (!artistId) return;
    const ref = collection(db, 'artists', artistId, 'comments');
    const q = trackId
      ? (asCollaborator
        ? query(ref, where('trackId', '==', trackId), where('collaboratorUids', 'array-contains', asCollaborator))
        : query(ref, where('trackId', '==', trackId)))
      : ref;
    return onSnapshot(q, (s) => setComments(s.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, trackId: x.trackId, versionId: x.versionId, authorUid: x.authorUid, authorRole: x.authorRole,
        authorName: x.authorName ?? '', text: x.text ?? '', atSeconds: typeof x.atSeconds === 'number' ? x.atSeconds : null,
        resolved: x.resolved ?? false, createdMs: (x.createdAt as Timestamp | undefined)?.toMillis?.() ?? Date.now(),
      };
    })), () => setComments([]));
  }, [artistId, trackId, asCollaborator]);
  return comments;
}

export function addComment(artistId: string, c: Omit<Comment, 'id' | 'createdMs' | 'resolved'>, collaboratorUids: string[] = []) {
  return addDoc(collection(db, 'artists', artistId, 'comments'), {
    ...c, text: c.text.trim().slice(0, 2000), resolved: false, collaboratorUids, createdAt: serverTimestamp(),
  });
}

export function setResolved(artistId: string, id: string, resolved: boolean, uid: string) {
  return updateDoc(doc(db, 'artists', artistId, 'comments', id), {
    resolved, resolvedBy: resolved ? uid : null, resolvedAt: resolved ? serverTimestamp() : null,
  });
}

export function deleteComment(artistId: string, id: string) {
  return deleteDoc(doc(db, 'artists', artistId, 'comments', id));
}
