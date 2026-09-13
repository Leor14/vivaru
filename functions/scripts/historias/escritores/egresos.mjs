// T1.6a · Egresos, cuotas, prorrateo y tesorería.
//
// Lo que escribe el navegador se replica campo a campo (contrato, secciones C y D): el egreso con su
// asiento espejo (`createExpense` + `createExpenseLedgerEntry`), el traspaso (`registrarTraspaso`),
// la caja chica (`abrirCaja`, `reponerCaja`) y el asiento manual (`createManualLedgerEntry`). Lo que
// escribe el servidor va por sus escritores: el plan de cuotas y su pago (`guardarPlan`,
// `pagarCuota`) y el prorrateo por indiviso (`repartirEgreso`).
//
// Un egreso ya pagado nace pagado, con su asiento y su `ledgerEntryId`: sin ese enlace, la primera
// edición desde la interfaz crearía OTRO asiento (contrato, trampa 3). `paidAt` es la fecha
// histórica del pago, que es lo que el producto habría escrito ese día.

import { createRequire } from "node:module";

import { idDe } from "../lomas-de-sayilbedra.mjs";
import { crearSiFalta, fechar, firma, marcaDe } from "../motor.mjs";

const require = createRequire(import.meta.url);
const planDeCuentas = require("../../../lib/plan-de-cuentas.js");
const cuotasDeEgreso = require("../../../lib/egresos-en-cuotas.js");
const prorrateo = require("../../../lib/expense-distribution.js");
const pagos = require("../../../lib/payments.js");

