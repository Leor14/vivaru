# PRD-V-FEAT-001 — Tickets de soporte al cliente

| | |
|---|---|
| **Tipo** | `FEAT` |
| **Portales** | `ADMIN` (alcance) · `SUPERADMIN` (alcance) · residente y portería: **no tocados** |
| **Módulo** | Configuración / Soporte |
| **Usuario principal** | `tenant_admin` — el administrador del conjunto |
| **Usuarios secundarios** | `superadmin` — quien atiende desde Vivaru |
| **Responsable** | David (producto) · equipo comercial (operación) |
| **Estado** | Lista para PRD |
| **Dependencias** | `functions/src/email.ts` (remitente verificado) · secret `RESEND_API_KEY` |
| **Riesgo** | Medio — datos personales en texto libre, y una cola que si nadie atiende deteriora la relación con el cliente |
| **Reversibilidad** | **Alta.** Es funcionalidad aditiva: se apaga ocultando la entrada del menú, sin migrar ni perder datos |
| **Fase / plan** | Todos los conjuntos, incluidos los que están en prueba |

> **Por qué merece PRD:** toca dos portales, crea una colección con permisos nuevos, introduce estados que alguien tendrá que operar a diario, y envía correo a personas. Cumple cuatro de los seis criterios de la puerta.

---

## 1 · Resumen ejecutivo

El administrador de un conjunto no tiene forma de pedir ayuda a Vivaru desde el producto: cuando algo falla, escribe a `dev@qintilab.com` y la conversación vive en un buzón, sin estado ni rastro. Esta PRD abre un canal dentro del portal — el administrador escribe, el equipo responde desde la consola, y ambos ven el hilo y en qué va. El valor no es la pantalla: es **dejar de perder solicitudes y saber cuántas hay, de qué son y cuánto tardamos**.

La decisión que permanece humana es toda: aquí no se automatiza nada, se ordena.

## 2 · Problema y baseline

**Cómo se resuelve hoy.** El administrador escribe a `dev@qintilab.com`. Alguien del equipo comercial lo lee y responde por correo. Si hace falta, se anota a mano en `/superadmin/support`, que hoy funciona como **bitácora interna**: el superadmin elige el conjunto de una lista y teclea a mano quién reportó.

**Lo que eso cuesta.** No hay estado ni dueño, así que una solicitud puede quedarse sin respuesta sin que nadie lo note. No hay historial por conjunto: quien atiende no sabe si es la tercera vez que preguntan lo mismo. Y no hay ningún número: no sabemos cuántas llegan, de qué tratan ni cuánto tardamos.

**Baseline — `TBD`, y hay que levantarlo antes de construir.** El dato existe y es fácil: **contar los correos recibidos en `dev@qintilab.com` en los últimos 90 días** que sean solicitudes de administradores, clasificados a ojo por tema. Sin ese número no podremos afirmar que esto funcionó.

> **Pregunta mínima para cerrar el baseline:** ¿cuántos correos de soporte llegaron el último trimestre y cuáles fueron los tres temas más repetidos?

**Volumen esperado.** Bajo. Con la base de clientes actual, decenas al mes, no miles. Eso condiciona el diseño: **no hace falta una herramienta de helpdesk, hace falta una bandeja honesta.**

## 3 · Usuarios, roles y permisos

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| `tenant_admin` | Los tickets **de su propio conjunto** | Abrir un ticket · responder en el hilo · reabrir uno resuelto · cerrarlo | Ver tickets de otro conjunto · cambiar el estado a `en_proceso` o `resuelto` · ver las notas internas · borrar |
| `superadmin` | **Todos** los tickets, de todos los conjuntos | Responder · cambiar estado y prioridad · escribir notas internas · filtrar y buscar | Borrar (no hay borrado; ver §7) |
| `resident` | Nada | — | **Todo.** Su canal es PQRS, con su administración |
| `security_guard` | Nada | — | **Todo** |

