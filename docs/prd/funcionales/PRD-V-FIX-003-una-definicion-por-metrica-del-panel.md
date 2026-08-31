# PRD-V-FIX-003 — Una sola definición por métrica del Panel de Control

| | |
|---|---|
| **ID** | `PRD-V-FIX-003` (tentativo hasta registrarlo en `docs/prd/README.md`) |
| **Tipo** | `FIX` — corrección estructural: el mismo indicador se muestra con dos ventanas distintas y el mismo rótulo, en dos pantallas contiguas |
| **Portales** | **`ADMIN`** (alcance: Panel de Control y Cartera) · `RESIDENTE`, `PORTERIA`, `SUPERADMIN` (no tocados) |
| **Módulo** | Panel de Control · Cartera · PQRS |
| **Usuario principal** | `tenant_admin` — es quien toma decisiones con estos números |
| **Usuarios secundarios** | Ninguno. El consejo no alcanza el panel (`canAccessPath` lo deja solo en `/admin/documents`) |
| **Responsable** | David |
| **Estado** | Lista para desarrollo |
| **Dependencias** | Ninguna bloqueante. Continúa `UX-003`, misma familia de defectos |
| **Riesgo** | **Bajo en ejecución, alto en consecuencia.** No toca datos, reglas ni dinero: cambia qué número se muestra. Pero los números que corrige son los que sostienen decisiones de cobranza |
| **Reversibilidad** | **Total.** Front exclusivamente: sin migración, sin reglas, sin functions, sin bandera. Se revierte con un rollout al commit anterior |
| **Fase comercial** | Todos los planes |

---

## 1. Resumen ejecutivo

El Panel de Control y el módulo de Cartera muestran **un indicador con el mismo rótulo — «% recaudo» — calculado sobre ventanas de tiempo distintas**: el panel mide **un mes**, cartera mide **hasta doce períodos**. Ninguno de los dos dice cuál. Medido el 30 de agosto de 2026 contra `hogaru-1`, **divergen en los siete conjuntos de producción**.

Además, **el panel no distingue «0% porque nadie pagó» de «0% porque no hay nada que cobrar»**, y pinta el segundo caso en rojo. Hoy, en cuatro de los siete conjuntos, el panel afirma en rojo que el recaudo es 0,0% cuando no existe ni un cobro emitido ese mes.

Esta PRD no inventa métricas nuevas ni cambia ninguna fórmula: **fija que cada indicador declare su ventana y que el «sin datos» deje de disfrazarse de «lo peor»**.

## 2. Problema y baseline

### 2.1 Lo que ya está bien, y por qué importa decirlo

La aritmética **ya está unificada**. `statementChargedAmount`, `statementCollectedAmount` y `statementSettledAmount` viven en `src/features/billing/collection.ts`, y las usan tanto `computeCollectionSummary` (panel, reporte de comité) como `buildBillingTrend` (cartera). **No hay dos fórmulas compitiendo**, y `tests/kpi-definitions.test.ts` ya las vigila.

**El defecto no está en el cálculo, está en el recorte y en el rótulo.** Diagnosticarlo como «dos fórmulas» habría llevado a reescribir aritmética correcta.

### 2.2 Baseline medido — `hogaru-1`, 30 de agosto de 2026

«% recaudo» del panel (mes en curso) contra «% recaudo» de Cartera (rango por defecto: los últimos 12 períodos disponibles):

| Conjunto | Panel | Cartera | Diferencia |
|---|---|---|---|
| `tenant-palmas-cdmx` | **0,0%** 🔴 | 50,0% | 50 puntos |
| `tenant-nogal-bogota` | **0,0%** 🔴 | 50,0% | 50 puntos |
| `conjunto-las-playas` | **100,0%** 🟢 | 76,6% | 23 puntos |
| `queretarock-229-fc4c57` | 50,0% | 66,7% | 17 puntos |
| `residencial-qintilab-mx-9c1293` | 50,0% | 66,7% | 17 puntos |
| `tenant-santa-maria` | **0,0%** 🔴 | 1,0% | 1 punto |
| `pXHEn5iWKWgX4sDF9tVp` | **0,0%** 🔴 | 100,0% | 100 puntos |

