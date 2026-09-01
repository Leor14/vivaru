# Exploración de `AI-ONB-001` — qué falla hoy el mapeador determinístico

**1 de septiembre de 2026.** Es el registro de la exploración que pidió David el 31: la pregunta
no era «¿qué haría la IA?» sino **«¿qué falla hoy el mapeador determinístico?»** — sin ese suelo,
cualquier ficha se escribe sobre un supuesto (la lección de `ONB-002`, donde la regla
determinística encontró los trece duplicados y eso solo se pudo afirmar midiendo).

**Este documento es el contexto para ABRIR el frente.** La ficha (`PRD-VAI-FEAT-001`) sigue sin
escribirse **a propósito** —cero archivos de corpus— y esa premisa **aguantó la exploración**.
Lo que cambió es QUÉ ficha será cuando toque.

---

## Cómo se midió, y cómo repetirlo

Sonda sintética —**NO es corpus, y esa carencia sigue**— corrida contra el código real:
`suggestMapping` de `src/lib/import/field-catalog.ts` y `readTabularFile` de
`src/lib/import/read-tabular.ts`, con las tablas de valores aceptados reales de los dos
asistentes. Ocho formatos plausibles LATAM más el caso del lector.

```bash
npx tsx scripts/sondas-ai-onb-001/sonda-mapeador.ts   # los 8 formatos contra suggestMapping
npx tsx scripts/sondas-ai-onb-001/sonda-lector.ts     # la fila de título contra readTabularFile
```

Los encabezados de la sonda salen del dominio (padrones tipo Habitanto, Excel de administración
CO/MX), no de archivos reales. **Cuando haya corpus, la sonda se rehace con él** y este documento
se corrige contra lo medido de verdad.

## El suelo es más alto de lo esperado

Antes de los fallos, lo que el determinístico **resuelve solo** — y que una ficha de IA no debe
venir a rehacer: «Mail», «Móvil» (por variedad), «Calidad» (por contenido, vocabulario cerrado),
«No. Depto» (por contención), «Clase»/«Situación» (por contenido), «NOMBRE DEL PROPIETARIO»
(por contención). Los dos archivos reales del 14 de agosto están fijados en
`tests/import-field-catalog.test.ts` y pasan 5 de 6 campos.

## Las CUATRO clases de fallo, medidas

### 1 · El LECTOR, antes que el mapeador

Un XLSX con **fila de título encima de los encabezados** —la celda combinada típica de una
administración— convierte el título en encabezado y los encabezados reales en datos. Medido con
`readTabularFile` de verdad:

```
Encabezados que ve el asistente: ["PADRÓN GENERAL DE PROPIETARIOS — CONJUNTO LOS ROBLES",
                                  "(sin nombre)", "(sin nombre) (2)", …]
person.fullName ← «(sin nombre)»
person.email    ← «PADRÓN GENERAL DE PROPIETARIOS — CONJUNTO LOS ROBLES»   ← disparate con cara seria
✘ OBLIGATORIOS SIN MAPEAR: Unidad, Rol
```

Y **PDF y fotos ni cruzan la puerta**: `read-tabular.ts` solo acepta CSV/XLSX. Es exactamente el
alcance que David amplió el 30 de agosto («cualquier formato» incluye PDF y fotos, contra lo que
argumentaba `docs/hoja-de-ruta-ia.md` — la contradicción está anotada allí, no borrada).

### 2 · Transformaciones que el contrato columna→campo 1:1 no puede expresar

