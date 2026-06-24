# Plan — Reestructura UX de "Herramientas de gestión" (Cartera)

> La sección acumuló 8 acciones planas de 3 naturalezas distintas. Este plan las
> analiza por intención, las reagrupa por *job-to-be-done* y define la estructura.

## 1. Inventario: qué busca cada función

| # | Control | Handler | Qué busca (job) | Frecuencia | Opera sobre |
|---|---|---|---|---|---|
| 1 | Descargar plantilla | `handleDownloadTemplate` | Obtener el formato para cargar **cobros del mes** | Mensual recurrente | — |
| 2 | Plantilla saldos iniciales | `handleDownloadOpeningBalances` | Formato para cargar la **cartera heredada** al abrir un conjunto | **Una sola vez** (onboarding) | — |
| 3 | Importar Excel | `handleImportCsv` | Subir cobros/saldos **en lote** | Recurrente | Crea cobros |
| 4 | Exportar Excel | `handleExportCsv` | Bajar a Excel **lo que se ve filtrado** | Bajo demanda | Tabla visible |
| 5 | Imprimir PDF | `handlePrintOverdueNotice` | Generar **aviso PDF de morosos** | Bajo demanda | Morosos |
| 6 | Guardar histórico en Documentos | `handleSaveCarteraHistory` | **Snapshot** del recaudo a carpeta de sistema | Mensual | Corte de cartera |
| 7 | Recordar a morosos | `handleSendReminder(overdue)` | **Avisar** a los que están en mora | Recurrente | Residentes morosos |
| 8 | Enviar mensaje masivo | `setIsBulkDrawerOpen` | **Mensaje** a un grupo de residentes | Bajo demanda | Residentes |

## 2. Diagnóstico UX (por qué se siente "popurrí")

1. **Mezcla 3 trabajos distintos** en una barra plana: *entrada de datos*, *salida/reportes*
   y *comunicación con personas*. El ojo no los agrupa solo.
2. **8 acciones con el mismo peso visual** (todas `outline`), sin jerarquía ni acción primaria.
3. **Dos "plantilla" seguidas** con propósitos opuestos: una **mensual recurrente** y otra de
   **onboarding (una vez en la vida del conjunto)**. La de saldos iniciales **contamina la
   barra diaria** con algo que casi nunca se usa.
4. **Verbos sin orden de flujo**: Descargar, Importar, Exportar, Imprimir, Guardar, Recordar,
   Enviar — todo junto, sin contar la historia de "primero esto, luego esto".
5. **Acciones outbound a un clic** (envío a residentes) mezcladas con exportes inocuos. El
   envío masivo merece su propio espacio y un poco más de claridad/fricción.
6. El contador **"En mora: N"** ya está semi-separado (buen instinto) — falta hacer lo mismo
   con el resto.

## 3. Agrupación por job-to-be-done (3 categorías)

- **A · Cargar datos (entrada):** Descargar plantilla, Importar Excel. *(+ onboarding: saldos iniciales)*
- **B · Exportar y archivar (salida):** Exportar Excel, Imprimir PDF, Guardar histórico.
- **C · Comunicar (acción sobre residentes):** Recordar a morosos, Enviar mensaje masivo. *(contexto: En mora: N)*

## 4. Flujos naturales (el orden real de uso)

- **Carga mensual:** Descargar plantilla → llenar → Importar Excel.
- **Onboarding (una vez):** Plantilla de saldos iniciales → llenar → Importar Excel.
- **Salida:** *filtrar la tabla* → Exportar / Imprimir / Guardar histórico (todos operan sobre el corte visible).
- **Comunicación:** *ver morosos* → Recordar a morosos / Enviar mensaje masivo.

## 5. ¿Pestaña adicional en el módulo Cartera?

**Recomendación: NO crear una pestaña "Herramientas" que se trague todo.**

- Las pestañas actuales (Campañas, Cobros individuales, Por unidad, Cartera vencida, Morosos)
  son **vistas de datos**. Las herramientas son **acciones sobre esos datos**.
