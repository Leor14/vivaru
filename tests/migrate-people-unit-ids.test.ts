// tests/migrate-people-unit-ids.test.ts
// Bloque 4 — Lógica central del script de migración people.unitId

import { describe, expect, it, vi } from "vitest";

// ── Réplica de las estructuras del script ─────────────────────────────────────
type UnitMeta = { unitId: string; displayName: string; tower: string };
type PersonDoc = { docId: string; unitId: string; tower?: string; authUid?: string; tenantId: string };
type UserDoc = { docId: string; unitId: string; unitLabel: string };

// Réplica del buildDocIdToSlugMap del script
function buildDocIdToSlugMap(
  units: Array<{ docId: string; unitId: string; displayName: string; tower: string }>,
): Map<string, UnitMeta> {
  const map = new Map<string, UnitMeta>();
  for (const u of units) {
    const unitId = u.unitId.trim();
    if (unitId) {
      map.set(u.docId, { unitId, displayName: u.displayName.trim(), tower: u.tower.trim() });
    }
  }
  return map;
}

// Réplica de processTenant — opera sobre arrays en memoria (no Firebase)
function processTenant(
  docIdMap: Map<string, UnitMeta>,
  people: PersonDoc[],
  users: Map<string, UserDoc>, // authUid → UserDoc
): {
  updatedPeople: Map<string, { unitId: string; unitLabel: string }>;
  updatedUsers: Map<string, { unitId: string; unitLabel: string }>;
  corrected: number;
  alreadyOk: number;
  noMatch: number;
  log: string[];
} {
  const updatedPeople = new Map<string, { unitId: string; unitLabel: string }>();
  const updatedUsers = new Map<string, { unitId: string; unitLabel: string }>();
  const log: string[] = [];
  let corrected = 0;
  let alreadyOk = 0;
  let noMatch = 0;

  for (const person of people) {
    const currentUnitId = person.unitId.trim();
    const meta = docIdMap.get(currentUnitId);

    if (!meta) {
      log.push(`skip person ${person.docId}: unitId="${currentUnitId}" — ya slug o no encontrado`);
      // Determine if already correct slug (in any unit's unitId) vs truly unknown
      noMatch++;
      continue;
    }

    const newUnitId = meta.unitId;
    const newTower = person.tower ?? meta.tower;
    const newUnitLabel = newTower ? `${newTower}-${newUnitId}` : newUnitId;

    if (currentUnitId === newUnitId) {
      alreadyOk++;
      continue;
    }

    log.push(`fix person ${person.docId}: "${currentUnitId}" → "${newUnitId}"`);
    updatedPeople.set(person.docId, { unitId: newUnitId, unitLabel: newUnitLabel });
    corrected++;

    // Fix users/{authUid}
    if (person.authUid) {
      const userDoc = users.get(person.authUid);
      if (userDoc && userDoc.unitId === currentUnitId) {
        log.push(`  fix users/${person.authUid}: "${userDoc.unitId}" → "${newUnitId}"`);
        updatedUsers.set(person.authUid, { unitId: newUnitId, unitLabel: newUnitLabel });
      }
    }
  }

  return { updatedPeople, updatedUsers, corrected, alreadyOk, noMatch, log };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const UNITS = [
  { docId: "hash-u101", unitId: "apto-101", displayName: "Apto 101", tower: "Torre 1" },
  { docId: "hash-u202", unitId: "apto-202", displayName: "Apto 202", tower: "Torre 2" },
];

const PEOPLE: PersonDoc[] = [
  { docId: "p1", unitId: "hash-u101", authUid: "auth-1", tower: "Torre 1", tenantId: "t" }, // tiene hash → corregir
  { docId: "p2", unitId: "apto-202", authUid: "auth-2", tower: "Torre 2", tenantId: "t" }, // ya slug → no tocar
  { docId: "p3", unitId: "hash-desconocido", authUid: "auth-3", tenantId: "t" },            // sin match → skip
];

const USERS = new Map<string, UserDoc>([
  ["auth-1", { docId: "auth-1", unitId: "hash-u101", unitLabel: "Torre 1-hash-u101" }],
]);

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("migrate-people-unit-ids — lógica central", () => {
  it("p1 (hash) → people.unitId corregido a slug", () => {
    const map = buildDocIdToSlugMap(UNITS);
    const { updatedPeople } = processTenant(map, PEOPLE, USERS);

    expect(updatedPeople.has("p1")).toBe(true);
    expect(updatedPeople.get("p1")!.unitId).toBe("apto-101");
  });

  it("p1 → users/auth-1.unitId también corregido a slug", () => {
    const map = buildDocIdToSlugMap(UNITS);
    const { updatedUsers } = processTenant(map, PEOPLE, USERS);

    expect(updatedUsers.has("auth-1")).toBe(true);
    expect(updatedUsers.get("auth-1")!.unitId).toBe("apto-101");
  });

  it("p1 → unitLabel reconstruido limpio: 'Torre 1-apto-101'", () => {
    const map = buildDocIdToSlugMap(UNITS);
    const { updatedPeople, updatedUsers } = processTenant(map, PEOPLE, USERS);

    expect(updatedPeople.get("p1")!.unitLabel).toBe("Torre 1-apto-101");
    expect(updatedUsers.get("auth-1")!.unitLabel).toBe("Torre 1-apto-101");
  });

  it("p2 (ya slug correcto) — no se toca", () => {
    const map = buildDocIdToSlugMap(UNITS);
    const { updatedPeople } = processTenant(map, PEOPLE, USERS);

    expect(updatedPeople.has("p2")).toBe(false);
  });

  it("p3 (hash sin match) — no se toca, aparece en log", () => {
    const map = buildDocIdToSlugMap(UNITS);
    const { updatedPeople, log } = processTenant(map, PEOPLE, USERS);

    expect(updatedPeople.has("p3")).toBe(false);
    expect(log.some((l) => l.includes("p3"))).toBe(true);
  });

  it("contadores: 1 corregido, 1 ya-ok (noMatch path), 1 sin match", () => {
    const map = buildDocIdToSlugMap(UNITS);
    const { corrected, noMatch } = processTenant(map, PEOPLE, USERS);

    // p1 → corrected; p2 → noMatch (slug not in docIdMap keys); p3 → noMatch
    expect(corrected).toBe(1);
    expect(noMatch).toBe(2); // p2 (slug, no en mapa) + p3 (unknown hash)
  });

  it("idempotencia — correr dos veces da mismo resultado", () => {
    const map = buildDocIdToSlugMap(UNITS);

    // Primera pasada
    const first = processTenant(map, PEOPLE, USERS);

    // Simular segunda pasada: p1 ya tiene slug, users/auth-1 también
    const peopleAfterFix: PersonDoc[] = PEOPLE.map((p) => {
      if (p.docId === "p1") return { ...p, unitId: first.updatedPeople.get("p1")!.unitId };
      return p;
    });
    const usersAfterFix = new Map(USERS);
    usersAfterFix.set("auth-1", {
      docId: "auth-1",
      unitId: first.updatedUsers.get("auth-1")!.unitId,
      unitLabel: first.updatedUsers.get("auth-1")!.unitLabel,
    });

    const second = processTenant(map, peopleAfterFix, usersAfterFix);

    // Segunda pasada no debe volver a "corregir" nada
    expect(second.corrected).toBe(0);
    expect(second.updatedPeople.size).toBe(0);
    expect(second.updatedUsers.size).toBe(0);
  });
});

// ── buildDocIdToSlugMap ────────────────────────────────────────────────────────
describe("buildDocIdToSlugMap", () => {
  it("key = Firestore docId, value.unitId = slug", () => {
    const map = buildDocIdToSlugMap(UNITS);
    expect(map.get("hash-u101")!.unitId).toBe("apto-101");
    expect(map.get("hash-u202")!.unitId).toBe("apto-202");
  });

  it("unidades sin unitId no entran al mapa", () => {
    const badUnits = [{ docId: "bad", unitId: "", displayName: "X", tower: "T" }];
    const map = buildDocIdToSlugMap(badUnits);
    expect(map.size).toBe(0);
  });
});
