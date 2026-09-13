// T1.7 · Presupuesto, informes mensuales y constancia de no adeudo.
//
// **Informe mensual** (`informe-mensual`): el borrador lo deja el cierre del día 1 con el actor
// `system` (`monthlyFinancialArchive`); la emisión reproduce `issueMonthlyReport`, porque el PDF solo
// existe en ese envoltorio: `prepararEmision` → `buildInformeMensualPdf` → el archivado de
// `archiveBuffer` (Storage `tenants/{t}/monthly-reports/informe_{t}_{mes}.pdf` y
// `documents/informe_{t}_{mes}`, en la carpeta de sistema `monthly_reports`) → `sellarEmision`.
// Cada firma reproduce `signMonthlyReport`: `firmarInforme` y el PDF rehecho con las firmas en la
// misma ruta y el mismo documento (`rehacerPdfDelInforme`, CA3). La instantánea lee el estado del
// momento: por eso la siembra es cronológica (plan §12.3).
//
// **Presupuesto** (`use-presupuesto.ts`): aprobado, con la fecha del acta que teclea la
// administración y el momento en que se cargó en Vivaru. **Constancia** (`emitirPazYSalvo`): exige
// saldo cero en el momento de la llamada, así que va en un día en que la casa no debe nada.

import { createRequire } from "node:module";

import { subir } from "../archivos.mjs";
import { PRESUPUESTO_2026, idDe } from "../lomas-de-sayilbedra.mjs";
import { crearSiFalta, fechar, firma, marcaDe } from "../motor.mjs";

const require = createRequire(import.meta.url);
const informe = require("../../../lib/informe-mensual.js");
const { buildInformeMensualPdf } = require("../../../lib/pdf-resumen.js");
const constancias = require("../../../lib/clearance-certificates.js");

const SISTEMA = "system";
const CARPETA = {
  systemKey: "monthly_reports",
  name: "Informes mensuales",
  description: "Informes económicos mensuales emitidos y firmados. Carpeta del sistema.",
};

