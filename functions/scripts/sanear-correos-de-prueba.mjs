// Saca de dominios REALES las direcciones de las cuentas de prueba.
//
// EL PROBLEMA QUE RESUELVE, dicho sin adornos: varias cuentas de prueba se
// crearon con una dirección de gmail tecleada a mano —un nombre de pila suelto—
// y esas direcciones **pertenecen a personas de verdad**. Las cuentas son
// nuestras; los buzones NO. Mientras sigan así:
//
//   · el correo de ALTA ya les llega hoy: `sendAccountEmail` NO está detrás de
//     ninguna bandera ni del interruptor «También por correo», así que cada
//     residente nuevo con una dirección tecleada manda un enlace de acceso a un
//     desconocido;
//   · y el día que se abra el canal de avisos, les llegarían recordatorios de
//     cobranza —con el estado de cuenta adjunto si `producto-calendario-de-
//     cobranza` está encendida—, que es el incidente que §12 de `PRD-V-FLOW-003`
//     llama «el peor error posible de esta PRD».
//
// Ficha: `docs/hallazgo-direcciones-de-correo.md`.
//
// QUÉ TOCA, Y POR QUÉ SON CUATRO SITIOS Y NO UNO. La dirección vive en tres
// colecciones —`users` (de donde el envío saca el destinatario), `people` (el
// contacto que el administrador corrige) y `tenantUsers` (la membresía)— **y
// además es la identidad de Firebase Auth**. Cambiar solo Firestore deja la
// cuenta entrando con la dirección vieja: no arregla nada y da la sensación de
// que sí. Por eso Auth va incluido.
//
// CONSECUENCIA QUE HAY QUE SABER ANTES DE CORRER ESTO: quien use esas cuentas
// **pasa a entrar con la dirección nueva**. La contraseña NO se toca.
//
// Deliberadamente aburrido:
//   · En SECO por defecto. Escribe solo con `--escribir`.
//   · Guarda `emailPrevio` en los tres documentos, así que TIENE vuelta atrás
//     (`--revertir`). Es el mismo patrón que `unitLabelPrevio` de `FIX-002`.
//   · NO adivina: si una cuenta de Auth no existe, si la dirección nueva ya está
//     tomada, o si el nombre no da un slug utilizable, **lista y no toca**.
//   · El proyecto va como argumento SIEMPRE.
//
// Uso: node functions/scripts/sanear-correos-de-prueba.mjs <projectId> [--escribir] [--revertir]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const [projectId, ...flags] = process.argv.slice(2);
const ESCRIBIR = flags.includes("--escribir");
const REVERTIR = flags.includes("--revertir");

