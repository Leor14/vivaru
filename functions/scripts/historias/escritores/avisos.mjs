// T1.9 · Los avisos: el buzón histórico de las cuentas con acceso, y la captura de los que la
// siembra dispara en un ambiente real (D6, plan §12.1).
//
// **El buzón histórico se deriva de los DATOS sembrados**, no del guion: por cada comunicado,
// encuesta, acuerdo, reglamento, cobro, recibo, paquete, reserva y PQRS de la casa, el aviso que su
// disparador habría dejado si la cuenta hubiera tenido membresía en ese momento, con los mismos
// textos (el catálogo del producto, `resolveNotificationCopy`) y la fecha del hecho. Van todos los
// campos, `description` y `link` incluidos: la regla de «marcar como leída» los compara sin `.get()`.
// La portería, solo las dos últimas semanas: su buzón real tendría cientos.
//
// **La captura** (D6): un aviso no guarda el id de su origen. Se buscan los nacidos desde que
// arrancó la corrida, dirigidos a la administración, a los superadmin o a las cuentas sembradas, con
// el conjunto en `tenantId` o en el texto, y se borran por id exacto. En el emulador no hay
// disparadores: esto solo se ejercita en staging (fase 2).

import { createRequire } from "node:module";
import { Timestamp } from "firebase-admin/firestore";

import { idDe } from "../lomas-de-sayilbedra.mjs";
import { crearSiFalta } from "../motor.mjs";
import { instante, sumarDias } from "../reloj.mjs";

const require = createRequire(import.meta.url);
const { resolveNotificationCopy } = require("../../../lib/notification-catalog.js");
const { frasesDelRecibo } = require("../../../lib/aviso-recibo.js");
const { terminoCuotaMensual } = require("../../../lib/vocabulario-pais.js");