**La razón de que el residente quede fuera** es deliberada: si un residente pudiera escribir a Vivaru, Vivaru se convertiría en primera línea de los problemas del conjunto, que es exactamente el trabajo del administrador. El soporte es entre Vivaru y su cliente.

**Las notas internas nunca las ve el cliente.** Es la única información asimétrica del modelo y hay que protegerla explícitamente en las reglas, no solo ocultarla en la interfaz.

## 4 · Objetivo, alcance y exclusiones

**Objetivo.** Que toda solicitud de un administrador a Vivaru quede registrada, con dueño, estado e historial, y que ambas partes vean lo mismo.

**Entra en el MVP**

- Pantalla de soporte en el portal del administrador: lista de sus tickets y detalle con hilo.
- Alta de ticket: asunto, categoría, descripción.
- Hilo de conversación en ambos sentidos.
- Cinco estados con transiciones definidas (§6).
- Bandeja del superadmin, reaprovechando `/superadmin/support`: filtros, prioridad, notas internas y **antigüedad visible**.
- Correo a `dev@qintilab.com` al abrirse un ticket y cuando el cliente responde.
- Correo al administrador cuando Vivaru responde o marca resuelto.

**No entra, y por qué**

| Excluido | Razón |
|---|---|
| **Adjuntos** | Añade reglas de Storage, límites y retención. Es lo primero que añadiría después: en un problema técnico una captura ahorra tres mensajes. |
| **SLA y alertas de incumplimiento** | Sin baseline no sabemos qué plazo es realista. Primero medir. |
| **Base de conocimiento / autoservicio** | Requiere saber qué se pregunta. Los primeros meses de tickets son justamente esa investigación. |
| **Notificación in-app** | El correo basta para el volumen esperado. |
| **Chat en vivo** | Promete inmediatez que el equipo no puede sostener. |
| **Encuesta de satisfacción** | Sin volumen no dice nada. |
| **Que el residente abra tickets** | §3. Cambiaría el producto, no lo ampliaría. |

## 5 · Flujo funcional

```mermaid
flowchart TD
    A[Admin abre Soporte] --> B[Nuevo ticket: asunto, categoría, descripción]
    B --> C{Validaciones}
    C -- Falta asunto o descripción --> B
    C -- Supera el límite de tickets abiertos --> L[Aviso: resuelve o cierra alguno antes]
    C -- OK --> D[Ticket creado en abierto]
    D --> E[Correo a dev@qintilab.com]
    D --> F[El admin ve su ticket en la lista]
    E --> G[Alguien de Vivaru lo toma → en_proceso]
    G --> H[Vivaru responde]
    H --> I[esperando_respuesta + correo al admin]
    I --> J{¿El admin responde?}
    J -- Sí --> K[en_proceso + correo a dev@]
    K --> G
    J -- No, y pasan N días --> M[Recordatorio al admin]
    G --> N[Vivaru marca resuelto + correo al admin]
    N --> O{¿El admin reabre?}
    O -- Sí, dentro de la ventana --> G
    O -- No --> P[cerrado automático al vencer la ventana]
```

**Casos límite que hay que resolver, no ignorar**

- **El conjunto está suspendido o vencido.** Puede abrir tickets igual (§7). Es justo cuando más lo necesita.
- **El administrador deja el conjunto.** El ticket pertenece al **conjunto**, no a la persona: el siguiente administrador ve el historial completo.
- **Dos administradores del mismo conjunto.** Ambos ven y responden los mismos tickets. No hay tickets privados entre administradores.
- **El cliente responde a un ticket cerrado.** No se permite; la interfaz ofrece abrir uno nuevo citando el anterior.

## 6 · Estados y transiciones

