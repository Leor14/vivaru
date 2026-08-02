---
tags: [arquitectura, ia, roadmap]
tipo: concepto
fuentes: ["estrategia-ia-minima-viable", "plan-general-ia"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Programa de IA — decidido, no construido

**Estado verificado contra el código a 1 de agosto de 2026: no existe ni una línea de IA en Vivaru.** No hay colección `aiUsage`, ni gateway, ni adaptador de proveedor, ni llamada a ningún modelo. Lo que existe es un marco de decisión completo, documentado en [[estrategia-ia-minima-viable]] y [[plan-general-ia]].

Esta página resume ese marco. La distancia entre lo decidido y lo construido es el dato más importante que contiene.

## La decisión ejecutiva

Durante los primeros 12 meses, **dos capacidades externas y nada más**: un modelo generativo económico vía API (Gemini Flash-Lite como predeterminado) y OCR documental (Google Document AI). Sin agentes autónomos, sin chat abierto para residentes, sin modelos propios, sin base vectorial, sin un segundo proveedor.

El principio financiero manda sobre el técnico:

> La IA debe reducir costos de operación o aumentar el valor percibido. Su costo variable objetivo no debe superar 2–3% del ingreso mensual por conjunto, y nunca exceder 5%.

El escenario conservador estima **USD 1.94–2.94 al mes por conjunto**. La conclusión que se saca de ahí no es que la IA sea barata, sino dónde está el riesgo real: no en la inferencia, sino en construir, probar, asegurar y soportar experiencias demasiado complejas.

## Los principios que no se negocian

Diez, del plan maestro. Los cuatro que más afectan al diseño de cada módulo:

- **Vivaru controla el proceso.** La IA extrae, clasifica, resume y redacta. No ejecuta acciones sensibles. Las reglas de negocio, los estados y las mutaciones siguen siendo de Vivaru — el mismo reparto que sostiene [[integridad-financiera]].
- **Humano en el circuito.** Toda sugerencia que toque información operativa, financiera o dirigida a residentes se muestra para revisión. La interfaz debe distinguir dato original, sugerencia y resultado confirmado.
- **Aislamiento por conjunto.** Cada solicitud, contexto, archivo, bitácora y métrica lleva `tenantId`, derivado de la sesión y nunca de la petición. Extiende [[multi-tenancy]] al plano de la inferencia.
- **Fallback determinista.** Si la IA falla, excede cuota o devuelve algo inválido, el flujo tradicional continúa. Ninguna función central del SaaS puede depender de que el proveedor esté disponible.

## Orden de construcción

Plataforma primero, y luego de menor a mayor riesgo:

1. **PLAT-001** — gateway, registro de operaciones, cuotas, auditoría, banderas y kill switch.
2. **Comunicaciones** — el canario. Bajo riesgo, revisión humana trivial. Ver [[comunicaciones]].
3. **PQRS** — clasificar y resumir, primero en modo sombra. Ver [[pqrs]].
4. **Onboarding asistido** — mapeo de columnas al importar. Ver [[onboarding-guiado]].
5. **Comprobantes** — el último, porque toca dinero. Ver [[billing]].

Ocho puertas, G0 a G7, contra las siete de una PRD funcional: la de IA añade **G4 Evaluación**, porque una demostración que funciona no prueba que la solución funcione.

## Lo que ya tenemos y lo que falta

Aprovechable hoy: Firebase Auth y roles ([[autenticacion-roles]]), aislamiento por `tenantId`, reglas de Firestore y Storage, Cloud Functions, `auditLogs`, `featureFlags` y validación con Zod.

Brechas verificadas en el código:

- No existe gateway, adaptador ni catálogo de operaciones.
- **App Check está inicializado en cliente** (`src/lib/firebase/app-check/index.ts`) **pero sin enforcement en servidor**. Para endpoints que cuestan dinero por llamada, eso es una puerta abierta.
- No hay cuotas ni medición de costo por conjunto.
- No hay líneas base de tiempo, error ni volumen de los procesos que la IA pretende mejorar. Sin baseline no hay forma de saber si funcionó.
- No hay datasets ni criterios de evaluación offline.

## Dónde viven las PRD

Cinco PRD de IA redactadas, todas en Google Drive y ninguna versionada: gateway, onboarding, comprobantes, PQRS y comunicaciones. La carpeta destino en el repositorio ya existe (`docs/prd/ia/`) y está vacía. Ver [[portafolio-prd]].
