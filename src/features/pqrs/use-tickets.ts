"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { Ticket } from "@/types/domain";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asDateIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function normalizeTicket(raw: Ticket): Ticket {
  const createdAt = asDateIso(raw.createdAt);
  const updatedAt = asDateIso(raw.updatedAt) || createdAt;
  const radicationDate = asDateIso(raw.radicationDate) || createdAt || updatedAt;

  return {
    ...raw,
    category: raw.category || "pqrs",
    type: raw.type || "other",
    subject: asString(raw.subject) || asString(raw.message) || "PQRS sin asunto",
    message: asString(raw.message) || asString(raw.subject),
    status: (raw.status as Ticket["status"]) || "open",
    residentId: asString(raw.residentId) || asString(raw.createdBy),
    residentName: asString(raw.residentName) || "Residente",
    tower: asString(raw.tower),
    radicado: asString(raw.radicado) || `PQRS-${raw.id.slice(0, 8).toUpperCase()}`,
    createdAt,
    updatedAt,
    radicationDate,
    respondedAt: asDateIso(raw.respondedAt) || undefined,
  };
}

function toSortTimestamp(ticket: Ticket) {
  const candidates = [ticket.radicationDate, ticket.createdAt, ticket.updatedAt];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return 0;
}

export function useTickets(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    const unsub = subscribeTenantCollection<Ticket>(
      "tickets",
      tenantId,
      (data) => {
        const normalized = data.map((item) => normalizeTicket(item)).sort((a, b) => toSortTimestamp(a) - toSortTimestamp(b));
        setItems(normalized);
        setError(null);
        setLoading(false);
      },
      (message) => {
        console.error("[admin-dashboard:tickets]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
      {
        equals: unitId ? [{ field: "unitId", value: unitId }] : undefined,
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, unitId]);

  if (!tenantId) {
    return { items: [], loading: false, error: null };
  }

  if (!db) return { items: [], loading: false, error: "Firebase no esta configurado." };

  return { items, loading, error };
}

export async function createTicket(input: {
  tenantId: string;
  userId: string;
  unitId?: string;
  unitLabel: string;
  subject: string;
  residentName?: string;
  type?: Ticket["type"];
  message?: string;
}) {
  const derivedUnitId =
    input.unitId ??
    `unit-${input.unitLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

  const nowIso = new Date().toISOString();
  const subject = input.subject.trim();
  const message = (input.message || input.subject).trim();

  await createTenantDocument("tickets", input.tenantId, input.userId, {
    unitId: derivedUnitId,
    unitLabel: input.unitLabel,
    residentId: input.userId,
    residentName: input.residentName || "Residente",
    category: "pqrs",
    type: input.type || "other",
    subject,
    message,
    status: "open",
    radicado: `PQRS-${Date.now().toString().slice(-6)}`,
    radicationDate: nowIso,
    eventDate: nowIso.slice(0, 10),
    updatedAt: nowIso,
  });
}

/**
 * Fija o corrige la clasificación de un ticket — Fase 3 de `PRD-VAI-FEAT-002`.
 *
 * **Antes de esto no existía, y ese era el problema.** El administrador podía
 * responder y cambiar el estado, nada más: `category` nacía constante,
 * `type` lo elegía el residente y `priority` **no se escribía nunca** — el campo
 * solo vivía en el tipo de TypeScript. Un ticket mal clasificado no se podía
 * arreglar.
 *
 * Importa más allá de la pantalla: las dos puertas de G7 se cobran «contra la
 * decisión real del administrador» acumulada por la sombra. Sin un sitio donde
 * esa decisión ocurra, la sombra de la Fase 4 acumularía sugerencias contra un
 * hueco y las dos puertas seguirían sin poder medirse.
 *
 * **No la llama la IA.** La escribe una persona que pulsó guardar, con los
 * valores que dejó en pantalla; el asistente solo pudo proponer.
 */
export async function updateTicketClassification(input: {
  ticketId: string;
  tenantId: string;
  adminUserId: string;
  category: Ticket["category"];
  type: NonNullable<Ticket["type"]>;
  priority: NonNullable<Ticket["priority"]>;
}) {
  if (!db) {
    throw new Error("Firebase no esta configurado.");
  }

  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, "tickets", input.ticketId), {
    tenantId: input.tenantId,
    category: input.category,
    type: input.type,
    priority: input.priority,
    // Marca propia además de `updatedAt`: la sombra de la Fase 4 necesita saber
    // si un administrador llegó a tocar la clasificación, y `updatedAt` se mueve
    // también al responder, que es otra cosa.
    classifiedAt: nowIso,
    classifiedBy: input.adminUserId,
    updatedAt: nowIso,
    updatedBy: input.adminUserId,
  });
}

export async function respondTicket(input: {
  ticketId: string;
  tenantId: string;
  response: string;
  status: Ticket["status"];
  adminUserId: string;
  adminUserName?: string;
  previousHistory?: Ticket["responseHistory"];
}) {
  if (!db) {
    throw new Error("Firebase no esta configurado.");
  }

  const cleanResponse = input.response.trim();
  const nowIso = new Date().toISOString();
  const currentHistory = input.previousHistory ?? [];

  await updateDoc(doc(db, "tickets", input.ticketId), {
    tenantId: input.tenantId,
    response: cleanResponse,
    status: input.status,
    respondedBy: input.adminUserId,
    respondedByName: input.adminUserName || "Administrador",
    respondedAt: serverTimestamp(),
    updatedAt: nowIso,
    updatedBy: input.adminUserId,
    responseHistory: [
      ...currentHistory,
      {
        id: `rsp-${Date.now()}`,
        message: cleanResponse,
        status: input.status,
        createdAt: nowIso,
        createdBy: input.adminUserId,
        createdByName: input.adminUserName || "Administrador",
      },
    ],
  });
}
