---
tags: [fuente, ia, economia]
tipo: fuente
fuentes: ["Estrategia_IA_Minima_Viable_Vivaru.md"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Fuente — Estrategia de IA mínima viable

`Estrategia_IA_Minima_Viable_Vivaru.md`, fechado el 1 de agosto de 2026, en `/Users/david/Claude Coworker/Hogaru/GPT/`. **Fuera del repositorio y por tanto sin historial de versiones.** Escrito desde la perspectiva de consultoría de IA y dirección ejecutiva. Resumen temático en [[programa-ia]].

## Qué decide

Dos capacidades externas durante 12 meses: un modelo generativo económico por API y OCR documental. La lista de lo que **no** se lanza es igual de explícita — agentes autónomos, chat abierto para residentes, modelos propios, plataformas Enterprise, servidores locales, bases vectoriales externas, detección forense de fraude y más de un proveedor de LLM.

## Tres resultados, no «agentes»

El documento insiste en vender resultados y no tecnología:

1. **Onboarding asistido** — la mayor parte se resuelve con código determinístico; el modelo solo sugiere equivalencias entre columnas. Toca [[onboarding-guiado]].
2. **Captura asistida de comprobantes** — OCR, luego reglas, y el modelo solo cuando las reglas no estructuran el resultado. Toca [[billing]].
3. **Asistencias administrativas puntuales** — clasificar [[pqrs]], mejorar la redacción de un comunicado en [[comunicaciones]], extraer tareas de un acta. Llamadas aisladas, sin memoria ni RAG.

## Correcciones a supuestos previos

La sección más útil del documento es la que desmonta afirmaciones de un anexo anterior. Vale la pena conservarlas porque son errores fáciles de repetir:

- **La confianza del OCR mide extracción, no autenticidad.** Un documento alterado puede leerse con alta confianza. Relevante para [[integridad-financiera]].
- **Las reglas de Firestore no sustituyen comprobaciones del servidor cuando se usa el Admin SDK.** Las Cloud Functions deben imponer el `tenantId` expresamente — el mismo razonamiento de [[multi-tenancy]] y [[firebase-firestore]].
- Firestore Vector Search no factura una lectura por vector escaneado; el costo debe medirse con consultas reales.
- No hay tarifa pública verificada de Dify Enterprise; tratarlo como precio comercial no publicado.
- El ahorro por prompt caching depende del patrón de uso y no debe presupuestarse por defecto.
- Claude 3 Haiku quedó deprecado en febrero de 2026 y se apaga el 23 de agosto de 2026 — no debe formar parte del diseño.

## Economía

Precio de referencia de Gemini Flash-Lite: USD 0.30 por millón de tokens de entrada, USD 2.50 de salida. Una clasificación típica cuesta ~USD 0.001. El escenario mensual conservador por conjunto queda en USD 1.94–2.94.

Regla de rentabilidad: presupuesto máximo por conjunto = el menor valor entre USD 3 y 5% del ingreso neto mensual, con objetivo operativo bajo 3%. Al 80% se alerta, se limita lo no crítico, se conserva OCR y funciones esenciales, y **nunca se genera un cargo sorpresivo**.

Se comercializan créditos por acciones —documentos procesados, asistencias— **no tokens**, que no significan nada para el cliente. Encaja con el modelo de planes de [[ciclo-de-vida-tenant]].

## Criterios Go/No-Go

Comprobantes exige 95% de precisión exacta en importe y 90% en fecha y referencia, con cero contabilizaciones autónomas. Onboarding, 80% de columnas correctas y cero importaciones sin vista previa. PQRS, 90% de clasificación aceptada. Negocio: ausencia total de fugas entre conjuntos.

> Si una función no cumple estas condiciones, debe simplificarse o retirarse. Mantener IA poco utilizada también genera costo.
