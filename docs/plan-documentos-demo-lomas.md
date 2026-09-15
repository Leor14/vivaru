# Plan — Documentos, fotos y archivos para la demo de «Lomas de Sayilbedra»

> **Qué es.** El plan para que los archivos del conjunto demo parezcan de un conjunto de verdad:
> reglamento completo, actas del consejo y de asamblea, fotos de las áreas comunes, adjuntos de los
> comunicados, estados de cuenta bancarios y los archivos financieros de cada mes. Todo generado, con
> la marca de demostración, y coherente con los tres meses de historia que ya están sembrados.
>
> **Estado: aprobado el 14 sep 2026, con las cinco decisiones de §6 tal como se recomendaron; fase 0
> en curso. Nada escrito en ningún ambiente.** Cada paso que escriba en producción lleva tu permiso
> aparte, como en la semilla.
>
> **Parte de:** `docs/plan-seed-demo-lomas-de-sayilbedra.md` (la historia, sembrada en producción el
> 14 sep) y su contrato de datos. Reutiliza su motor, su manifiesto y su `--limpiar`.

---

## 0. En una página

- **Lomas ya tiene 227 archivos, y casi todos son delgados.** El reglamento es una página con cuatro
  artículos; cada acta del consejo, cuatro líneas sin asistentes ni votación; las «fotos» del medidor
  y los comprobantes son tarjetas de texto, y al comprobante SPEI se le corta el título. El informe
  mensual, que lo genera el producto, está bien.
- **El hueco que más se ve son las fotos de las áreas comunes.** El producto las admite
  (`amenities.photos[]`, hasta 8 por área) y las pinta en la portada, la tira y la galería de
  `/resident/reservations`. Lomas tiene cero.
- **Tampoco hay adjuntos en los 16 comunicados, imágenes en los 6 servicios ni logo.** Los tres
  tienen pantalla; el logo sale en la barra de los cuatro portales.
- **Cuatro campos de archivo no los pinta ninguna pantalla** (soporte del egreso, adjuntos de PQRS,
  comprobante de la mudanza, PDF del recibo). Poblarlos no se vería en la demo: quedan fuera, y se
  anotan como hallazgos del producto.
- **La regla que ordena el plan: enriquecer lo que ya existe en vez de crear.** Crear un documento
  de categoría «reglamento» o un comunicado avisa a los 40 residentes con cuenta; actualizar no
  dispara nada. Los archivos delgados se reemplazan **en la misma ruta y con el mismo token**, así que
  ninguna URL guardada cambia.
- **Todo sale de los datos sembrados.** Los nombres del consejo, las cifras del banco, las reglas de
  cada área y las fechas vienen del padrón, del libro y del guion, y un verificador cruza cada archivo
  con su dato.

---

## 1. Punto de partida (medido el 14 sep, solo lectura)

**Archivos en Storage** (`tenants/PoyiASYEYoPSMulCWPJa/`): 227.

| Carpeta | Archivos | Cómo son hoy |
|---|---|---|
| `agreements/` | 5 | Actas de una página, ~2 KB: título, dos párrafos y «firman al calce» |
| `documents/` | 6 | Reglamento (una página, 4 artículos), acta de asamblea, póliza, contrato, plano y memoria, ~2 KB cada uno |
| `meter-readings/` | 192 | Tarjetas de texto («Lectura de medidor de agua», periodo, lectura) |
| `payment-receipts/` | 21 | Tarjetas de texto; el título y el beneficiario salen cortados |
| `monthly-reports/` | 3 | Los genera el producto; bien, con el corte de página de H.15 |

**Documentos** (`documents`): 32 en 7 carpetas. Por categoría: `comprobante` 18, `acuerdo` 5,
`informe_mensual` 3, y uno de `asamblea`, `contrato`, `memoria`, `plano`, `legal` y `reglamento`.

**Campos de archivo vacíos que el producto sí pinta:**

| Dónde | Campo | Se ve en |
|---|---|---|
| Áreas comunes (5) | `photos[]` `{id, url, storagePath, order}` | `/resident/reservations` (portada, tira, galería) y `/admin/reservations` |
| Comunicados (16) | `attachments[]` `{url, name, path, contentType, size}` | `/admin/communications` (miniatura) y `/resident/communications` (enlaces) |
| Servicios (6) | `imageUrl`, `imagePath`, `attachmentUrl`, `attachmentName`, `attachmentPath` | `/admin/services` y `/resident/services` |
| Ajustes | `tenantSettings.logoUrl`, `logoPath` | La barra de todos los portales |
| Notas de portería | `visitorPasses.guardNotes[].imageUrl` | `/guard/visitors` y `/admin/visitors` |

**Con qué se genera:** `pdfkit` y `sharp` están instalados y la semilla ya los usa
(`functions/scripts/historias/archivos.mjs`: `documentoPdf`, `imagenDeEjemplo`, `subir` con token
estable). Del producto se pueden reutilizar `buildSummaryPdf` y `archiveXlsx`
(`functions/src/pdf-resumen.ts`, `functions/src/index.ts`), como la semilla reutiliza sus escritores.

**Qué dispara un aviso** (medido en `functions/src/index.ts`):

| Acción | Dispara |
|---|---|
| Crear un documento de categoría `reglamento` | Sí: `regulation_new` a todos los residentes (`onRegulationDocumentCreated`) |
| Crear un documento de otra categoría | No |
| Crear un comunicado | Sí: a todos los residentes |
| Actualizar un comunicado, un área, un servicio, un documento o los ajustes | No |
| Actualizar un acuerdo del consejo | Solo si pasa a `enviado`; los 5 ya lo están |
| Añadir una nota a un pase de visita | No (no hay disparador de `update` en `visitorPasses`) |

---

## 2. Qué se genera — el catálogo

