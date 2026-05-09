"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { PackageItem } from "@/types/domain";

export function usePackages(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    const unsub = subscribeTenantCollection<PackageItem>(
      "packages",
      tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        console.error("[admin-dashboard:packages]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
      {
        orderByField: "arrivedAt",
        orderDirection: "desc",
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

export async function createPackage(input: {
  tenantId: string;
  userId: string;
  unitId?: string;
  unitLabel: string;
  reference: string;
  description?: string;
  registeredByName?: string;
}) {
  const derivedUnitId =
    input.unitId ??
    `unit-${input.unitLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

  await createTenantDocument("packages", input.tenantId, input.userId, {
    unitId: derivedUnitId,
    unitLabel: input.unitLabel,
    reference: input.reference,
    description: input.description?.trim() || "",
    status: "pending",
    arrivedAt: new Date().toISOString(),
    registeredBy: input.userId,
    registeredByName: input.registeredByName?.trim() || "",
  });
}

export async function createGuardPackage(input: {
  tenantId: string;
  userId: string;
  guardName?: string;
  towerId: string;
  unitId: string;
  unitLabel: string;
  residentId: string;
  residentName: string;
  description: string;
}) {
  const cleanTowerId = input.towerId.trim();
  const cleanUnitId = input.unitId.trim();
  const cleanUnitLabel = input.unitLabel.trim() || cleanUnitId;
  const cleanResidentId = input.residentId.trim();
  const cleanResidentName = input.residentName.trim();
  const cleanDescription = input.description.trim();
  const [towerValue, unitValue] = cleanUnitLabel.split("-");

  await createTenantDocument("packages", input.tenantId, input.userId, {
    towerId: cleanTowerId,
    unitId: cleanUnitId,
    unitLabel: cleanUnitLabel,
    residentId: cleanResidentId,
    residentName: cleanResidentName,
    recipientName: cleanResidentName,
    tower: towerValue?.trim() || cleanTowerId,
    unit: unitValue?.trim() || cleanUnitLabel,
    description: cleanDescription,
    reference: `PK-${Date.now()}`,
    status: "pending",
    arrivedAt: new Date().toISOString(),
    registeredBy: input.userId,
    registeredByName: input.guardName?.trim() || "",
    receivedByGuardId: input.userId,
    receivedByGuardName: input.guardName?.trim() || "",
  });
}

export async function confirmPackageReceived(input: {
  tenantId: string;
  packageId: string;
  userId: string;
  deliveredToId?: string;
  deliveredToName?: string;
}) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  const deliveredToId = input.deliveredToId?.trim() || input.userId;
  const deliveredToName = input.deliveredToName?.trim() || null;

  await updateDoc(doc(db, "packages", input.packageId), {
    status: "delivered",
    receivedBy: deliveredToId,
    deliveredToId,
    deliveredToName,
    deliveredBy: input.userId,
    receivedAt: serverTimestamp(),
    deliveredAt: serverTimestamp(),
    updatedBy: input.userId,
    updatedAt: serverTimestamp(),
  });
}
