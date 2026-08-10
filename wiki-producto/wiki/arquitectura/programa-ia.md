---
tags: [arquitectura, ia, roadmap]
tipo: concepto
fuentes: ["estrategia-ia-minima-viable", "plan-general-ia"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-10
---

# Programa de IA — la plataforma en pie, sin llamar a ningún modelo

**Hasta el 1 de agosto de 2026 no existía ni una línea de IA en Vivaru.** Entre el 9 y el 10 de agosto se construyó la plataforma entera menos la llamada real: banderas, puerta de entrada, catálogo de operaciones, validación de salida y telemetría de costo. El marco de decisión que la gobierna está en [[estrategia-ia-minima-viable]] y [[plan-general-ia]].

Lo que sigue sin existir, y a propósito, es el consumo: ningún módulo del producto invoca todavía una capacidad asistida. Esta página resume el marco; el detalle de ejecución paso a paso vive en `docs/hoja-de-ruta-ia.md`.

## La decisión ejecutiva

Durante los primeros 12 meses, **dos capacidades externas y nada más**: un modelo generativo económico vía API (Gemini Flash-Lite como predeterminado) y OCR documental (Google Document AI). Sin agentes autónomos, sin chat abierto para residentes, sin modelos propios, sin base vectorial, sin un segundo proveedor.

Verificado contra el proyecto real el 10 de agosto de 2026: el modelo elegido —`gemini-3.1-flash-lite`— **solo se sirve por el endpoint global**, no por ninguna de las 38 regiones, que se quedaron en Gemini 1.5. Eso descartó la opción de alinear la IA con `us-central1`, donde viven Firestore y el resto de la plataforma según [[dominios-app-hosting]]. Para el canario el riesgo es bajo porque la entrada de la operación no lleva datos de personas (ver [[puerta-ia]]), pero la pregunta hay que rehacerla en [[pqrs]] y en los comprobantes de [[billing]], que sí los llevan.

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

Aprovechable hoy: Firebase Auth y roles ([[autenticacion-roles]]), aislamiento por `tenantId`, reglas de Firestore y Storage, Cloud Functions, `auditLogs` y validación con Zod.

**Construido entre el 9 y el 10 de agosto de 2026:**

- **1.1** — las [[banderas-funcionalidad]]: lector real en cliente y servidor, kill switch por bandera y maestro, overrides por conjunto. Era la primera brecha y las cinco PRD la daban por resuelta sin estarlo. Se hizo como mecanismo genérico de plataforma, no como pieza del programa de IA.
- **1.2 y 1.3** — la [[puerta-ia]] y su catálogo: un callable único que resuelve el conjunto desde la sesión, rechaza cualquier petición que traiga `tenantId`, y solo admite operaciones declaradas con su versión, esquemas, roles y límites.
- **1.4, a medias a propósito** — el validador de salida está terminado y rechaza entero lo que incumpla el contrato; el proveedor sigue siendo simulado, con la misma costura que usa el transporte del SRI en [[billing]].
- **1.5** — telemetría en `aiUsage` y consola de consumo en [[superadmin]], que es lo que permite responder cuánto gastó cada conjunto sin estimar.
- **1.6** — cuotas por conjunto, usuario y operación, con consumo transaccional demostrado bajo peticiones simultáneas.
- **1.7** — las pruebas que importan: **puerta G3 aprobada** para toda la plataforma, y la parte técnica de G5. Ver [[puerta-ia]].
- **Los topes de gasto**, en cuatro capas: límite de inversión de Google acotado a Vertex AI, cuota de tokens por minuto, cuota por conjunto, y el kill switch de las banderas.

Brechas que siguen abiertas:

- **App Check está cableado pero no se exige.** Hasta el 9 de agosto esta página decía que estaba «inicializado en cliente sin enforcement en servidor»; la verdad era peor — `setupAppCheck()` existía sin que lo llamara nadie. Ahora el cliente lo llama y el rechazo lo gobierna una bandera; **falta el trabajo de consola** para poder exigirlo.
- No hay líneas base de tiempo, error ni volumen de los procesos que la IA pretende mejorar. Sin baseline no hay forma de saber si funcionó.
- No hay datasets ni criterios de evaluación offline.
- **Ningún módulo del producto invoca nada todavía**, y eso es correcto: el orden del programa pone la plataforma antes que la función.

## Dónde viven las PRD

Cinco PRD de IA redactadas, todas en Google Drive y ninguna versionada: gateway, onboarding, comprobantes, PQRS y comunicaciones. La carpeta destino en el repositorio ya existe (`docs/prd/ia/`) y está vacía. Ver [[portafolio-prd]].