Visibilidad: **R** = residente y consejo (categorías `asamblea`, `comunicado`, `acuerdo`,
`reglamento`, `plano`, `memoria`, `otro`); **A** = solo administración (`financiero`, `reporte`,
`comprobante`, `contrato`, `legal`, `informe_mensual`).

### A. Gobierno

| # | Qué | Cómo entra | Vis. | Sale de |
|---|---|---|---|---|
| A1 | **Reglamento interno completo** (12–15 páginas: disposiciones generales, asamblea y consejo, cuotas e indiviso, fondo de reserva, uso y reserva de áreas comunes, mascotas, ruido, estacionamiento, mudanzas, obras, seguridad y visitas con QR, paquetería, sanciones, transitorios) | **Reemplaza** el PDF actual en su ruta; actualiza `fileSize` | R | Las políticas reales de cada área (`reservationPolicy`, horarios, anticipación, bloqueo por adeudo), el horario de mudanza del guion y la cuota por indiviso |
| A2 | **Las 5 actas del consejo**, completas: lugar y hora, asistentes y quórum, orden del día, desarrollo, acuerdos numerados, votación y bloque de firmas | **Reemplaza** cada PDF en su ruta (el espejo en Documentos comparte la ruta) | R | Los consejeros del padrón (marca de consejo) y el detalle de cada acuerdo del guion |
| A3 | **Asamblea ordinaria 2026:** acta completa (lista de asistencia por indiviso, quórum, presupuesto aprobado, elección del consejo) y la convocatoria | Reemplaza el acta; **crea** la convocatoria (`asamblea`, no dispara) | R | El presupuesto 2026 sembrado y el padrón |
| A4 | **Adjuntos de los 16 comunicados**: circulares en PDF (fumigación, corte de agua, mantenimiento de la alberca) y carteles en imagen (la noche mexicana) | **Actualiza** `attachments[]`; crea el espejo en Documentos como hace el producto (`comunicado`) | R | El texto y la fecha de cada comunicado |
| A5 | **Plano y memoria de obra** con ilustraciones: plano general (Encinos, Fresnos, Jacarandas y las áreas) y el antes y después de la impermeabilización | Reemplaza los dos PDF | R | Las 48 casas y las 5 áreas del padrón |

### B. Áreas comunes y servicios

| # | Qué | Cómo entra | Vis. | Sale de |
|---|---|---|---|---|
| B1 | **Fotos de las 5 áreas** (alberca, pádel, casa club, gimnasio, palapa): 3 a 5 por área, portada primero | **Actualiza** `amenities.photos[]` en `amenity-photos/{areaId}/…` (JPEG, ≤ 5 MB, hasta 8) | R | El nombre y el aforo de cada área |
| B2 | **Imagen y hoja de tarifas de los 6 servicios** | Actualiza `imageUrl`/`attachmentUrl` en `services/{id}/…` | R | Los servicios sembrados |

### C. Dinero («movimientos de pagos»)

| # | Qué | Cómo entra | Vis. | Sale de |
|---|---|---|---|---|
| C1 | **Relación mensual de movimientos bancarios** de junio, julio y agosto, de las 2 cuentas, **elaborada por la administración** a partir del extracto importado. No imita el estado de cuenta de un banco: sin su nombre ni su imagen, aunque las cuentas sembradas digan «BBVA México» | **Crea** documentos `financiero` con su PDF | A | Las 434 líneas de banco sembradas y el saldo de apertura: tienen que sumar lo mismo que la conciliación |
| C2 | **El archivo mensual de junio a agosto** que el cron no rellena hacia atrás: histórico de cartera (XLSX) y reporte de comité (PDF) | Crea los documentos de sistema **con los generadores del producto** (`archiveXlsx`, `buildSummaryPdf`) | A | La cartera de cada cierre |
| C3 | **Contratos y pólizas de los proveedores** que tienen egresos recurrentes (vigilancia, limpieza, jardinería, alberca) | Reemplaza el contrato y la póliza; crea los que falten (`contrato`/`legal`) | A | Los 12 proveedores y los montos de sus egresos |
| C4 | **Comprobantes de transferencia** rehechos, con el diseño de una transferencia y sin cortes | Reemplaza las 21 imágenes en su ruta (el espejo comparte la ruta) | A y la casa | Los importes, las fechas y las referencias sembradas |

### D. Marca y portería (opcionales)

| # | Qué | Cómo entra | Vis. | Sale de |
|---|---|---|---|---|
| D1 | **Logo ficticio de Lomas** | Actualiza `tenantSettings.logoUrl` en `branding/logo.png` | Todos | El color de marca de los ajustes |
| D2 | **Fotos de medidor** con esfera y dígitos | Reemplaza las 192 en su ruta | La casa | La lectura de cada una |
| D3 | **Notas de portería con foto** (unas pocas: placas, un paquete dañado) | Añade `guardNotes[]` a pases existentes | A y portería | Pases del guion |

---

## 3. Decisiones de diseño

1. **Una fase nueva de la misma semilla, `--documentos`**, que corre sobre un conjunto ya sembrado.
   Mismo motor, mismo manifiesto (`semillas/{tenantId}`): lo que cree lo apunta, y `--limpiar` lo
   alcanza sin tocar su código. Idempotente: un archivo que ya está con el mismo contenido no se sube
   dos veces, y un campo igual no se reescribe.
2. **Reemplazar en la misma ruta, con el mismo token.** `subir(..., { reemplazar: true })` conserva el
   token (`tokenDe(ruta)`), así que la URL guardada en `documents`, `committee_agreements` o
   `paymentReceipts` sigue valiendo, y el espejo que comparte la ruta se actualiza solo.
3. **Actualizar en vez de crear donde crear dispara.** El reglamento y los comunicados se enriquecen;
   no se crea otro reglamento ni otro comunicado. Lo nuevo va solo en categorías que no disparan.
