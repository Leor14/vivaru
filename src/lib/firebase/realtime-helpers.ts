import {
  addDoc,
  collection,
  type FirestoreError,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

function normalizeRealtimeError(collectionName: string, tenantId: string, error: unknown) {
  const firestoreError = error as FirestoreError;

  if (firestoreError?.code === "permission-denied") {
    if (collectionName === "amenities") {
      return "No tienes permisos para consultar disponibilidad de amenidades en este tenant.";
    }
    return "No tienes permisos para consultar esta informacion en tu tenant actual.";
  }

  if (firestoreError?.code === "unauthenticated") {
    return "Tu sesion expiro. Inicia sesion nuevamente para continuar.";
  }

  if (firestoreError?.code === "failed-precondition" && /requires an index/i.test(firestoreError.message)) {
    return "Estamos preparando el listado de unidades. Intenta nuevamente en unos minutos.";
  }

  if (!tenantId) {
    return "No se pudo identificar el tenant de la sesion actual.";
  }

  return "No fue posible cargar la informacion en este momento.";
}

export function subscribeTenantCollection<T extends { id: string }>(
  collectionName: string,
  tenantId: string,
  onData: (items: T[]) => void,
  onError: (message: string) => void,
  options?: {
    orderByField?: string;
    orderDirection?: "asc" | "desc";
    equals?: Array<{ field: string; value: string }>;
    /**
     * Igualdad contra un booleano. Va aparte de `equals` porque aquel tipa el
     * valor como `string`, y `where("active", "==", "true")` no encuentra nada
     * —compara contra la cadena— sin que Firestore se queje: devuelve cero
     * documentos, que se lee como «no hay cuentas» y no como «la consulta está
     * mal escrita».
     */
    equalsBoolean?: Array<{ field: string; value: boolean }>;
  },
) {
  if (!db) return null;

  const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId)];
  if (options?.equals?.length) {
    for (const filter of options.equals) {
      constraints.push(where(filter.field, "==", filter.value));
    }
  }
  if (options?.equalsBoolean?.length) {
    for (const filter of options.equalsBoolean) {
      constraints.push(where(filter.field, "==", filter.value));
    }
  }

  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDirection ?? "desc"));
  }

  return onSnapshot(
    query(collection(db, collectionName), ...constraints),
    (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
      onData(items);
    },
    (error) => {
      // Log técnico solo en consola
      console.error(`[firestore][${collectionName}]`, error);
      onError(normalizeRealtimeError(collectionName, tenantId, error));
    },
  );
}

/**
 * Lectura única (getDocs) de una colección del tenant. A diferencia de
 * subscribeTenantCollection no abre un listener en vivo — útil para vistas que
 * solo necesitan una foto (p. ej. el reporte de comité), reduciendo overhead.
 */
export async function fetchTenantCollection<T extends { id: string }>(
  collectionName: string,
  tenantId: string,
  options?: {
    orderByField?: string;
    orderDirection?: "asc" | "desc";
    equals?: Array<{ field: string; value: string }>;
    /**
     * Filtro por rango de fecha server-side (reduce documentos leídos). El campo
     * debe coincidir con orderByField y estar poblado consistentemente en todos
     * los documentos, o se perderían registros sin ese campo.
     */
    range?: { field: string; start: string; end: string };
  },
): Promise<T[]> {
  if (!db) return [];

  const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId)];
  if (options?.equals?.length) {
    for (const filter of options.equals) {
      constraints.push(where(filter.field, "==", filter.value));
    }
  }
  if (options?.range) {
    constraints.push(where(options.range.field, ">=", options.range.start));
    constraints.push(where(options.range.field, "<=", options.range.end));
  }
  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDirection ?? "desc"));
  }

  const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
}

export async function createTenantDocument(
  collectionName: string,
  tenantId: string,
  userId: string,
  payload: DocumentData,
) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  return addDoc(collection(db, collectionName), {
    ...payload,
    tenantId,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
