# Plan — Self-service: trial de 15 días con conversión asistida

> Estado: planeación, sin ejecutar. Requiere decisiones de negocio (§11) antes de construir.

## 0. Qué es esto y qué no

**Es:** una máquina de generación y calificación de leads. El prospecto levanta su propio
conjunto, lo prueba 15 días con módulos acotados, y el equipo comercial recibe un lead
**calificado por uso real** (no por un formulario) para cerrar la venta.

**No es:** un modelo de autoservicio de punta a punta. No hay pasarela de pago en Vivaru
(confirmado: cero billing de SaaS en el código, y `docs/checklist-go-live-vivaru.md:27` lo
registra como pendiente). La conversión la cierra **una persona**, no un checkout. Eso es
coherente con lo pedido: "que contacte a un asesor y nosotros nos pondríamos en contacto".

Consecuencia de diseño: el trial se optimiza para **demostrar valor y capturar intención**,
no para cobrar. Todo lo que estorbe esos dos objetivos, fuera.

---

## 1. Decisión de arquitectura (la que condiciona todo lo demás)

**El ambiente de prueba es un tenant REAL con `status: "trial"`, no un sandbox aparte.**

Convertir a cliente = cambiar un flag y quitar la fecha de expiración. Cero migración de
datos. Cualquier otra arquitectura obliga a migrar el conjunto completo justo cuando el
cliente acaba de pagar — el peor momento posible para un bug.

A favor de que esto es viable hoy:

- `TenantStatus` **ya incluye `"trial"`** (`src/types/domain.ts:4`) y el superadmin ya lo
  filtra y lo cuenta. El estado existe; lo que falta es que **signifique algo**.
- El aislamiento multi-tenant ya está resuelto por las reglas de Firestore: un trial es un
  tenant más, aislado por `tenantId` como cualquier cliente.

Riesgo asumido y mitigado: un trial vive en la misma base que los clientes de pago. Se
mitiga con (a) el gate de backend de §5, (b) el prefijo de IDs de §6 y (c) la purga de §8.

---

## 2. Las tres reglas que definen el trial

### Regla A — Módulos: tres niveles, no dos

Un candado binario (abierto/cerrado) desperdicia el mejor activo comercial: **lo que el
prospecto no puede usar, pero sí ver, es lo que genera el deseo de pagar.** Por eso tres
niveles:

| Nivel | Qué puede hacer | Para qué sirve |
|---|---|---|
| **Libre** | Usar sin restricción durante los 15 días | Demostrar el valor operativo diario |
| **Limitado** | Usar con cuota (unidades, envíos, storage) | Sentirlo real sin poder operar gratis un conjunto |
| **Vista previa** 🔒 | **Ver** la pantalla con datos de ejemplo; no operar, no exportar, no enviar | Generar deseo → es donde vive el CTA de asesor |

Criterio para clasificar (aplicable a módulos futuros):

- **Libre** si no tiene costo marginal para Vivaru, ni implicación legal/fiscal, ni es el
  diferenciador de venta.
- **Limitado** si tiene costo marginal real (correos, storage) o permitiría operar un
  conjunto de verdad sin pagar.
- **Vista previa** si toca dinero real, tiene valor legal, o es la pieza que cierra la venta.

Aplicación concreta:

| Módulo | Nivel | Razón |
|---|---|---|
| Residentes y unidades | **Limitado** — máx. 15 unidades | Es el cimiento de todo; el tope impide operar un conjunto real |
| Visitantes | Libre | Valor diario visible, sin costo marginal |
| Paquetería | Libre | Idem |
| Reservas | Libre | Idem |
| PQRS | Libre | Idem |
| Encuestas | Libre | Sin costo |
| Comunicaciones | **Limitado** — máx. 3 publicaciones, **sin envío de correo a terceros** | Cada envío es costo real y riesgo de reputación del dominio |
| Documentos | **Limitado** — máx. 10 archivos / 50 MB | Costo de storage |
| Configuración | Libre salvo datos fiscales | Necesita configurar; lo fiscal no aplica en prueba |
| **Cartera / Cobros** | 🔒 Vista previa | Dinero real. Es el módulo que más pesa en la decisión de compra |
| **Egresos, Libro y fondos, Conciliación** | 🔒 Vista previa | Contable: un registro en prueba no debe parecer contabilidad válida |
| **Reglamento con firmas** | 🔒 Vista previa | Una firma en un ambiente que expira no tiene valor legal — y prometerlo es un riesgo |
| **Reporte de Comité** | 🔒 Vista previa | Es el artefacto que cierra ventas: verlo lleno de sus propios datos es el mejor argumento |