export function crearEscritoresDeEgresos(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron } = historia;
  const bancos = new Map(padron.bancos.map((b) => [b.clave, b.id]));
  const proveedores = new Map(padron.proveedores.map((p) => [p.clave, p.legalName]));
  const caja = padron.caja;
  const cuentaDe = (clave) => (clave === "caja" ? caja.id : bancos.get(clave));
  const codigo = (categoria) => planDeCuentas.cuentaParaCategoriaDeEgreso(categoria).code;

  const datosDelEgreso = (d, marca) => ({
    category: d.categoria,
    accountCode: codigo(d.categoria),
    description: d.descripcion,
    vendorName: d.proveedor ? proveedores.get(d.proveedor) : (d.vendorName ?? null),
    vendorTaxId: null,
    amount: d.monto,
    issueDate: d.emision,
    checkNumber: null,
    supportFileUrl: null,
    supportFileName: null,
    supportFileStoragePath: null,
    ...firma(ctx, marca),
  });

  return {
    async egreso(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      const asientoId = idDe(t, `asiento-${ev.clave}`);
      const pagado = Boolean(d.pago);
      const bankAccountId = pagado ? cuentaDe(d.cuenta) : null;
      await crearSiFalta(ctx, "expenses", id, {
        ...datosDelEgreso(d, marcaDe(ev.fecha, ev.hora)),
        dueDate: d.vence ?? null,
        status: pagado ? "pagado" : "registrado",
        paymentMethod: pagado ? d.metodo : null,
        bankAccountId,
        paidAt: pagado ? d.pago : null,
        ledgerEntryId: pagado ? asientoId : null,
      });
      if (!pagado) return;
      await crearSiFalta(ctx, "ledgerEntries", asientoId, {
        type: "egreso",
        date: d.pago,
        amount: d.monto,
        concept: d.descripcion,
        category: d.categoria,
        accountCode: codigo(d.categoria),
        bankAccountId,
        sourceType: "expense",
        sourceId: id,
        reconciled: false,
        ...firma(ctx, marcaDe(d.pago, "12:00")),
      });
    },

    async "egreso-en-cuotas"(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      // El navegador lo da de alta SIN plan (la regla lo exige) y después guarda el calendario.
      await crearSiFalta(ctx, "expenses", id, {
        ...datosDelEgreso(d, marcaDe(ev.fecha, ev.hora)),
        dueDate: d.cuotas.at(-1).dueDate,
        status: "registrado",
        paymentMethod: null,
        bankAccountId: null,
        paidAt: null,
        ledgerEntryId: null,
      });
      if (!ctx.escribir) return ctx.cuenta("planes de cuotas", "crearia");
      if ((await db.collection("expenses").doc(id).get()).data()?.installments?.length) return ctx.cuenta("planes de cuotas", "existe");
      await cuotasDeEgreso.guardarPlan({ tenantId: t, expenseId: id, installments: d.cuotas }, ctx.adminUid);
      ctx.cuenta("planes de cuotas", "creado");
    },

    async "pago-cuota-egreso"(ev) {
      if (!ctx.escribir) return ctx.cuenta("cuotas de egreso pagadas", "crearia");
      const d = ev.datos;
      const expenseId = idDe(t, d.egreso);
      const res = await cuotasDeEgreso.pagarCuota(
        { tenantId: t, expenseId, installmentNumber: d.numero, paidAt: d.pago, paymentMethod: "transferencia", bankAccountId: bancos.get("operativa") },
        ctx.adminUid,
      );
      const marca = marcaDe(ev.fecha, ev.hora);
      const asientos = (await db.collection("ledgerEntries").where("sourceId", "==", expenseId).get()).docs
        .filter((x) => x.data().installmentNumber === d.numero)
        .map((x) => x.id);
      await fechar(ctx, "ledgerEntries", asientos, { createdAt: marca, updatedAt: marca });
      ctx.cuenta("cuotas de egreso pagadas", res?.yaPagada ? "existe" : "creado");
    },

    async prorrateo(ev) {
      if (!ctx.escribir) return ctx.cuenta("prorrateos", "crearia");
      const d = ev.datos;
      const marca = marcaDe(ev.fecha, ev.hora);
      const res = await prorrateo.repartirEgreso(
        { tenantId: t, expenseId: idDe(t, d.egreso), concept: "extraordinaria", period: d.periodo, dueDate: d.vence, operationKey: idDe(t, ev.clave) },
        ctx.adminUid,
      );
      await fechar(ctx, "billingCampaigns", [res.campaignId], { sentAt: marca, createdAt: marca, updatedAt: marca });
      const cargos = await db.collection("billingStatements").where("campaignId", "==", res.campaignId).get();
      await fechar(ctx, "billingStatements", cargos.docs.map((x) => x.id), { createdAt: marca, updatedAt: marca });
      ctx.cuenta("prorrateos", res.created === false ? "existe" : "creado");
    },

    async "apertura-caja"(ev) {
      const marca = marcaDe(ev.fecha, ev.hora);
      const desde = bancos.get(ev.datos.desde);
      await crearSiFalta(ctx, "pettyCashFunds", caja.id, {
        name: caja.name, limit: caja.limit, sourceAccountId: desde, status: "abierta", ...firma(ctx, marca),
      });
      await crearSiFalta(ctx, "treasuryTransfers", idDe(t, ev.clave), {
        fromAccountId: desde, toAccountId: caja.id, amount: caja.limit, date: ev.fecha, kind: "apertura", status: "registrado", ...firma(ctx, marca),
      });
    },

    async "reposicion-caja"(ev) {
      const id = idDe(t, ev.clave);
      if ((await db.collection("treasuryTransfers").doc(id).get()).exists) return ctx.cuenta("treasuryTransfers", "existe");
      if (!ctx.escribir) return ctx.cuenta("treasuryTransfers", "crearia");
      // Se repone lo gastado: el saldo de la caja vuelve a su fondo fijo.
      const entradas = (await db.collection("treasuryTransfers").where("toAccountId", "==", caja.id).get()).docs
        .map((x) => x.data())
        .filter((x) => x.status === "registrado" && x.date <= ev.fecha)
        .reduce((s, x) => s + x.amount, 0);
      const salidas = (await db.collection("ledgerEntries").where("bankAccountId", "==", caja.id).get()).docs
        .map((x) => x.data())
        .filter((x) => x.type === "egreso" && x.date <= ev.fecha && !x.reversedByEntryId)
        .reduce((s, x) => s + x.amount, 0);
      const importe = pagos.aMoneda(caja.limit - (entradas - salidas));
      if (importe <= 0) return ctx.cuenta("treasuryTransfers (nada que reponer)", "existe");
      await crearSiFalta(ctx, "treasuryTransfers", id, {
        fromAccountId: bancos.get("operativa"), toAccountId: caja.id, amount: importe, date: ev.fecha, kind: "reposicion", status: "registrado",
        ...firma(ctx, marcaDe(ev.fecha, ev.hora)),
      });
    },

    async traspaso(ev) {
      const d = ev.datos;
      await crearSiFalta(ctx, "treasuryTransfers", idDe(t, ev.clave), {
        fromAccountId: bancos.get(d.desde), toAccountId: bancos.get(d.hacia), amount: d.monto, date: ev.fecha, detail: d.detalle,
        kind: "traspaso", status: "registrado", ...firma(ctx, marcaDe(ev.fecha, ev.hora)),
      });
    },

    // El asiento manual de la interfaz: sin categoría, sin cuenta y sin cuenta contable.
    async rendimiento(ev) {
      const d = ev.datos;
      await crearSiFalta(ctx, "ledgerEntries", idDe(t, ev.clave), {
        type: "ingreso", date: ev.fecha, amount: d.monto, concept: d.concepto, category: null, bankAccountId: null,
        sourceType: "manual", sourceId: null, reconciled: false, ...firma(ctx, marcaDe(ev.fecha, ev.hora)),
      });
    },
  };
}
