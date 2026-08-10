import { describe, expect, it } from "vitest";

import { findOperation, type OperationDefinition } from "../src/ai/catalog";
import { counterIds, evaluateQuota, periodKeys } from "../src/ai/quota";

/**
 * Cuotas — parte pura, sin emulador (Paso 1.6 de docs/hoja-de-ruta-ia.md).
 *
 * La atomicidad se demuestra con peticiones simultáneas de verdad, y eso vive
 * en `ai-quota.emulator.test.ts`. Aquí va lo que se puede fijar sin base de
 * datos: la decisión, el orden de los mensajes y las claves de los contadores.
 */

const REAL = findOperation("comunicaciones-redactar") as OperationDefinition;
const CUOTA = { perTenantDay: 10, perTenantMonth: 100, perUserDay: 5 };

describe("evaluateQuota", () => {
  it("deja pasar cuando hay sitio e informa de lo que queda", () => {
    const d = evaluateQuota({ conjuntoDia: 2, conjuntoMes: 20, usuarioDia: 1 }, CUOTA);

    expect(d.ok).toBe(true);
    expect(d.restante).toEqual({ conjuntoDia: 8, conjuntoMes: 80, usuarioDia: 4 });
  });

  it("rechaza justo AL llegar al tope, no al pasarse", () => {
    // Con 10 de 10 ya no cabe una más: si dejara pasar la número 11, el tope
    // sería en realidad de once.
    const d = evaluateQuota({ conjuntoDia: 10, conjuntoMes: 20, usuarioDia: 1 }, CUOTA);
    expect(d).toMatchObject({ ok: false, excedida: "conjunto_dia" });
  });

  it("el mes gana al día — no se dice «vuelve mañana» si el mes se agotó", () => {
    const d = evaluateQuota({ conjuntoDia: 10, conjuntoMes: 100, usuarioDia: 5 }, CUOTA);
    expect(d).toMatchObject({ ok: false, excedida: "conjunto_mes" });
  });

  it("el conjunto gana al usuario", () => {
    const d = evaluateQuota({ conjuntoDia: 10, conjuntoMes: 20, usuarioDia: 5 }, CUOTA);
    expect(d).toMatchObject({ ok: false, excedida: "conjunto_dia" });
  });

  it("distingue el tope del usuario cuando el conjunto tiene sitio", () => {
    const d = evaluateQuota({ conjuntoDia: 0, conjuntoMes: 0, usuarioDia: 5 }, CUOTA);
    expect(d).toMatchObject({ ok: false, excedida: "usuario_dia" });
  });

  it("los tres mensajes de rechazo apuntan al camino manual", () => {
    // Si un mensaje deja de decirlo, alguien se queda mirando un error sin
    // saber que puede escribir la comunicación a mano.
    const casos = [
      { conjuntoDia: 0, conjuntoMes: 100, usuarioDia: 0 },
      { conjuntoDia: 10, conjuntoMes: 0, usuarioDia: 0 },
      { conjuntoDia: 0, conjuntoMes: 0, usuarioDia: 5 },
    ];

    for (const counts of casos) {
      const d = evaluateQuota(counts, CUOTA);
      expect(d.ok).toBe(false);
      expect(d.ok === false && d.message).toContain("proceso manual");
    }
  });

  it("nunca informa de un restante negativo", () => {
    const d = evaluateQuota({ conjuntoDia: 99, conjuntoMes: 999, usuarioDia: 99 }, CUOTA);
    expect(d.restante).toEqual({ conjuntoDia: 0, conjuntoMes: 0, usuarioDia: 0 });
  });
});

describe("claves de periodo y de contador", () => {
  it("las claves salen en UTC", () => {
    const { dia, mes } = periodKeys(new Date("2026-08-10T23:30:00.000Z"));
    expect(dia).toBe("2026-08-10");
    expect(mes).toBe("2026-08");
  });

  it("los contadores separan conjunto, mes y usuario", () => {
    const ids = counterIds("comunicaciones-redactar", "las-playas", "admin-1", new Date("2026-08-10T10:00:00Z"));

    expect(ids.conjuntoDia).toBe("t:las-playas:comunicaciones-redactar:d:2026-08-10");
    expect(ids.conjuntoMes).toBe("t:las-playas:comunicaciones-redactar:m:2026-08");
    expect(ids.usuarioDia).toBe("u:las-playas:admin-1:comunicaciones-redactar:d:2026-08-10");
  });

  it("dos conjuntos nunca comparten contador", () => {
    const a = counterIds("comunicaciones-redactar", "conjunto-a", "admin-1");
    const b = counterIds("comunicaciones-redactar", "conjunto-b", "admin-1");
    expect(a.conjuntoDia).not.toBe(b.conjuntoDia);
  });

  it("dos operaciones nunca comparten contador", () => {
    const a = counterIds("comunicaciones-redactar", "conjunto-a", "admin-1");
    const b = counterIds("otra-operacion", "conjunto-a", "admin-1");
    expect(a.conjuntoDia).not.toBe(b.conjuntoDia);
  });
});

describe("los números del catálogo", () => {
  it("toda operación declara sus tres topes, y son coherentes", () => {
    expect(REAL.quota.perUserDay).toBeGreaterThan(0);
    // Un tope de usuario mayor que el del conjunto no serviría de nada.
    expect(REAL.quota.perUserDay).toBeLessThanOrEqual(REAL.quota.perTenantDay);
    // Y un tope diario mayor que el mensual haría el mensual inalcanzable.
    expect(REAL.quota.perTenantDay).toBeLessThanOrEqual(REAL.quota.perTenantMonth);
  });

  it("el tope mensual cabe holgadamente en el presupuesto", () => {
    // Peor caso USD 0,0025 por llamada; el tope de la cuenta son ~USD 20.
    const costoMensualPeorCaso = REAL.quota.perTenantMonth * 0.0025;
    expect(costoMensualPeorCaso).toBeLessThan(1);
  });
});
