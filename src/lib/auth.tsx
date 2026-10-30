import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';

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
  if (adminSnap.exists()) return { role: 'admin', artistId: null, privacyAccepted: true };
  const q = query(
    collection(db, 'artists'),
    where('memberUids', 'array-contains', user.uid),
    where('active', '==', true),
    limit(1),
  );
  const res = await getDocs(q);
  if (res.empty) return { role: 'none', artistId: null, privacyAccepted };
  return { role: 'artist', artistId: res.docs[0].id, privacyAccepted };
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
