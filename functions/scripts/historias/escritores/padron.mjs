// T1.4 · El padrón y la configuración: ajustes, casas, cuentas (sin membresía), personas, áreas
// comunes, proveedores, cuentas bancarias con su saldo de apertura, y el servicio medido.
//
// Cada documento lleva la forma que deja la alta del producto (contrato, secciones A, C, D, E y G),
// fechado a fines de mayo: el conjunto se cargó en Vivaru antes de su primer mes.
//
// **Las cuentas nacen SIN membresía** (plan §3.8): los avisos a residentes y portería se resuelven
// por `tenantUsers`, así que mientras no exista nadie de esos roles recibe los disparadores de la
// historia. La membresía se escribe al final (T1.9). Y nacen **sin contraseña y sin correo**: las
// altas del producto mandan correo, y esto no las llama.

import { FieldValue } from "firebase-admin/firestore";

import { APERTURA } from "../lomas-de-sayilbedra.mjs";
import { crearSiFalta, firma, marcaDe } from "../motor.mjs";

/** El día en que la administración cargó el conjunto en Vivaru: altas, cuentas y membresías. */
export const CARGA = "2026-05-29";

/**
 * JSON con las claves de los mapas ordenadas. Firestore devuelve un mapa con otro orden de claves
 * que el que se escribió, así que comparar con `JSON.stringify` a secas daba «distinto» entre dos
 * valores iguales, y la segunda corrida volvía a escribir los ajustes (lo cazó la prueba de
 * idempotencia, no leerlo).
 */
function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor ?? null);
}

async function ajustes(ctx, padron) {
  const ref = ctx.db.collection("tenantSettings").doc(ctx.tenantId);
  const claves = ["tenantName", "agrupaciones", "residentModules", "reservationPolicy", "brandColor", "fiscalProfile"];
  const snap = await ref.get();
  const actuales = snap.data() ?? {};
  const faltan = claves.filter((k) => canonico(actuales[k]) !== canonico(padron.ajustes[k]));
  if (!faltan.length) {
    ctx.cuenta("tenantSettings", "existe");
    return;
  }
  if (!ctx.escribir) {
    ctx.cuenta("tenantSettings", "crearia");
    return;
  }
  // Lo que había antes, para que `--limpiar` pueda devolverlo (solo la primera vez).
  const manifiesto = await ctx.manifiesto.ref.get();
  if (!manifiesto.data()?.ajustesPrevios) {
    const previos = Object.fromEntries(claves.map((k) => [k, actuales[k] ?? null]));
    await ctx.manifiesto.ref.set({ ajustesPrevios: previos }, { merge: true });
  }
  const datos = { tenantId: ctx.tenantId, updatedBy: ctx.adminUid, updatedAt: FieldValue.serverTimestamp() };
  for (const k of claves) datos[k] = padron.ajustes[k];
  await ref.set(datos, { merge: true });
  ctx.cuenta("tenantSettings", "creado");
}

async function cuentas(ctx, padron) {
  const casas = new Map(padron.casas.map((c) => [c.id, c]));
  for (const c of padron.cuentas) {
    let usuario = await ctx.auth.getUserByEmail(c.email).catch(() => null);
    if (usuario) {
      const perfil = await ctx.db.collection("users").doc(usuario.uid).get();
      const suyo = perfil.data()?.tenantId;
      if (perfil.exists && suyo !== ctx.tenantId) {
        throw new Error(`La cuenta ${c.email} ya existe y es del conjunto «${suyo}»: no se reutiliza.`);
      }
    } else if (ctx.escribir) {
      usuario = await ctx.auth.createUser({ email: c.email, displayName: c.fullName, emailVerified: true });
      ctx.manifiesto.anotarUsuario(usuario.uid);
    }
    const uid = usuario?.uid ?? `simulado:${c.clave}`;
    ctx.uids.set(c.clave, uid);
    if (!usuario) {
      ctx.cuenta("auth", "crearia");
      continue;
    }
    ctx.cuenta("auth", ctx.manifiesto.usuarios.has(uid) ? "creado" : "existe");
    if (ctx.escribir) await ctx.auth.setCustomUserClaims(uid, { role: c.role, tenantId: ctx.tenantId });

    const casa = c.casaId ? casas.get(c.casaId) : null;
    await crearSiFalta(ctx, "users", uid, {
      uid,
      email: c.email,
      fullName: c.fullName,
      role: c.role,
      status: "active",
      ...(casa ? { unitId: casa.id, unitLabel: casa.displayName } : {}),
      mustChangePassword: false,
      passwordStatus: "updated",
      createdAt: marcaDe(CARGA, "10:30"),
      updatedAt: marcaDe(CARGA, "10:30"),
    });
  }
}

export async function escribirPadron(ctx, padron) {
  const alta = marcaDe(CARGA, "10:00");

  await ajustes(ctx, padron);

  for (const c of padron.casas) {
    await crearSiFalta(ctx, "units", c.id, {
      unitId: c.clave,
      displayName: c.displayName,
      tower: c.tower,
      type: c.type,
      status: "active",
      coefficient: c.coefficient,
      areaSqm: c.areaSqm,
      ownerIds: c.ownerIds,
      residentIds: c.residentIds,
      ...firma(ctx, alta),
    });
  }

  await cuentas(ctx, padron);
  const authUidDe = new Map(padron.cuentas.filter((c) => c.personaId).map((c) => [c.personaId, ctx.uids.get(c.clave)]));

  for (const p of padron.personas) {
    const uid = authUidDe.get(p.id);
    await crearSiFalta(ctx, "people", p.id, {
      fullName: p.fullName,
      email: p.email,
      roleType: p.roleType,
      occupancyType: p.roleType,
      unitId: p.casaId,
      tower: p.tower,
      status: "active",
      ...(uid && !uid.startsWith("simulado:") ? { authUid: uid } : {}),
      ...firma(ctx, alta),
    });
  }

  for (const a of padron.areas) {
    const { id, clave, ...datos } = a;
    await crearSiFalta(ctx, "amenities", id, { ...datos, status: "active", ...firma(ctx, alta) });
  }

  for (const v of padron.proveedores) {
    await crearSiFalta(ctx, "vendors", v.id, {
      type: "proveedor",
      legalName: v.legalName,
      status: "active",
      defaultCategory: v.defaultCategory,
      ...firma(ctx, alta),
    });
  }

  for (const b of padron.bancos) {
    await crearSiFalta(ctx, "bankAccounts", b.id, {
      label: b.label,
      bankName: b.bankName,
      accountNumber: b.accountNumber,
      accountType: "corriente",
      currency: "MXN",
      active: true,
      ...firma(ctx, alta),
    });
    // El saldo al 31 de mayo, fuera del documento de la cuenta: el residente lee la cuenta entera.
    await crearSiFalta(ctx, "bankAccountBalances", b.id, {
      openingBalance: b.saldoApertura,
      updatedBy: ctx.adminUid,
      updatedAt: marcaDe(APERTURA, "18:00"),
    });
  }

  const s = padron.servicioMedido;
  await crearSiFalta(ctx, "meteredServices", s.id, {
    name: s.name,
    unit: s.unit,
    rate: s.rate,
    accountCode: s.accountCode,
    active: true,
  });
}
