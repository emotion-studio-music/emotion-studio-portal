import { useEffect, useState } from 'react';
import { collectionGroup, getDocs, limit, orderBy, query, type Timestamp } from 'firebase/firestore';
import { db } from './firebase';

/** Quante versioni, note e sessioni recenti leggere (in tutto al massimo 3 × LIMIT letture). */
const LIMIT = 60;
let cache: { at: number; byArtist: Record<string, number> } | null = null;

/**
 * Ultima attività di ogni artista (versione caricata, nota, sessione), solo per lo studio.
 * Una lettura sola, non in tempo reale, tenuta 5 minuti: serve solo per ordinare la pagina Artisti.
 */
export function useRecentActivity(enabled: boolean) {
  const [byArtist, setByArtist] = useState<Record<string, number>>(cache?.byArtist ?? {});
  useEffect(() => {
    if (!enabled) return;
    if (cache && Date.now() - cache.at < 5 * 60_000) { setByArtist(cache.byArtist); return; }
    let alive = true;
    const latest = (name: string) => getDocs(query(collectionGroup(db, name), orderBy('createdAt', 'desc'), limit(LIMIT)));
    Promise.all(['versions', 'comments', 'sessions'].map(latest))
      .then((snaps) => {
        const out: Record<string, number> = {};
        for (const s of snaps) {
          for (const d of s.docs) {
            const a = d.ref.parent.parent?.id;
            const ms = (d.data().createdAt as Timestamp | undefined)?.toMillis?.() ?? 0;
            if (a && ms > (out[a] ?? 0)) out[a] = ms;
          }
        }
        cache = { at: Date.now(), byArtist: out };
        if (alive) setByArtist(out);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [enabled]);
  return byArtist;
}
