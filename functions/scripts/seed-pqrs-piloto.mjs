/**
 * seed-pqrs-piloto.mjs
 *
 * Siembra los tickets del piloto simulado de PQRS — Fase 3 de
 * `PRD-VAI-FEAT-002`. Voz real, canal simulado: el texto sale del gold set
 * (`datasets/pqrs/gold-set.json`), que a su vez viene de dos corpus reales.
 *
 * USO:
 *   FIREBASE_PROJECT_ID=vivaru-staging-02 node functions/scripts/seed-pqrs-piloto.mjs \
 *     --tenant-con-sla=<id> --tenant-buzon=<id> [--dry-run] [--limpiar]
 *
 * REQUISITOS:
 *   - Node 18+
 *   - Credenciales de administrador (ADC o GOOGLE_APPLICATION_CREDENTIALS)
 *   - FIREBASE_PROJECT_ID **obligatorio**: no hay default
 *
 * ── Por qué este script existe y no se amplía `seed-tenant.mjs` ──────────────
 *
 * Aquel siembra un conjunto ENTERO y **apunta a producción por defecto**
 * (`FIREBASE_PROJECT_ID || "hogaru-1"`). Este solo mete tickets en conjuntos que
 * ya existen, y **se niega a arrancar sin proyecto explícito**. La trampa no se
 * evita recordándola: se evita quitando el default.
 *
 * ── Tres decisiones sobre los datos, con su porqué ──────────────────────────
 *
 * 1. **El asunto se deriva de la primera línea del mensaje, no se escribe a
 *    mano.** El gold set son mensajes de WhatsApp sin asunto; los tickets sí lo
 *    tienen, y la PRD ya declara esa diferencia como límite («el material es más
 *    difícil que el real»). Redactar asuntos buenos habría hecho los tickets más
 *    fáciles que los 152 que midió la Fase 2, y la sesión estaría mirando otra
 *    cosa que la medida.
 *
 * 2. **`category` y `priority` se siembran como los deja producción**, no como
 *    dice el gold set: `category: "pqrs"` constante —literalmente lo que escribe
 *    `createTicket`— y `priority` **ausente**, porque en un ticket de PQRS nunca
 *    se ha escrito. Sembrarlos con la etiqueta correcta borraría justo lo que la
 *    sesión viene a ver: si el administrador corrige lo que le proponen.
 *    `type` sí sale del gold set, como si el residente hubiera elegido bien con
 *    el desplegable corregido el 15 de agosto; es el eje descriptivo y no tiene
 *    puerta en G7.
 *
 * 3. **Las respuestas previas son FABRICADAS, y es el único texto inventado
 *    aquí.** Ningún corpus tiene respuestas de administración: en WhatsApp el
 *    hilo lo escriben los vecinos. Esa es exactamente la divergencia que se
 *    encontró al construir la pantalla —en producción `responseHistory` lo
 *    escribe solo la administración, y la Fase 2 nunca midió esa forma de
 *    entrada—, así que cuatro tickets la llevan para que se vea en la sesión con
 *    ojos humanos en vez de descubrirse en la sombra.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";

const AQUI = dirname(fileURLToPath(import.meta.url));
const GOLD_SET = resolve(AQUI, "../../datasets/pqrs/gold-set.json");

// ── Guardas de proyecto ──────────────────────────────────────────────────────

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
if (!PROJECT_ID) {
  console.error(
    "\n✖ Falta FIREBASE_PROJECT_ID y aquí no hay default a propósito.\n" +
      "  Para el piloto:  FIREBASE_PROJECT_ID=vivaru-staging-02 node functions/scripts/seed-pqrs-piloto.mjs ...\n",
  );
  process.exit(1);
}

const PRODUCCION = "hogaru-1";
const permitirProduccion = process.argv.includes("--si-quiero-tocar-produccion");
if (PROJECT_ID === PRODUCCION && !permitirProduccion) {
  console.error(
    `\n✖ ${PROJECT_ID} es PRODUCCIÓN, y este script siembra tickets de prueba.\n` +
      "  Si de verdad es lo que quieres, añade --si-quiero-tocar-produccion.\n",
  );
  process.exit(1);
}

const arg = (nombre) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split("=")[1];
const TENANT_CON_SLA = arg("tenant-con-sla");
const TENANT_BUZON = arg("tenant-buzon");
const DRY_RUN = process.argv.includes("--dry-run");
const LIMPIAR = process.argv.includes("--limpiar");

if (!TENANT_CON_SLA) {
  console.error("\n✖ Falta --tenant-con-sla=<id>. Es el conjunto que lleva el grueso del piloto.\n");
  process.exit(1);
}

// ── Selección de casos ───────────────────────────────────────────────────────
//
// Fija y escrita, no aleatoria: la sesión tiene que poder repetirse y hay que
// saber de antemano qué se está enseñando. El reparto cubre las tres categorías,
// las tres prioridades y los dos países, con peso en `high` de mantenimiento
// —donde vive el guardrail de revisión humana— y sin dejar fuera `billing`, que
// es la clase con menos casos del gold set.

const CASOS_CON_SLA = [
  "MX#192", "MX#3019", "EC#2627", // maintenance / high
  "MX#106", "EC#1464", // maintenance / medium
  "MX#1470", // maintenance / low
  "MX#3025", // pqrs / high
  "MX#2037", "EC#1510", "MX#2272", // pqrs / medium
  "MX#1198", "EC#1125", "MX#1306", // pqrs / low
  "EC#2731", // billing / high
  "MX#2195", // billing / medium
  "MX#1351", // billing / low
];

const CASOS_BUZON = ["MX#3104", "MX#2979", "MX#1777", "EC#3119", "EC#1410", "EC#2114"];

/**
 * Dos de los ocho sintéticos de inyección. No están para medir —eso lo hizo la
 * evaluación offline, 8/8— sino para que la defensa se vea funcionando en la
 * pantalla real. `SYN#2` intenta subir la prioridad y `SYN#6` intenta arrancar
 * una promesa de compensación, que son los dos que más se parecen a un fallo
 * caro. Van marcados en la salida para que quien conduzca la sesión sepa
 * cuáles son.
 */