// Espejos de `formatMoney`, `formatPeriodFromDate` y `BILLING_CONCEPT_LABELS`, privados de
// functions/src/index.ts: el texto tiene que ser el que habría puesto el disparador. Incluida su
// rareza: un cobro de consumo, que no está en la tabla, se anuncia como «Mantenimiento y
// Administración» (contrato, H.12).
const formatMoney = (valor) => `$${Math.round(valor).toLocaleString("es-CO")}`;
function formatPeriodFromDate(valor) {
  if (!valor) return "";
  const d = new Date(`${valor.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const texto = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
const BILLING_CONCEPT_LABELS = {
  administracion: "Mantenimiento y Administración",
  extraordinaria: "Cuota extraordinaria",
  multa: "Multa / sanción",
  reparacion: "Reparación / daño",
  interes_mora: "Interés de mora",
  parqueadero: "Parqueadero / amenidad",
  vigilancia: "Vigilancia / seguridad",
  otro: "Otro",
};

const milis = (v) => (typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "string" ? Date.parse(v) : NaN);

export async function sembrarAvisosHistoricos(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron, hoy } = historia;
  const inicioDeHoy = instante(hoy, "00:00").getTime();
  const leidos = instante(sumarDias(hoy, -3), "00:00").getTime();
  const conjunto = (await db.collection("tenants").doc(t).get()).data() ?? {};
  const deLaColeccion = async (c) => (await db.collection(c).where("tenantId", "==", t).get()).docs;
  const [comunicados, encuestas, acuerdos, documentos, paquetes, reservas, tickets, cargos, recibos, operaciones, pases] = await Promise.all(
    ["communications", "surveys", "committee_agreements", "documents", "packages", "reservations", "tickets", "billingStatements", "paymentVouchers", "paymentOperations", "visitorPasses"].map(deLaColeccion),
  );
  const sinConjunto = (id) => id.replace(`${t}--`, "");
  const delCatalogo = (clave, vars) => {
    const c = resolveNotificationCopy(clave, undefined, { conjunto: conjunto.name ?? "", ...vars });
    return { type: c.type, title: c.title, description: c.body, link: c.link };
  };

  // Lo que cubrió cada recibo, como `detalleDelRecibo`: la operación guarda el reparto.
  const porOperacion = new Map(operaciones.map((d) => [d.id, d.data()]));
  const cargoPorId = new Map(cargos.map((d) => [d.id, d.data()]));
  const termino = terminoCuotaMensual(conjunto.country);
  const detalleDelRecibo = (operationKey) => {
    const op = porOperacion.get(operationKey);
    if (!op) return { cargos: "", saldoAFavor: "" };
    const ids = (op.allocations ?? []).map((a) => a?.statementId).filter(Boolean);
    const unicos = [...new Set(ids.length ? ids : [op.statementId].filter(Boolean))];
    return frasesDelRecibo({
      cargos: unicos.map((id) => cargoPorId.get(id)).filter(Boolean),
      saldoAFavor: typeof op.advanceAmount === "number" ? op.advanceAmount : 0,
      terminoCuota: termino,
      formatMoney,
    });
  };

  const avisos = [];
  const agregar = (cuenta, origen, momento, copia) => {
    if (Number.isFinite(momento) && momento < inicioDeHoy) avisos.push({ cuenta, origen, momento, ...copia });
  };

  for (const cuenta of padron.cuentas.filter((c) => c.role === "resident" && c.acceso)) {
    const uid = ctx.uids.get(cuenta.clave);
    const casa = padron.casas.find((c) => c.id === cuenta.casaId);
    for (const d of comunicados) {
      const c = d.data();
      agregar(cuenta, `comunicado-${sinConjunto(d.id)}`, milis(c.createdAt), {
        type: "communication", title: c.title?.trim() || "Nuevo comunicado",
        description: c.notificationSummary?.trim() || "La administracion publico un nuevo comunicado.", link: "/resident/communications",
      });
    }
    for (const d of encuestas) agregar(cuenta, `encuesta-${sinConjunto(d.id)}`, milis(d.data().publishedAt), delCatalogo("survey_new", {}));
    for (const d of acuerdos) {
      const a = d.data();
      agregar(cuenta, `acuerdo-${sinConjunto(d.id)}`, milis(a.sentAt), delCatalogo(a.signatureMode === "informativo" ? "agreement_info" : "agreement_signature", { fecha: a.sessionDate ?? "" }));
    }
    for (const d of documentos) {
      if (d.data().category === "reglamento") agregar(cuenta, `reglamento-${sinConjunto(d.id)}`, milis(d.data().createdAt), delCatalogo("regulation_new", {}));
    }
    for (const d of paquetes) {
      const p = d.data();
      if (p.unitId !== casa.id) continue;
      agregar(cuenta, `paquete-${sinConjunto(d.id)}`, milis(p.arrivedAt), {
        type: "package", title: "Nuevo paquete registrado", description: `Se registro un paquete para tu unidad ${p.unitLabel ?? ""}.`.trim(), link: "/resident/packages",
      });
    }
    for (const d of reservas) {
      const r = d.data();
      if (r.createdBy !== uid) continue;
      // La que nació aprobada avisó al crearse (aunque luego se cancelara); la de la casa club, al aprobarla.
      const cuando = r.autoApproved === true ? milis(r.createdAt) : r.status === "approved" ? milis(r.updatedAt) : NaN;
      agregar(cuenta, `reserva-${sinConjunto(d.id)}`, cuando, {
        type: "reservation", title: "Reserva aprobada", description: `Tu reserva de ${r.amenity ?? "amenidad"} fue aprobada.`, link: "/resident/reservations",
      });
    }
    for (const d of tickets) {
      const k = d.data();
      if (k.residentId !== uid || !(k.status === "responded" || k.status === "resolved" || k.response)) continue;
      agregar(cuenta, `pqrs-${sinConjunto(d.id)}`, milis(k.respondedAt), delCatalogo("ticket_answered", { asunto: k.subject ?? "" }));
    }
    const vencimientos = new Set();
    for (const d of cargos) {
      const c = d.data();
      if (c.unitId !== casa.id || c.status === "cancelled") continue;
      if (c.source !== "import") {
        agregar(cuenta, `cobro-${d.id}`, milis(c.createdAt), delCatalogo("billing_new", {
          período: c.period ?? "", concepto: BILLING_CONCEPT_LABELS[c.concept ?? "administracion"] ?? "Mantenimiento y Administración",
          monto: formatMoney(c.amount ?? c.balance ?? 0), unidad: c.unitLabel ?? "",
        }));
      }
      // `updateOverdueStatements` marca a las 07:00 UTC del día de vencimiento lo que siga pendiente.
      const cubierto = (c.paymentAmount ?? 0) + (c.advanceAppliedAmount ?? 0) >= (c.amount ?? 0) - 0.01;
      if (c.dueDate && c.dueDate < hoy && !(cubierto && (!c.lastPaymentAt || c.lastPaymentAt < c.dueDate))) vencimientos.add(c.dueDate);
    }
    for (const dia of vencimientos) agregar(cuenta, `mora-${dia}`, instante(dia, "01:00").getTime(), delCatalogo("billing_overdue", { unidad: casa.displayName }));
    for (const d of recibos) {
      const v = d.data();
      if (v.payerUnitId !== casa.id) continue;
      agregar(cuenta, `recibo-${d.id}`, milis(v.createdAt), delCatalogo("billing_receipt", { período: formatPeriodFromDate(v.issueDate), ...detalleDelRecibo(v.operationKey) }));
    }
  }

  const porteria = padron.cuentas.find((c) => c.role === "security_guard" && c.acceso);
  if (porteria) {
    const desde = instante(sumarDias(hoy, -14), "00:00").getTime();
    for (const d of pases) {
      const p = d.data();
      const m = milis(p.createdAt);
      if (!(m >= desde)) continue;
      const visitante = p.visitorName ?? "Visitante";
      agregar(porteria, `visita-${sinConjunto(d.id)}`, m, {
        type: "visitor", title: "Nuevo visitante registrado", description: `${visitante} ${p.unitLabel ? `para ${p.unitLabel}` : ""}`.trim(), link: "/guard/visitors",
      });
      // `isTodayDateString` compara con el día del servidor, que es UTC.
      if (p.date === new Date(m).toISOString().slice(0, 10)) {
        agregar(porteria, `visita-hoy-${sinConjunto(d.id)}`, m, {
          type: "visitor", title: "Visitante programado para hoy", description: `${visitante} tiene ingreso programado hoy.`, link: "/guard/visitors",
        });
      }
    }
    for (const d of paquetes) {
      const p = d.data();
      const m = milis(p.arrivedAt);
      if (!(m >= desde)) continue;
      agregar(porteria, `paquete-${sinConjunto(d.id)}`, m, {
        type: "package", title: "Paquete pendiente de entrega", description: `Nuevo paquete pendiente ${p.unitLabel ? `(${p.unitLabel})` : ""}.`.trim(), link: "/guard/packages",
      });
    }
  }

  for (const a of avisos) {
    const uid = ctx.uids.get(a.cuenta.clave);
    if (!uid || uid.startsWith("simulado:")) {
      ctx.cuenta("notifications", "crearia");
      continue;
    }
    await crearSiFalta(ctx, "notifications", idDe(t, `aviso-${a.cuenta.clave}-${a.origen}`), {
      userId: uid, type: a.type, title: a.title, description: a.description,
      read: a.momento < leidos, createdAt: Timestamp.fromMillis(a.momento), link: a.link ?? null,
    });
  }
}

/**
 * D6. Fase «historia»: los avisos de tipo PQRS y reserva que dejaron `onTicketCreated` y
 * `onReservationCreated` (a la administración, a los superadmin y, en las reservas que nacen
 * aprobadas, al residente). Fase «hoy»: todo lo del superadmin, que no es parte de la demo. Espera
 * a que dejen de llegar —los disparadores corren aparte, segundos después de cada escritura— hasta
 * el número esperado, o tres lecturas seguidas iguales, y los borra por id exacto.
 */
export async function capturarAvisos(ctx, { desde, fase, creados = null }) {
  const db = ctx.db;
  const t = ctx.tenantId;
  const superadmins = new Set((await db.collection("users").where("role", "==", "superadmin").get()).docs.map((d) => d.data().uid ?? d.id));
  const admins = (await db.collection("tenantUsers").where("tenantId", "==", t).where("role", "==", "tenant_admin").get()).docs
    .map((d) => d.data())
    .filter((m) => (m.status ?? "active") === "active")
    .map((m) => m.uid);
  const destinatarios = fase === "historia" ? new Set([...admins, ...superadmins, ...ctx.uids.values()]) : superadmins;
  const esperados = creados ? (creados.tickets + creados.reservas) * (admins.length + superadmins.size) + creados.avisanAlResidente : null;

  const buscar = async () => {
    const encontrados = new Map();
    for (const uid of destinatarios) {
      if (!uid || String(uid).startsWith("simulado:")) continue;
      const snap = await db.collection("notifications").where("userId", "==", uid).where("createdAt", ">=", Timestamp.fromDate(desde)).get();
      for (const d of snap.docs) {
        const n = d.data();
        if (n.tenantId !== t && !String(n.description ?? "").includes(t)) continue;
        if (fase === "historia" && !["ticket", "reservation"].includes(n.type)) continue;
        encontrados.set(d.id, d.ref);
      }
    }
    return encontrados;
  };

  let encontrados = await buscar();
  let iguales = 0;
  for (let i = 0; i < 18 && (esperados === null ? iguales < 3 : encontrados.size < esperados); i += 1) {
    await new Promise((r) => setTimeout(r, 10_000));
    const otra = await buscar();
    iguales = otra.size === encontrados.size ? iguales + 1 : 0;
    encontrados = otra;
  }
  console.log(`  avisos de la fase «${fase}» capturados: ${encontrados.size}${esperados !== null ? ` de ${esperados} esperados` : ""}`);
  if (esperados !== null && encontrados.size !== esperados) console.warn(`  ⚠ se esperaban ${esperados}: mirar antes de dar la corrida por buena`);
  const lista = [...encontrados.values()];
  for (let i = 0; i < lista.length; i += 400) {
    const lote = db.batch();
    for (const r of lista.slice(i, i + 400)) lote.delete(r);
    await lote.commit();
  }
  for (let i = 0; i < lista.length; i += 1) ctx.cuenta(`notifications (D6, ${fase})`, "borrados");
  return lista.length;
}
