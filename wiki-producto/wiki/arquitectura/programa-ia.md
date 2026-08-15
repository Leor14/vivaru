---
tags: [arquitectura, ia, roadmap]
tipo: concepto
fuentes: ["estrategia-ia-minima-viable", "plan-general-ia"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-13
---

# Programa de IA — el canario ya escribe, y un administrador lo usó

**Hasta el 1 de agosto de 2026 no existía ni una línea de IA en Vivaru.** Entre el 9 y el 10 de agosto se construyó la plataforma entera menos la llamada real; entre el 11 y el 13 se conectó el modelo, se midió contra un conjunto de evaluación y **un administrador de verdad escribió cuatro avisos con la herramienta**. El marco de decisión está en [[estrategia-ia-minima-viable]] y [[plan-general-ia]].

Hoy hay **una capacidad asistida en producción de código**: el borrador de comunicaciones, detrás de bandera y solo desplegado en staging. Esta página resume el marco; el detalle paso a paso vive en `docs/hoja-de-ruta-ia.md`.

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

## El canario, del 11 al 13 de agosto de 2026

**1.4-real — el proveedor de verdad.** Adaptador de Vertex AI con `@google/genai`, encendido por la bandera `ia-proveedor-real`, que **nace apagada**: mientras no se encienda responde el simulador y no cuesta nada. Ver [[puerta-ia]] y [[banderas-funcionalidad]].

**2.1 y 2.1-bis — la línea base mató la hipótesis fácil.** Cronometrar la redacción dio 9–12 minutos por conjunto al mes: **sobre ahorro de tiempo, los números no justifican la funcionalidad**. Lo que sobrevivió, medido sobre 7.352 mensajes de un chat vecinal real, es **H2′: el valor es que el aviso salga completo**. Los avisos reales traen 1,2 de los 4 datos que un residente busca —cuándo, cuánto dura, a quién afecta y qué hacer— y **la duración falta en el 95%**.

**2.2 a 2.4 — el examen antes que el prompt.** 60 casos con afirmaciones comprobables, no textos esperados, y tres versiones de prompt que varían en un solo eje cada una. Siete corridas reales contra el modelo, unos 30 centavos en total. Gana `v2-estructura`, y no por puntos: por ser la única estable entre corridas idénticas.

**2.5 — la primera pantalla.** El panel «Redactar con IA» dentro del formulario de crear comunicado, plegado tras un botón. Lo que lo hace distinto de un botón de «escríbemelo» es que **la lista de lo que falta va antes del borrador**, con «cuánto dura» arriba del todo. Ver [[comunicaciones]].

**Contrato v2, y lo que costó.** Para poder ordenar esa lista, cada dato que falta lleva categoría —`duracion`, `fecha`, `alcance`, `accion`, `otro`—. El precio, medido: el modelo **pregunta menos** (de 2,32 a 1,93 datos por borrador). Se aceptó con los números delante y se revisa en el piloto.

## Lo que enseñó un administrador de verdad

El 13 de agosto, sesión de una hora en staging con el modelo real: **7 llamadas, USD 0,003**, y **guardó dos avisos sin cambiar una palabra**. A la pregunta de si pedirle datos era útil o pesado contestó «útil» — era el riesgo de diseño que más preocupaba.

Dos hallazgos que ningún examen había cazado:

- **No sabía dónde contestar** las preguntas de qué faltaba, y usó «No aplica» para salir del paso, contaminando esa métrica desde su primer uso. Ahora cada pregunta tiene su campo debajo, y **contestar se cuenta aparte de descartar**.
- **El modelo alteró un dato en un aviso de dinero.** Él escribió «2500 por residente» y el borrador publicó «por unidad» —reproducido 3 de 3—. No inventó nada y las dos expresiones estaban en la entrada: hacía falta **una tercera clase de fallo**, `ALTERADO`, que el evaluador no tenía. De ahí salieron las dos únicas reglas duras que se han tocado en todo el programa, y `v2-estructura` pasó de 80% a 87% con cuatro casos arreglados y ninguno roto.

**Lo que la sesión NO midió:** H2′ sigue sin línea base propia — los avisos escritos a mano no se hicieron, y con esa persona ya no se pueden tomar porque al final se le enseñaron los cuatro datos.

## Los cuatro datos generalizan

Todo lo anterior salía de **un edificio de un país**. Un segundo corpus —un edificio de Quito, seis años y nueve meses— lo contrasta con el mismo tamiz: **1,13 de 4 datos en Ecuador contra 1,31 en México**, y **«cuánto dura» es el peor dato en los dos**. La decisión de producto más visible de la pantalla se sostiene ahora en dos países.

De paso reinterpretó un fallo: el modelo pide «a quién afecta» donde no aplica, y eso **no es defecto del modelo sino del diseño** — el conjunto mexicano tiene torres y el ecuatoriano es un edificio único. Vivaru ya sabe cuál es cuál por [[torres-canonicas]], así que la mejora está identificada y pendiente de decisión.

## Lo aplazado, con motivo escrito

**Dictar los hechos por voz** lo pidió el administrador y queda en fase 2, por un motivo que no es técnico: una grabación de voz es, en la mayoría de las lecturas, un **dato biométrico**, y hoy la política de privacidad declara por escrito que Vivaru no los trata. Esa línea es la que sostiene la base de legitimación del módulo de visitantes. Encender un micrófono sería un cambio de régimen jurídico para toda la plataforma, no una funcionalidad más.

Brechas que siguen abiertas:

- **App Check está cableado pero no se exige.** Hasta el 9 de agosto esta página decía que estaba «inicializado en cliente sin enforcement en servidor»; la verdad era peor — `setupAppCheck()` existía sin que lo llamara nadie. Ahora el cliente lo llama y el rechazo lo gobierna una bandera; **falta el trabajo de consola** para poder exigirlo.
- No hay líneas base de tiempo, error ni volumen de los procesos que la IA pretende mejorar. Sin baseline no hay forma de saber si funcionó.
- No hay datasets ni criterios de evaluación offline.
- **Ningún módulo del producto invoca nada todavía**, y eso es correcto: el orden del programa pone la plataforma antes que la función.

## Dónde viven las PRD

Cinco PRD de IA redactadas, todas en Google Drive y ninguna versionada: gateway, onboarding, comprobantes, PQRS y comunicaciones. La carpeta destino en el repositorio ya existe (`docs/prd/ia/`) y está vacía. Ver [[portafolio-prd]].
