"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { SupportTicket } from "@/features/support/types";

/**
 * Tickets de soporte del conjunto, en tiempo real.
 *
 * La consulta lleva `where("tenantId","==",...)` **obligatoriamente**: las
 * reglas de Firestore no filtran, rechazan. Sin ese filtro la consulta entera
 * se deniega, no devuelve un subconjunto (ver CLAUDE.md).
 *
 * Solo lectura: toda escritura va por callable, porque manda correo y sella
 * campos que el cliente no debe poder falsificar.
 */
export function useSupportTickets(tenantId: string | undefined) {
  const [items, setItems] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsub = onSnapshot(
      query(
        collection(db, "supportTickets"),
        where("tenantId", "==", tenantId),
        orderBy("lastActivityAt", "desc"),
      ),
      (snap) => {
        setItems(
          snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<SupportTicket, "id">) })),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("[soporte] no fue posible leer los tickets", err);
        setError("No fue posible cargar tus solicitudes de soporte.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tenantId]);

  return { items, loading, error };
}
