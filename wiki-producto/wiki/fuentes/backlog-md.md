---
tags: [fuente, backlog, estado]
tipo: fuente
fuentes: ["BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Fuente: BACKLOG.md

Registro del estado actual de todos los módulos del producto. Distingue entre módulos con fixes aplicados (✅) y módulos pendientes de critique y corrección (🔲).

## Contenido principal

BACKLOG.md es la referencia operativa para saber qué parte del producto está lista para producción y qué requiere trabajo. Se actualiza después de cada sesión de corrección. El estado completo procesado vive en [[estado-modulos]].

## Estado por portal

### Portal Admin (`/admin`)
Los módulos terminados son [[dashboard-admin]] (fixes aplicados), [[usuarios]] (card mobile + skeleton), [[configuracion]] (skeleton + footer mobile), [[visitantes]] (fixes aplicados), [[billing]] (fixes aplicados), [[pqrs]] (tabla mobile corregida), y Residentes/Unidades (filas compactas mobile).

Los módulos pendientes de critique son: [[reservaciones]], [[paquetes]], [[comunicaciones]], [[encuestas]], [[reglamento]] y [[reportes]].

### Portal Residente (`/resident`)
Estado: ✅ fixes mobile aplicados. Cubre pantallas de inicio, estado de cuenta, pago de cuotas, reservas, PQRS y paquetes. Ver [[portal-residente]].

### Portal Guardia (`/guard`)
Estado: ✅ bottom nav + calendario implementados. Cubre 4 funciones: registro de visitantes, paquetes, PQRS y novedades. Ver [[portal-guardia]].

## Patrones de critique

Cada módulo pendiente sigue el flujo: critique → execute → commit. El critique identifica violaciones de [[absolute-bans]], inconsistencias con [[tokens-color]] y problemas de [[mobile-first-ios]]. El execute aplica correcciones. El commit registra los cambios.

## Relaciones

- Véase también: [[estado-modulos]], [[product-md]]
- Depende de: —
- Se conecta con: [[dashboard-admin]], [[billing]], [[pqrs]], [[reservaciones]], [[paquetes]], [[comunicaciones]], [[encuestas]], [[reglamento]], [[reportes]], [[portal-residente]], [[portal-guardia]]

## Fuentes

- Archivo original: `/BACKLOG.md` en el repositorio Vivaru
