# Roadmap de Producto Vivaru

Inventario vivo de evolución de Vivaru. Conserva oportunidades, brechas, riesgos y
decisiones **sin convertir automáticamente cada solicitud comercial o tendencia en
una prioridad**.

**Regla central:** una iniciativa puede entrar al inventario con información
incompleta, pero no debe avanzar a construcción sin problema, usuario, evidencia,
dependencias y criterio de salida.

---

## Estado de esta revisión

> Esta sección **se reescribe entera** en cada revisión. Es lo primero que se lee y nunca crece: lo que deja de ser actual baja al changelog del final.

| Campo | Valor |
|---|---|
| **Versión** | 0.5 |
| **Fecha** | 17 de agosto de 2026, noche |
| **Estado** | **Orden de ejecución decidido** |
| **Verificado contra** | Repositorio en `5bb407a` (`develop` = `master`), proyectos `hogaru-1` y `vivaru-staging-02`, la consola de Albert CRM en vivo, y el expediente de fases del trial self-service |
| **Alcance** | Madurez de producto. No está subordinado al go-to-market, aunque incorpora evidencia comercial y de adopción |

**Detalle por frente.** Este documento es el tablero. El detalle vive en:

| Documento | Cubre |
|---|---|
| `docs/roadmap-finance.md` | Vivaru Finance — rutas de pago mapeadas, cuatro defectos nombrados |
| `docs/roadmap-revops.md` | REVOPS — embudo medido, capacidades reales y bloqueos |
| `docs/albert-vivaru-integracion.md` | La decisión de integrar con Albert CRM |

**Qué cambió en esta revisión:**

- **El hallazgo que reordena el tablero: la máquina de autoservicio está completa y en
  producción desde el 1 de agosto.** Fases 0 a 4 —`/registro` público, conjunto de
  prueba con siembra, candado de módulos en tres capas, ciclo de vida con avisos y
  expiración sin borrado, bandeja de prospectos en Superadmin— y canario confirmado con
  un registro real. **Lleva 16 días en el aire, pública e indexable, con cero entradas
  reales.**
- **Eso cambia el diagnóstico.** No falta recorrido ni instrumentación: **falta
  demanda**. El tablero sabe medir, calificar, convertir y retener demanda, y **no tiene
  una sola iniciativa para generarla**. Todo `REVOPS` de `001A` en adelante es aguas
  abajo de algo que no existe.
- **Entra el `Orden de ejecución`**, sección propia con cinco niveles. Sustituye a los
  siete P0 simultáneos que la 0.4 tenía en AHORA.
- **Entra un eje nuevo: `El trabajo que caduca`.** La vista por horizontes ordena por
  dependencias y por eso no lo mostraba — hay cambios pequeños cuyo dato **no se
  reconstruye** si llegan después del primer cliente real.
- **`REVOPS-000` deja de ser «decidir el canal» y pasa a «activarlo»**, con
  recomendación fechada.
- **`REVOPS-001A` se parte en dos:** la atribución sube porque caduca; la
  instrumentación y la puerta de alta intención bajan a `REVOPS-001D`.

**Qué espera decisión tuya:**

1. **Si hay relación comercial que activar, o hay que crear la función de venta.** Es
   la única entrada que falta para arrancar el nivel 0, y es la que el tablero no puede
   contestar solo.
2. Tenant piloto para la IA visible de PQRS.
3. Política de retención de `aiAssistance`.
4. **Dónde viven la agenda y la mensajería**, que no tiene ninguno de los dos
   productos — y **cuál de los dos marcos de precio manda**, el de la guía maestra o
   el del Documento Rector de Finance.

---

## Cómo se mantiene este documento

Tres zonas con reglas distintas. Es lo que evita que un documento acabe describiendo
dos épocas a la vez.

| Zona | Regla | Por qué |
|---|---|---|
| **Estado de esta revisión** | Se **reescribe** entera | Lo nuevo va arriba; nadie debería bajar para saber qué cambió |
| **Cuerpo del inventario** | Se **edita en su sitio** | Debe describir el presente. **Nunca se le añade al final** |
| **Changelog** | Se **antepone** (lo nuevo primero) | Es lo único que acumula |

**La regla del cuerpo es la que más cuesta respetar y la que más rinde.** La
tentación al actualizar es añadir «actualización del …» al final. Eso obliga a bajar
y, peor, deja dos versiones conviviendo sin decir cuál manda. Ya pasó en este
repositorio: `wiki/modulos/pqrs.md` era de mayo de 2026, se le fueron añadiendo cosas
alrededor durante tres cambios grandes del módulo, y llegó a afirmar que el portal de
portería crea tickets — cosa que nunca ha hecho. Se detectó comprobando el código,
no leyendo el documento.

**Qué va en el changelog y qué no.** El diff de git ya dice qué líneas cambiaron,
cuándo y quién: repetirlo aquí produce un `git log` peor escrito que nadie mantiene.
El changelog solo aporta lo que el diff no puede decir — **por qué** cambió, **contra
qué se verificó**, y **qué decisión quedó tomada**.

**Fuente de verdad.** El repositorio manda; Notion es la vista publicada para quien no
abre el repo. La razón es concreta: en el repo un error se ve en el diff y se revierte
con un comando. El 17 de agosto de 2026, editando la copia de Notion, se sobrescribió
por accidente el título y el encabezado de propósito, y la recuperación dependió del
historial de deshacer del editor — que se pasó de largo y hubo que reconstruir a mano.

---

## Vista ejecutiva — roadmap por horizontes

Secuencia y prioridad relativa. **No representa fechas contractuales ni compromisos
de entrega.**