Los módulos en vista previa se muestran **con el dataset demo pre-sembrado** (§6), no
vacíos. Un módulo financiero vacío no vende nada; uno con 4 meses de cartera, sí.

### Regla B — Usuarios: configura todo, pero no le escribimos a terceros

| Qué | Límite en trial |
|---|---|
| Administradores | **1** — el que se registró. No puede crear más admins |
| Guardias | **1** cuenta demo pre-creada |
| Residentes | **3** cuentas demo pre-creadas |
| Unidades y personas como *datos* | Hasta 15 unidades, sin límite de personas |
| **Invitaciones por correo a personas reales** | **Bloqueadas** |

La regla clave es la última y va contra la intuición, así que la argumento:

1. **Reputación del dominio.** `noreply@notificaciones.grupovivaru.com` es el remitente de
   todos los correos transaccionales de los clientes que **sí pagan**. Que trials envíen
   invitaciones a listas frías es la forma más rápida de terminar en spam y romper el
   correo de los clientes reales.
2. **Datos personales de terceros.** Invitar residentes reales a un ambiente que expira en
   15 días y se purga después es un problema de tratamiento de datos que no queremos.
3. **No hace falta para vender.** Lo que el prospecto necesita es *ver* la experiencia del
   residente y del portero — y eso se resuelve con las cuentas demo (§4), sin escribirle a
   nadie.

Puede cargar unidades y personas como datos (incluso por CSV) para sentir su conjunto real;
simplemente **no se dispara el correo de invitación** hasta que convierta.

### Regla C — Vigencia: 15 días, y el día 16 no se borra nada

| Momento | Qué pasa |
|---|---|
| Día 0 | Se crea el tenant con `trialEndsAt = hoy + 15d` |
| Días 1–15 | Banner permanente con días restantes + botón "Hablar con un asesor" |
| Día 7 | Correo al prospecto (mitad de camino) + aviso al equipo con el uso acumulado |
| Día 12 | Correo "te quedan 3 días" |
| Día 15 | Correo "último día" + **alerta al equipo comercial** |
| Día 16 | `status: "expired"` → **acceso de solo lectura**. Nada se borra |
| Día 16–75 | Puede entrar, ver todo lo que configuró, y reactivar con un clic |
| Día 75 | Purga automática del tenant (con aviso previo al día 68) |

**Nunca borrar al expirar.** Los datos que el prospecto configuró son el mejor argumento de
venta que existe ("todo tu conjunto ya está cargado, solo falta activarlo"). Borrarlos el
día 16 es destruir el activo comercial en el momento de mayor intención.

---

## 3. Modelo de datos — qué se agrega

### `tenants/{id}` — campos nuevos

```ts
status: "trial" | "active" | "suspended" | "expired"   // "expired" es nuevo
trialStartedAt?: string        // ISO
trialEndsAt?: string           // ISO — la fecha que gobierna todo
leadId?: string                // vínculo con el lead que lo originó
convertedAt?: string           // sello de conversión a cliente
convertedBy?: string           // uid del superadmin que convirtió
```

### `leads/{id}` — colección NUEVA (hoy los leads se pierden)

Hallazgo importante del mapeo: `/api/demo` y `/api/lead` **solo mandan correo y hacen
`console.log`** — el `leadId` es un UUID efímero que no se guarda en ningún lado. Hoy no
hay forma de saber cuántos leads entraron, ni de atribuir un trial a su origen.

```ts
{
  id, nombre, email, telefono, empresa, cargo,
  ciudad, pais, unidadesEstimadas, conjuntos, timeline,
  origen: "demo" | "diagnostico" | "trial",
  utm?: { source, medium, campaign },
  tenantId?: string,                    // si levantó trial
  status: "nuevo" | "contactado" | "calificado" | "convertido" | "perdido",
  createdAt, updatedAt
}
```

Esto se debe hacer **aunque no se construya el trial** — es un agujero de negocio abierto.

