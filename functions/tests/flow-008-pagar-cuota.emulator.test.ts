import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import {
  anularCuota,
  anularEgresoConCuotas,
  estadoDerivado,
  guardarPlan,
  pagarCuota,
  sumarPagado,
} from "../src/egresos-en-cuotas";
import { sumarDeudaAProveedores } from "../src/nucleo-estado-financiero";

/**
 * `PRD-V-FLOW-008` entrega 2 — pagar y anular una cuota. `CA3`–`CA7`, `CA12`.
 *
 * El caso es **el de verdad**: la póliza del seguro que la administradora paga en
 * **once cuotas de 100** sobre una factura de **1.100**, y que hoy está en
 * producción registrada como un solo pago.
 *
 * Necesita el emulador:
 *   export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12.1+1/Contents/Home"
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "flow008-conjunto";
const ID = "flow008-poliza";
const ADMIN = "flow008-admin";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

const once = Array.from({ length: 11 }, (_, i) => ({
  number: i + 1,
  dueDate: `2026-${String(i + 1).padStart(2, "0")}-15`,
  amount: 100,
  status: "pendiente" as const,
}));

async function sembrar(extra: Record<string, unknown> = {}) {
  const asientos = await db.collection("ledgerEntries").where("tenantId", "==", T).get();
  await Promise.all(asientos.docs.map((d) => d.ref.delete()));
  await db.collection("expenses").doc(ID).set({
    tenantId: T,
    description: "Póliza de seguro del inmueble",
    category: "seguros",
    accountCode: "5.7",
    amount: 1_100,
    issueDate: "2026-01-02",
    status: "registrado",
    installments: once,
    ...extra,
  });
}

const leer = async () =>
  (await db.collection("expenses").doc(ID).get()).data() as {
    status: string;
    paidAmount?: number;
    paidAt?: string | null;
    voidReason?: string;
    installments: { number: number; amount: number; status: string; ledgerEntryId?: string; voidReason?: string; paidAt?: string }[];
  };

const asientos = async () =>
  (await db.collection("ledgerEntries").where("tenantId", "==", T).get()).docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[];

beforeEach(() => sembrar());

describe("FLOW-008 · `CA4` · pagar una cuota crea SU asiento", () => {
  it("paga 100 y nace UN asiento de 100, no uno de 1.100", async () => {
    const r = await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 3, paidAt: "2026-03-16" }, ADMIN);
    const libro = await asientos();
    expect(libro).toHaveLength(1);
    expect(libro[0].amount).toBe(100);
    expect(libro[0].date).toBe("2026-03-16");
    expect(libro[0].id).toBe(r.ledgerEntryId);
  });

  it("el asiento tiene la MISMA forma que el de un egreso sin plan", async () => {
    // Si tuviera otra forma, la conciliación dejaría de emparejarlo y el estado
    // financiero lo agruparía en otro sitio.
    await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN);
    const a = (await asientos())[0];
    expect(a.type).toBe("egreso");
    expect(a.sourceType).toBe("expense");
    expect(a.sourceId).toBe(ID);
    expect(a.reconciled).toBe(false);
    // La cuenta sale del egreso: NO se recalcula aquí.
    expect(a.accountCode).toBe("5.7");
    // Y lo único añadido, para poder volver del asiento a su cuota.
    expect(a.installmentNumber).toBe(1);
  });

  it("la cuota guarda su asiento, su fecha y quién pagó", async () => {
    const r = await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 2, paidAt: "2026-02-16" }, ADMIN);
    const c = (await leer()).installments.find((x) => x.number === 2)!;
    expect(c.status).toBe("pagada");
    expect(c.ledgerEntryId).toBe(r.ledgerEntryId);
    expect(c.paidAt).toBe("2026-02-16");
  });

  it("se puede pagar la 5 antes que la 3: la vida real no paga en orden", async () => {
    await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 5, paidAt: "2026-05-16" }, ADMIN);
    const e = await leer();
    expect(e.installments.find((c) => c.number === 5)!.status).toBe("pagada");
    expect(e.installments.find((c) => c.number === 3)!.status).toBe("pendiente");
  });

  it("la fecha del pago tiene que tener forma de fecha", async () => {
    await expect(
      pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "el martes" }, ADMIN),
    ).rejects.toThrow(/AAAA-MM-DD/);
  });

  it("pagar dos veces la misma cuota NO crea un segundo asiento", async () => {
    const a = await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN);
    const b = await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-20" }, ADMIN);
    expect(b.yaPagada).toBe(true);
    expect(b.ledgerEntryId).toBe(a.ledgerEntryId);
    expect(await asientos()).toHaveLength(1);
  });
});

describe("FLOW-008 · `CA3` · el estado del egreso es DERIVADO", () => {
  it("con cuotas pendientes sigue `registrado`, y `paidAmount` sube", async () => {
    await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN);
    const r = await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 2, paidAt: "2026-02-16" }, ADMIN);
    expect(r.expenseStatus).toBe("registrado");
    const e = await leer();
    expect(e.status).toBe("registrado");
    expect(e.paidAmount).toBe(200);
    // Mientras quede una cuota, la factura no tiene fecha de saldo.
    expect(e.paidAt ?? null).toBeNull();
  });

  it("al pagar la ÚLTIMA pasa a `pagado`, y con la fecha de esa cuota", async () => {
    for (const n of once.map((c) => c.number)) {
      await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: n, paidAt: `2026-${String(n).padStart(2, "0")}-16` }, ADMIN);
    }
    const e = await leer();
    expect(e.status).toBe("pagado");
    expect(e.paidAmount).toBe(1_100);
    expect(e.paidAt).toBe("2026-11-16");
    expect(await asientos()).toHaveLength(11);
  });

  it("`CA8` en vivo · la deuda baja cuota a cuota", async () => {
    expect(sumarDeudaAProveedores([await leer()] as never)).toBe(1_100);
    for (let n = 1; n <= 5; n++) {
      await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: n, paidAt: `2026-0${n}-16` }, ADMIN);
    }
    // Seis cuotas vivas de 100. A mano.
    expect(sumarDeudaAProveedores([await leer()] as never)).toBe(600);
  });

  it("`estadoDerivado` y `sumarPagado` no dependen de nada guardado", () => {
    expect(estadoDerivado(once)).toBe("registrado");
    expect(estadoDerivado(once.map((c) => ({ ...c, status: "pagada" as const })))).toBe("pagado");
    // Todas anuladas: no queda nada pendiente, así que la factura está cerrada.
    expect(estadoDerivado(once.map((c) => ({ ...c, status: "anulada" as const })))).toBe("pagado");
    expect(sumarPagado(once.map((c, i) => ({ ...c, status: i < 3 ? ("pagada" as const) : c.status })))).toBe(300);
  });
});

describe("FLOW-008 · `CA6` y `CA12` · anular una cuota", () => {
  it("`CA12` · anular SIN motivo lo rechaza el servidor", async () => {
    await expect(anularCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, reason: "" }, ADMIN)).rejects.toThrow(/exige un motivo/i);
    await expect(anularCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, reason: "   " }, ADMIN)).rejects.toThrow(/exige un motivo/i);
  });

  it("anular una cuota pendiente la saca de la deuda y conserva el motivo", async () => {
    await anularCuota({ tenantId: T, expenseId: ID, installmentNumber: 11, reason: "El proveedor perdonó la última." }, ADMIN);
    const e = await leer();
    const c = e.installments.find((x) => x.number === 11)!;
    expect(c.status).toBe("anulada");
    expect(c.voidReason).toBe("El proveedor perdonó la última.");
    // Diez vivas de 100.
    expect(sumarDeudaAProveedores([e] as never)).toBe(1_000);
  });

  it("`CA6` · una cuota PAGADA no se anula: dejó un asiento", async () => {
    await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN);
    await expect(
      anularCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, reason: "me equivoqué" }, ADMIN),
    ).rejects.toThrow(/ya está pagada/i);
  });

  it("una cuota anulada tampoco se paga", async () => {
    await anularCuota({ tenantId: T, expenseId: ID, installmentNumber: 4, reason: "no aplica" }, ADMIN);
    await expect(
      pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 4, paidAt: "2026-04-16" }, ADMIN),
    ).rejects.toThrow(/está anulada/i);
  });

  /**
   * **El caso que la entrega 1 resolvía mal**, ahora de punta a punta: el
   * proveedor perdona lo que queda y la factura deja de deber nada, aunque
   * `amount − paidAmount` diera 600.
   */
  it("pagadas 5 y anuladas las 6 restantes: la deuda es CERO", async () => {
    for (let n = 1; n <= 5; n++) {
      await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: n, paidAt: `2026-0${n}-16` }, ADMIN);
    }
    for (let n = 6; n <= 11; n++) {
      await anularCuota({ tenantId: T, expenseId: ID, installmentNumber: n, reason: "El proveedor perdonó el resto." }, ADMIN);
    }
    const e = await leer();
    expect(e.paidAmount).toBe(500);
    expect(sumarDeudaAProveedores([e] as never)).toBe(0);
    // Y la factura queda cerrada, porque no queda ninguna pendiente.
    expect(e.status).toBe("pagado");
  });
});

