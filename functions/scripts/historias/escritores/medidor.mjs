// T1.7 · El medidor de agua, por los escritores del producto (`medicion-de-consumos`): lecturas con
// foto (`registrarLectura`), cierre del periodo (`cerrarPeriodo`) y la corrida de consumo
// (`generarCorridaDeConsumo`). La foto sube a la misma ruta que usa la pantalla
// (`uploadMeterPhoto`): `tenants/{t}/meter-readings/{servicio}/{unidad}-{periodo}.jpg`.
//
// **Idempotencia, a mano.** `registrarLectura` sobrescribe la lectura y la devuelve a «abierto»,
// y rechaza una ya cobrada: por eso se mira antes si existe. `cerrarPeriodo` falla si hay una
// cobrada: por eso se mira antes si ya está cerrado.

import { createRequire } from "node:module";

import { imagenDeEjemplo, subir } from "../archivos.mjs";
import { lecturaDe } from "../lomas-de-sayilbedra.mjs";
import { fechar, marcaDe } from "../motor.mjs";

const require = createRequire(import.meta.url);
const medicion = require("../../../lib/medicion-de-consumos.js");

const masMinutos = (hora, n) => {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + n;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export function crearEscritoresDelMedidor(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron } = historia;
  const servicio = padron.servicioMedido;
  const idLectura = (casaId, periodo) => `${t}_${servicio.id}_${casaId}_${periodo}`;

  async function delPeriodo(periodo) {
    const snap = await db.collection("meterReadings").where("serviceId", "==", servicio.id).get();
    return snap.docs.filter((d) => d.data().period === periodo && d.data().tenantId === t);
  }

  return {
    async lecturas(ev) {
      const { periodo } = ev.datos;
      for (const [i, casa] of padron.casas.entries()) {
        const id = idLectura(casa.id, periodo);
        if ((await db.collection("meterReadings").doc(id).get()).exists) {
          ctx.cuenta("meterReadings", "existe");
          continue;
        }
        if (!ctx.escribir) {
          ctx.cuenta("meterReadings", "crearia");
          continue;
        }
        const hora = masMinutos(ev.hora, i * 4);
        const lectura = lecturaDe(casa, periodo);
        const foto = await imagenDeEjemplo({
          titulo: "Lectura de medidor de agua",
          lineas: [casa.displayName, `Periodo: ${periodo}`, `Lectura: ${String(lectura).padStart(5, "0")} m³`, `Tomada: ${ev.fecha} ${hora}`],
          ancho: 640,
          alto: 640,
          fondo: "#EEF3F1",
        });
        const photoUrl = await subir(ctx, `tenants/${t}/meter-readings/${servicio.id}/${casa.id}-${periodo}.jpg`, foto, "image/jpeg");
        await medicion.registrarLectura({ tenantId: t, serviceId: servicio.id, unitId: casa.id, period: periodo, current: lectura, photoUrl, actorUid: ctx.adminUid });
        const marca = marcaDe(ev.fecha, hora);
        await fechar(ctx, "meterReadings", [id], { readAt: marca, updatedAt: marca });
        ctx.cuenta("meterReadings", "creado");
      }
    },

    async "cierre-lecturas"(ev) {
      const lecturas = await delPeriodo(ev.datos.periodo);
      if (lecturas.length && lecturas.every((d) => ["cerrado", "cobrado"].includes(d.data().status))) return ctx.cuenta("cierres de lecturas", "existe");
      if (!ctx.escribir) return ctx.cuenta("cierres de lecturas", "crearia");
      await medicion.cerrarPeriodo({ tenantId: t, serviceId: servicio.id, period: ev.datos.periodo, actorUid: ctx.adminUid });
      const marca = marcaDe(ev.fecha, ev.hora);
      await fechar(ctx, "meterReadings", lecturas.map((d) => d.id), { closedAt: marca, updatedAt: marca });
      ctx.cuenta("cierres de lecturas", "creado");
    },

    async "corrida-consumo"(ev) {
      if (!ctx.escribir) return ctx.cuenta("corridas de consumo", "crearia");
      const marca = marcaDe(ev.fecha, ev.hora);
      const res = await medicion.generarCorridaDeConsumo(
        { tenantId: t, serviceId: servicio.id, period: ev.datos.periodo, dueDate: ev.datos.vence },
        ctx.adminUid,
      );
      if (!res.campaignId) return ctx.cuenta("corridas de consumo (nada que cobrar)", "existe");
      await fechar(ctx, "billingCampaigns", [res.campaignId], { sentAt: marca, createdAt: marca, updatedAt: marca });
      const cargos = await db.collection("billingStatements").where("campaignId", "==", res.campaignId).get();
      await fechar(ctx, "billingStatements", cargos.docs.map((d) => d.id), { createdAt: marca, updatedAt: marca });
      ctx.cuenta("corridas de consumo", res.created === false ? "existe" : "creado");
    },
  };
}
