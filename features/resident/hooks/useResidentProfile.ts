import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { SessionUser } from "@/features/auth/auth-context";


interface ResidentProfileState {
  profile: SessionUser | null;
  loading: boolean;
  error: string | null;
}

export function useResidentProfile() {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [state, setState] = useState<ResidentProfileState>({
    profile: null,
    loading: true,
    error: null,
  });

  const fetchProfile = async () => {
    if (!user) {
      setState({ profile: null, loading: false, error: authError || "No user" });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      if (!db) throw new Error("Firestore no inicializado");
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setState({ profile: { ...user, ...userDoc.data() }, loading: false, error: null });
      } else {
        setState({ profile: user, loading: false, error: null });
      }
    } catch (e: any) {
      setState({ profile: null, loading: false, error: e.message || "Error al cargar perfil" });
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ profile: null, loading: false, error: authError || "No user" });
      return;
    }
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, authError]);

  return { ...state, refetch: fetchProfile };
}
