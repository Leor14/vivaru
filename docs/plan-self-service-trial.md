# Plan — Self-service: trial de 15 días con conversión asistida

> Estado: planeación, sin ejecutar. Decisiones de producto resueltas (§11); quedan 3 decisiones comerciales.

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

### Regla A — Módulos: núcleo operativo + dos que sorprenden, y lo que se vende bajo llave

Tres niveles, porque un candado binario desperdicia el mejor activo comercial: **lo que el
prospecto ve pero no puede usar es lo que genera el deseo de pagar.**

| Nivel | Qué puede hacer | Para qué sirve |
|---|---|---|
| **Libre** | Usar sin restricción durante los 15 días | Demostrar el valor operativo diario |
| **Limitado** | Usar con cuota (storage, correos a terceros) | Contener costo y riesgo, no capacidad |
| **Vista previa** 🔒 | **Ver** la pantalla con datos de ejemplo; no operar, no exportar | Generar deseo → es donde vive el CTA de asesor |

#### El núcleo operativo (libre) — lo que un administrador de PH hace todos los días

Estos cinco son la rutina real de un administrador en LATAM. Si no funcionan, no hay venta:

| Módulo | Dolor diario que resuelve |
|---|---|
| **Residentes y unidades** | El maestro de datos: sin esto no existe nada más |
| **Visitantes** | Portería descoordinada — el problema operativo #1 |
| **Paquetería** | Paquetes perdidos y reclamos constantes |
| **Comunicaciones** | Hoy viven en grupos de WhatsApp que son un caos |
| **PQRS** | Quejas dispersas en WhatsApp y papel, sin rastro ni responsable |

#### Los dos que sorprenden (libre) — donde se gana la conversión

Un administrador *espera* cobros y comunicados: eso lo prometen todos los competidores. Lo
que **no espera** es esto, y es lo que convierte una demo tibia en un "esto sí lo necesito":

**1. Reservas de zonas comunes con detección de conflictos.** El dolor no es agendar: es que
hoy se agenda por WhatsApp, se cruzan dos familias el mismo sábado en el salón, y **el
administrador queda acusado de favoritismo**. Que el sistema **impida** la doble reserva
—no que la reporte después— le quita de encima un conflicto político recurrente. Ya está
construido (detección de solapamiento, VIV-804) y es muy demostrable en vivo.

**2. Encuestas con resultados.** Casi ningún administrador tiene una herramienta para
consultar a la copropiedad sin convocar asamblea. Poder preguntar "¿cambiamos el horario de
la piscina?" y **mostrarle al comité un resultado con evidencia** cambia su posición
política dentro del conjunto. Es el módulo que menos esperan y el que más los sorprende.

#### El "aha" transversal (no es un módulo)

- **El Panel de Control con sus propios datos**: la primera vez que ven su operación en
  números.
- **El portal del residente**: descubrir que sus residentes tienen su propia app —y que por
  eso van a dejar de escribirle por WhatsApp— es, para muchos, el argumento definitivo. Lo
  ve con sus cuentas de prueba (Regla B).

#### Limitados (por costo, no por capacidad)

| Módulo | Límite | Razón |
|---|---|---|
| Documentos | 10 archivos / 50 MB | Costo de storage |
| Correo saliente a terceros | Bloqueado (ver Regla B) | Reputación del dominio |
| Configuración | Todo salvo datos fiscales | Lo fiscal no aplica a una prueba |

#### 🔒 Vista previa — lo que se vende (confirmado)

| Módulo | Razón |
|---|---|
| **Cartera / Cobros** | Dinero real. Es lo que más pesa en la decisión de compra |
| **Egresos, Libro y fondos, Conciliación** | Un registro contable en prueba no debe parecer contabilidad válida |
| **Reglamento con firmas** | Una firma en un ambiente que expira no tiene valor legal; prometerlo es un riesgo |
| **Reporte de Comité** | Es el artefacto que cierra ventas: verlo lleno de sus datos es el mejor argumento |

Se muestran **poblados con el dataset de ejemplo** (§6), nunca vacíos: un módulo financiero
en blanco no vende nada; uno con cuatro meses de cartera y su conciliación, sí.

### Regla B — Usuarios: carga libre + cuentas de prueba propias del administrador

Corrección respecto de la versión anterior de este plan: **no se limita cuántos residentes
puede cargar.** El administrador decide si sube todo su conjunto o solo unos cuantos para
probar — esa libertad es parte de la experiencia.

