# Plan — Seed demo automatizado: "Conjunto Las Playas"

> Objetivo: un conjunto demo **precargado con ~3 meses de actividad + el mes actual**, para
> presentar a un cliente una interacción viva (morosos reales, PQRS por vencer, visitas de hoy,
> paquetes pendientes, comunicados, encuestas, acuerdos). Reproducible, idempotente y reseteable.
>
> Análisis + planning. Se apoya en la infra de seed existente.

---

## 1. Qué ya existe (y reutilizamos)

- **`functions/scripts/seed-tenant.mjs`** — orquestador idempotente (Admin SDK + ADC). Acepta
  `--tenant=co|mx|all`; escribe con `{ merge: true }`; `CLEAR=true` borra el tenant antes de
  resembrar; patrón **`offsetDays`** para fechar registros (negativo = pasado, 0 = hoy).
- **`functions/scripts/seed-data-co.mjs` / `seed-data-mx.mjs`** — constantes de datos por país
  (tenant, users, units, people, amenities, billing, pqrs, visitors, packages, communications,
  reservations).
- **`functions/scripts/clean-demo-data.js`** — limpieza segura (DRY_RUN por defecto).
- Creación de usuarios con login: patrón `upsertAuthUser` (Auth + `users` + `tenantUsers` + custom
  claims `{role, tenantId}`), password demo `Demo1234*`.

**Estrategia:** crear `seed-data-playas.mjs`, añadir target `--tenant=playas` en `seed-tenant.mjs`,
y extender el orquestador para sembrar también **surveys** y **committee_agreements** (hoy no los
cubre). Reset con `CLEAR=true`.

---

## 2. Dónde correrlo (decisión clave)

| Opción | Pro | Contra |
|---|---|---|
| **Staging** (`vivaru-staging-02`) | Aislado, cero riesgo, ideal para ensayar | URL no branded (`...hosted.app`) |
| **Producción** (`hogaru-1`) | URL branded (**grupovivaru.com**), demo más vendedora; aún no hay clientes reales que se contaminen | Resend está vivo (mitigable, ver §5) |

Recomendación: **producción** para la demo al cliente (se ve en grupovivaru.com y el tenant queda
aislado por `tenantId`), con **emails demo controlados** (§5). Staging para ensayar antes.
Se decide por `FIREBASE_PROJECT_ID`.

---

## 3. Estructura de "Conjunto Las Playas"

- **2 torres**, ~**12 unidades** (T1-101..106, T2-201..206) — poblado pero manejable.
- **~12 residentes** (propietarios e inquilinos) + **1 administrador** + **1 portería**.
- `moduleVariants`: **todas completas** (`qr_full`, `con_evidencia`, `con_sla`, `canal_oficial`,
  `formal`, `completa`) para lucir todas las funciones. (Opcional: un 2º demo "Las Playas Lite"
  con variantes simples.)
- Branding propio (nombre, color) para que se sienta un conjunto real.

---

## 4. La "historia" de 3 meses + mes actual (lo que hace creíble la demo)

Meses **M-3, M-2, M-1, M (actual)**. Datos deterministas (misma historia en cada demo). Pensados
para que **los tableros luzcan vivos hoy**:

- **Cartera (Finanzas):** cuota de administración por unidad cada mes (48 cobros) + algún
  extraordinario/parqueadero. Patrón de pago realista: meses pasados casi todos pagados; **mes
  actual: varias pendientes y 2–3 vencidas → "Morosos" y el % de recaudo se ven reales**. Algunos
  comprobantes subidos por residentes (pending/approved).
- **PQRS:** ~10 tickets repartidos; estados variados (abierto, en proceso, respondido, resuelto);
  **al menos uno "por vencer" hoy y uno vencido** → el semáforo de 15 días se ve en acción.
- **Visitas:** ~8 pases; algunos completados (meses atrás), **1–2 "dentro" y 1–2 programadas para
  hoy/esta semana** → el panel de portería muestra actividad.
- **Paquetería:** ~12 paquetes; mezcla **pendientes (hoy/esta semana)** y entregados.
- **Comunicaciones:** ~4 comunicados repartidos (uno reciente, "vigente").
- **Reservas:** amenidades con reservas pasadas (aprobadas) y **próximas (esta semana)**.
- **Encuestas:** 1 cerrada (con respuestas y resultados) + 1 publicada abierta.
- **Acuerdos de comité:** 1 formal con algunas firmas (y firmas **pendientes**) + 1 informativo.