4. **Nunca borrar una fila espejo de Documentos.** Comparte el archivo con su origen, y borrarla
   borra el archivo al que sigue apuntando el comprobante, el acta o el comunicado.
5. **Solo generado; nada descargado.** PDF con `pdfkit` y un maquetador nuevo (títulos, artículos
   numerados, tablas, firmas, número de página). Imágenes en SVG pasadas por `sharp`: ilustraciones,
   no fotos. Sin marcas reales, sin logos de bancos, nombres ficticios del padrón y la marca
   «EJEMPLO · DEMO VIVARU» en cada archivo. Nada que imite un documento fiscal.
6. **Coherencia verificada, no supuesta.** Cada archivo nace de un dato sembrado, y el verificador lo
   cruza: el saldo del estado bancario contra la conciliación, los firmantes del acta contra la marca
   de consejo, las reglas del reglamento contra la política de cada área.
7. **Emulador, luego staging, luego producción**, como la semilla. En producción, un permiso por paso.

---

## 4. Fases y tareas

### Fase 0 — Contrato de archivos (solo lectura)

- [x] **T0.1 El catálogo, cerrado con tus decisiones** (§6). Criterio: cada archivo tiene su
  colección, campo, ruta, categoría, pantalla donde se ve y dato del que sale; ninguno apunta a un
  campo sin pantalla. **Hecho el 14 sep.**
- [x] **T0.2 La forma exacta que deja el producto** en cada campo que se toca (`photos[]`,
  `attachments[]`, espejos de Documentos, carpetas de sistema), leída del código que la escribe.
  Criterio: una tabla campo a campo, como la del contrato de la semilla. **Hecho: §8.**

### Fase 1 — Generadores y escritores (código, contra el emulador)

- [x] **T1.1 Maquetador de PDF** (`archivos.mjs`): portada opcional, títulos, artículos, tablas,
  bloques de firma, número de página y la marca en cada página; solo caracteres WinAnsi.
  Criterio: prueba que extrae el texto de un PDF generado y encuentra la marca en todas las páginas,
  y ningún carácter fuera de WinAnsi. **(S)** **Hecho el 14 sep, con un cambio de criterio:** no hay
  en el repositorio con qué leer el texto de un PDF, así que el maquetador devuelve páginas y marcas y
  la prueba compara las dos; falsada rompiendo el pie (se pusieron rojas justo las dos pruebas de
  varias páginas). `documentoEstructurado`, `aWinAnsi` y `subirSiCambia` (sube solo si cambia la
  huella, conservando el token).
- [x] **T1.2 Ilustraciones** en SVG → JPEG: las 5 áreas en 3–5 vistas, logo, esfera de medidor y
  transferencia. Criterio: se miran una por una; ninguna pesa más de 5 MB. **(M)** **Hecho el 14 sep**
  (`ilustraciones.mjs`): 3 vistas por área a 800×500, como las deja el producto; la más pesada, 29 KB.
  Mirarlas cazó dos cosas: la décima del medidor iba en las unidades, y la hoja de contacto se
  recortaba (`sharp` redimensiona antes de pegar).
- [x] **T1.3 Gobierno** (A1–A5). Criterio: reemplazos en la misma ruta y con el mismo token; los
  firmantes de cada acta tienen la marca de consejo; el reglamento cita las políticas reales. **(M)**
  **A1 y A2 hechos el 14 sep, en el emulador:** el reglamento (52 artículos, 4 páginas) y las cuatro
  actas del consejo (una por sesión; los dos acuerdos del 18 de junio comparten la suya), reemplazados
  en su ruta y con su token; la segunda corrida da «ya estaban» y el verificador, 38 de 38. Por el
  camino salieron dos cosas: el id de un acuerdo sale de la clave del EVENTO (`acuerdo-<clave>`), y la
  historia paga y prorratea el anticipo de la impermeabilización (6 y 7 de julio) antes de la sesión
  que la aprueba (16): el acta lo cuenta como una autorización urgente del presidente que el consejo
  ratifica. **A3 hecho el mismo día:** el acta de la asamblea (4 páginas: lista de asistencia de las
  48 casas por indiviso, quórum del 75.93 %, el presupuesto con los nombres del plan de cuentas del
  producto, seis acuerdos votados) y la convocatoria, NUEVA (`asamblea`, no dispara), anotada en el
  manifiesto con su archivo. El presupuesto sembrado ya traía los $96,000 de cuota extraordinaria, así
  que el acta la deja prevista «para cuando el consejo contrate la obra». **A4 hecho también:** ocho
  adjuntos (cinco circulares en PDF y tres carteles), cada uno en `attachments[]` de su comunicado y
  con su espejo en Documentos en la carpeta de sistema «Comunicados», que el motor ya sabe crear. Se
  confirmó en el código que solo `onCommunicationCreated` escucha la colección: actualizar no avisa.
  **A5 hecho, y con él T1.3:** el plano (ilustración del fraccionamiento y la tabla de secciones, que
  suma las 48 casas y el 100 % del indiviso) y la memoria de obra (importes y fechas sacados de los
  egresos de la historia, fotos del antes y el después). El maquetador ganó el bloque `imagen`, y la
  huella describe cada imagen por su `clave`, no por sus bytes. **Mirar los PDF cazó tres defectos
  del maquetador que ninguna prueba veía:** un nombre de firma en dos líneas se encimaba con el cargo,
  un título se quedaba solo al pie de página con su imagen en la siguiente, y un «C.V..» con doble
  punto. Corregidos; `VERSION_DOCUMENTOS` va en 3.
- [x] **T1.4 Áreas y servicios** (B1–B2). Criterio: `photos[]` con la forma del producto, portada
  en `order: 0`, como mucho 8 por área. **(S)** **Hecho el 14 sep, en el emulador:** tres fotos por
  área (`photos[]` = `{ id, url, storagePath, order }`, subidas 5 s después de crear el área, con su
  `updatedAt`), y portada más hoja de tarifas en los seis servicios, en la carpeta `new-{ts}` que usa
  la pantalla al crear. Un área o un servicio con archivos propios no se toca. Mirar las hojas cazó
  notas que repetían la descripción de arriba; la versión va en 4.