| Estado | Significado | Quién lo provoca | Sale hacia |
|---|---|---|---|
| `abierto` | Creado, nadie lo ha tomado | `tenant_admin` | `en_proceso`, `cerrado` |
| `en_proceso` | Alguien de Vivaru lo está atendiendo | `superadmin` | `esperando_respuesta`, `resuelto` |
| `esperando_respuesta` | Vivaru respondió; la pelota está en el cliente | `superadmin` (al responder) | `en_proceso` (el cliente contesta), `cerrado` (vence) |
| `resuelto` | Vivaru lo da por resuelto | `superadmin` | `en_proceso` (el cliente reabre), `cerrado` (vence) |
| `cerrado` | **Terminal.** No admite respuestas | `tenant_admin`, o el sistema al vencer | — |

**Reglas del ciclo de vida**

- **Pendiente de Vivaru** = `abierto` + `en_proceso`. Es la cifra que mide la cola, y sigue el mismo criterio que ya usa PQRS (`PENDING_TICKET_STATUSES`): lo que espera al cliente no cuenta como pendiente nuestro.
- **Reapertura**: desde `resuelto`, dentro de una ventana de **`TBD` días** (recomendado: 7). Fuera de la ventana, ticket nuevo.
- **Cierre automático**: `esperando_respuesta` y `resuelto` pasan a `cerrado` tras **`TBD` días** sin actividad (recomendado: 14), con un recordatorio antes. Sin esto la cola se llena de tickets que nadie va a tocar.
- **`cerrado` es terminal y no se reabre.** Es lo que permite que el número de pendientes signifique algo.

## 7 · Contrato de datos y multi-tenancy

Se **reutiliza y extiende** la colección `supportTickets`, que ya existe con modelo, filtros y bandeja. No se crea una nueva.

| Campo | Tipo | Obligatorio | Lo escribe | Notas |
|---|---|---|---|---|
| `tenantId` | string | Sí | servidor | **Toda consulta de lista debe filtrarlo.** Las reglas no filtran: rechazan |
| `tenantName` | string | Sí | servidor | Denormalizado para la bandeja |
| `createdBy` | uid | Sí | servidor | Nunca del cliente |
| `createdByName`, `createdByEmail` | string | Sí | servidor | Del perfil, no tecleado |
| `category` | enum | Sí | cliente | `tecnico` · `facturacion` · `operativo` · `otro` |
| `subject` | string | Sí | cliente | Máx. 120 |
| `description` | string | Sí | cliente | Máx. 4000 |
| `priority` | enum | Sí | servidor (`media`) / superadmin | `alta` · `media` · `baja` |
| `status` | enum | Sí | servidor | §6 |
| `thread[]` | array | Sí | servidor | **Append-only.** `{id, autor, rol, mensaje, createdAt}` |
| `internalNotes` | string | No | superadmin | **Nunca visible al cliente** |
| `createdAt`, `updatedAt`, `lastActivityAt` | timestamp | Sí | servidor | `lastActivityAt` alimenta antigüedad y cierre automático |
| `resolvedAt`, `closedAt` | timestamp | No | servidor | |

**Cambios sobre lo que existe hoy**

- `reportedBy` / `reportedByName` (texto libre, tecleado por el superadmin) quedan **obsoletos** para tickets nuevos: los sustituyen `createdBy` y `createdByName`, tomados del perfil. Los documentos antiguos se conservan tal cual; la bandeja muestra el que exista.
- `notes` pasa a llamarse `internalNotes` para que el nombre diga que no se comparte. `TBD`: renombrar con migración, o mantener `notes` y documentarlo. **Recomendación: mantener `notes` y documentar**, porque una migración por un nombre no se paga.
- `responseHistory` está declarado en el tipo y **nunca se ha escrito ni leído**. Se sustituye por `thread`, que sí se implementa.

**Comportamiento por estado del conjunto**

| Estado del conjunto | Puede abrir y responder |
|---|---|
| `active` | Sí |
| `trial` | **Sí.** Un prospecto con un problema sin resolver es un prospecto perdido |
| `suspended` | **Sí, y es deliberado.** Es el canal por el que deja de estar suspendido |
| `expired` | **Sí**, mismo motivo |