### `plans/{planId}` — activar lo que ya está modelado pero muerto

El modelo ya existe (`maxUnits`, `maxNotificationsPerMonth`, `featuresEnabled`) con CRUD en
`/superadmin/plans`, pero **ningún campo se lee en runtime**. Hay que:

1. Consolidar el shape (hoy `seedDemoData` escribe un `plans/plus` incompatible).
2. Crear el plan `trial` con los límites de la Regla A y B.
3. Agregar `trialDays: number` para no hardcodear los 15 días.
4. **Leerlos de verdad** en el gate de §5.

---

## 4. Flujo end-to-end

### Fase 1 — Captura (landing)

Nuevo CTA **"Prueba gratis 15 días"** junto al de "Agenda una demo" (§11 tiene la decisión
comercial sobre si conviven o se segmentan). Lleva a `/registro`:

**Paso 1 — Contacto:** nombre, email corporativo, teléfono, cargo.
**Paso 2 — Tu conjunto:** nombre del conjunto, ciudad, país, número de unidades.
**Paso 3 — Verificación de correo:** se envía un enlace; sin clic no hay ambiente.

Sobre "validar que es administrador": **la verificación dura mata el funnel.** Un
prospecto no va a subir cámara de comercio para probar un software. La propuesta es
verificación de **email + captura de datos de calificación**, y que la validación real de
que es administrador la haga **el asesor humano** en el follow-up — que es donde ya
teníamos una persona involucrada de todos modos. El campo "número de unidades" es el
mejor filtro de calificación disponible sin fricción.

### Fase 2 — Provisión automática (al verificar el correo)

Una callable nueva `createTrialWorkspace` (pública, con rate-limit) hace en una transacción
lo que hoy son 2 pasos manuales de superadmin:

1. `leads/{id}` con los datos capturados
2. `tenants/{id}` con `status: "trial"`, `planId: "trial"`, `trialEndsAt`, `leadId`
3. `tenantSettings/{id}` con módulos y variantes del trial
4. Usuario admin + claims (reutiliza el flujo probado de `sendOnboardingInvite` +
   `accountInvites` + `/activar`, que ya funciona y no hay que tocar)
5. Siembra del dataset demo (§6)
6. **Notificación al equipo** (§7)

### Fase 3 — Onboarding guiado

Un **checklist de activación** persistente en el Panel, no un tour intrusivo:

1. ✅ Crea tu primera torre o agrupación
2. ✅ Agrega 3 unidades
3. ✅ Registra a un residente
4. ✅ Registra una visita
5. ✅ Publica un comunicado
6. ✅ Mira el Panel de Control con tus datos
7. 👁️ Explora la vista del residente y la de portería

Con progreso visible ("3 de 7") y persistido en `tenants.onboardingChecklist`. El copy de
cada módulo **ya existe** en `MODULE_VARIANT_META` (`src/lib/config/module-variants.ts`) —
se reutiliza en vez de escribirlo de nuevo.

Por qué checklist y no tour: el tour se salta y no vuelve; el checklist queda, mide y
además **alimenta el health-score comercial** (§9) — un prospecto que completó 6 de 7
pasos es una llamada prioritaria.

### Fase 4 — Ver los otros roles

El paso 7 del checklist abre un panel con las **credenciales demo visibles** (residente y
portería) y un botón "Abrir en otra pestaña". Login real, experiencia real.

Se descarta la suplantación de sesión ("ver como residente" sin logout) para la v1: es más
elegante pero exige tocar reglas de Firestore y manejo de claims — riesgo de seguridad
alto para un beneficio de comodidad. Queda como v2 si el login demo resulta friccionante.

Las cuentas demo también tienen módulos acotados (§2), para que la experiencia sea
coherente con lo que se vende.

### Fase 5 — Conversión

Botón permanente en el banner: **"Quiero contratar Vivaru"** → registra la intención en el
lead (`status: "calificado"`), dispara alerta inmediata al equipo comercial con el resumen
de uso, y muestra "Un asesor te contacta en menos de 24 horas hábiles".

Ese clic es **el evento más valioso del funnel**: hay que instrumentarlo antes que nada.

---

## 5. El candado — dónde vive de verdad

Este es el punto técnicamente más delicado. Hallazgos del mapeo:

