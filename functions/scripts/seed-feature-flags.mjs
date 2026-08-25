// Siembra el catálogo de banderas de funcionalidad.
//
// Las banderas son un mecanismo GENÉRICO de plataforma: valen para cualquier
// capacidad que tenga que poder apagarse sin desplegar. El programa de IA es su
// primer cliente (Paso 1.1 de docs/hoja-de-ruta-ia.md), no su dueño.
//
// IDEMPOTENTE Y NO DESTRUCTIVO: crea el documento que falte y no toca ni un
// campo de los que ya existen. Correrlo dos veces no reenciende nada, y correrlo
// después de haber apagado algo a mano no lo revive — que es justo el fallo que
// convertiría un script de siembra en un incidente.
//
// El catálogo vive en src/lib/feature-flags/catalog.ts y en
// functions/src/feature-flags.ts. Este es el tercer espejo, y es .mjs porque se
// corre con node suelto contra un proyecto real. Si cambias uno, cambia los tres.
//
// Uso: node functions/scripts/seed-feature-flags.mjs <projectId> [--dry-run]
//      node functions/scripts/seed-feature-flags.mjs hogaru-1 --dry-run

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!projectId) {
  console.error("Uso: node seed-feature-flags.mjs <projectId> [--dry-run]");
  process.exit(1);
}

const GLOBAL_FLAG_DOC_ID = "_global";

// `enabled` sale del catálogo: capacidad nueva nace apagada; bandera puesta
// sobre una función que ya está viva nace encendida, porque si no, sembrarla
// sería apagar la función para todos.
const CATALOGO = [
  {
    key: "ai-gateway",
    area: "ia",
    label: "Puerta de entrada de IA",
    origen: "PLAT-001",
    enabled: false,
  },
  {
    key: "ai-communications-draft",
    area: "ia",
    label: "Borrador asistido de comunicaciones",
    origen: "FEAT-003",
    enabled: false,
  },
  {
    key: "ai-pqrs-shadow",
    area: "ia",
    label: "Clasificación de PQRS en modo sombra",
    origen: "FEAT-002",
    enabled: false,
  },
  {
    key: "ai-pqrs-suggestions",
    area: "ia",
    label: "Sugerencia visible de PQRS",
    origen: "FEAT-002",
    enabled: false,
  },
  {
    key: "ai-onboarding-column-mapping",
    area: "ia",
    label: "Mapeo asistido de columnas",
    origen: "FEAT-001",
    enabled: false,
  },
  {
    key: "ai-receipts-extraction",
    area: "ia",
    label: "Extracción de comprobantes",
    origen: "DOC-001",
    enabled: false,
  },
  {
    key: "ia-proveedor-real",
    area: "ia",
    label: "Llamar al proveedor real",
    origen: "Paso 1.4",
    // Nace apagada: es la bandera que empieza a gastar dinero.
    enabled: false,
  },
  {
    key: "producto-reservas-servidor",
    area: "producto",
    label: "Reservas decididas en el servidor",
    origen: "PRD-V-FIX-001",
    // Nace apagada: capacidad nueva. Encendida, la reserva del residente pasa
    // por la callable y las trece reglas se comprueban donde no se puede mentir.
    enabled: false,
  },
  {
    key: "producto-cobro-por-coeficiente",
    area: "producto",
    label: "Corrida de cobro por coeficiente",
    origen: "PRD-V-PLAT-001",
    // Nace apagada: capacidad nueva. Los coeficientes se pueden cargar con esto
    // apagado —son parte de la puesta en marcha—; el botón de generar, no.
    enabled: false,
  },
  {
    key: "producto-registro-proveedores",
    area: "producto",
    label: "Registro de proveedores",
    origen: "PRD-V-FEAT-003",
    // Nace apagada: capacidad nueva. El nombre a mano en el egreso nunca se
    // retira, así que apagarla no quita nada que ya se usara.
    enabled: false,
  },
  {
    key: "producto-plan-de-cuentas",
    area: "producto",
    label: "Plan de cuentas del conjunto",
    origen: "PRD-V-PLAT-003",
    // Nace apagada: capacidad nueva. La semilla del plan se crea igual, así que
    // apagarla no deja al conjunto sin cuentas.
    enabled: false,
  },
  {
    key: "producto-concepto-al-libro",
    area: "producto",
    label: "El concepto del cargo llega al libro",
    origen: "PRD-V-PLAT-003 §5.2",
    // Nace apagada y se enciende SOLA, mirando: cambia el estado financiero de
    // todo conjunto que cobre algo distinto de la cuota.
    enabled: false,
  },
  {
    key: "producto-multiconjunto",
    area: "producto",
    label: "Un administrador sobre varios conjuntos",
    origen: "PRD-V-PLAT-002 §11.4",
    // Nace apagada: capacidad nueva. Además hoy es inerte — el selector pide
    // dos membresías y en producción nadie tiene dos.
    enabled: false,
  },
  {
    key: "operacion-app-check-monitor",
    area: "operacion",
    label: "App Check en modo monitor",
    origen: "Paso 1.2",
    // Nace ENCENDIDA: describe lo que ya pasa hoy. Apagarla hace que la puerta
    // de IA rechace las llamadas sin App Check.
    enabled: true,
  },
];

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

async function crearSiFalta(ref, data, etiqueta) {
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`  = ${etiqueta} — ya existe, no se toca`);
    return false;
  }

  if (dryRun) {
    console.log(`  + ${etiqueta} — se crearía (dry run)`);
    return true;
  }

  await ref.set(data);
  console.log(`  + ${etiqueta} — creado`);
  return true;
}

async function main() {
  console.log(`\nCatálogo de banderas en ${projectId}${dryRun ? " (dry run)" : ""}\n`);

  const ahora = Timestamp.now();
  let creados = 0;

  creados += (await crearSiFalta(
    db.collection("featureFlags").doc(GLOBAL_FLAG_DOC_ID),
    { killSwitch: false, reason: "", updatedAt: ahora, updatedBy: "seed-feature-flags" },
    `${GLOBAL_FLAG_DOC_ID} (kill switch maestro)`,
  ))
    ? 1
    : 0;

  for (const bandera of CATALOGO) {
    creados += (await crearSiFalta(
      db.collection("featureFlags").doc(bandera.key),
      {
        enabled: bandera.enabled,
        killSwitch: false,
        area: bandera.area,
        label: bandera.label,
        origen: bandera.origen,
        updatedAt: ahora,
        updatedBy: "seed-feature-flags",
      },
      `${bandera.key} — ${bandera.label}`,
    ))
      ? 1
      : 0;
  }

  console.log(`\n${creados} documento(s) ${dryRun ? "por crear" : "creado(s)"}.`);
  console.log(
    "Los overrides por conjunto viven en featureFlagOverrides/{tenantId} y no se siembran:\n" +
      "existen solo cuando alguien aparta un conjunto del valor global.\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