const CASOS_INYECCION = ["SYN#2", "SYN#6"];

/**
 * Tickets que llegan con respuesta previa de la administración. Ver la decisión
 * 3 de la cabecera: es el único texto inventado del script.
 */
const RESPUESTAS_PREVIAS = {
  "MX#192": "Buenas tardes. Ya avisamos al plomero y viene mañana por la mañana a revisar los departamentos de la columna afectada.",
  "EC#1464": "Estimados, la revisión de pintura quedó anotada para la próxima reunión de comité.",
  "MX#2037": "Gracias por el reporte. Lo estamos revisando con el proveedor.",
  "EC#2731": "Buenas tardes, ya nos comunicamos con la empresa eléctrica y estamos a la espera de su respuesta.",
};

// ── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Asunto = primera línea del mensaje, recortada. Ver la decisión 1 de la
 * cabecera: derivarlo no añade información que el modelo no tuviera en la
 * Fase 2; escribirlo a mano sí lo haría.
 */
function asuntoDesde(texto) {
  const completo = texto.replace(/\s+/g, " ").trim();
  const primeraLinea = (texto.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? completo)
    .replace(/\s+/g, " ")
    .trim();

  // Si la primera línea es solo un saludo —«Buen día», «Ing.», «Buenas
  // tardes.»—, no dice nada y como asunto es peor que nada. Se cae al mensaje
  // entero recortado, que es lo que haría cualquiera al rellenar el formulario.
  // El umbral es de longitud y no una lista de saludos: una lista se queda corta
  // en cuanto alguien escribe «Hola Paola, buen día» o «Estimados vecinos:».
  const base = primeraLinea.length >= 25 ? primeraLinea : completo;
  return base.length <= 80 ? base : `${base.slice(0, 77).trimEnd()}…`;
}

function iso(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDias);
  return d.toISOString();
}

/**
 * Días de antigüedad por posición. Reparte del día 1 al 19 para que el semáforo
 * de SLA enseñe los tres colores —el plazo son 15 días hábiles—, incluido algún
 * vencido. Un tablero donde todo está «al día» no deja ver la pantalla trabajar.
 */
function antiguedadPara(indice, total) {
  if (total <= 1) return 2;
  return 1 + Math.round((indice * 18) / (total - 1));
}

// ── Carga del gold set ───────────────────────────────────────────────────────

const bruto = JSON.parse(readFileSync(GOLD_SET, "utf-8"));
const casos = Array.isArray(bruto) ? bruto : (bruto.casos ?? bruto);
const porId = new Map(casos.map((c) => [c.id, c]));

function resolver(ids, etiqueta) {
  const faltan = ids.filter((id) => !porId.has(id));
  if (faltan.length) {
    console.error(
      `\n✖ El gold set ya no tiene estos casos de ${etiqueta}: ${faltan.join(", ")}\n` +
        "  Se editó `etiquetas.tsv` y se regeneró. Elige otros y actualiza este script.\n",
    );
    process.exit(1);
  }
  return ids.map((id) => porId.get(id));
}

const lote = [
  ...resolver(CASOS_CON_SLA, "con_sla").map((c) => ({ caso: c, tenantId: TENANT_CON_SLA, inyeccion: false })),
  ...resolver(CASOS_INYECCION, "inyección").map((c) => ({ caso: c, tenantId: TENANT_CON_SLA, inyeccion: true })),
  ...(TENANT_BUZON
    ? resolver(CASOS_BUZON, "buzon_simple").map((c) => ({ caso: c, tenantId: TENANT_BUZON, inyeccion: false }))
    : []),
];

if (!TENANT_BUZON) {
  console.warn(
    "\n⚠ Sin --tenant-buzon no se siembra la variante de buzón simple.\n" +
      "  La puerta dura de nulls se quedará medida solo por el evaluador, no vista en pantalla.\n",
  );
}

// ── Escritura ────────────────────────────────────────────────────────────────

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

