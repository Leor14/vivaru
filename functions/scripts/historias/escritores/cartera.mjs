// T1.5 · Cartera y pagos, por los escritores del producto (`functions/lib`): la corrida por
// indiviso, `aplicarPago`, `cruzarAnticipo` y `revertirPago`. Lo único que se escribe a mano es lo
// que en el producto escribe el navegador: la multa suelta (`createBillingStatement`) y el
// comprobante que sube el residente (`confirmUpload`). Contrato, secciones B y G.
//
// **El importe de un pago se calcula aquí, al ejecutar**, sobre la deuda real de la casa en ese
// momento y con `repartirPorAntiguedad`, el mismo reparto que usa la pantalla de cobro.
//
// **Marcas técnicas.** Los escritores sellan `createdAt`/`sentAt` con «ahora»; aquí se reescriben
// al momento histórico, por id, en colecciones que no tienen disparador de `update` (plan §12.3).

import { createRequire } from "node:module";

import { imagenDeEjemplo, subir } from "../archivos.mjs";
import { semilla } from "../azar.mjs";
import { idDe } from "../lomas-de-sayilbedra.mjs";
import { crearSiFalta, fechar as fecharEnManifiesto, firma, marcaDe } from "../motor.mjs";
import { instante } from "../reloj.mjs";

const require = createRequire(import.meta.url);
const pagos = require("../../../lib/payments.js");
const anticipos = require("../../../lib/advances.js");
const corridas = require("../../../lib/coefficient-billing.js");

