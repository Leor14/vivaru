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
| C1 | **Estados de cuenta bancarios** de junio, julio y agosto, de las 2 cuentas | **Crea** documentos `financiero` con su PDF | A | Las 434 líneas de banco sembradas y el saldo de apertura: tienen que sumar lo mismo que la conciliación |
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

- [ ] **T0.1 El catálogo, cerrado con tus decisiones** (§6). Criterio: cada archivo tiene su
  colección, campo, ruta, categoría, pantalla donde se ve y dato del que sale; ninguno apunta a un
  campo sin pantalla.
- [ ] **T0.2 La forma exacta que deja el producto** en cada campo que se toca (`photos[]`,
  `attachments[]`, espejos de Documentos, carpetas de sistema), leída del código que la escribe.
  Criterio: una tabla campo a campo, como la del contrato de la semilla.

### Fase 1 — Generadores y escritores (código, contra el emulador)

- [ ] **T1.1 Maquetador de PDF** (`archivos.mjs`): portada opcional, títulos, artículos, tablas,
  bloques de firma, número de página y la marca en cada página; solo caracteres WinAnsi.
  Criterio: prueba que extrae el texto de un PDF generado y encuentra la marca en todas las páginas,
  y ningún carácter fuera de WinAnsi. **(S)**
- [ ] **T1.2 Ilustraciones** en SVG → JPEG: las 5 áreas en 3–5 vistas, logo, esfera de medidor y
  transferencia. Criterio: se miran una por una; ninguna pesa más de 5 MB. **(M)**
- [ ] **T1.3 Gobierno** (A1–A5). Criterio: reemplazos en la misma ruta y con el mismo token; los
  firmantes de cada acta tienen la marca de consejo; el reglamento cita las políticas reales. **(M)**
- [ ] **T1.4 Áreas y servicios** (B1–B2). Criterio: `photos[]` con la forma del producto, portada
  en `order: 0`, como mucho 8 por área. **(S)**
- [ ] **T1.5 Dinero** (C1–C4). Criterio: el saldo final de cada estado bancario cuadra con la
  conciliación; C2 sale de los generadores del producto. **(M)**
- [ ] **T1.6 Opcionales** (D1–D3), si los eliges. **(S)**
- [ ] **T1.7 Verificador**: cada archivo referenciado existe en Storage con su tipo; cada espejo
  comparte ruta con su origen; las categorías caen donde deben; todo está en el manifiesto; nada
  nuevo en las categorías que disparan. Falsado rompiendo cada comprobación a propósito. **(M)**
- [ ] **T1.8 Corrida en el emulador y mirar cada artefacto**: los PDF página por página y las imágenes
  una por una (la memoria «Mirar el artefacto generado»). **(S)**

**Punto de control A:** los bancos en verde (`npm test`, `npm --prefix functions test`), el
verificador en verde en el emulador, y los artefactos revisados contigo.

### Fase 2 — Ensayo en staging

- [ ] **T2.1 Corrida sobre el ensayo** (`fnBFuQe2p8h5fwy3jpeB`). Criterio: verificador en verde; cero
  avisos nuevos a residentes; cero correos.
- [ ] **T2.2 Recorrido por las pantallas del catálogo** con tus sesiones: Documentos (administración
  y residente), Reglamento, Acuerdos, Comunicados, Reservas (galerías), Servicios, la barra con el
  logo. Criterio: cada archivo abre, se ve bien, y el residente no ve lo de administración.
- [ ] **T2.3 `--limpiar` y resembrar**, para comprobar que lo nuevo se va entero.

**Punto de control B:** tu visto bueno sobre lo que se ve en staging.

### Fase 3 — Producción (un permiso por paso)

- [ ] **T3.1 Simulación** contra `hogaru-1`, sin `--escribir`. Criterio: el plan de escritura
  coincide con el de staging.
- [ ] **T3.2 Corrida** con `--documentos --escribir --si-produccion`. Criterio: verificador en verde.
- [ ] **T3.3 Recorrido** con tus sesiones.

### Fase 4 — Cierre

- [ ] **T4.1** Commit, con tu sí. **T4.2** Los hallazgos del producto al contrato (§7). **T4.3**
  `docs/pendientes.md`, roadmap, bitácora, wiki y memoria.

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

Para el contrato de la semilla, junto a H.39 (el formulario de personas exige teléfono):

1. **El logo no llega al informe mensual.** El administrador lo guarda en `tenantSettings.logoUrl`,
   pero el PDF del informe y la cabecera de `/admin/reports` leen `tenants.branding.logoUrl`, que no
   escribe nada del repositorio.
2. **Cuatro campos de archivo sin pantalla:** `expenses.supportFile*` (se escriben siempre en
   `null`), los adjuntos de PQRS, `reservations.mudanza.receiptUrl` y `paymentVouchers.pdfUrl`.
3. **Los espejos de Documentos comparten el archivo con su origen:** borrar la fila desde
   `/admin/documents` borra el archivo del comprobante, el acta o el comunicado; y borrar un
   comunicado o un servicio deja su archivo huérfano.
4. **La carpeta `monthly-reports` no está en `storage.rules`:** el informe solo se abre con el token de
   su `fileUrl` o con la URL firmada.
5. **La foto del medidor la ve el residente y no la administración:** su pantalla solo tiene el botón
   para subirla.