| Caso (sonda) | Qué pasa | Gravedad |
|---|---|---|
| P1 · «Nombres» + «Apellidos» | Mapea «Nombres» y **pierde los apellidos EN SILENCIO, con ✔ verde** | Dato mutilado sin aviso |
| P2 · «Torre» + «Apto» separados | Dos obligatorios sin mapear; **ni a mano se puede**: la unidad real es la combinación | Archivo sin salida |
| P3 · Padrón mixto estilo Habitanto (Inmueble/Coeficiente/Propietario/Estado de cuenta) | Sugerencia **EQUIVOCADA en silencio**: `Inmueble` ← nombre de la persona (variedad, empate por orden) | Mapeo falso con cara buena |
| P4 · Rol codificado en QUÉ columna está llena («Propietario(a)» / «Arrendatario(a)») | El rol no es un valor: es estructura. Sin salida, y la mitad de las personas se perdería | Archivo sin salida |
| U3 · «Torre 1 - Apto 101» en una celda | Mapea, pero torre y nombre viajan juntos: no existe partirlos | Dato sucio sin aviso |

### 3 · Vocabulario de VALORES — es producto, no IA

- **U1 · `parqueadero` / `bodega`**: el mapeo sale perfecto y el aviso **BLOQUEA el archivo
  entero** — esos tipos no existen en el catálogo de unidad (`apartment/house/office/other`).
  Un conjunto real tiene parqueaderos y bodegas como unidades. **Decisión de producto pendiente:
  ¿crece el catálogo de tipos, o se documenta «usar *otro*»?**
- **U2 · `ocupado` / `arrendado` / `desocupado`**: es OTRO eje semántico que `activo/inactivo`.
  El contenido no encaja, el estado queda sin mapear, y a mano bloquearía igual.

### 4 · Huecos baratos del propio catálogo — una tarde, sin IA

- **`person.unitLabel` no declara `cardinality`** → la pasada de variedad **nunca** puede
  rescatarla (es por lo que P2 y P3 pierden la Unidad).
- **Alias ausentes**: `apto` (unitLabel), `inmueble` (unidad). Ojo con `apto`: hoy es VALOR de
  tipo de unidad; como alias de columna va por entidad, así que no colisiona — pero comprobarlo
  al añadirlo.

## La implicación que reencuadra la ficha

El enganche previsto por escrito —la cabecera de `field-catalog.ts` nombra como tercer consumidor
«el mapeo asistido de `PRD-VAI-FEAT-001`», y la bandera `ai-onboarding-column-mapping` (hoy sin
un solo consumidor)— asiste **la elección de columnas**, que es justo lo que el determinístico
ya casi no falla.

**Una IA que solo elija columnas no toca ninguno de los cuatro fallos gordos.** La ficha, cuando
toque, es de **transformaciones** —partir/unir/pivotar, detectar dónde empiezan los encabezados—
y de **formatos** —PDF/foto → tabla intermedia que alimente el flujo tabular existente—. La
telemetría ya prevista (`encabezadosSinUsar` de `summarizeMapping`) sigue siendo el insumo
correcto, y está en 0 porque `importJobs` está en 0.

## El corpus que pedir cuando llegue un cliente

Con criterio medido, no genérico: **archivos con fila de título** (clase 1), **padrones mixtos
unidad+persona** (P3), **nombres partidos** (P1), **Torre/Apto separados** (P2), y **los PDF y
fotos tal como lleguen**. 15–25 archivos; hoy hay **cero** y no se guarda ninguno — la
recomendación vigente de `hoja-de-ruta-ia.md` es guardar copia anonimizada de cada conjunto
nuevo, con permiso.

## Lo que se puede hacer SIN corpus, si se decide abrir

1. **Los arreglos determinísticos de la clase 4** (alias + `cardinality`), con la sonda como
   verificación antes/después.
2. **Detección determinística de la fila de encabezados** (clase 1, mitad barata): buscar la
   primera fila que «parece encabezados» en vez de asumir la fila 0. Sin IA.
3. **La decisión de producto de los tipos de unidad** (clase 3).
4. **El mecanismo de captura de corpus** (guardar copia anonimizada con permiso) — es lo único
   que convierte «esperar un cliente» en «acumular mientras llega».

Lo que NO se hace sin corpus: la ficha, y cualquier compra de modelo.