> `supportTickets` está **excluido a propósito** de la guarda `tenantOperable()` que dejó en solo lectura a suspendidos y vencidos. Es la única excepción del sistema y hay que conservarla.

**Retención y borrado.** No hay borrado — ni para el cliente ni para el superadmin. Un ticket cerrado es historial de la relación comercial. `TBD`: política de retención a largo plazo, alineada con la de datos personales.

## 8 · Reglas de negocio

1. Solo un usuario con rol `tenant_admin` puede abrir un ticket.
2. Un ticket pertenece al conjunto, no a la persona que lo abrió.
3. Un ticket `cerrado` no admite mensajes nuevos ni cambios de estado.
4. El cliente **no** puede fijar la prioridad; la asigna Vivaru.
5. El cliente **nunca** recibe el contenido de `internalNotes`, por ninguna vía —ni interfaz, ni correo, ni consulta directa.
6. El hilo es **append-only**: ningún mensaje se edita ni se borra.
7. Un conjunto no puede tener más de **`TBD` tickets sin cerrar** a la vez (recomendado: 5). Evita el ruido y obliga a cerrar.
8. Un conjunto no puede abrir más de **`TBD` tickets al día** (recomendado: 10). Freno de abuso, no de uso.
9. `lastActivityAt` se actualiza con **cualquier** mensaje o cambio de estado.
10. Un conjunto suspendido o vencido conserva la capacidad de abrir y responder.

## 9 · Notificaciones y correo

Todo sale por `functions/src/email.ts`, con el remitente verificado `noreply@notificaciones.grupovivaru.com`.

| Evento | Destinatario | Contenido |
|---|---|---|
| Ticket creado | `dev@qintilab.com` | Conjunto, estado del conjunto, quién, categoría, asunto, descripción y **enlace a la bandeja** |
| El cliente responde | `dev@qintilab.com` | Conjunto, asunto, mensaje y enlace |
| Vivaru responde | Administrador del ticket | Asunto, mensaje y enlace a su pantalla de soporte |
| Vivaru marca resuelto | Administrador | Resumen y cómo reabrir |
| Recordatorio de inactividad | Administrador | Aviso de cierre automático próximo |

**El buzón se configura en `SUPPORT_NOTIFICATION_TO`**, con `dev@qintilab.com` por defecto. Variable propia y no reutilizar `LEAD_NOTIFICATION_TO`: soporte y comercial son colas distintas aunque hoy las mire la misma persona, y separarlas cuesta una línea ahora y una migración después.

**El correo no promete plazos de respuesta.** El producto no controla cuándo contesta una persona; prometerlo lo incumple la pantalla, no el equipo. Se dice *"te contactaremos"*, no *"en menos de X horas"* — el mismo criterio que ya se aplicó al acuse del asesor.

**Enriquecimiento recomendado del correo al equipo:** incluir estado del conjunto, plan, días de prueba restantes y avance de activación. Ese contexto ya se calcula y convierte un correo en un informe.

## 10 · Criterios de aceptación

**Deben funcionar**

1. Un `tenant_admin` abre un ticket y aparece en su lista en estado `abierto`.
2. Al crearse, llega correo a `SUPPORT_NOTIFICATION_TO` con enlace a la bandeja.
3. El superadmin ve el ticket en `/superadmin/support` con el conjunto correcto.
4. El superadmin responde → estado `esperando_respuesta` y correo al administrador.
5. El administrador responde → estado `en_proceso` y correo al equipo.
6. El superadmin marca `resuelto` → correo al administrador con la opción de reabrir.
7. El administrador reabre dentro de la ventana → vuelve a `en_proceso`.
8. Un administrador de un conjunto **suspendido** abre un ticket con éxito.
9. La bandeja muestra la antigüedad de cada ticket y permite filtrar por estado y conjunto.
10. Con dos administradores en el mismo conjunto, ambos ven y responden los mismos tickets.

**Deben fallar**