**Siete de siete divergen. Ninguno coincide.**

**La causa del 0,0%:** el panel mide agosto de 2026 y **la mayoría de conjuntos no tiene ningún cobro de agosto**. Sin facturado, la tasa es 0 — que es correcto como número y falso como afirmación.

### 2.3 El tercer desajuste, ya documentado

**El mismo ticket cambia de nombre según dónde se mire.** El widget de antigüedad del panel tiene su propio mapa con `other: "Otros"`; `src/features/pqrs/ticket-status.ts` resuelve `other` como **«General»**. Está escrito en ese fichero (líneas 23-30) que se unificaron dos de las tres copias y **el widget se dejó fuera a propósito**, porque obligaba a una decisión de copy. Esta PRD la toma.

### 2.4 Volumen y coste de no arreglarlo

Producción no tiene clientes hoy, así que **el coste actual es cero y el momento es el más barato posible**. El coste futuro no lo es: el «% recaudo» es el número con el que un administrador decide a quién cobrar. Dos cifras contradictorias del mismo concepto, a un clic de distancia, destruyen la confianza en las dos.

## 3. Usuarios, roles y permisos

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| `tenant_admin` | Panel de Control y Cartera de **su** conjunto | Cambiar la ventana de actividad (Hoy / Este mes / Mes pasado) y el rango de cartera | Cambiar la definición de una métrica; no hay configuración de métricas |
| `resident` | Nada de esto | — | Alcanzar `/admin/*` |
| `security_guard` | Su propio panel de portería, no tocado | — | Alcanzar el panel del administrador |
| `superadmin` | El panel de cualquier conjunto que administre | Lo mismo que `tenant_admin` | — |
| Consejo | **Nada**: `canAccessPath` lo deja solo en `/admin/documents` | — | Alcanzar el panel. Si algún día lo alcanza, será por `PLAT-004`, no por esta PRD |

**Esta PRD no cambia ningún permiso.** Es presentación.

## 4. Objetivo, alcance y exclusiones

**Objetivo:** que dos números con el mismo nombre, en pantallas distintas, o coincidan o digan por qué no.

**Entra:**
1. Todo indicador porcentual o agregado del panel **declara su ventana en el propio rótulo o subtítulo**, y cartera hace lo mismo.
2. El tono de color **distingue «sin datos» de «cero medido»**.
3. La tercera copia del rótulo de tipo de ticket se unifica.
4. Un guardián que **mide el código**, no una lista escrita a mano.

**No entra, y por qué:**
- **Cambiar la aritmética** de `collection.ts`: es correcta y está probada.
- **Unificar la ventana** haciendo que panel y cartera midan lo mismo: son preguntas distintas y legítimas —«cómo va este mes» y «cómo va el histórico»—. Se resuelve nombrándolas, no fusionándolas.
- **Configurar tableros** (frente 3, futuro `UX-005`).
- **Cualquier métrica de portería, residente o superadmin.**

## 5. Flujo funcional

No hay flujo nuevo: es lectura. El camino afectado es *el administrador abre el Panel de Control → lee un indicador → hace clic y llega al módulo → lee el mismo indicador*.

Casos límite que hoy están mal resueltos:

| Caso | Hoy | Debe |
|---|---|---|
| Conjunto sin cobros en el mes medido | «0,0%» en rojo | Un estado explícito de **sin datos**, en neutro, distinguible de un cero real |
| Conjunto con cobros y ninguno saldado | «0,0%» en rojo | Igual que hoy: **rojo es correcto aquí** |
| Panel y módulo abiertos a la vez | Dos cifras distintas, sin explicación | Cada una con su ventana visible |
| Ticket de tipo `other` | «Otros» en el panel, «General» en PQRS | El mismo rótulo en los dos |

## 6. Estados y transiciones

No introduce estados. **Sí introduce una distinción que hoy no existe** en la presentación de un indicador porcentual:

| Situación | Condición | Tono |
|---|---|---|
| **Sin datos** | `charged === 0` (no hay nada facturado en la ventana) | Neutro, y el valor no se presenta como porcentaje comparable |
| **Medido** | `charged > 0` | La escala vigente: ≥70 bien · ≥40 atención · resto mal |

El dato que lo decide **ya está disponible**: `CollectionSummary.charged`. El consumidor no lo mira.

## 7. Contrato de datos y multi-tenancy

**No se crea ni se modifica ninguna colección, ningún campo y ningún índice.** No hay retención ni borrado que declarar.

Las consultas existentes ya filtran por `tenantId` a través de los hooks (`useBillingStatements`, `useTickets`, `usePackages`, `useReservations`, `useVisitorPasses`) y esta PRD **no las toca**.

**Suspendido y vencido:** el panel es lectura y sigue mostrándose igual; `tenantOperable` no aplica porque no hay escritura. **En prueba:** los módulos en vista previa ya deciden qué se ve; esta PRD no cambia esa lógica.

## 8. Reglas de negocio

- **R1** — Dos indicadores con el mismo rótulo en pantallas distintas **miden la misma ventana, o cada uno declara la suya de forma visible**.
- **R2** — Un indicador porcentual **sin nada que medir no se pinta con el color de «mal»**. `colorPorPorcentaje` ya cumple esta regla; `tonoPorPorcentaje` no puede cumplirla porque no recibe el total.
- **R3** — Un mismo valor de dominio (`other`) **tiene un único rótulo en todo el producto**.
- **R4** — Un agregado sin ventana declarada (**«Cartera total»**, que hoy suma todo el histórico) **dice que es acumulado**.

## 9. Notificaciones y correo

Ninguna. Esta PRD no envía nada a nadie.

## 10. Criterios de aceptación

**CA1** — Abierto el Panel de Control y Cartera del mismo conjunto, **cada «% recaudo» muestra visiblemente la ventana que mide**. Verificable en `tenant-palmas-cdmx`, donde hoy dicen 0,0% y 50,0% sin explicación.

**CA2** — En un conjunto **sin cobros emitidos en la ventana medida**, el indicador **no se pinta en rojo** y comunica que no hay datos. Verificable hoy en Palmas, Nogal, Santa María y `pXHEn5i…`.

**CA3** — En un conjunto **con cobros y nada saldado**, el indicador **sigue pintándose en rojo**. Es el caso que CA2 no debe romper.

**CA4** — Un ticket de tipo `other` muestra **«General»** en el widget de antigüedad del panel, igual que en `/admin/pqrs`. Hoy el widget dice «Otros».

**CA5** — «Cartera total» del panel **declara que es un acumulado sin ventana**.

**CA6** — Existe una prueba que **falla** si alguien vuelve a pintar un porcentaje sin pasarle el total.

**CA7** — Existe un guardián que **recorre el código** buscando rótulos de indicador duplicados y falla si encuentra uno definido en dos sitios. **Debe fallar también si su recolección queda vacía** — el patrón de `tests/status-mapper-cobertura.test.ts`, que lleva dentro la comprobación de que encontró algo.

### Casos que DEBEN fallar

**CF1** — Poner el tono constante otra vez: la prueba de CA2 **debe fallar**.
**CF2** — Devolver al panel la ventana sin rótulo: la prueba de CA1 **debe fallar**.
**CF3** — Vaciar la recolección del guardián de CA7: **debe fallar igualmente**.
**CF4** — Devolver `other: "Otros"` al widget: CA4 **debe fallar**.

> **La reversión de cada falsación se hace por EDICIÓN.** `git checkout` sobre un fichero sin commitear ya se llevó un bloque entero de reglas en este repositorio.

## 11. Arquitectura y dependencias

### Decisión cliente contra callable

**Escritura directa: ninguna. No aplica callable, y hay que justificarlo:** esta PRD no escribe. Es presentación sobre datos que el cliente ya lee con permisos ya probados. Meter una Cloud Function aquí añadiría latencia y superficie sin proteger nada — **no hay nada que un cliente pueda falsificar, porque no hay nada que se guarde**.