| Frente | AHORA | SIGUIENTE | DESPUÉS | EXPLORACIÓN |
|---|---|---|---|---|
| Fundaciones | 🔴 `CORE-001` | 🟠 Hardening y cobertura | — | — |
| Vivaru Finance | 🔴 `FIN-000` · `FIN-001` | 🟠 `FIN-002` | ⏸ `FIN-AI-001` | ◇ `FIN-CH-001` |
| IA y agentes | 🔴 `AI-GOV-001` · ⏸ `AI-DATA-001` | 🟠 `AI-PQRS-001` · `AI-COMM-001` | — | ◇ `AI-ONB-001` |
| **REVOPS** — adquisición y activación | 🟢 `REVOPS-000` · ⏳ `REVOPS-001A` | 🟠 `REVOPS-001B` · `001C` · `001D` | 🔵 `REVOPS-002` · `003` | ◇ `REVOPS-004` |
| Mobile / iOS | 🟡 `MOB-001` | 🟠 `MOB-002` | — | ◇ `MOB-003` |
| Servicio a clientes | ⏳ `SUP-001` | 🟠 `SUP-002` | 🔵 `SUP-003` | ◇ `SUP-004` |
| Onboarding e importación | ⏸ Recolectar evidencia real | ⏸ `ONB-001` | — | ◇ `AI-ONB-001` |
| **Compartido con Albert** | 🟡 Decidir dónde viven | — | — | ◇ Agenda · mensajería · precio |

**Leyenda:** 🟢 coste cero, se puede hoy · ⏳ **caduca: el dato se pierde si llega
tarde** · 🔴 prioridad fundacional · 🟠 siguiente capacidad · 🔵 expansión posterior ·
🟡 descubrimiento · ⏸ bloqueado por datos · ◇ exploración condicionada

### Horizontes

- **AHORA** — integridad, riesgos, instrumentación y decisiones necesarias para avanzar.
- **SIGUIENTE** — capacidades con base suficiente para diseñar, pilotear o construir.
- **DESPUÉS** — expansión que depende de resultados anteriores o de mayor volumen.
- **EXPLORACIÓN** — oportunidades sin evidencia suficiente o sin decisión de solución.

### Estados

| Estado | Significa |
|---|---|
| Verificado | Existe evidencia en código o ambiente |
| Parcial | Existe una parte funcional, pero falta cerrar el flujo |
| Ausente | No existe implementación observable |
| Bloqueado por datos | Técnicamente posible, sin materia prima real para evaluarlo |
| Descubrimiento | Falta validar problema, usuario o alternativa |
| Decisión pendiente | Hay opciones, pero no una dirección aprobada |

---

## Orden de ejecución — decidido el 17 de agosto de 2026

> La vista por horizontes dice **qué depende de qué**. Esta dice **qué se hace primero**, que no es lo mismo. Sustituye a los siete P0 simultáneos de la revisión 0.4.

| Nivel | Qué | Coste | Por qué está ahí |
|---|---|---|---|
| **0** | **Generar demanda** — `REVOPS-000` | Cero código | Es el bloqueo compartido de cinco frentes |
| **1** | **Lo que caduca** — `REVOPS-001A` · `SUP-001` · `FIN-000` | Bajo | El dato no se reconstruye después |
| **2** | **Lo que rompe al convertir** — `FIN-001` | Alto | El trial protege; la conversión no |
| **3** | **Cablear el precio** — primera mitad de `REVOPS-001C` | Medio | Hace falta al convertir, no al probar |
| **4** | Todo lo demás | — | Espera al primer cliente real |

**El horizonte y el nivel no son lo mismo, y conviene no confundirlos.** Una iniciativa
puede estar en `AHORA` por dependencia —está lista para hacerse— y en el **nivel 4** por
orden —no toca todavía—. `CORE-001`, `AI-GOV-001` y `AI-DATA-001` son justo ese caso.
Todo lo que no aparece nombrado en los niveles 0 a 3 es nivel 4.

**De las ocho filas del frente, solo dos tienen trabajo de ingeniería que hoy
signifique algo:** Fundaciones y Finance. IA, Onboarding, Mobile, Soporte y la mitad de
REVOPS esperan exactamente lo mismo — un cliente real usando el producto. **No son
cinco bloqueos: es uno.**

**Por qué el nivel 2 puede esperar, y no es optimismo.** El trial deja Cartera, Egresos,
Libro y Conciliación en solo lectura, mediante `assertModuleAllowed` en functions y
`previewModuleWritable()` en las reglas. Un prospecto en prueba **no puede alcanzar** las
dos rutas de pago divergentes de `FIN-001`. El defecto muerde en la conversión, no en la
prueba — así que los quince días del trial son una ventana regalada, y `FIN-001` es del
tamaño que cabe en ella.

**Lo que explícitamente no se hace ahora:** `AI-PQRS-001`, `ONB-001`, todo Mobile,
`SUP-002`, `REVOPS-002`, `003` y `004`. Los seis esperan el mismo dato, y adelantarlos
es construir sobre supuestos.

**Y la IA está aparcada, no abandonada.** Es el único frente del tablero que **mejora
solo** en cuanto llegue demanda: la sombra está armada y acumulando cero, y empieza a
recoger evidencia con el primer ticket real sin que nadie vuelva a tocarla.

### El trabajo que caduca

Eje nuevo, y el único del tablero que **no ordena por dependencia sino por
irreversibilidad**: si esto no existe antes del primer cliente real, el dato no se
recupera nunca.

| Qué | Dónde | Qué se pierde si llega tarde |
|---|---|---|
| Campos de atribución del lead | `src/lib/marketing/leads.ts` | Un lead sin `utm_*` ni `referrer` **no se atribuye después**. Nunca se sabrá de dónde vino el primero |
| `firstResponseAt` · `assignedTo` | `SUP-001` | **No se reconstruye.** Los tickets ya cerrados nunca lo tendrán |
| La sombra de PQRS | ✅ **Ya está** | Nada — se armó a tiempo y captura desde el primer ticket real |

**`FIN-000` viaja con ellos por un motivo distinto:** no caduca, está **abierto hoy**.
El candado del trial protege Firestore, pero `storage.rules` es otra capa y ahí no hay
filtro de rol.