- `residentModules` **solo oculta ítems del sidebar del residente**; la URL directa sigue
  funcionando (`role-sidebar-groups.ts:92-112`; ninguna page consulta el flag).
- **No existe ningún gating de módulos para el admin.** El sidebar del admin es una
  constante estática.
- `canAccessPath(role, pathname)` no conoce el tenant, y el middleware corre en Edge **sin
  acceso a Firestore**.
- `tenants.status` hoy **no bloquea absolutamente nada** — ni `"suspended"` hace algo.

Por eso el candado va en **tres capas, y solo la tercera protege de verdad**:

| Capa | Qué hace | Vale como seguridad |
|---|---|---|
| 1. UI | Ítem con 🔒 en el sidebar + overlay "Disponible con tu plan" sobre el módulo | ❌ No — es marketing |
| 2. Ruta (cliente) | Si entra por URL, pantalla de upgrade en vez del módulo | ❌ No — se puede saltar |
| 3. **Backend** | Callables y reglas de Firestore validan plan y estado del tenant | ✅ **Sí** |

La capa 3 tiene precedente en el código: `assertFinanceManagementEnabled(tenantId)` ya
bloquea acciones de cartera según una variante. Se generaliza a
**`assertModuleAllowed(tenantId, modulo)`** que lee `tenants.status` + `plans.featuresEnabled`,
y se aplica en toda callable con efecto (cobros, correos, exportaciones).

Y hay que cerrar dos agujeros existentes de paso:

- **`tenants.status` debe empezar a significar algo**: un tenant `expired` o `suspended`
  debe quedar en solo lectura. Hoy opera normal — es un bug latente independiente del trial.
- **Los límites de plan deben leerse** (`maxUnits` al crear unidad, etc.).

---

## 6. El dataset demo

El contenido ya está diseñado y es bueno: el seed de Las Playas son **~320 documentos** con
fechas relativas a hoy (nunca "envejece"), cubriendo los 6 módulos con cartera de 4 meses y
conciliación bancaria ya matcheada. Sirve tal cual **como contenido**.

El mecanismo no sirve: es un script CLI que requiere credenciales de administrador y
**tiene los IDs de documento hardcodeados** — dos trials sembrados chocarían entre sí.

Trabajo necesario: portarlo a Cloud Function y **prefijar todos los IDs con el tenantId**.
Es la pieza de mayor esfuerzo técnico de todo el plan.

Decisión de producto asociada: el ambiente arranca con **el conjunto del prospecto vacío
pero los módulos en vista previa poblados con datos de ejemplo**, claramente marcados como
tales. Así el prospecto configura lo suyo, pero el módulo financiero no se ve desierto.

---

## 7. Notificación al equipo

El patrón ya existe y es copiable literal: `/api/demo` manda correo a un buzón interno con
`replyTo` del prospecto, best-effort (nunca penaliza la captura si falla el correo).

**Al crearse un trial** — correo a comercial + doc en `leads` + notificación in-app al
superadmin:

> **[Trial] Carolina Méndez · Conjunto Las Palmas · Cancún, MX · 120 unidades**
> Tel: +52... · Email: ... · Origen: landing/mx (utm_campaign: ...)
> Ambiente: `conjunto-las-palmas-x7f2` · Vence: 18 jul 2026

**Alertas de seguimiento:** día 7 con resumen de uso, día 15 (último día), y **inmediata**
cuando hace clic en "Quiero contratar".

Pendiente de higiene: los correos de marketing salen hoy del fallback `onboarding@resend.dev`
(dominio de pruebas, entregabilidad pobre) si no está seteada la variable de entorno. Hay
que unificar en el dominio verificado antes de abrir el trial.

---

## 8. Superadmin — nueva vista y la acción que importa

Nueva pestaña **"Ambientes de prueba"** (`/superadmin/trials`):

| Columna | Detalle |
|---|---|
| Conjunto | Nombre + ciudad |
| Contacto | Nombre, email, teléfono (del lead) |
| Días restantes | Con semáforo (verde >7, ámbar 3–7, rojo <3, gris expirado) |
| Activación | "5 de 7" del checklist |
| Uso | Unidades creadas, módulos tocados, último acceso |
| Intención | Si hizo clic en "Quiero contratar" |