| Qué | En trial |
|---|---|
| Unidades y personas como *datos* | **Libre** (tope técnico anti-abuso: 100 unidades) |
| Carga masiva por CSV | Habilitada |
| Administradores | 1 — el que se registró |
| **Cuentas de prueba propias** | **1 residente + 1 portería, auto-creadas** |
| Invitaciones por correo a personas reales | Bloqueadas hasta convertir |

#### "Mis cuentas de prueba" — la pieza central de esta regla

El administrador necesita **ver la experiencia del residente y del portero sin molestar a
nadie ni compartir contraseñas con un residente real.** Por eso el ambiente se crea con dos
cuentas que son **suyas**, no de terceros:

- `demo-residente@<su-conjunto>.vivaru.app` — asignada a una unidad de ejemplo
- `demo-porteria@<su-conjunto>.vivaru.app`

Con contraseña **visible para él** en un panel de "Mis cuentas de prueba" dentro de
Configuración, con botón "Abrir portal del residente" / "Abrir portal de portería" en otra
pestaña. Puede reiniciar la contraseña cuando quiera.

Que sean cuentas técnicas (no correos reales) resuelve tres cosas a la vez: no se le
escribe a ningún tercero, no hay datos personales ajenos en un ambiente que expira, y él
entra cuando quiera sin pedirle permiso a nadie.

**Los correos de prueba sí funcionan**, pero solo hacia esas cuentas y hacia el propio
correo del administrador. Así puede ver cómo llega un comunicado o un aviso de paquete sin
que salga un solo correo a una lista fría — protegiendo la reputación de
`noreply@notificaciones.grupovivaru.com`, que es el remitente de los clientes que **sí
pagan**.

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

### Fase 1 — Captura (landing) — **decidido: el trial reemplaza a la demo**

El CTA principal pasa a ser **"Prueba gratis 15 días"** → `/registro`. El agendamiento de
demo se retira como camino principal, pero **se conserva una vía asistida**: un CTA
secundario **"Hablar con un asesor"** que abre un formulario de contacto para quien no
quiere probar solo (típicamente conjuntos grandes o administradoras con varios conjuntos).

Reutilización directa: el `DemoDialog` actual ya captura exactamente los campos correctos
(nombre, email, teléfono, empresa, cargo, número de conjuntos, unidades, horizonte de
decisión) y ya notifica al equipo. Se reetiqueta como "Hablar con un asesor" —cambio de
copy, no de lógica— y se le conecta la persistencia de `leads` de §3.

Ambos caminos alimentan la misma colección `leads`, diferenciados por `origen: "trial" |
"asesor"`, para poder comparar cuál convierte mejor.

Flujo de `/registro`:

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

### Fase 4 — Ver los otros roles con sus cuentas de prueba

El paso 7 del checklist abre **"Mis cuentas de prueba"** (Regla B): las credenciales de su
residente y su portero, visibles, con botón "Abrir en otra pestaña". Login real,
experiencia real, sin involucrar a ninguna persona.

Se descarta la suplantación de sesión ("ver como residente" sin cerrar sesión) para la v1:
es más elegante pero exige tocar reglas de Firestore y manejo de claims — riesgo de
seguridad alto para un beneficio de comodidad. Queda como v2 si el login resulta
friccionante.

Las cuentas de prueba ven los módulos según la Regla A, para que la experiencia sea
coherente con lo que se vende. El objetivo es que el administrador descubra el portal del
residente: es el "aha" más fuerte del trial.

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

## 8. La consola interna de Vivaru — ciclo de vida de los ambientes

Esta es la herramienta de trabajo del equipo Vivaru. La idea rectora: **una sola vista con
todos los ambientes habitacionales**, sean de prueba o de clientes, con un estado explícito
y las acciones que hacen avanzar ese estado. Hoy `/superadmin/tenants` lista tenants pero
el estado no significa nada y no hay noción de vencimiento.

### 8.1 Máquina de estados

```
  [registro verificado]
          │
          ▼
     🟡 PRUEBA ──── convertir ────▶ 🟢 CLIENTE ──── suspender ────▶ ⏸️ SUSPENDIDO
     (15 días)                          ▲                                │
          │                             │                                │
          │                             └──────── reactivar ─────────────┘
          │  extender (+N días)
          │       ↺
          │
   vence el día 16
          │
          ▼
     🔴 VENCIDO ──── convertir (rescate) ────▶ 🟢 CLIENTE
     (solo lectura)
          │
     purga día 75
          ▼
      ⚫ ARCHIVADO
```

Los tres estados que hoy no existen o no operan: **VENCIDO** (nuevo), **PRUEBA con fecha**
(hoy `trial` no tiene vencimiento) y **SUSPENDIDO con efecto real** (hoy es solo una
etiqueta).