- [x] **T1.5 Dinero** (C1–C4). Criterio: el saldo final de cada estado bancario cuadra con la
  conciliación; C2 sale de los generadores del producto. **(M)**

  > **Retomado y cerrado el 14 sep** (corte a pedido de David y vuelta el mismo día). Orden: C3 → C4 → C1 → D1 → C2
  > (C2 al final por riesgo). Nada está commiteado desde `223d759`; el emulador de la fase 1 sigue
  > arriba (`scratchpad/emulador/firebase.json`, `demo-lomas`/`lomas-emulador`) con A1–A5 y B1–B2
  > aplicados en `VERSION_DOCUMENTOS = 4`.
  >
  > - **C3 · HECHO el 14 sep:** los cuatro contratos de cuota fija (precio, día del recibo y día del
  >   pago de `EGRESOS_RECURRENTES`; vigencia de febrero de 2026 a enero de 2027, que cubre los egresos
  >   de mayo) y la póliza (prima y fecha del egreso sembrado). Corrida doble y los cinco PDF mirados.
  > - **C4 · HECHO el 14 sep:** los 18 aprobados casan rastreo y ordenante con su línea del
  >   extracto; el rechazado va recortado en y=252 (en 244 el importe aún se leía: lo cazó mirarlo).
  >   **Límite de la historia, no del documento:** la línea del banco de un cobro por comprobante lleva
  >   la fecha de la APROBACIÓN, no la de la transferencia (el comprobante dice el 5 y el extracto el 8).
  >   **Diseño:** repintar los 21 comprobantes con `comprobanteDeTransferencia` en su misma ruta
  >   (el documento no cambia; el espejo guarda `fileSize: 0`, como el producto). Una transferencia
  >   por casa y periodo: fecha y hora de la subida `n=1`; referencia `semilla(id de n=1)` (la fórmula
  >   de `cartera.mjs`); rastreo `rastreo("receipt:" + id aprobado)`, la de `banco.mjs`, para que case
  >   con su línea «SPEI RECIBIDO». El rechazado («no deja ver el importe completo») va recortado por el
  >   importe. Ordenante: `titularDe(casa)`; cuenta destino: `****` + las 4 últimas de la operativa.
  > - **C1 · HECHO el 14 sep:** seis relaciones. El banco contra los libros cuadra: diferencia 0
  >   en junio y julio y 2,150 en agosto, el depósito sin identificar. En la reserva la diferencia son
  >   los intereses, cuyo asiento manual no lleva cuenta (lo comenta `banco.mjs`) y que la conciliación
  >   sí casa. **Diseño:** 6 PDF (2 cuentas × junio, julio y agosto) desde `bankStatementLines` y el
  >   `openingBalance` al 31 de mayo: saldo inicial, abonos, cargos, saldo final, continuidad entre
  >   meses. Sin nombre de banco: «Cuenta operativa ····NNNN». Carpeta de usuario nueva «Bancos»,
  >   categoría `financiero`, subidos el día 3 del mes siguiente. El depósito sin identificar del 21 de
  >   agosto (`SIN_IDENTIFICAR`, `banco.mjs`) va como nota.
  > - **D1 · HECHO el 14 sep:** el logo en `branding/logo.png`; no había otro, así que `ajustesPrevios`
  >   guarda `logoUrl` y `logoPath` en `null` y `--limpiar` borra los dos campos. **Lo leído:** `uploadTenantLogo` sube a `tenants/{t}/branding/logo.{ext}` y guarda
  >   `tenantSettings.logoUrl`/`logoPath`; lo previo va a `ajustesPrevios` del manifiesto (patrón de
  >   `activeRegulationId` en `operacion.mjs`; `barrido.mjs` lo restaura al limpiar).
  > - **C2 · HECHO el 14 sep:** nueve archivos del sistema (tres cortes: histórico de cartera y
  >   reporte de comité en XLSX y en PDF). Antes de escribir, la cartera reconstruida al final de los
  >   tiempos reproduce el pagado y el saldo de los 435 cargos y el estado de todos los egresos; si no,
  >   no se archiva nada. **Lo leído:** replicar `monthlyFinancialArchive` (`functions/src/index.ts`) para los días 1
  >   de julio, agosto y septiembre: `Historico-cartera-{fecha}.xlsx` y `Reporte-Comite-{mes}.xlsx/.pdf`
  >   con `buildSummaryPdf`, `montoFacturadoDelCargo`/`montoLiquidadoDelCargo`, `construirEstadoFinanciero`,
  >   `sumarCuentasPorCobrar`, `sumarDeudaAProveedores` y `sumarSaldoDeApertura` de `functions/lib`;
  >   rutas de `ARCHIVE_PATH` (`cartera-history`, `committee-reports`). **El riesgo:** el cron calcula
  >   con el estado de HOY de cada cargo; para rellenar hacia atrás hay que reconstruirlo a cada fecha.
- [x] **T1.6 Opcionales** (D1–D3), si los eliges. **(S)** D1 hecho el 14 sep; D2 y D3 quedan fuera,
  como dejó DD1 («solo si sobra tiempo»).
- [x] **T1.7 Verificador**: cada archivo referenciado existe en Storage con su tipo; cada espejo
  comparte ruta con su origen; las categorías caen donde deben; todo está en el manifiesto; nada
  nuevo en las categorías que disparan. Falsado rompiendo cada comprobación a propósito. **(M)**
  **Hecho el 14 sep:** la del tamaño de cada documento y cinco nuevas (archivos de los campos con su
  tipo y su token, espejos, categoría y carpeta de sistema por origen, un solo reglamento, archivos con
  huella en el manifiesto). El verificador pasa de 38 a 43, y cada nueva se falsó rompiendo su dato:
  5 de 5 enrojecen solas y exactas, y restauradas vuelve a 43 de 43 (`scratchpad/falsar-t17.mjs`).