Acciones:

- **Convertir a cliente** — la acción central: `status: "trial"` → `"active"`, quita
  `trialEndsAt`, asigna plan real, desbloquea módulos, sella `convertedAt`. **Sin migrar un
  solo documento.** Opción de purgar el dataset demo y dejar solo lo que el cliente cargó.
- **Extender prueba** (+N días) — para negociaciones en curso.
- **Marcar como perdido** con motivo — alimenta el aprendizaje comercial.

Base reutilizable: `/superadmin/metrics` ya calcula `TenantAdoptionMetrics` (unidades,
residentes activos, tickets, visitas, adoptionScore) — es directamente el health-score.

---

## 9. Métricas del funnel

| Etapa | Métrica | Por qué importa |
|---|---|---|
| Visita → registro | % de conversión del CTA | Mide si el mensaje del landing promete lo correcto |
| Registro → verificación | % que confirma el correo | Detecta emails falsos / fricción |
| Verificación → activación | % que completa ≥4 pasos del checklist | **El predictor más fuerte de compra** |
| Activación → intención | % que pide asesor | El evento de mayor valor |
| Intención → cierre | % y días promedio | Eficacia comercial |
| — | Trials expirados sin contacto | Fugas del proceso comercial |

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Abuso** (alguien crea trials en serie) | 1 trial por dominio de correo; rate-limit por IP; verificación de correo obligatoria; alerta al superadmin ante múltiples registros del mismo dominio |
| **Costo por trial** (~320 docs + storage + correos) | Purga automática a los 75 días; sin envíos masivos; tope de storage |
| **Reputación del remitente** | Prohibido invitar terceros desde trial (Regla B); unificar dominio verificado |
| **Trial usado como producción gratis** | Tope de 15 unidades + expiración real (la capa 3 del candado) |
| **Canibalizar la venta asistida** | Segmentar: self-service para conjuntos pequeños, demo asistida para grandes (§11) |
| **Datos de prueba mezclados con clientes reales** | `status` con significado real + prefijo de IDs + vista dedicada en superadmin |
| **Expectativa incumplida** | Nunca prometer en trial algo con valor legal (firmas, comprobantes fiscales) |

---

## 11. Decisiones que necesito de ti

1. **¿Trial y demo asistida conviven, o se segmentan?** Hoy el landing vende "Agenda una
   demo" y las secciones de Precios y Piloto están **comentadas por decisión comercial
   pendiente**. Mi recomendación: conviven pero segmentados — trial autoservicio como CTA
   principal, y demo asistida destacada para quien declare +100 unidades.

2. **¿Confirmas la clasificación de módulos de la Regla A?** En particular: ¿Cartera y
   Reporte de Comité en vista previa (mi recomendación, son el argumento de venta), o
   abiertos con límite?

3. **¿15 unidades es el tope correcto?** Debe ser suficiente para que se sienta real e
   insuficiente para operar. Depende del tamaño típico de tu mercado objetivo.

4. **¿Aceptas no invitar residentes reales durante el trial?** Es la regla más
   contraintuitiva del plan y la más importante para proteger el correo de los clientes
   que pagan.

5. **¿Qué pasa al expirar: solo lectura (mi recomendación) o bloqueo total?**

6. **¿Buzón interno y responsable comercial** para las alertas de trial?

---

## 12. Fases de ejecución sugeridas

| Fase | Contenido | Valor |
|---|---|---|
| **0. Cimientos** | Persistir `leads` (hoy se pierden), unificar dominio de correo, hacer que `tenants.status` signifique algo | Tapa agujeros que existen **hoy**, sin depender del trial |
| **1. Provisión** | `createTrialWorkspace` + `trialEndsAt` + notificación al equipo + vista de trials en superadmin | Ya se puede operar el trial "a mano" desde el landing actual |
| **2. Candado** | `assertModuleAllowed` + límites de plan + banner de días restantes + overlays de upgrade | El trial se vuelve seguro y vendedor |
| **3. Experiencia** | Registro público en el landing + checklist de activación + cuentas demo por rol | Autoservicio completo |
| **4. Ciclo de vida** | Cron de expiración + correos de días 7/12/15 + conversión y purga | Operación desatendida |

La Fase 0 tiene valor **independientemente** de que el trial se construya o no.
