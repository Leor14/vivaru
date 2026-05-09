"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { collection, doc, getDoc, getDocFromServer, getDocs, limit, query, where } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { clearSession, loadSession, saveSession } from "@/lib/auth/session";
import type { AppRole } from "@/lib/constants/roles";
import { isFirebaseConfigured, missingFirebaseEnvKeys } from "@/lib/firebase/config";
import { completeResidentPasswordChangeCallable } from "@/lib/firebase/callables";
import type { SessionUser } from "@/types/domain";
export type { SessionUser } from "@/types/domain";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "misconfigured" | "profile_error";

interface SessionProfile {
  uid: string;
  email: string;
  role: AppRole;
  tenantId: string | null;
  fullName: string;
  photoURL?: string;
  avatarId?: string;
  status: "active" | "inactive";
  documentNumber?: string;
  mustChangePassword: boolean;
  temporaryPassword: boolean;
  passwordStatus: "temporary" | "updated";
  tenantName?: string;
  unitId?: string;
  unitLabel?: string;
}

export interface AuthSession {
  authUser: {
    uid: string;
    email: string;
  };
  profile: SessionProfile;
  resolved: boolean;
  isConfigured: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  session: AuthSession | null;
  status: AuthStatus;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  completeForcedPasswordChange: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
  refreshSessionProfile: (options?: { preferServerReads?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error(
      `Firebase no esta configurado en este entorno. Faltan: ${missingFirebaseEnvKeys.join(", ")}`,
    );
  }

  return auth;
}

function mapRole(raw: unknown): AppRole | null {
  if (raw === "super_admin" || raw === "superadmin") return "superadmin";
  if (raw === "admin_tenant" || raw === "tenant_admin") return "tenant_admin";
  if (raw === "security_guard" || raw === "security") return "security_guard";
  if (raw === "resident" || raw === "committee") return raw;
  return null;
}

function mapStatus(raw: unknown): "active" | "inactive" {
  if (raw === "inactive" || raw === "disabled") return "inactive";
  return "active";
}

function toSessionUser(profile: SessionProfile): SessionUser {
  return {
    uid: profile.uid,
    email: profile.email,
    fullName: profile.fullName,
    photoURL: profile.photoURL,
    avatarId: profile.avatarId,
    role: profile.role,
    tenantId: profile.tenantId ?? undefined,
    tenantName: profile.tenantName,
    unitId: profile.unitId,
    unitLabel: profile.unitLabel,
    documentNumber: profile.documentNumber,
    mustChangePassword: profile.mustChangePassword,
    temporaryPassword: profile.temporaryPassword,
    passwordStatus: profile.passwordStatus,
    status: profile.status,
  };
}

function normalizeLoginError(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      return "Correo o contrasena incorrectos.";
    }
    if (error.code === "auth/user-not-found") {
      return "No existe una cuenta con ese correo.";
    }
    if (error.code === "permission-denied") {
      return "No tienes permisos para leer el perfil de usuario en Firestore.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "No fue posible iniciar sesion.";
}

function debugAuth(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  if (payload) {
    console.info(message, payload);
    return;
  }
  console.info(message);
}

function isPasswordChangeAlreadyCompletedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes("ya no requiere cambio") || normalized.includes("failed-precondition");
}