describe("FLOW-008 · `CA7` · anular el egreso CONSERVA lo pagado", () => {
  it("anula las pendientes y deja intactas las pagadas con su asiento", async () => {
    for (let n = 1; n <= 5; n++) {
      await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: n, paidAt: `2026-0${n}-16` }, ADMIN);
    }
    const r = await anularEgresoConCuotas({ tenantId: T, expenseId: ID, reason: "La factura estaba mal emitida." }, ADMIN);

    expect(r.cuotasAnuladas).toBe(6);
    expect(r.cuotasConservadas).toBe(5);

    const e = await leer();
    expect(e.status).toBe("anulado");
    expect(e.voidReason).toBe("La factura estaba mal emitida.");
    expect(e.installments.filter((c) => c.status === "pagada")).toHaveLength(5);
    expect(e.installments.filter((c) => c.status === "anulada")).toHaveLength(6);
    // **Los cinco asientos siguen ahí**: anular no borra dinero que ya salió.
    expect(await asientos()).toHaveLength(5);
    for (const c of e.installments.filter((x) => x.status === "pagada")) {
      expect(c.ledgerEntryId).toBeTruthy();
    }
  });

  it("anular exige motivo, y anular dos veces es idempotente", async () => {
    await expect(anularEgresoConCuotas({ tenantId: T, expenseId: ID, reason: "" }, ADMIN)).rejects.toThrow(/exige un motivo/i);
    await anularEgresoConCuotas({ tenantId: T, expenseId: ID, reason: "El primero." }, ADMIN);
    const otra = await anularEgresoConCuotas({ tenantId: T, expenseId: ID, reason: "Otro distinto." }, ADMIN);
    expect(otra.yaAnulado).toBe(true);
    expect((await leer()).voidReason).toBe("El primero.");
  });

  it("un egreso anulado ya no admite pagos", async () => {
    await anularEgresoConCuotas({ tenantId: T, expenseId: ID, reason: "mal emitida" }, ADMIN);
    await expect(
      pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN),
    ).rejects.toThrow(/está anulado/i);
  });
});

