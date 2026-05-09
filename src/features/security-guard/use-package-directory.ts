"use client";

import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";

type UnitRecord = {
  id: string;
  tenantId: string;
  displayName?: string;
  unitId?: string;
  tower?: string;
  status?: string;
};

type PersonRecord = {
  id: string;
  tenantId: string;
  fullName?: string;
  unitId?: string;
  status?: string;
};

export type PackageDirectoryUnit = {
  id: string;
  displayName: string;
  towerId: string;
};

export type PackageDirectoryResident = {
  id: string;
  fullName: string;
  unitId: string;
};

function parseTowerFromUnitLabel(value: string) {
  const [tower] = value.split("-");
  return tower?.trim() || "-";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || "active";
}

export function usePackageDirectory(tenantId?: string) {
  const [unitsRaw, setUnitsRaw] = useState<UnitRecord[]>([]);
  const [peopleRaw, setPeopleRaw] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setUnitsRaw([]);
      setPeopleRaw([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    let unitsLoaded = false;
    let peopleLoaded = false;

    function finishIfReady() {
      if (unitsLoaded && peopleLoaded) {
        setLoading(false);
      }
    }

    const unsubUnits = subscribeTenantCollection<UnitRecord>(
      "units",
      tenantId,
      (data) => {
        setUnitsRaw(data);
        setError(null);
        unitsLoaded = true;
        finishIfReady();
      },
      (message) => {
        setError(message);
        unitsLoaded = true;
        finishIfReady();
      },
    );

    const unsubPeople = subscribeTenantCollection<PersonRecord>(
      "people",
      tenantId,
      (data) => {
        setPeopleRaw(data);
        setError(null);
        peopleLoaded = true;
        finishIfReady();
      },
      (message) => {
        setError(message);
        peopleLoaded = true;
        finishIfReady();
      },
    );

    return () => {
      unsubUnits?.();
      unsubPeople?.();
    };
  }, [tenantId]);

  const units = useMemo<PackageDirectoryUnit[]>(() => {
    return unitsRaw
      .filter((item) => normalizeStatus(item.status) === "active")
      .map((item) => {
        const displayName = normalizeText(item.displayName) || normalizeText(item.unitId) || item.id;
        const towerId = normalizeText(item.tower) || parseTowerFromUnitLabel(displayName);
        return {
          id: item.id,
          displayName,
          towerId,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  }, [unitsRaw]);

  const residents = useMemo<PackageDirectoryResident[]>(() => {
    return peopleRaw
      .filter((item) => normalizeStatus(item.status) === "active")
      .map((item) => {
        const fullName = normalizeText(item.fullName);
        const unitId = normalizeText(item.unitId);
        return {
          id: item.id,
          fullName,
          unitId,
        };
      })
      .filter((item) => item.fullName.length > 0)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
  }, [peopleRaw]);

  const towers = useMemo(() => {
    return Array.from(new Set(units.map((item) => item.towerId)))
      .filter((towerId) => towerId.length > 0)
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [units]);

  const residentsByUnitId = useMemo(() => {
    const map = new Map<string, PackageDirectoryResident[]>();

    for (const resident of residents) {
      if (!resident.unitId) continue;
      const current = map.get(resident.unitId) ?? [];
      current.push(resident);
      map.set(resident.unitId, current);
    }

    return map;
  }, [residents]);

  return {
    towers,
    units,
    residents,
    residentsByUnitId,
    loading,
    error,
  };
}