---

## Resultados estratégicos buscados

1. Un núcleo multi-tenant confiable, seguro y auditable.
2. Menor tiempo para que un nuevo conjunto alcance valor real.
3. Un journey medible desde adquisición hasta conversión y retención.
4. Confianza financiera mediante consistencia, trazabilidad y reversibilidad.
5. IA útil, evaluada y controlada por evidencia.
6. Experiencias móviles alineadas con necesidades reales de cada rol.
7. Una operación de soporte escalable sin duplicar innecesariamente dominios.

---

## Inventario de iniciativas

### AHORA

#### `CORE-001` — Integridad, seguridad y fuente de verdad

- **Frente:** Fundaciones de plataforma · **Estado:** Parcial · **Nivel 4**
- **Problema:** la madurez real depende de reglas, sesiones, auditoría, consistencia
  entre rutas y pruebas de operaciones sensibles.
- **Siguiente decisión:** consolidar una lista verificable de brechas de seguridad,
  integridad, observabilidad y cobertura.
- **Criterio de salida:** operaciones críticas server-side, aislamiento por conjunto
  probado, auditoría completa y documentación reconciliada con producción.

#### `FIN-001` — Comando único e idempotente de aplicación de pagos

- **Frente:** Vivaru Finance · **Estado:** Parcial · **Nivel 2** · **Cabe en la ventana del trial**
- **Problema:** las rutas de pago, comprobantes, ledger, vouchers, saldos y reversos
  deben producir un resultado completo o ninguno.
- **Dependencias:** modelo financiero vigente, permisos, reglas transaccionales y
  migración de flujos existentes.
- **Criterio de salida:** un pago aplicado o revertido mantiene consistentes
  obligación, payment, ledger, voucher, expediente y auditoría.
- **Evidencia (17 ago 2026):** hay **dos rutas** que aplican un pago y **producen
  efectos distintos**. `recordPayment` reserva secuencial, crea asiento, emite
  comprobante y actualiza la cuota — en **cuatro escrituras sueltas sin transacción**.
  `approveReceiptAndRegisterPayment` actualiza la cuota **y no crea asiento ni
  comprobante**: el dinero se mueve en cartera y nunca llega al libro. Además ninguna
  Cloud Function aplica un pago: toda la aritmética del dinero ocurre en el navegador.
  Detalle en `docs/roadmap-finance.md`.

#### `REVOPS-000` — Activar el canal y generar la primera demanda

- **Frente:** REVOPS · **Estado:** No empezado · **Nivel 0** · **No es trabajo de ingeniería**
- **El hallazgo que lo motiva, y es más fuerte de lo que parecía en 0.4:** la máquina de
  autoservicio **está completa y en producción desde el 1 de agosto de 2026**. Fases 0 a
  4: `/registro` público, conjunto de prueba con siembra parametrizable, candado de
  módulos en tres capas, ciclo de vida con avisos a 7/3/1 días y expiración sin borrar,
  bandeja de prospectos en Superadmin, y **canario confirmado con un registro real**. No
  falta ni una pieza del recorrido landing → prueba → «hablar con un asesor» →
  `createTenantFromLead` → cliente.

  **Y lleva 16 días en el aire, pública e indexable, con cero entradas reales.**
- **Los 5 `leads` de producción no son reales:** uno es del propio David
  (`qintilab.com`), otro se llama literalmente «Prueba Dummy», y los tres restantes son
  la misma persona enviando el formulario **tres veces en cinco minutos** el 15 de
  agosto, con empresa «prueba» y «demo». Además la persistencia es reciente —antes
  `/api/demo` y `/api/lead` solo mandaban correo—, así que **si llegó alguien real antes,
  está en el buzón y no en Firestore**.
- **Diagnóstico:** no es que el embudo pierda gente en algún paso. **Nadie ha llegado a
  la puerta.** No falta recorrido ni instrumentación: falta demanda.
- **Recomendación registrada el 17 de agosto — empezar por KAM/reseller**, dejando el
  autoservicio encendido sin más inversión. Tres razones:
  1. Es **la única vía de generación de demanda que ya está diseñada**: la guía maestra
     la define en cuatro países con la compensación del canal calculada, y no necesita
     una línea de código.
  2. El autoservicio **no es una alternativa que haya que financiar** — ya está
     construido, probado y en producción, así que sigue ahí gratis.
  3. **El trial ya es híbrido por diseño.** Su decisión cerrada dice que no convierte
     solo, califica, y que la conversión siempre es hablar con un asesor. El producto ya
     asume que hay una persona cerrando; lo que falta es que alguien llegue hasta ella.
- **La entrada que falta, y es decisión de David:** si hay relación comercial que
  activar —clientes de Qintilab a los que Vivaru se venda de rebote, contactos del
  sector— el KAM es inmediato. Si no la hay, «KAM» significa contratar a alguien o ser
  él el vendedor, y **ese coste el tablero no puede evaluarlo**.
- **Tarea concreta mientras tanto:** revisar `dev@qintilab.com` buscando solicitudes de
  demo o contacto anteriores a la persistencia. Es el único sitio donde puede haber
  leads reales.
- **Criterio de salida:** hay al menos una conversación comercial real en curso, y una
  decisión escrita sobre por qué canal sale Vivaru al mercado.

#### `REVOPS-001A` — Atribución del lead y respuesta inmediata

- **Frente:** REVOPS · **Estado:** Parcial · **Nivel 1** · ⏳ **Caduca**
- **Se partió en la 0.5.** Antes cubría atribución **e** instrumentación del embudo; la
  instrumentación bajó a `REVOPS-001D`, porque medir un embudo por el que no pasa nadie
  no mide nada. Aquí queda lo pequeño y lo irreversible.
- **Absorbe** el antiguo `GROW-001` (atribución y consentimiento).
- **Incluir:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
  `referrer`, landing y consentimiento con fecha; y respuesta automática al lead.