11. Un `resident` que intente leer o escribir en `supportTickets` → **denegado**.
12. Un `security_guard`, ídem → **denegado**.
13. Un `tenant_admin` que intente leer un ticket de **otro conjunto** → **denegado**.
14. Un `tenant_admin` que intente cambiar `status` o `priority` directamente → **denegado**.
15. Un `tenant_admin` que consulte el documento crudo **no recibe `internalNotes`**.
16. Responder a un ticket `cerrado` → **rechazado**.
17. Abrir un ticket superando el límite de abiertos → **rechazado con mensaje claro**.
18. Cualquier intento de borrado, por cualquier rol → **denegado**.
19. Una consulta de lista **sin** `where("tenantId","==",...)` → **denegada** (comportamiento esperado de las reglas).

Los casos 11–19 se cubren con pruebas de emulador en `tests/firestore.rules.test.ts`, que ya se pueden ejecutar.

## 11 · Arquitectura y dependencias

### Decisión obligatoria: **Cloud Function callable**, no escritura directa

Toda **escritura** —crear, responder, cambiar estado— pasa por callables. Cuatro razones, cualquiera bastaría:

1. **Manda correo.** El cliente no puede disparar correo saliente.
2. **Hay campos que el cliente no debe poder falsificar:** `createdBy`, `status`, `priority`, `tenantName` y las marcas de tiempo.
3. **El hilo es append-only.** Con escritura directa habría que reconstruir esa garantía en las reglas, que no es su fuerte.
4. **Hay límites por conjunto**, que exigen contar antes de escribir.

**La lectura sí va por reglas**, con `tenantAdminOrSuper(resource.data.tenantId)` — es una consulta simple y las reglas la protegen por completo.

> **El problema de `internalNotes`.** Si vive en el mismo documento, un `tenant_admin` con permiso de lectura lo recibe entero: las reglas de Firestore **no filtran campos**. Ocultarlo en la interfaz no es protegerlo.
>
> **Recomendación:** subcolección `supportTickets/{id}/internal/{docId}`, con lectura solo para `superadmin`. Es la única forma real de que el cliente no lo vea, y el costo es una consulta más en la bandeja interna.

### Componentes

| Pieza | Estado | Trabajo |
|---|---|---|
| `supportTickets` (colección y modelo) | Existe | Extender campos |
| `/superadmin/support` | Existe | Añadir hilo, antigüedad, y quitar el alta manual |
| Pantalla de soporte del admin | **No existe** | Nueva |
| Callables de soporte | **No existen** | Nuevas |
| Reglas de `supportTickets` | Existen, solo superadmin | Reescribir |
| Correo | Existe (`email.ts`) | Plantillas nuevas |
| Cierre automático | **No existe** | Job diario, o al leer |

**Dónde entra el administrador — decisión pendiente.** Pediste que estuviera *dentro de su perfil*. Mi recomendación es distinta y la dejo argumentada: **una entrada «Soporte» en el grupo CONFIGURACIÓN del menú lateral**, no una pestaña dentro de Configuración. Quien busca ayuda está frustrado y con prisa, y una pestaña de tercer nivel no se encuentra en ese estado. Si prefieres la pestaña, el resto de la PRD no cambia.

**Cierre automático — `TBD`.** Un job programado (como `trialLifecycleDaily`) es lo limpio. Evaluarlo al leer es más barato y evita un cron, pero deja tickets sin cerrar si nadie abre la bandeja. **Recomendación: job diario**, reutilizando el patrón que ya existe.

**Índices.** La bandeja filtra por estado y ordena por actividad; el portal filtra por `tenantId` y ordena por actividad. Ambos requieren índice compuesto — declararlos en `firestore.indexes.json` antes de desplegar.

## 12 · Riesgos y mitigaciones

