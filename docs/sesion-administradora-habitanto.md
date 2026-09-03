# La sesión con la administradora de Habitanto — lo que dijo y no entró en el inventario

> Analizado el 3 de septiembre de 2026 sobre `transcript habitanto.pdf` (17 páginas), sesión del
> **19 de agosto de 2026** con **Paola**, administradora en Ecuador que opera Habitanto a diario,
> con su equipo (Angie) y con David y Lucho.
>
> **Este documento no reemplaza a [`inventario-habitanto.md`](inventario-habitanto.md) ni a
> [`candidatos-prd-desde-habitanto.md`](prd/candidatos-prd-desde-habitanto.md): los completa por el
> lado que a los dos les faltó.**

---

## 1 · El hallazgo que explica todo lo demás: el transcript nunca fue la fuente

| Documento | Fecha | De dónde salió |
|---|---|---|
| **Esta sesión con Paola** | **19 ago** | La administradora **que usa** Habitanto |
| `inventario-habitanto.md` | 21 ago | «Levantado **navegando `app.habitanto.com`**, en modo solo lectura» |
| `candidatos-prd-desde-habitanto.md` | 21 ago | «**Fuente: `docs/inventario-habitanto.md`**» |

Los **108 candidatos salieron de mirar el software**. Lo que ella *dijo* —su dolor, sus
obligaciones legales, sus rodeos manuales— no entró en la cadena de la que salieron las nueve PRD.

**Por eso los huecos de la §3 no son aleatorios: son exactamente lo que no se ve en una pantalla.**

> ### La prueba que no admite discusión
>
> El inventario, en su **§9 «Lo que esta pasada no vio»**, escribe:
>
> > «El detalle de creación de una **cuenta por pagar** y del **cheque** que la paga.»
>
> Ese detalle **está en este transcript, dos días antes**, con ella compartiendo pantalla y
> explicándolo. **El hueco estaba declarado y la fuente que lo llenaba ya existía.**

---

## 2 · Lo que ella hace distinto, y en qué se convirtió

En la llamada Vivaru admitió **tres carencias en voz alta**. Ese fue el disparador del lote.

| Lo que se dijo, textual | Se convirtió en | Estado hoy (medido el 3 sep) |
|---|---|---|
| «Interés de mora — **no lo tenemos calculado automáticamente**» | `B5` (P1) | ❌ **Sin construir.** Cero `lateFee` / `moraRate` en el modelo |
| «Estado de cuenta de un departamento — **no lo tenemos como tal**» | `B10` → **`FEAT-004`** | ✅ **En producción** |
| «Cuentas por pagar en cuotas — **no lo habíamos visto**» | **nada** | ❌ **Ni siquiera es candidato** |

Y lo que enseñó que sí viajó hasta una PRD:

| Lo que enseñó | Candidato | PRD | Estado |
|---|---|---|---|
| Unidades con **% de alícuota y valor de expensa** | `A1` `A2` | `PLAT-001` | ✅ Producción · **18 de 93** con coeficiente, **0** con expensa |
| Genera cobros **según presupuesto y metraje** | `B1` `B2` | `PLAT-001` `FLOW-001` | ✅ Producción |
| **Anticipos** («me pagó dos meses») | `C1` `C2` | `FLOW-002` | ✅ Producción · **1 anticipo** |
| **Certificado de expensas** si está al día | `B10` | `FEAT-004` | ✅ Producción |
| **Proveedores** para poderles pagar | `E1` | `FEAT-003` | ✅ Producción · **0 proveedores** |
| Egresos **clasificados por cuentas** (asientos) | `E5` | `PLAT-003` | ✅ Producción · **189 cuentas** |
| **Conciliación bancaria** | `D1`–`D4` | `FLOW-004` parcial | 🟡 Casado sí, **cierre no** |
| **Programar** un comunicado a fecha futura | `G5` | — | ✅ Construido |
| Avisos de cobro por correo con detalle | `G1` `G2` | `FLOW-003` | ✅ Producción · **2 entregas** medidas |
| **Bloqueo de reservas a morosos** | `H1` | — | ✅ **Ya existía** — anulado del inventario |