async function resolveSessionProfile(firebaseUser: User, options?: { preferServerReads?: boolean }): Promise<SessionProfile> {
  const firestore = db;
  if (!firestore) {
    throw new Error("Firestore no esta inicializado en este entorno.");
  }
  const preferServerReads = options?.preferServerReads === true;

  const token = await getIdTokenResult(firebaseUser);
  const claimRole = mapRole(token.claims.role);
  const claimTenantId = typeof token.claims.tenantId === "string" ? token.claims.tenantId : undefined;

  let role: AppRole = claimRole ?? "resident";
  let tenantId = claimTenantId;
  let unitId: string | undefined;
  let unitLabel: string | undefined;
  let tenantName: string | undefined;
  let fullName = firebaseUser.displayName ?? "Usuario HOGARU";
  let photoURL: string | undefined = firebaseUser.photoURL ?? undefined;
  let avatarId: string | undefined;
  let profileStatus: "active" | "inactive" = "active";
  let documentNumber: string | undefined;
  let mustChangePassword = false;
  let temporaryPassword = false;
  let passwordStatus: "temporary" | "updated" = "updated";

  if (role === "superadmin" || firebaseUser.email === "superadmin@hogaru.co") {
    role = "superadmin";
    tenantId = undefined;
  }

  const userProfileRef = doc(firestore, "users", firebaseUser.uid);
  const userProfileSnap = preferServerReads
    ? await getDocFromServer(userProfileRef)
    : await getDoc(userProfileRef);
  if (!userProfileSnap.exists()) {
    throw new Error(`Perfil no encontrado en users/${firebaseUser.uid}. Contacta al administrador.`);
  }

  const userProfileData = userProfileSnap.data() as Record<string, unknown>;
  const profileRole = mapRole(userProfileData.role);
  if (userProfileData.role !== undefined && !profileRole) {
    throw new Error("Perfil invalido: role no reconocido en users/{uid}.");
  }

  if (profileRole) role = profileRole;
  if (typeof userProfileData.tenantId === "string") tenantId = userProfileData.tenantId;
  if (typeof userProfileData.unitId === "string") unitId = userProfileData.unitId;
  if (typeof userProfileData.unitLabel === "string") unitLabel = userProfileData.unitLabel;
  if (typeof userProfileData.documentNumber === "string") documentNumber = userProfileData.documentNumber;
  const hasUserProfileFullName = typeof userProfileData.fullName === "string" && userProfileData.fullName.trim().length > 0;
  if (typeof userProfileData.fullName === "string" && userProfileData.fullName.trim().length > 0) {
    fullName = userProfileData.fullName;
  }
  if (typeof userProfileData.photoURL === "string" && userProfileData.photoURL.trim().length > 0) {
    photoURL = userProfileData.photoURL.trim();
  } else if (typeof userProfileData.avatarUrl === "string" && userProfileData.avatarUrl.trim().length > 0) {
    photoURL = userProfileData.avatarUrl.trim();
  }
  if (typeof userProfileData.avatarId === "string" && userProfileData.avatarId.trim().length > 0) {
    avatarId = userProfileData.avatarId.trim();
  }
  profileStatus = mapStatus(userProfileData.status);
  mustChangePassword = userProfileData.mustChangePassword === true;
  temporaryPassword = userProfileData.temporaryPassword === true;
  passwordStatus = userProfileData.passwordStatus === "temporary" ? "temporary" : "updated";
  debugAuth("[auth.profile] users-doc", {
    uid: firebaseUser.uid,
    mustChangePassword,
    temporaryPassword,
    passwordStatus,
    preferServerReads,
  });

  if (firebaseUser.uid && role !== "superadmin") {
    let membershipData: Record<string, unknown> | undefined;

    if (tenantId) {
      const membershipRef = doc(firestore, "tenantUsers", `${tenantId}_${firebaseUser.uid}`);
      try {
        const membershipSnap = preferServerReads
          ? await getDocFromServer(membershipRef)
          : await getDoc(membershipRef);
        if (membershipSnap.exists()) {
          membershipData = membershipSnap.data() as Record<string, unknown>;
        }
      } catch (membershipReadError) {
        const firestoreError = membershipReadError as { code?: string; message?: string };
        if (firestoreError.code !== "permission-denied" && firestoreError.code !== "not-found") {
          throw membershipReadError;
        }
      }
    }

    if (!membershipData) {
      const membershipQuery = query(
        collection(firestore, "tenantUsers"),
        where("uid", "==", firebaseUser.uid),
        limit(1),
      );
      const membershipSnap = await getDocs(membershipQuery);
      if (!membershipSnap.empty) {
        membershipData = membershipSnap.docs[0].data() as Record<string, unknown>;
      }
    }

    if (membershipData) {
      const membershipRole = mapRole(membershipData.role);
      if (membershipRole) role = membershipRole;
      if (typeof membershipData.tenantId === "string") tenantId = membershipData.tenantId;
      if (typeof membershipData.unitId === "string") unitId = membershipData.unitId;
      if (typeof membershipData.unitLabel === "string") unitLabel = membershipData.unitLabel;
      if (!hasUserProfileFullName && typeof membershipData.fullName === "string" && membershipData.fullName.trim().length > 0) {
        fullName = membershipData.fullName;
      }
      profileStatus = mapStatus(membershipData.status);
      debugAuth("[auth.profile] tenantUsers-doc", {
        uid: firebaseUser.uid,
        membershipMustChangePassword: membershipData.mustChangePassword === true,
        membershipPasswordStatus: membershipData.passwordStatus === "temporary" ? "temporary" : "updated",
      });
    }

    if (tenantId) {
      try {
        const tenantSnap = await getDoc(doc(firestore, "tenants", tenantId));
        if (tenantSnap.exists()) {
          const tenantData = tenantSnap.data() as Record<string, unknown>;
          if (typeof tenantData.name === "string") {
            tenantName = tenantData.name;
          }
        }
      } catch (tenantReadError) {
        const firestoreError = tenantReadError as { code?: string; message?: string };
        if (firestoreError.code !== "permission-denied" && firestoreError.code !== "not-found") {
          throw tenantReadError;
        }
      }
    }
  }

  if (role === "tenant_admin" && !tenantId) {
    throw new Error("Perfil incompleto: tenantId faltante para tenant_admin.");
  }

  if (role !== "superadmin" && !tenantId) {
    throw new Error("Perfil incompleto: no fue posible determinar el tenant del usuario autenticado.");
  }

  if (profileStatus !== "active") {
    throw new Error("Tu cuenta esta inactiva. Contacta al administrador de la copropiedad.");
  }

  const resolvedProfile: SessionProfile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    fullName,
    photoURL,
    avatarId,
    role,
    tenantId: tenantId ?? null,
    documentNumber,
    mustChangePassword,
    temporaryPassword,
    passwordStatus,
    tenantName,
    unitId,
    unitLabel,
    status: profileStatus,
  };

  debugAuth("[auth.profile] resolved", {
    uid: resolvedProfile.uid,
    role: resolvedProfile.role,
    tenantId: resolvedProfile.tenantId,
    mustChangePassword: resolvedProfile.mustChangePassword,
  });

  return resolvedProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    if (!isFirebaseConfigured || !auth || !db) return null;
    return loadSession();
  });
  const [session, setSession] = useState<AuthSession | null>(() => {
    if (!isFirebaseConfigured || !auth || !db) return null;
    const cached = loadSession();
    if (!cached) return null;
    return {
      authUser: { uid: cached.uid, email: cached.email },
      profile: {
        uid: cached.uid,
        email: cached.email,
        role: cached.role,
        tenantId: cached.tenantId ?? null,
        fullName: cached.fullName,
        photoURL: cached.photoURL,
        avatarId: cached.avatarId,
        status: cached.status,
        documentNumber: cached.documentNumber,
        mustChangePassword: cached.mustChangePassword ?? false,
        temporaryPassword: cached.temporaryPassword ?? false,
        passwordStatus: cached.passwordStatus === "temporary" ? "temporary" : "updated",
        tenantName: cached.tenantName,
        unitId: cached.unitId,
        unitLabel: cached.unitLabel,
      },
      resolved: true,
      isConfigured: isFirebaseConfigured,
    };
  });
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!isFirebaseConfigured || !auth || !db) return "misconfigured";
    return "loading";
  });
  const [error, setError] = useState<string | null>(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      return `Firebase no esta configurado correctamente. Verifica: ${missingFirebaseEnvKeys.join(", ")}`;
    }
    return null;
  });

  const loading = status === "loading";

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      return;
    }

    let authBootstrapCompleted = false;
    const resolveTimeout = window.setTimeout(() => {
      if (authBootstrapCompleted) return;
      const cached = loadSession();
      if (cached) {
        debugAuth("[auth.bootstrap] timeout-fallback:cached-session", {
          uid: cached.uid,
          role: cached.role,
          mustChangePassword: cached.mustChangePassword,
        });
        setUser(cached);
        setSession({
          authUser: {
            uid: cached.uid,
            email: cached.email,
          },
          profile: {
            uid: cached.uid,
            email: cached.email,
            role: cached.role,
            tenantId: cached.tenantId ?? null,
            fullName: cached.fullName,
            status: cached.status,
            documentNumber: cached.documentNumber,
            mustChangePassword: cached.mustChangePassword ?? false,
            temporaryPassword: cached.temporaryPassword ?? false,
            passwordStatus: cached.passwordStatus === "temporary" ? "temporary" : "updated",
            tenantName: cached.tenantName,
            unitId: cached.unitId,
            unitLabel: cached.unitLabel,
          },
          resolved: true,
          isConfigured: true,
        });
        setStatus("authenticated");
        setError(null);
      } else {
        debugAuth("[auth.bootstrap] timeout-fallback:no-session");
        setUser(null);
        setSession(null);
        setStatus("unauthenticated");
        setError("No fue posible confirmar el estado de sesion en este momento.");
      }
    }, 8000);

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        authBootstrapCompleted = true;
        window.clearTimeout(resolveTimeout);

        if (!firebaseUser) {
          debugAuth("[auth.bootstrap] onAuthStateChanged:no-user");
          clearSession();
          setUser(null);
          setSession(null);
          setStatus("unauthenticated");
          setError(null);
          return;
        }

        try {
          debugAuth("[auth.bootstrap] onAuthStateChanged:user", {
            uid: firebaseUser.uid,
          });
          const profile = await resolveSessionProfile(firebaseUser);
          const resolvedSession: AuthSession = {
            authUser: {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? "",
            },
            profile,
            resolved: true,
            isConfigured: true,
          };

          const sessionUser = toSessionUser(profile);
          saveSession(sessionUser);
          setUser(sessionUser);
          setSession(resolvedSession);
          setStatus("authenticated");
          setError(null);
        } catch (resolveError) {
          debugAuth("[auth.bootstrap] onAuthStateChanged:profile-error", {
            uid: firebaseUser.uid,
            error: resolveError instanceof Error ? resolveError.message : "unknown",
          });
          clearSession();
          setUser(null);
          setSession(null);
          setStatus("profile_error");
          setError(resolveError instanceof Error ? resolveError.message : "No fue posible resolver el perfil.");
        }
      });
    } catch (authInitError) {
      authBootstrapCompleted = true;
      window.clearTimeout(resolveTimeout);
      const message = authInitError instanceof Error ? authInitError.message : "No fue posible inicializar Firebase Auth.";
      window.setTimeout(() => {
        clearSession();
        setUser(null);
        setSession(null);
        setStatus("misconfigured");
        setError(message);
      }, 0);
    }

    return () => {
      window.clearTimeout(resolveTimeout);
      unsubscribe?.();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const firebaseAuth = assertFirebaseConfigured();
    setStatus("loading");
    setError(null);
    console.info("[auth.login] submit:start", { email });

    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      console.info("[auth.login] signIn:success", { uid: credential.user.uid });

      const profile = await resolveSessionProfile(credential.user, { preferServerReads: true });
      console.info("[auth.login] profile:resolved", {
        uid: profile.uid,
        role: profile.role,
        tenantId: profile.tenantId,
        status: profile.status,
      });

      const sessionUser = toSessionUser(profile);
      saveSession(sessionUser);
      setUser(sessionUser);
      setSession({
        authUser: {
          uid: credential.user.uid,
          email: credential.user.email ?? "",
        },
        profile,
        resolved: true,
        isConfigured: true,
      });
      setStatus("authenticated");
      setError(null);
      console.info("[auth.login] redirect:ready", { role: sessionUser.role });
      return sessionUser;
    } catch (loginError) {
      const message = normalizeLoginError(loginError);
      console.error("[auth.login] failed", loginError);
      clearSession();
      setUser(null);
      setSession(null);
      setStatus("unauthenticated");
      setError(message);
      throw new Error(message);
    }
  }, []);

  const refreshSessionProfile = useCallback(async (options?: { preferServerReads?: boolean }) => {
    const firebaseAuth = assertFirebaseConfigured();
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      throw new Error("No hay sesion activa para refrescar el perfil.");
    }

    const profile = await resolveSessionProfile(currentUser, {
      preferServerReads: options?.preferServerReads === true,
    });
    const sessionUser = toSessionUser(profile);
    saveSession(sessionUser);
    setUser(sessionUser);
    setSession({
      authUser: {
        uid: currentUser.uid,
        email: currentUser.email ?? "",
      },
      profile,
      resolved: true,
      isConfigured: true,
    });
    setStatus("authenticated");
    setError(null);
    debugAuth("[auth.refresh] session-updated", {
      uid: sessionUser.uid,
      mustChangePassword: sessionUser.mustChangePassword,
      preferServerReads: options?.preferServerReads === true,
    });
  }, []);

  const completeForcedPasswordChange = useCallback(async (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    const sessionUser = user;
    if (!sessionUser) {
      throw new Error("Debes iniciar sesion para cambiar la contrasena.");
    }

    if (sessionUser.role !== "resident") {
      throw new Error("Este flujo solo aplica para residentes.");
    }

    const currentPassword = input.currentPassword.trim();
    const newPassword = input.newPassword.trim();
    const confirmPassword = input.confirmPassword.trim();
    const documentNumber = sessionUser.documentNumber?.trim() ?? "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error("Completa todos los campos de seguridad.");
    }

    if (newPassword !== confirmPassword) {
      throw new Error("La confirmacion de contrasena no coincide.");
    }

    if (newPassword.length < 8) {
      throw new Error("La nueva contrasena debe tener minimo 8 caracteres.");
    }

    if (newPassword === currentPassword) {
      throw new Error("La nueva contrasena debe ser diferente de la temporal.");
    }

    if (documentNumber && newPassword === documentNumber) {
      throw new Error("La nueva contrasena no puede ser igual al documento.");
    }

    debugAuth("[auth.force-change] before", {
      uid: sessionUser.uid,
      mustChangePassword: sessionUser.mustChangePassword,
      temporaryPassword: sessionUser.temporaryPassword,
      passwordStatus: sessionUser.passwordStatus,
    });

    try {
      await completeResidentPasswordChangeCallable({
        currentPassword,
        newPassword,
      });
    } catch (callableError) {
      // If backend already flipped the flag but returned a post-update precondition error, continue locally.
      if (!isPasswordChangeAlreadyCompletedError(callableError)) {
        throw callableError;
      }
      debugAuth("[auth.force-change] backend-already-completed", {
        uid: sessionUser.uid,
        error: callableError instanceof Error ? callableError.message : "unknown",
      });
    }

    const nextSessionUser: SessionUser = {
      ...sessionUser,
      mustChangePassword: false,
      temporaryPassword: false,
      passwordStatus: "updated",
    };

    // Sync local cache + cookie immediately to avoid stale middleware redirects.
    saveSession(nextSessionUser);
    setUser(nextSessionUser);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          mustChangePassword: false,
          temporaryPassword: false,
          passwordStatus: "updated",
        },
      };
    });

    debugAuth("[auth.force-change] local-session-updated", {
      uid: nextSessionUser.uid,
      mustChangePassword: nextSessionUser.mustChangePassword,
    });

    try {
      await refreshSessionProfile({ preferServerReads: true });
    } catch (refreshError) {
      // Do not re-block resident access when backend password change already succeeded.
      debugAuth("[auth.force-change] refresh-failed-after-success", {
        uid: sessionUser.uid,
        error: refreshError instanceof Error ? refreshError.message : "unknown",
      });
    }
    debugAuth("[auth.force-change] completed", { uid: sessionUser.uid });
  }, [refreshSessionProfile, user]);

  const logout = useCallback(async () => {
    clearSession();
    setUser(null);
    setSession(null);
    setStatus("unauthenticated");
    setError(null);
    if (auth) {
      await signOut(auth);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      status,
      loading,
      error,
      isConfigured: isFirebaseConfigured,
      login,
      completeForcedPasswordChange,
      refreshSessionProfile,
      logout,
      hasAnyRole: (roles) => Boolean(user && roles.includes(user.role)),
    }),
    [user, session, status, loading, error, login, completeForcedPasswordChange, refreshSessionProfile, logout],
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
