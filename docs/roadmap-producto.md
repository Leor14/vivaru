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
| **Versión** | 0.9.49 |
| **Fecha** | 1 de septiembre de 2026 |
| **Estado** | **2 sep: LOS CINCO CABOS SUELTOS CERRADOS** en `develop` (`484e16a`; staging lo sirve, producción espera el push a `master`) **y `PRD-V-PLAT-006` escrita en Discovery**: la «puerta del alta» de `DATO-001` resultó **imposible por construcción con `isExample`** —lo llevan los nueve conjuntos, trials incluidos— y `DATO-001` dejó once direcciones que su patrón no cazaba. Espera tres decisiones. Detalle en 0.9.49. **Lo anterior:** 1 sep, noche: `ONB-003` (unir columnas) EN PRODUCCIÓN y validada con ojos; Albert RETOMADO** — `DECISIONES-A-006` entregada, esperando el contrato de su endpoint `vivaruWonSignals`. Detalle en el changelog 0.9.48. **Lo del día, vigente:** **LOS DOS FRENTES DEL 31 ESTÁN RESUELTOS.** (a) La prueba de portería de `PH-003`: **`CA3` verificado en producción con dos sesiones reales a la vez** —guardia y residente en navegadores distintos, resuelto en 26 segundos, `authorizationMedium: "app"` con el uid del residente en la base— y **`CA10` estaba EN PRODUCCIÓN SIN CONSTRUIR**: la propia prueba lo destapó al ver la visita **desaparecer del portal del residente** en el instante de autorizarse. **Se construyó, desplegó y verificó el mismo día** (`28a587e` + `c858edf`), con el mismo vocabulario de constancia que ve la portería. **Tercera vez que muerde «desplegado no es completo».** De `PH-003` queda solo **`CA4`** (la carrera), y **su fixture ya existe**: segunda residente en APARTAMENTO 201 (Carolina Prueba), verificada entrando; la prueba pide **dos personas y dos dispositivos**, no más código. (b) **La exploración de `AI-ONB-001` está hecha y REENCUADRA la ficha:** medido contra el código real, el mapeador determinístico **casi no falla en «elegir columnas»** —que es justo lo que el enganche previsto asiste—; falla en **transformaciones** (nombre partido, Torre+Apto, padrón mixto, fila de título encima de los encabezados) y en **formatos** (PDF/foto ni entran al lector). La premisa de David aguantó —sin corpus no hay ficha— y ya se sabe **qué corpus pedir**. **Y la noche de los chips cerró dos defectos** de la familia «dato ausente disfrazado de dato falso», los dos en producción: el login que todo lo pintaba «error inesperado» (`fe89324`) y el «Visita a: [guardia]» (`d77a559`). **LO ANTERIOR, VIGENTE:** la IA encendida con 0 tráfico y el tope de gasto sin mirarse; `PLAT-005` pendiente de un Android; 0 `pushTokens`; `UX-005` espera tu decisión de prioridad. Los remotos se leen con `git ls-remote`, no de aquí |
| **Verificado contra** | **Producción, midiendo y con ojos** (1 sep, noche: `build-2026-09-01-019` ← `6548e51` por `traffic.current`; `npm test` **1554** · functions **745**). Y por la mañana: `CA3` y `CA10` **vistos en pantalla** con las sesiones reales del guardia y de DOS residentes distintos, y los campos leídos de la base (`authorizedBy`, `authorizationMedium`, `checkInAt` posterior a la autorización); la fixture de `CA4` verificada con **la misma consulta del servidor** (`residentesActivosDeLaUnidad` → 2 activos en la 201); el mapeador medido **ejecutando** `suggestMapping` y `readTabularFile` contra ocho formatos plausibles; `npm test` **1490** con el emulador levantado; producción sirviendo `build-2026-09-01-003` por `traffic.current`. Los conteos de fondo (conjuntos, cobros, personas) son los del 31 y están en el reporte |
| **Alcance** | Madurez de producto. No está subordinado al go-to-market, aunque incorpora evidencia comercial y de adopción |

