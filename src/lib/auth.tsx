import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { deviceLang, setLang } from './i18n';

export type Role = 'admin' | 'artist' | 'none';

interface AuthState {
  loading: boolean;
  user: User | null;
  role: Role;
  artistId: string | null;
  privacyAccepted: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function resolveRole(user: User): Promise<{ role: Role; artistId: string | null; privacyAccepted: boolean }> {
  const [adminSnap, userSnap] = await Promise.all([
    getDoc(doc(db, 'admins', user.uid)),
    getDoc(doc(db, 'users', user.uid)),
  ]);
  const privacyAccepted = Boolean(userSnap.exists() && userSnap.data().privacyAcceptedAt);
  if (adminSnap.exists()) { setLang('it'); return { role: 'admin', artistId: null, privacyAccepted: true }; }
  const q = query(
    collection(db, 'artists'),
    where('memberUids', 'array-contains', user.uid),
    where('active', '==', true),
    limit(1),
  );
  const res = await getDocs(q);
  if (res.empty) { setLang(deviceLang()); return { role: 'none', artistId: null, privacyAccepted }; }
  const artistId = res.docs[0].id;
  // l'app dell'artista parla la lingua scelta dallo studio nel suo profilo
  setLang(res.docs[0].data().language === 'en' ? 'en' : 'it');
  // Le regole di sicurezza leggono qui a quale artista appartiene l'utente (impostazioni, feat).
  if (userSnap.data()?.artistId !== artistId) {
    await setDoc(doc(db, 'users', user.uid), { artistId }, { merge: true }).catch(() => undefined);
  }
  return { role: 'artist', artistId, privacyAccepted };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh' | 'logout'>>({
    loading: true,
    user: null,
    role: 'none',
    artistId: null,
    privacyAccepted: false,
  });

  const load = async (user: User | null) => {
    if (!user) {
      setLang(deviceLang());
      setState({ loading: false, user: null, role: 'none', artistId: null, privacyAccepted: false });
      return;
    }
    try {
      const r = await resolveRole(user);
      setState({ loading: false, user, ...r });
    } catch {
      setState({ loading: false, user, role: 'none', artistId: null, privacyAccepted: false });
    }
  };

  useEffect(() => onAuthStateChanged(auth, (u) => void load(u)), []);

  const value: AuthState = {
    ...state,
    refresh: () => load(auth.currentUser),
    logout: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuori da AuthProvider');
  return v;
}
