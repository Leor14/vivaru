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
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { collection, doc, getDoc, getDocFromServer, getDocs, limit, query, updateDoc, where } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";
import { CallableError } from "@/lib/utils/error-handler";
import { clearSession, loadSession, saveSession } from "@/lib/auth/session";
import type { AppRole } from "@/lib/constants/roles";
import { isFirebaseConfigured, missingFirebaseEnvKeys } from "@/lib/firebase/config";
import { completeResidentPasswordChangeCallable, switchActiveTenantCallable } from "@/lib/firebase/callables";
import type { SessionUser, TenantMembership } from "@/types/domain";
import { aplicarTema, borrarEspejo, TEMA_POR_DEFECTO } from "@/lib/ui/tema";

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
  memberships: TenantMembership[];
  /** `PRD-V-FEAT-007`. Ausente = sin elegir; se pinta claro. */
  tema?: "claro" | "oscuro";
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
  requestPasswordReset: (email: string) => Promise<void>;
  completeForcedPasswordChange: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
  refreshSessionProfile: (options?: { preferServerReads?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Cambia el conjunto activo (`PLAT-002` §5.2). Solo para quien tenga varias
   * membresías; con una, no hay a dónde cambiar.
   */
  switchTenant: (tenantId: string) => Promise<void>;
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
    memberships: profile.memberships,
    unitId: profile.unitId,
    unitLabel: profile.unitLabel,
    documentNumber: profile.documentNumber,
    mustChangePassword: profile.mustChangePassword,
    temporaryPassword: profile.temporaryPassword,
    passwordStatus: profile.passwordStatus,
    status: profile.status,
    tema: profile.tema,
  };
}