| Riesgo | Mitigación | Señal que lo detecta |
|---|---|---|
| **Nadie atiende la cola** y el canal empeora la percepción frente al correo | Dueño nombrado y revisión diaria (§G5) | Tickets `abierto` con más de 48 h |
| **`internalNotes` se filtra** al cliente | Subcolección con lectura solo superadmin | Prueba de emulador que debe fallar |
| **Datos personales** en texto libre | Sin adjuntos en MVP; retención declarada; sin borrado, pero con acceso acotado | Revisión al definir retención |
| **Abuso o bucle** que inunde el buzón | Límites por conjunto y por día | Pico de tickets de un mismo conjunto |
| **Se convierte en canal para residentes** vía el administrador | El canal del residente es PQRS; la categoría lo hace visible | Tickets `operativo` que en realidad son PQRS |
| **Convive con el correo** y la conversación se parte en dos | Al responder por correo, devolver al ticket. `TBD`: ¿respuesta por correo entra al hilo? **Recomendación: no en MVP** | Hilos que se cortan sin resolución |

## 13 · Despliegue, rollback y Story Map

**Orden obligatorio: reglas → functions → front.** Al revés, la interfaz llama a callables que aún no existen. Es el mismo orden que ya usamos y funcionó.

**Rollback.** Aditivo y de riesgo bajo: se retira la entrada del menú y el canal desaparece sin perder datos. Las reglas nuevas son más permisivas que las actuales — revertirlas devuelve `supportTickets` a solo-superadmin sin romper nada.

**Qué se valida dónde.** Todo el flujo y los permisos, en staging con pruebas de emulador y un recorrido real. **La entrega del correo solo se puede confirmar en producción**, porque staging no tiene `RESEND_API_KEY` — mismo caso que el canario del trial.

### Story Map

**MVP**
1. Reglas de `supportTickets` reescritas + subcolección interna.
2. Callables: crear, responder (cliente), responder (Vivaru), cambiar estado.
3. Pantalla de soporte del administrador: lista, detalle, hilo, alta.
4. Bandeja del superadmin: hilo, antigüedad, quitar alta manual.
5. Correos, con `SUPPORT_NOTIFICATION_TO`.
6. Pruebas de emulador de los 9 casos que deben fallar.

**Fase 2**
7. **Adjuntos** — lo primero que añadiría.
8. Cierre automático por inactividad.
9. Contexto enriquecido en el correo al equipo.

**Fase 3**
10. SLA y alertas, ya con baseline real.
11. Base de conocimiento con las preguntas más repetidas.

---

## Puertas

| Puerta | Estado |
|---|---|
| `G0 Necesidad` | ✅ El problema existe. La medición es `TBD` (§2) |
| `G1 Valor` | ⚠️ **Bloqueada por el baseline.** Métrica propuesta: % de solicitudes que entran por el producto, mediana hasta la primera respuesta, y tickets resueltos sin salir del canal |
| `G2 Datos y permisos` | ✅ Modelo y roles definidos y consistentes |
| `G3 Riesgo` | ✅ Auditable, reversible, con pruebas de los casos que deben fallar |
| `G4 Aceptación` | ✅ 19 criterios verificables |
| `G5 Operación` | ⚠️ **Requiere decisión.** El equipo comercial atiende vía el contacto de dev. Falta nombrar quién revisa la bandeja y con qué frecuencia |
| `G6 Escala` | ✅ Decenas al mes; el diseño soporta un orden de magnitud más |

**Lista para desarrollo** (G0–G3 superadas). **No lista para producción** hasta cerrar `G1` y `G5`.

## Decisiones pendientes

1. **Baseline** — correos de soporte del último trimestre y sus tres temas principales.
2. **Quién revisa la bandeja y cada cuánto.** Es `G5`, y sin ella el canal se pudre.
3. **Entrada en el menú lateral o pestaña en Configuración** — recomiendo lo primero (§11).
4. **Ventanas**: reapertura 7 días, cierre automático 14, máximo 5 abiertos y 10 al día. Son recomendaciones, no hechos.
5. **`internalNotes`**: confirmar la subcolección (§11).
