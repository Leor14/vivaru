---
tags: [arquitectura, configuracion]
tipo: concepto
fuentes: ["domain-types", "sesion-modulos-variantes-2026-06"]
fecha_creacion: 2026-06-27
fecha_actualizacion: 2026-06-27
---

# Módulos con variantes (moduleVariants)

Segundo eje de configuración por conjunto, **paralelo** a los toggles ON/OFF de
[[configuracion]]. Mientras `residentModules` solo **muestra u oculta** una pantalla del
[[portal-residente]], `moduleVariants` define el **modo de operación** de un módulo: cambia su
comportamiento en varias capas (guardia, residente, admin, reglas, notificaciones), no solo su
visibilidad. La idea es ofrecer un módulo en **una variante en lugar de otra** según el tipo de
cliente: unos conjuntos quieren control estricto, otros algo más simple.

## Modelo de datos

Vive en `tenantSettings/{tenantId}.moduleVariants`, junto a `residentModules` (ver
[[multi-tenancy]] y [[domain-types]]). La fuente de verdad de tipos/defaults/editabilidad es
`src/lib/config/module-variants.ts`:

```ts
moduleVariants: {
  visitors:  "qr_full" | "registro_simple";   // piloto
  packages:  "con_evidencia" | "aviso_simple"; // piloto
  finance:   "completa" | "solo_consulta";      // estructural (fijo al crear)
  governance:"formal" | "informativo";          // estructural (fijo al crear)
}
```

**Compatibilidad sin migración:** el accesor `getModuleVariant()` aplica el default cuando el
campo falta, así que los conjuntos existentes quedan en el modo vigente (`qr_full`,
`con_evidencia`). El hook `useModuleVariant(tenantId, key)` lo expone en tiempo real al cliente.

## Editabilidad por grado de afectación

`VARIANT_EDITABILITY` codifica la regla: a mayor afectación a datos históricos o semántica
financiera/legal, más se fija al crear el conjunto.

- **locked** (`finance`, `governance`) — se eligen solo al crear; el admin no los cambia.
- **warn** (`visitors`) — editable con modal de advertencia (deja datos en vuelo: QR activos).
- **free** (`packages`) — cambio directo; lo pasado sigue válido.

## Dónde se configura

- **Al crear el conjunto:** alta de [[superadmin]] (`createTenantWorkspace`), que ahora inicializa
  `tenantSettings` con las variantes elegidas.
- **Después:** [[configuracion]] del admin, pestaña "Módulos" (las `locked` aparecen como solo
  lectura).

## Pilotos implementados

- **[[visitantes]] — `registro_simple`:** la portería ([[portal-guardia]]) registra la visita al
  llegar (estado `inside`, sin QR) vía la Cloud Function `registerWalkInVisit`, que notifica al
  residente (ver [[notificaciones-residentes]]). En este modo, residente y admin quedan en solo
  lectura. La creación usa Admin SDK para evitar abrir las reglas de [[firebase-firestore]].
- **[[paquetes]] — `aviso_simple`:** la portería entrega de un toque ("Marcar entregado"), sin
  elegir destinatario ni confirmación del residente. La notificación ya la dispara el trigger
  `onPackageCreated`.
- **[[pqrs]] — `buzon_simple`:** el módulo se vuelve un buzón de mensajes. Se ocultan el semáforo
  SLA (15 días), las categorías/tipo y el radicado, tanto en el residente como en el admin. El
  residente envía asunto + mensaje y el admin responde. Solo cambia la UI; el dato no cambia.
- **[[comunicaciones]] — `tablon_simple`:** muro de publicar-y-ver. Se ocultan la vigencia/
  programación (fechas inicio/fin) y los estados Programado/Vencido; los comunicados se publican
  directo. Nota: el seguimiento de lectura (read receipts) aún no existe en el módulo, por lo que
  `canal_oficial` se enmarca en vigencia/programación, no en confirmación de lectura.
- **Gobernanza ([[reglamento]]) — `informativo`:** los acuerdos de comité se publican sin firma.
  El alta de acuerdos fuerza la modalidad a `informativo` y oculta Modalidad/Firmantes; el tablero
  de firmas y la firma del residente ya estaban gateados por `signatureMode` por-acuerdo. Encuestas
  sin cambios (no hay votación formal/quórum). Es **estructural (`locked`)**: se fija al crear.
- **[[billing|Finanzas]] — `solo_consulta`:** la cartera se administra fuera de Vivaru; el conjunto
  solo consulta saldos y comprobantes. Por su tamaño (~40–50 archivos) se hizo en 3 fases: **(1)**
  navegación — el sidebar oculta Egresos/Libro/Conciliación (`buildAdminSidebarGroups`); **(2)** en
  `/admin/billing` se ocultan crear/programar cobros, cierre de períodos y avisos masivos, con un
  banner "Modo consulta" (quedan tableros, tabla de cartera, morosos y revisión de comprobantes);
  **(3)** guards en las Cloud Functions `notifyBillingBatch`/`sendBillingReminder`. Es **estructural
  (`locked`)**: se fija al crear.

## Cómo extender

Añadir la clave a `ModuleVariants` + valores + metadatos en `module-variants.ts`, ramificar el
comportamiento por capa, y (si hay creación por rol no permitido en reglas) preferir una Cloud
Function con Admin SDK, o gating por **fases** cuando el blast radius es grande (como
[[billing|Finanzas]]: navegación → acciones en página → guards de funciones). Los 6 módulos del
catálogo ya tienen variante (ver [[estado-modulos]]).