- **Exportar / Imprimir / Comunicar son contextuales al corte que estás viendo** ("exporto lo
  que veo", "aviso a los morosos que tengo en pantalla"). Mandarlas a otra pestaña **rompe**
  ese modelo mental y agrega navegación.
- Por eso la mejor solución es **reorganizar in-place en grupos etiquetados**, no esconder en
  una pestaña.

**Matiz:** lo verdaderamente *de configuración/una sola vez* (saldos iniciales) sí debe salir
de la barra diaria — pero a un **estado de onboarding**, no a una pestaña permanente.

## 6. Estructura propuesta (recomendada — Opción A)

Reemplazar la barra plana por **3 mini-secciones**, cada una con: etiqueta corta, microcopy de
una línea y **una acción primaria** destacada.

```
Herramientas de gestión
├─ ① Cargar datos                                  [Importar Excel] (primaria)
│     "Sube cobros en lote. Descarga la plantilla,    Descargar plantilla
│      complétala e impórtala."                       ▸ Carga inicial (colapsable, solo al abrir el conjunto)
│                                                          Plantilla de saldos iniciales
├─ ② Exportar y archivar                            Exportar Excel · Imprimir PDF · Guardar histórico
│     "Genera salidas de lo que ves según los filtros activos."
└─ ③ Comunicar con residentes        En mora: N      Recordar a morosos · Enviar mensaje masivo
      "Avisa a los residentes; el mensaje llega a su feed en la app."
```

Detalles de UX:
- **Acción primaria por grupo**: *Importar Excel* (grupo ①). Las demás quedan secundarias.
- **Saldos iniciales** se mueve a un **bloque colapsable "Carga inicial"** dentro de ①,
  rotulado "solo al abrir el conjunto" — y además se ofrece en el **estado vacío** de la
  cartera (cuando aún no hay cobros). Sale de la vista diaria.
- **Grupo ③** conserva el chip "En mora: N" como contexto; visualmente diferenciado (es la
  única zona que dispara mensajes a personas).
- **Mobile**: los 3 grupos se apilan; cada uno colapsa igual que el `MobileFiltersPanel`.

### Opción B (si se quiere máxima compactación)
Tres menús desplegables: **Cargar ▾ · Exportar ▾ · Comunicar ▾** (8 botones → 3). Más limpio
pero esconde acciones tras un clic. *No recomendada* para este módulo: el admin las usa seguido
y la visibilidad ayuda. Se puede reservar para mobile.

### Mejora opcional (fase 2): comunicación contextual
Llevar **"Recordar a morosos"** a la pestaña **Morosos / Cartera vencida** (donde de verdad
estás mirando a quién avisar). "Enviar mensaje masivo" puede quedar accesible global. Es el
movimiento más "the action lives where the job is", pero cambia músculo de uso → fase aparte.

## 7. Plan de ejecución (bajo riesgo, sin tocar lógica)

- **F1 — Reagrupar la barra en 3 secciones etiquetadas** (①②③) con microcopy y acción
  primaria. Solo maquetación/JSX dentro de la misma Card; los handlers no cambian.
- **F2 — Mover "Saldos iniciales" a "Carga inicial" colapsable** + mostrarlo en el estado
  vacío de cartera. Quita ruido de la vista diaria.
- **F3 (opcional) — Comunicación contextual**: reubicar "Recordar a morosos" en la pestaña
  Morosos. Decisión aparte por el cambio de hábito.

## 8. Decisiones a confirmar

1. ¿Vamos con **Opción A** (3 grupos visibles etiquetados)? *(recomendada)*
2. ¿**Saldos iniciales** a "Carga inicial" colapsable + estado vacío? *(recomendado)*
3. ¿Hacemos **F3** (mover "Recordar a morosos" a la pestaña Morosos) ahora o lo dejamos para después?
4. Etiquetas de los grupos: ¿**"Cargar datos" / "Exportar y archivar" / "Comunicar"** o prefieres otras?