- [x] **T1.8 Corrida en el emulador y mirar cada artefacto**: los PDF página por página y las imágenes
  una por una (la memoria «Mirar el artefacto generado»). **(S)** **Hecho el 14 sep:** cada pieza se
  miró al construirla, y la vuelta completa —`--limpiar` (0 documentos, 0 carpetas, 0 archivos, sin
  logo ni manifiesto) → resiembra desde cero → documentos dos veces— deja exactamente lo mismo que
  antes (59 documentos, 11 carpetas, 282 archivos) y el verificador en 43 de 43.

**Punto de control A:** los bancos en verde (`npm test`, `npm --prefix functions test`), el
verificador en verde en el emulador, y los artefactos revisados contigo. **Al 14 sep:** bancos en verde
(app 2080, functions 1079, typecheck en 0) y verificador 43 de 43; **falta la revisión de David**, con
el PDF de revisión que junta las versiones finales.

### Fase 2 — Ensayo en staging

- [x] **T2.1 Corrida sobre el ensayo** (`fnBFuQe2p8h5fwy3jpeB`). Criterio: verificador en verde; cero
  avisos nuevos a residentes; cero correos. **Hecho el 14 sep (21:28 y 21:32 UTC)**, con testigos
  propios antes y después de cada corrida (`scratchpad/ensayo-testigos.mjs`):
  - **Primera corrida:** creó 27 documentos y 4 carpetas y reemplazó el resto en su ruta. Quedan 59
    documentos y 11 carpetas, lo mismo que en el emulador. **La segunda:** todo «ya estaban».
  - **Tras cada una:** verificador 43 de 43; cero avisos (655 → 655 en todo staging, ninguno con
    `createdAt` posterior al inicio); cero correos (`emailDeliveries` 2 → 2); `aiUsage` sin cambio (41).
  - **Antes de escribir, el verificador ya daba 42 de 43.** Sobraba un aviso del propio producto a la
    portería, de las 08:00 UTC: «Visitas sin salida registrada», por las dos visitas del lote del 13
    que siguen «Dentro». El barrido de la corrida lo apuntó en el manifiesto.
  - **El «hoy» de la corrida (14) no es el de la siembra (13).** Entre los dos cambian 52 eventos del
    guion, y ninguno es de los dos que leen los documentos (`egreso-impermeabilizacion-*`,
    `egreso-seguro-2026`).
  - **La simulación dice 1 carpeta y la escritura creó 4.** La comprobación de las carpetas de sistema
    va después del retorno en seco. Para T3.1 no importa: la simulación de producción cuenta igual de
    corto que esta.
  - **Control cruzado con el emulador, huella por huella:**
    - 58 archivos iguales.
    - Las 8 huellas distintas (relaciones de la cuenta operativa, históricos de cartera y reportes de
      comité en XLSX) y los 21 comprobantes solo difieren en claves de rastreo que salen de ids
      aleatorios y en el orden de sumas en coma flotante. La cifra es la misma al centavo.
    - Comprobado bajando tres archivos de cada ambiente: con los ids enmascarados, la relación de
      junio queda idéntica.
- [x] **T2.2 Recorrido por las pantallas del catálogo** con tus sesiones: Documentos (administración
  y residente), Reglamento, Acuerdos, Comunicados, Reservas (galerías), Servicios, la barra con el
  logo. Criterio: cada archivo abre, se ve bien, y el residente no ve lo de administración.
  **La administración, hecha el 14 sep**, con su sesión del ensayo en el navegador de la app:
  - **Documentos:** 58 en el listado; el reglamento va en su módulo (`page.tsx`). Las 11 carpetas
    suman 59.
  - **Reglamento:** 48 unidades y 29 firmas. **Acuerdos:** los 5, con su PDF. **Comunicados:** con sus
    8 adjuntos.
  - **Reservas:** las 5 amenidades, y la galería de 3 fotos en «Editar amenidad» (cerrado sin
    guardar). **Servicios:** los 6.
  - **El logo:** en la vista previa de Ajustes, 512×512 desde `branding/logo.png`.
  - **«Ver PDF» abre el archivo en otra pestaña**, y el navegador de la app bloquea las que no abre un
    clic tuyo. Que cada archivo se ve bien lo da el control cruzado de T2.1: la misma huella que lo
    revisado en el emulador.
  - **La barra con el logo solo existe para el superadmin** (§7, punto 1).

  **El residente, hecho el 14 sep**, con la sesión de Encinos 03 (Raúl Álvarez Torres) en el Chrome
  de David. El navegador de la app tenía la de la administración, y los dos no comparten sesión.
  - **Documentos:** los 18 esperados (8 comunicados, 5 acuerdos, 2 de la asamblea, el reglamento, el
    plano y la memoria de obra) y nada de administración. La lista blanca de `use-documents.ts`
    coincide con la regla.
  - **Reglamento:** «Ya firmaste». **Acuerdos:** los 5, con «Ver documento» (el de las cámaras, por
    firmar; no se firmó). **Comunicaciones:** con el cartel de la noche mexicana adjunto.
  - **Reservas:** las 5 áreas se eligen por su foto, y «Ver fotos» abre la galería (la alberca, 3
    fotos). **Servicios:** la portada ilustrada y las tarifas.
  - **El logo:** en la cabecera de todas sus páginas (§7, punto 1, corregido).
  - **Tras los dos recorridos:** verificador 43 de 43, y cero avisos y cero correos desde las 21:32
    UTC. Los recorridos no escribieron nada.