> El criterio: que al abrir el dashboard del admin **hoy**, el cliente vea números distintos de
> cero, alertas activas y cosas "que pasan esta semana".

---

## 5. Evitar correos reales durante el seed (punto crítico)

**Realidad técnica:** los triggers de Firestore (`onCommunicationCreated`, `onTicketCreated`,
`onBillingStatementCreated`, etc.) **se disparan con cualquier escritura, también Admin SDK** — no
se pueden "saltar" desde el script. Mitigaciones:

1. **Billing:** sembrar con `source: "import"` → el trigger **suprime** la notificación/correo.
2. **Sembrar estados finales en un solo `create`** → evita los triggers de **UPDATE** (que son los
   que más email mandan): PQRS ya `resuelto` con `response`, reserva ya `approved`, acuerdo ya
   `enviado`, encuesta ya `published`. Así `onTicketUpdated`/`onReservationUpdated`/
   `onCommitteeAgreementUpdated`/`onSurveyUpdated` **no se ejecutan**.
3. **Emails demo controlados:** los pocos triggers de **CREATE** que mandan email (comunicados a
   residentes, ticket nuevo al admin) irán a direcciones demo que controlamos
   (p. ej. `*.laplayas@demo.grupovivaru.com` o alias `+laplayas` de un correo propio), no a clientes.
4. **Notificaciones in-app:** las dejamos disparar a propósito — el **icono de campana con
   actividad** suma realismo a la demo.

> Resultado: en-app con actividad real; **cero correos** a terceros reales.

---

## 6. Usuarios demo (login para la demo)

- **Admin:** `admin.laplayas@demo.grupovivaru.com` · `Demo1234*` · claims `{tenant_admin, tenantId}`.
- **Portería:** `porteria.laplayas@demo...` · `Demo1234*` · `{security_guard, tenantId}`.
- **Residentes:** 2–3 con login (`residente1.laplayas@demo...`) para mostrar el portal móvil; el
  resto solo como `people` sin login.
- Todos vía `upsertAuthUser` (idempotente, `emailVerified:true`, sin enviar onboarding).

---

## 7. Idempotencia, reset y determinismo

- **Idempotente:** `{ merge: true }` + IDs de doc estables (derivados del tenant + slug).
- **Reset:** `CLEAR=true FIREBASE_PROJECT_ID=... node functions/scripts/seed-tenant.mjs --tenant=playas`
  borra y resiembra → demo "fresca" cuando quieras. Añadir `conjunto-las-playas` a la lista de
  `clean-demo-data.js` como red de seguridad.
- **Determinista:** fechas calculadas con `offsetDays` desde "hoy" (la historia se recalcula
  relativa al día de la demo, así nunca se ve "vieja"); textos/montos fijos (no aleatorios).

---

## 8. Plan de incrementos

1. **`seed-data-playas.mjs`** — estructura del conjunto + arrays de datos con `offsetDays` por
   módulo (la "historia" del §4). Incluye `moduleVariants` completos y `source:"import"` en billing.
2. **Extender `seed-tenant.mjs`** — target `--tenant=playas`; añadir el sembrado de **surveys**,
   **survey_responses**, **committee_agreements** y **signatures** (hoy no cubiertos); asegurar
   `tenantSettings.moduleVariants`.
3. **Extender `clean-demo-data.js`** — incluir `conjunto-las-playas` en los IDs demo.
4. **Probar en staging:** `--tenant=playas`, verificar idempotencia (correr 2×), reset (`CLEAR=true`),
   y revisar logs de Resend (cero correos a terceros).
5. **Sembrar en el entorno elegido** + smoke test (login admin/residente/portería, ver tableros).
6. Documentar en la wiki el procedimiento de "demo fresca".

---

## 9. Decisiones a confirmar

1. **Entorno:** ¿**producción** (URL branded, recomendado para cliente) o **staging** (ensayo)?
   ¿O ambos?
2. **Emails demo:** ¿uso `*.laplayas@demo.grupovivaru.com` (sin entrega real) o prefieres **alias de
   un correo tuyo** para poder recibir las notificaciones en la demo?
3. **Tamaño:** ¿te sirve **2 torres / 12 unidades / 12 residentes**, o lo quieres más grande/chico?
4. **Variantes:** ¿config **completa** (lucir todo) o un perfil específico?
5. **Credenciales:** ¿mantengo `Demo1234*` para todos los usuarios demo?
