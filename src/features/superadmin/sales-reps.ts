import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

/**
 * Catálogo de comerciales (REVOPS-001E).
 *
 * Cinco personas venden en tres países y nada en el producto decía de quién es
 * cada lead ni quién vendió cada conjunto — y en México el canal se lleva $24
 * de un precio final de $51: lo que se pierde sin este dato no es una métrica,
 * es la comisión de una persona concreta.
 *
 * Es COLECCIÓN y no enumeración por decisión de David (17 ago 2026): «debería
 * crecer pero no de inmediato» — el sexto comercial entra sin desplegar.
 * No tienen cuenta ni portal: son registros para atribuir, no usuarios. Que un
 * KAM entre y vea su cartera es otro producto.
 *
 * Este esquema es a la vez el de Vivaru y la entrada del primer PRD de Albert
 * (ver docs/albert-vivaru-integracion.md): `crmRef` es el puente en los dos
 * sentidos — en el comercial, su identidad en Albert; en el lead, la
 * referencia del lead allí. Ninguno se rellena hacia atrás.
 */

export type SalesRepCountry = "MX" | "CO" | "EC";

export const SALES_REP_COUNTRY_LABEL: Record<SalesRepCountry, string> = {
  MX: "México",
  CO: "Colombia",
  EC: "Ecuador",
};

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** País del responsable — la base del enrutado por país cuando llegue. */
  country: SalesRepCountry;
  /** Un comercial que sale se APAGA, no se borra: sus atribuciones lo citan. */
  active: boolean;
  /** Su identidad en Albert CRM, cuando Albert la tenga. */
  crmRef?: string;
  createdAt?: string;
  updatedAt?: string;
}

function assertDb() {
  if (!db) throw new Error("Firestore no está disponible en este entorno.");
  return db;
}

export function watchSalesReps(
  onData: (items: SalesRep[]) => void,
  onError: (message: string) => void,
) {
  const firestore = assertDb();
  return onSnapshot(
    query(collection(firestore, "salesReps"), orderBy("name", "asc")),
    (snapshot) => {
      onData(
        snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: typeof data.name === "string" ? data.name : "—",
            email: typeof data.email === "string" ? data.email : "",
            phone: typeof data.phone === "string" ? data.phone : undefined,
            country: data.country === "CO" || data.country === "EC" ? data.country : "MX",
            active: data.active !== false,
            crmRef: typeof data.crmRef === "string" ? data.crmRef : undefined,
            createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
            updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
          } satisfies SalesRep;
        }),
      );
    },
    (error) => onError(error.message),
  );
}

/** Alta o edición. Sin `id` crea; con `id` sobreescribe los campos dados. */
export async function saveSalesRep(input: {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  country: SalesRepCountry;
  crmRef?: string;
}) {
  const firestore = assertDb();
  const ref = input.id
    ? doc(firestore, "salesReps", input.id)
    : doc(collection(firestore, "salesReps"));
  await setDoc(
    ref,
    {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      country: input.country,
      crmRef: input.crmRef?.trim() || null,
      ...(input.id ? {} : { active: true, createdAt: new Date().toISOString() }),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return ref.id;
}

export async function setSalesRepActive(repId: string, active: boolean) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "salesReps", repId), {
    active,
    updatedAt: new Date().toISOString(),
  });
}

/** Asigna (o quita, con null) el dueño de un lead. */
export async function assignLeadOwner(leadId: string, ownerId: string | null) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "leads", leadId), {
    ownerId,
    ownerAssignedAt: ownerId ? new Date().toISOString() : null,
    updatedAt: serverTimestamp(),
  });
}

/** Guarda la referencia del lead en el CRM (Albert). Vacío la borra. */
export async function setLeadCrmRef(leadId: string, crmRef: string) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "leads", leadId), {
    crmRef: crmRef.trim() || null,
    updatedAt: serverTimestamp(),
  });
}