- **Por qué no espera:** `src/lib/marketing/leads.ts` persiste el lead con `appEnv` y
  **ningún campo de atribución**. Un lead que entra sin ellos **no se atribuye después**
  — y el primero real es justo el que más interesa saber de dónde vino.
- **Criterio de salida:** todo lead válido queda atribuido, recibe respuesta y produce
  una siguiente acción trazable.

#### `FIN-000` — Storage con filtro de rol

- **Frente:** Vivaru Finance · **Estado:** Ausente · **Nivel 1** · **Seguridad, y abierto hoy**
- **Problema:** `storage.rules` aísla bien por conjunto, pero **no comprueba el rol**.
  Cualquier miembro autenticado —incluido un **residente** o un guardia— puede leer y
  escribir todos los archivos del conjunto: comprobantes de gasto, actas, documentos
  financieros. El propio comentario de la regla dice «admin and superadmin» y la
  condición no lo verifica.
- **Criterio de salida:** un residente no puede leer ni escribir documentos
  financieros, probado en emulador y en CI.
- **Nota:** es prerrequisito de cualquier fase que suba documentos financieros.

#### `AI-GOV-001` — Cerrar brechas de gobierno y operación de IA

- **Frente:** Plataforma de IA · **Estado:** Parcial · **Nivel 4**, salvo sus tres puntos baratos
- **Criterio de salida:** contenido, feedback, telemetría, retención y despliegues
  tienen trazabilidad y políticas verificables.

| Punto | Estado (17 ago 2026, noche) |
|---|---|
| Retención de `aiAssistance` | **Abierto.** Única colección de IA con contenido del conjunto y sin política de purga |
| Correlación feedback ↔ ticket | **Abierto.** `aiFeedback` no guarda `ticketId` |
| Despliegue de `asistirTicketPqrs` | **Abierto.** No está desplegada en `hogaru-1` |
| Divergencias del catálogo de banderas | **Cerrado.** `ai-pqrs-suggestions` no gobernaba nada; ahora el panel va detrás de `FeatureGate` |

#### `AI-DATA-001` — Evidencia real para G6–G7

- **Frente:** Plataforma de IA · **Estado:** Bloqueado por datos
- **Nivel 4 de construcción — pero su decisión no está bloqueada y se puede tomar hoy**
- **Problema:** la plataforma está más madura que el volumen real de tickets,
  comunicaciones, comprobantes e importaciones.
- **Siguiente decisión:** definir tenant piloto, volumen mínimo, calidad requerida y
  periodo de observación. **Esta decisión no está bloqueada por datos** — se puede
  tomar hoy.
- **Criterio de salida:** dataset productivo suficiente para evaluar calidad,
  seguridad, latencia, costo y utilidad humana.
- **Evidencia (17 ago 2026):** producción tiene 9 conjuntos, **7 marcados
  `isExample`**. Los dos reales tienen **0 tickets**. La sombra está armada y
  acumulando cero.

#### `SUP-001` — Operación básica de soporte

- **Frente:** Servicio a clientes · **Estado:** Parcial · **Nivel 1** · ⏳ **Caduca**
- **Añadir:** `assignedTo`, `firstResponseAt` y contador de pendientes.
- **Criterio de salida:** cada ticket tiene responsable, primera respuesta medible y
  visibilidad operativa desde Superadmin.
- **Nota:** `firstResponseAt` **no se puede reconstruir después**. Los tickets ya
  cerrados nunca lo tendrán.

#### `MOB-001` — Medición y auditoría de experiencia móvil

- **Frente:** Mobile/iOS · **Estado:** Descubrimiento · **Nivel 4**
- **Preguntas:** ¿qué roles usan móvil? ¿qué tareas intentan completar? ¿dónde
  abandonan? ¿qué es responsive y qué exige capacidades nativas?
- **Criterio de salida:** datos por dispositivo, portal y tarea; auditoría responsive;
  decisión documentada sobre el siguiente experimento.
- **Evidencia (17 ago 2026):** **no hay PWA** (sin manifest ni service worker); FCM
  está cableado en `src/lib/firebase/messaging.ts` **sin un solo consumidor** y sin
  service worker, así que no hay push; sí hay cámara y QR en portería. Hay pruebas
  visuales responsive sobre 4 rutas.

### SIGUIENTE

#### `FIN-002` — Expediente y conciliación determinística

- **Estado:** Parcial · **Dependencia:** `FIN-001`
- **Incluye:** `ReconciliationCase`, estados versionados, normalización, duplicados,
  candidatos determinísticos, bandeja de excepciones, motivos y reversos.
- **Criterio de salida:** un caso se rastrea desde la evidencia recibida hasta la
  aplicación, el rechazo o el reverso.

#### `AI-PQRS-001` — Piloto visible del asistente de PQRS

- **Estado:** Parcial
- **Dependencias:** despliegue verificado, tenant piloto, retención resuelta, volumen
  real y criterios de G7.
- **Límite:** la IA sugiere; la persona decide. No ejecuta acciones sensibles.
- **Evidencia (17 ago 2026):** construido y medido contra un gold set de 152 casos.
  Su bandera está apagada en producción y **su callable no está desplegada ahí**.

#### `AI-COMM-001` — Piloto medido del asistente de comunicaciones

- **Estado:** Implementado con adopción pendiente
- **Siguiente decisión:** audiencia piloto, objetivo medible y mecanismo de feedback.
- **Criterio de salida:** evidencia de ahorro de tiempo y calidad aceptable sin
  incidentes críticos.
- **Nota:** la línea base H2′ lleva **tres sesiones sin tomarse** y ya se gastaron dos
  administradores, que vieron la herramienta antes de la medición a ciegas.

#### `REVOPS-001B` — Trial conectado al funnel

- **Frente:** REVOPS · **Estado:** Parcial · **Sustituye** a `GROW-003`
- **Incluye:** emitir el evento de activación —**la regla ya existe, falta el
  evento**—, detección de inactividad, resumen de uso hacia el CRM, tareas por señal y
  cohortes.