function normalizeLoginError(error: unknown) {
  if (error instanceof FirebaseError) {
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      return "Correo o contraseña incorrectos.";
    }
    if (error.code === "auth/user-not-found") {
      return "No existe una cuenta con ese correo.";
    }
    if (error.code === "permission-denied") {
      return "No tienes permisos para leer el perfil de usuario en Firestore.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "No fue posible iniciar sesión.";
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
  let fullName = firebaseUser.displayName ?? "Usuario Vivaru";
  let photoURL: string | undefined = firebaseUser.photoURL ?? undefined;
  let avatarId: string | undefined;
  let profileStatus: "active" | "inactive" = "active";
  let documentNumber: string | undefined;
  let mustChangePassword = false;
  let temporaryPassword = false;
  let passwordStatus: "temporary" | "updated" = "updated";
  let memberships: TenantMembership[] = [];

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
  if (profileStatus === "inactive") {
    // Defensa en profundidad: aunque la baja deshabilita la cuenta de Auth, aquí
    // también se corta el acceso si quedara una sesión viva o un doc inactivo.
    throw new Error("Tu cuenta está inactiva. Contacta al administrador del conjunto.");
  }
  // Un valor desconocido se trata como ausente y NO se corrige desde el cliente:
  // corregirlo en silencio esconderia el defecto que lo escribio (RN-03).
  const temaDelPerfil =
    userProfileData.tema === "oscuro" || userProfileData.tema === "claro"
      ? (userProfileData.tema as "claro" | "oscuro")
      : undefined;
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
    /**
     * **`PLAT-002` — las membresías, y cuál de ellas queda activa.**
     *
     * Va ANTES de resolver la membresía concreta porque puede cambiar
     * `tenantId`, y todo lo de abajo cuelga de él.
     *
     * Solo para `tenant_admin`, y son dos motivos distintos: el residente con
     * unidades en dos conjuntos está fuera de alcance (§4) y la portería no
     * tiene selector (CF4); y así **nadie más paga la consulta extra** al
     * entrar.
     *
     * Si la consulta falla no se rompe la sesión: el selector es comodidad, no
     * autoridad. Sin él se opera el conjunto de siempre, que es justo el
     * comportamiento anterior.
     */
    if (role === "tenant_admin") {
      try {
        const todas = await getDocs(
          query(collection(firestore, "tenantUsers"), where("uid", "==", firebaseUser.uid)),
        );
        memberships = todas.docs
          .map((d) => d.data() as Record<string, unknown>)
          .filter((m) => {
            const esAdmin = m.role === "tenant_admin" || m.role === "admin_tenant";
            const activa = (m.status ?? "active") === "active";
            return typeof m.tenantId === "string" && esAdmin && activa;
          })
          .map((m) => ({ tenantId: m.tenantId as string }));
      } catch (membershipsError) {
        const firestoreError = membershipsError as { code?: string };
        if (firestoreError.code !== "permission-denied" && firestoreError.code !== "not-found") {
          throw membershipsError;
        }
      }
    }

    /**
     * **El último conjunto usado es comodidad, no autoridad (CA5, CF3).** Solo
     * se acepta si sigue habiendo membresía; si se la revocaron, se cae al
     * conjunto que ya se hubiera resuelto y se entra sin error (CA6).
     * Manipularlo a un conjunto ajeno no da acceso a nada: las reglas y las
     * callables vuelven a comprobar la membresía en cada operación.
     */
    const ultimoUsado =
      typeof userProfileData.lastActiveTenantId === "string" ? userProfileData.lastActiveTenantId : undefined;
    if (
      memberships.length > 1 &&
      ultimoUsado &&
      memberships.some((m) => m.tenantId === ultimoUsado)
    ) {
      tenantId = ultimoUsado;
    } else if (memberships.length > 1 && !memberships.some((m) => m.tenantId === tenantId)) {
      // El conjunto del claim o del perfil ya no está entre sus membresías.
      // Antes esto acababa en «perfil incompleto»; ahora aterriza en uno suyo.
      tenantId = memberships[0].tenantId;
    }

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

    /**
     * Nombre y estado de cada conjunto, para que el selector no sea una lista
     * de identificadores y para poder avisar de cuál está en solo lectura
     * (CA10). **Solo con más de una membresía**: con una, esto no se pinta y la
     * lectura sería gasto puro.
     *
     * N lecturas para N conjuntos propios. Con dieciséis es trivial; con
     * doscientos habría que agregar en servidor, y está anotado como límite
     * conocido en la ficha (G6).
     */
    if (memberships.length > 1) {
      memberships = await Promise.all(
        memberships.map(async (m) => {
          if (m.tenantId === tenantId) {
            return { ...m, tenantName: tenantName ?? undefined };
          }
          try {
            const snap = await getDoc(doc(firestore, "tenants", m.tenantId));
            if (!snap.exists()) return m;
            const data = snap.data() as Record<string, unknown>;
            return {
              ...m,
              tenantName: typeof data.name === "string" ? data.name : undefined,
              status: typeof data.status === "string" ? (data.status as TenantMembership["status"]) : undefined,
            };
          } catch {
            // Un conjunto que no se deja leer se queda con su identificador. No
            // puede tumbar la sesión: el selector es comodidad.
            return m;
          }
        }),
      );

      // El activo también quiere su estado, y ya se leyó su documento arriba
      // solo para el nombre. Se relee una vez, no N.
      try {
        const snap = await getDoc(doc(firestore, "tenants", tenantId!));
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
        const estado = typeof data?.status === "string" ? (data.status as TenantMembership["status"]) : undefined;
        memberships = memberships.map((m) => (m.tenantId === tenantId ? { ...m, status: estado } : m));
      } catch {
        // Sin estado, el selector no marca «solo lectura». No es motivo para
        // dejar a nadie fuera.
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
    memberships,
    tema: temaDelPerfil,
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
        memberships: cached.memberships ?? [],
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
            memberships: cached.memberships ?? [],
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
      // `CallableError` y no `Error`: el mensaje ya está en lenguaje de usuario
      // y así `normalizeFirebaseError` lo respeta en vez de caer al genérico.
      throw new CallableError(message);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const firebaseAuth = assertFirebaseConfigured();
    await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase());
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

    // refreshSessionProfile may have re-read stale Firestore data where
    // mustChangePassword is still true (backend write not yet propagated).
    // Re-apply the override so the app-shell guard never re-blocks the resident.
    setUser((prev) => {
      if (!prev || prev.mustChangePassword === false) return prev;
      const patched: SessionUser = {
        ...prev,
        mustChangePassword: false,
        temporaryPassword: false,
        passwordStatus: "updated",
      };
      saveSession(patched);
      debugAuth("[auth.force-change] stale-flag-patched", { uid: prev.uid });
      return patched;
    });
    setSession((prev) => {
      if (!prev || prev.profile.mustChangePassword === false) return prev;
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

    debugAuth("[auth.force-change] completed", { uid: sessionUser.uid });
  }, [refreshSessionProfile, user]);

  /**
   * **`PLAT-002` §5.2 — cambiar de conjunto.**
   *
   * Tres cosas, y la tercera es la regla de seguridad:
   *
   * 1. **Se comprueba la membresía antes de nada.** No porque proteja —no
   *    protege: elegir mal en el cliente no da acceso a nada, las reglas y las
   *    callables vuelven a comprobarlo (CF1, CF3)— sino para fallar aquí con un
   *    aviso claro en vez de en la primera consulta de la pantalla siguiente.
   * 2. **Se re-emite el claim del token al conjunto nuevo**, y esto NO es
   *    comodidad: `storage.rules` no puede leer la membresía —se intentó y
   *    rompió todas las subidas en el servicio real—, así que el claim tiene que
   *    seguir al conjunto activo o el segundo conjunto se queda sin documentos,
   *    sin comprobantes y sin adjuntos. El servidor comprueba la membresía antes
   *    de emitir. **Y hay que refrescar el token a la fuerza**: sin eso el claim
   *    nuevo no llega a las reglas.
   *
   * 3. **Se anota el último usado**, para aterrizar ahí la próxima vez (CA5). Va
   *    en `users/{uid}.lastActiveTenantId`, que es comodidad y no autoridad: si
   *    le revocan la membresía, se ignora y entra al selector sin error (CA6).
   *    **Y si esa escritura falla, el cambio se aborta con un aviso.** Suena
   *    excesivo para un campo de comodidad, y es al revés: como el paso
   *    siguiente recarga la página y la sesión se vuelve a resolver desde este
   *    campo, un fallo silencioso devolvería al conjunto anterior **sin decir
   *    nada** — justo después de que la persona pulsara para cambiar.
   * 4. **Se recarga la página entera.** No es pereza: §5.2 dice que limpiar el
   *    estado del conjunto anterior **es** la regla de seguridad, y CA4 exige
   *    que ninguna pantalla muestre un dato del anterior. Cincuenta y cinco
   *    ficheros leen `tenantId` de la sesión; garantizar CA4 revisándolos uno a
   *    uno es el riesgo que §12 marca como el mayor de esta PRD. Una recarga lo
   *    cierra de golpe y no puede olvidarse de un caso.
   */
  const switchTenant = useCallback(
    async (tenantId: string) => {
      const actual = user;
      if (!actual) throw new Error("Debes iniciar sesión para cambiar de conjunto.");
      if (tenantId === actual.tenantId) return;

      const destino = actual.memberships?.find((m) => m.tenantId === tenantId);
      if (!destino) {
        throw new Error("Ya no administras ese conjunto. Vuelve a entrar para actualizar tus accesos.");
      }

      // El claim, ANTES que nada: si esto falla, no se ha tocado nada todavía y
      // la persona sigue donde estaba. Al revés —anotar primero y emitir
      // después— dejaría `lastActiveTenantId` apuntando a un conjunto para el
      // que el token no sirve, y la recarga aterrizaría en una pantalla que no
      // puede leer sus archivos.
      try {
        await switchActiveTenantCallable(tenantId);
        // A la fuerza: sin refrescar, las reglas siguen viendo el claim viejo.
        if (auth?.currentUser) await getIdToken(auth.currentUser, true);
      } catch (claimError) {
        debugAuth("[auth.switch-tenant] claim-no-emitido", {
          uid: actual.uid,
          tenantId,
          error: claimError instanceof Error ? claimError.message : "unknown",
        });
        throw new Error("No fue posible cambiar de conjunto. Inténtalo de nuevo.");
      }

      if (db && actual.uid) {
        try {
          await updateDoc(doc(db, "users", actual.uid), { lastActiveTenantId: tenantId });
        } catch (lastActiveError) {
          debugAuth("[auth.switch-tenant] last-active-write-failed", {
            uid: actual.uid,
            tenantId,
            error: lastActiveError instanceof Error ? lastActiveError.message : "unknown",
          });
          throw new Error("No fue posible cambiar de conjunto. Inténtalo de nuevo.");
        }
      }

      // La sesión guardada y la cookie se dejan ya apuntando al conjunto nuevo:
      // la recarga las vuelve a leer, y si se quedaran atrás la pantalla nacería
      // en el conjunto viejo.
      const siguiente: SessionUser = {
        ...actual,
        tenantId,
        tenantName: destino.tenantName,
      };
      saveSession(siguiente);

      debugAuth("[auth.switch-tenant] reloading", { uid: actual.uid, tenantId });

      if (typeof window !== "undefined") {
        window.location.assign("/admin");
      }
    },
    [user],
  );

  const logout = useCallback(async () => {
    // El espejo del tema se borra AQUI y no cuando la sesion pasa a
    // «unauthenticated»: la pantalla de acceso no puede delatar el tema del
    // ultimo usuario del dispositivo, pero borrarlo en todo estado sin sesion
    // mataria el pintado sin destello, que es justo para lo que existe.
    borrarEspejo();
    aplicarTema(TEMA_POR_DEFECTO);
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
      requestPasswordReset,
      completeForcedPasswordChange,
      refreshSessionProfile,
      logout,
      switchTenant,
      hasAnyRole: (roles) => Boolean(user && roles.includes(user.role)),
    }),
    [user, session, status, loading, error, login, requestPasswordReset, completeForcedPasswordChange, refreshSessionProfile, logout, switchTenant],
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