---

## 3 · Lo que no definimos — diez huecos, verificados

Cada uno está comprobado con **conteo en los dos documentos**, no de memoria.

### 3.1 · Convenio de pago con el moroso

> «Lo que falta en el sistema: **necesito hacer un convenio de pago**. Porque sí me está exigiendo
> la ley que primero haga un convenio de pago con el moroso.»

`convenio` = **0** en inventario y en candidatos. `B8` («dividir una cuota en partes») es lo más
cercano y **no es lo mismo**: es un plan de pagos operativo, no un **acuerdo legal** con partes,
fecha, firma y consecuencia por incumplimiento. **Habitanto tampoco lo tiene** — ella se lo estaba
pidiendo a ellos.

### 3.2 · Cuentas por pagar en cuotas

> «La del seguro, yo pago en **once cuotas**. Le ingresamos todo el registro del **cuadro de pagos**
> en cuentas por pagar, **según las fechas** que tenemos que pagar.»
> Y al detallarlo: «le registro la factura completa y al momento de pagar me permite editar el
> valor a pagar», y se va saldando.

`cuotas` = 7 en el inventario pero **todas del lado del ingreso** (Cuotas por Expensas, División de
Cuotas) y **0** en candidatos. El inventario sí recogió el **pago parcial** («valor pagado, reparto
línea a línea»); lo que falta es el **calendario de vencimientos** de una factura. Es el hueco que
el propio inventario declaró no haber visto.

### 3.3 · El marco legal ecuatoriano entero

`decreto` = 0 · `ley de propiedad horizontal` = 0 · `banco central` = 0 · `anatocismo` = 0, en los
dos documentos **y en las nueve PRD**. Lo que ella explicó:

- **Decreto ejecutivo 462**, reforma a la Ley de Propiedad Horizontal, de julio de 2026.
- Un condómino que no paga un mes de alícuota, **por ley hay que generarle el interés**.
- El interés es **el del Banco Central del Ecuador**.
- **El anatocismo —interés sobre interés— es ILEGAL en Ecuador.** «Solo los bancos. Nosotros no
  podemos hacer eso.»

> **`B5` no se puede construir bien sin esto.** La regla no es «recargo por días vencidos»: es
> interés sobre **capital**, a tasa **externa y variable**, y **nunca compuesto**. Construirlo con
> la definición genérica produce una cifra ilegal en Ecuador.

**Ella preparó un cuadro resumen de las leyes para entregarlo** («hice un cuadro de todas las leyes
que tenemos ahorita, del decreto 462, para que lo puedan revisar. Voy a pasar con David»).

> **DECISIÓN DE DAVID, 3 de septiembre de 2026: el cuadro NUNCA SE ENTREGÓ.** No se espera. **La
> investigación la hacemos nosotros**, y **el alcance es Ecuador y solo Ecuador** — no se
> generaliza a Colombia, México ni Panamá sin una investigación propia por país. Ver
> [`glosario-mercados.md`](glosario-mercados.md), que hoy solo nombra «Ley de Propiedad Horizontal»
> de forma genérica.

> ✅ **HECHA el 3 de septiembre de 2026:**
> [`investigacion-legal-ecuador-mora.md`](investigacion-legal-ecuador-mora.md). El decreto es
> real (R.O. 4.º Supl. 339, 3 ago 2026) y ella acertó en todo. **Y destapó dos cosas que este
> documento no sabía:** la ley fija un **orden de imputación del pago** que `aplicarPago` no
> cumple —ordena solo por fecha—, y la **publicación mensual del estado de pago por unidad es
> obligación legal cuya sanción es la remoción del administrador**, lo que sube de golpe la
> prioridad del §3.7.

### 3.4 · Artículos legales dentro del aviso de cobro

> «Que también **se incluya en los avisos de cobro los artículos** donde dice que si no pagan lo que
> puede pasar: primero el corte de servicios básicos, el acceso a las áreas comunales, el tema de
> los TACs en los ascensores.»

