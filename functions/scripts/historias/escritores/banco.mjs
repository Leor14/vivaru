// T1.6b · El banco: las líneas del extracto y su conciliación.
//
// Las líneas se DERIVAN de lo que ya está sembrado —cobros, egresos, rendimientos y traspasos—, que
// es lo que el banco habría mostrado. Se escriben con la forma de la importación del producto
// (`importBankStatementLines`): id `idDeLinea`, `naturalKey`, `reconciled: false`. Después se crean
// los casos con `asegurarCasos`, como hace el importador al terminar, y se concilian con `aplicarCaso`,
// el mismo escritor que usa la pantalla (contrato, sección D).
//
// **Un cobro es UNA línea por operación**, que es lo que llegó en una transferencia. La conciliación
// casa una línea con un solo asiento, así que la de un pago repartido en varios cargos (o con
// anticipo) queda pendiente: es lo que hace el producto hoy con ellos (hallazgo de la fase 1).

import { createRequire } from "node:module";

import { semilla } from "../azar.mjs";
import { crearSiFalta, firma, marcaDe } from "../motor.mjs";
import { instante } from "../reloj.mjs";

const require = createRequire(import.meta.url);
const conciliacion = require("../../../lib/conciliacion.js");
const casos = require("../../../lib/conciliacion-casos.js");
const { aMoneda } = require("../../../lib/payments.js");

const mayusculas = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * La clave de rastreo del movimiento, estable. Sin ella, dos pagos distintos del mismo día, importe,
 * ordenante y unidad (las dos parcialidades de la extraordinaria pagadas juntas) tenían la misma
 * clave natural, y la segunda línea se fundía con la primera: 11 en la primera corrida. La
 * importación del producto deduplica igual; un extracto real no choca porque cada SPEI trae su clave.
 */
const rastreo = (texto) => String(semilla(texto) % 10_000_000).padStart(7, "0");

/** Un depósito que nadie ha identificado todavía: la partida que la administración tiene que investigar. */
const SIN_IDENTIFICAR = { fecha: "2026-08-21", monto: 2150, descripcion: "DEPOSITO EN EFECTIVO SUC 0917" };

