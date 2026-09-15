// Los escritores de la fase `--documentos` (plan de documentos). Enriquecen lo que la historia ya
// dejó, sin crear nada que dispare un aviso: reemplazan cada archivo en su ruta y con su token, y
// actualizan solo los campos que el archivo cambia (`fileSize`). Las fechas no se tocan: el reglamento
// sigue siendo el que aprobó la asamblea en enero.

import { createRequire } from "node:module";

import { Timestamp } from "firebase-admin/firestore";

import { documentoEstructurado, huellaDe, subirSiCambia, tokenDe } from "../archivos.mjs";
import { semilla } from "../azar.mjs";
import {
  TIPOS_DE_AREA,
  cartel,
  comprobanteDeTransferencia,
  esferaDeMedidor,
  fotoDeArea,
  fotoDeObra,
  logoDelConjunto,
  planoDelFraccionamiento,
  portadaDeServicio,
} from "../ilustraciones.mjs";
import { CASAS_POR_SECCION, INICIO, NOMBRE, SECCIONES, idDe } from "../lomas-de-sayilbedra.mjs";
import {
  VERSION_DOCUMENTOS,
  actaDeAsamblea,
  actaDelConsejo,
  adjuntosDeComunicados,
  archivoMensualAl,
  carteraAl,
  contratoDeServicio,
  convocatoriaDeAsamblea,
  egresosAl,
  fechaLarga,
  hojaDeTarifas,
  memoriaDeObra,
  mesLargo,
  planoGeneral,
  polizaDeSeguro,
  reglamentoCompleto,
  relacionDeMovimientos,
} from "../lomas-documentos.mjs";
import { ACUERDOS, DOCUMENTOS, REGLAMENTO, SERVICIOS } from "../lomas-operacion.mjs";
import { carpetaDeSistema, crearSiFalta, marcaDe } from "../motor.mjs";
import { DESFASE_HORAS, diaDelMes, instante, mesDe, mesMas, meses } from "../reloj.mjs";
import { SIN_IDENTIFICAR, rastreo } from "./banco.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const { buildSummaryPdf } = require("../../../lib/pdf-resumen.js");
const banderas = require("../../../lib/feature-flags.js");

const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Un libro de Excel como el de `archiveXlsx` (`functions/src/index.ts`). */
function libro(hojas) {
  const wb = XLSX.utils.book_new();
  for (const h of hojas) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h.rows), h.name.slice(0, 31));
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

/**
 * El contenido tal como entra en la huella: sin los bytes de las imágenes, que describe su `clave`. Así
 * la huella no depende de cómo codifica `sharp`; si cambia un dibujo, sube `VERSION_DOCUMENTOS`.
 */
function paraLaHuella(contenido) {
  return {
    ...contenido,
    bloques: contenido.bloques.map((b) => {
      if (b.tipo !== "imagen") return b;
      if (!b.clave) throw new Error(`Una imagen de «${contenido.titulo}» no trae clave: la huella no la distinguiría.`);
      return { ...b, buffer: undefined };
    }),
  };
}

