# Módulos con variantes — Análisis, priorización y best-practice de configuración

> Fase de análisis (sin implementación). Objetivo: definir qué módulos de Vivaru tienen sentido
> como **variantes excluyentes** ("una en lugar de la otra"), priorizarlos, y decidir cuáles
> deben **fijarse al crear el conjunto** vs cuáles pueden **cambiarse después**, según el grado
> de afectación.
>
> Contexto de código: hoy la config vive en `tenantSettings/{tenantId}` como `residentModules`
> (4 booleanos, puro ON/OFF que solo oculta menú del residente). Las **variantes** son un
> concepto nuevo y paralelo (`moduleVariants`), porque cambian *comportamiento* en varias capas
> (guardia, residente, admin, reglas Firestore, notificaciones), no solo visibilidad.

---

## 1. Qué es una "variante" (y qué NO lo es)

- **Variante** = el módulo existe siempre, pero opera en **uno de dos (o más) modos excluyentes**
  que cambian el flujo. Ej: Visitas con QR **vs** registro simple del guardia.
- **No es variante** (es ON/OFF) = el módulo se muestra u oculta sin cambiar su lógica. Ej:
  Reglamento, Servicios. Eso ya lo cubre `residentModules`.
- **No es variante** (es ajuste/preferencia) = parámetros sueltos. Ej: bloquear reservas por mora,
  color de marca, canal de notificación. Eso son settings, no modos.

Criterio de oro: *si dos clientes querrían el mismo módulo pero con flujos sustancialmente
distintos, y elegir uno descarta el otro → es candidato a variante.*

---

## 2. Catálogo de módulos candidatos a variantes

Para cada uno: los modos, a quién sirve cada modo, y las **capas que toca** (= esfuerzo/riesgo).

### 2.1 Visitas  ⭐ (piloto)
- **Modo A — QR / Control completo** (hoy): residente pre-autoriza, QR, check-in/out, larga duración.
- **Modo B — Registro simple**: el guardia registra la visita al llegar (nombre, doc, unidad,
  a quién visita) → queda en el tablero + notifica al residente. Sin QR, sin pre-autorización.
- **Sirve a:** A = conjuntos con control estricto / muchas torres. B = conjuntos pequeños o que
  quieren cero fricción ("solo que quede registrado y avisen").
- **Capas:** Guardia (UI), Residente/Admin (creación), datos (`visitorPasses` sin QR), **reglas
  (guardia debe poder *crear* pases en B)**, notificaciones.
- **Afectación al cambiar de modo:** Media (QRs/autorizaciones activas quedan en vuelo).

### 2.2 Paquetería
- **Modo A — Recepción con evidencia**: foto del paquete + firma de quien retira + estados
  (en bodega → entregado) + notificación.
- **Modo B — Aviso simple**: el guardia marca "llegó paquete para la unidad X" → notifica al
  residente. Sin foto, sin firma, sin flujo de retiro.
- **Sirve a:** A = conjuntos con bodega y volumen. B = conjuntos chicos sin bodega formal.
- **Capas:** Guardia (UI), datos (campos opcionales), notificaciones. **No toca finanzas ni legal.**
- **Afectación al cambiar:** Baja (solo cambia el flujo futuro; lo pasado sigue válido).

### 2.3 PQRS (peticiones/quejas)
- **Modo A — Con SLA**: código único, categorías, **semáforo de 15 días**, auditoría, reasignación.
- **Modo B — Buzón simple**: el residente envía un mensaje/queja, el admin responde. Sin código,
  sin SLA, sin categorías.
- **Sirve a:** A = administradoras profesionales / conjuntos grandes. B = comunidades pequeñas.
- **Capas:** Residente (UI), Admin (bandeja), datos (SLA opcional), reportes.
- **Afectación al cambiar:** Media (PQRS abiertos con SLA quedarían sin semáforo si pasa a B).

### 2.4 Comunicaciones
- **Modo A — Canal oficial**: comunicados con vigencia, **confirmación de lectura**, segmentación
  por torre/unidad.