export function crearEscritoresDeBanco(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron } = historia;
  const operativa = padron.bancos.find((b) => b.clave === "operativa");
  const reserva = padron.bancos.find((b) => b.clave === "reserva");
  const cuentaPorId = new Map(padron.bancos.map((b) => [b.id, b]));
  const titularDe = new Map(padron.casas.map((c) => [c.id, padron.personas.find((p) => p.casaId === c.id && p.titular)?.fullName ?? ""]));

  async function delConjunto(coleccion) {
    const snap = await db.collection(coleccion).where("tenantId", "==", t).get();
    return new Map(snap.docs.map((d) => [d.id, d.data()]));
  }

  /** Las líneas que el banco habría mostrado en [desde, hasta], cada una con su pareja (o sin ella). */
  async function lineasDe(desde, hasta) {
    const [asientos, egresos, traspasos, cargos, recibos] = await Promise.all(
      ["ledgerEntries", "expenses", "treasuryTransfers", "billingStatements", "paymentVouchers"].map(delConjunto),
    );
    const ordenantePorOperacion = new Map([...recibos.values()].map((r) => [r.operationKey, r.payerName]));
    const enRango = (d) => d >= desde && d <= hasta;
    const lineas = [];
    const linea = (bankAccountId, date, amount, description, pareja) =>
      lineas.push({ datos: { tenantId: t, bankAccountId, date, amount: aMoneda(amount), description }, pareja });

    // Cobros: una línea por operación.
    const porOperacion = new Map();
    for (const [id, a] of asientos) {
      if (a.type !== "ingreso" || !["billingStatement", "advance"].includes(a.sourceType)) continue;
      if (a.bankAccountId !== operativa.id || !enRango(a.date) || a.amount <= 0) continue;
      const k = a.operationKey ?? id;
      if (!porOperacion.has(k)) porOperacion.set(k, []);
      porOperacion.get(k).push([id, a]);
    }
    for (const [clave, grupo] of porOperacion) {
      const deCobro = grupo.find(([, x]) => x.sourceType === "billingStatement")?.[1];
      const cargo = deCobro ? cargos.get(deCobro.sourceId) : null;
      const ordenante = ordenantePorOperacion.get(clave) || titularDe.get(cargo?.unitId) || "";
      const total = grupo.reduce((s, [, x]) => s + x.amount, 0);
      linea(
        operativa.id,
        grupo[0][1].date,
        total,
        mayusculas(`SPEI RECIBIDO ${ordenante} REF ${cargo?.unitLabel ?? ""} RASTREO ${rastreo(clave)}`),
        grupo.length === 1 ? { ledgerEntryId: grupo[0][0] } : null,
      );
    }

    // Egresos pagados desde el banco. La caja chica no pasa por el banco.
    for (const [id, a] of asientos) {
      if (a.type !== "egreso" || a.sourceType !== "expense" || a.bankAccountId !== operativa.id || !enRango(a.date)) continue;
      const proveedor = egresos.get(a.sourceId)?.vendorName ?? "";
      const texto = proveedor === "BBVA México" ? "COMISION POR MANEJO DE CUENTA" : proveedor.startsWith("CFE") ? "PAGO SERVICIO CFE SSB" : `SPEI ENVIADO ${proveedor}`;
      linea(operativa.id, a.date, -a.amount, `${mayusculas(texto).slice(0, 52)} ${rastreo(id)}`, { ledgerEntryId: id });
    }

    // Rendimientos del fondo: el asiento manual no lleva cuenta (la interfaz no la pide); el banco
    // los abona a la reserva, y la conciliación admite un asiento sin cuenta.
    for (const [id, a] of asientos) {
      if (a.type !== "ingreso" || a.sourceType !== "manual" || !enRango(a.date) || !id.startsWith(`${t}--rendimiento-`)) continue;
      linea(reserva.id, a.date, a.amount, "INTERESES GANADOS", { ledgerEntryId: id });
    }

    // Tesorería: los dos tramos de un traspaso, y el efectivo que sale hacia la caja chica.
    for (const [id, x] of traspasos) {
      if (x.status !== "registrado" || !enRango(x.date)) continue;
      if (x.kind === "traspaso") {
        linea(x.fromAccountId, x.date, -x.amount, `TRASPASO A CTA ${cuentaPorId.get(x.toAccountId)?.accountNumber.slice(-4)}`, { treasuryTransferId: id, tramo: "salida" });
        linea(x.toAccountId, x.date, x.amount, `TRASPASO DE CTA ${cuentaPorId.get(x.fromAccountId)?.accountNumber.slice(-4)}`, { treasuryTransferId: id, tramo: "entrada" });
      } else if (x.fromAccountId === operativa.id) {
        linea(operativa.id, x.date, -x.amount, "RETIRO EFECTIVO CAJA CHICA", { treasuryTransferId: id, tramo: "salida" });
      }
    }

    if (enRango(SIN_IDENTIFICAR.fecha)) linea(operativa.id, SIN_IDENTIFICAR.fecha, SIN_IDENTIFICAR.monto, SIN_IDENTIFICAR.descripcion, null);

    return lineas.map((l) => ({ ...l, id: conciliacion.idDeLinea(l.datos) }));
  }

  return {
    async extracto(ev) {
      if (ev.datos.desde > ev.datos.hasta) return;
      const marca = marcaDe(ev.fecha, ev.hora);
      const lote = `imp-${instante(ev.fecha, ev.hora).getTime()}`;
      const lineas = await lineasDe(ev.datos.desde, ev.datos.hasta);
      for (const l of lineas) {
        await crearSiFalta(ctx, "bankStatementLines", l.id, {
          bankAccountId: l.datos.bankAccountId,
          date: l.datos.date,
          description: l.datos.description,
          amount: l.datos.amount,
          naturalKey: conciliacion.claveNatural(l.datos),
          reconciled: false,
          matchedLedgerEntryId: null,
          importBatchId: lote,
          ...firma(ctx, marca),
        });
      }
      if (!ctx.escribir) return;
      for (const b of padron.bancos) {
        let r;
        do r = await casos.asegurarCasos({ tenantId: t, bankAccountId: b.id }, ctx.adminUid, "tenant_admin");
        while (r.truncated);
      }
      // Los casos nacen «ahora»: se fechan en la importación.
      for (const l of lineas) {
        const ref = db.collection("reconciliationCases").doc(l.id);
        const caso = (await ref.get()).data();
        if (!caso || caso.createdAt?.toMillis?.() === marca.toMillis()) continue;
        await ref.update({ createdAt: marca, history: (caso.history ?? []).map((h, i) => (i === 0 ? { ...h, cuando: marca } : h)) });
        ctx.manifiesto.anotar("reconciliationCases", l.id);
      }
    },

    async conciliacion(ev) {
      const marca = marcaDe(ev.fecha, ev.hora);
      const lineas = (await lineasDe("2000-01-01", ev.datos.hasta)).filter((l) => l.pareja);
      for (const l of lineas) {
        const linea = (await db.collection("bankStatementLines").doc(l.id).get()).data();
        if (!linea) continue;
        if (linea.reconciled) {
          ctx.cuenta("conciliaciones", "existe");
          continue;
        }
        if (!ctx.escribir) {
          ctx.cuenta("conciliaciones", "crearia");
          continue;
        }
        await casos.aplicarCaso({ tenantId: t, bankStatementLineId: l.id, ...l.pareja }, ctx.adminUid, "tenant_admin");
        // `aplicarCaso` sella con «hoy»: el día y la marca de la conciliación.
        if (l.pareja.ledgerEntryId) await db.collection("ledgerEntries").doc(l.pareja.ledgerEntryId).update({ reconciledAt: ev.fecha });
        const ref = db.collection("reconciliationCases").doc(l.id);
        const caso = (await ref.get()).data();
        if (caso?.history?.length) {
          await ref.update({ history: caso.history.map((h, i) => (i === caso.history.length - 1 ? { ...h, cuando: marca } : h)) });
        }
        ctx.cuenta("conciliaciones", "creado");
      }
    },
  };
}
