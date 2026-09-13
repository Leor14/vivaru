// T1.9 · Las membresías, al final de la historia (plan §3.8), y los dos portales que la guía de
// onboarding da por recorridos (§12.5).
//
// **La membresía se escribe después de la historia a propósito**: los avisos a residentes y
// portería se resuelven por `tenantUsers`, así que mientras no existe, ningún disparador de la
// historia encuentra a quién avisar. Lleva los mismos campos que `users` (contrato, G); la del
// residente, con la casa por su id de documento, que es de donde salen sus avisos y su acceso
// (`residentOwnUnit`). El consejo, con la función del producto (`aplicarMarcaDeConsejo`), que
// exige la membresía: por eso va aquí y no en el padrón.

import { createRequire } from "node:module";
import { FieldValue } from "firebase-admin/firestore";

import { crearSiFalta, fechar, marcaDe } from "../motor.mjs";
import { instante } from "../reloj.mjs";
import { CARGA } from "./padron.mjs";

const require = createRequire(import.meta.url);
const { aplicarMarcaDeConsejo } = require("../../../lib/rol-consejo.js");

/** Cuándo los recorrió la administración: la mañana del primer día en Vivaru. */
const RECORRIDOS = {
  "portal-porteria": ["2026-06-01", "09:40"],
  "portal-residente": ["2026-06-01", "09:55"],
};

export async function escribirMembresias(ctx, padron) {
  const casas = new Map(padron.casas.map((c) => [c.id, c]));
  const alta = marcaDe(CARGA, "10:30");
  for (const c of padron.cuentas) {
    const uid = ctx.uids.get(c.clave);
    if (!uid || uid.startsWith("simulado:")) {
      ctx.cuenta("tenantUsers", "crearia");
      continue;
    }
    const id = `${ctx.tenantId}_${uid}`;
    const casa = c.casaId ? casas.get(c.casaId) : null;
    await crearSiFalta(ctx, "tenantUsers", id, {
      uid,
      email: c.email,
      fullName: c.fullName,
      role: c.role,
      status: "active",
      ...(casa ? { unitId: casa.id, unitLabel: casa.displayName } : {}),
      mustChangePassword: false,
      passwordStatus: "updated",
      createdAt: alta,
      updatedAt: alta,
    });
    if (!c.consejo) continue;
    if (!ctx.escribir) {
      ctx.cuenta("marcas de consejo", "crearia");
      continue;
    }
    const r = await aplicarMarcaDeConsejo({ tenantId: ctx.tenantId, actorUid: ctx.adminUid, targetUid: uid, quiereLaMarca: true });
    if (!r.cambiado) {
      ctx.cuenta("marcas de consejo", "existe");
      continue;
    }
    const nombrado = marcaDe(CARGA, "10:45");
    await fechar(ctx, "tenantUsers", [id], { committeeSince: nombrado, updatedAt: nombrado });
    ctx.cuenta("marcas de consejo", "creado");
  }
}

/**
 * `tenantOnboarding/{t}.seen`, con cadenas ISO (un Timestamp se ignora). Solo los que falten: si la
 * administración ya los recorrió de verdad, se respeta su fecha. Lo que había se guarda para
 * `--limpiar`.
 */
export async function marcarOnboarding(ctx) {
  const ref = ctx.db.collection("tenantOnboarding").doc(ctx.tenantId);
  const snap = await ref.get();
  const visto = snap.data()?.seen ?? {};
  const faltan = Object.keys(RECORRIDOS).filter((k) => !visto[k]);
  if (!faltan.length) return ctx.cuenta("tenantOnboarding (portales recorridos)", "existe");
  if (!ctx.escribir) return ctx.cuenta("tenantOnboarding (portales recorridos)", "crearia");
  if (!(await ctx.manifiesto.ref.get()).data()?.onboardingPrevio) {
    await ctx.manifiesto.ref.set({ onboardingPrevio: { existia: snap.exists, faltaban: faltan } }, { merge: true });
  }
  const seen = Object.fromEntries(faltan.map((k) => [k, instante(...RECORRIDOS[k]).toISOString()]));
  await ref.set({ tenantId: ctx.tenantId, seen, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  ctx.cuenta("tenantOnboarding (portales recorridos)", "creado");
}

/** `--refrescar`: los uid de las cuentas ya sembradas, sin crear ninguna. */
export async function cargarUids(ctx, padron) {
  for (const c of padron.cuentas) {
    const u = await ctx.auth.getUserByEmail(c.email).catch(() => null);
    if (u) ctx.uids.set(c.clave, u.uid);
  }
}