`artículo` = 0 en candidatos. El aviso de cobro existe (`FLOW-003`); **el texto legal por conjunto y
país, no.** `G11` («firma y pie configurables») está cerca pero es firma, no articulado.

### 3.5 · La foto del medidor — su cuello de botella declarado

Preguntada directamente por qué le lleva más trabajo, respondió que cuentas por pagar «es facilito
y rapidito», y que lo que cuesta es:

> «Al momento de cobrar el consumo de **agua fría y agua caliente**, nos toca cargar esa
> información. **Yo tengo que cargar manual las fotos, porque tengo que tomar fotos de los
> medidores.** Yo no sé si aquí se puede poner **una ventanita y cargo las fotos**, para no enviar
> por email aparte. **Les tengo que mandar por email, en un archivo aparte.**»

El bloque `F` (F1–F4) tiene lectura anterior, actual, consumo y período — **y ninguna evidencia
adjunta**. `foto` = **0** en candidatos. Y añadió que Habitanto tiene la pantalla pero **«no nos
calcula»**.

### 3.6 · Corte de acceso por morosidad

Ella distingue **dos cosas** que nosotros tratamos como una:

1. **Bloquear reservas** al moroso — Vivaru **ya lo tiene**, y con exención por unidad.
2. **Cortar el TAG y el ascensor** — `ascensor` = 0, `tag` = 0, `corte de servicio` = 0.

`I3` («dispositivos: tarjetas, mandos y lectoras») está cerca pero **no une morosidad con acceso
físico**. Es la palanca de cobro más dura que ella nombra, y es la que la ley le habilita.

### 3.7 · El informe económico mensual, con estructura bancaria

Es el documento que emite todos los meses y **el que se aprueba**. Su columna vertebral, textual:

> saldo del banco **inicial** (del año y mes anterior) → **ingresos** con sus cuentas y concepto →
> **egresos clasificados por cuentas** → **saldo final del banco** → «y acá abajo me pone un detalle
> de las **cuentas pendientes de cobro**, y la **deuda a proveedores**, las cuotas que están
> pendientes por pagar» → resumen.

Medido en `src/app/(admin)/admin/reports/page.tsx`: Vivaru tiene `RESUMEN FINANCIERO`, `CARTERA`,
`ANTIGÜEDAD DE LA MORA`, `PQRS`, `RESERVACIONES`, `VISITANTES`, `PAQUETERÍA`, `ACUERDOS DE COMITÉ`.
**Cero menciones de saldo bancario inicial o final, de deuda a proveedores y de presupuesto.**

**Son dos animales distintos:** el nuestro es un tablero de indicadores; el suyo es un **estado de
caja anclado al banco**. El que se firma es el segundo.

Y su rodeo lo delata: el sistema se lo genera, **ella lo exporta, lo pasa a PDF, le pone el logo y
el esquema de firmas por fuera, y lo vuelve a subir** a la carpeta de archivos. Si el informe fuera
emitible y firmable dentro, ese viaje desaparece.

### 3.8 · Presupuesto contra ejecución real, para la Asamblea

> «La ley de propiedad horizontal de aquí del Ecuador nos permite hacer las **asambleas
> ordinarias**, donde se aprueban los presupuestos del año anterior. **Los tres primeros meses de
> cada año** tendríamos que revisar los presupuestos, los informes, **a ver si estaban bien
> presupuestados, si hay algún déficit**.»

`presupuestado` = 0 · `ejecución` = 0 · `real vs` = 0, en los dos documentos. `E6` es **simulación**
del año y `E7` son **escenarios**: ninguno de los dos compara lo presupuestado con lo ejecutado ni
señala déficit. **Es una obligación legal con ventana fija (Q1), no un informe opcional.**

### 3.9 · Adjuntar fotos a un comunicado

> «Aquí me permite, por decirte, **adjuntar fotos**.» Lo usa.

Las dos apariciones de `adjunt` en candidatos son el **plano de la unidad** (`A4`) y el **estado de
cuenta** (`G2`). Adjuntar material arbitrario a una comunicación no está. Es pequeño y es real.

### 3.10 · Dos cosas que Habitanto NO tiene y conviene atacar

No son huecos nuestros: son **ventajas que ella dejó servidas**.