export function crearEscritoresDeInformes(ctx, historia) {
  const t = ctx.tenantId;
  const db = ctx.db;
  const { padron } = historia;
  const casas = new Map(padron.casas.map((c) => [c.clave, c]));
  const cuentas = new Map(padron.cuentas.map((c) => [c.clave, c]));
  const rutaDelPdf = (periodo) => `tenants/${t}/monthly-reports/informe_${informe.idDelInforme(t, periodo)}.pdf`;
  const idDelDocumento = (periodo) => `informe_${informe.idDelInforme(t, periodo)}`;
  let conjunto = null;
  const delConjunto = async () => (conjunto ??= (await db.collection("tenants").doc(t).get()).data() ?? {});

  /** La carpeta de sistema, como `ensureSystemFolderImpl`: la que ya haya, o una nueva. */
  async function carpeta(marca) {
    const existente = await db.collection("documentFolders").where("tenantId", "==", t).where("systemKey", "==", CARPETA.systemKey).limit(1).get();
    if (!existente.empty) return existente.docs[0].id;
    const id = idDe(t, `carpeta-${CARPETA.systemKey}`);
    await crearSiFalta(ctx, "documentFolders", id, {
      name: CARPETA.name, description: CARPETA.description, parentId: null, path: id, depth: 0,
      color: "system", system: true, systemKey: CARPETA.systemKey, createdBy: SISTEMA, createdByName: "",
      createdAt: marca, updatedAt: marca,
    });
    return id;
  }

  async function pintar(periodo, instantanea, firmas) {
    const c = await delConjunto();
    return buildInformeMensualPdf({
      tenantName: c.name ?? t,
      period: periodo,
      logo: null,
      statusLabel: "Emitido",
      headline: informe.filasDeCabecera(instantanea),
      sections: informe.seccionesDelInforme(instantanea),
      signatures: firmas,
      footNote: informe.PIE_DEL_INFORME,
    });
  }

  return {
    async presupuesto(ev) {
      const marca = marcaDe(ev.fecha, ev.hora);
      await crearSiFalta(ctx, "budgets", `${t}_${ev.datos.year}`, {
        year: ev.datos.year,
        lines: PRESUPUESTO_2026.map((l) => ({ ...l })),
        status: "aprobado",
        approvedAt: ev.datos.aprobadoEn,
        approvedBy: ctx.adminUid,
        approvedRecordedAt: marca,
        ...firma(ctx, marca),
      });
    },

    async "informe-borrador"(ev) {
      const periodo = ev.datos.periodo;
      const id = informe.idDelInforme(t, periodo);
      if ((await db.collection("monthlyReports").doc(id).get()).exists) return ctx.cuenta("informes (borrador)", "existe");
      if (!ctx.escribir) return ctx.cuenta("informes (borrador)", "crearia");
      const instantanea = await informe.leerYConstruirInstantanea(t, periodo);
      await informe.guardarBorrador({ tenantId: t, period: periodo, instantanea, actorUid: SISTEMA });
      const marca = marcaDe(ev.fecha, ev.hora);
      await fechar(ctx, "monthlyReports", [id], { generatedAt: marca, createdAt: marca, updatedAt: marca });
      await fechar(ctx, informe.DETALLE_POR_UNIDAD, [id], { updatedAt: marca });
      ctx.cuenta("informes (borrador)", "creado");
    },

    async "informe-emision"(ev) {
      const periodo = ev.datos.periodo;
      const id = informe.idDelInforme(t, periodo);
      const actual = (await db.collection("monthlyReports").doc(id).get()).data();
      if (!actual) return ctx.cuenta("informes (emisión sin borrador)", "existe");
      if (actual.status !== "borrador") return ctx.cuenta("informes (emisión)", "existe");
      if (!ctx.escribir) return ctx.cuenta("informes (emisión)", "crearia");
      const marca = marcaDe(ev.fecha, ev.hora);
      const preparado = await informe.prepararEmision({ tenantId: t, period: periodo });
      if (preparado.yaEmitido) return ctx.cuenta("informes (emisión)", "existe");
      const pdf = await pintar(periodo, preparado.instantanea, []);
      const ruta = rutaDelPdf(periodo);
      const fileUrl = await subir(ctx, ruta, pdf, "application/pdf");
      const documentId = idDelDocumento(periodo);
      await crearSiFalta(ctx, "documents", documentId, {
        fileName: `Informe-mensual-${periodo}.pdf`,
        description: `Informe económico mensual ${periodo} (emitido)`,
        fileUrl,
        storagePath: ruta,
        uploadedBy: SISTEMA,
        uploadedByName: "Automático",
        category: "informe_mensual",
        folderId: await carpeta(marca),
        fileSize: pdf.length,
        contentType: "application/pdf",
        source: "monthly_report",
        sourceId: periodo,
        createdBy: SISTEMA,
        createdAt: marca,
        updatedAt: marca,
      });
      await informe.sellarEmision({ tenantId: t, period: periodo, instantanea: preparado.instantanea, actorUid: ctx.adminUid, documentId });
      await fechar(ctx, "monthlyReports", [id], { issuedAt: marca, updatedAt: marca });
      ctx.cuenta("informes (emisión)", "creado");
    },

    async "informe-firma"(ev) {
      const periodo = ev.datos.periodo;
      const reportId = informe.idDelInforme(t, periodo);
      const cuenta = cuentas.get(ev.datos.cuenta);
      const uid = ctx.uids.get(ev.datos.cuenta);
      const ref = db.collection("monthlyReports").doc(reportId);
      const actual = (await ref.get()).data();
      if (!actual || !["emitido", "publicado"].includes(actual.status)) return ctx.cuenta("firmas de informe (sin informe emitido)", "existe");
      if ((actual.signatures ?? []).some((s) => s.uid === uid)) return ctx.cuenta("firmas de informe", "existe");
      if (!ctx.escribir || !uid) return ctx.cuenta("firmas de informe", "crearia");
      const marca = marcaDe(ev.fecha, ev.hora);
      await informe.firmarInforme({ tenantId: t, reportId, actorUid: uid, actorName: cuenta.fullName, actorRole: "Consejo de administración" });
      const firmado = (await ref.get()).data();
      const firmas = (firmado.signatures ?? []).map((s) => (s.uid === uid ? { ...s, signedAt: marca } : s));
      await ref.update({ signatures: firmas, updatedAt: marca });
      // El PDF se rehace con cada firma, en la misma ruta y el mismo documento.
      const detalle = (await db.collection(informe.DETALLE_POR_UNIDAD).doc(reportId).get()).data();
      const instantanea = informe.instantaneaParaRehacerElPdf({ ...firmado, signatures: firmas }, detalle);
      const paraElPdf = informe.firmasParaElPdf(firmas, informe.zonaParaPintarFechas((await delConjunto()).country));
      const pdf = await pintar(periodo, instantanea, paraElPdf);
      await subir(ctx, rutaDelPdf(periodo), pdf, "application/pdf", { reemplazar: true });
      await db.collection("documents").doc(firmado.documentId ?? idDelDocumento(periodo)).update({
        description: `Informe económico mensual ${periodo} (emitido, ${paraElPdf.length} ${paraElPdf.length === 1 ? "firma" : "firmas"})`,
        fileSize: pdf.length,
        updatedAt: marca,
      });
      ctx.cuenta("firmas de informe", "creado");
    },

    async constancia(ev) {
      const casa = casas.get(ev.datos.casa);
      const deLaCasa = async () =>
        (await db.collection("clearanceCertificates").where("unitId", "==", casa.id).get()).docs.filter((d) => d.data().tenantId === t);
      if ((await deLaCasa()).length) return ctx.cuenta("constancias", "existe");
      if (!ctx.escribir) return ctx.cuenta("constancias", "crearia");
      await constancias.emitirPazYSalvo(
        { tenantId: t, unitId: casa.id, unitLabel: casa.displayName, issueDate: ev.fecha, operationKey: idDe(t, ev.clave) },
        ctx.adminUid,
      );
      const marca = marcaDe(ev.fecha, ev.hora);
      await fechar(ctx, "clearanceCertificates", (await deLaCasa()).map((d) => d.id), { createdAt: marca, updatedAt: marca });
      ctx.cuenta("constancias", "creado");
    },
  };
}