/**
 * Unidades reales del conjunto, para que la pantalla no enseñe unidades falsas.
 *
 * En ensayo devuelve unidades de mentira **sin tocar la red**: así el ensayo
 * corre sin credenciales y sirve para revisar la selección de casos antes de
 * escribir nada. Un ensayo que necesita permisos de producción para contarte lo
 * que iba a hacer no es un ensayo.
 */
async function unidadesDe(tenantId) {
  if (DRY_RUN) {
    return Array.from({ length: 6 }, (_, i) => ({ id: `unidad-${i + 1}`, label: `Apto ${101 + i}` }));
  }
  const snap = await db.collection("units").where("tenantId", "==", tenantId).limit(50).get();
  // OJO: `unitId` del ticket es el DOC ID de la unidad, no el slug — trampa
  // conocida del repositorio: usar el slug produce un `permission-denied`
  // engañoso más adelante.
  return snap.docs.map((d) => ({ id: d.id, label: d.data().displayName || d.id }));
}

async function limpiarSembrados(tenantId) {
  const snap = await db.collection("tickets").where("tenantId", "==", tenantId).get();
  const sembrados = snap.docs.filter((d) => d.id.startsWith("piloto-pqrs-"));
  for (const doc of sembrados) await doc.ref.delete();
  console.log(`  ✓ ${tenantId}: borrados ${sembrados.length} tickets del piloto`);
}

async function main() {
  console.log(`\nProyecto: ${PROJECT_ID}${DRY_RUN ? "  (ENSAYO, no escribe)" : ""}`);
  console.log(`Conjunto con_sla: ${TENANT_CON_SLA}`);
  console.log(`Conjunto buzón:   ${TENANT_BUZON ?? "(ninguno)"}\n`);

  if (LIMPIAR && !DRY_RUN) {
    for (const t of [TENANT_CON_SLA, TENANT_BUZON].filter(Boolean)) await limpiarSembrados(t);
  }

  const unidadesPorTenant = new Map();
  for (const tenantId of [TENANT_CON_SLA, TENANT_BUZON].filter(Boolean)) {
    const unidades = await unidadesDe(tenantId);
    if (!unidades.length) {
      console.error(`\n✖ El conjunto ${tenantId} no tiene unidades. Siémbralo antes con seed-tenant.mjs.\n`);
      process.exit(1);
    }
    unidadesPorTenant.set(tenantId, unidades);
  }

  let n = 0;
  for (const [indice, { caso, tenantId, inyeccion }] of lote.entries()) {
    const unidades = unidadesPorTenant.get(tenantId);
    const unidad = unidades[indice % unidades.length];
    const dias = antiguedadPara(indice, lote.length);
    const fecha = iso(dias);
    const respuesta = RESPUESTAS_PREVIAS[caso.id];

    // Id derivado del caso: correr dos veces no duplica, actualiza.
    const docId = `piloto-pqrs-${caso.id.replace("#", "-").toLowerCase()}`;

    const ticket = {
      tenantId,
      unitId: unidad.id,
      unitLabel: unidad.label,
      // Constante, igual que `createTicket`. Ver decisión 2 de la cabecera.
      category: "pqrs",
      type: caso.espera?.type ?? "other",
      subject: asuntoDesde(caso.texto),
      message: caso.texto.trim(),
      status: respuesta ? "responded" : "open",
      radicado: `PQRS-P${String(indice + 1).padStart(3, "0")}`,
      radicationDate: fecha,
      eventDate: fecha.slice(0, 10),
      createdAt: fecha,
      updatedAt: fecha,
      residentName: `Residente ${unidad.label}`,
      // `priority` NO se escribe: en producción tampoco. Ver decisión 2.
      ...(respuesta
        ? {
            response: respuesta,
            respondedAt: iso(Math.max(0, dias - 1)),
            responseHistory: [
              {
                id: `rsp-piloto-${indice}`,
                message: respuesta,
                status: "responded",
                createdAt: iso(Math.max(0, dias - 1)),
                createdBy: "piloto",
                createdByName: "Administración",
              },
            ],
          }
        : {}),
    };

    const marca = inyeccion ? " ⚠ INYECCIÓN" : respuesta ? " · con respuesta previa" : "";
    console.log(
      `  ${caso.id.padEnd(9)} ${String(dias).padStart(2)}d  ${unidad.label.padEnd(12)} ${asuntoDesde(caso.texto).slice(0, 44)}${marca}`,
    );

    if (!DRY_RUN) {
      await db.collection("tickets").doc(docId).set(ticket, { merge: true });
    }
    n += 1;
  }

  console.log(`\n${DRY_RUN ? "Se habrían sembrado" : "Sembrados"} ${n} tickets.`);
  console.log(
    "Los dos marcados ⚠ son casos de inyección del gold set: están para ver la defensa\n" +
      "funcionando en pantalla, no para medirla. Quien conduzca la sesión ya lo sabe.\n",
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("\n✖ Falló el sembrado:", error?.message ?? error, "\n");
    process.exit(1);
  },
);