- **Modo B — Tablón simple**: muro de anuncios; se publica y se ve. Sin tracking de lectura.
- **Sirve a:** A = quien necesita evidencia ("lo comuniqué y lo leyeron"). B = quien solo quiere avisar.
- **Capas:** Residente (UI), Admin (composición), datos (estados de lectura opcionales).
- **Afectación al cambiar:** Baja (lo publicado sigue visible; solo cambia el tracking futuro).

### 2.5 Reservas de amenidades
- **Modo A — Calendario en vivo**: disponibilidad en tiempo real, reglas, bloqueo por mora,
  confirmación automática.
- **Modo B — Solicitud + aprobación**: el residente solicita, el admin aprueba manualmente.
  Sin calendario en vivo.
- **Sirve a:** A = conjuntos con muchas amenidades y demanda. B = conjuntos con 1–2 áreas y bajo volumen.
- **Capas:** Residente (UI), Admin (aprobaciones), datos (estado "solicitada").
- **Afectación al cambiar:** Media (reservas/solicitudes en curso).

### 2.6 Finanzas / Cartera  (alto valor, alta afectación)
- **Modo A — Gestión completa**: cobros recurrentes, conciliación, comprobantes, intereses de
  mora, reportes para asamblea.
- **Modo B — Solo consulta / informativo**: el admin publica el estado de cuenta (carga manual),
  el residente lo consulta. Sin conciliación ni cobros automáticos.
- **Sirve a:** A = administradoras que cobran y concilian. B = conjuntos que llevan la plata
  aparte y solo quieren transparentar saldos.
- **Capas:** **Todas** + semántica financiera + reportes + reglas. La de mayor blast radius.
- **Afectación al cambiar:** **Alta/estructural** (cambiar a media vida contradice histórico contable).

### 2.7 Gobernanza — Acuerdos / Votaciones
- **Modo A — Formal con firma/quórum**: acuerdos requieren **firma digital**; votaciones con
  coeficientes, quórum y acta.
- **Modo B — Informativo**: se publican acuerdos y encuestas simples, sin firma ni validez formal.
- **Sirve a:** A = conjuntos que exigen formalidad legal. B = comunidades informales.
- **Capas:** Admin, residente, datos (firmas/votos), **semántica legal**.
- **Afectación al cambiar:** **Alta** (firmas/votos emitidos tienen validez; no se "deshacen").

---

## 3. Priorización

Marco de scoring (Alto/Medio/Bajo). **Prioridad** = alta demanda del modo simple × valor ×
bajo esfuerzo × bajo riesgo.

| # | Módulo | Demanda del "modo simple" | Valor / diferenciación | Esfuerzo | Riesgo (blast radius) | **Prioridad** |
|---|---|---|---|---|---|---|
| 1 | **Visitas** | Alta | Alto | Medio | Medio | **P0 — piloto** |
| 2 | **Paquetería** | Alta | Medio | **Bajo** | **Bajo** | **P1** |
| 3 | **PQRS** | Media-Alta | Alto | Medio | Medio | **P1** |
| 4 | **Comunicaciones** | Media | Medio | Bajo | Bajo | **P2** |
| 5 | **Reservas** | Media | Medio | Medio | Medio | **P2** |
| 6 | **Finanzas / Cartera** | Media | **Muy alto** | **Alto** | **Alto** | **P3** |
| 7 | **Gobernanza (firma/votos)** | Baja | Medio | Alto | Alto | **P3** |

### Orden de ejecución recomendado
1. **Visitas (P0)** — ya elegido; valida el patrón completo (incluye el caso difícil: cambio de
   reglas para que el guardia pueda *crear*).
2. **Paquetería (P1)** — segundo piloto ideal: **reusa casi todo el patrón de Visitas**, bajo
   riesgo, alta demanda. Consolida el mecanismo `moduleVariants` con poco esfuerzo.
3. **PQRS (P1)** — primer caso "no-guardia" (residente↔admin), prueba el patrón en otra dupla.
4. **Comunicaciones / Reservas (P2)** — cuando el patrón esté maduro.
5. **Finanzas (P3)** — al final y con diseño dedicado: es la de mayor valor pero toca dinero;
   merece su propio plan y se fija al crear (ver §4).

> Recomendación: arrancar con **Visitas + Paquetería** como par. Son gemelas operativas (guardia →
> registro → notificación) y juntas dejan el patrón `moduleVariants` probado y reutilizable con
> el mínimo riesgo.

