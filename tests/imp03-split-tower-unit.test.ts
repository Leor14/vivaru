// tests/imp03-split-tower-unit.test.ts
// BLOQUE 3 — splitTowerUnit() util (C3, shared)
// src/lib/utils/unit-display.ts

import { describe, expect, it } from "vitest";
import { splitTowerUnit } from "../src/lib/utils/unit-display";

describe("splitTowerUnit — con prefijo de torre", () => {
  it("'Torre 1-t2-503' → formatted 'Torre 1 / t2-503'", () => {
    const r = splitTowerUnit("Torre 1-t2-503");
    expect(r.formatted).toBe("Torre 1 / t2-503");
    expect(r.tower).toBe("Torre 1");
    expect(r.unit).toBe("t2-503");
  });

  it("'Torre Central-apt-101' → formatted 'Torre Central / apt-101'", () => {
    const r = splitTowerUnit("Torre Central-apt-101");
    expect(r.formatted).toBe("Torre Central / apt-101");
    expect(r.tower).toBe("Torre Central");
    expect(r.unit).toBe("apt-101");
  });

  it("'T2-503' → formatted 'T2 / 503' (prefijo mayúscula sin espacio)", () => {
    const r = splitTowerUnit("T2-503");
    expect(r.formatted).toBe("T2 / 503");
    expect(r.tower).toBe("T2");
    expect(r.unit).toBe("503");
  });

  it("'Torre 1-bloque-a-101' → captura TODO lo que sigue al primer guión", () => {
    const r = splitTowerUnit("Torre 1-bloque-a-101");
    expect(r.formatted).toBe("Torre 1 / bloque-a-101");
    expect(r.unit).toBe("bloque-a-101");
    // Bug previo de GuardReservations: tomaba solo "bloque", no "bloque-a-101"
    expect(r.unit).not.toBe("bloque");
  });
});

describe("splitTowerUnit — sin prefijo de torre (slug lowercase)", () => {
  it("'t2-503' → formatted 't2-503' sin barra", () => {
    const r = splitTowerUnit("t2-503");
    expect(r.formatted).toBe("t2-503");
    expect(r.tower).toBe("-");
  });

  it("'apt-101' → formatted 'apt-101' sin barra", () => {
    const r = splitTowerUnit("apt-101");
    expect(r.formatted).toBe("apt-101");
    expect(r.tower).toBe("-");
  });
});

describe("splitTowerUnit — edge cases", () => {
  it("string vacío '' → no crash, formatted vacío o '-'", () => {
    const r = splitTowerUnit("");
    expect(typeof r.formatted).toBe("string");
    expect(r.formatted === "" || r.formatted === "-").toBe(true);
  });

  it("undefined → formatted '-' sin crash", () => {
    const r = splitTowerUnit(undefined);
    expect(r.formatted).toBe("-");
    expect(r.tower).toBe("-");
    expect(r.unit).toBe("-");
  });

  it("sin guión 'Lobby' → formatted 'Lobby' (tower '-')", () => {
    const r = splitTowerUnit("Lobby");
    expect(r.formatted).toBe("Lobby");
    expect(r.tower).toBe("-");
  });

  it("corrección bug GuardReservations: string multi-guión retorna parte derecha completa", () => {
    // La función local en GuardReservations hacía: label.split("-")[1] → solo primer segmento post-dash
    // La nueva util toma label.slice(dashIdx + 1) → todo lo que sigue
    const r = splitTowerUnit("Torre 2-bloque-b-202");
    expect(r.unit).toBe("bloque-b-202");
    expect(r.formatted).toBe("Torre 2 / bloque-b-202");
  });
});