if (!projectId) {
  console.error("Falta el projectId. Uso: node functions/scripts/sanear-correos-de-prueba.mjs <projectId> [--escribir] [--revertir]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const auth = getAuth();

const COLECCIONES = ["users", "people", "tenantUsers"];
const DOMINIO_SEGURO = "ejemplo.vivaru.app";

// Proveedores de buzón REAL. Una dirección aquí llega a una persona.
const PROVEEDOR = /^(gmail|hotmail|outlook|yahoo|icloud|live|msn)\./i;
// Dedazos conocidos: no llegan, pero son de un dominio ajeno igualmente.
const DEDAZO = /^(gmial|gmai|hotmial|outlok|yaho)\./i;

/** Riesgo = buzón real con parte local genérica (nombre de pila suelto), o dedazo. */
function esDeRiesgo(email) {
  if (!email || !email.includes("@")) return false;
  const [local, dominio] = email.split("@");
  if (DEDAZO.test(dominio)) return true;
  return PROVEEDOR.test(dominio) && /^[a-z]{3,10}$/i.test(local);
}

/** Enmascara para imprimir. NUNCA se escribe una dirección completa en el log. */
function mask(email) {
  if (!email || !email.includes("@")) return String(email);
  const [l, d] = email.split("@");
  const m = l.length <= 2 ? l[0] + "*" : l[0] + "*".repeat(l.length - 2) + l.slice(-1);
  return `${m}@${d}`;
}

function slug(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  console.log(`\nProyecto: ${projectId} · modo: ${REVERTIR ? "REVERTIR" : ESCRIBIR ? "ESCRIBIR" : "EN SECO"}\n`);

  // 1· Reunir por persona. La misma dirección puede estar en varias colecciones
  //    y en varios conjuntos: se trata como UNA identidad.
  const porCorreo = new Map();
  for (const col of COLECCIONES) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
      const data = d.data();
      const clave = REVERTIR ? data.emailPrevio : (data.email || "").trim().toLowerCase();
      if (!clave) continue;
      if (!REVERTIR && !esDeRiesgo(clave)) continue;
      const actual = (data.email || "").trim().toLowerCase();
      const entrada = porCorreo.get(REVERTIR ? clave : actual) ?? { docs: [], nombre: null, tenantId: null };
      entrada.docs.push({ col, id: d.id, ref: d.ref, data });
      entrada.nombre ??= data.fullName || data.name || null;
      entrada.tenantId ??= data.tenantId || null;
      porCorreo.set(REVERTIR ? clave : actual, entrada);
    }
  }

  if (porCorreo.size === 0) {
    console.log("  No hay nada que hacer.\n");
    return;
  }

  // 2· Calcular el destino y comprobar TODAS las guardas antes de tocar nada.
  const plan = [];
  const rechazos = [];
  for (const [correo, entrada] of porCorreo) {
    const destino = REVERTIR
      ? correo
      : `${slug(entrada.nombre) || "sin-nombre"}.${entrada.tenantId || "sin-conjunto"}@${DOMINIO_SEGURO}`;

    if (!REVERTIR && (!entrada.nombre || !slug(entrada.nombre))) {
      rechazos.push({ correo, motivo: "sin `fullName` utilizable: no se puede derivar una dirección estable" });
      continue;
    }

    // ¿existe la cuenta de Auth de origen?
    //
    // **Y aquí la distinción que costó un rechazo falso en la primera pasada:**
    // no todo el que tiene correo es un USUARIO. Un registro que vive solo en
    // `people` es un CONTACTO —alguien a quien el administrador le anotó el
    // correo—, no una identidad: no hay nada que cambiar en Auth y arreglar
    // Firestore es el arreglo COMPLETO. Exigirle cuenta de Auth lo dejaba fuera,
    // que es justo al revés de lo que hace falta.
    const origen = REVERTIR ? entrada.docs[0].data.email : correo;
    const esIdentidad = entrada.docs.some((d) => d.col === "users" || d.col === "tenantUsers");
    let uid = null;
    try {
      uid = (await auth.getUserByEmail(origen)).uid;
    } catch {
      if (esIdentidad) {
        rechazos.push({ correo, motivo: `tiene documento de usuario o membresía pero NO cuenta de Auth: cambiar solo Firestore dejaría la identidad vieja viva` });
        continue;
      }
      // Solo contacto: se sanea igual, sin tocar Auth.
      uid = null;
    }

    // ¿el destino ya está tomado por OTRA cuenta?
    try {
      const ocupa = await auth.getUserByEmail(destino);
      if (!uid || ocupa.uid !== uid) {
        rechazos.push({ correo, motivo: `la dirección destino ya la tiene otra cuenta (${ocupa.uid.slice(0, 8)}…)` });
        continue;
      }
    } catch { /* libre, que es lo normal */ }

    plan.push({ correo, destino, uid, docs: entrada.docs, nombre: entrada.nombre });
  }

  // 3· Enseñar el plan. Enmascarado el origen; el destino va entero porque es
  //    con lo que el equipo va a entrar y tiene que poder copiarlo.
  console.log(`  Personas a sanear: ${plan.length}   ·   rechazadas: ${rechazos.length}\n`);
  for (const p of plan) {
    console.log(`  «${p.nombre}»`);
    console.log(`     ${mask(p.correo)}  →  ${p.destino}`);
    console.log(`     ${p.uid ? `Auth uid ${p.uid.slice(0, 8)}…` : "solo CONTACTO (sin cuenta de Auth)"}  ·  ${p.docs.length} documento(s): ${p.docs.map((d) => d.col).join(", ")}`);
  }
  if (rechazos.length) {
    console.log(`\n  NO SE TOCAN, y aquí está el porqué de cada una:`);
    for (const r of rechazos) console.log(`     ${mask(r.correo)} — ${r.motivo}`);
  }

  const totalDocs = plan.reduce((a, p) => a + p.docs.length, 0);
  const conAuth = plan.filter((p) => p.uid).length;
  // Se cuentan las cuentas de Auth REALES, no las personas del plan: hay quien
  // es solo contacto. Decir «7 cuentas» sobre 6 es la clase de cifra que nadie
  // vuelve a comprobar.
  console.log(`\n  Total: ${totalDocs} documento(s) de Firestore + ${conAuth} cuenta(s) de Auth (de ${plan.length} personas; ${plan.length - conAuth} son solo contacto).`);

  if (!ESCRIBIR && !REVERTIR) {
    console.log("\n  EN SECO — no se ha escrito nada. Añade `--escribir` para aplicarlo.\n");
    return;
  }
  if (REVERTIR && !ESCRIBIR) {
    console.log("\n  EN SECO (revertir) — añade `--escribir` para aplicarlo.\n");
    return;
  }

  // 4· Escribir. Auth PRIMERO: si falla, Firestore queda intacto y coherente.
  //    Al revés, un fallo dejaría documentos apuntando a una identidad que no cambió.
  let okAuth = 0, okDocs = 0;
  for (const p of plan) {
    if (p.uid) {
      try {
        await auth.updateUser(p.uid, { email: p.destino });
        okAuth++;
      } catch (e) {
        console.error(`  ✘ Auth falló para «${p.nombre}»: ${e.message} — se salta también su Firestore`);
        continue;
      }
    }
    for (const d of p.docs) {
      const patch = REVERTIR
        ? { email: d.data.emailPrevio, emailPrevio: FieldValue.delete(), emailSaneadoEn: FieldValue.delete() }
        : { email: p.destino, emailPrevio: d.data.email, emailSaneadoEn: new Date().toISOString() };
      await d.ref.update(patch);
      okDocs++;
    }
  }
  console.log(`\n  Hecho: ${okAuth} cuenta(s) de Auth y ${okDocs} documento(s).`);
  if (!REVERTIR) console.log(`  Vuelta atrás: el mismo comando con \`--revertir --escribir\`.\n`);
  else console.log("");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
