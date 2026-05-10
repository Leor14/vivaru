import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { SupportTicket } from "./types";

function assertDb() {
  if (!db) throw new Error("Firebase no está configurado en este entorno.");
  return db;
}

export async function createSupportTicket(
  data: Omit<SupportTicket, "id" | "createdAt" | "updatedAt" | "status">,
  createdByUid: string,
): Promise<string> {
  const firestore = assertDb();
  const ref = await addDoc(collection(firestore, "supportTickets"), {
    ...data,
    createdBy: createdByUid,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSupportTicket(
  ticketId: string,
  updates: Partial<Pick<SupportTicket, "status" | "priority" | "notes">>,
): Promise<void> {
  const firestore = assertDb();
  const payload: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  if (updates.status === "resolved") {
    payload.resolvedAt = serverTimestamp();
  }
  await updateDoc(doc(firestore, "supportTickets", ticketId), payload);
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
