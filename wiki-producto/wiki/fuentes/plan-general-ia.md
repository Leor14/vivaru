---
tags: [fuente, ia, gobierno]
tipo: fuente
fuentes: ["Plan_General_Implementacion_IA_Vivaru.md"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Fuente — Plan general de implementación de IA

`Plan_General_Implementacion_IA_Vivaru.md`, documento maestro de trabajo, en `/Users/david/Claude Coworker/Hogaru/GPT/`. **Fuera del repositorio, sin historial de versiones.** Es el marco de gobierno del programa; la decisión estratégica está en [[estrategia-ia-minima-viable]] y el resumen temático en [[programa-ia]].

## El dictamen

- **GO** para preparación, arquitectura, instrumentación, datasets y prototipos internos.
- **NO-GO** para habilitar IA a clientes reales mientras falten los controles mínimos: seguridad, privacidad, evaluación, presupuesto, aislamiento por conjunto, trazabilidad, fallback y apagado de emergencia.

Es una separación limpia entre *empezar* y *exponer*, y evita la trampa habitual de tratar un prototipo que funciona como una funcionalidad lista.

## Preparación estimada

| Iniciativa | Preparación | Lectura |
|---|---:|---|
| Plataforma de IA | 35% | Hay cimientos, faltan los controles específicos de IA |
| Onboarding asistido | 75% | El flujo existe; falta extracción, evaluación y confirmación |
| Comprobantes | 70% | Proceso maduro, pero el riesgo financiero exige más precisión |
| PQRS | 65% | Buena estructura; falta taxonomía evaluada |
| Comunicaciones | 60% | El mejor canario: bajo riesgo y revisión humana fácil |

El propio documento las llama hipótesis de planeación, no avance contractual.

## Puertas G0–G7

`G0 Necesidad` la IA supera a reglas o formularios · `G1 Valor` hay baseline y meta · `G2 Datos` legales, representativos y suficientes · `G3 Riesgo` fallos contenidos con fallback y kill switch · `G4 Evaluación` funciona fuera de una demostración · `G5 Economía` el costo cabe en el precio del SaaS · `G6 Piloto` produce valor en un grupo controlado · `G7 Escala` amplía sin degradar calidad, seguridad o margen.

G7 se aprueba **por solución, nunca para el portafolio en bloque**. Una puerta se marca aprobada, aprobada con condiciones o rechazada, y ninguna presión de calendario sustituye la evidencia. Es el mismo rigor que [[portafolio-prd]] aplica a las PRD funcionales, con una puerta más.

## Datos y evaluación

Muestras mínimas: 50–100 casos para comunicaciones, 150–250 tickets de [[pqrs]], 15–25 archivos anonimizados de onboarding, 100–200 documentos de comprobantes. Son pisos de piloto, no garantía estadística.

Reglas: anonimizar antes de usar, separar los ejemplos de diseño de los de evaluación final, versionar datasets y respuestas esperadas, y mantener casos adversos —instrucciones maliciosas incrustadas, archivos corruptos, datos contradictorios—.

> No debe aprobarse una solución únicamente por una métrica promedio. Se requieren umbrales por campo, categoría y segmento crítico.

## Seguridad antes de un piloto

Lista de 18 verificaciones. Las que hoy no se cumplen en Vivaru: App Check exigido en endpoints de IA (existe en cliente, sin enforcement en servidor), límites de tamaño y frecuencia, política de retención, DPA del proveedor revisado, pruebas de acceso cruzado entre conjuntos, protección frente a instrucciones incrustadas en documentos, y kill switch probado. Complementa las prohibiciones de [[absolute-bans]].

Seis incidentes obligan a apagado inmediato, encabezados por la sospecha fundada de **fuga entre conjuntos** — el fallo que [[multi-tenancy]] existe para impedir.

## Orden de construcción

Plataforma primero, luego de menor a mayor riesgo: PLAT-001 → [[comunicaciones]] (canario) → [[pqrs]] → [[onboarding-guiado]] → comprobantes de [[billing]], el último porque toca dinero. Cada solución conserva su flujo manual intacto; ninguna función central puede depender de que el proveedor esté disponible.

## Equipo

No es indispensable al inicio: científico de datos a tiempo completo, ingeniero de ML dedicado, equipo de MLOps separado ni infraestructura de GPU. Sí lo es un owner de producto y un líder técnico de Firebase, con el reparto de responsabilidades que ya usa [[superadmin]] para la operación interna.

## Decisiones pendientes

Ocho, todas sin responsable asignado: owner del programa, proveedor y modelo inicial, presupuesto experimental, conjuntos piloto, política de retención, umbrales de calidad, cuotas por plan e hipótesis comercial. Hasta cerrarlas, la Fase 0 no puede convertirse en backlog calendarizado.