describe("FLOW-008 · las guardas que no dependen del conjunto", () => {
  it("un egreso de OTRO conjunto no se toca, aunque se sepa su id", async () => {
    await expect(
      pagarCuota({ tenantId: "otro", expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN),
    ).rejects.toThrow(/no pertenece a este conjunto/i);
    await expect(
      anularCuota({ tenantId: "otro", expenseId: ID, installmentNumber: 1, reason: "x" }, ADMIN),
    ).rejects.toThrow(/no pertenece a este conjunto/i);
  });

  it("un egreso SIN plan no se paga por aquí: se cambia su estado, como siempre", async () => {
    await db.collection("expenses").doc(ID).set({
      tenantId: T, amount: 500, status: "registrado", description: "Un egreso normal", category: "otros",
    });
    await expect(
      pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN),
    ).rejects.toThrow(/no tiene plan de cuotas/i);
  });

  it("una cuota que no existe no se inventa", async () => {
    await expect(
      pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 99, paidAt: "2026-01-16" }, ADMIN),
    ).rejects.toThrow(/no tiene una cuota 99/i);
  });
});

/**
 * `PRD-V-FLOW-008` · **`R8`** — declarar y editar el plan, ahora en el servidor.
 *
 * Lo que este camino garantiza y la escritura directa no:
 *   1. **el plan se valida aquí**, con la misma función del núcleo que el formulario;
 *   2. **solo entran número, fecha e importe**;
 *   3. **`paidAmount` y el estado se recalculan** de las cuotas resultantes.
 */
