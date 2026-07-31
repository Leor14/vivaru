---
tags: [decision, auditoria, metodologia, calidad]
tipo: decision
fuentes: ["sesion-auditoria-ux-2026-07"]
fecha_creacion: 2026-07-03
fecha_actualizacion: 2026-07-03
---

# Triaje de la Auditoría UX — Metodología y Resultado

Cómo se procesó la [[auditoria-ux-jul-2026]]: **ningún hallazgo externo se ejecuta sin verificarlo antes contra el código real**. Tres agentes de exploración validaron los 42 hallazgos y cada uno recibió un veredicto: *Aplica* (bug real, con archivo:línea), *Ya resuelto* (el guard existía), *Data del demo* (basura del seed, no es ingeniería) o *Decisión de negocio* (no se ejecuta sin OK del usuario).

## Por qué importa

De ~40 hallazgos, **9 ya estaban resueltos** en código (ej.: el "-100% vs ayer" tenía guard, el "111%" tenía divisor protegido — era síntoma de [[torres-canonicas|torres fragmentadas]], no de cálculo), **3-4 eran data del seed** (nombres basura tipo "Oiyutiuyt") y **2 eran negocio** (Panamá fiscal, roles de comité). Ejecutar el reporte "tal cual" habría quemado sprints en fantasmas.

## Ejecución (todo desplegado a prod y staging)

| Bloque | Contenido | Estado |
|---|---|---|
| Quick wins | i18n de estados, ortografía, 404 con marca, saldo negativo, emojis del reporte | ✅ |
| [[resolucion-unit-id]] | Resolver + freno de compuestos | ✅ |
| [[torres-canonicas]] | Código + migración de data en prod | ✅ |
| [[integridad-financiera]] | Reversos, confirmación de cobros, mora real | ✅ |
| [[kpis-formula-unica]] | % recaudo, PQRS pendientes, firma | ✅ |
| [[acciones-de-fila]] | Patrón único de acciones (Grupo 2) | ✅ |
| Grupo 3 | Conflictos de reserva, [[paquetes|paquetería]] accionable, audiencia en [[comunicaciones]], anomalía de egresos, avatares | ✅ |

Pendientes con sesión propia: split de [[cartera-campanas|Cartera]] en sub-rutas y rich text en comunicados. El estado vivo se lleva en [[estado-modulos]].

## Relaciones

- Véase también: [[trampas-conocidas]], [[roadmap-tecnico]]
- Depende de: [[auditoria-ux-jul-2026]]

## Fuentes

- Sesión de trabajo jul-2026 (commits 0cccd37…f53e032 en `master`)
