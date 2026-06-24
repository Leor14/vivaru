# Plan v2 — Disolver "Herramientas de gestión" y distribuir por contexto

> v1 agrupó el cajón en 3 sub-bloques. Mejoró el orden, pero **no la comprensión**:
> el usuario sigue sin entender qué hace cada cosa ni por qué está ahí. Este plan
> ataca la causa raíz.

## 1. Por qué sigue sin entenderse (diagnóstico de fondo)

1. **"Herramientas de gestión" es un cajón de sastre.** No es una tarea del usuario.
   Nadie piensa "voy a usar una herramienta de gestión"; piensa "voy a cargar los cobros
   del mes" o "voy a avisar a los morosos". El contenedor no significa nada.
2. **Las etiquetas nombran el mecanismo, no el resultado.** "Importar Excel" / "Exportar
   Excel" → ¿importar/exportar **qué**? El usuario no sabe qué produce ni a qué afecta.
3. **Está fuera de contexto.** Es un muro de botones **antes** de ver la cartera. Las
   acciones deben vivir donde están los datos y las decisiones, no flotando arriba.
4. **Mezcla temporalidades.** Carga inicial (una vez en la vida), importar cobros (mensual),
   exportar (a demanda), guardar histórico (mensual, ya automático). Juntas, ninguna se
   siente "lo de ahora".
5. **Varias pertenecen a otro modelo mental:** comunicar es del mundo de comunicaciones;
   imprimir el aviso de mora es del mundo de morosos; guardar histórico es del archivado.

**Conclusión:** no se arregla reordenando el cajón. Se arregla **eliminándolo** y poniendo
cada acción en su sitio, con nombres orientados al resultado.

## 2. Mapa destino: dónde va cada acción y cómo se llama

| Hoy (mecanismo) | Va a… | Nuevo nombre (resultado) |
|---|---|---|
| Importar Excel | **Card "Crear nuevo cobro"** (segundo camino) | **"Importar cobros (Excel)"** |
| Descargar plantilla | **Dentro del modal de importar** | "Descargar plantilla de ejemplo" |
| Plantilla saldos iniciales | **Dentro del modal de importar** + estado vacío | "Carga inicial del conjunto" |
| Exportar Excel | **Barra de la tabla** (fila "N registros") | **"Descargar a Excel"** (lo filtrado) |
| Imprimir PDF | **Pestañas Cartera vencida / Morosos** | **"Imprimir aviso de mora"** |
| Guardar histórico en Documentos | **Card "Cierre de períodos"** | **"Guardar corte en Documentos"** (+ nota: ya es automático cada mes) |
| Enviar mensaje masivo | **Encabezado del módulo** | **"Enviar aviso a residentes"** |
| Recordar a todos (morosos/vencida) | *(ya hecho en v1.1)* | — |

→ **La Card "Herramientas de gestión" desaparece por completo.**

## 3. Cómo queda cada zona (la nueva experiencia)

### a) Crear / cargar cobros — un solo lugar para "meter cobros"
La Card **"Crear nuevo cobro"** (que ya existe, con cobro manual / lote / programar) gana en su
encabezado un botón secundario **"Importar cobros (Excel)"**. Al abrirlo, un modal explica y
ofrece, en orden de flujo:
1. **Descargar plantilla de ejemplo** (mensual).
2. **Subir el archivo** (Importar).
3. Un apartado plegado **"Carga inicial del conjunto — solo al abrir"** con la plantilla de
   saldos iniciales.

Así el usuario tiene **un único modelo mental**: "aquí creo cobros, uno a uno o en lote".

### b) Descargar lo que veo — en la tabla
En la fila que dice "N registros" (arriba de la tabla), a la derecha, un botón discreto
**"Descargar a Excel"**. Es lo que el usuario espera: exporto **lo que estoy viendo** según los
filtros. Cero ambigüedad de "exportar qué".

### c) Avisar de la mora — donde están los morosos
**"Imprimir aviso de mora"** se mueve al encabezado de **Cartera vencida / Morosos**, junto a
"Recordar a todos". El aviso es intrínsecamente sobre morosos; ahí cobra sentido.

### d) Archivar el corte — en el cierre
**"Guardar corte en Documentos"** se mueve a la Card **"Cierre de períodos"**, con una nota:
"Esto ya ocurre automáticamente el día 1 de cada mes; úsalo solo si quieres un corte ahora."
(El cron `monthlyFinancialArchive` ya lo hace.) Deja de competir en la vista diaria.

### e) Comunicar — acción del módulo, no "herramienta"
**"Enviar aviso a residentes"** sube al **encabezado del módulo** como acción secundaria. Es
comunicación general; vive como una acción de cabecera clara, no escondida en un cajón.

## 4. Principios aplicados (para que se entienda)

- **Etiqueta por resultado, no por mecanismo.** "Descargar a Excel", no "Exportar Excel".
- **La acción vive donde vive el dato/decisión.** Exportar en la tabla; aviso de mora en
  morosos; archivar en el cierre.
- **Una temporalidad por lugar.** Lo de "una vez" (carga inicial) se pliega; lo automático
  (histórico) se anota como automático.
- **Menos superficie visible, más claridad.** Pasamos de un muro de 8 botones a acciones
  contextuales que el usuario encuentra cuando las necesita.

## 5. ¿Pestaña adicional? — sigue siendo NO

Distribuir por contexto es lo opuesto a centralizar en una pestaña. Una pestaña "Herramientas"
volvería a separar la acción del dato. La única "concentración" válida es el **modal de
importar** (porque plantilla + archivo + carga inicial son **un mismo flujo**).

## 6. Plan de ejecución (por fases, bajo riesgo — los handlers ya existen)

- **R1 — Importar dentro de "Crear nuevo cobro".** Botón "Importar cobros (Excel)" en el
  encabezado de esa Card → modal con plantilla + subir + carga inicial plegada. Mover ahí
  `handleImportCsv`, `handleDownloadTemplate`, `handleDownloadOpeningBalances`.
- **R2 — "Descargar a Excel" en la barra de la tabla** (fila de "N registros"). Mover
  `handleExportCsv`.
- **R3 — "Imprimir aviso de mora"** al encabezado de Cartera vencida/Morosos. Mover
  `handlePrintOverdueNotice`.
- **R4 — "Guardar corte en Documentos"** a la Card de Cierre de períodos + nota de automático.
  Mover `handleSaveCarteraHistory`.
- **R5 — "Enviar aviso a residentes"** al encabezado del módulo. Mover `setIsBulkDrawerOpen`.
- **R6 — Eliminar la Card "Herramientas de gestión".**

Cada fase es maquetación + reubicación; **ninguna toca la lógica**. Typecheck/lint por fase.

## 7. Decisiones a confirmar

1. ¿Vamos con la **disolución completa** (recomendado) o prefieres una versión intermedia
   (relabel + solo mover export/imprimir/comunicar, dejando un mini "Cargar cobros")?
2. **Importar**: ¿modal dentro de "Crear nuevo cobro" (recomendado) o un botón primario
   propio "Importar cobros" al lado de "Crear nuevo cobro"?
3. **Enviar aviso a residentes**: ¿encabezado del módulo (recomendado) o dentro de las
   pestañas de morosos/vencida?