export function crearEscritoresDeCartera(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron } = historia;
  const casas = new Map(padron.casas.map((c) => [c.clave, c]));
  const operativa = padron.bancos.find((b) => b.clave === "operativa");
  const titularDe = (casa) => padron.personas.find((p) => p.casaId === casa.id && p.titular)?.fullName ?? null;
  const ADMIN = { uid: ctx.adminUid, rol: "tenant_admin" };

  const fechar = (coleccion, ids, campos) => fecharEnManifiesto(ctx, coleccion, ids, campos);

  /** Todo lo que un pago dejó escrito, apuntado y fechado en el momento del pago. */
  async function anotarPago(operationKey, marca) {
    await fechar("paymentOperations", [operationKey], { createdAt: marca });
    const porClave = async (coleccion, campo) => (await db.collection(coleccion).where(campo, "==", operationKey).get()).docs.map((d) => d.id);
    await fechar("ledgerEntries", await porClave("ledgerEntries", "operationKey"), { createdAt: marca, updatedAt: marca });
    await fechar("paymentVouchers", await porClave("paymentVouchers", "operationKey"), { createdAt: marca, updatedAt: marca });
    await fechar("advances", await porClave("advances", "sourceOperationKey"), { createdAt: marca, updatedAt: marca });
  }

  /**
   * Los cargos vivos de una casa hasta un periodo, pagados o no, **que ya existían en `momento`**.
   * Sin ese tope, una segunda corrida veía el futuro: el pago del 3 de julio «hasta julio» recogía
   * la extraordinaria que se prorrateó el día 7 y la pagaba con su clave (lo cazó la prueba de
   * idempotencia: «1 creado» en la segunda corrida). Los `createdAt` ya son históricos.
   */
  async function deLaCasa(casaId, hastaPeriodo, momento) {
    const tope = momento.getTime();
    const snap = await db.collection("billingStatements").where("unitId", "==", casaId).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.tenantId === t && c.status !== "cancelled" && String(c.period) <= hastaPeriodo)
      .filter((c) => (c.createdAt?.toMillis?.() ?? 0) <= tope);
  }

  /** Los que aún deben algo, como los ve el reparto. */
  async function abiertos(casaId, hastaPeriodo, momento) {
    return (await deLaCasa(casaId, hastaPeriodo, momento)).filter((c) => pagos.deudaDelCargo(c, ctx.hoyUTC) > 0);
  }

  /** Pagos del mismo momento, separados por minutos: el banco los lista en ese orden. */
  const masMinutos = (hora, n) => {
    const [h, m] = hora.split(":").map(Number);
    const total = h * 60 + m + n * 3;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  const deudaDe = (cargos) => pagos.aMoneda(cargos.reduce((s, c) => s + pagos.deudaDelCargo(c, ctx.hoyUTC), 0));

  async function yaHecho(operationKey, marca, que) {
    const previa = await db.collection("paymentOperations").doc(operationKey).get();
    if (!previa.exists) return false;
    await anotarPago(operationKey, marca);
    ctx.cuenta(que, "existe");
    return true;
  }

  async function aplicar({ operationKey, casa, cargos, importe, fecha, marca, payerName, statementId }) {
    const reparto = statementId ? { statementId } : { allocations: pagos.repartirPorAntiguedad(cargos, importe, ctx.hoyUTC).lineas };
    await pagos.aplicarPago(
      {
        tenantId: t,
        ...reparto,
        amount: importe,
        date: fecha,
        operationKey,
        source: "manual",
        payerName: payerName ?? titularDe(casa),
        payerTaxId: null,
        bankAccountId: operativa.id,
      },
      ADMIN.uid,
      ADMIN.rol,
    );
    await anotarPago(operationKey, marca);
  }

  return {
    async "corrida-cuotas"(ev) {
      if (!ctx.escribir) return ctx.cuenta("corridas", "crearia");
      const marca = marcaDe(ev.fecha, ev.hora);
      const { period, dueDate, totalAmount, concept } = ev.datos;
      const res = await corridas.generarCorridaPorCoeficiente(
        { tenantId: t, totalAmount, period, concept, dueDate, operationKey: idDe(t, ev.clave) },
        ADMIN.uid,
      );
      await fechar("billingCampaigns", [res.campaignId], { sentAt: marca, createdAt: marca, updatedAt: marca });
      const cargos = await db.collection("billingStatements").where("campaignId", "==", res.campaignId).get();
      await fechar("billingStatements", cargos.docs.map((d) => d.id), { createdAt: marca, updatedAt: marca });
      ctx.cuenta("corridas", res.created === false ? "existe" : "creado");
    },

    async pago(ev) {
      if (!ctx.escribir) return ctx.cuenta("pagos", "crearia");
      const base = idDe(t, ev.clave);
      const casa = casas.get(ev.datos.casa);

      // Repartido: UNA operación para varios cargos (y el sobrante, anticipo).
      if (ev.datos.repartido) {
        const marca = marcaDe(ev.fecha, ev.hora);
        if (await yaHecho(base, marca, "pagos repartidos")) return;
        const cargos = await abiertos(casa.id, ev.datos.hastaPeriodo, instante(ev.fecha, ev.hora));
        const importe = pagos.aMoneda(deudaDe(cargos) + (ev.datos.extra ?? 0));
        if (importe <= 0 || !cargos.length) return ctx.cuenta("pagos (sin deuda)", "existe");
        await aplicar({ operationKey: base, casa, cargos, importe, fecha: ev.fecha, marca });
        return ctx.cuenta("pagos repartidos", "creado");
      }

      // Un pago POR CARGO: la conciliación del producto casa una línea del banco con UN solo asiento,
      // y un pago repartido no se podría conciliar (hallazgo de la fase 1).
      const cargos = pagos.ordenarPorAntiguedad(await deLaCasa(casa.id, ev.datos.hastaPeriodo, instante(ev.fecha, ev.hora)));
      let n = 0;
      for (const cargo of cargos) {
        const operationKey = `${base}-${cargo.period}-${cargo.concept}`;
        const marca = marcaDe(ev.fecha, masMinutos(ev.hora, n));
        if (await yaHecho(operationKey, marca, "pagos")) {
          n += 1;
          continue;
        }
        const importe = pagos.deudaDelCargo(cargo, ctx.hoyUTC);
        if (importe <= 0) continue;
        await aplicar({ operationKey, casa, statementId: cargo.id, importe, fecha: ev.fecha, marca });
        ctx.cuenta("pagos", "creado");
        n += 1;
      }
      if (!n) ctx.cuenta("pagos (sin deuda)", "existe");
    },

    async "pago-equivocado"(ev) {
      if (!ctx.escribir) return ctx.cuenta("pagos", "crearia");
      const operationKey = idDe(t, ev.clave);
      const marca = marcaDe(ev.fecha, ev.hora);
      if (await yaHecho(operationKey, marca, "pagos")) return;
      const real = casas.get(ev.datos.casaReal);
      const destino = casas.get(ev.datos.casaDestino);
      const momento = instante(ev.fecha, ev.hora);
      const importe = deudaDe(await abiertos(real.id, ev.datos.hastaPeriodo, momento));
      const cargos = await abiertos(destino.id, "9999-12", momento);
      if (importe <= 0 || !cargos.length) return ctx.cuenta("pagos (sin deuda)", "existe");
      // El depositante es el de la casa real: es justo lo que delata el error en el recibo.
      await aplicar({ operationKey, casa: destino, cargos, importe, fecha: ev.fecha, marca, payerName: titularDe(real) });
      ctx.cuenta("pagos", "creado");
    },

    async "cruce-anticipo"(ev) {
      if (!ctx.escribir) return ctx.cuenta("cruces de anticipo", "crearia");
      const operationKey = idDe(t, ev.clave);
      const marca = marcaDe(ev.fecha, ev.hora);
      const marcador = `${t}_${operationKey}`;
      if ((await db.collection("paymentOperations").doc(marcador).get()).exists) return ctx.cuenta("cruces de anticipo", "existe");
      const casa = casas.get(ev.datos.casa);
      const vivos = (await db.collection("advances").where("unitId", "==", casa.id).get()).docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => a.tenantId === t && a.status === "open" && a.remaining > 0)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const cuota = (await abiertos(casa.id, ev.datos.periodo, instante(ev.fecha, ev.hora))).find((c) => c.period === ev.datos.periodo && c.concept === "administracion");
      if (!vivos.length || !cuota) return ctx.cuenta("cruces de anticipo (nada que cruzar)", "existe");
      const anticipo = vivos[0];
      const importe = pagos.aMoneda(Math.min(anticipo.remaining, pagos.deudaDelCargo(cuota, ctx.hoyUTC)));
      await anticipos.cruzarAnticipo(
        { tenantId: t, advanceId: anticipo.id, statementId: cuota.id, amount: importe, date: ev.fecha, operationKey },
        ADMIN.uid,
        ADMIN.rol,
      );
      await fechar("paymentOperations", [marcador], { createdAt: marca });
      const aplicaciones = (await db.collection("advanceApplications").where("advanceId", "==", anticipo.id).get()).docs
        .filter((d) => d.data().statementId === cuota.id)
        .map((d) => d.id);
      await fechar("advanceApplications", aplicaciones, { createdAt: marca });
      ctx.cuenta("cruces de anticipo", "creado");
    },

    async multa(ev) {
      const casa = casas.get(ev.datos.casa);
      const { monto, periodo, vence } = ev.datos;
      const marca = marcaDe(ev.fecha, ev.hora);
      // El estado que tenía al crearse; el final lo pone `recalcularEstados`.
      const { balance, status } = pagos.calcularSaldo(monto, 0, 0, vence, ev.fecha);
      await crearSiFalta(ctx, "billingStatements", idDe(t, ev.clave), {
        unitId: casa.id,
        unitLabel: casa.displayName,
        period: periodo,
        concept: "multa",
        accountCode: "1.3",
        campaignId: null,
        amount: monto,
        paymentAmount: 0,
        balance,
        dueDate: vence,
        source: "manual",
        status,
        lastPaymentAt: null,
        ...firma(ctx, marca),
      });
    },

    async "comprobante-subido"(ev) {
      const casa = casas.get(ev.datos.casa);
      const id = idDe(t, ev.clave);
      if ((await db.collection("paymentReceipts").doc(id).get()).exists) return ctx.cuenta("paymentReceipts", "existe");
      if (!ctx.escribir) return ctx.cuenta("paymentReceipts", "crearia");
      const uid = ctx.uids.get(ev.datos.cuenta);
      const cuota = (await abiertos(casa.id, ev.datos.periodo, instante(ev.fecha, ev.hora))).find((c) => c.period === ev.datos.periodo && c.concept === "administracion");
      if (!cuota || !uid) return ctx.cuenta("paymentReceipts (sin cuota abierta)", "existe");
      const importe = pagos.deudaDelCargo(cuota, ctx.hoyUTC);
      const ms = instante(ev.fecha, ev.hora).getTime();
      const nombre = `comprobante-spei-${ev.datos.periodo}${ev.datos.n > 1 ? `-${ev.datos.n}` : ""}.jpg`;
      const ruta = `tenants/${t}/payment-receipts/${uid}/${ms}-${nombre}`;
      const referencia = String(semilla(id) % 10_000_000).padStart(7, "0");
      const imagen = await imagenDeEjemplo({
        titulo: "Comprobante de transferencia SPEI",
        lineas: [
          `Fecha: ${ev.fecha} ${ev.hora}`,
          `Ordenante: ${titularDe(casa)}`,
          "Beneficiario: Asoc. de Colonos Lomas de Sayilbedra",
          `Cuenta destino: ****${operativa.accountNumber.slice(-4)}`,
          `Importe: $${importe.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`,
          `Concepto: Cuota ${ev.datos.periodo} ${casa.displayName}`,
          `Referencia: ${referencia}`,
        ],
      });
      const fileUrl = await subir(ctx, ruta, imagen, "image/jpeg");
      await crearSiFalta(ctx, "paymentReceipts", id, {
        unitId: casa.id,
        uploadedBy: uid,
        uploadedAt: marcaDe(ev.fecha, ev.hora),
        fileUrl,
        fileName: nombre,
        storagePath: ruta,
        amount: importe,
        status: "pending",
        statementId: cuota.id,
        bankAccountId: operativa.id,
      });
    },

    async "comprobante-revisado"(ev) {
      const id = idDe(t, `comprobante-${ev.datos.casa}-${ev.datos.periodo}-${ev.datos.n}`);
      const ref = db.collection("paymentReceipts").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return ctx.cuenta("revisiones (sin comprobante)", "existe");
      if (snap.data().status !== "pending") return ctx.cuenta("revisiones de comprobante", "existe");
      if (!ctx.escribir) return ctx.cuenta("revisiones de comprobante", "crearia");
      const marca = marcaDe(ev.fecha, ev.hora);
      if (ev.datos.decision === "rechazar") {
        await ref.update({
          status: "rejected",
          rejectedReason: ev.datos.motivo,
          reviewedAt: marca,
          reviewedBy: ADMIN.uid,
          reviewedByName: ctx.adminNombre,
        });
        return ctx.cuenta("revisiones de comprobante", "creado");
      }
      const r = snap.data();
      const operationKey = `receipt:${id}`;
      await pagos.aplicarPago(
        {
          tenantId: t,
          statementId: r.statementId,
          amount: r.amount,
          date: ev.fecha,
          operationKey,
          source: "receipt",
          receiptId: id,
          bankAccountId: r.bankAccountId ?? operativa.id,
          reviewerName: ctx.adminNombre,
        },
        ADMIN.uid,
        ADMIN.rol,
      );
      await anotarPago(operationKey, marca);
      await ref.update({ reviewedAt: marca });
      ctx.cuenta("revisiones de comprobante", "creado");
    },

    async reversion(ev) {
      if (!ctx.escribir) return ctx.cuenta("reversiones", "crearia");
      const operationKey = idDe(t, ev.datos.pago);
      const reversalKey = idDe(t, ev.clave);
      if ((await db.collection("paymentOperations").doc(reversalKey).get()).exists) {
        await anotarPago(reversalKey, marcaDe(ev.fecha, ev.hora));
        return ctx.cuenta("reversiones", "existe");
      }
      await pagos.revertirPago({ tenantId: t, operationKey, reversalKey, reason: ev.datos.motivo }, ADMIN.uid, ADMIN.rol);
      await anotarPago(reversalKey, marcaDe(ev.fecha, ev.hora));
      ctx.cuenta("reversiones", "creado");
    },

    /**
     * Deja cada cargo con el saldo y el estado que le da `calcularSaldo` HOY. Las corridas nacen en
     * `pending` aunque ya hayan vencido; sin esto, el cron de las 07:00 los pasaría a `overdue` y
     * avisaría a cada casa de golpe.
     */
    async recalcularEstados() {
      if (!ctx.escribir) return;
      const snap = await db.collection("billingStatements").where("tenantId", "==", t).get();
      const cambios = [];
      for (const d of snap.docs) {
        const c = d.data();
        if (c.status === "cancelled") continue;
        const { balance, status } = pagos.calcularSaldo(c.amount ?? 0, c.paymentAmount ?? 0, c.advanceAppliedAmount ?? 0, c.dueDate ?? undefined, ctx.hoyUTC);
        if (status !== c.status || Math.abs(balance - (c.balance ?? 0)) > pagos.TOLERANCIA_MONEDA) cambios.push([d.ref, { status, balance }]);
      }
      for (let i = 0; i < cambios.length; i += 400) {
        const lote = db.batch();
        for (const [ref, datos] of cambios.slice(i, i + 400)) lote.update(ref, datos);
        await lote.commit();
      }
      ctx.cuenta("cargos con estado recalculado", cambios.length ? "creado" : "existe");
    },
  };
}
