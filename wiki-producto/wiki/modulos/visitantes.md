---
tags: [modulo, admin, visitantes, seguridad]
tipo: concepto
fuentes: ["domain.ts", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-31
---

# Visitantes

Módulo de control de acceso de visitantes (`/admin/visitors`). Permite al administrador y al guardia registrar entradas, verificar pases QR y consultar el historial de visitas. Opera en dos variantes (ver [[modulos-variantes]]): `qr_full` (pre-autorización + QR) o `registro_simple` (la portería registra al llegar y notifica, sin QR).

## Entidades principales

El tipo `VisitorPass` en [[domain-types]] define la entidad:
- `visitorName`, `documentNumber`: identificación del visitante
- `qrCodeValue`: código QR único para verificación
- `status`: scheduled | inside | completed
- `checkInAt?`, `checkOutAt?`: timestamps de entrada y salida
- `guardNotes[]`: observaciones del guardia

## Flujo de visita

1. El residente pre-registra una visita desde [[portal-residente]] con nombre y documento → genera `VisitorPass` en estado `scheduled`
2. El guardia verifica el QR en [[portal-guardia]] → estado pasa a `inside`
3. Al salir, el guardia registra el check-out → estado `completed`

## La visita que llega sin avisar (31 ago 2026)

Desde `PH-003`, el flujo de arriba **ya no es el único**. Toda visita nacía de la mano del
residente, con un QR emitido de antemano; la que se presenta en portería **sin avisar** —que es la
mayoría de las visitas reales de un conjunto— no tenía camino: el guardia la dejaba pasar por fuera
del sistema, o no la dejaba pasar. Bandera `producto-visita-no-anunciada`.

La portería captura los datos y elige **una de dos vías**, y son distintas a propósito:

| Vía | Quién autoriza | Espera | Qué queda escrito |
|---|---|---|---|
| **A · preguntar** | El residente, desde su teléfono | **5 minutos** | `authorizationMedium: "app"` y quién |
| **B · llamada** | El guardia, tras llamar por fuera | Ninguna | `authorizationMedium: "llamada"` y quién |

**Lo que hace útil el registro no es que la visita quede anotada, sino quién autorizó y por qué
medio.** Sin el medio, las dos vías serían indistinguibles y la constancia no valdría nada.

Cuatro cosas que conviene saber antes de tocarlo:

- **Convive con el QR** (`R8`). Antes esto exigía la variante `registro_simple`, que a su vez
  **oculta el QR**: los diecisiete conjuntos de los dos ambientes están en `qr_full`, así que con
  esa exclusividad **no lo habría visto nadie**.
- **El pase nace `scheduled`, no `inside`.** Antes se creaba con el ingreso ya puesto y el residente
  recibía un hecho consumado. **A `inside` solo se llega desde `autorizada`**, y lo comprueban la
  callable, la pantalla **y la regla de Firestore** — el registro de ingreso es escritura directa
  del guardia, así que sin esa regla la autorización sería decorativa.
- **La caducidad NO la escribe ningún proceso programado:** se deriva del sello de tiempo al leer.
  Un `pendiente` de hace una hora **es** `expirada` aunque nadie haya corrido nada. Y una expirada
  **no está resuelta**: el guardia la rescata por la vía B sin recapturar los datos.
- **Depende del push** ([[mobile-first-ios]]). Sin él, la petición de la vía A cae en una campana
  que nadie mira mientras alguien espera en la puerta — por eso solo se enciende donde el push está
  encendido.

> **Y un defecto que solo se vio abriendo la pantalla:** una visita de portería salía **«Expirado»
> en rojo al segundo de crearla**. La regla no estaba mal — «se pasó la hora de la cita» es correcta
> para un QR emitido de antemano, y **una visita de portería nace en el instante en que alguien está
> en la puerta**. Su vigencia la gobierna la autorización, no el reloj de una cita que no existe.
> Vive en `features/visitors/estado-operativo.ts`, con banco propio.

## Compartir QR

El QR generado puede ser compartido por el residente via Web Share API: `navigator.canShare({files})` → `navigator.share()` → fallback a `link.download`. Este patrón está documentado en [[mobile-first-ios]].

## Layout del módulo

Sigue el [[layout-patterns|patrón admin page]]: Card → filtros por estado y fecha → [[data-table-pattern|DataTable]] con `renderMobileRow`. Los estados usan [[componentes|StatusBadge]] con los colores semánticos de [[tokens-color]].

## Estado: ✅ fixes aplicados

Los fixes aplican filas compactas mobile, corrigen la visualización del QR y aseguran que el estado `inside` (visita activa) sea inmediatamente visible en el dashboard.

## Vista del guardia

El [[portal-guardia]] tiene acceso directo a este módulo como una de sus 4 funciones clave. Puede ver las visitas agendadas del día, escanear QR y añadir `guardNotes`.

## Relaciones

- Véase también: [[domain-types]], [[mobile-first-ios]], [[data-table-pattern]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[dashboard-admin]], [[componentes]]

## Fuentes

- [[domain-types]], [[design-md]], [[backlog-md]]