- [x] **T2.3 `--limpiar` y resembrar**, para comprobar que lo nuevo se va entero. **Hecho el 14 sep
  (22:15–22:56 UTC)**, en una sola cadena que solo resembraba si `--limpiar` dejaba el conjunto como
  estaba:
  - **`--limpiar`:** borró 4.572 documentos, 40 cuentas y 282 archivos. Ajustes y guía, como estaban
    (el logo, fuera). «Nada fuera de la línea base».
  - **La resiembra (36 min):** avisos D6 de la historia, 510 de 510; de hoy, 1 (el del superadmin).
  - **Una reserva la rechaza la regla de anticipación:** `reserva-palapa-2026-06-28-1`, pedida el 27
    a las 13:30 para el 28 a las 12:00, en una palapa que exige 24 horas. Es del guion y no depende
    del «hoy»: el 13 la huella también contaba 154 reservas de 155.
  - **Documentos, dos veces:** la primera crea lo mismo que en T2.1 (27 documentos y 4 carpetas; 59 y
    11 en total); la segunda, todo «ya estaban». 282 archivos en el manifiesto, 87 con huella.
  - **Testigos y verificador:** 43 de 43; cero correos; `aiUsage` sin cambio.
  - **Los 15 avisos nacidos en la corrida** son los de hoy que D6 conserva a propósito (a portería, a
    los residentes demo y a la administración). La fase «hoy» solo borra los del superadmin.
  - **Huellas antes y después:** 58 iguales y 8 distintas.
    - Las líneas de extracto de agosto son idénticas en la base entre staging y el emulador (152 de
      152, con los rastreos enmascarados), y el resumen de la relación coincide al centavo.
    - Lo que cambia en el PDF son las claves de rastreo que salen de ids y, por ellas, el orden de
      algunas líneas del mismo día: se ordenan por descripción, y la descripción lleva el rastreo.
    - En los XLSX cambia el orden de las sumas en coma flotante.
    - Supuse primero que era el reparto al azar de un pago parcial, y la base lo desmintió.

**Punto de control B:** tu visto bueno sobre lo que se ve en staging. **Dado el 14 sep**, con T2.1–T2.3
hechas. Tus 4 cuentas `+lomas-*` de staging se recrearon sin contraseña en T2.3; ese mismo día se
generaron sus enlaces para ponerla, sin correo.

### Fase 3 — Producción (un permiso por paso)

- [x] **T3.1 Simulación** contra `hogaru-1`, sin `--escribir`. Criterio: el plan de escritura
  coincide con el de staging. **Hecho el 14 sep, con tu permiso:**
  - **El verificador en producción, antes de escribir:** 43 de 43, sin nada fuera del manifiesto (el
    ensayo daba 42). 32 documentos con su archivo, ninguno tocado todavía.
  - **La simulación da el mismo plan que staging, línea por línea** (comparadas con `diff`): mismas
    cuentas y mismas páginas.
  - **La carpeta sale como 1 en los dos:** la simulación no cuenta las de sistema (T2.1).
  - Firma la administración de producción (`n2LTuofl1gapEelBnGYep7iNb713`), escogida sola por ser la
    única activa.
- [x] **T3.2 Corrida** con `--documentos --escribir --si-produccion`. Criterio: verificador en verde.
  **Hecho el 14 sep (00:31–00:35 UTC del 15), con tu permiso:**
  - **Antes de escribir, una simulación nueva,** idéntica a la de T3.1. Ya era el día 15 en UTC y
    seguía siendo el 14 en Puebla.
  - **Primera corrida:** lo mismo que en staging (27 documentos y 4 carpetas nuevos; logo, fotos,
    servicios, comprobantes y el archivo mensual). **Segunda corrida:** todo «ya estaban».
  - **Testigos:** cero avisos (813 → 813, y 274 del conjunto); cero correos (`emailDeliveries` 2 → 2);
    `aiUsage` en 0.
  - **Verificador:** 43 de 43, con 56 archivos puestos por la fase y 87 huellas en el manifiesto.
  - **Control cruzado con staging:**
    - 57 huellas iguales y 9 distintas: las tres relaciones de la cuenta operativa y los seis XLSX.
    - Las líneas de extracto de junio a agosto son idénticas en las dos bases (331 de la cuenta
      operativa y 6 de la reserva, con los rastreos enmascarados).
    - Lo que cambia son las claves de rastreo, que salen de ids que llevan el del conjunto, y el
      orden de las sumas en coma flotante.
- [x] **T3.3 Recorrido** con tus sesiones. **El residente, hecho el 15 sep (UTC)**, con la sesión de
  Encinos 03 (Raúl Álvarez Torres) en `www.grupovivaru.com`, desde el navegador de la app. El dominio
  sin `www` no sirve: falta el TXT `fah-claim`.
  - **Documentos:** los 18 esperados y nada de administración.
  - **Reglamento:** firmado. **Acuerdos:** los 5.
  - **Comunicaciones:** 15 comunicados con 7 adjuntos. El octavo adjunto es el del comunicado
    programado (§7, punto 12).
  - **Servicios:** las 6 portadas y las 6 tarifas.
  - **Reservas:** las 5 fotos de portada y la galería de la alberca (1 de 3, con las imágenes
    cargadas). En el navegador de la app la captura de un modal sale en blanco, así que se comprobó
    por el DOM.
  - **El logo:** en la cabecera.

  **La administración, hecha el 15 sep (UTC)**, con Carolina Méndez (`tenant_admin`) en la misma
  pestaña:
  - **Documentos:** 58 en la lista, y 11 carpetas con los mismos conteos que en staging (suman 59).
  - **Reglamento:** 29 firmas de 48 unidades. **Acuerdos:** los mismos 5.
  - **Comunicados:** 16, y en la primera página los mismos 4 adjuntos que en staging.
  - **Servicios:** los 6. **Reservas:** 5 amenidades activas y 154 reservas.
  - **El logo:** en la vista previa de Ajustes, 512×512 desde `branding/logo.png`.
  - **En producción no se abrió el editor de amenidades.** Tiene «Guardar», y las mismas fotos ya se
    vieron cargar desde el residente.
  - **Tras los dos recorridos:** verificador 43 de 43; cero avisos y cero correos desde las 00:31 UTC;
    `aiUsage` en 0. Los recorridos no escribieron nada.