- **Criterio de salida:** el equipo distingue trial registrado, activo, bloqueado y con
  intención de compra.

#### `REVOPS-001C` — Solicitud de activación y handoff

- **Frente:** REVOPS · **Estado:** Ausente · **Nivel 3** — su primera mitad, cablear el precio
- **Depende de dos cosas.** La primera es **cablear el precio al producto**: la
  decisión comercial existe desde el 12 de agosto de 2026 en la guía maestra
  —ver «El precio» más abajo— pero `plans` está vacía y los `planId` de producción no
  corresponden a la segmentación comercial. Es cableado, no decisión. La segunda es **la
  señal de vuelta desde Albert**, que no tiene webhooks: trabajo propio en el
  repositorio de Albert, no una negociación con un tercero.
- **Criterio de salida:** una intención de compra se convierte en expediente trazable
  hasta una suscripción activa, sin reconstruir contexto por correo.

#### `REVOPS-001D` — Instrumentación del embudo y puerta de alta intención

- **Frente:** REVOPS · **Estado:** Ausente · **Nivel 4** · **Sale de `REVOPS-001A` en la 0.5**
- **Incluye:** eventos de producto (`trial_started`, `activation_milestone`,
  `converted`) y **la puerta pública de alta intención**: `requestAdvisorContact` exige
  `tenantId`, así que un prospecto que todavía no tiene conjunto **no tiene por dónde
  decir «quiero contratar»**.
- **Por qué baja de AHORA:** hay **14 eventos con nombre**, todos de landing y ninguno
  de producto — pero instrumentar antes de que exista tráfico es ponerle velocímetro a
  un coche aparcado. Sube en cuanto el nivel 0 produzca la primera conversación real.
- **Nota:** la definición de trial activado **ya existe** —7 pasos en la prueba, 10 en
  un cliente— y ya se ve en Superadmin. Lo que falta es emitir el evento, que es
  `REVOPS-001B`.

#### `MOB-002` — Experimento móvil para portería

- **Estado:** Decisión pendiente · **Dependencia:** `MOB-001`
- **Hipótesis:** portería es el caso móvil más claro por cámara, QR, visitantes y
  paquetería.
- **Alternativa inicial:** fortalecer responsive y evaluar una PWA acotada antes de
  crear una aplicación nativa.

#### `SUP-002` — Métricas y notificaciones de soporte

- **Estado:** Ausente · **Dependencia:** `SUP-001` y volumen real
- **Activar cuando exista volumen:** antigüedad, primera respuesta, resolución,
  recurrencia, avisos dentro del producto y análisis de causas.

#### `ONB-001` — Evidencia para onboarding e importación inteligente

- **Estado:** Bloqueado por datos
- **Requisito:** recolectar archivos reales, encabezados no mapeados, decisiones de
  administradores y errores frecuentes.
- **Criterio de entrada:** 15–25 archivos reales, anonimizados o autorizados.
- **Evidencia (17 ago 2026):** `importRuns` tiene **0 filas en producción** y 7 en
  staging, **ninguna con encabezados sin mapear**. La fuente que iba a alimentar esto
  está vacía.

### DESPUÉS

#### `FIN-AI-001` — Extracción inteligente de comprobantes

- **Estado:** Ausente y bloqueado por datos
- **Dependencias:** `FIN-001`, `FIN-002`, comprobantes reales, contrato de extracción,
  dataset y evaluaciones.
- **Límite:** la IA extrae y sugiere. La aplicación financiera permanece en servicios
  determinísticos server-side.
- **Evidencia:** producción tiene **cero comprobantes**.

#### `REVOPS-002` · `003` · `004` — Nurturing, reseller y checkout

- **Frente:** REVOPS · **Estado:** Ausente · **Sustituyen** a `GROW-004`
- **`002` nurturing y scoring:** solo después de observar conversiones reales. Hay
  **cero**.
- **`003` reseller y contratación semi-automatizada.**
- **`004` checkout y pagos digitales:** depende de vendedor legal por país,
  facturación, impuestos, monedas y conciliación. **No debe bloquear a `001A–C`.**
- **Evidencia (17 ago 2026):** **no hay checkout ni pasarela de ningún tipo.** La
  conversión la ejecuta una persona invocando `createTenantFromLead`.

#### `SUP-003` — SLA y escalamiento

- **Estado:** Ausente
- **Condición de entrada:** volumen sostenido, equipo de soporte y necesidad comprobada.
- **No construir una consola separada** hasta que la operación actual demuestre sus límites.

#### `FIN-CH-001` — Nuevos canales financieros

- **Estado:** Exploración
- **Opciones:** WhatsApp, estados bancarios y conectores.
- **Dependencias:** identidad, consentimiento, proveedor, costos, parser versionado,
  seguridad e idempotencia.

### EXPLORACIÓN

#### `MOB-003` — Aplicación multiplataforma o iOS nativa

- **Estado:** Exploración
- **No comprometer construcción** hasta demostrar que responsive o PWA no resuelven
  las tareas prioritarias.
- **Preguntas:** ¿qué rol justifica la app? ¿qué capacidad nativa es indispensable?
  ¿qué adopción sostiene dos superficies de producto?

#### `SUP-004` — Consola independiente o módulo revendible de servicio

- **Estado:** Exploración
- **Riesgo:** Vivaru ya tiene PQRS para residentes y soporte para clientes. Una tercera
  superficie puede duplicar dominios y confundir expectativas.
- **Condición de entrada:** demanda expresa, volumen y decisión sobre **cuál es la
  superficie canónica**.

#### `AI-ONB-001` — Mapeo asistido de columnas

- **Estado:** Exploración bloqueada por datos
- **No diseñar sobre supuestos.** Activar únicamente cuando `ONB-001` produzca evidencia.

---

## El precio — decidido, no cableado

