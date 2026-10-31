import { useEffect, useState } from 'react';
import { arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { computeBadges, type Badge } from './badges';
import { useProjects, useTracks } from './music';
import { useDemos } from './demos';
import { useSessions } from './business';
import { useSettings } from './data';

/** Traguardi dell'artista + quelli appena sbloccati da festeggiare (ricordati per account, su tutti i dispositivi). */
export function useBadges(artistId: string | null, createdMs: number, uid: string | null, celebrate: boolean) {
  const { tracks, loading } = useTracks(artistId);
  const { projects } = useProjects(artistId);
  const { demos } = useDemos(artistId);
  const sessions = useSessions(artistId);
  const { settings } = useSettings();
  const badges = computeBadges({
    createdMs, tracks, projects, demos: demos.length, hours: sessions.reduce((s, x) => s + x.hours, 0), template: settings.stepTemplate,
  });
  // undefined = non ancora letto · null = mai salvato · lista = traguardi già festeggiati
  const [seen, setSeen] = useState<string[] | null | undefined>(undefined);
  const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id);
  const key = unlockedIds.join('|');

  useEffect(() => {
    if (!uid || !celebrate) return;
    getDoc(doc(db, 'users', uid)).then((s) => setSeen((s.data()?.seenBadges as string[] | undefined) ?? null)).catch(() => setSeen(undefined));
  }, [uid, celebrate]);

  // Prima volta in assoluto: segno come già visti quelli esistenti (niente raffica di feste)
  useEffect(() => {
    if (!uid || !celebrate || loading || seen !== null) return;
    void setDoc(doc(db, 'users', uid), { seenBadges: unlockedIds }, { merge: true }).then(() => setSeen(unlockedIds)).catch(() => undefined);
  }, [uid, celebrate, loading, seen, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const fresh: Badge[] = seen ? badges.filter((b) => b.unlocked && !seen.includes(b.id)).sort((a, b) => Number(!!b.big) - Number(!!a.big)) : [];
  const dismiss = (id: string) => {
    setSeen((s) => [...(s ?? []), id]);
    if (uid) void setDoc(doc(db, 'users', uid), { seenBadges: arrayUnion(id) }, { merge: true }).catch(() => undefined);
  };
  return { badges, fresh, dismiss, tracks };
}
