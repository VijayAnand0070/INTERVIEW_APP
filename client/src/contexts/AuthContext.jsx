import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function hydrateSession() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!initialSession) {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: userData, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error || !userData.user) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } else {
        setSession(initialSession);
        setUser(userData.user);
      }
      setLoading(false);
    }

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      if (!nextSession) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(nextSession);
      setUser(nextSession.user);
      setLoading(false);

      window.setTimeout(async () => {
        const { data: userData, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error || !userData.user) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          return;
        }
        setUser(userData.user);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      signOut: () => supabase.auth.signOut(),
    }),
    [session, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