**Fuente de verdad: `Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12` (Drive).** Versión del 12 de agosto de
2026, uso interno para preparar cotizaciones. **Precio por unidad al mes**, salvo setup
o ticket señalado.

Separa **tres capas que no deben confundirse**: precio base de Vivaru o Qintilab,
compensación del canal (KAM o reseller), y precio final al cliente. Oferta trimestral
recomendada, segmento **Core** (101–200 unidades):

| País | Base Vivaru | Canal | **Final cliente** |
|---|---|---|---|
| México | MXN $27 | $24 KAM | **MXN $51** |
| Panamá | incluida | USD $1,80 reseller | **USD $3,77** |
| Colombia | COP $5.100 | $3.400 KAM | **COP $8.500** |
| Ecuador | USD $1,90 | $1,25 KAM | **USD $3,15** |

Frecuencia trimestral por defecto; mensual existe y es más costosa. Segmentación por
tamaño: **Emergente** 50–100 unidades · **Core** 101–200 · **Enterprise** 201–300+.

**Regla de autoridad documental:** para México manda su documento individual; para
Panamá, su presentación; para Colombia y Ecuador, el consolidado.

### Lo que falta no es la decisión, es el cableado

- **La colección `plans` de producción tiene 0 documentos** y no hay ninguna cifra de
  precio en el código.
- **Los `planId` en uso no corresponden a la segmentación comercial:** producción usa
  `starter`, `plus`, `premium` y `trial`; la guía segmenta por Emergente, Core y
  Enterprise. **Son dos vocabularios para lo mismo** y hay que reconciliarlos —
  preferiblemente antes de vender, porque después habría que migrar conjuntos que ya
  están cobrando.

### Discrepancia por resolver

El **Documento Rector de Vivaru Finance** razona sobre una base de **MXN $40 por unidad
al mes** con premium de +10/15/20/25 para el módulo financiero. La guía maestra dice
**base $27 y final al cliente $51**. **Son dos marcos de precio en circulación**, y
mientras convivan, cualquier cálculo de margen del módulo financiero se apoya en la
cifra equivocada. La guía es posterior y se declara consolidada; decidir cuál manda es
de negocio, no de producto.

---

## Compartido con Albert CRM — tres carencias sin dueño

Salió de cruzar el inventario de Vivaru con el de Albert CRM, y **no estaba en el
roadmap de ninguno de los dos**:

| Capacidad | Albert | Vivaru |
|---|---|---|
| **Agenda de demos** | No. Su landing agenda con formulario | No |
| **Motor de mensajería** con consentimiento, supresión y frecuencia | No. Solo plantillas con merge fields | No |
| **Precio de plan** | Planes con límites, sin precio | **Decidido** en la guía maestra; **no cableado** al producto |

Los tres son prerrequisitos del circuito comercial de **ambos productos**. Construirlos
una vez y compartirlos es, en mi opinión, mejor argumento a favor de integrar que
reutilizar el pipeline — porque el pipeline se puede sustituir con una hoja de cálculo
durante meses, y esto no.

**Decisión pendiente:** dónde viven. Detalle en `docs/albert-vivaru-integracion.md`.

---

## Áreas pendientes de evaluación sistemática

Forman parte del inventario, pero no tienen diagnóstico suficiente para asignarles
iniciativas concretas:

Residentes, unidades y sincronización de estados · administración multi-conjunto y
Superadmin · guardia, visitantes, QR y paquetería · reservas y espacios comunes ·
comunicaciones no asistidas · PQRS residencial · documentos y expedientes · auditoría
y observabilidad · SRI, fiscalidad y localización por país · accesibilidad,
rendimiento y calidad responsive · planes, suscripciones y billing SaaS ·
notificaciones web, correo y push · analítica operativa por conjunto.

---

## Observaciones de la revisión técnica del 17 de agosto de 2026

> **Opiniones fechadas de la revisión técnica.** Las dos primeras **quedaron resueltas el mismo día**, cuando David decidió el orden. Se conservan porque el changelog dice qué cambió y esto dice qué se pensaba antes de cambiarlo.

**1 · Había SIETE P0 simultáneos en AHORA, y eso significaba que no había ninguno.**
`CORE-001`, `FIN-000`, `FIN-001`, `REVOPS-001A`, `AI-GOV-001`, `AI-DATA-001` y
`REVOPS-000`. Con el tamaño de equipo actual era una lista de deseos, y la revisión de
esa semana **añadió uno en vez de secuenciar**.

> ✅ **Resuelta en la 0.5.** Existe el `Orden de ejecución` con cinco niveles, y la prioridad ya no se declara por etiqueta sino por posición. La secuencia propuesta aquí —`REVOPS-000`, luego `FIN-000`, y solo entonces elegir uno entre `FIN-001` y `REVOPS-001A`— se mantuvo casi entera, con un matiz que la mejoró: `REVOPS-001A` no compite con `FIN-001`, porque **se partió** y su mitad urgente cuesta poco.

**2 · Ninguna iniciativa produce clientes, y casi todo depende de que existan.**
Cinco iniciativas —`AI-DATA-001`, `ONB-001`, `SUP-002`, `FIN-AI-001`, `AI-ONB-001`—
esperan datos reales. `REVOPS-001A` es instrumentación **para** adquirir, no
adquisición. Activar conjuntos es trabajo comercial, no aparece en el tablero y por
tanto no lo posee nadie. **Es el bloqueo estructural del roadmap, y no es técnico.**

> ✅ **Recogida como nivel 0.** Y al comprobarla apareció algo más fuerte de lo que decía la observación: la máquina de autoservicio **lleva 16 días en producción, pública, sin una sola entrada real**. No es que falte instrumentar la adquisición — es que **no hay demanda que instrumentar**. El tablero sabe medir, calificar, convertir y retener; generar sigue sin tener dueño, y ahora al menos tiene ficha.

