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
    updatedAt: nowIso,
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