| Lo que dijo | Por qué importa |
|---|---|
| «El **valor del banco**, del estado de cuenta, **eso se tiene que poner uno manualmente**» al conciliar | Nuestro `FLOW-004` ya importa las líneas del extracto. Es una superioridad concreta, y hoy no la contamos |
| «El vehicular **no está en Habitanto**, yo lo manejo en otro sistema. **Ellos solo generan QR, y solo para visitas.** Los **proveedores** no tienen acceso: se registran **con el guardia, manualmente**» | Vivaru ya tiene pases con QR, vigencia y marca de entrada/salida. **Verificado: no hay tipo de pase para proveedor ni recurrente** — solo visita. Extenderlo es barato y cubre un flujo que su competencia hace en papel |

---

## 4 · Lo que sí definimos y quedó sin construir

Un hueco de análisis y uno de ejecución no son lo mismo. Estos estaban vistos y no se hicieron:

| Candidato | Qué es | Pri |
|---|---|---|
| **`B5`** | **Interés de mora calculado.** El único P1 del que **carecen los dos productos** | P1 |
| **`F1`–`F4`** | **Bloque de medición de servicios entero** — sin PRD | P1 |
| **`E4`** | Estado de cuenta por proveedor | P1 |
| **`E6`** | Presupuesto anual por rubros | P1 |
| **`E8`** | Bitácora transversal de anulaciones, con motivo obligatorio | P1 |
| **`K1`** | Registro del consejo (cargo, período, estado) | P1 |
| **`K2`** | Qué reportes ve el residente | P1 |
| **`D1`–`D4`** | Cierre de conciliación — **aparcado a propósito** hasta el primer mes con pagos reales | P0 |

`K1` y `K2` se suman a **`PRD-V-PLAT-004` (alcance del rol Consejo), que nunca se escribió** y que
la revisión cruzada del 21 de agosto ya pedía: ocho PRD dan al consejo capacidades que
`canAccessPath` no le concede — sigue llegando **solo a `/admin/documents`**.

---

## 5 · Lo que se reforzaría, en orden

1. **Investigación legal de Ecuador, hecha por nosotros.** Decreto 462, tasa del Banco Central y la
   prohibición de anatocismo. **Bloquea a `B5`**: sin esas tres reglas, construir mora es
   construirla mal. Alcance: **Ecuador y solo Ecuador**.
2. **`B5` + convenio de pago, en UNA sola PRD.** La ley los encadena: se cobra mora y, si no paga,
   hay convenio. Separarlos repite el error de tratar como dos funciones lo que es **un proceso
   legal**.
3. **Cuentas por pagar con calendario de cuotas.** Hueco declarado por nuestro propio inventario y
   admitido en voz alta en la llamada.
4. **Foto en la lectura del medidor**, dentro del bloque `F`. Es su cuello de botella dicho con esas
   palabras, y hoy vive en un correo aparte.
5. **Informe económico mensual anclado al banco, emitible y firmable** — con cuentas pendientes de
   cobro y deuda a proveedores. Elimina su rodeo de exportar, maquetar y volver a subir.
6. **Presupuesto contra ejecución, con déficit señalado**, para la ventana de Asamblea del Q1.
7. **Pase de proveedor en portería** y **articulado legal en el aviso de cobro**. Los dos son
   pequeños y los dos golpean donde Habitanto no llega.

---

## 6 · La lección de método

**El inventario se levantó mirando la pantalla, y lo que duele no sale en la pantalla.** Sale en la
frase «les tengo que mandar por email, en un archivo aparte».

Una pasada de producto sobre la competencia responde **qué hace el software**. No responde **qué le
cuesta a quien lo usa**, **qué le exige la ley**, ni **qué hace por fuera porque el software no
llega**. Las tres cosas estaban dichas, grabadas y transcritas dos días antes, y ninguna llegó a los
108 candidatos.

Cuando exista otra fuente de este tipo —una sesión, una llamada, un cliente hablando—, **se procesa
antes que la pasada de pantalla, no después**, y el inventario declara explícitamente qué tomó de
cada una.