**3 · `AI-DATA-001` está etiquetado como bloqueado y su decisión no lo está.** Su
evaluación sí depende de datos, pero definir tenant piloto, volumen mínimo y periodo
de observación se puede decidir hoy. Marcarlo ⏸ lo hace parecer pasivo cuando es la
decisión de mayor apalancamiento: desbloquea cinco iniciativas.

**4 · `CORE-001` no se puede terminar tal como está escrito.** Su criterio de salida es
consolidar una lista de brechas: eso es una auditoría con entregable, no una
iniciativa con criterio de cierre. Como P0 vago competirá con los otros cinco y no
ganará nunca.

**5 · `AI-GOV-001` mezcla cosas de coste muy distinto.** Retención de `aiAssistance`,
`ticketId` en `aiFeedback` y desplegar `asistirTicketPqrs` son **horas de trabajo**.
Empaquetarlos con una auditoría de banderas los retrasa sin motivo.

---

## Preguntas abiertas

1. ¿Cuál será el primer tenant piloto para IA visible?
2. ¿Qué política de retención debe aplicar a `aiAssistance`?
3. ¿Qué volumen mínimo permite cerrar G7?
4. ¿Quién utiliza Vivaru desde móvil y para qué tareas?
5. ¿Qué define un trial activado y un cliente activo?
6. ¿Cuál será la fuente comercial canónica: Firestore, CRM u otra?
7. ¿Cómo se cobrarán planes, módulos premium y consumo?
8. ¿Cuándo existe volumen suficiente para SLA y consola de soporte separada?
9. ¿Qué conjuntos pueden aportar comprobantes, tickets y archivos reales autorizados?
10. ~~¿Notion será la fuente maestra o el repositorio?~~ **Resuelta el 17 ago 2026:**
    el repositorio manda, Notion es la vista publicada. Ver «Cómo se mantiene este
    documento».

---

## Reglas de priorización

Cada iniciativa nueva debe registrar: problema y resultado esperado · usuario y rol
afectados · fuente (cliente, prospecto, operación, riesgo, tendencia o estrategia) ·
evidencia disponible **y fecha de verificación** · alcance y alternativa más simple ·
dependencias técnicas, legales, operativas y de datos · riesgo de hacerla y de no
hacerla · esfuerzo relativo · horizonte y estado · criterio de entrada y de salida ·
decisión (priorizar, mantener, aplazar, experimentar o descartar) · justificación y
fecha de revisión.

> Una solicitud de prospecto aumenta la evidencia, pero **no determina por sí sola la prioridad**.

## Cadencia de actualización

- **Intake continuo:** registrar ideas sin prometer ejecución.
- **Revisión breve:** cuando llegue nueva evidencia, prospecto o tendencia.
- **Revisión mensual:** estados, bloqueos, dependencias y cambios de horizonte.
- **Revisión trimestral:** resultados estratégicos, capacidad y eliminación de
  iniciativas obsoletas.
- **Antes de comprometer desarrollo:** verificar repositorio y ambiente.
- **Después de cada decisión:** registrar qué cambió y por qué.

---

## Changelog

> **Lo más nuevo primero.** Cada entrada dice **por qué** cambió y **contra qué se verificó** — nunca qué líneas se movieron, que para eso está el diff de git.

### 0.5 — 17 de agosto de 2026, noche

**Por qué:** David pidió decidir el orden antes de publicar en Notion. Al preparar la
respuesta se comprobó el expediente del trial self-service, y apareció el dato que
reordena el tablero entero.

**Lo que se encontró:** la máquina de autoservicio **está completa y en producción desde
el 1 de agosto** —Fases 0 a 4, con canario confirmado por un registro real— y lleva
**16 días pública e indexable con cero entradas reales**. La 0.4 decía que había que
decidir el canal; con el trial ya en producción la pregunta es otra. No falta recorrido
ni instrumentación: **falta demanda**. El tablero sabe medir, calificar, convertir y
retener demanda, y no tiene una sola iniciativa para generarla.

**La cuenta que lo sostiene:** de las ocho filas del frente, solo dos tienen trabajo de
ingeniería que hoy signifique algo —Fundaciones y Finance—. Las otras esperan lo mismo:
un cliente real usando el producto. No son cinco bloqueos, es uno.

**Verificado contra:** repositorio en `5bb407a`, el expediente de fases del trial con
sus commits y su canario, `firestore.rules`, `storage.rules`,
`src/lib/marketing/leads.ts`, `functions/src/trial-modules.ts`, y los proyectos
`hogaru-1` y `vivaru-staging-02`.

**Decisiones que quedan tomadas:**

- **Orden de ejecución en cinco niveles**, con sección propia. Sustituye a los siete P0
  simultáneos que la 0.4 tenía en AHORA — que es la forma educada de no priorizar.
- **`FIN-001` baja al nivel 2, y no por optimismo.** El trial deja los módulos
  financieros en solo lectura por `assertModuleAllowed` y `previewModuleWritable()`, así
  que las dos rutas de pago divergentes **no son alcanzables durante la prueba**. El
  defecto muerde en la conversión. Los quince días del trial son la ventana para
  arreglarlo, y `FIN-001` es del tamaño que cabe en ella.
- **`FIN-000` sube al nivel 1** por lo contrario: no caduca, está abierto **hoy**. El
  candado del trial protege Firestore, pero `storage.rules` es otra capa sin filtro de
  rol.
- **`REVOPS-001A` se parte.** La atribución sube porque caduca; la instrumentación y la
  puerta de alta intención bajan a `REVOPS-001D`. Instrumentar un embudo sin tráfico es
  ponerle velocímetro a un coche aparcado.
- **Canal recomendado: KAM/reseller**, con el autoservicio encendido sin más inversión.
  Queda **como recomendación fechada, no como decisión cerrada**: falta una entrada que
  solo David tiene —si hay relación comercial que activar, o si «KAM» significa
  contratar a alguien.