### Fase 4 — Cierre

- [x] **T4.1** Commit, con tu sí: `fdc5a92` (fase 1), y el del cierre, el 15 sep.
- [x] **T4.2** Los hallazgos del producto al contrato (§7): de la H.40 a la H.50, y la H.9 ampliada.
- [x] **T4.3** `docs/pendientes.md`, el roadmap (0.9.76), la wiki y la memoria van en el commit del cierre.
  La bitácora y el tablero de Notion, justo después.

---

## 5. Riesgos

| Riesgo | Impacto | Cómo se evita |
|---|---|---|
| Crear un reglamento o un comunicado avisa a los 40 residentes | Alto | Solo se actualizan; el verificador falla si aparece uno nuevo en esas categorías |
| Un archivo reemplazado cambia de URL y deja enlaces rotos | Alto | Misma ruta, mismo token (`tokenDe`); el verificador abre cada `fileUrl` |
| Borrar un espejo borra el archivo de su origen | Alto | Ningún paso borra filas de Documentos; `--limpiar` va por id exacto |
| Un documento generado pasa por uno real | Medio | Marca en cada página e imagen, nombres ficticios, sin marcas ni sellos |
| Un carácter fuera de WinAnsi sale mal en el PDF | Medio | Saneado en el maquetador y prueba que lo busca |
| Staging y producción difieren (el ensayo se limpió y resembró) | Bajo | Todo sale de los datos; la simulación en producción se compara con staging |
| Una corrida larga se cae con la tapa cerrada | Medio | Tapa abierta y cargador; `caffeinate` (ver la memoria de la semilla) |

---

## 6. Decisiones tuyas

> **Decididas el 14 sep, las cinco con la recomendación.** Decidir no es autorizar: cada escritura en
> producción se vuelve a pedir en su momento.

| # | Decisión | Recomendación |
|---|---|---|
| **DD1** | Qué bloques entran | **A, B, C y D1** (logo). D2 y D3 solo si sobra tiempo |
| **DD2** | Estilo de las imágenes | **Ilustraciones generadas en SVG**: sin coste y sin derechos de terceros. Alternativas: fotos generadas con la IA de Vertex, más realistas, pero cuestan y piden decidir el gasto; o fotos tuyas de un lugar real |
| **DD3** | La marca «EJEMPLO · DEMO VIVARU» también en las fotos de las áreas | **Sí, discreta en una esquina**: coherente con el resto de la demo |
| **DD4** | Reemplazar los archivos delgados o añadir versiones nuevas | **Reemplazar en la misma ruta**: nada cambia de URL y no se duplica |
| **DD5** | Ensayo en staging antes de producción | **Sí**, como con la historia |

---

## 7. Hallazgos del producto (del mapa del 14 sep; leídos en el código, no probados)

Para el contrato de la semilla, junto a H.39 (el formulario de personas exige teléfono). **Pasados
al contrato el 15 sep (T4.2):** los puntos 1 a 6 son la H.41, H.42, H.43, H.44, H.45 y H.40; del 8 al
12, la H.46 a la H.50; y el 7 amplía la H.9, que ya lo recogía.

1. **El logo no llega al informe mensual.** La administración lo guarda en `tenantSettings.logoUrl`.
   El PDF del informe (las dos llamadas a `descargarLogo` de `functions/src/index.ts`) y la cabecera
   de `/admin/reports` leen `tenants.branding.logoUrl`, que no escribe nada del repositorio. Es la
   misma división en dos colecciones que `tests/marca-del-conjunto.test.ts` ya arregló para la
   cabecera del residente, y que sigue en esos dos sitios. **Visto en el recorrido de staging (T2.2,
   14 sep):**
   - **El residente sí lo ve**, en la cabecera de su portal. `ResidentHeader` (en `components/shared/`,
     en la raíz del repositorio) lo lee de `tenantSettings` con `getTenantBranding`, y el layout del
     residente la pinta en todas sus páginas.
   - **La administración solo lo ve en la vista previa de Ajustes.** La franja con el logo del
     `app-shell` solo se pinta cuando un superadmin entra al portal de un conjunto
     (`!isAdminRole && shellRole === "tenant_admin"`).
   - **Ningún correo lee el logo** (`git grep` en todo el repositorio), aunque Ajustes promete que «el
     logo y los colores se reflejan en el portal del residente y en los correos».
   - **Una primera lectura mía dijo que el residente no lo veía.** Buscaba solo en `src/`, y la
     cabecera vive en `components/`, fuera de él. Lo desmintió la pantalla.
2. **Cuatro campos de archivo sin pantalla:** `expenses.supportFile*` (se escriben siempre en
   `null`), los adjuntos de PQRS, `reservations.mudanza.receiptUrl` y `paymentVouchers.pdfUrl`.
3. **Los espejos de Documentos comparten el archivo con su origen:** borrar la fila desde
   `/admin/documents` borra el archivo del comprobante, el acta o el comunicado; y borrar un
   comunicado o un servicio deja su archivo huérfano (`deleteService` solo borra el documento). Y
   los archivos de un servicio NUEVO se suben a `services/new-{ts}/` antes de que el servicio exista,
   así que su carpeta nunca es la del servicio (visto al sembrar B2).
4. **La carpeta `monthly-reports` no está en `storage.rules`:** el informe solo se abre con el token de
   su `fileUrl` o con la URL firmada.
5. **La foto del medidor la ve el residente y no la administración:** su pantalla solo tiene el botón
   para subirla.
