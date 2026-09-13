// T1.8 · La operación: comunicados, encuestas, acuerdos del consejo, documentos y reglamento,
// servicios, soporte, reservas y mudanzas, visitas, paquetes y PQRS (contrato, sección F).
//
// Casi todo esto lo escribe el NAVEGADOR en el producto, así que la semilla replica campo a campo
// lo que deja cada escritor, en su estado final y en un solo `create`: los disparadores de
// `update` (acuerdo enviado, encuesta publicada, PQRS respondido, reserva aprobada o rechazada)
// avisan y mandan correo, y un `create` no los despierta. Los de `create` sí saltan en un ambiente
// real; sin membresías (T1.9) solo encuentran a la administración y al superadmin, y esos avisos
// los recoge el paso D6 (plan §12.3). La sombra de PQRS no llama al modelo: el conjunto es de
// ejemplo, así que deja una fila `omitida · sembrado` por ticket en `aiAssistance`, que el barrido
// apunta.
//
// **Las reservas pasan por la regla del servidor**: `evaluarReglasDeReserva`, con el «ahora» del
// momento en que se hicieron, las reservas ya sembradas de ese día y de ese mes, y la deuda vencida
// de la casa en ese momento. Si la casa propuesta no puede (debe, o agotó su cupo del mes), prueba
// otra; si la regla dice que no por el horario o el aforo, esa reserva no existió.

import { createRequire } from "node:module";
import { Timestamp } from "firebase-admin/firestore";

import { documentoPdf, subir, tokenDe } from "../archivos.mjs";
import { azar } from "../azar.mjs";
import { CASAS_DEMO, idDe } from "../lomas-de-sayilbedra.mjs";
import { crearSiFalta, firma, marcaDe } from "../motor.mjs";
import { diaLocal, dias, instante, sumarDias } from "../reloj.mjs";

const require = createRequire(import.meta.url);
const reservas = require("../../../lib/reservations.js");
const { formatRangeLabel, parseClockTime } = require("../../../lib/time-range.js");
const { instanteEnZona } = require("../../../lib/zona-del-conjunto.js");
const { deudaDelCargo } = require("../../../lib/payments.js");

