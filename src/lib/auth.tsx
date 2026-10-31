import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: (userId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestId = useRef(0);

  async function loadProfile(uid: string) {
    const requestId = ++profileRequestId.current;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, bio, avatar_url, created_at')
      .eq('id', uid)
      .maybeSingle();
    if (requestId !== profileRequestId.current) return;
    if (error) {
      setProfile(null);
      throw error;
    }
    setProfile(data as Profile | null);
  }

  async function refreshProfile(userId?: string) {
    const uid = userId ?? session?.user.id;
    if (uid) await loadProfile(uid);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        void loadProfile(data.session.user.id)
          .catch((error) => console.error('profile load failed', error))
          .finally(() => {
            if (active) setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    // Avoid awaiting inside the callback directly (deadlock guard).
    // INITIAL_SESSION is already handled by getSession above; skipping it
    // prevents a duplicate profile load on mount.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'INITIAL_SESSION') return;
        setSession(newSession);
        if (newSession?.user) {
          void loadProfile(newSession.user.id).catch((error) =>
            console.error('profile load failed', error)
          );
        } else {
          profileRequestId.current += 1;
          setProfile(null);
        }
      }
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    profileRequestId.current += 1;
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