export function crearEscritoresDeDocumentos(ctx, { padron, eventos, hoy }) {
  const { db } = ctx;
  const t = ctx.tenantId;

  /** Pinta un contenido y lo sube a su ruta, solo si cambió su huella. */
  async function pintarYSubir(ruta, contenido) {
    const { buffer, paginas } = await documentoEstructurado(contenido);
    const huella = huellaDe({ v: VERSION_DOCUMENTOS, contenido: paraLaHuella(contenido) });
    const { estado, url } = await subirSiCambia(ctx, ruta, buffer, "application/pdf", huella);
    return { buffer, paginas, estado, url };
  }

  /** Reemplaza el PDF de un documento que ya existe, y su `fileSize` si cambió. */
  async function reemplazarPdf(coleccion, id, contenido, etiqueta) {
    const ref = db.collection(coleccion).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`${coleccion}/${id} no existe: la fase de documentos corre sobre un conjunto ya sembrado.`);
    const actual = snap.data();
    if (actual.tenantId !== t) throw new Error(`${coleccion}/${id} es del conjunto «${actual.tenantId}»: no se toca.`);
    if (!actual.storagePath) throw new Error(`${coleccion}/${id} no tiene storagePath.`);
    const { buffer, paginas, estado } = await pintarYSubir(actual.storagePath, contenido);
    if (estado === "igual") ctx.cuenta(etiqueta, "existe");
    else if (!ctx.escribir) ctx.cuenta(etiqueta, "crearia");
    else {
      if (actual.fileSize !== buffer.length) await ref.update({ fileSize: buffer.length });
      ctx.cuenta(etiqueta, "creado");
    }
    return { paginas, bytes: buffer.length };
  }

  /**
   * Un archivo del sistema como lo deja `archiveBuffer` (`functions/src/index.ts`): subido por `system`
   * («Automático»), en su carpeta de sistema y con la fecha del corte. Si ya existe, solo se reemplaza
   * su archivo (y su `fileSize`) cuando cambia la huella.
   */
  async function archivar(a, etiqueta) {
    const ref = db.collection("documents").doc(a.id);
    const actual = (await ref.get()).data();
    const ruta = actual?.storagePath ?? a.ruta;
    const { estado, url } = await subirSiCambia(ctx, ruta, a.buffer, a.contentType, huellaDe({ v: VERSION_DOCUMENTOS, ...a.huella }));
    if (actual) {
      if (estado === "igual") return ctx.cuenta(etiqueta, "existe");
      if (!ctx.escribir) return ctx.cuenta(etiqueta, "crearia");
      if (actual.fileSize !== a.buffer.length) await ref.update({ fileSize: a.buffer.length });
      return ctx.cuenta(etiqueta, "creado");
    }
    if (!ctx.escribir) return ctx.cuenta(etiqueta, "crearia");
    const folderId = await carpetaDeSistema(ctx, a.systemKey, a.marca, { uid: "system", nombre: "" });
    await crearSiFalta(ctx, "documents", a.id, {
      fileName: a.fileName, description: a.description, fileUrl: url, storagePath: ruta,
      uploadedBy: "system", uploadedByName: "Automático", category: a.category, folderId,
      fileSize: a.buffer.length, contentType: a.contentType, source: a.source, sourceId: a.sourceId,
      createdBy: "system", createdAt: a.marca, updatedAt: a.marca,
    });
    ctx.cuenta(etiqueta, "creado");
  }

  /**
   * Un documento NUEVO con su PDF, con la forma de `createDocumentRecord` (la misma que deja
   * `documento` en `escritores/operacion.mjs`); si ya existe, se reemplaza su PDF. Nunca de categoría
   * `reglamento`: es la única que dispara, y avisaría a los 40 residentes (`onRegulationDocumentCreated`).
   */
  async function documentoNuevo(id, { dia, hora, archivo, descripcion, categoria, carpeta }, contenido, etiqueta) {
    if (categoria === "reglamento") throw new Error(`Un documento nuevo de reglamento avisaría a los residentes: «${id}» no se crea.`);
    if ((await db.collection("documents").doc(id).get()).exists) return reemplazarPdf("documents", id, contenido, etiqueta);
    const folderId = idDe(t, `carpeta-${carpeta}`);
    const ruta = `tenants/${t}/documents/${instante(dia, hora).getTime()}-${archivo}`;
    const { buffer, paginas, url } = await pintarYSubir(ruta, contenido);
    if (!ctx.escribir) {
      ctx.cuenta(etiqueta, "crearia");
      return { paginas, bytes: buffer.length };
    }
    // Después de la simulación: en seco, una carpeta que crea esta misma corrida todavía no existe.
    if (!(await db.collection("documentFolders").doc(folderId).get()).exists) throw new Error(`La carpeta ${folderId} no existe: el documento «${id}» quedaría huérfano.`);
    const admin = (await db.collection("users").doc(ctx.adminUid).get()).data() ?? {};
    await crearSiFalta(ctx, "documents", id, {
      fileName: archivo, description: descripcion, fileUrl: url, storagePath: ruta,
      uploadedBy: ctx.adminUid, uploadedByName: admin.fullName ?? "", category: categoria,
      folderId, fileSize: buffer.length, contentType: "application/pdf", source: null, sourceId: null,
      createdBy: ctx.adminUid, createdAt: marcaDe(dia, hora), updatedAt: marcaDe(dia, hora),
    });
    ctx.cuenta(etiqueta, "creado");
    return { paginas, bytes: buffer.length };
  }

  return {
    /** A1 · El reglamento interno completo, en el lugar del de una página. */
    async reglamentoCompleto() {
      const { paginas } = await reemplazarPdf("documents", idDe(t, REGLAMENTO.clave), reglamentoCompleto(padron), "documentos: reglamento completo");
      console.log(`  reglamento: ${paginas} páginas`);
    },

    /**
     * A2 · Las actas del consejo, completas. Cada acuerdo tiene su PDF y su espejo en Documentos con la
     * MISMA ruta (`uploadAgreementFile`): se reemplaza el archivo una vez y se corrige el `fileSize` del
     * espejo, que es el único de los dos que lo guarda. Los acuerdos de una sesión llevan la misma acta.
     */
    async actasDelConsejo() {
      const paginas = [];
      for (const a of ACUERDOS) {
        // El id sale de la clave del EVENTO, `acuerdo-<clave>` (`lomas-operacion.mjs`, donde se empujan
        // los acuerdos), no de la clave del guion.
        const acuerdoId = idDe(t, `acuerdo-${a.clave}`);
        const espejoId = idDe(t, `doc-acuerdo-${a.clave}`);
        const acuerdo = (await db.collection("committee_agreements").doc(acuerdoId).get()).data();
        const espejo = (await db.collection("documents").doc(espejoId).get()).data();
        if (!acuerdo || !espejo) throw new Error(`Falta el acuerdo «${a.clave}» o su espejo en Documentos: la fase de documentos corre sobre un conjunto ya sembrado.`);
        if (acuerdo.tenantId !== t) throw new Error(`committee_agreements/${acuerdoId} es del conjunto «${acuerdo.tenantId}»: no se toca.`);
        if (acuerdo.storagePath !== espejo.storagePath) {
          throw new Error(`El acuerdo «${a.clave}» y su espejo no comparten ruta: reemplazar uno dejaría al otro con el archivo viejo.`);
        }
        paginas.push((await reemplazarPdf("documents", espejoId, actaDelConsejo(padron, a.sesion), "documentos: actas del consejo")).paginas);
      }
      console.log(`  actas del consejo: ${paginas.join(", ")} páginas`);
    },

    /**
     * A3 · La asamblea de enero: el acta completa, en el lugar de la de una página, y su convocatoria,
     * nueva, subida el mismo día que el acta y cinco minutos antes, en la carpeta de asambleas.
     */
    async asamblea() {
      const guion = DOCUMENTOS.find((d) => d.clave === "acta-asamblea-2026");
      if (!guion) throw new Error("El guion no trae el acta de la asamblea (`acta-asamblea-2026`).");
      const acta = await reemplazarPdf("documents", idDe(t, `documento-${guion.clave}`), actaDeAsamblea(padron), "documentos: asamblea");
      const convocatoria = await documentoNuevo(
        idDe(t, "documento-convocatoria-asamblea-2026"),
        {
          dia: guion.fecha, hora: "12:10", archivo: "convocatoria-asamblea-ordinaria-2026.pdf", carpeta: guion.carpeta, categoria: "asamblea",
          descripcion: "Convocatoria a la asamblea ordinaria del 25 de enero de 2026",
        },
        convocatoriaDeAsamblea(padron),
        "documentos: asamblea",
      );
      console.log(`  asamblea: acta de ${acta.paginas} páginas, convocatoria de ${convocatoria.paginas}`);
    },

    /** A5 · El plano general y la memoria de obra, con sus ilustraciones, en el lugar de los de una página. */
    async planoYMemoria() {
      const etiqueta = "documentos: plano y memoria de obra";
      const imagen = await planoDelFraccionamiento({ secciones: SECCIONES, casasPorSeccion: CASAS_POR_SECCION });
      const plano = await reemplazarPdf("documents", idDe(t, "documento-plano-fraccionamiento"), planoGeneral(padron, imagen), etiqueta);
      const [antes, despues] = await Promise.all([fotoDeObra("antes"), fotoDeObra("despues")]);
      const memoria = await reemplazarPdf("documents", idDe(t, "documento-memoria-impermeabilizacion"), memoriaDeObra(eventos, { antes, despues }), etiqueta);
      console.log(`  plano: ${plano.paginas} páginas · memoria de obra: ${memoria.paginas}`);
    },

    /**
     * B1 · Tres fotos por área, como las deja la pantalla de áreas (`uploadAmenityPhoto` y
     * `reorderAmenityPhotos`): `photos[]` con la portada en `order: 0`, subidas justo después de crear
     * el área. Un área que ya tenga fotos propias (las que no son de la semilla) no se toca.
     */
    async fotosDeAreas() {
      const etiqueta = "áreas: fotos";
      for (const area of padron.areas) {
        if (!TIPOS_DE_AREA.includes(area.clave)) throw new Error(`No hay ilustración para el área «${area.clave}».`);
        const ref = db.collection("amenities").doc(area.id);
        const actual = (await ref.get()).data();
        if (!actual) throw new Error(`amenities/${area.id} no existe: la fase de documentos corre sobre un conjunto ya sembrado.`);
        if (actual.tenantId !== t) throw new Error(`amenities/${area.id} es del conjunto «${actual.tenantId}»: no se toca.`);
        const propias = (actual.photos ?? []).filter((p) => !String(p.id).startsWith("foto-"));
        if (propias.length) {
          console.log(`  ${area.name}: ya tiene ${propias.length} fotos propias; se deja como está`);
          ctx.cuenta(etiqueta, "existe");
          continue;
        }
        const alta = actual.createdAt.toMillis();
        const previas = new Map((actual.photos ?? []).map((p) => [p.id, p]));
        const fotos = [];
        let cambia = (actual.photos ?? []).length !== 3;
        for (let vista = 0; vista < 3; vista += 1) {
          const id = `foto-${area.clave}-${vista + 1}`;
          const previa = previas.get(id);
          const ruta = previa?.storagePath ?? `tenants/${t}/amenity-photos/${area.id}/${alta + (vista + 1) * 5_000}-${area.clave}-${vista + 1}.jpg`;
          const { estado, url } = await subirSiCambia(ctx, ruta, await fotoDeArea(area.clave, vista), "image/jpeg", huellaDe({ v: VERSION_DOCUMENTOS, foto: [area.clave, vista] }));
          if (estado !== "igual" || !previa || previa.url !== url || previa.order !== vista) cambia = true;
          fotos.push({ id, url, storagePath: ruta, order: vista });
        }
        if (!cambia) {
          ctx.cuenta(etiqueta, "existe");
          continue;
        }
        if (!ctx.escribir) {
          ctx.cuenta(etiqueta, "crearia");
          continue;
        }
        const guardadas = Math.max(actual.updatedAt?.toMillis?.() ?? 0, alta + 20_000);
        await ref.update({ photos: fotos, updatedAt: Timestamp.fromMillis(guardadas) });
        ctx.cuenta(etiqueta, "creado");
      }
    },

    /**
     * B2 · La portada y la hoja de tarifas de cada servicio, como si se hubieran subido al crearlo
     * (`handleSave`): el producto sube ANTES de guardar, en una carpeta con id temporal (`new-{ts}`),
     * porque el servicio todavía no existe. Un servicio con imagen o adjunto propios no se toca.
     */
    async serviciosIlustrados() {
      const etiqueta = "servicios: portada y tarifas";
      for (const s of SERVICIOS) {
        const id = idDe(t, `servicio-${s.clave}`);
        const ref = db.collection("services").doc(id);
        const actual = (await ref.get()).data();
        if (!actual) throw new Error(`services/${id} no existe: la fase de documentos corre sobre un conjunto ya sembrado.`);
        if (actual.tenantId !== t) throw new Error(`services/${id} es del conjunto «${actual.tenantId}»: no se toca.`);
        const imagen = `portada-${s.clave}.jpg`;
        const adjunto = `tarifas-${s.clave}.pdf`;
        const ajena = (ruta, nombre) => ruta && !ruta.endsWith(nombre);
        if (ajena(actual.imagePath, `cover-${imagen}`) || ajena(actual.attachmentPath, `attachment-${adjunto}`)) {
          console.log(`  ${s.title}: ya tiene imagen o adjunto propios; se deja como está`);
          ctx.cuenta(etiqueta, "existe");
          continue;
        }
        const carpeta = `tenants/${t}/services/new-${actual.createdAt.toMillis() - 30_000}`;
        const imagePath = actual.imagePath ?? `${carpeta}/cover-${imagen}`;
        const attachmentPath = actual.attachmentPath ?? `${carpeta}/attachment-${adjunto}`;
        const portada = await portadaDeServicio({ clave: s.clave, titulo: s.title, detalle: s.serviceType, tercero: s.category === "third_party" });
        const img = await subirSiCambia(ctx, imagePath, portada, "image/jpeg", huellaDe({ v: VERSION_DOCUMENTOS, portada: [s.clave, s.title, s.serviceType, s.category] }));
        const pdf = await pintarYSubir(attachmentPath, hojaDeTarifas(s, actual.providerContact ?? "Por medio de la administración"));
        const campos = { imageUrl: img.url, imagePath, attachmentUrl: pdf.url, attachmentName: adjunto, attachmentPath };
        const iguales = Object.entries(campos).every(([k, v]) => actual[k] === v);
        if (img.estado === "igual" && pdf.estado === "igual" && iguales) {
          ctx.cuenta(etiqueta, "existe");
          continue;
        }
        if (!ctx.escribir) {
          ctx.cuenta(etiqueta, "crearia");
          continue;
        }
        if (!iguales) await ref.update(campos);
        ctx.cuenta(etiqueta, "creado");
      }
    },

    /**
     * C3 · Los contratos de los cuatro prestadores con cuota fija y la póliza. El de vigilancia y la
     * póliza se reemplazan en su ruta; los otros tres son documentos NUEVOS (`contrato`, no disparan),
     * subidos el mismo día que el de vigilancia, en la carpeta «Contratos y pólizas».
     */
    async contratosYPoliza() {
      const etiqueta = "documentos: contratos y póliza";
      const vigilancia = DOCUMENTOS.find((d) => d.clave === "contrato-vigilancia");
      if (!vigilancia) throw new Error("El guion no trae el contrato de vigilancia (`contrato-vigilancia`).");
      await reemplazarPdf("documents", idDe(t, `documento-${vigilancia.clave}`), contratoDeServicio(padron, "vigilancia"), etiqueta);
      const nuevos = [["jardineria", "jardinería"], ["limpieza", "limpieza"], ["alberca", "mantenimiento de la alberca"]];
      for (const [i, [clave, nombre]] of nuevos.entries()) {
        await documentoNuevo(
          idDe(t, `documento-contrato-${clave}`),
          { dia: vigilancia.fecha, hora: `12:${20 + i * 5}`, archivo: `contrato-${clave}-2026.pdf`, carpeta: vigilancia.carpeta, categoria: "contrato", descripcion: `Contrato del servicio de ${nombre}` },
          contratoDeServicio(padron, clave),
          etiqueta,
        );
      }
      await reemplazarPdf("documents", idDe(t, "documento-poliza-2026"), polizaDeSeguro(padron, eventos), etiqueta);
    },

    /**
     * C4 · Los comprobantes de transferencia, repintados con el diseño de una transferencia en su misma
     * ruta (el espejo de Documentos la comparte; los documentos no cambian). Una transferencia por casa
     * y periodo: la hecha seis minutos antes de subir la primera captura. Si esa se rechazó porque no
     * se veía el importe, sale recortada, y la que se volvió a subir es la misma transferencia, entera.
     * La referencia es la de `cartera.mjs` y el rastreo el de `banco.mjs`, así que casa con la línea
     * «SPEI RECIBIDO» del extracto. Un comprobante que no es de la semilla no se toca.
     */
    async comprobantes() {
      const etiqueta = "comprobantes: repintados";
      const operativa = padron.bancos.find((b) => b.clave === "operativa");
      const casas = new Map(padron.casas.map((c) => [c.clave, c]));
      const grupos = new Map();
      for (const d of (await db.collection("paymentReceipts").where("tenantId", "==", t).get()).docs) {
        const m = d.id.startsWith(`${t}--`) ? /^comprobante-(.+)-(\d{4}-\d{2})-(\d+)$/.exec(d.id.slice(t.length + 2)) : null;
        if (!m) continue;
        const k = `${m[1]}|${m[2]}`;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push({ ...d.data(), id: d.id, casa: m[1], periodo: m[2], n: Number(m[3]) });
      }
      for (const lista of grupos.values()) {
        lista.sort((a, b) => a.n - b.n);
        const [primero] = lista;
        const casa = casas.get(primero.casa);
        if (!casa) throw new Error(`El comprobante ${primero.id} es de una casa que no está en el padrón.`);
        const cobrado = lista.find((r) => r.status === "approved") ?? lista[lista.length - 1];
        const local = new Date(primero.uploadedAt.toMillis() - 6 * 60_000 - DESFASE_HORAS * 3_600_000).toISOString();
        for (const r of lista) {
          const datos = {
            fecha: `${fechaLarga(local.slice(0, 10))}, ${local.slice(11, 16)} h`,
            importe: `$${r.amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`,
            ordenante: padron.personas.find((p) => p.casaId === casa.id && p.titular)?.fullName ?? "",
            beneficiario: `Asoc. de Colonos ${NOMBRE}`,
            cuentaDestino: `****${operativa.accountNumber.slice(-4)}`,
            concepto: `Cuota ${r.periodo} ${casa.displayName}`,
            referencia: String(semilla(primero.id) % 10_000_000).padStart(7, "0"),
            rastreo: rastreo(`receipt:${cobrado.id}`),
            recortado: r.status === "rejected" && /importe/.test(r.rejectedReason ?? ""),
          };
          const jpeg = await comprobanteDeTransferencia(datos);
          const { estado } = await subirSiCambia(ctx, r.storagePath, jpeg, "image/jpeg", huellaDe({ v: VERSION_DOCUMENTOS, comprobante: datos }));
          ctx.cuenta(etiqueta, estado === "igual" ? "existe" : ctx.escribir ? "creado" : "crearia");
        }
      }
    },

    /**
     * D2 · Las fotos de las lecturas del medidor: una esfera con el totalizador en m³, en vez de la
     * tarjeta de texto que dejó la historia. Cada foto se repinta en su ruta y con su token, así que
     * el `photoUrl` de la lectura sigue valiendo y la lectura —cobrada y sellada— no se toca.
     * **Una foto que no subió la semilla no se toca:** la que sube la administración desde la
     * pantalla lleva un token al azar, y la de la semilla, el de su ruta (`tokenDe`).
     */
    async fotosDeMedidor() {
      const etiqueta = "medidores: fotos de lectura";
      const casas = new Map(padron.casas.map((c) => [c.id, c]));
      for (const d of (await db.collection("meterReadings").where("tenantId", "==", t).get()).docs) {
        const l = d.data();
        const ruta = decodeURIComponent(/\/o\/([^?]+)/.exec(l.photoUrl ?? "")?.[1] ?? "");
        if (!ruta || !l.photoUrl.includes(`token=${tokenDe(ruta)}`)) {
          ctx.cuenta(etiqueta, "no son de la semilla");
          continue;
        }
        const local = new Date(l.readAt.toMillis() - DESFASE_HORAS * 3_600_000).toISOString();
        const datos = {
          casa: casas.get(l.unitId)?.displayName ?? l.unitId,
          periodo: l.period,
          lectura: l.current,
          tomada: `${local.slice(0, 10)} ${local.slice(11, 16)}`,
        };
        const { estado } = await subirSiCambia(ctx, ruta, await esferaDeMedidor(datos), "image/jpeg", huellaDe({ v: VERSION_DOCUMENTOS, medidor: datos }));
        ctx.cuenta(etiqueta, estado === "igual" ? "existe" : ctx.escribir ? "creado" : "crearia");
      }
    },

    /**
     * C1 · La relación mensual de movimientos de cada cuenta, del primer mes de la historia al último
     * cerrado, con las líneas del extracto importadas y el saldo de apertura de `bankAccountBalances`.
     * Documentos NUEVOS (`financiero`: solo los ve la administración), subidos el día 3 del mes
     * siguiente —el extracto de cada mes se importa su último día— en una carpeta de usuario «Bancos».
     */
    async relacionesBancarias() {
      const etiqueta = "documentos: relaciones bancarias";
      const cerrados = meses(mesDe(INICIO), mesMas(mesDe(hoy), -1));
      const lineas = (await db.collection("bankStatementLines").where("tenantId", "==", t).get()).docs.map((d) => d.data());
      const admin = (await db.collection("users").doc(ctx.adminUid).get()).data() ?? {};
      const carpetaId = idDe(t, "carpeta-bancos");
      const alta = marcaDe(diaDelMes(mesMas(cerrados[0], 1), 3), "09:55");
      // Una carpeta de usuario, con la forma de `createDocumentFolder` (como `carpeta` en `operacion.mjs`).
      await crearSiFalta(ctx, "documentFolders", carpetaId, {
        name: "Bancos", description: "Relaciones mensuales de movimientos de las cuentas del conjunto.", parentId: null, path: carpetaId, depth: 0,
        createdBy: ctx.adminUid, createdByName: admin.fullName ?? "", createdAt: alta, updatedAt: alta,
      });
      for (const [i, cuenta] of padron.bancos.entries()) {
        const apertura = (await db.collection("bankAccountBalances").doc(cuenta.id).get()).data()?.openingBalance;
        if (typeof apertura !== "number") throw new Error(`La cuenta ${cuenta.id} no tiene saldo de apertura.`);
        const suyas = lineas
          .filter((l) => l.bankAccountId === cuenta.id)
          .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
        for (const mes of cerrados) {
          const delMes = suyas.filter((l) => l.date.slice(0, 7) === mes);
          const saldoInicial = suyas.filter((l) => l.date < `${mes}-01`).reduce((s, l) => s + l.amount, apertura);
          const dia = diaDelMes(mesMas(mes, 1), 3);
          const hora = `10:0${i}`;
          const importada = Math.max(0, ...delMes.map((l) => l.createdAt.toMillis()));
          if (importada >= instante(dia, hora).getTime()) throw new Error(`Las líneas de ${mes} de «${cuenta.label}» se importaron después del ${dia}: la relación no puede ser anterior al extracto.`);
          const sinIdentificar = delMes.find((l) => l.date === SIN_IDENTIFICAR.fecha && l.description === SIN_IDENTIFICAR.descripcion && !l.reconciled);
          await documentoNuevo(
            idDe(t, `documento-relacion-${cuenta.clave}-${mes}`),
            { dia, hora, archivo: `relacion-${cuenta.clave}-${mes}.pdf`, carpeta: "bancos", categoria: "financiero", descripcion: `Relación de movimientos · ${cuenta.label} · ${mesLargo(mes)}` },
            relacionDeMovimientos({ cuenta, mes, saldoInicial, lineas: delMes, elaborada: dia, sinIdentificar }),
            etiqueta,
          );
        }
      }
    },

    /**
     * D1 · El logo del conjunto, como lo deja Ajustes (`uploadTenantLogo` y `saveTenantSettings`):
     * `branding/logo.png` y `tenantSettings.logoUrl`/`logoPath`. Lo que había antes va a `ajustesPrevios`
     * del manifiesto, que `--limpiar` devuelve (un `null` borra el campo). Un logo propio —su archivo no
     * lleva la huella de la semilla— no se toca.
     */
    async logo() {
      const etiqueta = "ajustes: logo";
      const ref = db.collection("tenantSettings").doc(t);
      const actual = (await ref.get()).data() ?? {};
      const ruta = `tenants/${t}/branding/logo.png`;
      if (actual.logoPath) {
        const archivo = ctx.bucket.file(actual.logoPath);
        const [existe] = await archivo.exists();
        const propio = existe && !(await archivo.getMetadata())[0].metadata?.huellaSemilla;
        if (propio) {
          console.log("  el conjunto ya tiene un logo propio; se deja como está");
          ctx.cuenta(etiqueta, "existe");
          return;
        }
      }
      const color = padron.ajustes.brandColor;
      const png = await logoDelConjunto({ nombre: NOMBRE, color });
      const { estado, url } = await subirSiCambia(ctx, ruta, png, "image/png", huellaDe({ v: VERSION_DOCUMENTOS, logo: [NOMBRE, color] }));
      const iguales = actual.logoUrl === url && actual.logoPath === ruta;
      if (estado === "igual" && iguales) return ctx.cuenta(etiqueta, "existe");
      if (!ctx.escribir) return ctx.cuenta(etiqueta, "crearia");
      if (!iguales) {
        const previos = (await ctx.manifiesto.ref.get()).data()?.ajustesPrevios ?? {};
        if (!("logoUrl" in previos)) {
          await ctx.manifiesto.ref.set({ ajustesPrevios: { logoUrl: actual.logoUrl ?? null, logoPath: actual.logoPath ?? null } }, { merge: true });
        }
        await ref.set({ logoUrl: url, logoPath: ruta }, { merge: true });
      }
      ctx.cuenta(etiqueta, "creado");
    },

    /**
     * C2 · El archivo mensual que `monthlyFinancialArchive` habría dejado cada día 1 y que la historia
     * no rellenó: el histórico de cartera (XLSX) y el reporte de comité (XLSX y PDF), con los generadores
     * del producto sobre la cartera reconstruida a cada corte, como documentos del sistema («Automático»)
     * en sus carpetas de sistema. **Antes de escribir, la reconstrucción se prueba contra HOY**: llevada al
     * final de los tiempos, tiene que dar el pagado y el saldo de cada cargo y el estado de cada egreso
     * que guarda la base. Si no, no se archiva nada.
     */
    async archivoMensual() {
      const etiqueta = "documentos: archivo mensual";
      const delConjunto = async (c) => (await db.collection(c).where("tenantId", "==", t).get()).docs.map((d) => ({ ...d.data(), id: d.id }));
      const [cargos, asientos, aplicaciones, egresos, saldos] = await Promise.all(
        ["billingStatements", "ledgerEntries", "advanceApplications", "expenses", "bankAccountBalances"].map(delConjunto),
      );
      const siempre = new Date("2999-12-31T00:00:00.000Z");
      const guardado = new Map(cargos.map((c) => [c.id, c]));
      const cargosQueNo = carteraAl(siempre, { cargos, asientos, aplicaciones }).filter((c) => {
        const g = guardado.get(c.id);
        return Math.abs(c.paymentAmount - (g.paymentAmount ?? 0)) > 0.005 || Math.abs(c.balance - (g.balance ?? 0)) > 0.005;
      });
      const estado = new Map(egresos.map((e) => [e.id, e.status]));
      const egresosQueNo = egresosAl(siempre, egresos).filter((e) => e.status !== estado.get(e.id));
      if (cargosQueNo.length || egresosQueNo.length) {
        throw new Error(`La reconstrucción no reproduce la base de hoy (${cargosQueNo.length} cargos, ${egresosQueNo.length} egresos): no se archiva nada.`);
      }
      const informeAnclado = await banderas.isFeatureEnabled("producto-informe-mensual", t);
      for (const mes of meses(mesDe(INICIO), mesDe(hoy))) {
        const corte = new Date(`${mes}-01T06:00:00.000Z`);
        const a = archivoMensualAl(corte, { cargos, asientos, aplicaciones, egresos, saldos, informeAnclado });
        if (!a) continue;
        const marca = Timestamp.fromDate(corte);
        const comun = { marca, description: a.comite.description, source: "committee_report", sourceId: a.comite.mes, category: "reporte", systemKey: "committee_reports" };
        await archivar({
          id: idDe(t, `archivo-cartera_history-${a.historico.stamp}`), ruta: `tenants/${t}/cartera-history/${a.historico.stamp}-${corte.getTime()}.xlsx`,
          fileName: a.historico.fileName, contentType: TIPO_XLSX, buffer: libro(a.historico.sheets), huella: { historico: a.historico },
          marca, description: a.historico.description, source: "cartera_history", sourceId: a.historico.stamp, category: "financiero", systemKey: "cartera_history",
        }, etiqueta);
        await archivar({
          ...comun, id: idDe(t, `archivo-committee_report-${a.comite.mes}-xlsx`), ruta: `tenants/${t}/committee-reports/${a.comite.mes}-${corte.getTime()}.xlsx`,
          fileName: a.comite.fileNameXlsx, contentType: TIPO_XLSX, buffer: libro(a.comite.sheets), huella: { comite: a.comite.sheets },
        }, etiqueta);
        await archivar({
          ...comun, id: idDe(t, `archivo-committee_report-${a.comite.mes}-pdf`), ruta: `tenants/${t}/committee-reports/${a.comite.mes}-${corte.getTime() + 1000}.pdf`,
          fileName: a.comite.fileNamePdf, contentType: "application/pdf", buffer: await buildSummaryPdf(a.comite.titulo, a.comite.subtitulo, a.comite.filasPdf),
          huella: { pdf: [a.comite.titulo, a.comite.subtitulo, a.comite.filasPdf] },
        }, etiqueta);
      }
    },

    /**
     * A4 · Los adjuntos de los comunicados, como los deja la pantalla de comunicados (`handleSave`):
     * el archivo en `communications/`, su entrada en `attachments[]` y su espejo en Documentos
     * (`createDocumentRecord`: `comunicado`, en la carpeta de sistema «Comunicados»), con la fecha del
     * comunicado. Actualizar un comunicado no dispara, ni crear un documento que no es reglamento.
     */
    async adjuntosDeComunicados() {
      const etiqueta = "documentos: adjuntos de comunicados";
      const admin = (await db.collection("users").doc(ctx.adminUid).get()).data() ?? {};
      for (const adj of adjuntosDeComunicados()) {
        const commId = idDe(t, adj.clave);
        const ref = db.collection("communications").doc(commId);
        const comm = (await ref.get()).data();
        if (!comm) throw new Error(`communications/${commId} no existe: la fase de documentos corre sobre un conjunto ya sembrado.`);
        if (comm.tenantId !== t) throw new Error(`communications/${commId} es del conjunto «${comm.tenantId}»: no se toca.`);
        if (comm.title !== adj.titulo) throw new Error(`communications/${commId} se titula «${comm.title}», y el adjunto es de «${adj.titulo}».`);
        const previo = (comm.attachments ?? []).find((a) => a.name === adj.archivo);
        const alta = comm.createdAt;
        // Subido un minuto antes de publicar, como en la pantalla: primero el archivo, luego el comunicado.
        const ruta = previo?.path ?? `tenants/${t}/communications/${alta.toMillis() - 60_000}-${adj.archivo}`;
        const esPdf = adj.tipo === "pdf";
        const buffer = esPdf ? (await documentoEstructurado(adj.contenido)).buffer : await cartel(adj.cartel);
        const contentType = esPdf ? "application/pdf" : "image/jpeg";
        const { estado, url } = await subirSiCambia(ctx, ruta, buffer, contentType, huellaDe({ v: VERSION_DOCUMENTOS, adjunto: esPdf ? adj.contenido : adj.cartel }));
        const espejoRef = db.collection("documents").doc(idDe(t, `doc-${adj.clave}`));
        const espejo = (await espejoRef.get()).data();
        const cambiaElAdjunto = !previo || previo.size !== buffer.length || previo.url !== url;
        if (estado === "igual" && !cambiaElAdjunto && espejo?.fileSize === buffer.length) {
          ctx.cuenta(etiqueta, "existe");
          continue;
        }
        if (!ctx.escribir) {
          ctx.cuenta(etiqueta, "crearia");
          continue;
        }
        if (cambiaElAdjunto) {
          const adjunto = { url, name: adj.archivo, path: ruta, contentType, size: buffer.length };
          await ref.update({ attachments: [...(comm.attachments ?? []).filter((a) => a.name !== adj.archivo), adjunto] });
        }
        if (!espejo) {
          const folderId = await carpetaDeSistema(ctx, "communications", alta, { uid: ctx.adminUid, nombre: admin.fullName ?? "" });
          await crearSiFalta(ctx, "documents", espejoRef.id, {
            fileName: adj.archivo, description: `Comunicado: ${comm.title}`, fileUrl: url, storagePath: ruta,
            uploadedBy: ctx.adminUid, uploadedByName: admin.fullName ?? "", category: "comunicado", folderId,
            fileSize: buffer.length, contentType, source: "communication", sourceId: commId,
            createdBy: ctx.adminUid, createdAt: alta, updatedAt: alta,
          });
        } else if (espejo.fileSize !== buffer.length) {
          await espejoRef.update({ fileSize: buffer.length });
        }
        ctx.cuenta(etiqueta, "creado");
      }
    },
  };
}
