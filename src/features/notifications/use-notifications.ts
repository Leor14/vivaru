"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { UserNotification } from "@/types/domain";

function toIsoDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (typeof value === "object") {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") {
      const converted = candidate.toDate();
      if (!Number.isNaN(converted.getTime())) return converted.toISOString();
    }
    if (typeof candidate.seconds === "number") {
      return new Date(candidate.seconds * 1000).toISOString();
    }
  }
  return undefined;
}

function mapNotification(id: string, data: DocumentData): UserNotification {
  const allowedTypes = ["package", "communication", "reservation", "visitor", "ticket", "system"] as const;
  const rawType = typeof data.type === "string" ? data.type : "";
  const normalizedType = allowedTypes.includes(rawType as (typeof allowedTypes)[number])
    ? (rawType as (typeof allowedTypes)[number])
    : "system";

  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    tenantId: typeof data.tenantId === "string" ? data.tenantId : undefined,
    type: normalizedType,
    title: typeof data.title === "string" ? data.title : "Notificacion",
    description: typeof data.description === "string" ? data.description : "",
    read: data.read === true,
    createdAt: toIsoDate(data.createdAt),
    link: typeof data.link === "string" && data.link.trim().length > 0 ? data.link : undefined,
  };
}

export function useNotifications(input: { userId?: string; tenantId?: string; limitCount?: number }) {
  const { userId, tenantId, limitCount = 30 } = input;
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !userId) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const constraints = [where("userId", "==", userId)];
    if (tenantId) {
      constraints.push(where("tenantId", "==", tenantId));
    }

    const q = query(collection(db, "notifications"), ...constraints, orderBy("createdAt", "desc"), limit(limitCount));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setItems(snapshot.docs.map((entry) => mapNotification(entry.id, entry.data())));
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("[notifications] subscription error", snapshotError);
        setError("No fue posible cargar las notificaciones.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [userId, tenantId, limitCount]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markAsRead = async (notificationId: string) => {
    if (!db) return;
    const previous = items;
    setItems((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[notifications] markAsRead failed", error);
      setItems(previous);
      setError("No fue posible actualizar el estado de lectura.");
    }
  };

  const markAllAsRead = async () => {
    if (!db || !userId) return;

    setItems((prev) => prev.map((item) => ({ ...item, read: true })));

    const constraints = [where("userId", "==", userId), where("read", "==", false)];
    if (tenantId) {
      constraints.push(where("tenantId", "==", tenantId));
    }

    try {
      const unreadQuery = query(collection(db, "notifications"), ...constraints, limit(200));
      const unread = await getDocs(unreadQuery);
      if (unread.empty) return;

      const batch = writeBatch(db);
      unread.docs.forEach((entry) => {
        batch.update(entry.ref, {
          read: true,
          readAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (error) {
      console.error("[notifications] markAllAsRead failed", error);
      setError("No fue posible marcar todas las notificaciones como leídas.");
    }
  };

  return {
    items,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