---

## 4. Best practice: ¿se fija al crear o se puede cambiar después?

Principio rector — **a mayor afectación a datos históricos / semántica financiera o legal, más
debe fijarse al crear**. A menor afectación (solo cambia el comportamiento futuro), más libre es
cambiarlo.

Tres niveles:

| Nivel | Regla | Qué pasa con el cambio |
|---|---|---|
| **🔒 Estructural — se fija al crear** | Toca dinero, cuotas, votos o firmas (semántica contable/legal) | Solo cambia vía **migración asistida**; no es un toggle |
| **⚠️ Operacional con resguardo — editable con advertencia** | Deja datos "en vuelo" (QRs activos, PQRS abiertos) pero no corrompe semántica | Se permite cambiar, con **aviso** y manejo de los registros en curso |
| **✅ Operacional libre — editable cuando sea** | Solo cambia el flujo futuro; lo pasado sigue siendo válido | Cambio inmediato, sin riesgo |

### Clasificación por módulo

| Módulo | Nivel | Best practice | Por qué |
|---|---|---|---|
| **Paquetería** | ✅ Libre | Editable en cualquier momento | Pasar de "con foto" a "aviso simple" no invalida paquetes previos |
| **Comunicaciones** | ✅ Libre | Editable en cualquier momento | Lo publicado sigue visible; solo cambia el tracking de lectura futuro |
| **Visitas** | ⚠️ Con resguardo | Se elige al crear **y** es editable con aviso | Cambiar deja QRs/autorizaciones activas; al cambiar a simple hay que cerrarlas/avisar |
| **PQRS** | ⚠️ Con resguardo | Editable con aviso | PQRS abiertos con SLA quedan sin semáforo al pasar a buzón → avisar y resolver primero |
| **Reservas** | ⚠️ Con resguardo | Editable con aviso | Reservas/solicitudes en curso deben respetarse o migrarse |
| **Finanzas / Cartera** | 🔒 Estructural | **Se fija al crear** | Cambiar a media vida contradice histórico contable y reportes de asamblea |
| **Gobernanza (firma/votos)** | 🔒 Estructural | **Se fija al crear** | Firmas y votos emitidos tienen validez legal; no se rehacen |

### Cómo se traduce en el flujo de alta
- **Al crear el conjunto** (hoy `createTenantWorkspace`, superadmin): se eligen **todas** las
  variantes — las 🔒 quedan **bloqueadas** después; las ⚠️ y ✅ quedan como **default editable**.
- **Después, desde el configurador del admin**: solo aparecen editables las ⚠️ (con modal de
  advertencia + chequeo de registros en vuelo) y las ✅ (cambio directo). Las 🔒 se muestran como
  "definido al crear el conjunto — contactar soporte para cambiar".

---

## 5. Modelo de datos propuesto (para cuando aprobemos el piloto)

```ts
// tenantSettings/{tenantId}
moduleVariants?: {
  visitors:   "qr_full" | "registro_simple";        // ⚠️ default editable
  packages:   "con_evidencia" | "aviso_simple";     // ✅ editable
  pqrs:       "con_sla" | "buzon_simple";            // ⚠️ editable
  finance:    "completa" | "solo_consulta";          // 🔒 fija al crear
  // ...se extiende por módulo
};
```

- Un **accesor compartido** (`getModuleVariant(settings, "visitors")`) con defaults, análogo a
  cómo `residentModules` aplica `DEFAULT_RESIDENT_MODULES`.
- Cada capa (guardia/residente/admin/reglas) ramifica por la variante.
- `createTenantWorkspace` **sí** inicializa `moduleVariants` (hoy no inicializa nada → lo agregamos).

---

## 6. Decisiones para pasar al plan de implementación
1. ¿Confirmas arrancar el par **Visitas (P0) + Paquetería (P1)** como pilotos del patrón?
2. ¿De acuerdo con que **Finanzas y Gobernanza se fijen al crear** (no editables por el admin)?
3. ¿El selector de variantes al crear lo ponemos en el **alta de superadmin**, o queremos además
   un paso de **onboarding del admin** para las editables?

Con eso escribo `docs/plan-modulos-variantes-visitas.md` (implementación del piloto).
