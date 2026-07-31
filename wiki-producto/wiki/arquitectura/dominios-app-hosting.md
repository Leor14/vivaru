---
tags: [arquitectura, infraestructura, dominios, incidentes]
tipo: concepto
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Dominios y App Hosting — Operación e Incidente 403

Cómo se sirven los frentes de Vivaru y el runbook del incidente de julio 2026 en que `grupovivaru.com` devolvió **403 en todas las rutas** con toda la configuración "en verde".

## Topología

- **Prod:** backend App Hosting `vivaru` (proyecto `hogaru-1`), rama `master`, URL directa `vivaru--hogaru-1.us-central1.hosted.app`, dominios custom `grupovivaru.com` y `www` (registrador Squarespace, DNS en Cloud DNS con nameservers `ns-cloud-d*`).
- **Staging:** backend `vivaru-staging-web` (proyecto `vivaru-staging-02`), rama `develop`, rollout automático al push. El [[stack-tecnico]] documenta el resto del stack.
- Las functions se despliegan aparte a cada proyecto (`firebase deploy --only functions:<n> --project <p>`); ver [[correos-mensajeria]] para el secret de Resend.

## El incidente y su runbook

Síntoma: 403 del edge de Google en apex y www, con dominio `HOST_ACTIVE / OWNERSHIP_ACTIVE / CERT_ACTIVE` y la app sana en la URL directa (200). Diagnóstico: **enrutamiento interno del custom domain roto** tras un rollout — invisible en toda la config.

Solución que funcionó (canario primero con `www`, luego el apex):

1. `DELETE` + `CREATE` del dominio vía API (`firebaseapphosting.googleapis.com/v1beta/...:/domains`).
2. La recreación exige **re-verificar titularidad**: cambia el TXT `fah-claim=...` del DNS (quitar el viejo, poner el nuevo que reporta `requiredDnsUpdates`). El registro A no se toca.
3. Verificar `OWNERSHIP_ACTIVE` y HTTP 200.

Mientras tanto, la URL directa del backend es el acceso operativo de contingencia. Claves aprendidas registradas también en [[trampas-conocidas]]: la URL directa siempre responde aunque el dominio caiga; el TXT de verificación vive donde estén los nameservers (Cloud DNS ≠ registrador); y los tokens de `gcloud`/`firebase` expiran en sesiones largas (síntoma `invalid_rapt` → pedir re-login al usuario).

## Relaciones

- Véase también: [[estructura-app-router]], [[multi-tenancy]]
- Se conecta con: [[autenticacion-roles]], [[landing-marketing]], [[triaje-auditoria-ux]]

## Fuentes

- Sesión de incidente jul-2026 (resolución completa el 2026-07-01)
