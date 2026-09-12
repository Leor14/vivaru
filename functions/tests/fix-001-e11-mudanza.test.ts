process.env.TZ = "UTC";

import fs from "node:fs";
import path from "node:path";

import type { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { construirMudanza, type CrearMudanzaInput } from "../src/reservations";
import { formatRangeLabel } from "../src/time-range";

/**
 * `PRD-V-FIX-001` entrega 1.1 · `CA11` — la mudanza del residente, por el servidor.
 *
 * El 24 ago 2026 se cerró la escritura directa del residente en `reservations`
 * (paso 4), y la mudanza, que se creaba con `addDoc` desde el navegador, quedó
 * rota: la regla solo deja crear al administrador. Nadie lo vio porque en ningún
 * ambiente se ha pedido nunca una mudanza. Ahora la escribe una callable, con el
 * MISMO documento que escribía el cliente.
 */

const MX = "America/Mexico_City";
const AHORA = new Date("2026-09-12T14:00:00Z"); // 08:00 en Ciudad de México

const BASE: CrearMudanzaInput = {
  tenantId: "t-1",
  unitId: "u-1",
  unitLabel: "T1-101",
  date: "2026-09-13",
  startTime: "08:00",
  endTime: "12:00",
  requiresElevator: true,
  depositPaid: false,
  createdByName: "Ana",
};

// Las claves que escribía `createMudanzaReservation` desde el navegador hasta el 24 ago.
const CLAVES_DEL_CLIENTE = [
  "tenantId",
  "createdBy",
  "createdByName",
  "residentName",
  "updatedBy",
  "unitId",
  "amenityId",
  "amenity",
  "amenityName",
  "unitLabel",
  "date",
  "startTime",
  "endTime",
  "slot",
  "exclusiveUse",
  "kind",
  "mudanza",
  "status",
];

const construir = (input: Partial<CrearMudanzaInput> = {}, ahora = AHORA) =>
  construirMudanza({ ...BASE, ...input }, "uid-1", { ahora, zona: MX });

describe("FIX-001 e1.1 · construirMudanza — el documento de siempre", () => {
  it("lleva todas las claves que escribía el cliente, con sus valores fijos", () => {
    const r = construir();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const clave of CLAVES_DEL_CLIENTE) expect(r.documento).toHaveProperty(clave);
    expect(r.documento).toMatchObject({
      tenantId: "t-1",
      unitId: "u-1",
      unitLabel: "T1-101",
      createdBy: "uid-1",
      updatedBy: "uid-1",
      createdByName: "Ana",
      residentName: "Ana",
      amenityId: "mudanza",
      amenity: "Mudanza",
      amenityName: "Mudanza",
      kind: "mudanza",
      exclusiveUse: true,
      status: "pending",
      slot: formatRangeLabel(8 * 60, 12 * 60),
      mudanza: { requiresElevator: true, depositPaid: false },
    });
  });

  it("deja rastro de la vía y guarda el instante en la hora del conjunto", () => {
    const r = construir();
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.documento.createdVia).toBe("callable");
    expect((r.documento.startAt as Timestamp).toDate().toISOString()).toBe("2026-09-13T14:00:00.000Z");
  });
});

describe("FIX-001 e1.1 · construirMudanza — depósito y notas", () => {
  it("con depósito pagado guarda el monto", () => {
    const r = construir({ depositPaid: true, depositAmount: 500000 });
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.documento.mudanza).toEqual({ requiresElevator: true, depositPaid: true, depositAmount: 500000 });
  });

  it("sin depósito pagado no guarda un monto aunque llegue", () => {
    const r = construir({ depositPaid: false, depositAmount: 500000 });
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.documento.mudanza).not.toHaveProperty("depositAmount");
  });

  it("un monto negativo o que no es número se rechaza", () => {
    expect(construir({ depositPaid: true, depositAmount: -1 })).toMatchObject({ ok: false, regla: "datos_invalidos" });
    expect(construir({ depositPaid: true, depositAmount: Number.NaN })).toMatchObject({
      ok: false,
      regla: "datos_invalidos",
    });
  });

  it("las notas se guardan recortadas, y vacías no se guardan", () => {
    const con = construir({ additionalNotes: "  Llegamos con camión grande  " });
    const sin = construir({ additionalNotes: "   " });
    if (!con.ok || !sin.ok) throw new Error("debía pasar");
    expect((con.documento.mudanza as { additionalNotes?: string }).additionalNotes).toBe("Llegamos con camión grande");
    expect(sin.documento.mudanza).not.toHaveProperty("additionalNotes");
  });

  // El campo no tenía tope; el servidor pone 2000 y el asistente, el mismo, para
  // que el límite nunca sorprenda a quien escribe.
  it("unas notas de más de 2000 caracteres se rechazan", () => {
    expect(construir({ additionalNotes: "a".repeat(2000) }).ok).toBe(true);
    expect(construir({ additionalNotes: "a".repeat(2001) })).toMatchObject({ ok: false, regla: "datos_invalidos" });
  });

  // El asistente nunca mandó recibo; aceptar una URL cualquiera del cliente sería
  // abrir un enlace que el administrador pincha sin saber adónde va.
  it("no acepta un recibo por URL", () => {
    const r = construir({ receiptUrl: "https://example.com/x" } as Partial<CrearMudanzaInput>);
    if (!r.ok) throw new Error(r.mensaje);
    expect(r.documento.mudanza).not.toHaveProperty("receiptUrl");
    expect(r.documento).not.toHaveProperty("receiptUrl");
  });
});

describe("FIX-001 e1.1 · construirMudanza — rango y antelación", () => {
  it("fin antes del inicio es rango inválido", () => {
    expect(construir({ startTime: "12:00", endTime: "08:00" })).toMatchObject({ ok: false, regla: "rango_invalido" });
  });

  it("dentro de los 30 minutos, en la hora del conjunto, se rechaza", () => {
    expect(construir({ date: "2026-09-12", startTime: "08:20", endTime: "10:00" })).toMatchObject({
      ok: false,
      regla: "anticipacion",
    });
  });

  it("dos horas después, el mismo día y en la hora del conjunto, pasa", () => {
    expect(construir({ date: "2026-09-12", startTime: "10:00", endTime: "12:00" }).ok).toBe(true);
  });
});

describe("FIX-001 e1.1 · las dos callables autorizan igual", () => {
  // La mudanza no puede llevar su propia copia de «quién reserva para qué
  // unidad»: dos copias de una comprobación de permisos acaban divergiendo.
  it("createReservationRequest y createMudanzaRequest pasan por autorizarReserva", () => {
    const src = fs
      .readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const bloque = (nombre: string) => {
      const inicio = src.indexOf(`export const ${nombre} = onCall`);
      expect(inicio, `${nombre} no está exportada como callable`).toBeGreaterThan(-1);
      return src.slice(inicio, src.indexOf("\n);\n", inicio));
    };
    expect(bloque("createReservationRequest")).toMatch(/autorizarReserva\(/);
    expect(bloque("createMudanzaRequest")).toMatch(/autorizarReserva\(/);
    expect(bloque("createMudanzaRequest")).toMatch(/crearMudanza\(/);
  });
});
