import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  addSupportNoteCallable,
  replyToSupportTicketCallable,
  updateSupportTicketStatusCallable,
} from "@/lib/firebase/callables";
import type { SupportTicket } from "./types";

function assertDb() {
  if (!db) throw new Error("Firebase no está configurado en este entorno.");
  return db;
}

/**
 * Cambia estado y prioridad. Va por callable: las reglas prohíben escribir en
 * `supportTickets` desde el cliente —también al superadmin— porque estas
 * operaciones mandan correo y sellan marcas de tiempo.
 *
 * El alta manual desapareció con PRD-V-FEAT-001: los tickets los abre el
 * administrador del conjunto desde su portal. Que el superadmin tecleara a
 * mano quién había reportado convertía la herramienta en una bitácora, no en
 * un canal.
 */
export async function updateSupportTicket(
  ticketId: string,
  updates: { status?: string; priority?: string },
): Promise<void> {
  await updateSupportTicketStatusCallable({ ticketId, ...updates });
}

/** Responde en el hilo como Vivaru. Deja el ticket esperando al cliente. */
export async function replyAsVivaru(ticketId: string, message: string): Promise<void> {
  await replyToSupportTicketCallable({ ticketId, message });
}

/** Nota interna. Va a la subcolección que el cliente no puede leer. */
export async function addInternalNote(ticketId: string, note: string): Promise<void> {
  await addSupportNoteCallable({ ticketId, note });
}

export function getSupportTicketsQuery(filters: {
  tenantId?: string;
  status?: string;
  priority?: string;
}): Query {
  const firestore = assertDb();
  const constraints: QueryConstraint[] = [];

  if (filters.tenantId) {
    constraints.push(where("tenantId", "==", filters.tenantId));
  }
  if (filters.status) {
    constraints.push(where("status", "==", filters.status));
  }
  if (filters.priority) {
    constraints.push(where("priority", "==", filters.priority));
  }

  constraints.push(orderBy("createdAt", "desc"));

  return query(collection(firestore, "supportTickets"), ...constraints);
}

export function watchSupportTickets(
  filters: { tenantId?: string; status?: string; priority?: string },
  onData: (tickets: SupportTicket[]) => void,
  onError: (message: string) => void,
) {
  const q = getSupportTicketsQuery(filters);
  return onSnapshot(
    q,
    (snapshot) => {
      const tickets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket);
      onData(tickets);
    },
    (error) => onError(error.message),
  );
}