6. **El dinero de dos PDF del servidor sale en formato colombiano** (H.40 del contrato): el informe
   mensual y el reporte de comité automático (`formatMoney` de `functions/src/index.ts`, `es-CO`)
   pintan «$598.400» y «$-40.561» en un conjunto mexicano, donde la pantalla dice «$598,400.00».
   Visto al replicar C2 con el generador del producto.
7. **El saldo inicial del informe no encadena de un mes a otro** (visto el 14 sep al construir C2;
   la ficha de `FLOW-007` no lo menciona). El informe emitido y el reporte de comité parten TODOS los
   meses del saldo de apertura registrado: en Lomas, junio, julio y agosto arrancan en 598,400, y
   julio no parte de los 609,897.37 con que cerró junio. Desde el segundo mes, «saldo final del
   fondo» no es el del banco (agosto: 557,838.85 contra 614,668.08 en las dos cuentas).

Y del ensayo en staging (T2.1 y T2.2, 14 sep), vistos en pantalla o medidos:

8. **La categoría `informe_mensual` sale en crudo en Documentos.** La escribe el propio producto al
   archivar el informe mensual (`functions/src/index.ts`), y `CATEGORY_OPTIONS` de `/admin/documents`
   no la trae: la columna pinta «informe_mensual» y el filtro de categorías no la ofrece.
9. **Textos sin traducir o sin acento en dos listados de administración:** el estado «Scheduled» de un
   comunicado programado en `/admin/communications`, y las columnas «Titulo» y «Categoria» ahí y en
   `/admin/services`.
10. **«Subido por —» en los documentos de los acuerdos.** `src/features/committee-agreements/services.ts`
    escribe `uploadedByName: ""` al archivar el acta. La semilla lo replica tal cual.
11. **El cron escribe sumas sin redondear en los XLSX** del histórico de cartera y del reporte de
    comité (acumula con `+=` y no redondea): celdas como `170653.21999999997`. Excel lo pinta bien,
    porque muestra 15 cifras significativas; solo se ve al leer el valor crudo. Y hace que dos siembras
    iguales den bytes distintos según el orden en que devuelve los cargos la consulta.
12. **El adjunto de un comunicado programado se ve en Documentos antes de publicarse.**
    - `admin/communications/page.tsx` registra los adjuntos nuevos en Documentos (`createDocumentRecord`,
      categoría `comunicado`) en cuanto se guarda, sin mirar el estado.
    - El residente puede leer esa categoría (por la regla y la lista blanca), así que ve el PDF de un
      comunicado que su portal todavía no le enseña.
    - Visto en staging y en producción (T3.3) con el aviso de la cisterna del 22 de septiembre: está
      programado, falta en Comunicaciones del residente y aparece en su Documentos.
    - La semilla lo replica tal cual.

---

## 8. La forma que deja el producto (T0.2, leída del código el 14 sep)

Lo que la semilla tiene que escribir igual, campo a campo. Los ids aleatorios del producto
(`genId`, `Date.now()`) se sustituyen por ids y rutas estables, para que la corrida sea idempotente.

| Qué | Lo escribe | Forma |
|---|---|---|
| Foto de un área | `uploadAmenityPhoto` + `reorderAmenityPhotos` (`src/features/admin/services.ts`) | `amenities.photos[]` = `{ id, url, storagePath, order }`, JPEG en `tenants/{t}/amenity-photos/{areaId}/{ts}-{nombre}`; `order` desde 0; al guardar, `updatedAt` |
| Adjunto de comunicado | `uploadCommunicationAttachment` + `handleSave` (`admin/communications/page.tsx`) | `attachments[]` = `{ url, name, path, contentType, size }`, en `tenants/{t}/communications/{ts}-{nombre}`; `attachmentUrl` y `attachmentName` quedan en `""` |
| Su espejo en Documentos | `createDocumentRecord` | `category: "comunicado"`, `description: "Comunicado: {título}"`, `source: "communication"`, `sourceId`: el id del comunicado, `folderId`: la carpeta de sistema `communications`; más `fileName`, `fileUrl`, `storagePath`, `contentType`, `fileSize`, `uploadedBy`, `uploadedByName`, `createdBy`, `createdAt`, `updatedAt` |
| Imagen y adjunto de un servicio | `uploadServiceImage` / `uploadServiceAttachment` | `imageUrl`, `imagePath` en `services/{id}/cover-{nombre}`; `attachmentUrl`, `attachmentName`, `attachmentPath` en `services/{id}/attachment-{nombre}` |
| Logo | `uploadTenantLogo` + `saveTenantSettings` | `tenantSettings.logoUrl`, `logoPath` = `tenants/{t}/branding/logo.{ext}`, con `updatedBy` y `updatedAt`. **`--limpiar` tiene que devolverlos**: van a una clave propia del manifiesto, porque `ajustesPrevios` ya se guardó en la primera corrida |
| Documento nuevo | `createDocumentRecord` | Los 16 campos de arriba, con la categoría del catálogo y `source`/`sourceId` en `null` salvo en los espejos |
| Archivo mensual | `monthlyFinancialArchive` + `archiveBuffer`/`archiveXlsx` (`functions/src/index.ts`) | Histórico de cartera: `Historico-cartera-{fecha}.xlsx`, `financiero`, `source: "cartera_history"`, `sourceId`: la fecha, carpeta `cartera_history`. Reporte de comité: `Reporte-Comite-{mes}.xlsx` y `.pdf` (`buildSummaryPdf`), `reporte`, `source: "committee_report"`, `sourceId`: el mes, carpeta `committee_reports`. Los tres con `uploadedBy: "system"` y `uploadedByName: "Automático"` |
| Carpetas de sistema | `SYSTEM_FOLDERS` (`functions/src/index.ts`) | Las que entran aquí: `communications` («Comunicados»), `cartera_history` («Histórico de cartera»), `committee_reports` («Reportes de comité»). El motor de la semilla conoce hoy tres; se le añaden estas |