**Eje nuevo: el trabajo que caduca.** La vista por horizontes ordena por dependencias y
por eso no lo mostraba. Hay cambios pequeños —atribución del lead, `firstResponseAt`,
`assignedTo`— cuyo dato **no se reconstruye**: si no existen antes del primer cliente
real, se pierde para siempre. La sombra de PQRS ya estaba a tiempo, y es el único frente
que mejora solo cuando llegue la demanda.

### 0.4 — 17 de agosto de 2026, noche

**Corrección del mismo día:** los 5 leads de producción **no son reales**. Son pruebas
internas —una se llama «Prueba Dummy», tres son la misma persona en cinco minutos—. No
es que el embudo pierda gente: **nunca ha entrado nadie**. Se retira la recomendación
de importarlos a un CRM y se sustituye por decidir el canal de salida al mercado.

**Por qué:** las versiones anteriores afirmaban que no había precio. **Era falso.**
Existe desde el **12 de agosto** en la guía maestra de precios por país, cinco días
antes de que se escribieran los documentos rectores que decían lo contrario.

- **Sección nueva «El precio»**, con la guía maestra como fuente de verdad: precio por
  unidad al mes para México, Panamá, Colombia y Ecuador, con las tres capas separadas
  —base, canal y final al cliente— y la segmentación por tamaño.
- **Lo que falta no es la decisión, es el cableado:** `plans` con 0 documentos, sin
  cifra de precio en el código, y los `planId` de producción (`starter/plus/premium`)
  **no corresponden** a la segmentación comercial (`Emergente/Core/Enterprise`).
- **Se registra una discrepancia sin resolver:** el Documento Rector de Finance razona
  sobre base MXN $40 y la guía dice base $27 / final $51. Dos marcos en circulación.
- `REVOPS-001C` deja de depender de «un precio que no existe» y pasa a depender de
  conectar uno que sí.

### 0.3 — 17 de agosto de 2026, noche

**Por qué:** se auditaron los dos documentos rectores pendientes —Finance y REVOPS— y
la documentación de Albert CRM, y se navegó su consola. El tablero incorpora lo que
salió, y los tres detalles quedan en documentos propios.

**Verificado contra:** repositorio en `c8e8923`, `hogaru-1`, `vivaru-staging-02` y la
consola de Albert en vivo.

- **`Adquisición y conversión` pasa a ser `REVOPS`.** `GROW-001` y `GROW-002` se
  absorben en `REVOPS-001A`; `GROW-003` evoluciona a `001B`; `GROW-004` se reparte.
- **Entra `REVOPS-000`**, el único trabajo del tablero con coste cero: importar los 5
  leads por CSV a Albert y trabajarlos a mano. Levanta el baseline que Finance, REVOPS
  y el documento de integración piden por separado, y contesta si el equipo comercial
  entra al CRM.
- **Entra `FIN-000`**, seguridad: `storage.rules` aísla por conjunto pero **no filtra
  por rol**, así que un residente puede leer y escribir documentos financieros.
- **`FIN-001` se afila:** hay dos rutas que aplican un pago con efectos distintos, y la
  del residente **nunca escribe en el libro contable**.
- **Fila nueva: las tres carencias compartidas con Albert** —agenda, mensajería con
  consentimiento y precio—, que no estaban en el roadmap de ninguno de los dos
  productos y son prerrequisito de los dos.
- **La observación sobre los P0 empeora:** eran seis, ahora son siete. Se añade una
  propuesta de secuencia.

### 0.2 — 17 de agosto de 2026, noche

**Por qué:** la versión 0.1 se escribió apoyándose en una inspección técnica de ese
mismo día, y en las horas siguientes cambió el estado de producción. El propio
documento advierte que ningún estado debe considerarse permanente sin revisión nueva;
esta es la primera aplicación de esa regla, a las pocas horas.

**Verificado contra:** repositorio en `1f3a86a`, y lectura directa de `hogaru-1` y
`vivaru-staging-02` (banderas, funciones desplegadas, conjuntos, colecciones).

- **`AI-GOV-001` pasa de cuatro puntos abiertos a tres.** La divergencia del catálogo
  de banderas está cerrada: `ai-pqrs-suggestions` estaba declarada desde su creación y
  **no gobernaba nada** — el panel de IA se pintaba siempre. Habría llegado a
  producción, donde su callable ni siquiera está desplegada, como un panel que revienta
  al pulsarlo.
- **El modo sombra de PQRS pasa de construido a corriendo en producción.** Dos triggers
  `ACTIVE` sin reintentos, tres banderas encendidas. Comprobado además que **no gasta
  donde no debe**: un ticket de prueba en un conjunto marcado `isExample` produjo la
  fila con motivo `sembrado` y cero llamadas al modelo.
- **Se elimina un riesgo que el roadmap no recogía:** producción corría funciones
  desplegadas desde `develop`, y cualquier despliegue desde `master` las habría
  borrado, porque Firebase elimina lo que no está en el código fuente. Se promocionó
  `develop` a `master`.
- **Se añaden cifras a las iniciativas bloqueadas**, para que «bloqueado por datos»
  deje de ser una etiqueta y sea un número: 7 de 9 conjuntos de producción son de
  ejemplo, los dos reales tienen 0 tickets, `importRuns` no tiene ni una fila con
  encabezados sin mapear, y no existe checkout de ningún tipo.
- **Se resuelve la pregunta abierta sobre la fuente de verdad.** El repositorio manda.
  El detonante fue concreto: editando la copia de Notion se sobrescribieron por
  accidente el título y el encabezado de propósito, y la recuperación dependió del
  historial de deshacer del editor.
- **Se añade la sección de observaciones sobre el orden**, separada del inventario y
  firmada, para que una discrepancia sobre prioridades quede fechada en vez de
  perderse en una conversación.

### 0.1 — 17 de agosto de 2026

Primera versión. Inventario inicial construido a partir de una inspección read-only
del repositorio y los ambientes, organizado en cuatro horizontes y siete frentes, con
reglas de priorización y cadencia de actualización.