**Lo que YA está construido no se lee aquí.** Vive en una base de Notion propia —
[**Construido — bitácora de Vivaru**](https://app.notion.com/p/0bdb213a53274fe2bcc7bd9b4fa1510a)—,
una fila por entrega con su frente, su ambiente, su bandera y su commit, y tres vistas: por
frente, esperando producción, y cronológica.

**La división de trabajo es lo que evita que este documento se vuelva ilegible:** el roadmap
dice **qué se va a hacer y por qué**; la bitácora dice **qué existe y dónde está corriendo**.
Lo segundo crece cada semana y no cabe en una narración. **La fuente de verdad de las dos sigue
siendo el repositorio**, y la bitácora se actualiza en la misma pasada que este documento.

**Y abrió un frente que la vista ejecutiva no tenía: «Propiedad horizontal».** El lote de
Habitanto —coeficiente, proveedores, reservas en servidor, plan de cuentas, multiconjunto— es el
mayor cuerpo de trabajo de la semana y **no encajaba en ninguno de los ocho**; quedaba metido a
la fuerza en Fundaciones.

**Detalle por frente.** Este documento es el tablero. El detalle vive en:

| Documento | Cubre |
|---|---|
| `docs/roadmap-finance.md` | Vivaru Finance — rutas de pago mapeadas, cuatro defectos nombrados |
| `docs/roadmap-revops.md` | REVOPS — embudo medido, capacidades reales y bloqueos |
| `docs/albert-vivaru-integracion.md` | La decisión de integrar con Albert CRM |

**Qué cambió en esta revisión:**

- **El corte de navegación, entero y en producción.** Cinco pasadas: el guardián del contrato
  ruta↔menú, la cabecera de página en los cuatro portales, el menú plegable, las pestañas
  unificadas y en la URL, y Cartera partida en cuatro. Detalle en la bitácora.
- **Frente nuevo en el inventario: «Experiencia y diseño».** No encajaba en ninguno de los
  nueve, igual que le pasó a «Propiedad horizontal» con el lote de Habitanto. Trae `UX-001`
  (cerrado), `UX-002` (filtros en la URL, aplazada) y `UX-003` (por acotar).
- **Y un método de verificación corregido**, porque el obvio miente — ver «Verificado contra».

**Lo anterior a esta revisión:**

- **`FLOW-002`, el front (sesión B), en siete incrementos.** El saldo inicial fuera del documento
  de la cuenta · tipos, callables y el reparto de R7 en un módulo puro · el «% de recaudo» de R16
  · la vista de anticipos · el reparto y la cuenta bancaria en el cobro · el saldo a favor del
  residente · y los dos defectos que salieron de mirar. **Todo detrás de las mismas dos banderas
  apagadas.**
- **El «% de recaudo» dejó de responder a dos preguntas con un número.** «Cuánto dinero entró» y
  «cuánto de lo facturado está saldado» se separan en cuanto existen anticipos: una unidad que
  cubre julio con un anticipo de junio salía al **0 % con la cuota saldada**. El porcentaje pasa a
  medir liquidación; el recaudado sigue siendo el dinero que entró. Cupo en un solo sitio porque
  VIV-1103 ya había unificado la fórmula.
- **Un error puede ocurrir DESPUÉS de que la escritura cuaje**, y los dos defectos de la sesión
  son ese mismo animal: la operación de dinero se confirma y algo posterior falla, así que la
  pantalla miente en la dirección más cara. **Al revisar un camino de dinero hay que mirar qué
  pasa después del `commit`, no solo dentro.**
- **`FLOW-002`, todo el servidor, en ocho incrementos.** Reglas · tipos y cuenta `1.10` ·
  `bankAccountId` en los dos asientos · los dos espejos de `calcularSaldo` · el anticipo por
  sobrepago · cruce y descruce · R15 y R9 · el reparto a varios cargos. **Todo detrás de dos
  banderas apagadas** (`producto-anticipos`, `producto-pago-multiple`).
- **La suite no ENCADENA, y ahí estaba el defecto.** R8 bloqueaba la reversión mirando
  `remaining < amount`, que parecía significar «tiene cruces» y no lo es: **anular un anticipo
  pone `remaining` a cero sin haber cruzado nada**. Hizo falta encadenar **cinco** operaciones
  —pagar, cruzar, descruzar, anular, revertir— para que apareciera. Cada tramo estaba probado y
  bien; lo que fallaba era la secuencia.
- **CA6′ demostrada, no argumentada.** Se mutó el código para que el cruce subiera
  `paymentAmount` —la trampa que destapó la v1.1— y se pusieron rojas cuatro pruebas. **La que
  NO falló fue CA6**, «no crea ningún asiento»: pasó en verde con el ingreso inflado en 60.000.
  Si se hubiera construido con la PRD v1.1, esto salía a producción con la suite en verde.
- **Un verde no vale sin falsación.** Salvó dos veces de un verde falso: un `evaluation error`
  en las reglas que denegaba por fallar en vez de por decidir —150 pruebas en verde por el motivo
  equivocado— y la CA6 de arriba.
- **El typecheck no ve los `.mjs`.** El catálogo de banderas vive en cuatro sitios y **dos son
  scripts**. Se dijo «las cuatro cuadran» mirando el compilador, que solo veía dos: las banderas
  nuevas habrían sido rechazadas como typo al intentar encenderlas — el mismo defecto que ya
  mordió en agosto.
- **Tres validaciones que no estaban en la PRD y salieron de escribir el código:** todas las
  líneas de un reparto tienen que ser de la misma unidad —si no, el anticipo no tiene dueño—; un
  mismo cargo no puede aparecer dos veces —la segunda escritura pisaría a la primera y **el
  dinero se perdería sin que nada fallase**—; y hay un tope de líneas, porque el límite de
  escrituras de una transacción no se descubre a mitad de una operación de dinero.
- **Y dos huecos que tampoco estaban:** revertir un pago dejaba vivo el anticipo (R15) y el
  reverso conocía **un solo asiento**, así que un pago repartido se deshacía a la mitad.
- **Herramienta nueva:** `functions/scripts/verificar-anticipos.mjs`, no destructivo y con
  limpieza de emergencia. Sirve igual para producción. **Lo que no prueba** —el camino del
  callable: sesión, CORS y reglas— se mira por el navegador cuando haya pantalla.
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
| **Propiedad horizontal** | ✅ **BLOQUE CERRADO** — `PH-001` · `PLAT-002` · `FIX-002` · `FEAT-004` · `FLOW-003` · `FLOW-001` · **`PH-003` en producción, `CA3`+`CA10` verificados con ojos** (1 sep) | 🟡 **`CA4` de `PH-003`** — la carrera entre dos residentes: **la fixture ya existe** (Carolina Prueba en la 201); pide dos personas y dos dispositivos, no código | 🔵 `PH-002` (espera al primer pago real) | — |
| **Experiencia y diseño** | 🟢 `UX-001` y `UX-003` en producción · 🔴 **`UX-004` lista para desarrollo** (`PRD-V-FIX-003`): el panel y cartera **divergen en los 7 conjuntos** | 🟠 Ejecutar `UX-004` | ⏸ `UX-002` (filtros en la URL, espera clientes) | ◇ **`UX-005`** (tableros configurables, prioridad baja) |
| Fundaciones | 🔴 `CORE-001` | 🟠 Hardening y cobertura | — | — |
| **Vivaru Finance** | ✅ **BLOQUE CERRADO** — `FIN-000` · `FIN-001` · `FIN-002`, las tres en producción (`FIN-002` el 29 ago, bandera solo en Santa María) | — | ⏸ `FIN-AI-001` (F2, espera un corpus real de comprobantes: hoy 0 ficheros que leer) | ◇ `FIN-CH-001` |
| IA y agentes | 🔴 `AI-GOV-001` · ⏸ `AI-DATA-001` · 🟠 **encender: `docs/encender-la-ia.md`** (3 de 7 banderas YA encendidas en producción desde el 17 ago, **`ia-proveedor-real` incluida**; 0 tráfico) | 🟠 `AI-PQRS-001` · `AI-COMM-001` | — | ◇ `AI-ONB-001` (**explorada el 1 sep: la ficha no es «elegir columnas»**; espera corpus) |
| **REVOPS** — adquisición y activación | 🟢 `REVOPS-000` · ✅ `REVOPS-001E` · ✅ `REVOPS-001A` | 🟠 `REVOPS-001B` · `001C` · `001D` | 🔵 `REVOPS-002` · `003` | ◇ `REVOPS-004` |
| **Mobile / iOS** | 🟢 **`PLAT-005` EN PRODUCCIÓN, bandera solo en Santa María** (30 ago; validada antes en staging con un iPhone real) · 🟡 `MOB-001` | 🟠 Android de `PLAT-005` y `MOB-002` | — | ◇ `MOB-003` |
| Servicio a clientes | ✅ `SUP-001` | 🟠 `SUP-002` | 🔵 `SUP-003` | ◇ `SUP-004` |
| Onboarding e importación | ✅ **`ONB-003`** — unir columnas (`PRD-V-FEAT-006`) **EN PRODUCCIÓN el 1 sep** (`6548e51`, `build-2026-09-01-019`), validada en staging con ojos · ✅ `ONB-002` en producción | ⏸ Recolectar evidencia real · ⏸ `ONB-001` | — | ◇ `AI-ONB-001` (su parte de IA: **explorada**, aún sin PRD a propósito) |
| **Compartido con Albert** | 🟡 **Retomado el 1 sep** — `DECISIONES-A-006` entregada; esperando el contrato de su endpoint `vivaruWonSignals` | 🟠 La señal de vuelta contra ese endpoint, con la cuenta de servicio | 🔵 Empuje de leads con freno contacto→deal · supresión | ◇ Agenda · mensajería · precio |

> **Esta tabla no tenía fila de «Propiedad horizontal» hasta el 26 de agosto de 2026**, y es el
> frente donde ha ido todo el trabajo desde el 24. El §35 de este mismo documento decía que el
> frente se había abierto; la vista ejecutiva no se enteró. Añadida.
>
> **`FLOW-003` ESTÁ COMPLETO: en producción, cableado, validado y con sus DOS banderas
> encendidas** (27 ago). La cadena de entrega se vio funcionar con números —fila en
> `emailDeliveries` a las 02:16:28 → dos `POST 200` de Svix → `entregado` a las 02:16:34—, y el
> **formulario de Ajustes › Cobranza** quedó construido y validado en pantalla: rangos rechazados
> (día 31, ciclo de 3), guardado, y **la marca de deduplicado del servidor sobrevivió al guardado**,
> que era el riesgo de verdad. `DATO-001` levantó el bloqueo que impedía encender el calendario.
> **No queda nada de la ficha.**
>
> **`FLOW-001` ESTÁ ENCENDIDA desde el 27 de agosto**, y lo que la desbloqueó no fue código: fue
> sembrar los coeficientes que le faltaban. Este párrafo decía «desplegado y APAGADO… no puede
> calcular nada aunque se encienda», y dejó de ser cierto esa madrugada. Ya calcula en
> `tenant-santa-maria` —18 de 18 unidades, 100.000000% exacto—. **En los otros ocho conjuntos sigue
> sin coeficientes** (18 de 93 en toda la producción), y en Santa María **4 de 18** unidades siguen
> sin responsable, así que ahí la corrida se niega **nombrándolas**, que es la conducta correcta.

**Leyenda:** ✅ construido **y desplegado** (18–19 ago 2026; los de propiedad horizontal, entre el
24 y el 26) · 🟢 coste
cero, se puede hoy · ⏳ **caduca: el dato se pierde si llega tarde** · 🔴 prioridad
fundacional · 🟠 siguiente capacidad · 🔵 expansión posterior · 🟡 descubrimiento ·
⏸ bloqueado por datos · ◇ exploración condicionada

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
| **1** | ✅ **COMPLETO** — `REVOPS-001E` · `REVOPS-001A` · `SUP-001` · `FIN-000`, los cuatro en producción | Bajo | El dato no se reconstruye después. **Ya no caduca** |
| **2** | ✅ **COMPLETO** — `FIN-001` en producción (19 ago 2026) | Alto | El trial protege; la conversión no |
| **3** | ✅ **CONSTRUIDO** — cablear el precio, primera mitad de `REVOPS-001C` (19 ago 2026) | Medio | Hace falta al convertir, no al probar |
| **4** | Todo lo demás | — | Espera al primer cliente real. **Sigue sin haberlo: David confirmó el 24 ago 2026 que `Conjunto Bromelias` tampoco es cliente** |

**El horizonte y el nivel no son lo mismo, y conviene no confundirlos.** Una iniciativa
puede estar en `AHORA` por dependencia —está lista para hacerse— y en el **nivel 4** por
orden —no toca todavía—. `CORE-001`, `AI-GOV-001` y `AI-DATA-001` son justo ese caso.
Todo lo que no aparece nombrado en los niveles 0 a 3 es nivel 4.

**De las ocho filas del frente, tres tienen trabajo de ingeniería que hoy signifique
algo:** Fundaciones, Finance y —desde la 0.6— **REVOPS**. (La 0.6 justificaba REVOPS con
«cinco personas vendiendo»; `REVOPS-000` demostró que es **una**. El frente sigue siendo
real —esa persona necesita dónde trabajar y su venta necesita dueño— pero es más pequeño
de lo que este documento decía.) IA, Onboarding, Mobile y Soporte esperan
exactamente lo mismo: un cliente real usando el producto. **No son cuatro bloqueos: es
uno.**

**El nivel 2 esperó a propósito, y la apuesta salió bien.** El trial deja Cartera,
Egresos, Libro y Conciliación en solo lectura, mediante `assertModuleAllowed` en
functions y `previewModuleWritable()` en las reglas: un prospecto en prueba **no podía
alcanzar** las dos rutas de pago divergentes de `FIN-001`. El defecto mordía en la
conversión, no en la prueba — así que los quince días del trial eran una ventana
regalada, y `FIN-001` cupo entera en ella: construida, validada en staging y desplegada
a producción el 19 de agosto, **antes de que hubiera un solo cliente convertido**.

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
| **Dueño comercial** del lead y del conjunto | ✅ **Ya está** | **Dinero de alguien.** En México el canal se lleva $24 de $51. Un conjunto creado sin registrar quién lo vendió no se reatribuye |
| Campos de atribución de marketing | ✅ **Ya está** | Nada — `REVOPS-001A` los captura al entrar al sitio desde el 18 de agosto |
| `firstResponseAt` · `assignedTo` | ✅ **Ya está** | Los tickets anteriores al 18 de agosto siguen sin el dato y nunca lo tendrán; desde esa fecha se sella solo |
| La sombra de PQRS | ✅ **Ya está** | Nada — se armó a tiempo y captura desde el primer ticket real |

**Este eje se vació el 18 de agosto de 2026**, y conviene dejarlo escrito. Nació en la
0.5 con cuatro filas abiertas; hoy las cuatro están cerradas y desplegadas. `FIN-000`
entró aquí por un motivo distinto —no caducaba, estaba **abierto**— y también quedó
resuelto. **La sección se conserva vacía a propósito:** es el recordatorio de qué tipo
de trabajo hay que cazar temprano, no un tablero que se archiva por estar completo. La
próxima vez que aparezca un dato que no se reconstruye, esta es la lista donde va.

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

- **Frente:** Vivaru Finance · **Estado:** ✅ **En producción y validada a mano allí**
  (19 ago 2026, `1e0324a`) · **Nivel 2 cerrado** · **Ficha cerrada**
- **Problema:** las rutas de pago, comprobantes, ledger, vouchers, saldos y reversos
  deben producir un resultado completo o ninguno.
- **Dependencias:** modelo financiero vigente, permisos, reglas transaccionales y
  migración de flujos existentes.
- **Criterio de salida:** un pago aplicado o revertido mantiene consistentes
  obligación, payment, ledger, voucher, expediente y auditoría. **CUMPLIDO ENTERO desde
  el 20 de agosto de 2026**, incluido el voucher — que hasta entonces quedaba fuera y
  era lo único que faltaba. Ver «Lo que cerró la salida de lo fiscal», abajo.
- **El defecto que cerró (17 ago 2026):** había **dos rutas** que aplicaban un pago y
  **producían efectos distintos**. `recordPayment` hacía **cuatro escrituras sueltas sin
  transacción**; `approveReceiptAndRegisterPayment` actualizaba la cuota **y no escribía
  en el libro** — el dinero se movía en cartera y nunca llegaba a la contabilidad. Y las
  dos calculaban el saldo **en el navegador**. Detalle en `docs/roadmap-finance.md`.
- **Qué se construyó:** una callable `applyPayment` y su gemela `revertPayment`, ambas
  transaccionales e idempotentes por clave, con **la aritmética del saldo en el
  servidor**. Las reglas vetan que un cliente escriba un asiento con origen
  `billingStatement`, y `paymentOperations` es del servidor y de nadie más.
- **La decisión de alcance, de David:** *«no será necesario meternos al tema fiscal de
  momento para ninguno de los países»*. El comprobante con secuencial lo sigue emitiendo
  el cliente. Lo único que cambió es **cuándo**: ahora **después** de aplicar el pago, de
  modo que un fallo deja un pago sin comprobante —recuperable— en vez de un comprobante
  fiscal de un pago que no existe.
- **ENDURECIDA el 20 de agosto de 2026: se cae el «de momento».** Vivaru **no maneja
  temas fiscales**, y punto. Con eso **el frente del SRI de Ecuador sale del alcance y
  deja de bloquear el módulo financiero** — que llevaba desde junio marcado «congelado»
  por una dependencia externa que ya no hace falta. Los tres huecos de abajo dejan de ser
  temporales por espera y pasan a ser **permanentes por decisión**. Ver
  `docs/roadmap-finance.md` §5.
- **Lo que cerró la salida de lo fiscal (20 ago 2026).** Dos de los tres huecos que
  esta ficha dejó abiertos **estaban bloqueados por la misma frase** —«cerrarlo exige
  entrar en lo fiscal»—, y esa frase dejó de ser cierta:
  - ~~Un pago podía quedarse sin recibo.~~ **El recibo se emite ahora DENTRO de la
    transacción del pago**, en el servidor. O están los dos o no está ninguno. Con ello
    se retiró el contador de secuenciales, que además serializaba todos los pagos de un
    conjunto sobre un único documento; el recibo lleva un **código no correlativo**
    derivado de su id. **Decisión de David: la numeración correlativa no hace falta.**
  - ~~Revertir no anulaba el comprobante.~~ **Ahora lo anula**, en la transacción que ya
    existía. Se cambió una tarea manual que nadie perseguía —la nota de crédito, que era
    un instrumento fiscal— por una escritura que no se puede olvidar.
  - Y la regla de `paymentVouchers` pasó a `create, update: if false`: **el cliente ya no
    puede fabricar el recibo de un pago que no ocurrió**, que es el reverso exacto del
    hueco que se cerró. Cubierto por cuatro pruebas de reglas contra emulador.
- **Lo que SIGUE abierto, y no tiene que ver con lo fiscal:**
  - **Los asientos anteriores a esta ficha no se pueden revertir** por la vía nueva: no
    guardan su `operationKey`. Hoy no hay ninguno real, así que el costo es cero — pero
    deja de serlo el día que haya un cliente.
- **Validación en staging (18 ago 2026), hecha por David:** cobro de $430.000 sobre la
  cuota `2026-05` de `T2-204`, comprobante `000000001` emitido, y **reversión probada
  también**. En el libro quedaron las dos filas —el pago marcado «Anulado» y su
  «Reverso»— y los totales del período en **cero**, que es la prueba de que las
  agregaciones cuadran. Por la ruta del comprobante del residente, antes el pago **nunca
  llegaba al libro**; ahora sí.
- **Despliegue a producción (19 ago 2026), en tres pasos y con el orden invertido:**
  primero las dos callables —solo esas dos, sin tocar las 67 ya vivas—, después el front
  por rollout de App Hosting, y **al final** las reglas. La regla de esta ficha **quita**
  un permiso que el front anterior usaba en `use-payments.ts`, así que soltarla primero
  habría roto el cobro manual con un «no tienes permiso» hasta terminar el rollout. Antes
  de soltarla se comprobó que el bundle nuevo ya servía, leyendo los chunks de `/login` y
  buscando dentro `applyPayment`.
- **Validada a mano en producción el 19 de agosto de 2026, por David.** El criterio de
  salida queda cumplido en los dos ambientes, y la ficha se cierra.
- **Y la validación encontró un defecto, que es para lo que sirve.** El libro pintaba el
  reverso como `+-$430.000` **en verde**: el signo salía del *tipo* del asiento, y un
  reverso conserva el tipo del que anula llevando monto negativo. **No lo introdujo esta
  ficha** —viene de `72c3083`, de cuando se creó el libro— pero estaba latente porque
  solo se reversaban movimientos manuales. Arreglado en `8df5a4d` con
  `movimientoEntraAlFondo`, incluida la mitad menos evidente: **anular un egreso devuelve
  dinero al fondo**. Era solo presentación; las agregaciones ya sumaban bien, y por eso
  los totales daban cero.
- **El orden se invirtió, y conviene saber por qué.** `CLAUDE.md` dice reglas → functions
  → front, y eso vale cuando la regla **concede**. Ésta **quita**: veta que el cliente
  escriba asientos de pago, que es lo que el front anterior hacía. Se desplegó functions →
  front → reglas. **Generaliza así:** una regla que concede va antes del código que la
  necesita; una que restringe, después del código que dejó de necesitarla.

#### `REVOPS-000` — Instrumentar el canal que ya está corriendo

- **Frente:** REVOPS · **Estado:** ✅ **Su pregunta está contestada** (18 ago 2026) ·
  **Nivel 0** · **No es trabajo de ingeniería**
- **Y la respuesta corrige la premisa que esta ficha traía desde la 0.6.** No son cinco
  personas vendiendo Vivaru. Son **una prospectando y un acercamiento suelto**:

| Persona | Qué hace hoy con Vivaru |
|---|---|
| **Daniel Aguilar** (KAM) | El único prospectando. Lista **fría**, ~6-7 nombres, **nada concreto** |
| **David Almeida** | **Un** acercamiento, por definir a corto plazo |
| **David Martínez** | No vende: acompaña a Daniel y habilita el producto |
| **Jaime** | No — enfocado en otras soluciones de Qintilab |
| **Luis Otero** | No |

- **La función comercial existe, pero está mucho menos dotada de lo que este documento
  afirmaba.** «Cinco personas, tres países» describía el catálogo de quiénes *podrían*
  vender, no de quiénes están vendiendo. El error es del mismo tipo que los otros dos de
  esta semana: se dio por hecho un dato de negocio sin preguntárselo a quien lo sabe.
- **Hay dos embudos y solo uno tiene medidor.** La colección `leads` mide el landing y
  `/registro`. **Un KAM no rellena un formulario web.** Así que lo verificado es que la
  entrada por autoservicio es **cero** —16 días con la máquina pública—; sobre el canal
  asistido **no hay dato de ninguna clase, porque nada lo observa**.
- **La 0.5 leyó «cero leads» como «cero demanda». Era una lectura errónea**, y esta
  ficha existe para corregirla: lo que falta no es demanda demostrada, es **visibilidad
  sobre la que pueda estar habiendo**.
- **Qué sabe el producto de todo esto, comprobado en el código: casi nada.**
  - La palabra «KAM» aparece **una sola vez en el repositorio**, y es una etiqueta de
    log en `src/app/api/lead/route.ts`.
  - **El lead tiene estado pero no tiene dueño.** Recorre
    `nuevo → contactado → calificado → convertido → perdido` sin registrar en ningún
    momento quién lo trabaja, así que «contactado» no dice **quién** contactó.
  - **El aviso va a un buzón compartido**, `comercial@qintilab.com`. Admite lista
    separada por comas, pero **no hay enrutado por país**: puestos los cinco, los cinco
    reciben todo.
  - **El enlace lead → conjunto sí existe** —`createTenantFromLead` escribe el
    `tenantId` de vuelta sobre el lead—. El que falta es el eslabón anterior:
    **KAM → lead**. Y `createdBy` en un conjunto guarda **el superadmin que pulsó el
    botón**, no quién lo vendió.
- **La línea base, por fin escrita (18 ago 2026):** ~6-7 prospectos **en frío** de
  Daniel, **1** acercamiento de David Almeida, **cero** conversaciones maduras y **cero
  firmados**. Nadie ha llegado nunca a «firmó», así que el recorrido posterior a la
  primera conversación **no se puede observar, solo suponer**.
- **Cómo llegan:** mayoritariamente **conocidos**. Se aspira a referidos; la puerta fría
  es lo que hay hoy. El inbound no va ligado a los ejecutivos.
- **Dónde se anota hoy:** un **documento de Word** para consolidar y **WhatsApp** para
  avisar. **Sin institucionalizar.** Es el mejor escenario posible para adoptar una
  herramienta: hay hábito de registrar, falta dónde.
- **Y una regla de negocio que salió de aquí y no la había pedido nadie:** la lista fría
  **no entra al CRM**. En palabras de David, «no queremos que eso radique como un
  compromiso dentro del CRM hasta no tener los datos correctos». Eso **define la puerta
  de entrada al pipeline** — se entra con conversación e interés declarado, no con un
  nombre— y quedó escrito en el PRD de Albert (§5.3).
- **Motivos de pérdida, en sus palabras:** *distanciamiento* (dejan de contestar) y
  *enganche con el proveedor actual* — más barato, sacrificando calidad, y con costo de
  cambio. **Ojo al matiz: eso no es «precio», es costo de cambio**, y conviene contarlos
  por separado.
- **Lo que sigue sin dato:** qué necesita ver un comercial de un conjunto que ya vendió.
  No hay experiencia todavía; se propone una hipótesis en el PRD y se corrige con el
  primer cliente.
- **Criterio de salida: cumplido en su primera mitad.** Existe el recuento escrito por
  persona, y la decisión de dónde se registra a partir de ahora está tomada — Albert,
  con Vivaru como tenant. **Queda abierto** revisar el buzón `comercial@qintilab.com`
  por si hay solicitudes anteriores a la persistencia de leads.

#### `REVOPS-001A` — Atribución del lead y respuesta inmediata

- **Frente:** REVOPS · **Estado:** ✅ **Desplegado en producción** (`9a4d86c`, 18 ago
  2026) · **Nivel 1**
- **Se partió en la 0.5.** Antes cubría atribución **e** instrumentación del embudo; la
  instrumentación bajó a `REVOPS-001D`, porque medir un embudo por el que no pasa nadie
  no mide nada. Aquí quedó lo pequeño y lo irreversible.
- **Absorbe** el antiguo `GROW-001` (atribución y consentimiento).
- **La atribución se captura al ENTRAR, no al enviar el formulario.** Es la decisión
  que sostiene la ficha: quien aterriza en `/?utm_source=…` y navega a `/diagnostico`
  antes de rellenar llega, si se lee al enviar, como «vino de Vivaru» — el referrer ya
  es interno y los `utm_*` desaparecieron de la URL. Primera visita gana, vive en
  `sessionStorage`.
- **Y NO va detrás del consentimiento de cookies, a propósito.** Esa puerta gobierna
  analítica de terceros; esto es el expediente del lead. El dato no sale del navegador
  hasta que la persona envía el formulario autorizando. Detrás de la cookie, quien la
  rechace y luego pida una demo llegaría **sin atribuir** — justo lo que la ficha
  existe para evitar.
- **El consentimiento sale de donde estaba enterrado.** El diagnóstico ya pedía casilla
  expresa; lo que no hacía era guardarla de forma útil —viajaba dentro de
  `meta.respuestas`, sin fecha y sin poder consultarse—. Ahora es campo propio, **con
  la fecha puesta por el servidor** (el reloj del cliente no acredita nada) y la
  versión de la política aceptada. El formulario de demo **no pedía nada**: ahora tiene
  la misma casilla.
- **La respuesta automática al lead ya existía** en las dos rutas — la ficha la pedía
  de más.
- **Asimetría deliberada en el servidor:** sin consentimiento el lead se rechaza con
  400 aunque llamen la API a mano; con la atribución mal formada se ignora y el lead
  entra. Perder de dónde vino es malo; perder el lead es peor.
- **Criterio de salida, cumplido:** todo lead válido queda atribuido, recibe respuesta
  y su autorización queda registrada con fecha y versión. 12 pruebas.

#### `REVOPS-001E` — Propiedad comercial del lead y del conjunto

- **Frente:** REVOPS · **Estado:** ✅ **Desplegado en producción** (`6207fa7`, 18 ago 2026) · **Nivel 1** · **Nace en la 0.6**
- **El problema que cerró:** **nada en el producto registraba de quién es cada lead ni
  quién vendió cada conjunto**. (La 0.6 justificaba esto con «cinco personas vendiendo
  en tres países»; la cifra resultó falsa —ver `REVOPS-000`— pero **el problema no**:
  basta una venta para que la comisión tenga dueño, y ese dato no se reconstruye.) El lead
  tenía estado y no dueño; el conjunto guardaba `createdBy`, que es el superadmin que
  ejecutó la conversión.
- **Lo construido:** colección global `salesReps` (nombre, correo, país, activo,
  referencia en Albert); `ownerId` + `ownerAssignedAt` + `crmRef` en el lead;
  `vendedorId` en el conjunto, estampado al convertir por los **dos** caminos (alta
  directa desde el lead, que lo valida contra el catálogo, y conversión de prueba a
  cliente, precargada con el dueño del lead); página **Comerciales**, columna Dueño y
  referencia CRM en la bandeja de Leads, y vendedor visible en la consola de
  conjuntos. Reglas: `leads` admite update de superadmin —lo que reparó de paso el
  `markTrialAsLost` que fallaba en silencio—, crear y borrar siguen vetados, y el
  catálogo es invisible para los conjuntos. 8 casos de reglas en emulador y CI.
- **Functions desplegadas el 18 de agosto**, así que el selector del alta directa ya
  registra vendedor (`createTenantFromLead` cambió de firma; hasta ese deploy el alta
  funcionaba sin registrarlo). **El enrutado del aviso comercial por país quedó fuera
  a propósito** —
  alcance acordado el 17 de agosto: catálogo, dueño, referencia y selector; sin
  cuentas, sin portal, sin tocar autenticación.
- **Por qué pesa más que `REVOPS-001A`:** los `utm_*` responden «de dónde vino el
  clic», que solo aplica al embudo de autoservicio. Esto responde **«de quién es la
  comisión»**, y aplica al canal que de verdad está operando. En México el canal se
  lleva **$24 de un precio final de $51** — casi la mitad. Un conjunto creado sin ese
  campo **no se reatribuye después**, y lo que se pierde no es una métrica: es dinero
  de una persona concreta.
- **Incluir:** dueño en el lead, vendedor en el conjunto, país del responsable, y
  enrutado del aviso comercial por país en vez de un buzón único para todos.
- **Decidido el 17 de agosto — el catálogo es COLECCIÓN, no enumeración.** David:
  «debería crecer pero no de inmediato». Con cinco personas una enumeración en el
  código sería más simple hoy y una migración mañana; una colección cuesta lo mismo
  ahora y admite el sexto sin desplegar.
- **Decidido el 17 de agosto — los leads de inbound llevan trazabilidad al CRM.**
  Eso resuelve la duda que tenía esta ficha: **la mitad del lead NO sobra**. El lead
  necesita dueño **y** un sitio donde guardar su referencia en el CRM, y ese campo es
  de los que no se rellenan hacia atrás.
- **Y esa pantalla no hay que esperarla: hay que encargarla.** Albert es de Qintilab,
  y la decisión de los socios es **adaptarlo a las reglas de negocio de Vivaru** con
  una vista propia, vía **PRDs que Vivaru redacta y Albert desarrolla**. La pestaña
  global de Leads no está desplegada —siete pestañas, no ocho— y eso **deja de ser un
  bloqueo para ser el primer PRD**. Expediente en `docs/albert-vivaru-integracion.md`.
- **Consecuencia para esta ficha:** lo que definamos aquí —quién es dueño, qué roles
  comerciales existen, qué referencia cruza— **no es solo el esquema de Vivaru: es la
  entrada de ese PRD**. Se define una vez y sirve a los dos lados.
- **Criterio de salida:** cualquier conjunto en producción dice quién lo vendió, y
  cualquier lead dice quién lo está trabajando. **Cumplido de aquí en adelante**: la
  mecánica está desplegada y los cinco comerciales dados de alta el 18 de agosto.
  **Y no hay nada que arreglar hacia atrás**, porque no hay nada atrás: David confirmó
  el 18 de agosto que **ningún conjunto de producción es real** — los nueve son pruebas.
  Así que el primer conjunto que nazca será también el primero con vendedor.
- **Deuda latente, sin urgencia hoy:** `vendedorId` solo se escribe al nacer el conjunto
  y **no existe ruta de edición**. Con cero conjuntos reales eso no duele; en cuanto haya
  uno vendido y estampado con la persona equivocada, sí. Conviene resolverlo antes del
  primer cliente, no después.

#### `FIN-000` — Storage con filtro de rol

- **Frente:** Vivaru Finance · **Estado:** ✅ **Desplegado en producción** (`6207fa7`, 18 ago 2026) · **Nivel 1**
- **El problema que cerró:** `storage.rules` aislaba por conjunto pero **no comprobaba
  el rol**: cualquier miembro —residente o guardia— leía y escribía todos los archivos
  del conjunto. El comentario de la regla decía «admin and superadmin» y la condición
  no lo verificaba.
- **La forma del arreglo:** como las reglas de Storage **suman** permisos, la concesión
  ancha se sustituyó por permiso **carpeta a carpeta** en tres grupos: financieras
  (solo admin), compartidas (publica admin, lee el conjunto) y con dueño. Los
  comprobantes de pago van ahora bajo el **uid** del residente: cada uno sube y lee
  solo el suyo. Una carpeta no declarada nace cerrada. Los roles aceptan los alias
  antiguos aún vivos en tokens (`admin_tenant`, `super_admin`, `security`).
- **Criterio de salida, cumplido:** un residente no puede leer ni escribir documentos
  financieros — 47 casos en emulador (21 fallan con las reglas viejas: la suite
  distingue) y job `rules-tests` en CI.
- **El orden importó de verdad, y quedó demostrado.** Primero el código, después las
  reglas: las nuevas exigen la ruta por usuario, y desplegarlas antes habría roto la
  subida de comprobantes **en silencio**, hasta que un residente intentara pagar. En
  producción las reglas esperaron a que una comprobación por API confirmara que el
  código nuevo se estaba sirviendo; antes se validó en staging subiendo un comprobante
  de verdad.
- **Sin deudas: `support/` también quedó cerrada** (`90dce82`, sesión paralela nacida
  de la anotación de esta ficha): ruta segmentada por autor, callable exigiendo el uid
  de quien llama, y la evidencia vieja plana solo para administración.
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
- **Evidencia (corregida el 18 ago 2026):** producción tiene 9 conjuntos y **ninguno es
  real**. Siete están marcados `isExample` y los otros dos también son pruebas —lo
  confirmó David—, así que la lectura anterior («los dos reales tienen 0 tickets») era
  optimista de más: no es que los clientes reales no generen tickets, es que **no hay
  clientes**. La sombra está armada y acumulando cero, y seguirá así hasta el nivel 0.

#### `SUP-001` — Operación básica de soporte

- **Frente:** Servicio a clientes · **Estado:** ✅ **Desplegado en producción**
  (`f9ed734`, 18 ago 2026) · **Nivel 1**
- **El contador de pendientes ya existía** —se calculaba y se pintaba en rojo en
  Superadmin—, así que la ficha se redujo a dos campos, no tres.
- **Dos reglas de idempotencia, extraídas a una función pura** (`marcasSup001`) porque
  son la parte que, si se equivoca, destruye un dato irrecuperable: `firstResponseAt`
  se escribe **una sola vez** —sobrescribirlo en cada respuesta haría que la métrica
  marcara el último mensaje y todos los tickets parecieran contestados al instante— y
  la asignación automática **no roba tickets**: si ya hay responsable no se toca.
- **Un cambio de estado no cuenta como respuesta.** Marcar «en proceso» sin escribirle
  al cliente no es haber respondido, y que el cliente conteste tampoco lo es.
- **Quien contesta primero se queda el ticket** si no tenía dueño, más «asignármelo» y
  «quitar» en Superadmin. Sin la asignación automática, «cada ticket tiene
  responsable» dependería de que alguien recuerde pulsar un botón.
- **Sin relleno hacia atrás, y la consola lo dice.** Los tickets anteriores no tienen
  el dato y nunca lo tendrán: sale de un instante que ya pasó. Se distinguen tres
  estados —contestado en X horas, **sin responder** en rojo, y un guion para «anterior
  a la métrica»—, porque confundir los dos últimos haría parecer desatendido lo que se
  contestó hace meses.
- **Criterio de salida, cumplido:** cada ticket nuevo tiene responsable y primera
  respuesta medible, visibles desde Superadmin. 19 pruebas (11 app + 8 functions).

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
- **SUPERADA EN PARTE el 29 ago 2026 por `PRD-V-PLAT-005`:** manifest, service worker
  y push web existen y están **validados en staging con un iPhone real** — el aviso
  que nace en `notifications` llega al hub del teléfono. `registerWebPush` tiene por
  fin su consumidor. Lo que sigue vigente de esta evidencia: la medición de uso por
  dispositivo y la auditoría responsive.

#### `UX-003` — El Panel de Control dice cosas que se pueden comprobar

- **Frente:** Experiencia y diseño · **Estado:** 🟢 **TRES entregas en producción** (`6738571`,
  `5bc9d3f`, `cb6d457`, 28 ago 2026, un rollout cada una) · **Nivel 2**
- **Problema:** la primera pantalla que ve todo el mundo afirmaba cosas que no cuadraban con sus
  propios módulos — la píldora decía **90** con las tarjetas sumando 33 y el cajón listando 4.
- **Qué cerró:** las alertas se construyen **una vez** y la píldora cuenta esa lista; la escala de
  color vive en `src/lib/dashboard/umbrales.ts` y la usan la página y el widget; y diez claves de
  estado dejaron de salir en inglés, con un guardián que **mide el código, no una lista**.
- **Criterio de salida:** ningún número del panel contradice al módulo que lo respalda.
  **CUMPLIDO EN PARTE** — ver `UX-004`, que continúa por los que quedaron.

#### `UX-004` — El panel y sus módulos, midiendo lo mismo

- **Frente:** Experiencia y diseño · **Estado:** 🔴 Lista para desarrollo (`PRD-V-FIX-003`,
  30 ago 2026) · **Nivel 2** · **Dependencia:** ninguna
- **Problema, medido contra `hogaru-1` el 30 de agosto:** el «% recaudo» del Panel de Control mide
  **un mes** y el de Cartera mide **hasta doce períodos**, con el mismo rótulo y sin declarar
  ninguno cuál. **Divergen en los siete conjuntos de producción**: Palmas y Nogal dicen `0,0%` en
  el panel y `50,0%` en cartera; Las Playas dice `100,0%` y `76,6%`.
- **Y el caso que convierte la diferencia en una afirmación falsa:** el panel **no distingue «0%
  porque nadie pagó» de «0% porque no hay nada que cobrar»**, y pinta el segundo en rojo. Hoy son
  **cuatro de los siete conjuntos**. La lección estaba aprendida y escrita: la función vecina en el
  mismo fichero (`colorPorPorcentaje`) ya devuelve neutro sin datos y explica por qué.
- **Lo que NO es, y diagnosticarlo mal habría costado caro:** no es aritmética duplicada. Las
  fórmulas ya están unificadas en `src/features/billing/collection.ts` y las usan los dos lados.
  **Es la ventana y el rótulo.**
- **Sin decisiones abiertas.** La única —cómo llamar a `other`, «Otros» en el widget de antigüedad
  contra «General» en el módulo de PQRS— **la cerró David el 30 de agosto: «General»**, que es lo
  que ya dicen los otros dos sitios, así que el cambio toca uno solo.
- **Criterio de salida:** dos indicadores con el mismo nombre, en pantallas distintas, **coinciden
  o declaran su ventana**; y un porcentaje sin nada que medir no se pinta con el color de «mal».

> **`UX-001` y `UX-002` no tienen ficha en este inventario**, y se dice en vez de inventarles una:
> nacieron en el catálogo de Notion el 27 de agosto de 2026 y aquí solo aparecen en la tabla
> ejecutiva y en el changelog. Lo que consta: `UX-001` está **cerrado y en producción**, y `UX-002`
> —filtros en la URL— está **aplazada esperando clientes**. Su detalle vive en el inventario de
> Notion.

### SIGUIENTE

#### `PH-001` — Propiedad horizontal: el lote derivado de Habitanto

- **Estado:** 🟢 **Ola A y ola B EN PRODUCCIÓN, con las banderas apagadas** (24 ago 2026).
  Siete de las nueve viven en `master`: `formatAmount`, `PLAT-002` entrega 1, `FIX-001`
  entrega 1, `PLAT-001`, `FEAT-003`, `PLAT-003` y `FLOW-002`. **Queda `FLOW-001` de la ola B
  y la ola C entera.** · **Frente:** Producto · **Dependencia:** ninguna externa
- **Origen:** inventario de Habitanto en cinco pasadas (`docs/inventario-habitanto.md`) y
  contraste contra nuestro código, no contra nuestros documentos. De ahí salieron **108
  candidatos** priorizados (`docs/prd/candidatos-prd-desde-habitanto.md`), y de esos, **once
  PRD**: nueve escritas y **dos en espera de disparador**.
- **Por qué ahora y no después:** cinco de las nueve tocan **modelo de datos**. Cambiar cómo se
  calcula una cuota cuando ya haya dos años de cargos emitidos no es una funcionalidad, es una
  migración. **Cero clientes reales es la ventana, y se cierra sola.**
- **El orden importa más que cualquiera de ellas por separado.** Está en
  `docs/prd/README.md § Orden de construcción`. Tres razones:
  - `PLAT-002` (auditoría de once callables) va **sola y primero**: es el único cambio del lote
    que **no se revierte con una bandera**.
  - `PLAT-003` va **antes** que `FLOW-002`: **las dos modifican `aplicarPago`, que está en
    producción y mueve dinero**, y no pueden estar en vuelo a la vez. **Y dentro de
    `PLAT-003` hay una segunda secuencia, descubierta al construir:** la corrección de la
    exclusión del libro (1b-i, ya en staging) va **antes o a la vez** que la escritura de la
    cuenta del concepto (1b-ii) — **nunca después**, porque eso es desplegar un doble conteo.
  - Antes de todo, corregir `formatAmount`: hoy formatea con **cero decimales para las tres
    monedas**, así que una expensa de `140,40` se muestra como `140` en Ecuador, Panamá y México.

##### Lo que el lote corrige, medido en el código

| Defecto | Dónde | PRD |
|---|---|---|
| **El sobrepago se evapora**: se contabiliza como ingreso y no deja saldo a favor | `functions/src/payments.ts` — `calcularSaldo` | `FLOW-002` **v1.2, lista** |
| **El concepto del cargo nunca llega al libro**: una multa o una extraordinaria se contabilizan como cuota de administración | `payments.ts:266` y `:578` — `category: "alicuota"` fijo | `PLAT-003` **1b-ii** (la 1b-i, que prepara el libro para recibirlo, ya está en staging) |
| **Las reglas de reserva se comprueban solo en el cliente**: 6 de 13 en servidor | `eligibility.ts` + `firestore.rules:558` | `FIX-001` |
| **El pago no registra a qué cuenta bancaria entró** | `payments.ts` — `bankAccountId: null` en **`aplicarPago` Y en `revertirPago`**: son **dos**, y la PRD nombraba uno | `FLOW-002` |
| ~~**El correo sale sin webhook**: cero entrega, rebotes y quejas~~ — **CERRADO** el 27 ago 2026: `emailDeliveries` + `resendWebhook` en producción y validados de punta a punta | `functions/src/email.ts` · `functions/src/email-webhook.ts` | `FLOW-003` ✅ |
| **Se cobra el mismo importe a todas las unidades** | `BillingCampaign.unitAmount` | `PLAT-001` |
| **El proveedor no existe como entidad**: se teclea en cada egreso | `Expense.vendorName` | `FEAT-003` |

##### Lo que la revisión cruzada anuló

Leer el código antes de escribir **anuló dos huecos** que el inventario daba por buenos: la
**compuerta de morosos en reservas** y la **bandeja de notificaciones en producto** **ya
existen**. Y dejó un hallazgo de portafolio: **el rol `committee` solo alcanza
`/admin/documents`**, así que lo que ocho PRD le asignan es intención declarada, no capacidad
— candidato a `PRD-V-PLAT-004`.

- **Criterio de salida:** las nueve construidas en el orden declarado, con la primera entrega de
  `FIX-001` desplegada sola y verificada **escribiendo contra la base**, no desde la interfaz.
- **Vocabulario por país (22 ago 2026), a petición de David.** El producto hablaba
  ecuatoriano-colombiano en pantallas que ve México: el porcentaje de la unidad es
  **coeficiente de copropiedad** en Colombia, **alícuota** en Ecuador e **indiviso** en
  México, y son las palabras de sus respectivas leyes, no sinónimos de estilo. **El término
  sigue al conjunto, no al usuario** —la palabra es del inmueble— y eso deja de ser
  hipótesis con `PLAT-002`. Vive en `src/lib/config/vocabulario-pais.ts`. **Los tres términos
  quedaron confirmados el 22 de agosto**: Ecuador contra el inventario de Habitanto, y
  México y Colombia por David. Y con México llegó el matiz que faltaba: **el término legal
  es el del administrador, no el del residente** —el condómino rara vez dice «indiviso»,
  habla de la cuota—, así que en el estado de cuenta se encabeza con la consecuencia y la
  palabra se ofrece en la ayuda. **El porcentaje además manda sobre el peso del voto en
  asamblea**, no solo sobre lo que se paga. Y apareció que **un tercer caso no era
  vocabulario sino modelo de datos**: en México la cuenta de un proveedor se identifica por
  **CLABE de 18 dígitos**, no por número y tipo. Se hizo ahora porque la jerga estaba en 4
  archivos y `vendors` tenía cero documentos: mañana sería una migración.
- **Avance al 24 de agosto de 2026: el lote está EN PRODUCCIÓN y ENCENDIDO.** Esta viñeta ha
  tenido que corregirse **dos veces en su sitio**, y las dos por lo mismo: apilar una
  actualización debajo dejaría dos épocas conviviendo. Decía «en producción no se ha desplegado
  nada», que quedó falso el 23 de agosto; y después «EN PRODUCCIÓN y APAGADO», que quedó falso al
  encender el lote. Ola A entró el 23 (`5d6df95`) y `FLOW-002` el 24.
  **Las seis banderas están encendidas GLOBALMENTE en los nueve conjuntos y sin overrides** — el
  de `conjunto-las-playas` se retiró al poner la global, y el orden importó: primero la global,
  después quitar el override, porque **el override manda sobre la global**. Se resolvió
  ejecutando `isFeatureEnabled()` con el código compilado del servidor, no leyendo documentos: la
  precedencia no se lee de un campo. `producto-reservas-servidor` sigue apagada, que es el frente
  3 y no es un interruptor.
  **De la ola B queda `FLOW-001`** (necesita `PLAT-001`, que ya está). Ola C después: `FEAT-004`,
  `FLOW-003`, y las segundas entregas de `PLAT-002` y `FIX-001`.
  **Lo siguiente de este frente vuelve a ser construir**: encender ya está hecho. La regla de
  orden sobre `aplicarPago` no aplica porque no queda nada en vuelo sobre ella.

#### `PH-003` — Autorizar la visita que llega sin avisar

- **Frente:** Propiedad horizontal · **Estado: EN PRODUCCIÓN, `CA3` y `CA10` verificados con ojos**
  (1 sep 2026); queda `CA4`, que pide dos personas · **Nivel 3**
- **Problema:** hoy **toda visita nace de la mano del residente**, por QR emitido de antemano. La
  visita que se presenta en portería sin avisar no tiene camino, y es la mayoría de las visitas
  reales de un conjunto.
- **Las dos vías que pide David, y son distintas a propósito:**
  **(A)** portería captura los datos y **manda al residente una petición de autorización** que él
  acepta o rechaza; **(B)** portería captura los datos, **llama por teléfono fuera de la
  plataforma** y, con el sí del residente, autoriza ella misma.
- **Decisiones ya tomadas (30 ago 2026):** vale **el primero que conteste** de la unidad · la vía A
  espera **5 minutos** · **la vía B no espera nada** · y **queda constancia de quién autorizó y por
  qué medio** — que es lo que distingue las dos vías cuando alguien reclame.
- **Lo que ya existe y hay que aprovechar:** la variante `registro_simple` trae captura, callable
  con permisos de guardia, auditoría y aviso al residente. **Pero no autoriza: consuma.** Crea la
  visita con `status: "inside"` y la hora de entrada puesta, y el residente recibe un hecho
  consumado, sin rastro de que nadie autorizara.
- **La decisión estructural, tomada:** la visita repentina **convive con el QR**. Hoy el servidor
  rechaza el registro de portería si el conjunto está en `qr_full`, y **los diecisiete conjuntos de
  los dos ambientes lo están** — con la exclusividad actual, esto no lo vería nadie.
- **Lo que abarata el frente:** **cero visitas registradas por portería** en toda la historia de
  producción y staging (87 y 55 pases, todos de residente). No se rompe un flujo en uso: se estrena.
- **Dependencia real:** el push de `PLAT-005`. Sin él la petición de la vía A cae en una campana que
  nadie mira, y el guardia se queda con el visitante en la puerta.
- **Criterio de salida:** una visita no anunciada entra con autorización trazable — del residente o
  del guardia declarando el medio— y el residente la ve en su portal.
- **Estado real (1 sep 2026): EN PRODUCCIÓN con el ciclo validado por las TRES miradas.** El
  guardia recorrió el ciclo entero el 31; el 1 de septiembre **`CA3` se verificó con dos sesiones
  reales a la vez** —el residente autorizó en 26 segundos y quedó `authorizationMedium: "app"` con
  su uid— y **`CA10` resultó estar SIN CONSTRUIR**: la visita desaparecía del portal del residente
  al resolverse. Se construyó el mismo día (historial «Visitas registradas en portería», lógica
  pura con banco en `src/features/visitors/historial-de-porteria.ts`, mismo vocabulario que la
  portería, cero índices y cero reglas nuevos) y se verificó con dos residentes distintos.
- **Lo único abierto es `CA4`** (dos residentes contestan a la vez): **la fixture ya existe**
  —Carolina Prueba, segunda residente de APARTAMENTO 201, con cuenta operativa— y la prueba pide
  **dos personas y dos dispositivos**, no más código. Receta en `docs/pendientes.md`.
- **La expiración se deriva del sello de tiempo, no de un cron**: un `pendiente` de hace una hora
  *es* `expirada` sin que nadie haya corrido nada, así que no hay estados atascados.

#### `PH-002` — Lo que espera al primer pago real

- **Estado:** Especificado a nivel de alcance, **sin PRD escrita a propósito**
- **Disparador:** el primer mes de un conjunto con **pagos reales**. Hoy son cero.
- **Incluye:** **cierre de conciliación** —depósitos en tránsito, cheques girados y no cobrados,
  resumen de saldos— y **interés de mora calculado**, que **no lo tiene ninguna de las dos
  plataformas**: es ventaja que ganar, no que copiar.
- **Por qué no se escribe todavía:** el cierre solo tiene sentido con movimientos que cuadrar, y
  el recargo no se puede calibrar sin cartera real. **Contesta la pregunta abierta de `FIN-002`:
  no, todavía no.**

#### `FIN-002` — Expediente y conciliación determinística

> **CERRADA Y EN PRODUCCIÓN el 29 de agosto de 2026.** Entregada entera en cinco días desde que se
> abrió: expediente con estados versionados, coherencia de los emparejamientos, candidatos con
> reglas explicadas, duplicados por clave natural, bandeja con motivos, cascada al revertir, reglas
> y relleno. Ficha: [`PRD-V-FLOW-004`](prd/funcionales/PRD-V-FLOW-004-expediente-de-conciliacion.md).
>
> **Lo que encontró, y es el motivo por el que valía la pena:** de los **19 emparejamientos** que
> había en producción, **uno era falso** —una salida de banco de −300.000 casada contra una entrada
> de +40.000, escrita el 20 de agosto— y el producto lo contaba como bueno. La pantalla ofrecía
> **todos** los asientos sin conciliar ordenados por cercanía de monto y no comprobaba nada. **Hoy
> sale nombrado**: «el banco y el libro van en sentidos contrarios · los importes no coinciden · se
> llevan más de 3 días», y el total de conciliadas dejó de incluirlo.
>
> **Y lo que enseñó sobre medir:** las reglas no se eligieron, se sacaron de los datos. La
> coherencia de efecto da coherentes **18 de los 19** pares y aísla el falso; la ventana de ±3 días
> sale de que el mayor desfase real entre pares buenos es **1**; y la clave de duplicado lleva la
> descripción dentro porque sin ella **20 líneas legítimas** salían marcadas como repetidas.
> **Ninguna de las 8 líneas pendientes tenía candidato único**, así que proponer «el más parecido»
> habría acertado cero veces.

- **Estado:** **EN PRODUCCIÓN** (`02a9642`…`e65210e`, 29 ago 2026), con la bandera encendida **solo
  en `tenant-santa-maria`** y el relleno corrido —27 casos, uno por línea—. **No se marca
  productiva**: `G5` sigue abierta porque **nadie concilia a diario**, y eso lo cierra un cliente,
  no código.
- **Dependencia:** `FIN-001`, cumplida desde el 20 de agosto.
- **Lo que NO entró, por decisión escrita:** el **cierre por fecha de corte** —depósitos en
  tránsito, cheques no cobrados, resumen de saldos— es `PH-002`. A Fase 2 van el discriminante
  automático por código de unidad, una línea contra varios asientos y los motivos configurables.
- **Tres cosas que costaron y conviene no redescubrir:** el orden de despliegue **se invirtió**
  (functions → front → reglas), porque la regla restringe lo que la pantalla hacía; **dos defectos
  aparecieron solo mirando la pantalla** con las suites en verde, y uno de ellos **solo con la
  bandera en el estado contrario al que se probó**; y una falsación escrita en la ficha **no falsaba
  lo que decía** —el par falso lo rechazaban tres reglas, no una—.

#### `AI-PQRS-001` — Piloto visible del asistente de PQRS

- **Estado:** Parcial
- **Dependencias:** despliegue verificado, tenant piloto, retención resuelta, volumen
  real y criterios de G7.
- **Límite:** la IA sugiere; la persona decide. No ejecuta acciones sensibles.
- **Evidencia (17 ago 2026):** construido y medido contra un gold set de 152 casos.
  ~~Su bandera está apagada en producción y su callable no está desplegada ahí.~~
- **CORREGIDO el 30 de agosto de 2026, midiendo: las dos mitades eran falsas.** `aiInvoke`,
  `sombraPqrsAlCrearTicket` y `sombraPqrsAlActualizarTicket` están **`ACTIVE` en `hogaru-1`**, y de
  las dos banderas de PQRS **`ai-pqrs-shadow` lleva encendida desde el 17 de agosto** — solo
  `ai-pqrs-suggestions` sigue apagada. **Lo que falta no es despliegue: es tráfico.** El último
  ticket de producción es del **7 de agosto**, diez días *antes* de encender la sombra, y
  `aiUsage` y `aiAssistance` siguen en **0**. Plan de encendido: `docs/encender-la-ia.md`.

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

- **Frente:** REVOPS · **Estado:** 🟡 **Primera mitad CONSTRUIDA** (19 ago 2026,
  `c4f96a0` + `311ee1c`) · **Nivel 3**. La tarifa de la guía es código y el conjunto ya
  guarda su país. **Es tarifa de REFERENCIA para cotizar, NO el precio de un conjunto**:
  a cada conjunto vendido se le aplican reglas propias, y ese dato todavía no existe en
  el producto — entra con el módulo financiero. Falta la segunda mitad: **enterarse de
  que un deal se ganó — y eso ya NO depende de que Albert construya nada.**
  `RESPUESTA-A-001` C1 (19 ago) lo cerró: siendo tenant, Vivaru se suscribe en vivo
  (`onSnapshot`) a `tenants/vivaru/deals`, porque sus reglas conceden lectura a todos
  los roles del tenant. Lo único que falta es el **alta del tenant (A5)**, que espera el
  correo del `tenant_admin`
- **Depende de dos cosas.** La primera es **cablear el precio al producto**: la
  decisión comercial existe desde el 12 de agosto de 2026 en la guía maestra
  —ver «El precio» más abajo— pero `plans` está vacía y los `planId` de producción no
  corresponden a la segmentación comercial. Es cableado, no decisión. **La segunda ya no
  es dependencia de Albert:** este documento decía «la señal de vuelta desde Albert, que
  no tiene webhooks», y quedó obsoleto el 19 de agosto al hacernos tenant suyo.
  Corregido el 20. Lo que queda es **el alta del tenant (A5)**, que es operación y no
  desarrollo, y espera el correo del `tenant_admin`.
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

#### `ONB-002` — Un padrón sin duplicados

- **Frente:** Onboarding e importación · **Estado:** 🔴 **`PRD-V-FEAT-005` escrita y lista para
  desarrollo** (30 ago 2026) · **Dependencia:** ninguna
- **Salió de `AI-ONB-001`, era su parte (b), y al medirla dejó de necesitar IA.** Por eso tiene
  ficha funcional y código propio: **no espera corpus ni cliente**, se puede construir mañana.
- **Problema medido en producción:** **11 de 68 personas están duplicadas**, en 3 grupos —«David
  Carmona» ×7, en dos unidades, con dos documentos y el mismo correo en los siete—, y **21 de 68
  no tienen documento**, que es uno de los dos campos con los que se deduplica.
- **Por qué existen, que es lo que decide el alcance:** **no entraron por el importador**, que sí
  deduplica. Entraron por otros caminos y **ninguna puerta mira hacia atrás**. Blindar el alta no
  limpia la casa.
- **El riesgo está calibrado con un precedente de este repositorio:** `mergeUnits` prometía «TODAS
  las referencias» con una lista de **nueve escrita a mano, y eran dieciocho** — eso explica los
  huérfanos de `tenant-santa-maria`. El inventario de referencias a persona **se deriva y lleva
  guardián**, y hay un caso que **falsa el guardián**, no la fusión.
- **Criterio de salida:** el administrador ve los grupos sospechosos con lo que cuelga de cada uno,
  y los resuelve —fusionar, corregir o descartar con motivo— sin dejar una sola referencia huérfana.

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

#### `AI-ONB-001` — Cargar el padrón desde lo que el cliente ya tiene

- **Frente:** IA y agentes · Onboarding e importación · **Estado: EXPLORADA (1 sep 2026), sigue
  sin PRD a propósito** — la premisa aguantó: sin corpus no hay ficha. Pero la exploración
  **reencuadró qué ficha será** (ver abajo)
- **Se llamaba «Mapeo asistido de columnas» y el alcance cambió**, también por decisión de David
  del 30 de agosto: **«cualquier formato» incluye PDF y fotos**, no solo hojas de cálculo. Eso
  contradice a `docs/hoja-de-ruta-ia.md`, que argumentaba lo contrario y lo dejó escrito. **La
  contradicción se registra, no se resuelve en silencio** — ver la anotación en esa hoja.
- **Lo que YA existe sin IA, y hay que decirlo antes de comprar nada:** los dos asistentes de
  importación (`UnitBulkImportWizard`, `ResidentBulkImportWizard`) aceptan **CSV y XLSX**, **ya no
  exigen los encabezados de la plantilla**, mapean por sinónimos, miran el **contenido** de una
  columna cuando su encabezado no dice nada, y descartan duplicados por correo o documento.
- **La bandera `ai-onboarding-column-mapping` no hace nada.** Medido el 30 de agosto: **cero
  referencias en el código** fuera del catálogo. Encenderla —como se hizo en staging ese día— es
  inerte. Es la tercera forma de «una bandera no siempre es el freno»: no hay código detrás.
- **Son TRES capacidades y conviene no meterlas en una PRD:**
  **(a)** entender el archivo que trae el cliente → `PRD-VAI-FEAT-001`, ya reservada y hoy en Drive
  sin versionar; **(b)** **auditar el padrón ya cargado** y proponer grupos de duplicados;
  **(c)** resolverlos —fusionar, corregir, borrar— a mano.
- **(b) y (c) SALIERON DE AQUÍ y son ya `ONB-002`, con [`PRD-V-FEAT-005`](../prd/funcionales/PRD-V-FEAT-005-un-padron-sin-duplicados.md) escrita**,
  escrita el 30 de agosto. **Es funcional, no de IA**, y **no depende del corpus**, así que se puede
  construir mañana. (a) sigue sin escribirse porque **hoy no pasaría sus propias puertas**: sin
  archivos reales no hay con qué evaluar ni con qué estimar coste.
- **Y el dato que decide el coste de (b):** esa auditoría **se hizo sin IA, en un script de treinta
  líneas, y encontró los once duplicados de producción** — «David Carmona» ×7 en dos unidades, con
  **dos documentos distintos y el mismo correo en los siete**; más 21 de 68 personas sin documento,
  que es uno de los dos campos con los que se deduplica. **Empezar por lo determinista hace la parte
  de IA falsable:** se puede medir si el modelo encuentra algo que el script no.
- **LA EXPLORACIÓN DEL 1 DE SEPTIEMBRE, medida ejecutando el mapeador real contra ocho formatos
  plausibles (sonda sintética, NO corpus):** el determinístico **casi no falla en «elegir
  columnas»** —«Mail», «Calidad», «No. Depto», «Clase»/«Situación» los resuelve solo—. Lo que
  falla son **cuatro clases**: (1) **el LECTOR** —una fila de título encima de los encabezados los
  convierte en datos y el mapeo sugiere disparates; y PDF/fotos ni entran—; (2) **transformaciones
  que el contrato columna→campo 1:1 no puede expresar** —nombre partido en Nombres+Apellidos (se
  pierden los apellidos EN SILENCIO), Torre+Apto separados, el padrón mixto estilo Habitanto con
  sugerencia equivocada en silencio, y el rol codificado en QUÉ columna está llena—; (3)
  **vocabulario de VALORES, que es producto y no IA** —`parqueadero`/`bodega` no existen como tipo
  de unidad y BLOQUEAN el archivo entero—; (4) **huecos baratos del catálogo, de una tarde y sin
  IA** —`person.unitLabel` sin `cardinality`, alias `apto`/`inmueble` ausentes—.
- **La implicación que reencuadra la ficha:** el enganche previsto («el mapeo asistido decide qué
  columna alimenta qué campo») asiste justo lo que ya casi no falla. **La ficha, cuando toque, es
  de transformaciones y formatos** —partir/unir/pivotar, detectar encabezados, PDF/foto → tabla
  intermedia—, no de elección de columnas. Detalle en la cabecera de `docs/pendientes.md`.
- **Precondición que sigue en pie:** hacen falta **15–25 archivos de importación reales** para
  evaluar la parte de IA, y hoy no se guarda ninguno. Eso no lo desbloquea escribir código. **Y ya
  se sabe qué pedir:** archivos con fila de título, padrones mixtos unidad+persona, nombres
  partidos, y los PDF/fotos tal como lleguen — esas clases deciden si la IA paga su coste.
- **Criterio de salida:** un conjunto nuevo carga unidades y residentes desde el archivo que tenga,
  y el administrador ve y resuelve los duplicados antes de que ensucien el padrón.

#### `UX-005` — Tableros del panel a la medida del administrador

- **Frente:** Experiencia y diseño · **Estado:** Exploración (30 ago 2026) · **Prioridad baja,
  declarada por David**
- **Problema:** los cinco tableros del Panel de Control están **cableados en el código en orden
  fijo**. No hay reordenar, ni ocultar, ni preferencia guardada. Un administrador que solo opera
  cartera ve lo mismo que uno que solo opera portería.
- **Por qué va DESPUÉS de `UX-004`, y no es una cuestión de gusto:** personalizar un panel cuyos
  números todavía no cuadran con sus módulos es cambiar los muebles de sitio en una casa con la
  instalación eléctrica mal. Primero que digan la verdad; luego, quién los ve.
- **Siguiente decisión:** si la preferencia es por usuario o por conjunto — cambia el modelo de
  datos y quién puede pisar la vista de quién.

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

- ~~**La colección `plans` de producción tiene 0 documentos** y no hay ninguna cifra de
  precio en el código.~~ **Los 0 documentos se confirmaron leyendo producción el 19 de
  agosto de 2026** —hasta entonces era una afirmación sin comprobar—. Y **las cifras ya
  están en el código** desde esa fecha: `src/lib/pricing/catalog.ts`.
- **Los `planId` en uso no corresponden a la segmentación comercial:** producción usa
  `starter`, `plus`, `premium` y `trial`; la guía segmenta por Emergente, Core y
  Enterprise. **Son dos vocabularios para lo mismo** y hay que reconciliarlos —
  preferiblemente antes de vender, porque después habría que migrar conjuntos que ya
  están cobrando.

### Discrepancia por resolver

> ✅ **RESUELTA el 19 de agosto de 2026: manda la guía maestra**, por ser posterior y
> declararse consolidada. Decisión de David. Cableada en `src/lib/pricing/catalog.ts`.

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
| **Agenda de demos** | No. Su landing agenda con formulario — **confirmado por ellos** (`RESPUESTA-A-001`, D1) | No |
| **Motor de mensajería** con consentimiento, supresión y frecuencia | No. Solo plantillas con merge fields — **confirmado por ellos** | No |
| **Precio de plan** | Planes con límites **informativos que no se aplican**, sin precio — **confirmado por ellos** | **HECHO y en producción** desde el 20 de agosto. Deja de ser carencia compartida |

Los tres son prerrequisitos del circuito comercial de **ambos productos**. Construirlos
una vez y compartirlos es, en mi opinión, mejor argumento a favor de integrar que
reutilizar el pipeline — porque el pipeline se puede sustituir con una hoja de cálculo
durante meses, y esto no.

**Decisión pendiente:** dónde viven. Detalle en `docs/albert-vivaru-integracion.md`.

**Y desde el 19 de agosto la decisión es más urgente, no menos.** Albert confirmó las
tres y añadió lo que faltaba saber: **no están en un roadmap comprometido suyo**. Se
ofrecen a llevarlas a priorización y a decir que no si sale que no —«para que no la
escribáis esperándonos», textual—. Así que esto deja de ser «esperar a ver» y pasa a
ser una decisión de Vivaru: construirlas, compartirlas o vivir sin ellas.

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

> ✅ **Recogida como nivel 0**, y **confirmada por `REVOPS-000` el 18 de agosto** — más de lo que su autor creía. La 0.6 le enmendó la plana diciendo que sí había gente poseyendo el canal, cinco personas; al preguntarles resultó que **es una prospectando en frío y un acercamiento suelto**, con cero firmados. Así que «no lo posee nadie» estaba **más cerca de la verdad que la corrección que se le hizo**. Lo que sigue en pie de la 0.6 es lo otro: la colección `leads` solo mide el landing, y el canal asistido es invisible para el producto — el tablero sabe medir, calificar, convertir y retener el embudo de autoservicio, y **es ciego al que de verdad está operando**.

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
6. ~~¿Cuál será la fuente comercial canónica: Firestore, CRM u otra?~~ **Resuelta el
   18 ago 2026:** Albert, con **Vivaru como tenant**. Vivaru sigue siendo dueño del
   producto —conjunto, prueba, activación, atribución, consentimiento—; Albert del
   pipeline comercial. Ver `docs/prd/albert/`.
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

### 0.9.49 — 2 de septiembre de 2026 — los cinco cabos, y la puerta del alta que no era

- **Los cinco cabos sueltos, cerrados en un commit (`484e16a`) y falsados por edición.** Un
  comunicado sin vigencia mandaba `startsAt: undefined` y Firestore rechazaba el documento entero
  (no se podía crear un comunicado sin fechas; visto arreglado en staging); `email.ts` llevaba la
  base de producción clavada y los correos de staging enlazaban a producción (ahora decide
  `enlaceAbsoluto`, el gemelo de `push.ts`; **27 functions** desplegadas a staging, cerradas
  siguiendo el código); la prueba `CF3` de migración dependía de una credencial viva (el informe
  inexistente se rechaza antes de tocar la red); `push-tokens.rules.test.ts` enrojecía `npm test`
  sin emulador (excluido con sus hermanas: **por primera vez el banco sale en verde sin emulador**,
  1560); y Cartera reconstruía el facturado sin el anticipo (una sola fórmula, `statementChargedAmount`,
  con guardián que barre `src/`; medido antes: 0 cobros con anticipo, las dos fórmulas coinciden).
- **`PRD-V-PLAT-006` — Buzones reales en conjuntos sin cliente: la puerta**, en Discovery. Es la
  «fase 2» de `DATO-001`, y **medirla antes de escribirla la cambió**: `isExample` lo llevan los
  nueve conjuntos de producción **incluidos los dos del trial**, cuyo administrador se registra con
  su correo real, así que «rechazar buzones reales en conjuntos `isExample`» rechazaría a cualquier
  prospecto. Además `DATO-001` limpió siete por su forma y **dejó once** (dos conjuntos demo,
  mayo–junio, ninguna con correo recibido), y el equipo valida con buzones reales dentro de esos
  conjuntos. Tres decisiones (qué marca al conjunto, qué se admite, entrada o salida) con
  recomendación; construido solo el barrido en seco que lo mide.

### 0.9.48 — 1 de septiembre de 2026 (noche)

- **`ONB-003` — unir columnas (`PRD-V-FEAT-006`) EN PRODUCCIÓN** (`24b9741` código, `6548e51` en
  `master`, `build-2026-09-01-019` medido por `traffic.current`). Construida, falsada con siete
  mutaciones y validada con ojos en staging y en producción el mismo día. `registrarImportacion`
  acepta `camposUnidos` en los dos ambientes, verificada por identidad del fuente. **Construirla
  corrigió su ficha:** `CA9` pedía la medida en la fase de inicio, que se escribe con el mapeo
  sugerido y por `RN-U3` nunca une — v1.2. **`G1` sigue abierta**: la cierra un cliente.
- **Albert retomado.** Somos owner de `albert-crm-1-1c162` y se midieron desde dentro las dos
  preguntas de `DECISIONES-A-005`: la clave estable de «ganado» **no existe** (`stages: string[]` en
  `tenants/{t}/config/pipeline`), y la credencial la resuelve su propuesta nueva —endpoint
  `vivaruWonSignals` con token de identidad de nuestra cuenta de servicio—. `RESPUESTA-A-006`
  archivada, `DECISIONES-A-006` redactada con las dos cuentas y el contrato que falta. Estado vivo
  en `docs/prd/albert/ESTADO-ALBERT.md`.
- Credenciales: `firebase` caducó y se reautenticó la misma noche; `gcloud` sigue muerto.

### 0.9.47 — 1 de septiembre de 2026 — CA3/CA10 cerrados, y la exploración que reencuadra la IA de formatos

- **`CA3` de `PH-003` verificado en producción con DOS sesiones reales a la vez** —guardia en un
  navegador, residente en otro—: autorización en 26 segundos, `authorizationMedium: "app"` con el
  uid del residente, «Entró» habilitándose en vivo y el ciclo cerrando en «Finalizado».
- **`CA10` estaba EN PRODUCCIÓN SIN CONSTRUIR y lo destapó la propia prueba:** la visita
  desaparecía del portal del residente al autorizarse — el único lector filtraba `pendiente` e
  «Invitaciones recientes» lee otra colección. **Construido y verificado el mismo día**
  (`28a587e` + `c858edf`): historial con la misma constancia que ve la portería, lógica pura con
  banco propio y falsada, cero índices y cero reglas nuevos. **Tercera vez que muerde «desplegado
  no es completo»**, tras el `CA1` de `FLOW-004`.
- **La fixture de `CA4` quedó montada:** Carolina Prueba, segunda residente de APARTAMENTO 201,
  espejando la forma real de la membresía; la consulta del propio servidor devuelve 2 activos.
  La carrera solo pide ya dos personas y dos dispositivos.
- **`AI-ONB-001` explorada midiendo, no opinando:** el mapeador determinístico casi no falla en
  «elegir columnas»; falla en transformaciones y formatos. **La ficha futura cambia de naturaleza**
  y ya se sabe qué corpus pedir. La bandera `ai-onboarding-column-mapping` sigue sin consumidores.
- **La noche de los chips cerró dos defectos en producción**, ambos «dato ausente disfrazado de
  dato falso»: todo fallo de login salía como «error inesperado» (`fe89324`) y la tarjeta de
  portería atribuía la visita al guardia cuando no se especificaba anfitrión (`d77a559`).
- Y dos gestos que costaron descubrirse: **un navegador solo aguanta una sesión** (guardia en
  Chrome + residente en el panel de la app es el montaje que funciona), y **un enlace de
  restablecimiento no viaja por copia** — se trunca en el primer `&`; se genera con
  `generatePasswordResetLink` y se abre directo.

### 0.9.46 — 31 de agosto de 2026 — los seis frentes resueltos, y ninguno lo frena el equipo

- **`PH-003` construida y en producción**, con la bandera solo en el único conjunto donde hay push
  —sin él la vía A nace inservible—. **El ciclo entero se validó en pantalla con la sesión de un
  guardia**: capturar, esperar, la caducidad derivándose sola, el rescate por llamada y el ingreso.
- **Dos cosas eran el nudo y las dos se retiraron.** `registerWalkInVisit` exigía una variante que
  **oculta el QR**, y los diecisiete conjuntos tienen QR: con esa exclusividad **esto no lo habría
  visto nadie**. Y creaba el pase ya *dentro*, avisando de un hecho consumado.
- **La ficha decía que las reglas ganaban LECTURA para el residente. Ya la tenían.** Lo que hacía
  falta era lo contrario: **endurecer el registro de ingreso**, que es escritura directa del guardia
  y la única puerta por la que un pase sin autorizar podía entrar. Y ese endurecimiento **no
  restringe nada vivo**, medido: los 142 pases de los dos ambientes no llevan el campo.
- **Mirar la pantalla encontró un defecto que ningún banco veía:** una visita de portería salía
  **«Expirado» en rojo al segundo de crearla**. La regla no estaba mal — estaba aplicada a un flujo
  para el que no se escribió: «se pasó la hora de la cita» es correcto para un QR emitido de
  antemano, y una visita de portería nace en el instante en que alguien está en la puerta.
- **El frente de cobros por concepto, cerrado, y no merecía PRD.** `billingConceptLabel` caía **en
  silencio** a «Mantenimiento y Administración», y un parqueadero de **$80.000** lo disparaba:
  fallaba **por una letra** y en **tres sitios a la vez**. Lo que lo hizo durar es la asimetría —
  **el lado del dinero avisaba y el de la pantalla mentía**. Corregidos el código, la semilla que
  sembró el dato malo y el dato en los dos ambientes.
- **Y la auditoría cambió de conclusión al medirla:** «220 de 221 cobros sin cuenta contable» **no
  es una deuda** — ese campo **no lo lee nadie**, porque al cobrar se vuelve a resolver la cuenta y
  se escribe en el asiento, que es lo que leen los informes.
- **Tres correcciones a las trampas del despliegue**, las tres medidas: un `deploy` completo escupió
  **dos HTTP 429 por cuota y aun así dejó 90 de 90 frescas** —el 429 es una señal para medir, no una
  conclusión—; **no canalizar el log del deploy por `tail`**, que tira justo lo que explica el fallo;
  y **las tres credenciales caducan por separado** —con la ADC viva y el CLI de `firebase` caducado,
  `firebase deploy` respondió «Deploy complete» con salida 0 y **no desplegó nada**.

### 0.9.45 — 30 de agosto de 2026 (noche) — dos de las tres PRD, construidas y en producción

- **`UX-004` y `ONB-002`, construidas y desplegadas el mismo día en que se escribieron sus fichas**,
  las dos validadas con ojos en Santa María y no solo desplegadas. Queda `PH-003`.
- **Construir `ONB-002` corrigió su propia ficha en CUATRO puntos, y ninguno se ve leyendo.**
  (1) Eran **13** registros duplicados y no 11 — los «11 en 3 grupos» eran **la regla de nombre a
  solas**. (2) El inventario de referencias estaba mal **en las cuatro filas**: derivarlo de los
  DATOS —recorrer las 49 colecciones preguntando qué campo contiene de verdad un id de `people`—
  encontró `packages.deliveredToId` y `packages.receivedBy`, **siete cada uno**, que ningún nombre
  delata, y descartó `tickets.residentId`, que se llama exactamente como una referencia a persona y
  lleva un **uid**; por nombres habría repuntado **29 de 43** y dejado catorce huérfanas, que es
  `mergeUnits` otra vez. (3) «David Cancelo» y «Luis Otero» **comparten documento**, así que agrupar
  por cierre transitivo habría propuesto fusionar dos personas distintas — **un duplicado se ve, una
  fusión mala no**. (4) `R5` habría bloqueado el caso real: dos fichas apuntan al **mismo** uid.
- **Y lo que sostiene el invariante no es la lista, es el barrido**: antes de escribir nada, la
  callable busca todo lo que apunta a esas personas y **aborta** si aparece algo no registrado. Eso
  convierte «el inventario está completo» —una promesa— en «si no lo está, no se escribe».
- **Ejecutar la primera fusión destapó un defecto que ninguna prueba veía.** El registro de la
  decisión nombra a los archivados —para eso existe— y el barrido lo leía como referencias
  desconocidas: **la SEGUNDA fusión de esa persona habría abortado**. Con una hecha, todo estaba
  bien. **El defecto vivía en la segunda pasada, que es cuando ya nadie mira.**
- **El guardián nuevo de `UX-004` nació ciego justo en el caso que lo motivó.** Su falsación —quitar
  la ventana al «% recaudo» del panel— **pasó en verde a la primera**: cortaba por rótulos literales,
  se comía media pantalla y leía el `scope` del vecino. Lo destapó falsarlo, no escribirlo. De paso
  encontró que el mapa de tipos de ticket tenía **cinco** copias y no tres, **dos en el mismo fichero**.
- **Tres defectos de copy los cazó la pantalla y ninguna prueba**, los tres en textos que se leen
  antes de confirmar algo: «las 1 referencias», «La 1 referencia» y «mar de 26 – jun de 26».
- **CORRECCIÓN QUE GOBIERNA TODOS LOS DESPLIEGUES: el push a `master` SÍ despliega producción.**
  Este repositorio afirmaba lo contrario desde el 27. **El error no fue medir poco: fue medir el
  campo equivocado** — se leyó `codebase` del backend, no traía campo `branch` y esa ausencia se
  leyó como prueba, cuando la política vive en `traffic.rolloutPolicy.codebaseBranch`. **Una
  ausencia solo prueba algo si mirabas donde el dato tendría que estar.** Costó un rollout duplicado.
- **Y `npm test` no estaba roto: le faltaba el emulador.** Con él levantado pasan las 1449.

### 0.9.44 — 30 de agosto de 2026 (cierre) — dos PRD más, y las dos que NO se escriben

- **`PRD-V-FLOW-005` (autorizar la visita que llega sin avisar) y `PRD-V-FEAT-005` (un padrón sin
  duplicados), las dos listas para desarrollo.** David pidió adelantar las PRD pendientes
  aprovechando que las mediciones están frescas — argumento válido: si esperan, hay que remedir.
- **Pero solo dos de las cuatro, y por qué las otras no.** `PRD-VAI-FEAT-001` **hoy no pasaría sus
  propias puertas**: sin corpus (15–25 archivos reales, hay cero) no hay con qué evaluar ni con qué
  estimar coste, así que saldría diciendo «pendiente de datos» justo en las secciones que deciden si
  se construye. `UX-005` va detrás de `UX-004`, que aún no existe, y le falta una decisión de modelo.
- **La de duplicados sale del frente de IA y se vuelve funcional.** Era la parte (b) de
  `AI-ONB-001`; **no lleva modelo**, no depende del corpus y se puede construir mañana. La IA queda
  para la cola larga —«Ma. José» contra «María José»— y esta ficha es justo lo que permitirá
  **medir si aporta algo**, que hoy no se puede.
- **El riesgo de la fusión está calibrado con un precedente propio:** `mergeUnits` prometía «TODAS
  las referencias» con una lista de **nueve escrita a mano, y eran dieciocho** — eso explica los
  huérfanos de `tenant-santa-maria`. Por eso el inventario de referencias a persona **se deriva y
  lleva guardián**, y `CF8` falsa el guardián, no la fusión.
- **Y volvió a pasar escribiendo la ficha, lo que la mejora:** la primera medición buscó campos
  escalares y concluyó que **ninguno** de los siete «David Carmona» estaba referenciado. Falso:
  **dos lo están**, desde `units.ownerIds` y `units.residentIds`, que son **arrays**. Queda escrito
  dentro de la PRD como la razón de R-INV.
- **`FLOW-005` es callable por un dato, no por criterio:** el `update` de `visitorPasses` deja al
  residente tocar solo lo que él creó, y un pase de portería lleva el uid del guardia — **con las
  reglas de hoy el residente no puede autorizarlo**.
- **Verificado contra:** las reglas vigentes de `visitorPasses`, el catálogo de avisos (13 claves,
  **ninguna de visitas**), `deletePerson`, el archivador de huérfanos, y producción con la ADC —
  68 personas, 11 duplicadas, 3 grupos, 54 `packages` y 20 `tickets` con `residentId`, 15 de 93
  unidades con arrays poblados.

### 0.9.43 — 30 de agosto de 2026 (noche) — seis frentes nuevos, medidos antes de escribirlos

- **Entran seis frentes que pidió David, y MEDIRLOS cambió tres de ellos antes de planearlos.**
  Se midió contra `hogaru-1` y `vivaru-staging-02` con la ADC, no se leyó documentación.
- **`UX-004` nace con su PRD (`PRD-V-FIX-003`) y con el defecto probado, no supuesto.** El
  «% recaudo» del Panel de Control mide **un mes** y el de Cartera **hasta doce períodos**, mismo
  rótulo: **divergen en los siete conjuntos de producción**. Palmas y Nogal dicen `0,0%` en el
  panel y `50,0%` en cartera. **Y en cuatro de los siete el panel afirma hoy, en rojo, un recaudo
  del 0,0% donde no hay ni un cobro emitido ese mes** — «sin datos» disfrazado de «lo peor», que es
  exactamente el error que la función vecina del mismo fichero ya evita y explica en un comentario.
- **Verificado contra qué:** ejecutando las fórmulas del producto sobre los 221 `billingStatements`
  de producción, y leyendo `buildBillingTrend` y `computeCollectionSummary`. **El diagnóstico
  cambió al medir:** parecía aritmética duplicada y **no lo es** —las dos pantallas usan las mismas
  funciones puras—; es la ventana y el rótulo. Diagnosticarlo mal habría llevado a reescribir
  código correcto.
- **`AI-PQRS-001` llevaba trece días diciendo dos cosas falsas.** Decía que su callable no estaba
  desplegada en producción y que su bandera estaba apagada: `aiInvoke` está `ACTIVE` y
  `ai-pqrs-shadow` encendida desde el 17 de agosto. Corregido en su ficha.
- **El frente 0 no era «empujar la IA a producción»: ya está allí.** Tres de las siete banderas
  llevan encendidas en producción desde el 17 de agosto —**`ia-proveedor-real` incluida, que es la
  que gasta dinero**— y nadie lo sabía. Lo que falta es tráfico: cero tickets desde el 7 de agosto,
  cero filas en `aiUsage`. **No lleva PRD y decirlo es parte del trabajo**: lleva runbook,
  `docs/encender-la-ia.md`, calcado del del lote de Habitanto.
- **Y una pregunta abierta que el runbook pone primero:** `aiAssistance` está en **0 en los DOS
  ambientes** pese a que la sombra lleva encendida en ambos y staging registró 41 usos. Si el
  disparador no escribe, encenderla en producción no acumula nada — y el argumento de «esperar
  acumulando» de la hoja de ruta de IA se cae.
- **`AI-ONB-001` se desbloquea POR DECISIÓN, no por datos**, y cambia de nombre y de alcance:
  incluye PDF y fotos. **Contradice a `docs/hoja-de-ruta-ia.md`**, que defendía lo contrario; la
  contradicción queda escrita y fechada en los dos sitios en vez de resolverse en silencio.
- **El dato que ordena ese frente:** la auditoría de duplicados **se hizo sin IA** y encontró once
  en producción — «David Carmona» ×7, dos documentos distintos, el mismo correo en los siete—.
  La IA entra en la cola larga, no en lo evidente.
- **`PH-003` entra con sus cinco decisiones ya tomadas** (primero que conteste · 5 minutos · la vía
  B no espera · constancia del medio · **convive con el QR**). Lo abarata que hoy haya **cero
  visitas registradas por portería** en los dos ambientes: se estrena un flujo, no se migra uno.
- **`UX-005`** (tableros configurables) entra en exploración, **detrás de `UX-004` a propósito**.
- **El frente de cobros por concepto NO entra como iniciativa: no merece PRD.** Ya está construido
  —el residente ve la etiqueta del concepto y sube comprobante por cobro—. Lo que hay son dos
  tareas: `billingConceptLabel` **cae en silencio a «Mantenimiento y Administración»** ante una
  clave desconocida, y en producción hay un cobro de parqueadero de $80.000 con `concept:
  "Parqueadero"` que lo dispara; más 30 cobros sin `concept` y 4 sin `accountCode`.
- **Hueco del propio inventario, corregido a medias y dicho entero:** el frente «Experiencia y
  diseño» tenía fila en la tabla ejecutiva desde el 27 de agosto **y ninguna ficha aquí**. Se
  añaden `UX-003`, `UX-004` y `UX-005`; **`UX-001` y `UX-002` siguen sin ficha y se dice, en vez de
  inventarles una**: su detalle vive en el inventario de Notion.

### 0.9.42 — 30 de agosto de 2026 (tarde)

- **El documento de no deuda se llama como lo pide cada país, EN PRODUCCIÓN**: «paz y salvo» solo
  en Colombia; «constancia de no adeudo» en México (la exige el notario — Ley de Propiedad en
  Condominio CDMX) y «certificado de expensas» en Ecuador (documento habilitante — doctrina
  DINARDAP 003-2013); neutro «certificado de no adeudo». Investigado con fuentes, decidido por
  David, y cableado por el mecanismo de `vocabulario-pais` — con el término viaja su ARTÍCULO,
  porque el género cambia (LA constancia). Pantallas, PDF (título por país, cuerpo con la fórmula
  legal común) y el «no» del servidor, que lee el país del conjunto. Validado en staging (Las
  Palmas) y en producción (Queretarock) con ojos humanos. **Y el espejo front/functions de
  vocabulario tiene POR FIN guardián**, que cubre de paso coeficiente y cuota — la sincronía era
  solo un comentario desde el 22 de agosto.
- **Trampa nueva del CLI, para la colección:** `apphosting:rollouts:create` cortado por timeout
  puede disparar **DOS rollouts** (pasó en producción, 19 s de diferencia, mismo commit — derroche
  inofensivo, pero con commits distintos habría sido una carrera). Tras un create cortado, mirar
  la lista ANTES de repetir. Y las credenciales rotaron **cuatro veces en la jornada** (ADC ×2,
  firebase ×2): si es lo nuevo normal, valorar `login:ci` o cuenta de servicio.
- La celda de versión decía 0.9.40 con la 0.9.41 ya en el changelog — corregida de paso.

### 0.9.41 — 30 de agosto de 2026 (madrugada)

- **`PLAT-005` A PRODUCCIÓN la misma noche**, por el criterio de llegar listos y con el patrón
  `FLOW-004`: reglas (0 diff contra el vivo), functions (87/87 frescas), front (`b70c357`,
  rollout `-015` esperado POR NOMBRE — la lista sin ordenar engañó dos veces al vigía en
  staging), y `producto-notificaciones-push` encendida **solo en `tenant-santa-maria`**,
  verificada resolviendo con el compilado. La global y los demás conjuntos, apagados.

### 0.9.40 — 30 de agosto de 2026

- **`PRD-V-PLAT-005` — notificaciones push al residente: construida, en staging y VALIDADA con un
  iPhone real, todo el 29.** Tercer canal del catálogo de avisos (in-app · correo · push), vía
  FCM/Web Push sin app en las tiendas. Ciclo visto funcionar: registro, push al hub con la app
  cerrada, toque que navega, baja y re-alta. La bandera `producto-notificaciones-push` encendida
  **solo en el canario de staging**; producción sin desplegar a propósito. Ficha con §14: las
  cuatro cosas que solo el teléfono pudo encontrar — dos defectos corregidos (base de enlaces por
  ambiente; click propio en el SW porque el del SDK de FCM no navega una web app instalada de
  iOS), y la respuesta de plataforma que evita rediscutir: **no hay push en iPhone sin pantalla
  de inicio, en ninguna versión** — Declarative Web Push elimina el service worker, no la
  instalación.
- **La fila de Mobile/iOS de la vista ejecutiva recoge la entrega**, y la evidencia de `MOB-001`
  («no hay PWA… no hay push») queda superada en esa parte y anotada dentro.

### 0.9.39 — 30 de agosto de 2026

- **La vista ejecutiva llevaba a `Vivaru Finance` con `FIN-002` ABIERTO**, y en SIGUIENTE ponía
  «el expediente: `ReconciliationCase`, estados, duplicados» — que es justo lo que ya está
  construido y en producción desde el 29. La celda de Estado de arriba sí estaba al día. **Es la
  segunda vez que esa tabla se queda atrás mientras el cuerpo avanza** (la 0.9.37 le añadió la
  fila que le faltaba desde el 26). Reescrita: el bloque de Finance queda CERRADO, sin SIGUIENTE.
- **La 0.9.37 decía DOS entregas de `UX-003` y son TRES.** Se comía `6738571` —el del Panel de
  Control— y le colgaba esa entrega a `5bc9d3f`, que en realidad es el arreglo de la regresión
  que `6738571` introdujo. **No se resolvió leyendo: se midió contra la API de App Hosting**, y
  hay tres rollouts `SUCCEEDED` el 28 a las 22:09, 22:24 y 22:53 (`build-2026-08-28-008`, `-010`
  y `-012`). `pendientes.md` decía «tres entregas» y **tenía razón**; el error estaba aquí y la
  atribución de commit estaba mal en los dos. Corregidas las dos.
- **La lección, que es de método:** contar entregas por los commits que uno recuerda da menos de
  las que hubo. El rollout es el hecho; el commit es un sustituto suyo, y esta vez no coincidían.

### 0.9.38 — 29 de agosto de 2026

- **`FIN-002` cerrada: el expediente de conciliación en producción**, cinco días después de abrirse
  y con todos sus criterios cumplidos. Su bloque se reescribió arriba; el detalle vive en
  [`PRD-V-FLOW-004`](prd/funcionales/PRD-V-FLOW-004-expediente-de-conciliacion.md).
- **El hallazgo:** de los 19 emparejamientos que había, **uno era falso** y el producto lo contaba
  como bueno desde el 20 de agosto. Se descubrió midiendo, no leyendo.
- **Tres lecciones de método, y las tres se pagaron en esta jornada.** El orden de despliegue **se
  invirtió** —functions → front → reglas— porque la regla restringe lo que la pantalla hacía. **Dos
  defectos los encontró mirar la pantalla** con typecheck en 0 y las suites en verde, y **uno solo
  aparecía con la bandera en el estado contrario al que se probó**, que es la tercera vez. Y **una
  falsación escrita en la propia ficha no falsaba lo que decía**: al par falso lo rechazaban tres
  reglas independientes, no una — corregida en la ficha, con el caso que sí aísla el signo puesto
  aparte y marcado como construido.
- **Y un criterio se descubrió sin cumplir con la ficha ya desplegada** (`CA1`: importar no creaba
  los expedientes). Cerrado el mismo día y comprobado importando de verdad, no en pruebas.

### 0.9.37 — 28 de agosto de 2026

- **`UX-003` arrancó, se acotó midiendo y tiene TRES entregas en producción** (`6738571`,
  `5bc9d3f`, `cb6d457` — tres rollouts, medidos en la API de App Hosting: `build-2026-08-28-008`,
  `-010` y `-012`). **Esta línea decía DOS y se comía `6738571`**, que es justo el del Panel de
  Control; `5bc9d3f` no es esa entrega sino el arreglo de la regresión que introdujo. Se acotó
  mirando la pantalla, no opinando: cuatro defectos con fichero y línea, y la comprobación de
  que **los tonos fijos eran 5 en todo el producto, 3 de ellos en el Panel** — lo que evitó
  inflar el frente a veinte pantallas.
- **La tabla ejecutiva de este documento NO listaba «Experiencia y diseño»**, y era el frente
  donde iba todo el trabajo. El tablero de Notion lo tenía desde el 26; **éste no**. Añadida.
- **`FIN-002` no se construye** — decisión de David. No bloqueada: aplazada, y el disparador para
  retomarla es un hecho medible, que entre cartera real.
- **Herramienta comercial decidida: Albert, no Odoo.** La versión gratuita de Odoo **no tiene API
  externa**, que es lo único que Vivaru necesita de ella.
- **Tres afirmaciones falsas de `CLAUDE.md` sobre `FLOW-003`**, caídas al medir: no estaba apagado,
  el secret no era de relleno, y comprobar versiones no exige la ADC.

### 0.9.36 — 27 de agosto de 2026 (noche)

- **El frente de diseño, en producción** (`fbfaee5` y `cad728c`). Once entregas, **front puro**:
  escala de radios de tres valores y el círculo, dos medidas de ancho —lectura 65ch, datos
  1440 px—, el nombre de la pantalla en Playfair, cifras de ancho fijo, estados en píldora, el
  fondo más profundo, el dinero de las tablas a la derecha y la acción principal de Residentes.
- **EL HALLAZGO: la tipografía de marca ya estaba escrita y una regla la apagaba.**
  `globals.css:193` pone Playfair en todo `h1, h2, h3` desde el commit inicial, y dos reglas
  dentro de `.admin-shell` lo anulaban. La segunda no tocaba solo los títulos: nombraba
  `.font-semibold`, `.font-bold`, h1–h6, `strong` y `b` —**toda la énfasis del admin forzada a
  500**, 54 elementos en el Panel de Control—. Retiradas por decisión de David. `globals.css`
  queda con **cero `!important`**; tenía dos.
- **El frente empezó torcido y lo cazó David en una frase.** Cinco pasadas de sistema con efecto
  visible casi nulo, hasta «lo veo prácticamente igual». La causa fue una decisión del agente:
  encontró las dos reglas planas y **no las retiró, por decidir solo que era decisión de
  producto**. **Si el efecto buscado es visible, la primera pasada tiene que serlo.**
- **Un defecto de idioma que se veía en producción.** El asunto de una PQRS llevaba
  `text-transform: capitalize`, que en español pone mayúscula a **cada palabra**: se leía «Por
  Qué Se Está Pagando Dos Veces El Concepto De Basura» sobre la frase de un residente. Los otros
  diez `capitalize` **no se tocaron** —etiquetas de mes, una sola palabra—: contarlos antes de
  barrer evitó romper lo que estaba bien.
- **Dos defectos de contraste, uno anterior al frente.** El texto de apoyo del tono ámbar del
  tablero daba **4,39:1**; y `--slate-500` iba a **4,60** —al límite— antes de tocar nada, así
  que profundizar el fondo lo habría hundido a 4,27. **La solución no fue aclarar el fondo sino
  oscurecer el gris**: ahora 4,73 sobre el fondo nuevo y 5,47 sobre blanco.
- **Trece guardianes nuevos, y los que más valen CALCULAN** en vez de comprobar que el código sea
  el escrito: el contraste del fondo contra cada gris, los cinco tonos del tablero leyendo su
  propio mapa, y el ancho de la tabla más ancha que exista en el código. Cada uno enrojece **con
  la cifra delante**.
- **Tres instrumentos propios mintieron, y se cazaron comparando.** Un auditor de contraste que
  daba 1,82:1 sobre texto blanco en fondo navy —no resolvía degradados, y **no se reportó ni uno
  de sus números**—; una medición de seis rutas con `pushState` que devolvió **seis resultados
  idénticos** porque Next no repintó; y un `@source not` con un `..` de más que ahorró **0 bytes**
  hasta medir el antes y el después.
- **Un cuarto falso negativo de despliegue: el CSS puede salir IDÉNTICO aunque el código cambie.**
  Migrar 90 clases `rounded → rounded-sm` no movió un byte de la hoja, porque las dos utilidades
  ya se generaban. Una sonda que espera a que cambie el CSS **no termina nunca**.
- **Higiene: −4,2% de CSS.** Retirados dos volcados de ESLint versionados (117 K y 928 K, con el
  código fuente dentro) y excluidos del escaneo de Tailwind los datos de prompts, `tests/` y
  `scripts/`. **Tailwind escanea todo fichero de texto del proyecto**, no solo los `.tsx`.
- **Tres «HOGARU» visibles**, la marca anterior, cambiados a «Vivaru»: el título de la consola de
  superadmin y dos respaldos del nombre del conjunto en el shell.

### 0.9.35 — 27 de agosto de 2026 (tarde)

- **El corte de navegación, en producción** (`3c7c826`). Cinco pasadas desplegadas juntas:
  guardián del contrato ruta↔menú, cabecera de página en los cuatro portales, menú plegable,
  pestañas unificadas y en la URL, y Cartera partida en cuatro. **De 4,6 pantallas de scroll a
  2,6**, y de 7 a 19 pantallas que dicen su nombre.
- **Cinco defectos que ninguna suite podía ver, y los cazó el navegador.** Once `<h1>`
  duplicados —cinco de ellos **desde antes** del corte—, un chevron inerte en el portal del
  residente, una migaja que se pinta en mayúsculas aunque el DOM la escriba en minúsculas,
  56 px que dejaban «Configuración» bajo el pliegue, y un modal que habría quedado mudo si se
  metía dentro de una pestaña.
- **Cuatro pruebas propias que no distinguían el código bueno del roto.** Un caso con un mapa
  vacío donde hacía falta una clave literal; un guardián que se conformaba con su **propia
  prosa** (la cabecera del componente nombraba los atributos que debía vigilar); otro que medía
  profundidad por indentación en un fichero de sangría irregular; y un arnés de falsación que
  buscaba un carácter que vitest no imprime. **Las cuatro las destapó falsar.**
- **`CLAUDE.md` decía algo falso sobre el despliegue:** «Deploy del front por App Hosting (push
  a `master`)». El backend de producción **no tiene campo `branch`** —leído del JSON crudo—,
  igual que el de staging. Sin rollout manual, `master` dice una cosa y producción sirve otra.
- **Frente nuevo: «Experiencia y diseño»**, con `UX-001` cerrado, `UX-002` aplazada y `UX-003`
  por acotar. Añadido a los dos catálogos de Notion para que sigan cruzándose.

### 0.9.34 — 27 de agosto de 2026 (madrugada, cierre)

- **El formulario de Ajustes › Cobranza, construido y validado en pantalla.** Última pieza de
  `FLOW-003`. Va en «Portal del residente» y **justo antes de las plantillas**: el calendario dice
  CUÁNDO sale el aviso y ellas QUÉ dice.
- **Lo que más protege son las rutas punteadas**, y se comprobó contra producción: se sembró una
  marca de último envío, se guardó desde la pantalla y **la marca sobrevivió**. Escribir el objeto
  entero la habría borrado, y el efecto no sería un error sino que el aviso volviera a salir a
  quien ya lo recibió.
- **Guardián de espejo nuevo**, porque los dos límites viven en TRES sitios —servidor, reglas y
  formulario— y nada los vigilaba. Cinco pruebas, falsadas una a una.
- **Cuatro pruebas de reglas con la primitiva que usa el producto.** Las cinco que había usan
  `setDoc`; el formulario usa `updateDoc` con rutas punteadas. Es el defecto de `chartOfAccounts`
  otra vez —«el banco probaba un camino que el producto no usa»— y esta vez se cerró antes de que
  costara nada.
- **`DATO-001` cerrado**: siete cuentas de prueba fuera de dominios de correo reales, 22
  documentos y 6 cuentas de Auth, **falsado** comprobando que las viejas ya no resuelven. Y dos
  correcciones que trajo la ejecución: no eran extraños sino el equipo, e `isDemoAccount` no
  distingue cuentas de prueba.

### 0.9.33 — 27 de agosto de 2026 (madrugada)

- **`FLOW-003` desplegado en producción, cableado con Resend y validado de punta a punta.** Se
  desplegaron **15 functions y no las 82**: el conjunto se cerró siguiendo el código —la función
  nueva, la de su retención, y las 13 que pasan por el único sitio que llama a
  `sendNotificationEmail` **con contexto**—. Una que parecía entrar no entraba: `buildSummaryPdf`
  se mudó de fichero con el **cuerpo idéntico**, y una mudanza pura no obliga a redesplegar a quien
  la consume.
- **EL CANAL DE CORREO ESTÁ CERRADO EN TODA LA PRODUCCIÓN** — el hallazgo de la jornada, y no lo
  vio ninguna suite. 13 claves con `emailDefault: false`, cero overrides en 8 conjuntos: **a ningún
  residente le llega correo**. La bandera estaba encendida sobre una puerta cerrada más arriba.
  **Tercera forma de «encender no era el arranque»**, y la única cuyo síntoma es silencio.
- **Hay correos de personas reales AJENAS al conjunto en los datos de producción** (6 en `users`, 8
  en `people`). **Bloquea encender `producto-calendario-de-cobranza`**: con el adjunto, el aviso
  lleva el estado de cuenta en PDF de la unidad de otro. Ficha aparte.
- **Tres trampas nuevas a la wiki, las tres medidas:** un secret de v2 se clava a una **versión** y
  no sigue a `latest` —cambiarlo obliga a redesplegar—; **un webhook no se prueba con el navegador**
  (el `GET` da 405 y se lee como avería, y costó una vuelta entera); y las dos credenciales de
  `gcloud` caducan por separado.
- **Dos frases del repositorio resultaron FALSAS al medirlas**, las dos deducidas en vez de
  comprobadas: «un cobro normal manda correo» en `CLAUDE.md`, y «esas direcciones ya lo reciben hoy»
  en la ficha nueva. Corregidas en su sitio, con la corrección dicha y no borrada.

### 0.9.32 — 26 de agosto de 2026 (madrugada)

- **`FEAT-004` con su MVP construido y en staging** (`453619a`…`86d04b4`), validado por navegador:
  estado de cuenta con PDF, certificado con emisión y anulación, portal del residente, cartera del
  administrador y lote.
- **`PRD-V-FIX-002` escrita y lista para desarrollo.** El dato que ata persona↔unidad está partido
  en dos convenciones; obligó a arreglar el paz y salvo **tres veces** antes de quedar cierto.
- **Tres correcciones a las propias fichas, hechas al construir**: un índice que habría roto R2 en
  silencio, una contradicción entre §11.1 y §11.3 sobre el lote, y una comprobación de reglas
  imposible por el límite de accesos.
- **Cinco defectos que ninguna suite vio**, dos de ellos encontrados **mirando los datos** y no el
  código: el aviso de doble cobro apagado en el 37% de los egresos, y una prueba que pasaba por el
  motivo equivocado porque afirmaba sobre una colección compartida.
- **Dos retoques sobre el selector de conjunto**: el conjunto activo se nombra donde el acto es
  irreversible —no en una banda permanente— y `producto-multiconjunto` deja de poder moverse por
  conjunto, porque un control de navegación no puede desaparecer al navegar.

### 0.9.31 — 25 de agosto de 2026 (cierre de la noche)

- **`FLOW-001` con su MVP completo y en staging** (`728451f`…`abcbaad`), validado por navegador
  contra la base: CA1/CA2 con suma exacta y residuo, CA3, CA5, CA6/CA7, CA10, R5, R6 y CA8.
- **La mitad del trabajo ya estaba hecha en `PLAT-001`** y la ficha no lo sabía: cuatro de los
  seis campos «nuevos» los escribía ya el servidor, y `src/types/domain.ts` no los declaraba.
- **§11.2 pedía una comprobación imposible** —exigía un `get()` en una regla que no tiene
  presupuesto de accesos— y **faltaba una guarda que era `CF8` otra vez**: `assertTenantOperable`
  admite `trial` y la regla lo veta.
- **NO sube a producción**, y el motivo es de datos, no de riesgo.

### 0.9.30 — 25 de agosto de 2026 (cierre de la tarde)

- **`PLAT-002` EN PRODUCCIÓN** (`e41affa`). Functions → reglas → front, verificado contra su fuente:
  77 en `ACTIVE`, ruleset con 0 líneas de diff contra el fichero, `storage.rules` sin desplegar
  (su delta eran comentarios) y el build del front identificado por su `commitMessage`.
  **Radio 0** con el predicado real (`medir-radio-membresias.mjs`, instrumento nuevo).
  La bandera sigue apagada y sin documento; **CA1 sigue sin observarse**.
- **Dos correcciones de método:** la ausencia del campo `branch` en el backend **no** prueba que
  no despliegue solo —producción sí se dispara con el push, y se lee del rollout, no del backend—;
  y la lista de rollouts **está paginada y sin ordenar**, trampa que mordió otra vez.

### 0.9.29 — 25 de agosto de 2026 (cierre)

- **`PLAT-002` con su MVP completo y en staging**, verificado de punta a punta: selector de
  conjunto, sesión con varias membresías, la entidad administradora y su consola. Once commits,
  de `dbb3f29` a `5894001`.
- **La auditoría de §11.2 estaba a medias y nadie lo sabía.** Eran **dieciocho** comparaciones del
  claim, no once: la de agosto miró `index.ts` porque ahí las situaba la ficha y dejó vivas **las
  seis del dinero**. El alcance de una auditoría se define por **patrón**, no por fichero.
- **Las reglas entre servicios de Storage no funcionan en el servicio real.** Se intentó resolver
  Storage por membresía, pasó 59 pruebas de emulador falsadas en dos direcciones y **rompió todas
  las subidas**. Revertido: el claim vuelve a seguir al conjunto activo, re-emitido tras comprobar
  la membresía, con un precio conocido — **dos pestañas en conjuntos distintos se pisan**.
- **Una revisión adversarial encontró cinco defectos que las suites no veían**, y **refutó diez de
  quince**. Cuatro eran el mismo: el claim seguía siendo autoridad fuera de la ruta del dinero
  (Storage, la puerta de IA y dos telemetrías).
- **El catálogo de banderas vive en CINCO sitios**, y su propia cabecera decía cuatro. La bandera
  nueva nació sin poder encenderse **por conjunto**, que es la vía del canario.
- **Producción sigue sin recibir nada de esto.**

### 0.9.28 — 24 de agosto de 2026 (cierre de noche)

- **`FLOW-002` cerrada entera.** Los tres criterios que le quedaban —`CF8`, `§9/CA13` y
  `personId`— se cerraron el mismo día: dos construidos y uno **retirado del contrato**. La
  categoría «criterios del alcance entregado, sin construir» queda vacía.
- **`CF8`: un conjunto suspendido podía cobrar y cruzar anticipos, y ya no.** Reproducido en
  producción con un cobro real de $2.120.000 antes de tocar nada. La causa no era que faltara la
  comprobación: `assertTenantOperable` ya existía y funcionaba, pero era **privada de `index.ts`**
  y por eso inalcanzable sin import circular. Sale a `tenant-status.ts` y la llaman los dos
  guardianes de dinero. El superadmin sigue pasando, a propósito: es quien reactiva.
- **`§9` y `CA13`: el aviso del recibo dice qué cubrió el pago y qué quedó a favor.** No hizo falta
  cambiar ningún esquema. Verificado con un cobro real que salió **carácter por carácter lo
  predicho**, y con el término de cuota del **país del conjunto** —«cuota de mantenimiento» en
  México, no «alícuota»—.
- **`personId` retirado en vez de construido.** El anticipo es de la **unidad** (R2, R6,
  `residentOwnUnit`) y no lleva ningún dato personal; §7.6 describía mal su propio precedente
  —`anonymizeExpiredVouchers` no usa vínculo con persona—. Escribirlo habría metido PII donde no
  la hay.
- **El primer sobrepago de producción**, que verificó de propina **R4** —el recaudado sube solo lo
  que fue al cargo— y **CA7** —el asiento del anticipo nace con `sourceType: "advance"`—.
- **Tres guardianes nuevos, todos falsados.** Las trece pruebas de `CF8`; el que vigila que los dos
  catálogos de avisos no divergan, que llevaba desde siempre pedido en un comentario y no existía;
  y el de la costura entre lo que escribe el pago y lo que lee el aviso, que **cazó un defecto en
  el código de producción** que ninguna prueba pura podía ver.
- **Y una trampa de método:** las suites de emulador corrían en paralelo contra un solo emulador y
  se borraban los datos entre sí, dando fallos fantasma que cambiaban de sitio entre corridas. Se
  detectó **por medir la línea base antes de culpar al cambio propio**.

### 0.9.27 — 24 de agosto de 2026 (cierre)

- **§13 comprobado en producción con números anotados antes de tocar nada.** Cobro del saldo
  exacto sobre `T2-203`: los seis números predichos salieron, y los anticipos se quedaron en $0
  con la bandera encendida en ese conjunto.
- **Cuatro índices compuestos que faltaban en producción**, puestos también en staging. Tres se
  vieron en la consola del navegador; **el cuarto no se veía** y salió de cruzar las diez consultas
  ordenadas del helper contra `firestore.indexes.json`. Las especificaciones se decodificaron del
  parámetro `create_composite` del propio error, no se adivinaron.
- **La lista de documentos del residente no mostraba NINGUNO**, teniendo ocho. Ordenaba por
  `uploadedAt`, que la subida real nunca escribe: 38 de 39 documentos no lo tenían, y **un
  `orderBy` descarta los que no traen el campo**. Arreglado con el patrón del gemelo que ya lo
  hacía bien —`watchDocuments`, sin orden y ordenando en memoria—, y corregido el tipo, que
  declaraba cinco campos inexistentes.
- **Y al arreglarlo apareció una sobre-concesión que la lista vacía tapaba:** seis de los ocho eran
  archivos de `monthlyFinancialArchive` con detalle **por unidad** —quién debe y cuánto—. Cerrado
  con la **opción A**: regla que nombra roles (administración y consejo todo; residente lista
  blanca de categorías; **portería nada**, que entraba por `sameTenant`), consulta filtrando por
  categoría en el servidor, e índice `(tenantId, category)`. Desplegado en el orden que exige una
  regla restrictiva: índice → front → regla.
- **`Queretarock` marcado como conjunto de ejemplo.** Los nueve están marcados y no queda ninguno
  sin clasificar. La credencial que se daba por caducada **no lo estaba**: era otra.
- Corregidas tres afirmaciones muertas: «lo que hay en `develop` y no en producción», «caer al
  valor por defecto» leído como «apagada», y los índices anotados como «faltan en staging» cuando
  faltaban también en producción.

### 0.9.26 — 24 de agosto de 2026 (noche)

- **La jornada del 24 se desplegó a producción en tres piezas y en orden**: reglas
  (`firebase deploy --only firestore:rules`), functions (recompilando antes — no hay predeploy
  build; dos funciones toparon con cuota por minuto y reintentaron solas) y front (push a `master`,
  `70136b9..1a9e022`). Con ello, la conciliación **ya puede casar pagos** en producción,
  `bankAccounts` queda cerrada a la portería y `advances` al consejo.
- **Se verificó cada pieza en vez de aceptar el «Deploy complete»**: 227 pruebas de reglas contra
  el emulador —las que `npm test` excluye y hay que correr con `npm run test:rules:all`—, las 74
  functions comparadas por nombre contra `index.ts`, y el front por la **huella del bundle**, ya
  que este CLI no tiene `apphosting:rollouts:list`.
- **§13 comprobado en producción con números anotados antes de tocar nada.** Cobro del saldo exacto
  sobre `T2-203` en `conjunto-las-playas`: los seis números predichos salieron, y **los anticipos
  se quedaron en $0** con la bandera encendida en ese conjunto — que es lo que prueba que la ruta
  de un solo cargo no cambió de comportamiento.
- **Corregido que «caer al valor por defecto» se leyera como «apagada».** No lo es:
  `producto-importacion-masiva` cae al default del catálogo y ese default es **Encendida**.
- **Corregida la contradicción interna del campo Estado**, que decía a la vez que la revisión
  adversarial estaba cerrada y que «quedan 20» sospechas.
- **Anotados tres índices ausentes en producción** (`notifications`, `billingReminderJobs`,
  `billingSchedules`). Los dos últimos figuraban como «faltan en staging»: faltan también en
  producción. No los causó este despliegue, y `--only firestore:rules` no los arregla.

### 0.9.25 — 24 de agosto de 2026 (tarde)

**La revisión adversarial de `FLOW-002` queda CERRADA: de 37 sospechas, 36 eran ciertas.** La
predicción del propio documento —que la mitad se descartarían, «un descarte por cada
confirmación»— falló por completo. La única descartada fue el polvo del sobrante, y estaba muerta
desde antes: la mató `aMoneda` al arreglar los guardianes de R1, sin que nadie lo buscara.

**Lo que salió del triaje y NO era una sospecha.** Probando contra el emulador si el veto de
`sourceType` protegía el asiento de un anticipo apareció el problema contrario y más caro: **la
conciliación no podía casar ni un pago.** En un `update` con merge Firestore evalúa el documento
**resultante**, que conserva el `sourceType`, y la regla lo vetaba — y desde `FIN-001` todos los
asientos de cobro nacen con `sourceType: "billingStatement"`. La pantalla de conciliación existe
para eso y no podía hacerlo.

**Dos defectos de dinero que solo aparecen con centavos, y se midieron.** Barriendo 20.000
combinaciones: **3,0 %** de los anticipos cruzados y descruzados quedaban imposibles de anular
—CF3 comparaba con `!==` sobre coma flotante— y **2,1 %** de los cruces dejaban el cargo
«pendiente» con un saldo de 3,5e-15 que se pinta como 0,00. Leer el código no da esos números.

**Tres «% recaudo» con la fórmula vieja, en tres sitios distintos.** El informe automático mensual
(en tres lugares dentro de él), la tabla de campañas de `/admin/billing` —conviviendo con un
StatTile del mismo nombre y distinta fórmula— y el histórico que exporta esa misma pantalla. Es la
tercera vez que una regla se aplica en `src/` y no llega a `functions/`: R12 primero, **R16 un día
después**. Ahora hay tres espejos vigilados.

**Y una decisión de producto:** al consejo se le retira la lectura de `advances`. Lo que tenía era
detalle financiero **por unidad**, y lo que la PRD le concede es un agregado que **una regla de
Firestore no sabe calcular**. El total pasa a `PLAT-004`, que es donde se decide qué pantallas ve.

**Producción sin tocar.** Los cuatro commits están en `develop` y su despliegue son tres piezas en
orden: reglas → functions → front.

### 0.9.24 — 24 de agosto de 2026 (mañana)

**Triaje de las dos sospechas «gordas» de `FLOW-002`: las dos eran ciertas, y las dos se
corrigieron.** Reproducidas contra el emulador antes de tocar nada, que era la instrucción.

- **El anticipo nacía con `producto-anticipos` APAGADA** cuando el reparto sumaba menos que lo
  pagado, **y nacía congelado**: las tres callables de `advances.ts` exigen la bandera, así que
  ese dinero no se podía cruzar, ni anular, ni ver. El comentario del código decía que el
  sobrante queda en cero «por construcción» y era cierto **solo para la forma vieja**, que
  resulta ser la única que probaba el banco. Ahora se rechaza el cobro.
- **`bankAccounts` estaba abierta a `tenantMember`**, o sea a la portería y al consejo, cuando
  la PRD §3 le da al `security_guard` «Nada / no puede Acceder». Corregido a
  `tenantRole(..., 'resident')`.

**La lección, porque es la misma en las dos: el punto ciego estaba escrito en el propio banco de
pruebas.** El test de «con la bandera apagada no cambia un solo número» usaba la forma que no
puede fallar; el test «ni el consejo, ni la portería» existía **solo para
`bankAccountBalances`**, y para la cuenta en sí nadie hizo la pregunta. **Al revisar una guarda,
buscar la forma que las pruebas NO ejercitan.**

**Y un documento operativo puede llevarte solo al defecto:** el runbook autorizaba encender
`producto-pago-multiple` sola prediciendo que el sobrante «vuelve a evaporarse». No se
evaporaba, se congelaba — y **el rollback documentado era esa misma combinación**. Corregido.

**Se corrigió también lo que este documento daba por cierto y no lo era:** `PH-001` decía «en
producción no se ha desplegado nada» dos días después de que el lote entrara. **El estado real,
medido:** todo el lote está en producción y **apagado**, y en `featureFlags` de `hogaru-1` no
existe ni un documento `producto-*`.

### 0.9.21 — 24 de agosto de 2026 (madrugada)

**`FLOW-002`: todo el servidor construido y verificado contra la base.** Ocho incrementos en
`develop` (`7937900`), los tres defectos de la PRD cerrados —D-A, D-B, D-C— y el ciclo de vida
del anticipo completo. Staging desplegado con las dos banderas encendidas en
`conjunto-las-playas`; 25 comprobaciones en verde contra la base real y cero restos.
**Producción sin tocar.**

**El defecto que salió de la base y no de la suite.** R8 preguntaba `remaining < amount`, que
parecía lo mismo que «tiene cruces vigentes» y no lo es: anular un anticipo (R9) pone `remaining`
a cero sin haber cruzado nada, así que un anticipo anulado bloqueaba una reversión legítima.
Necesitó cinco operaciones encadenadas para aparecer.

**Tres lecciones de método nuevas**, que se suman a las cuatro de la 0.9.20:

- **La suite no encadena.** Cada tramo puede estar probado y bien, y la secuencia estar rota.
- **Un verde no vale sin falsación.** Salvó dos veces: un `evaluation error` en las reglas que
  denegaba por fallar en vez de por decidir, y CA6 pasando con el ingreso inflado en 60.000.
- **El typecheck no ve los `.mjs`.** Dos de los cuatro sitios del catálogo de banderas son
  scripts. «Las cuatro cuadran» dicho desde el compilador es dicho de dos.

**Una decisión contable que conviene revisar:** anular un anticipo **no baja el ingreso** y
revertir el pago que lo creó **sí**. §4 excluye devolver el dinero porque es un egreso de otra
PRD, así que anular deja el dinero en el conjunto y lo que desaparece es el crédito de la unidad.



### 0.9.20 — 23 de agosto de 2026 (noche)

**El código correctivo llegó a producción y `FLOW-002` quedó lista.** `master` = `develop` =
`5d6df95`, 57 índices, rollout `rollout-2026-08-23-002` en `SUCCEEDED`. **El reloj del 1 de
septiembre está apagado.** Backfill de `eventDate` corrido en producción: 47 `visitorPasses` y
14 `tickets`, cero sin fecha resoluble, verificado con un segundo dry-run en cero.

**La PRD de `FLOW-002` pasa a v1.2** (`7dc5f7f`, en `develop`, sin empujar). Las tres
correcciones de la 1.1, resueltas:

1. El asiento del anticipo lleva **`sourceType: "advance"` propio**. Corrección a la 1.1: el
   predicado **no cambia en ninguno de los dos espejos** —el de `functions/` recibe
   `sourceType?: string` sin tipar—; se amplían dos líneas de tipo en `domain.ts`, y una de
   ellas (`reversedSourceType`) la 1.1 no la nombraba.
2. **El cruce no toca `paymentAmount`**: sube `advanceAppliedAmount`, que solo escribe el
   servidor. Con eso `cuotaIncome` no puede ver el dinero del anticipo, sin que cinco sitios en
   dos espejos tengan que acordarse de restar. Cuesta lo que la 1.1 daba por intocado:
   `calcularSaldo` / `computeBalanceStatus` y el contrato de `BillingStatement`.
3. El reverso **copia el `bankAccountId`** del asiento que anula — el segundo de los dos.

**Tres reglas nuevas y dos huecos que no estaban en ninguna versión anterior.** R14 (el cruce no
cambia el ingreso del período, como invariante), **R15** (revertir con el anticipo todavía
`open` dejaba vivo un saldo a favor de un dinero devuelto) y **R16** (el «% de recaudo» pasa a
`amount − balance`). Las dos últimas salieron de leer el código, no la PRD.

**Cuatro lecciones de método:**

- **Ampliar un tipo es inerte; lo que sostiene la decisión es el guardián.** El riesgo no es
  olvidar el valor nuevo —no compila— sino añadir `category === "anticipo"` a la exclusión por
  analogía: eso compila y pasa las suites.
- **Un campo escribible desde el cliente no puede sostener un invariante.** `paymentAmount` se
  escribe con un `updateDoc` directo desde el navegador.
- **Un criterio que mide el mecanismo pasa en verde con el resultado mal.** CA6 comprobaba «no
  se crea asiento» y habría dado verde con el estado financiero equivocado.
- **Los números de línea de una PRD caducan en menos de un día.** Sustituidos por nombres de
  símbolo.

`docs/prd/README.md` se actualizó en la misma pasada: decía «NO lista para desarrollo» y daba
`PLAT-003` por en vuelo en staging.



### 0.9.19 — 23 de agosto de 2026 (tarde)

**El informe de comité no leía medio producto y no lo decía.** Cinco defectos, encontrados por
MIRAR la pantalla que el lote de la mañana dejó en producción sin abrir.

- **Cuatro consultas fallaban por índice**, no una: `ledgerEntries`, `visitorPasses`, `tickets`
  y `committee_agreements`. Sus ceros se leían como datos.
- **Dos causas distintas.** `ledgerEntries` pedía un `orderBy date desc` cuyo índice **nunca
  existió**; se quitó el `orderBy`, porque el orden **no lo usaba nadie**. Los otros tres tenían
  su índice **solo en `ASCENDING`** mientras el código pide `desc` — `reservations` recorre el
  mismo camino y funciona porque tiene **las dos direcciones**.
- **El hook detectaba el fallo y la página nunca lo pintaba.** El aviso nuevo va **dentro del
  bloque imprimible**: el daño no es la pantalla, es llevarse el PDF a la asamblea.
- **R12 nunca llegó a `functions/`.** El job mensual contaba el recaudo dos veces; medido en los
  dos ambientes, −1.500 en Las Playas. **No dependía de la bandera.**
- **`tickets` y `visitorPasses` sin `eventDate`.** Backfill en staging: visitantes 0 → 31,
  PQRS 0 → 14, cuadrando con lo medido en la base.

**Producción quedó a medias a propósito:** 3 índices desplegados, código en `develop`. Al revés
sería peor que no hacer nada — el aviso saldría en rojo a todos los administradores.

**`FLOW-002` sigue sin arrancar, y su PRD necesita corrección antes:** la trampa de §7.4 pasó de
omisión a **herencia** (ahora hay que actuar para EVITARLA), **R4 no basta** porque el doble
conteo del cruce no pasa por el libro sino por `cuotaIncome`, y **D-C nombra un
`bankAccountId: null` de los dos que hay**.

### 0.9.18 — 23 de agosto de 2026

- **Producción se movió.** `master` de `d17478d` a `f16927d`: **67 commits**, las olas A y B
  enteras. Orden: reglas e índices → functions → front, y **las reglas pudieron ir primero**
  porque su diff contra producción es **puramente aditivo** —dos bloques nuevos, ninguna regla
  existente restringida—. La lección de `FIN-001` (reglas al final cuando restringen) no aplicaba.
- **`PLAT-003` entrega 2 completa**: `accountCode` en cargos y egresos, el formulario del plan
  —validado a mano, 6 de 6—, **R9** con las etiquetas saliendo del plan, los ingresos por cuenta
  en el informe de comité, y el aviso de R8.
- **Dos decisiones cerradas.** **D3**: la vigilancia son **dos** cuentas, no una —`1.9` la cuota
  que se cobra y `2.9` lo que se paga—, y se vio porque David nombró su cuenta de prueba «Cuota
  de vigilancia» como ingreso. **D4**: **rango reservado** —la semilla vive en `N.1`–`N.49` y el
  administrador crea de `N.50`—, que cierra por construcción la colisión de significado.
- **Cinco defectos, y ninguno salió de una suite en verde.** El `permission-denied` al crear una
  cuenta (el `read` no admitía documento inexistente, y el gemelo correcto estaba **en el mismo
  fichero, dos veces**); la dependencia que faltaba en el memo del informe, que dejaba CA6 verde
  en la prueba y rota en la pantalla; las categorías inventadas de la semilla del trial; el falso
  positivo del sembrador; y **R9 partiendo en dos filas lo que es una cuenta sin plan sembrado**,
  que es la condición de producción.
- **El banco de reglas estaba verde con la pantalla rota**, y esa es la lección de la jornada:
  sus seis pruebas escribían con `setDoc` y el producto escribe con una **transacción**. No
  faltaba un caso — **el banco probaba un camino que el producto no usa**.
- **Y una de honestidad:** se dio `PLAT-003` por inerte en producción y **no lo era del todo**.
  De los 89 asientos, uno cambia de lado: Las Playas pasa de 129.000 a **127.500**. Es el doble
  conteo dejando de ocurrir. **Estaba escrito en la wiki desde el 22** y se redescubrió midiendo.

### 0.9.17 — 23 de agosto de 2026, madrugada

- **`PLAT-003` 1b completa** (`9f53a80`, `ee310d6`, `6939308`) y **validada a mano en staging**.
- **El defecto grande de la PRD, cerrado:** `aplicarPago` escribía `alicuota` fijo sin mirar el
  concepto del cargo, que llevaba existiendo en el mismo documento que ya leía.
- **1b-iii salió al ir a validar la 1b-ii, y es la lección de la jornada: escribir la cuenta era
  necesario y NO era suficiente.** Los asientos de cobro están excluidos a propósito, así que la
  cuenta recién escrita **no la mostraba nadie**. El reparto tenía que salir de Cartera.
- **R13 probado con dinero real:** cobrar la multa subió el total a 128.000 y revertirla lo
  devolvió a **127.500 exacto**. Sin el origen arrastrado habrían sido 127.000.
- **Tres trampas de despliegue:** App Hosting no lanzó rollout solo (hubo que forzarlo),
  `functions:list` falla con el alias del proyecto, y el CLI de `gcloud` caduca aparte de la ADC.
- **Y una de método:** el grep del bundle falló **incluyendo su control**, lo que delató que la
  medición era mala y no el despliegue. La verificación buena fue la **procedencia del build**.
- **Nada de esto está en producción.**

### 0.9.16 — 22 de agosto de 2026, noche

- **`PLAT-003` 1b-i en staging** (`1635ac2`): la exclusión del doble conteo mira el **origen**
  del asiento (`sourceType`) y no su categoría. **Sin bandera**, y **la única pieza del lote
  que cambia una cifra visible hoy**.
- **La secuencia estaba mal escrita, no mal decidida.** «Las dos en el mismo despliegue» se
  leía como «juntas o ninguna». Es **la exclusión primero, o a la vez, nunca después**.
- **Medir antes de tocar dio el resultado contrario al esperado.** Se leyeron los dos
  ambientes con dos scripts de solo lectura para confirmar que el cambio era inocuo. **No lo
  era, y por el lado bueno:** el seed de demo ya escribía la cuenta del concepto, así que el
  doble conteo llevaba tiempo ocurriendo. Las Playas pasa de **129.000 a 127.500**, que es lo
  que recaudó. Trece conjuntos más, sin mover un peso. **Decisión de David: desplegar tal
  cual** — con cero clientes reales es el momento más barato.
- **Los sitios eran tres, no dos.** El tercero era el informe del consejo. La exclusión pasó a
  ser un **predicado exportado único**: cuando una condición está copiada, el arreglo no es
  corregir las copias que encontraste, es que deje de haber copias.
- **R13, nueva:** el reverso del pago es el mismo defecto en negativo, y va con 1b-ii.
- **Segunda pasada de documentación cerrada** — la wiki, que había predicho esta trampa por la
  tarde y a la que 1b-i desmintió por la noche.
- **Accesos de Notion documentados y verificados.** El roadmap Albert–Vivaru da 404 porque
  está en **otro workspace**: no es un permiso que se pueda pedir, deja de ser un pendiente.
- **Nada de esto está en producción.** `master` sigue en `d17478d`.

### 0.9.15 — 22 de agosto de 2026, tarde

- **El expediente de Albert se cerró entero, en un día.** Cuatro documentos más
  (`RESPUESTA-A-003`, `DECISIONES-A-003`, `RESPUESTA-A-004`, `DECISIONES-A-004`), y el
  último **declara el intercambio terminado explícitamente** — un intercambio que nadie
  cierra sigue por inercia. Con él: **alta A5 ejecutada** (tenant `vivaru` activo, usuario
  de servicio con rol `sales` verificado en tres sitios) y **A1 publicado en producción de
  Albert**, antes de la ventana que habían comprometido.
- **Decisión de David: los dos equipos dejan de ir en paralelo.** Albert avanza con su
  roadmap y Vivaru con el lote de Habitanto. Nada urgente obliga a sincronizarlos.
- **Retención cerrada por los dos lados: 12 y 12**, con el segundo contado desde la fecha
  del borrado, y con una **condición de vigilancia escrita en cada casa** para que el
  número se revise cuando cambie el estado del mundo, no cuando alguien se acuerde.
- **`crmRef` validado** (`e59f8dc`): módulo con los dos formatos, conectado a las dos
  pantallas, 20 pruebas. Era el único trabajo de la integración construible sin depender
  de Albert.
- **`PRD-V-PLAT-003` pasó a 1.1** con dos huecos corregidos —la semilla incompleta y el
  doble conteo que el propio cambio habría introducido— y su **entrega 1a construida**
  (`41eeb9c`): el módulo puro del plan de cuentas, 22 pruebas, y las dos banderas apagadas
  registradas en los **cuatro** sitios del catálogo.
- **Primera de tres pasadas de sincronización de documentación** (`1606a5a`): `CLAUDE.md`,
  el encabezado de `albert-vivaru-integracion.md` —que pasa a **histórico**— y el bloqueo
  dominante de `roadmap-revops.md`, que ya no existe. Quedan la wiki y Notion.
- **Nada de esto está en producción.** `master` sigue en `d17478d`.

> **Lo más nuevo primero.** Cada entrada dice **por qué** cambió y **contra qué se verificó** — nunca qué líneas se movieron, que para eso está el diff de git.

### 0.9.14 — 22 de agosto de 2026, madrugada

**Por qué: la ola A del lote de propiedad horizontal pasó de PRD a código, y se desplegó a
staging.** Siete commits en `develop`. **Producción no se tocó**: el despliegue fue a
`vivaru-staging-02`, y en `hogaru-1` no se ha subido nada.

**Contra qué se verificó:** ejecución, no lectura. `origin/develop` en `6b71bed` comprobado
con `git rev-parse`; **995 pruebas de app, 399 de functions y 168 de reglas** contra el
emulador levantado a mano, con 46 nuevas; typecheck y build limpios en los dos árboles. El
reparto por resto mayor se comprobó **ejecutándolo** en las tres monedas.

**Lo que se aprendió construyendo, que no estaba en las PRD:**

- La PRD contaba **once** callables con la comprobación vieja; el `grep` encontró **doce**.
- El bloqueo real del multi-conjunto no eran las guardas de token, sino
  `assertActiveTenantAdmin` mirando un campo único por persona.
- **Tres reglas de reserva nunca funcionaron** —exención, cupo mensual y aforo—, y las tres
  pasaban cualquier revisión de lectura.
- Un rojo en la suite de reglas resultó ser **el emulador de Storage sin levantar**, no el
  código.
- **El catálogo de banderas vive en CUATRO sitios, no en dos** —los dos catálogos más el
  sembrador y el movedor—, y las tres banderas de producto solo estaban en dos. **No daba
  error**: la bandera ausente defaultea a `false`, así que la capacidad quedaba bien
  apagada y simplemente **no había forma de encenderla nunca**. Apareció al ir a hacerlo en
  staging, después de desplegar.
- **Desplegar sin recompilar habría subido un catálogo distinto del fuente:** `lib/` se
  había quedado sin la última bandera porque se corrió `typecheck` y no `build`. **No hay
  predeploy build que lo cace** — la recompilación es del que despliega.

**Lo desplegado en staging, verificado leyendo:** las dos callables nuevas contestan
**401 con el texto de nuestro propio código** al llamarlas sin token —lo que prueba de un
tiro que IAM deja pasar, que la función se ejecuta y que el binario es el nuevo—; los dos
índices compuestos de `reservations` existen; y el estado de las banderas se comprobó con
una lectura independiente, no con lo que imprimió el script que las movió.

### 0.9.13 — 21 de agosto de 2026, noche

> Entrada escrita el 22 de agosto: la revisión 0.9.13 **subió la versión sin dejar
> constancia aquí**. Se completa para que el changelog no tenga huecos.

**Por qué: se inventarió Habitanto y de ahí salió un lote de trabajo con orden propio.**
Cinco pasadas de lectura **estrictamente de solo lectura** sobre una plataforma de terceros
con datos personales reales: se registró estructura y comportamiento, nunca nombres, cédulas
ni saldos individuales.

**Contra qué se verificó:** cada candidato se contrastó **contra nuestro código**, no contra
nuestros documentos. De ahí **108 candidatos** priorizados y **once PRD**: nueve escritas y
dos en espera de disparador.

**Lo que la revisión cruzada corrigió, y es lo más valioso de la entrada:**

- **Dos huecos que el inventario daba por buenos ya existían** en Vivaru: la compuerta de
  morosos en reservas —que además es **más fina** que la de Habitanto, porque tiene exención
  por unidad— y la bandeja de notificaciones.
- Un hallazgo de portafolio: **el rol `committee` solo alcanza `/admin/documents`**, así que
  lo que ocho PRD le asignan es intención declarada, no capacidad.
- La `alicuota` de Vivaru **no es un coeficiente**, es una categoría del libro: la corrida
  masiva cobraba **el mismo importe a todas las unidades**.

### 0.9.12 — 20 de agosto de 2026, tarde

**Por qué: `FIN-001` se pudo terminar**, y lo que la desbloqueó fue la decisión de alcance
de la misma mañana, no una idea técnica nueva.

- **El recibo se emite dentro de la transacción del pago; el reverso lo anula.** Antes lo
  construía el navegador después, así que un fallo dejaba un pago sin recibo; y revertir
  dejaba una tarea manual que nadie perseguía. Validado a mano en staging punta a punta y
  desplegado en el orden front → functions → reglas.
- **Fuera el contador de secuenciales**, por decisión de David. Serializaba todos los
  pagos de un conjunto sobre un único documento.
- **Regla cerrada:** `paymentVouchers` pasa a `create, update: if false`, con cuatro
  pruebas contra emulador. El cliente ya no puede fabricar el recibo de un pago que no
  ocurrió — el reverso exacto del hueco que se cerró.
- **Tres defectos encontrados mirando la salida**, no ejecutando pruebas: sin pantalla de
  recibos para el administrador, el pie del PDF anulado contradiciendo su propia marca, y
  «No. undefined» en los recibos anteriores al cambio.

### 0.9.11 — 20 de agosto de 2026, madrugada (rev. 2)

**Por qué: una decisión de alcance de David desbloquea un módulo entero**, y al ir a
aplicarla apareció que ese módulo llevaba meses marcado como congelado por un motivo que
solo aplicaba a una parte.

- **Vivaru no maneja temas fiscales.** La factura la emite el cliente, en México,
  Colombia y Ecuador. Es la decisión de `FIN-001` **sin su «de momento»**.
- **El frente del SRI de Ecuador sale del alcance y deja de bloquear.** Estaba esperando
  desde junio el dato de un experto SAP↔SRI externo —firma `.p12`, endpoint, formato—.
  Ya no hace falta. La pregunta «¿quién lo desbloquea y con qué plazo?» se cierra **por
  no hacer falta**, que es la mejor forma de cerrar una dependencia.
- **«Congelado» nunca fue el estado del módulo financiero**, sino el del frente fiscal —
  pero estaba escrito en la fila de estado, así que se leía sobre el todo. El propio
  roadmap de finanzas se contradecía cuatro secciones más abajo. **Una etiqueta puesta
  sobre una parte se lee sobre el todo.**
- **El estado real, medido:** `FIN-000` y `FIN-001` en producción y validadas a mano; el
  expediente de conciliación **sin empezar y sin nada delante** (`ReconciliationCase`:
  cero apariciones en el código); las fases de IA y piloto esperando **datos que ninguna
  ingeniería produce** — cero comprobantes reales y cero conjuntos reales.
- **Lo que queda abierto no es técnico:** qué se hace con el código del SRI ya escrito, y
  **a quién se le puede vender en Ecuador** sabiendo que Vivaru no emite factura. El
  checklist de salida recomendaba «evitar EC hasta destrabar SRI»; ahora Ecuador no está
  bloqueado por lo técnico y el filtro pasa a ser comercial.
- **Los tres huecos fiscales de `FIN-001`** dejan de ser temporales por espera y pasan a
  ser **permanentes por decisión**. Cuestan cero mientras no haya clientes reales.

### 0.9.10 — 20 de agosto de 2026, madrugada

**Por qué: lo del 19 llegó a producción, y al revisar la respuesta de Albert apareció que
un bloqueo escrito en tres documentos llevaba un día muerto sin que nadie lo notara.**

- **El hueco de acceso más antiguo abierto queda cerrado en producción.** Borrar a un
  residente ya le quita el acceso. Lo nombró la radiografía del 13 de agosto y **siguió
  vivo para clientes hasta esta madrugada**. Validado a mano por David en staging, porque
  ninguna prueba puede contestar «¿la otra ventana te echa al refrescar?».
- **Orden de despliegue NORMAL** —functions antes que front—, porque estas dos funciones
  **conceden** permiso. Es el caso opuesto a `FIN-001`, donde la regla restringía. Dos
  casos con la misma forma y sentido contrario: el orden se decide preguntando qué hace la
  pieza, no repitiendo el despliegue anterior.
- **Comprobado leyéndolo, no por la fecha del backend**, que marca que el rollout arrancó
  y no que terminó: chunks de `/login` descargados, con marcador nuevo, control viejo y un
  símbolo inventado que no debía aparecer.
- **`RESPUESTA-A-002` de Albert nos da la razón en las dos contradicciones sin regatear**,
  y corrige su propia frase «sin PII». El expediente pasa a tener documento vivo propio:
  `docs/prd/albert/ESTADO-ALBERT.md`.
- **La segunda mitad de `REVOPS-001C` nunca estuvo bloqueada por Albert.** `pendientes.md`,
  `roadmap-revops.md` y este documento decían «Albert no tiene webhooks». Su C1 del 19 ya
  lo había cerrado: siendo tenant, Vivaru se suscribe en vivo a sus deals. **La frase era
  cierta mientras Vivaru fuese un tercero y murió al volverse tenant.** Corregidos los tres.
- **Lección de método: una dependencia se cae por dejar de necesitarla**, no solo porque
  alguien la construya — y esa muerte no deja commit ni prueba en rojo, solo una frase
  obsoleta que nadie contradice. Al cambiar el encuadre de una integración, releer los
  bloqueos escritos bajo el viejo.
- **Dos deudas nuevas, las dos nuestras.** La invariante «contacto antes que deal» dejó de
  ser regla de esquema y es **promesa que hoy no vigila nadie**; y la retención necesita
  **dos números**, no uno.
- **Los 9 conjuntos releídos:** hay uno **en Quito** sin moneda, y como la lectura
  defaultea a `COP`, se está leyendo en pesos colombianos. Y **dos de los nueve no están
  marcados como de ejemplo**, así que siguen contando como reales en las métricas.

### 0.9.9 — 19 de agosto de 2026, noche

**Por qué: se construyó el nivel 3**, cablear el precio. Y al hacerlo apareció un
defecto de datos que llevaba meses tapándose a sí mismo.

- La guía maestra deja de vivir solo en Drive. **La parte que más protege es la que
  devuelve «no sé»**: solo hay tarifa publicada para Core en trimestral, y el resto
  se niega a inventar.
- **La tarifa es de referencia, no el precio de un conjunto**, y queda escrito en el
  código donde se va a leer. A cada conjunto vendido se le aplican reglas propias.
- **Todo conjunto creado desde la consola nacía colombiano.** La callable no escribía
  la moneda y la lectura la defaulteaba a `COP`. Medido: 6 de 9 conjuntos de producción
  sin moneda, 4 sin país. **El camino del trial lo hacía bien desde siempre**, así que
  el arreglo fue alcanzarlo, no inventarlo — igual que el de borrar residentes.
- **Dos defectos el mismo día con la misma forma:** un camino hacía lo correcto y su
  gemelo se había quedado atrás. Conviene buscar el patrón antes de que aparezca un
  tercero.
- **La pantalla de planes se aplaza al módulo financiero** en vez de retirarse.

### 0.9.8 — 19 de agosto de 2026, noche

**Por qué: se cierran las seis decisiones que Albert dejó en nuestro tejado**, en
`DECISIONES-A-001`, **enviada el mismo 19 de agosto**. Se aceptan sus cinco recomendaciones y se
resuelven las dos contradicciones de su propia respuesta: el consentimiento vive **en el
contacto**, y Vivaru se obliga a **crear siempre contacto** para que ningún deal se quede
sin dónde guardarlo.

- **La N de retención queda fuera a propósito.** Vivaru no tiene política escrita, y
  fijar el número en un documento dirigido a otro equipo lo habría comprometido sin
  decidirlo aquí. Se les pide la función parametrizable; el número llega cuando exista la
  política. **Es una deuda nueva y con dueño: nuestra.**
- **De las tres carencias compartidas solo se pide una:** el motor de mensajería con
  consentimiento. El precio lo cablea Vivaru —ya es el nivel 3— y la agenda de demos no
  se pide con cero clientes firmados.
- **Lo único que se les pide de vuelta es una fecha para A1**, no un tamaño: es lo único
  que deja a Vivaru parado del todo, y de eso depende qué se hace mientras tanto.

### 0.9.7 — 19 de agosto de 2026, noche

**Por qué: dos cosas el mismo día.** `FIN-001` quedó validada a mano en producción, y
llegó la respuesta de Albert a `CONSULTA-A-001`.

- `FIN-001` pasa de ✅ desplegada a ✅ **validada en producción**. El nivel 2 se cierra
  del todo. La distinción entre «desplegado» y «validado» se sostuvo tres revisiones a
  propósito, y esta es la que la cierra.
- **Albert responde las trece preguntas**, con cita a `archivo:línea` de su repositorio
  y separando lo que es hecho de código de lo que es decisión de producto. Archivada en
  `docs/prd/albert/RESPUESTA-A-001-albert-a-vivaru.md`.
- **A1 se desbloquea construyendo.** Su `dealSchema` es cerrado y descarta claves
  desconocidas, tal como habíamos diagnosticado; proponen un bloque tipado y opcional en
  vez de un mapa genérico. Días de trabajo, no semanas.
- **Cae un supuesto nuestro:** los límites de plan de Albert **no se aplican**. Eran
  metadato de consola. Ningún tope nos frena.
- **Dos contradicciones internas de su respuesta quedan anotadas** para contestarlas
  antes de que cableen: dónde vive el consentimiento (deal en A1, contacto en B2) y qué
  pasa con un deal sin contacto, que su propio A3 permite.
- **Las tres carencias compartidas no están en su roadmap comprometido**, y lo dicen
  ellos. Deja de ser espera y pasa a ser decisión.

### 0.9.6 — 19 de agosto de 2026

**Por qué: `FIN-001` salió a producción**, y con ella se cierra el nivel 2. Verificado
contra `hogaru-1` en este orden: las dos callables vivas, el bundle nuevo sirviendo, y
solo entonces las reglas liberadas.

- `FIN-001` pasa de ✅ validada en staging a ✅ **en producción**. **Falta validarla a
  mano allí**, y el estado lo dice en vez de disimularlo: en staging ese paso encontró un
  defecto que 969 pruebas no vieron.
- **Queda demostrado por segunda vez que el orden de despliegue se invierte cuando la
  regla restringe.** Es la clase de regla que solo se aprende rompiéndola, así que está
  escrita dos veces a propósito.
- **Cae una creencia escrita: sí se puede saber qué front hay desplegado.** `/login`
  sirve 200 y sus chunks son públicos. La fecha del backend, en cambio, cambió a los ~45
  segundos del rollout: marca que arrancó, no que terminó — y era la señal en la que
  íbamos a apoyarnos para decidir cuándo soltar las reglas.
- **`REVOPS-000` se daba por pendiente en una nota de traspaso y estaba hecho desde el
  18.** Corregido. El fallo no es el de la semana pasada —deducir negocio de un dato
  técnico— sino arrastrar un estado por copia sin releer la fuente.

Lo siguiente por orden es el **nivel 3: cablear el precio**.

### 0.9.5 — 18 de agosto de 2026, noche

**Por qué: David validó `FIN-001` a mano en staging**, cobro y reversión. Ya no es
«desplegado sin validar», que es lo que decía la 0.9.4 — y la diferencia entre las dos
entradas es exactamente el trabajo que vale la pena.

- `FIN-001` pasa a ✅ **validada en staging**. Cobro de $430.000 sobre `T2-204`,
  comprobante emitido, reverso creado, totales del período en cero. **Producción sigue
  sin tenerla.**
- **La validación encontró un defecto de presentación en el libro** —el reverso pintaba
  `+-$430.000` en verde—, anterior a esta ficha (`72c3083`) y latente hasta que hubo
  reversos de pago que mirar. Arreglado en `8df5a4d`.

Vale la pena dejarlo escrito: el defecto **no lo cazó ninguna de las 969 pruebas**, lo
cazó una persona mirando una pantalla. Las pruebas cubrían la aritmética, que estaba
bien; lo que estaba mal era cómo se contaba.

### 0.9.4 — 18 de agosto de 2026, noche

**Por qué: `FIN-001` salió a staging**, las tres capas. Esta entrada existe sobre todo
para que el estado no se lea mejor de lo que es: **desplegado no es validado**, y aquí
solo está verificado que las callables responden `401` sin sesión.

- `FIN-001` pasa de ✅ construida a 🟡 **en staging, sin validar a mano**. Producción no
  la tiene.
- Se anota **por qué el orden de despliegue se invirtió** —functions → front → reglas— y
  la regla que lo generaliza: la que concede va antes del código que la necesita, la que
  restringe va después del código que dejó de necesitarla.
- Se anota también **lo que no se pudo verificar**: el CLI de App Hosting no dice de qué
  commit viene el build, y la ruta de finanzas redirige a login, así que desde fuera no
  hay forma de confirmar que el bundle traiga el código nuevo.

### 0.9.3 — 18 de agosto de 2026, noche

**Por qué: se construyó `FIN-001` entera**, aplicación y reversión. Verificado contra el
código en `66c03c7` y `75d9e47`, con el gate completo en verde y las pruebas del suelo de
cero comprobadas **por mutación** —se retira el `Math.max` y se ponen rojas—, porque una
prueba que no falla cuando debe no está probando nada.

**Lo que cambia en el inventario:**

- `FIN-001` pasa de 🔴 a ✅ **construida, sin desplegar**. Las dos rutas de pago ya no
  pueden discrepar: cartera y libro se escriben en una transacción, con la aritmética del
  saldo **en el servidor** y no en el navegador.
- Su ficha ahora dice **lo que quedó fuera**, que es la parte útil: el hueco en la serie
  fiscal si falla la emisión del comprobante, la nota de crédito manual que nadie
  persigue, y que **los asientos anteriores no son revertibles** por la vía nueva. Los
  tres son consecuencia de la decisión de alcance de David de no entrar en lo fiscal
  todavía, y ninguno tiene costo hoy porque no hay un solo pago real.

**Lo que NO cambia:** sigue sin desplegarse. El código está en `develop`, no en
producción, y el orden importa —reglas antes que functions antes que front—.

### 0.9.2 — 18 de agosto de 2026, noche

**Por qué: se hizo `REVOPS-000`.** Era el nivel 0, llevaba tres revisiones sin empezar y
bloqueaba el PRD de Albert. Su respuesta **corrige la premisa sobre la que este
documento razona desde la 0.6**.

**No son cinco personas vendiendo en tres países.** Es **una prospectando en frío**
—Daniel Aguilar, ~6-7 nombres, nada concreto— y **un acercamiento suelto** de David
Almeida. Jaime y Luis Otero no venden Vivaru; David Martínez acompaña y habilita el
producto. **Cero conversaciones maduras y cero firmados.**

**Qué cambia y qué no.** `REVOPS-001E` sigue siendo correcto —basta una venta para que
la comisión tenga dueño, y ese dato no se reconstruye— pero **la urgencia con la que este
documento lo vendió estaba inflada**: no había cinco comisiones en riesgo, había una
lista fría. El trabajo ya está hecho, desplegado y costó poco, así que no hay daño; lo
que hay es una lección repetida.

**Y es la tercera del mismo tipo esta semana**, lo que la convierte en patrón y no en
casualidad: la 0.5 dedujo «cero demanda» de «cero leads»; la 0.9.1 dedujo «conjunto real»
de «no marcado `isExample`»; y esta dedujo «cinco vendiendo» de «cinco en el catálogo».
**Las tres veces se infirió un hecho de negocio a partir de un dato técnico, sin
preguntárselo a quien lo sabía.** El coste de preguntar es una conversación; el de no
preguntar fueron tres correcciones.

**Lo que la conversación aportó, además de la cifra:**

- **Dónde anotan hoy:** Word para consolidar y WhatsApp para avisar, sin
  institucionalizar. Es el mejor escenario para adoptar herramienta: hay hábito de
  registrar, falta dónde.
- **Una regla de negocio que nadie había pedido:** la lista fría **no entra al CRM**.
  Define la puerta de entrada al pipeline —conversación e interés, no un nombre— y con
  eso el pipeline mide **oportunidades, no esfuerzo**.
- **Motivos de pérdida en sus palabras:** distanciamiento, y enganche con el proveedor
  actual por precio con costo de cambio. Se separan en el PRD porque son aprendizajes
  opuestos.
- **Lo que sigue sin dato:** el recorrido entre «hablé» y «firmó», porque **nadie ha
  firmado**. En el PRD va como hipótesis marcada, no como hecho.

**El PRD de Albert sube a 0.4** con el §5 completo, dos puertas más (G4 y G5) y una
etapa que solo puede existir aquí: **«en prueba»**, apoyada en la activación que el
producto ya calcula —7 pasos en la prueba, 10 en un cliente—. Es la única etapa del
pipeline que no depende de la opinión del comercial.

### 0.9.1 — 18 de agosto de 2026, noche

**Por qué: una corrección de hecho que David dio al revisar, y que invalida algo que
este documento repetía desde la 0.2.** No hay dos conjuntos reales en producción.
**No hay ninguno.** Los nueve son pruebas; siete llevaban la marca `isExample` y los
otros dos no, y de ahí salió la lectura equivocada — se dedujo «real» de «no marcado
como ejemplo», que no es lo mismo.

**Qué cambia, y es más de lo que parece:**

- **`AI-DATA-001` empeora su diagnóstico y mejora su claridad.** Decía que los dos
  conjuntos reales tenían cero tickets, lo que sugiere clientes callados. La verdad es
  más simple y más dura: **no hay clientes**. El bloqueo por datos no es de volumen, es
  de existencia.
- **`REVOPS-001E` pierde una deuda que creía tener.** La 0.9 anotaba que «los dos
  conjuntos reales se quedaron sin vendedor y no se puede arreglar desde la consola».
  **No hay nada que reatribuir.** Queda la deuda latente —no existe ruta de edición de
  `vendedorId`— pero sin urgencia: conviene resolverla antes del primer cliente, no
  ahora.
- **La línea base es cero en todas partes, sin matices.** Cero leads reales, cero
  conjuntos reales, cero tickets, cero comprobantes, cero conversiones. Eso refuerza el
  nivel 0 en lugar de debilitarlo: `REVOPS-000` no compite con nada.

**La lección de método, que ya ha aparecido dos veces esta semana:** `isExample` es una
marca que alguien pone a mano, y su ausencia **no es evidencia de lo contrario**.
Deducir «real» de «no marcado» es lo mismo que la 0.5 hizo al leer «cero leads» como
«cero demanda». Cuando el dato que importa es «esto es de verdad», hay que preguntarle a
quien lo sabe.

**Y llegó la ficha técnica de Albert**, que responde los cinco insumos que la 0.9 dejó
pedidos y corrige dos supuestos del PRD: «convertido» no vive en la colección `leads`
sino en el pipeline de deals (`Ganado`), y `crmRef` no puede ser un identificador plano
porque un deal vive bajo `tenants/{tenantId}/deals/{dealId}`. Detalle en el PRD 0.3.

### 0.9 — 18 de agosto de 2026, tarde

**Por qué:** se cerró el nivel 1 entero y se desplegó a producción. Las dos fichas que
faltaban —`REVOPS-001A` y `SUP-001`— pasaron de decididas a desplegadas el mismo día.

**Verificado contra:** `6207fa7` en `master` y `develop`; producción sirviendo el
código nuevo **comprobado por API** (`/api/demo` exigiendo el campo de consentimiento);
staging idéntico y validado a mano subiendo un comprobante; 151 pruebas de reglas en
emulador, 321 de functions, build limpio.

**Lo que queda tomado:**

- **`REVOPS-001A`.** La atribución se captura al ENTRAR al sitio, no al enviar el
  formulario — leerla al enviar daría «vino de Vivaru» a todo el que navegue antes de
  rellenar. Y se dejó **fuera** de la puerta de cookies a propósito: esa puerta es de
  analítica de terceros, y ponerla ahí dejaría sin atribuir a quien rechaza cookies y
  luego pide una demo. El consentimiento salió de `meta.respuestas` a campo propio con
  fecha de servidor y versión de política; el formulario de demo pasó a pedirlo, que no
  lo hacía. La respuesta automática al lead **ya existía**: la ficha la pedía de más.
- **`SUP-001`.** `firstResponseAt` se sella una vez y nunca se sobrescribe; la
  asignación automática no roba tickets ajenos. Ambas reglas viven en una función pura
  para poder probarlas sin emulador, porque son las que destruirían el dato si se
  equivocaran. Sin relleno hacia atrás, y la consola distingue «sin responder» de «sin
  dato» para no acusar de desatendidos a tickets contestados hace meses.
- **El eje «trabajo que caduca» quedó vacío.** Nació en la 0.5 con cuatro filas; las
  cuatro cerradas. Se conserva la sección, no el contenido.

**Tres averías que el despliegue destapó y que nadie veía:**

1. **`functions/lib` iba desfasado.** Está versionado y no hay predeploy que compile:
   los commits de `REVOPS-001E` y `SUP-001` tocaron `src/` sin reconstruirlo, así que un
   deploy desde un clon limpio habría subido functions **sin** `vendedorId` ni el
   sellado de SUP-001 — y se habría leído como «el código no funciona», no como
   «desplegué otra cosa».
2. **Staging llevaba sin poder construir**, por un permiso de IAM sobre el secreto de
   Resend. Anterior a esta sesión y sin diagnosticar.
3. **No hay forma de asignar vendedor a un conjunto ya creado.** `vendedorId` solo se
   escribe al nacer el conjunto, por los dos caminos de conversión; no existe ruta de
   edición. Los dos conjuntos reales de producción se quedaron sin él y **no se puede
   arreglar desde la consola**.

**Y el PRD de Albert subió a 0.2** con un hallazgo estructural: el canal asistido
produce leads que **hoy no pueden existir en Vivaru** —las reglas vetan la creación y no
hay alta manual—, así que la identidad cruzada que la 0.1 daba por supuesta no se
sostiene en esa dirección. Detalle en `docs/prd/albert/`.

### 0.8.1 — 18 de agosto de 2026, madrugada

**Por qué:** la deuda que la 0.8 dejó anotada en `FIN-000` se cerró en paralelo antes
de cerrar la sesión — la anotación se convirtió en tarea, la tarea en sesión, y la
sesión en `90dce82`: `support/` segmentada por quien sube, con la callable exigiendo
el uid del autor. Verificado junto a todo lo anterior: 151 pruebas de reglas en
emulador, typecheck de app y functions en 0.

### 0.8 — 17 de agosto de 2026, madrugada del 18

**Por qué:** sesión de construcción del nivel 1. Las dos fichas que no dependían de
nadie más pasaron de decididas a construidas, verificadas contra el emulador
(144 pruebas de reglas) y el build local.

- **`FIN-000` resuelto** — reglas por carpeta con filtro de rol, comprobantes por
  usuario, 47 casos verificados en las dos direcciones, y las reglas entran a CI en
  el job `rules-tests`. Queda el despliegue, con orden: primero código, después
  reglas.
- **`REVOPS-001E` construido** — `salesReps` como colección, dueño y `crmRef` en el
  lead, `vendedorId` por los dos caminos de conversión, página Comerciales y
  selectores. El esquema queda escrito una vez para dos destinos: Vivaru y el primer
  PRD de Albert.
- **Dos averías silenciosas cazadas de paso:** los scripts `test:rules*` no podían
  ejecutar nada desde hacía meses (la exclusión de vitest no se deshace desde la
  CLI — se creó `vitest.rules.config.ts`), y `markTrialAsLost` nunca marcó un lead
  como perdido (reglas en `write: false` + `catch` vacío).
- **Verificado contra:** `11e3bae` en `develop`, emulador de Firestore + Storage,
  `npm test` (los 7 fallos preexistentes siguen siendo los mismos 7), typecheck de
  functions en 0.

### 0.7 — 17 de agosto de 2026, noche

**Por qué:** dos decisiones de David al preparar la siguiente sesión, y una de ellas
resuelve una duda que la 0.6 había dejado abierta a propósito.

- **El catálogo de comerciales es una colección, no una enumeración.** «Debería crecer
  pero no de inmediato.» Con cinco personas la enumeración sería más simple hoy y una
  migración mañana; la colección cuesta lo mismo ahora.
- **Los leads de inbound llevan trazabilidad al CRM.** La 0.6 decía que la mitad del
  lead en `REVOPS-001E` **podía sobrar** si el recorrido acababa viviendo en Albert.
  **No sobra:** el lead necesita dueño y un sitio donde guardar su referencia en el
  CRM, y ese campo tampoco se rellena hacia atrás.
- **Panamá a la nevera.** Tarifado y en espera. Se marca resuelta en vez de borrarla:
  una pregunta que se contesta «no ahora» y desaparece se vuelve a formular en dos meses.

**Y una tercera decisión, que llegó después y cambia el marco entero de Albert:**
**Albert es de Qintilab**, y lo acordado con los socios no es conectarlo con Vivaru
sino **adaptarlo a las reglas de negocio de Vivaru** —una vista propia para su
naturaleza—, mediante **PRDs que Vivaru redacta y Albert desarrolla**. Con eso, la
pestaña de Leads sin desplegar **deja de ser un bloqueo y pasa a ser el primer PRD**, y
lo que se defina en `REVOPS-001E` sirve a los dos lados a la vez.

**Esto estrena una hipótesis que excede al CRM:** que las soluciones de Qintilab deben
adaptarse a la naturaleza de cada cliente en vez de al revés. **El riesgo queda
anotado:** se especificará un CRM a medida con cero recorrido comercial registrado, que
es diseñar sobre supuestos. La mitigación cambia el papel de `REVOPS-000`: la
conversación con los cinco comerciales pasa de línea base a **entrada de requisitos**, y
con eso sube de urgencia.

### 0.6 — 17 de agosto de 2026, noche

**Por qué:** al preguntar por la entrada que faltaba —si había relación comercial que
activar o había que crear la función de venta— David contestó que **ya está montada**:
dos KAM (México y Colombia) y tres socios de Qintilab atendiendo en directo, David en
México, Jaime en Colombia y David en Ecuador. Cinco personas, tres países.

**Lo que corrige, y es una corrección mía.** La 0.5 leyó «cero leads» como «cero
demanda» y construyó el nivel 0 sobre esa lectura. **Era errónea.** La colección `leads`
mide el landing y `/registro`, y **un KAM no rellena un formulario web**. Lo verificado
sigue en pie —la entrada por autoservicio es cero tras 16 días con la máquina pública—
pero sobre el canal asistido **no hay dato de ninguna clase, porque nada lo observa**.
No es que el embudo esté vacío: hay dos embudos y solo uno tiene medidor.

**Verificado en el código, y el resultado es pobre:** la palabra «KAM» aparece **una
vez en todo el repositorio**, como etiqueta de log en `src/app/api/lead/route.ts`. El
lead recorre `nuevo → contactado → calificado → convertido → perdido` **sin dueño**, así
que «contactado» no dice quién contactó. El aviso comercial va a un buzón compartido sin
enrutado por país. El enlace lead → conjunto sí existe —`createTenantFromLead` escribe
el `tenantId` sobre el lead—; el que falta es **KAM → lead**, y `createdBy` guarda el
superadmin que pulsó el botón, no quién vendió.

**Decisiones que quedan tomadas:**

- **`REVOPS-000` pasa de «activar el canal» a «instrumentar el que ya corre».** Su
  primer paso sigue sin ser código: preguntar a los cinco qué tienen en marcha. Ahí está
  la línea base que tres documentos pedían — no en Firestore, en cinco cabezas.
- **Cambia el primer puesto del trabajo que caduca.** Los `utm_*` responden «de dónde
  vino el clic» y solo aplican al autoservicio. **La propiedad comercial responde de
  quién es la comisión**, y aplica al canal que opera. En México el canal se lleva $24
  de un precio final de $51: lo que se pierde si llega tarde no es una métrica, es
  dinero de una persona concreta.
- **Nace `REVOPS-001E`**, el campo de dueño, en el nivel 1 y por delante de `001A`.
- **REVOPS entra en la cuenta de frentes con trabajo de ingeniería real**, que pasa de
  dos a tres: hay cinco personas vendiendo y el producto no sabe quiénes son.
- **Vuelve el paso cero de Albert**, retirado en la 0.4 porque importar los 5 leads
  falsos habría ensuciado el CRM. El argumento sigue siendo válido y el material ya no:
  si hay recorrido real repartido entre cinco cabezas, eso es justo para lo que sirve un
  CRM.

**Queda abierto y se cerró el mismo día:** la guía maestra tarifa **cuatro** países y
las personas cubren **tres**. Panamá, el único tarifado como *reseller*, **queda en la
nevera** por decisión de David — tarifado y en espera, sin consumir atención.

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