### Qué se toca

| Fichero | Qué |
|---|---|
| `src/lib/dashboard/umbrales.ts` | `tonoPorPorcentaje` pasa a recibir el total, como ya hace su vecina `colorPorPorcentaje` — **que resuelve bien este caso y explica por qué en un comentario, diez líneas más abajo** |
| `src/app/(admin)/admin/page.tsx` | Rótulos con ventana (§549-585) y el agregado de cartera (§370) |
| `src/app/(admin)/admin/billing/page.tsx` | Rótulo del StatTile «% recaudo» (§1315) con su rango |
| `src/components/features/admin/dashboard/pqrs-aging-widget.tsx` | Elimina su mapa propio y consume `ticket-status.ts` |
| `tests/` | Guardián de CA7 y pruebas de CA1–CA6 |

**Se reutiliza y no se toca:** `computeCollectionSummary`, `buildBillingTrend`, `statementChargedAmount`, `statementSettledAmount`, `TICKET_TYPE_LABELS`.

### Decisión de copy — TOMADA (David, 30 ago 2026)

**`other` se llama «General».** Es lo que ya dicen dos de los tres sitios —el módulo de PQRS y el asistente de IA— y el valor por defecto de `getTicketTypeLabel`, así que **el cambio toca un solo sitio: el widget de antigüedad**, que pierde su mapa propio. La alternativa («Otros») habría tocado dos sitios y desalineado el asistente.

## 12. Riesgos y mitigaciones

| Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|
| **Arreglar CA2 y romper CA3** — que el cero real deje de verse mal. Es exactamente la regresión que `UX-003` ya cometió con las barras (color correcto, información perdida) | CA3 en rojo | CA3 existe para esto y CF1 lo falsa |
| Los rótulos con ventana alargan las tarjetas y rompen la retícula | Revisión en pantalla, no en test | Verificar en el navegador antes de desplegar |
| El guardián de CA7 nace ciego, como ya nacieron dos pruebas de `UX-003` | CF3 | CF3 es obligatorio, no opcional |
| Cambiar «Otros» por «General» descoloca a quien ya lo leía | Ninguna: no hay clientes | Momento más barato posible |

## 13. Despliegue, rollback y Story Map

**Orden:** **solo front.** No hay reglas ni functions, así que el orden clásico no aplica y decirlo evita un despliegue ceremonial de dos pasos vacíos.

**Producción no se despliega con push a `master`:** rollout manual, y **se espera por nombre contra su recurso exacto** — la lista de rollouts está paginada y sin ordenar.

**Rollback:** rollout al commit anterior. Sin datos que revertir. **No lleva bandera**, y es deliberado: una bandera para un cambio de rótulo es una bandera que nadie apagará nunca.

**Qué se valida solo en producción:** los siete conjuntos con sus cifras reales. Staging tiene otros datos y no reproduce el caso de Palmas.

**MVP:** CA1–CA7 y las cuatro falsaciones.
**Fase 2:** ninguna. Esta ficha se cierra entera o no se cierra.

---

## Puertas

| Puerta | Estado | Nota |
|---|---|---|
| `G0 Necesidad` | ✅ | Siete de siete conjuntos divergen; cuatro con rojo falso. Medido, no supuesto |
| `G1 Valor` | ✅ | Baseline en §2.2. La métrica de éxito es binaria: los dos números coinciden o declaran su ventana |
| `G2 Datos y permisos` | ✅ | No toca datos ni permisos, y se declara explícitamente |
| `G3 Riesgo` | ✅ | Reversible con un rollout; sin migración |
| `G4 Aceptación` | ✅ | CA1–CA7 con cuatro casos que deben fallar |
| `G5 Operación` | ✅ | Lo opera el `tenant_admin` leyendo su panel. No añade trabajo diario a nadie |
| `G6 Escala` | ✅ | Sin consultas nuevas |

## Preguntas abiertas

**Ninguna.** La única que tuvo esta ficha —cómo llamar a `other`— la cerró David el 30 de agosto de 2026: **«General»**. Ver §11.