describe("FLOW-008 · `R8` · `guardarPlan`", () => {
  beforeEach(async () => {
    await db.collection("expenses").doc(ID).set({
      tenantId: T, description: "Póliza", category: "seguros", accountCode: "5.7",
      amount: 1_100, issueDate: "2026-01-02", status: "registrado",
    });
  });

  const plan = once.map((c) => ({ number: c.number, dueDate: c.dueDate, amount: c.amount }));

  it("declara el plan y recalcula lo pagado y el estado", async () => {
    const r = await guardarPlan({ tenantId: T, expenseId: ID, installments: plan }, ADMIN);
    expect(r).toMatchObject({ cuotas: 11, paidAmount: 0, expenseStatus: "registrado" });
    const e = await leer();
    expect(e.installments).toHaveLength(11);
    expect(e.installments.every((c) => c.status === "pendiente")).toBe(true);
  });

  it("**el plan se valida EN EL SERVIDOR**, no solo en el formulario", async () => {
    // Once cuotas de 99 sobre una factura de 1.100: faltan 11.
    await expect(
      guardarPlan({ tenantId: T, expenseId: ID, installments: plan.map((c) => ({ ...c, amount: 99 })) }, ADMIN),
    ).rejects.toThrow(/faltan 11/i);
  });

  it("y rechaza la numeración rota y la fecha ausente, con su motivo", async () => {
    await expect(
      guardarPlan({ tenantId: T, expenseId: ID, installments: [{ number: 2, dueDate: "2026-01-15", amount: 1_100 }] }, ADMIN),
    ).rejects.toThrow(/numeradas desde 1/i);
    await expect(
      guardarPlan({ tenantId: T, expenseId: ID, installments: [{ number: 1, dueDate: "", amount: 1_100 }] }, ADMIN),
    ).rejects.toThrow(/fecha de vencimiento/i);
  });

  /**
   * **El agujero de `R8`, cerrado.** Aunque alguien mande el estado y un asiento
   * inventado por HTTP, **no viajan**: el servidor toma solo los tres campos de
   * captura y conserva lo suyo de lo que ya había.
   */
  it("un `status` o un `ledgerEntryId` que lleguen desde fuera se IGNORAN", async () => {
    await guardarPlan(
      {
        tenantId: T, expenseId: ID,
        installments: plan.map((c) => ({ ...c, status: "pagada", ledgerEntryId: "inventado" })) as never,
      },
      ADMIN,
    );
    const e = await leer();
    expect(e.installments.every((c) => c.status === "pendiente")).toBe(true);
    expect(e.installments.every((c) => !c.ledgerEntryId)).toBe(true);
    expect(e.paidAmount).toBe(0);
  });

  it("editar el plan CONSERVA las cuotas ya pagadas y su asiento", async () => {
    await guardarPlan({ tenantId: T, expenseId: ID, installments: plan }, ADMIN);
    await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-01-16" }, ADMIN);

    // El formulario reenvía el plan sin lo que sella el servidor: es exactamente
    // lo que deshacía el pago antes de `fundirPlan`.
    await guardarPlan({ tenantId: T, expenseId: ID, installments: plan }, ADMIN);

    const e = await leer();
    const pagada = e.installments.find((c) => c.number === 1)!;
    expect(pagada.status).toBe("pagada");
    expect(pagada.ledgerEntryId).toBeTruthy();
    expect(e.paidAmount).toBe(100);
  });

  it("un egreso ANULADO ya no admite cambios de plan", async () => {
    await guardarPlan({ tenantId: T, expenseId: ID, installments: plan }, ADMIN);
    await anularEgresoConCuotas({ tenantId: T, expenseId: ID, reason: "mal emitida" }, ADMIN);
    await expect(
      guardarPlan({ tenantId: T, expenseId: ID, installments: plan }, ADMIN),
    ).rejects.toThrow(/está anulado/i);
  });

  it("un egreso de OTRO conjunto no se toca", async () => {
    await expect(
      guardarPlan({ tenantId: "otro", expenseId: ID, installments: plan }, ADMIN),
    ).rejects.toThrow(/no pertenece a este conjunto/i);
  });
});
