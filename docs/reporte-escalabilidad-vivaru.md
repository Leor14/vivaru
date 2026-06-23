# Reporte de escalabilidad — Vivaru (lente CEO)

> Evaluación de la arquitectura actual con foco comercial: ¿hasta cuántos complejos
> resiste antes de degradarse, qué tiene mayor riesgo y qué opciones tomar y cuándo?
> Estimaciones de ingeniería; pendiente validación con pruebas de carga.

## 1. Veredicto ejecutivo

El producto es **comercialmente lanzable y puede crecer a cientos de complejos pequeños/
medianos sin reescritura mayor**. La buena noticia: Firebase escala el *número de
conjuntos* casi sin esfuerzo. La incómoda: el patrón actual de **cargar colecciones
completas en el navegador** (sin paginación ni agregación del lado servidor) hace que el
límite real **no sea cuántos conjuntos tenemos, sino qué tan grande/antiguo es cada uno**.

**Reencuadre clave para el negocio:** nuestro riesgo de escala son las *"ballenas"*
(conjuntos grandes o con años de historia), no el *volumen de logos*. Un solo conjunto de
1.000 unidades con 3 años de datos degrada la experiencia **hoy**, aunque sea el único
cliente. En cambio, 300 conjuntos de 80 unidades funcionan bien con el build actual.

## 2. Criterios evaluados

- **Modelo de datos / Firestore:** multi-tenant lógico (una sola base, `tenantId` por doc).
- **Carga de datos en el front:** suscripciones y paginación.
- **Cloud Functions:** triggers, callables y crons.
- **Modelo de costo:** lecturas/escrituras Firestore facturadas por operación.
- **Tiempo real (listeners):** `onSnapshot` por cliente.
- **Ciclo de vida de datos:** archivado/retención.
- **Aislamiento y radio de impacto:** un proyecto, una región.
- **Operación comercial:** observabilidad, atribución de costo por tenant, residencia de
  datos (MX/CO/EC), respaldos, SLA.

## 3. Hallazgos y matriz de riesgo

| # | Aspecto | Riesgo | Por qué |
|---|---|---|---|
| R1 | **Front carga colecciones completas** (p. ej. cartera, reporte de comité cargan todo el histórico; la paginación es en el navegador) | **Crítico** | Memoria del navegador + lecturas por carga crecen con el tamaño/antigüedad del conjunto. Es el techo que se siente primero, por conjunto. |
| R2 | **Sin agregación del lado servidor** para gráficos/reportes | **Alto** | Los tableros recomputan sobre datos crudos completos; cada vista = miles de lecturas. |
| R3 | **Crons escanean colecciones globales** (mora, programados, recordatorios) | **Alto** | Escanean toda la plataforma filtrando por estado; crecen linealmente con el total de docs de todos los tenants. Techo *platform-wide*. |
| R4 | **Un proyecto / una región** (`hogaru-1`, us-central1) | **Medio** | Vecino ruidoso: un tenant o query desbocada afecta a todos. Latencia/residencia para MX/CO/EC. |
| R5 | **Listeners en tiempo real por todos lados** | **Medio** | Costo de lectura + conexiones a alta concurrencia. |
| R6 | **Ciclo de vida de datos incipiente** (archivado solo recién en cartera) | **Medio** | El resto de módulos acumula para siempre → agrava R1/R2. |
| R7 | **Throughput de correo (Resend), concurrencia/cold start de Functions, egress de Storage** | **Bajo–Medio** | Límites manejables con colas/reintentos; no es el cuello hoy. |
| R8 | **Sin atribución de costo ni cuotas por tenant; observabilidad básica** | **Medio (comercial)** | No podemos limitar ni cobrar a un tenant caro; margen en riesgo sin "fair use". |

## 4. ¿Hasta cuántos complejos resiste?

Supuestos: conjunto "típico" = 80–150 unidades; 1 cobro/unidad/mes + extras; 2–3 años de
historia; admin entra a diario. (Sin pruebas de carga aún.)

- **Hoy, sin reescritura — cómodo:** ~**100–300 conjuntos típicos** (≤150 unidades).
  Limitante real: la experiencia por conjunto, no el número de logos. El costo Firestore a
  esta escala es bajo.
- **Primer muro (por conjunto):** **cualquier conjunto > ~500 unidades** o con **>3–5 años
  sin archivar** degrada la cartera/reportes **ya** (R1). Antes de vender a un conjunto
  grande, hay que tener la refactorización de agregación/paginación.
- **Muro platform-wide (crons + analítica):** alrededor de **cientos–bajos miles de
  tenants**, los crons globales (R3) y las lecturas de reportes (R2) escalan en costo y
  tiempo; ahí se vuelve obligatorio acotar por fecha/tenant y mover analítica a un almacén.

En una frase para el board: *"Llegamos a las primeras ~100–300 residencias con el build
actual; cruzar eso —o aceptar un conjunto grande— exige la inversión de 'scale readiness'."*

## 5. Opciones por etapa (qué hacer y cuándo)

- **Etapa 0 — ahora → ~50–100 conjuntos (≤150 unidades).** Mantener el build. Quick wins de
  bajo costo: generalizar el patrón de **archivado + ventana** que ya hicimos en cartera a
  los módulos pesados; acotar las listas más cargadas con `limit` + período del lado
  servidor; indexar los crons por fecha; tablero básico de costo/uso.
- **Etapa 1 — ~100–300 conjuntos / primer conjunto grande.** **Refactor de "scale
  readiness"**: paginación y consultas acotadas del lado servidor + **rollups
  pre-agregados** (resúmenes mensuales) para que gráficos/reportes lean agregados, no datos
  crudos. Crons **por tenant** o acotados por fecha. Caché de lecturas frecuentes. *(Esta es
  la generalización del trabajo C4b que dejamos diferido en cartera.)*
- **Etapa 2 — 300–1.000+ conjuntos.** **Separar lectura analítica de la operación**: export
  a un almacén (p. ej. BigQuery) y correr el **Reporte de Comité y tableros desde ahí**, no
  desde Firestore en vivo. Evaluar **multi-base de Firestore** o partición por tenant para
  aislamiento y radio de impacto. **Cuotas/rate-limit por tenant** y atribución de costo.
- **Etapa 3 — miles de tenants / conjuntos enterprise.** Distribución regional (residencia
  de datos MX/CO/EC), niveles de SLA, posible **CQRS** (Firestore para operación en tiempo
  real + almacén relacional para reportería financiera), e infra dedicada para cuentas
  grandes.

## 6. Palancas comerciales (alinear precio al costo)

El costo escala con **unidades y datos**, no con el valor percibido. Por eso:
- **Planes por número de unidades** (no flat por conjunto), que es el driver de costo.
- **"Fair use" / cuotas** por plan para que una ballena no hunda el margen.
- Cobrar la **retención extendida** (años de historial) como add-on — se alinea con R1/R6.

## 7. Recomendación

1. **Vender ya** a conjuntos típicos (≤150 unidades): el build aguanta y da caja.
2. **No comprometer** conjuntos grandes (>500 unidades) hasta entregar la Etapa 1.
3. **Financiar la "scale readiness" (Etapa 1) como iniciativa puntual**, cronometrada a la
   curva de crecimiento — no todo por adelantado. Empezar por **rollups + paginación
   servidor** en cartera y reportes (el mayor riesgo, R1/R2), reutilizando el patrón de
   archivado ya construido.
4. **Instrumentar costo por tenant** desde temprano para defender el margen y fijar precios.
