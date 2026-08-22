"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { ExpenseCategory } from "@/types/domain";

/**
 * Registro de proveedores y beneficiarios (`PRD-V-FEAT-003`).
 *
 * Hasta ahora el proveedor NO existía como entidad: `Expense.vendorName` era
 * texto libre que se retecleaba en cada egreso, sin forma de saber cuánto se
 * le debe a nadie. Este registro le da identidad, datos bancarios —dónde
 * pagarle— y una categoría por defecto que preclasifica el gasto.
 *
 * Tres decisiones del contrato:
 *
 * - **`type` es obligatorio** (R9): un `empleado` es una persona y sus datos
 *   entran en la política de retención de 12 meses; una empresa no. La
 *   distinción tiene que estar en el dato.
 * - **Sin borrado** (R5): un proveedor con historia se desactiva. La regla de
 *   Firestore tiene `delete: if false` — no es solo convención de interfaz.
 * - **El egreso congela nombre e identificación** (R2/R3): editar el registro
 *   no reescribe a quién se le pagó hace un año. Eso se aplica en el punto de
 *   selección, no aquí.
 */

export type VendorType = "proveedor" | "empleado";

export type VendorItem = {
  id: string;
  tenantId: string;
  type: VendorType;
  taxId?: string;
  legalName: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  address?: string;
  representative?: string;
  bankName?: string;
  accountNumber?: string;
  accountType?: "corriente" | "ahorros";
  defaultCategory?: ExpenseCategory;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};

export type VendorFormValues = Omit<VendorItem, "id" | "tenantId" | "createdAt" | "updatedAt">;

export function useVendors(tenantId?: string) {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTenantCollection<VendorItem>(
      "vendors",
      tenantId,
      (items) => {
        setVendors([...items].sort((a, b) => a.legalName.localeCompare(b.legalName, "es-CO")));
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  return { vendors, loading, error };
}

/**
 * R4: la identificación, cuando existe, es única por conjunto. La regla no
 * puede consultarlo, así que se valida aquí ANTES de escribir — sobre la
 * lista ya suscrita, que es la misma que ve el formulario.
 */
export function findDuplicateTaxId(
  vendors: VendorItem[],
  taxId: string | undefined,
  excludeId?: string,
): VendorItem | null {
  const normalized = taxId?.trim();
  if (!normalized) return null;
  return (
    vendors.find((v) => v.id !== excludeId && (v.taxId ?? "").trim() === normalized) ?? null
  );
}

export async function createVendor(tenantId: string, userId: string, values: VendorFormValues) {
  const ref = await createTenantDocument("vendors", tenantId, userId, {
    ...sanitize(values),
  });
  return ref.id;
}

export async function updateVendor(id: string, userId: string, values: Partial<VendorFormValues>) {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");
  await updateDoc(doc(db, "vendors", id), {
    ...sanitize(values),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function setVendorStatus(id: string, userId: string, status: "active" | "inactive") {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");
  await updateDoc(doc(db, "vendors", id), {
    status,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

/** Firestore rechaza `undefined`: solo viaja lo que tiene valor. */
function sanitize<T extends Record<string, unknown>>(values: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && v !== ""),
  );
}