const ZONA = "America/Mexico_City";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (dia) => `${Number(dia.slice(8, 10))} de ${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;

/** Las de `ensureSystemFolderImpl` (functions/src/index.ts), con sus nombres. */
const CARPETAS_DE_SISTEMA = {
  regulations: { name: "Reglamentos", description: "Reglamentos del conjunto. Carpeta del sistema." },
  committee_agreements: { name: "Acuerdos de comité", description: "Actas y acuerdos de comité. Carpeta del sistema." },
};

const COMENTARIOS = [
  "Que las grabaciones solo se revisen con acta del consejo.",
  "Me parece bien si no sube mucho la cuota.",
  "Ojalá cubran también la entrada de servicio.",
  "Que el aviso de privacidad quede a la vista en la caseta.",
];

/** El nombre del archivo como lo sanea la subida del producto. */
const limpio = (nombre) => nombre.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
/** Seis caracteres en base 36 y mayúsculas, como el código de invitación del producto, pero estables. */
const codigoDe = (texto) => BigInt(`0x${tokenDe(`codigo:${texto}`).replace(/-/g, "").slice(0, 12)}`).toString(36).slice(-6).toUpperCase().padStart(6, "0");
const mas = (fecha, minutos) => new Date(fecha.getTime() + minutos * 60_000);
const ts = (fecha) => Timestamp.fromDate(fecha);
const antes = (a, b) => (a < b ? a : b);

/** Un instante estable entre dos días (los dos incluidos), a una hora del rango; `null` si no cabe. */
function momentoEntre(etiqueta, desde, hasta, [h0, h1] = [8, 21]) {
  if (desde > hasta) return null;
  const r = azar(etiqueta);
  return instante(r.elegir(dias(desde, hasta)), `${String(r.entero(h0, h1)).padStart(2, "0")}:${String(r.entero(0, 59)).padStart(2, "0")}`);
}

/** La primera opción, la más votada; y así hacia abajo. */
function elegirPonderado(r, opciones) {
  const pesos = opciones.map((_, i) => 1 / (i + 1.5));
  let x = r.real() * pesos.reduce((s, p) => s + p, 0);
  for (let i = 0; i < opciones.length; i += 1) {
    x -= pesos[i];
    if (x < 0) return opciones[i];
  }
  return opciones[opciones.length - 1];
}

/**
 * `--refrescar`: lo que los días anteriores dejaron abierto en la portería se cierra como se habría
 * cerrado. Las visitas que siguen «dentro» salieron esa tarde (si no, `notifyPendingVisitorExits`
 * avisa cada mañana) y los paquetes por entregar se entregaron al día siguiente de llegar, a quien
 * iban dirigidos. Ninguna de las dos colecciones tiene disparador de `update`.
 */
export async function cerrarDiasAnteriores(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron, hoy } = historia;
  const personas = new Map(padron.personas.map((p) => [p.id, p]));
  const guardia = ctx.uids.get("porteria");
  const dentro = await db.collection("visitorPasses").where("tenantId", "==", t).where("status", "==", "inside").get();
  for (const d of dentro.docs) {
    const p = d.data();
    if (!(p.date < hoy)) continue;
    if (!ctx.escribir) {
      ctx.cuenta("visitorPasses (salidas de días anteriores)", "crearia");
      continue;
    }
    const entro = p.checkInAt?.toDate?.() ?? instante(p.date, "12:00");
    const tarde = instante(p.date, "18:30");
    await d.ref.update({ status: "completed", checkOutAt: ts(tarde > mas(entro, 60) ? tarde : mas(entro, 60)) });
    ctx.cuenta("visitorPasses (salidas de días anteriores)", "creado");
  }
  const pendientes = await db.collection("packages").where("tenantId", "==", t).where("status", "==", "pending").get();
  for (const d of pendientes.docs) {
    const p = d.data();
    const dia = diaLocal(new Date(p.arrivedAt));
    if (!(dia < hoy)) continue;
    if (!ctx.escribir) {
      ctx.cuenta("packages (entregas de días anteriores)", "crearia");
      continue;
    }
    const manana = instante(sumarDias(dia, 1), "13:30");
    const entrega = ts(manana < ctx.ahora ? manana : ctx.ahora);
    await d.ref.update({
      status: "delivered", receivedBy: p.residentId, deliveredToId: p.residentId,
      deliveredToName: personas.get(p.residentId)?.fullName ?? p.residentName ?? null, deliveredBy: guardia,
      receivedAt: entrega, deliveredAt: entrega, updatedBy: guardia, updatedAt: entrega,
    });
    ctx.cuenta("packages (entregas de días anteriores)", "creado");
  }
}

export function crearEscritoresDeOperacion(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron, hoy } = historia;
  const ayer = sumarDias(hoy, -1);
  const casasPorId = new Map(padron.casas.map((c) => [c.id, c]));
  const casasPorClave = new Map(padron.casas.map((c) => [c.clave, c]));
  const cuentas = new Map(padron.cuentas.map((c) => [c.clave, c]));
  const personas = new Map(padron.personas.map((p) => [p.id, p]));
  const areas = new Map(padron.areas.map((a) => [a.clave, a]));
  const residentes = padron.cuentas.filter((c) => c.role === "resident");
  const porteria = cuentas.get("porteria");
  const demo = { corriente: `res-${CASAS_DEMO.resCorriente}`, moroso: `res-${CASAS_DEMO.resMoroso}`, consejero: `res-${CASAS_DEMO.consejero}` };
  const demos = new Set(Object.values(demo));
  const uidDe = (clave) => ctx.uids.get(clave);
  let perfil = null;
  const admin = async () => (perfil ??= (await db.collection("users").doc(ctx.adminUid).get()).data() ?? {});
  let conjunto = null;
  const delConjunto = async () => (conjunto ??= (await db.collection("tenants").doc(t).get()).data() ?? {});

  /** Si ya está (y es de este conjunto), cuenta «ya estaba»; si es de otro, aborta como `crearSiFalta`. */
  async function yaEsta(coleccion, id) {
    const snap = await db.collection(coleccion).doc(id).get();
    if (!snap.exists) return false;
    if (snap.data()?.tenantId !== t) throw new Error(`${coleccion}/${id} ya existe y es del conjunto «${snap.data()?.tenantId}»: no se pisa.`);
    ctx.cuenta(coleccion, "existe");
    return true;
  }

  async function carpetaDeSistema(systemKey, marca) {
    const existente = await db.collection("documentFolders").where("tenantId", "==", t).where("systemKey", "==", systemKey).limit(1).get();
    if (!existente.empty) return existente.docs[0].id;
    const id = idDe(t, `carpeta-${systemKey}`);
    await crearSiFalta(ctx, "documentFolders", id, {
      ...CARPETAS_DE_SISTEMA[systemKey], parentId: null, path: id, depth: 0, color: "system", system: true, systemKey,
      createdBy: ctx.adminUid, createdByName: (await admin()).fullName ?? "", createdAt: marca, updatedAt: marca,
    });
    return id;
  }

  async function pdfSubido(ruta, contenido) {
    const pdf = await documentoPdf(contenido);
    return { url: await subir(ctx, ruta, pdf, "application/pdf"), tamano: pdf.length };
  }

  /**
   * Quién firma: una fracción de las cuentas, al azar pero estable. Las demo, a mano: la cuenta al
   * corriente y la del consejero firman; la morosa nunca, para que tenga firmas pendientes.
   */
  function firmantes(etiqueta, fraccion, conDemo = true) {
    const otras = azar(etiqueta).barajar(residentes.filter((c) => !demos.has(c.clave)));
    const lista = otras.slice(0, Math.round(fraccion * otras.length));
    return conDemo ? [...lista, cuentas.get(demo.corriente), cuentas.get(demo.consejero)] : lista;
  }

  /**
   * La deuda vencida de la casa en `momento`, como `saldoVencidoDeUnidad` pero con la historia: los
   * cargos que existían entonces, vencidos antes de ese día, con lo pagado hasta ahí (la siembra es
   * cronológica: lo posterior aún no está escrito).
   */
  async function vencidoDe(casaId, momento, dia) {
    const snap = await db.collection("billingStatements").where("tenantId", "==", t).where("unitId", "==", casaId).get();
    return snap.docs
      .map((x) => x.data())
      .filter((c) => c.status !== "cancelled" && (c.createdAt?.toMillis?.() ?? 0) <= momento.getTime() && c.dueDate && c.dueDate < dia)
      .reduce((s, c) => s + deudaDelCargo(c, dia), 0);
  }

  async function evaluarReserva(area, casa, d, ahora, dia) {
    const mes = d.fecha.slice(0, 7);
    const deLaArea = db.collection("reservations").where("tenantId", "==", t).where("amenityId", "==", area.id);
    const [delDia, deLaCasa] = await Promise.all([
      deLaArea.where("date", "==", d.fecha).get(),
      deLaArea.where("unitId", "==", casa.id).where("date", ">=", `${mes}-01`).where("date", "<=", `${mes}-31`).get(),
    ]);
    return reservas.evaluarReglasDeReserva(
      { date: d.fecha, startTime: d.inicio, endTime: d.fin, unitId: casa.id },
      {
        amenity: area,
        reservasDelDia: delDia.docs.map((x) => x.data()),
        usoMensualDeLaUnidad: deLaCasa.docs.filter((x) => !["cancelled", "rejected"].includes(x.data().status)).length,
        saldoVencido: area.blockOnDebt ? await vencidoDe(casa.id, ahora, dia) : null,
        ahora,
        zona: ZONA,
      },
    );
  }

  /** La forma de `crearReserva` (functions/src/reservations.ts), llevada a su estado final. */
  async function escribirReserva(id, ev, area, cuenta, casa, ahora) {
    const d = ev.datos;
    const uid = uidDe(cuenta.clave);
    const creada = ts(ahora);
    const estado = reservas.estadoInicial(area);
    const doc = {
      createdBy: uid, createdByName: cuenta.fullName, residentName: cuenta.fullName, reservedBy: cuenta.fullName, updatedBy: uid,
      createdAt: creada, updatedAt: creada,
      unitId: casa.id, unitLabel: casa.displayName,
      amenityId: area.id, amenity: area.name, amenityName: area.name,
      date: d.fecha, startTime: d.inicio, endTime: d.fin, startAt: ts(instanteEnZona(d.fecha, d.inicio, ZONA)),
      slot: formatRangeLabel(parseClockTime(d.inicio), parseClockTime(d.fin)),
      exclusiveUse: area.maxReservationsPerSlot === 1,
      status: estado,
      ...(estado === "approved" && { autoApproved: true }),
      createdVia: "callable",
    };
    // La casa club pide aprobación: la administración la dio a la mañana siguiente, salvo la que
    // se pidió ayer, que la demo enseña pendiente.
    if (estado === "pending" && ev.fecha < ayer) {
      Object.assign(doc, { status: "approved", updatedBy: ctx.adminUid, updatedAt: ts(instante(sumarDias(ev.fecha, 1), "10:00")) });
    }
    if (d.cancelada) {
      const vispera = instante(sumarDias(d.fecha, -1), "20:15");
      const cuando = vispera > mas(ahora, 120) ? vispera : mas(ahora, 120);
      Object.assign(doc, { status: "cancelled", cancellationReason: d.motivoCancelacion, cancelledAt: ts(cuando), updatedBy: uid, updatedAt: ts(cuando) });
    }
    const { creado } = await crearSiFalta(ctx, "reservations", id, doc);
    // Para contar los avisos de D6: `onReservationCreated` avisa al residente de la que nace aprobada sola.
    if (creado && doc.status === "approved" && doc.autoApproved) ctx.cuenta("reservas que avisan al residente", "creado");
  }

  return {
    async comunicado(ev) {
      const d = ev.datos;
      const marca = marcaDe(ev.fecha, ev.hora);
      // El estado lo calcula el formulario al publicar, con las fechas de vigencia.
      const estado = d.inicio && d.inicio > ev.fecha ? "scheduled" : d.fin && d.fin < ev.fecha ? "expired" : "published";
      await crearSiFalta(ctx, "communications", idDe(t, ev.clave), {
        title: d.titulo,
        message: d.texto,
        notificationSummary: d.texto.split(/(?<=\.)\s/)[0].slice(0, 280),
        status: estado,
        ...(d.inicio ? { startsAt: d.inicio } : {}),
        ...(d.fin ? { endsAt: d.fin } : {}),
        attachmentUrl: "", attachmentName: "", attachments: [],
        audience: "all", audienceTowers: [], audienceUnitIds: [],
        createdBy: ctx.adminUid, publishedAt: marca, createdAt: marca, updatedAt: marca,
      });
    },

    async encuesta(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      const abierta = d.cierre >= hoy;
      const primerDia = sumarDias(ev.fecha, 1);
      // Hasta la víspera del cierre y antes de las 18:00: `closingDate` es la medianoche UTC del día
      // de cierre, que en Puebla son las 18:00 de la víspera (contrato, H.6). En la abierta, las
      // cuentas demo no han votado: que la demo pueda hacerlo.
      const ultimoDia = abierta ? ayer : sumarDias(d.cierre, -1);
      const candidatas = azar(`encuesta:${d.clave}`).barajar(residentes.filter((c) => !(abierta && demos.has(c.clave))));
      const responden = primerDia <= ultimoDia ? candidatas.slice(0, Math.round(d.participacion * candidatas.length)) : [];
      const preguntas = d.preguntas.map((q, i) => ({ id: `q${i + 1}`, type: q.type, text: q.text, ...(q.options ? { options: q.options } : {}), required: q.type !== "text" }));
      const publicada = marcaDe(ev.fecha, ev.hora);
      const cerrada = abierta ? null : marcaDe(d.cierre, "09:00");
      await crearSiFalta(ctx, "surveys", id, {
        title: d.titulo, description: d.descripcion, targetAudience: { type: "all" }, minResponsesForResults: 5, questions: preguntas,
        status: abierta ? "published" : "closed", publishedAt: publicada, ...(cerrada ? { closedAt: cerrada } : {}),
        closingDate: Timestamp.fromDate(new Date(`${d.cierre}T00:00:00.000Z`)),
        responseCount: responden.length,
        createdBy: ctx.adminUid, createdAt: marcaDe(ev.fecha, "10:30"), updatedAt: cerrada ?? publicada,
      });
      for (const cuenta of responden) {
        const r = azar(`respuesta:${d.clave}:${cuenta.clave}`);
        const answers = preguntas.flatMap((q) => {
          if (q.type === "single_choice") return [{ questionId: q.id, value: elegirPonderado(r, q.options) }];
          if (q.type === "multiple_choice") {
            const marcadas = q.options.filter(() => r.probable(0.45));
            return [{ questionId: q.id, value: marcadas.length ? marcadas : [q.options[0]] }];
          }
          if (q.type === "likert") return [{ questionId: q.id, value: r.elegir([2, 3, 4, 4, 5, 5]) }];
          return r.probable(0.3) ? [{ questionId: q.id, value: r.elegir(COMENTARIOS) }] : [];
        });
        const rid = `${id}_${cuenta.casaId}`;
        const cuando = momentoEntre(`respuesta-momento:${d.clave}:${cuenta.clave}`, primerDia, ultimoDia, [8, 17]);
        await crearSiFalta(ctx, "survey_responses", rid, { id: rid, surveyId: id, unitId: cuenta.casaId, answers, respondedAt: ts(cuando) });
      }
    },

    async acuerdo(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      const envio = instante(d.enviado, "18:00");
      if (!(await yaEsta("committee_agreements", id))) {
        const archivo = `acta-consejo-${d.sesion}-${d.clave}.pdf`;
        const subida = mas(envio, -30);
        const ruta = `tenants/${t}/agreements/${subida.getTime()}-${limpio(archivo)}`;
        const MODO = {
          obligatoria: "El acuerdo requiere la firma de cada casa en Vivaru.",
          parcial: "Se recaba en Vivaru la firma de las casas que quieran respaldarlo.",
          informativo: "Se comunica a la comunidad para su conocimiento; no requiere firma.",
        };
        const { url, tamano } = await pdfSubido(ruta, {
          titulo: d.titulo,
          subtitulo: `Acta de la sesión del consejo de administración del ${fechaLarga(d.sesion)} · Lomas de Sayilbedra`,
          parrafos: [
            `En el fraccionamiento Lomas de Sayilbedra, el ${fechaLarga(d.sesion)}, se reunió el consejo de administración con la mayoría de sus integrantes.`,
            d.detalle,
            MODO[d.modo],
          ],
          pie: "Firman al calce los integrantes del consejo presentes en la sesión.",
        });
        const carpetaId = await carpetaDeSistema("committee_agreements", ts(subida));
        await crearSiFalta(ctx, "committee_agreements", id, {
          title: d.titulo, sessionDate: d.sesion, eventDate: d.sesion, description: null,
          signatureMode: d.modo, signerScope: "all", signerUnitIds: null, quorum: null,
          status: "enviado", sentAt: envio.toISOString(),
          fileUrl: url, storagePath: ruta, fileName: archivo,
          createdBy: ctx.adminUid, updatedBy: ctx.adminUid, createdAt: ts(subida), updatedAt: ts(envio),
        });
        // El documento de `uploadAgreementFile`, en la carpeta de sistema.
        await crearSiFalta(ctx, "documents", idDe(t, `doc-${ev.clave}`), {
          fileName: archivo, description: `Acuerdo: ${d.titulo}`, fileUrl: url, storagePath: ruta, folderId: carpetaId,
          fileSize: tamano, contentType: "application/pdf", category: "acuerdo", source: "committee_agreement", sourceId: id,
          uploadedBy: ctx.adminUid, uploadedByName: "", createdBy: ctx.adminUid, createdAt: ts(subida), updatedAt: ts(subida),
        });
      }
      if (d.modo === "informativo") return;
      const primerDia = sumarDias(d.enviado, 1);
      const ultimoDia = antes(sumarDias(d.enviado, 12), ayer);
      if (primerDia > ultimoDia) return;
      for (const cuenta of firmantes(`firmas:${d.clave}`, d.firmas, !d.sinDemo)) {
        const sid = `${id}_${cuenta.casaId}`;
        await crearSiFalta(ctx, "committee_agreement_signatures", sid, {
          id: sid, agreementId: id, unitId: cuenta.casaId, signedBy: uidDe(cuenta.clave),
          signedAt: ts(momentoEntre(`firma:${d.clave}:${cuenta.clave}`, primerDia, ultimoDia)),
          agreementTitle: d.titulo, agreementSessionDate: d.sesion,
        });
      }
    },

    async reglamento(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      const subida = instante(ev.fecha, ev.hora);
      if (!(await yaEsta("documents", id))) {
        const ruta = `tenants/${t}/documents/${subida.getTime()}-${limpio(d.archivo)}`;
        const { url, tamano } = await pdfSubido(ruta, {
          titulo: d.titulo, subtitulo: "Aprobado en la asamblea ordinaria del 25 de enero de 2026", parrafos: d.parrafos,
        });
        const carpetaId = await carpetaDeSistema("regulations", ts(subida));
        await crearSiFalta(ctx, "documents", id, {
          title: d.titulo, description: d.titulo, category: "reglamento", audience: "all",
          fileName: d.archivo, fileUrl: url, storagePath: ruta, folderId: carpetaId, fileSize: tamano, contentType: "application/pdf",
          uploadedBy: ctx.adminUid, createdBy: ctx.adminUid, uploadedAt: subida.toISOString(), createdAt: ts(subida), updatedAt: ts(subida),
        });
      }
      // El reglamento vigente, como `setActiveRegulation`; lo que había se guarda para `--limpiar`.
      const ajustes = db.collection("tenantSettings").doc(t);
      const vigente = (await ajustes.get()).data()?.activeRegulationId ?? null;
      if (vigente === id) ctx.cuenta("tenantSettings (reglamento vigente)", "existe");
      else if (!ctx.escribir) ctx.cuenta("tenantSettings (reglamento vigente)", "crearia");
      else {
        const previos = (await ctx.manifiesto.ref.get()).data()?.ajustesPrevios ?? {};
        if (!("activeRegulationId" in previos)) await ctx.manifiesto.ref.set({ ajustesPrevios: { activeRegulationId: vigente } }, { merge: true });
        await ajustes.update({ activeRegulationId: id });
        ctx.cuenta("tenantSettings (reglamento vigente)", "creado");
      }
      const ultimoDia = antes(sumarDias(ev.fecha, 40), ayer);
      for (const cuenta of firmantes(`firmas:${d.clave}`, d.firmas)) {
        const sid = `${id}_${cuenta.casaId}`;
        await crearSiFalta(ctx, "regulation_signatures", sid, {
          id: sid, regulationId: id, unitId: cuenta.casaId, signedBy: uidDe(cuenta.clave),
          signedAt: ts(momentoEntre(`firma:${d.clave}:${cuenta.clave}`, sumarDias(ev.fecha, 1), ultimoDia)),
          regulationVersion: d.titulo,
        });
      }
    },

    async carpeta(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      const marca = marcaDe(ev.fecha, ev.hora);
      // La forma de `createDocumentFolder` (una carpeta de usuario, no de sistema).
      await crearSiFalta(ctx, "documentFolders", id, {
        name: d.name, description: d.description, parentId: null, path: id, depth: 0,
        createdBy: ctx.adminUid, createdByName: (await admin()).fullName ?? "", createdAt: marca, updatedAt: marca,
      });
    },

    async documento(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      if (await yaEsta("documents", id)) return;
      const subida = instante(ev.fecha, ev.hora);
      const ruta = `tenants/${t}/documents/${subida.getTime()}-${limpio(d.archivo)}`;
      const { url, tamano } = await pdfSubido(ruta, { titulo: d.descripcion, subtitulo: "Lomas de Sayilbedra · Puebla, Pue.", parrafos: d.parrafos });
      await crearSiFalta(ctx, "documents", id, {
        fileName: d.archivo, description: d.descripcion, fileUrl: url, storagePath: ruta,
        uploadedBy: ctx.adminUid, uploadedByName: (await admin()).fullName ?? "", category: d.categoria,
        folderId: idDe(t, `carpeta-${d.carpeta}`), fileSize: tamano, contentType: "application/pdf", source: null, sourceId: null,
        createdBy: ctx.adminUid, createdAt: ts(subida), updatedAt: ts(subida),
      });
    },

    async servicio(ev) {
      const d = ev.datos;
      const marca = marcaDe(ev.fecha, ev.hora);
      const casa = d.casaId ? casasPorId.get(d.casaId) : null;
      await crearSiFalta(ctx, "services", idDe(t, ev.clave), {
        title: d.title, description: d.description, category: d.category, serviceType: d.serviceType, providerName: d.providerName,
        // Sin teléfonos: el contacto pasa por la casa o por la administración.
        providerContact: casa ? `Por mensaje a ${casa.displayName}` : "Por medio de la administración",
        status: "active", ...(casa ? { unitId: casa.id } : {}),
        createdBy: ctx.adminUid, createdAt: marca, updatedAt: marca,
      });
    },

    async soporte(ev) {
      const d = ev.datos;
      const creado = instante(ev.fecha, ev.hora);
      const a = await admin();
      // Escritura directa: `createSupportTicket` manda correo al equipo (contrato, F).
      await crearSiFalta(ctx, "supportTickets", idDe(t, ev.clave), {
        tenantName: (await delConjunto()).name ?? t,
        createdBy: ctx.adminUid, createdByName: a.fullName ?? "Administración", createdByEmail: a.email ?? "",
        category: "operativo", subject: d.asunto, description: d.descripcion, priority: "media",
        // Cerrado y no «resuelto»: uno resuelto sigue contando para el tope de tickets abiertos.
        status: "cerrado",
        thread: [{ id: tokenDe(`soporte:${t}:${ev.clave}`), role: "vivaru", authorName: "Equipo Vivaru", message: d.respuesta, createdAt: d.respondido }],
        createdAtIso: creado.toISOString(), lastActivityAt: d.resuelto, firstResponseAt: d.respondido, resolvedAt: d.resuelto,
        createdAt: ts(creado), updatedAt: ts(new Date(d.resuelto)),
      });
    },

    async reserva(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      if (await yaEsta("reservations", id)) return;
      const area = areas.get(d.area);
      const ahora = instante(ev.fecha, ev.hora);
      const otras = d.fija ? [] : azar(`reserva-alternativas:${ev.clave}`).barajar(residentes.filter((c) => c.clave !== d.cuenta && !demos.has(c.clave)));
      for (const clave of [d.cuenta, ...otras.map((c) => c.clave)]) {
        const cuenta = cuentas.get(clave);
        const casa = casasPorId.get(cuenta.casaId);
        const decision = await evaluarReserva(area, casa, d, ahora, ev.fecha);
        if (decision.ok) return escribirReserva(id, ev, area, cuenta, casa, ahora);
        // La mora y el cupo son de la casa: otra puede. El horario y el aforo, no.
        if (!["mora", "cupo_mensual"].includes(decision.regla)) return ctx.cuenta("reservations", `no las dejó la regla (${decision.regla})`);
      }
      ctx.cuenta("reservations", "no las dejó la regla (ninguna casa podía)");
    },

    async mudanza(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      if (await yaEsta("reservations", id)) return;
      const cuenta = cuentas.get(d.cuenta);
      const casa = casasPorId.get(cuenta.casaId);
      const ahora = instante(ev.fecha, ev.hora);
      const decision = reservas.construirMudanza(
        {
          tenantId: t, unitId: casa.id, unitLabel: casa.displayName, date: d.fecha, startTime: d.inicio, endTime: d.fin,
          requiresElevator: false, depositPaid: true, depositAmount: 2000,
          additionalNotes: "Camión de 3.5 toneladas; entra por el acceso de servicio.", createdByName: cuenta.fullName,
        },
        uidDe(d.cuenta),
        { ahora, zona: ZONA },
      );
      if (!decision.ok) throw new Error(`la mudanza no pasa la regla: ${decision.mensaje}`);
      const doc = { ...decision.documento, createdAt: ts(ahora), updatedAt: ts(ahora) };
      if (d.aprobada) Object.assign(doc, { status: "approved", updatedBy: ctx.adminUid, updatedAt: ts(instante(sumarDias(ev.fecha, 1), "10:00")) });
      await crearSiFalta(ctx, "reservations", id, doc);
    },

    async invitacion(ev) {
      const d = ev.datos;
      const cuenta = cuentas.get(d.cuenta);
      const casa = casasPorId.get(cuenta.casaId);
      const uid = uidDe(d.cuenta);
      const creada = marcaDe(ev.fecha, ev.hora);
      const inicio = instante(d.fecha, d.inicio);
      const qrToken = tokenDe(`invitacion:${t}:${ev.clave}`);
      // Los dos documentos de `createResidentInvitation`. Sin identificación ni placas: la demo no
      // guarda datos que puedan ser de alguien.
      await crearSiFalta(ctx, "visitorInvitations", idDe(t, ev.clave), {
        unitId: casa.id, residentUserId: uid, authorizedByName: cuenta.fullName, visitorName: d.visitante,
        visitorIdentification: "", plate: "", visitReason: d.motivo, adultsCount: d.adultos, childrenCount: d.ninos, allowedUses: 1,
        startAt: ts(inicio), endAt: ts(mas(inicio, Math.max(d.estancia + 60, 180))), status: "active",
        qrToken, invitationCode: codigoDe(`${t}:${ev.clave}`), createdAt: creada, updatedAt: creada,
      });
      const llegada = mas(inicio, d.retraso ?? azar(`llegada:${ev.clave}`).entero(0, 25));
      const estado = d.estado ?? "completed";
      await crearSiFalta(ctx, "visitorPasses", idDe(t, `pase-${ev.clave}`), {
        unitId: casa.id, unitLabel: casa.displayName, visitorName: d.visitante, documentNumber: "", qrCodeValue: qrToken,
        hostResidentName: cuenta.fullName, tower: casa.displayName, unit: casa.displayName,
        date: d.fecha, eventDate: d.fecha, scheduledTime: inicio.toISOString(),
        // Quien no llegó se queda programado y quien sigue dentro no tiene salida. Los dos campos
        // van escritos aunque sean nulos: la regla de la portería los compara sin `.get()` (contrato, F).
        status: estado,
        checkInAt: estado === "scheduled" ? null : ts(llegada),
        checkOutAt: estado === "completed" ? ts(mas(llegada, d.estancia)) : null,
        residentName: cuenta.fullName, createdByName: cuenta.fullName,
        ...firma(ctx, creada, uid),
      });
    },

    async autorizacion(ev) {
      const d = ev.datos;
      const id = idDe(t, ev.clave);
      const cuenta = cuentas.get(d.cuenta);
      const casa = casasPorId.get(cuenta.casaId);
      const marca = marcaDe(ev.fecha, ev.hora);
      const qrCode = `LS-${codigoDe(`${t}:${ev.clave}`)}`;
      await crearSiFalta(ctx, "visitorAuthorizations", id, {
        visitorName: d.visitante, visitorDocument: "", qrCode, authorizationType: "larga_duracion", visitorCategory: d.categoria,
        unitId: casa.id, authorizedBy: cuenta.fullName, startDate: d.desde, endDate: d.hasta, startTime: d.inicio, endTime: d.fin,
        notes: "De lunes a sábado. Lo pidió el residente en la administración.", status: "active",
        createdBy: ctx.adminUid, createdAt: marca, updatedAt: marca,
      });
      // El pase de `createVisitor`, sin `eventDate` (contrato, H.1).
      await crearSiFalta(ctx, "visitorPasses", idDe(t, `pase-${ev.clave}`), {
        unitId: casa.id, unitLabel: casa.displayName, visitorName: d.visitante, documentNumber: "", qrCodeValue: qrCode,
        hostResidentName: cuenta.fullName, tower: casa.tower, unit: casa.displayName,
        date: d.desde, scheduledTime: `${d.desde}T${d.inicio}:00`, status: "scheduled",
        authorizationType: "larga_duracion", validFrom: d.desde, validUntil: d.hasta, checkInAt: null, checkOutAt: null,
        sourceAuthorizationId: id, createdBy: ctx.adminUid, createdByName: cuenta.fullName, residentName: cuenta.fullName,
        createdAt: marca, updatedAt: marca,
      });
    },

    async paquete(ev) {
      const d = ev.datos;
      const casa = casasPorClave.get(d.casa);
      const destinatario = personas.get(d.destinatario);
      const recibe = personas.get(d.recibe);
      const guardia = uidDe("porteria");
      const llegada = instante(ev.fecha, ev.hora);
      // `createGuardPackage`: la portería elige sección, casa y persona del padrón (`people`).
      const doc = {
        towerId: casa.tower, unitId: casa.id, unitLabel: casa.displayName,
        residentId: destinatario.id, residentName: destinatario.fullName, recipientName: destinatario.fullName,
        tower: casa.displayName, unit: casa.displayName, description: d.descripcion,
        reference: `PK-${llegada.getTime()}`, status: "pending", arrivedAt: llegada.toISOString(),
        registeredBy: guardia, registeredByName: porteria.fullName, receivedByGuardId: guardia, receivedByGuardName: porteria.fullName,
        ...firma(ctx, ts(llegada), guardia),
      };
      if (d.entrega) {
        const pedida = instante(d.entrega, d.horaEntrega);
        const entrega = pedida > mas(llegada, 90) ? pedida : mas(llegada, 90);
        // `confirmPackageReceived`.
        Object.assign(doc, {
          status: "delivered", receivedBy: recibe.id, deliveredToId: recibe.id, deliveredToName: recibe.fullName, deliveredBy: guardia,
          receivedAt: ts(entrega), deliveredAt: ts(entrega), updatedBy: guardia, updatedAt: ts(entrega),
        });
      }
      await crearSiFalta(ctx, "packages", idDe(t, ev.clave), doc);
    },

    async pqrs(ev) {
      const d = ev.datos;
      const cuenta = cuentas.get(d.cuenta);
      const casa = casasPorId.get(cuenta.casaId);
      const uid = uidDe(d.cuenta);
      const radicacion = instante(ev.fecha, ev.hora);
      const iso = radicacion.toISOString();
      const doc = {
        unitId: casa.id, unitLabel: casa.displayName, residentId: uid, residentName: cuenta.fullName, category: "pqrs",
        type: d.type, subject: d.subject, message: d.message, status: "open",
        radicado: `PQRS-${String(radicacion.getTime()).slice(-6)}`, radicationDate: iso,
        // El día UTC, como `createTicket`; se radica antes de las 18:00 de Puebla, así que es el local.
        eventDate: iso.slice(0, 10),
        priority: d.prioridad, classifiedAt: mas(radicacion, 95).toISOString(), classifiedBy: ctx.adminUid,
        createdBy: uid, updatedBy: uid, createdAt: ts(radicacion), updatedAt: iso,
      };
      if (d.respondido) {
        const a = await admin();
        const r = azar(`pqrs-respuesta:${ev.clave}`);
        const respuesta = instante(d.respondido, `${String(r.entero(9, 17)).padStart(2, "0")}:${String(r.entero(0, 59)).padStart(2, "0")}`);
        const quien = a.fullName ?? "Administración";
        Object.assign(doc, {
          response: d.respuesta, status: d.estado, respondedBy: ctx.adminUid, respondedByName: quien,
          respondedAt: ts(respuesta), updatedBy: ctx.adminUid, updatedAt: respuesta.toISOString(),
          responseHistory: [{ id: `rsp-${respuesta.getTime()}`, message: d.respuesta, status: d.estado, createdAt: respuesta.toISOString(), createdBy: ctx.adminUid, createdByName: quien }],
        });
      }
      await crearSiFalta(ctx, "tickets", idDe(t, ev.clave), doc);
    },
  };
}