### 8.2 La vista: `/superadmin/ambientes`

Reemplaza a `/superadmin/tenants` con filtros por estado:

`Todos` · `🟢 Clientes` · `🟡 En prueba` · `🔴 Vencidos` · `⏸️ Suspendidos`

Columnas comunes: conjunto, ciudad, plan, unidades, último acceso, estado.

Columnas específicas de prueba y vencidos —que son las que sirven para vender—:

| Columna | Para qué |
|---|---|
| **Días restantes** | Semáforo: verde >7, ámbar 3–7, rojo <3, gris vencido |
| **Contacto** | Nombre, correo y teléfono del lead — a un clic de llamar |
| **Activación** | "5 de 7" del checklist: mide si de verdad lo usó |
| **Uso real** | Unidades cargadas, módulos que tocó, número de sesiones |
| **Intención** | 🔥 si hizo clic en "Quiero contratar Vivaru" |

Una regla de operación comercial que la vista debe hacer obvia: **un ambiente con
activación alta y pocos días restantes es la llamada más urgente del día.**

### 8.3 Las acciones

**① Convertir a cliente** — la acción central y el corazón de tu punto 12.

Un modal que exige elegir plan y muestra explícitamente qué va a pasar:

> Vas a convertir **Conjunto Las Palmas** en cliente con plan **Profesional**.
> · Se conserva **todo** lo que configuró: 48 unidades, 96 residentes, 12 visitas, 3 comunicados
> · Se desbloquean Cartera, Egresos, Libro y fondos, Reglamento y Reporte de Comité
> · Se elimina la fecha de vencimiento
> · ☐ Eliminar los datos de ejemplo y dejar solo lo que el cliente cargó

Técnicamente: `status → "active"`, borra `trialEndsAt`, asigna `planId` real, sella
`convertedAt`/`convertedBy`, marca el lead como `convertido`, y dispara correo de bienvenida
al administrador. **No se mueve un solo documento** — por eso funciona igual para rescatar
un ambiente ya vencido.

**② Extender prueba (+N días)** — para negociaciones en curso. Registra quién y por qué.

**③ Marcar como perdido** — con motivo (precio, competencia, no era el perfil, sin
respuesta). Es lo que después te dice por qué se pierden los trials.

**④ Suspender / reactivar cliente** — para el cliente que deja de pagar. Hoy este botón
existe pero **no hace nada**; debe pasar a dejar el ambiente en solo lectura.

**⑤ Purgar** — solo para vencidos pasados los 75 días, con doble confirmación.

### 8.4 Qué se reutiliza

`/superadmin/metrics` ya calcula `TenantAdoptionMetrics` (unidades, residentes activos,
tickets, visitas, `adoptionScore`, `adoptionLevel`) por tenant. Es **directamente** el
health-score de la columna "Uso real": no hay que inventarlo, hay que conectarlo.

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

## 11. Decisiones

### Resueltas

| # | Decisión | Resolución |
|---|---|---|
| 1 | Trial vs. demo asistida | **El trial reemplaza a la demo** como camino principal. Se conserva un CTA "Hablar con un asesor" en el landing para quien no quiera probar solo (§4) |
| 2 | Cartera y Reporte de Comité | **En vista previa** 🔒 — confirmado |
| 3 | Validación de que es administrador | **Verificación de correo + datos de calificación**; la validación real la hace el asesor en el follow-up |
| 4 | Límite de residentes | **Sin límite funcional** — el administrador decide si carga todo su conjunto o solo unos cuantos (tope técnico anti-abuso: 100 unidades) |
| 5 | Cómo ve los otros roles | **Cuentas de prueba propias** (residente + portería), auto-creadas, con credenciales visibles para él — sin involucrar a residentes reales |
| 6 | Módulos abiertos | Núcleo (Residentes, Visitantes, Paquetería, Comunicaciones, PQRS) + los dos que sorprenden (**Reservas** y **Encuestas**) |

### Pendientes

1. **¿Buzón y responsable comercial** para las alertas de trial? (hoy los formularios del
   landing apuntan a `comercial@qintilab.com` y `hola@grupovivaru.com` — hay que unificar).
2. **¿Confirmas que al vencer queda en solo lectura** y se conserva 60 días antes de purgar?
   Es la opción que preserva el activo comercial.
3. **¿Qué planes se ofrecen al convertir?** Hoy `/superadmin/plans` tiene el CRUD pero
   `Pricing.tsx` está comentado y sin precios. Convertir exige elegir un plan real.

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
