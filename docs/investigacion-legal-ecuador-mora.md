# Investigación legal — mora en propiedad horizontal, ECUADOR

> Hecha el 3 de septiembre de 2026 para desbloquear **`B5` · interés de mora calculado**.
>
> **Encargo:** el cuadro de leyes que la administradora de Habitanto ofreció entregar el 19 de
> agosto **nunca llegó**. Decisión de David (3 sep): no se espera, la investigación la hacemos
> nosotros, y **el alcance es ECUADOR Y SOLO ECUADOR**. No se generaliza a Colombia, México ni
> Panamá sin investigación propia por país. Ver [`glosario-mercados.md`](glosario-mercados.md).
>
> ⚠️ **ESTO NO ES ASESORÍA LEGAL.** Está construido sobre el texto de prensa jurídica y análisis
> de despachos, **no sobre el texto oficial del Registro Oficial**, que no se pudo abrir. Antes de
> facturar un solo centavo de interés en Ecuador, **un abogado ecuatoriano tiene que confirmar los
> cinco puntos marcados 🔴**.
>
> Origen del encargo: [`sesion-administradora-habitanto.md`](sesion-administradora-habitanto.md) §3.3.

---

## 1 · La norma existe y es reciente

| Dato | Valor |
|---|---|
| **Norma** | **Decreto Ejecutivo N.º 462** |
| Qué hace | Reforma el **Reglamento General de la Ley de Propiedad Horizontal** (original: Decreto Ejecutivo 1229, R.O. 270, 6 sep 1999) |
| Firmado | **31 de julio de 2026** |
| Publicado | **Registro Oficial, Cuarto Suplemento N.º 339 — 3 de agosto de 2026** |
| Alcance | Sustituye el **art. 19** y añade **19.1 a 19.7** |

**La administradora tenía razón en todo lo que afirmó**, y su fecha («el mes pasado», dicho el 19
de agosto) cuadra.

> **Esto es posterior al corte de conocimiento del asistente (mayo 2026).** Todo lo de aquí sale de
> búsqueda web hecha el 3 de septiembre de 2026, no de memoria.

---

## 2 · Lo que decide el cálculo de `B5`

### 2.1 · Cuándo nace la mora

**Desde el día siguiente al vencimiento, automáticamente y SIN necesidad de requerimiento previo.**

Para el producto: no hay «días de gracia» legales. Si el conjunto quiere darlos, es una política
suya, más benigna que la ley, y hay que poder configurarla.

### 2.2 · Qué tasa

**La tasa activa vigente del Banco Central del Ecuador.**

| Comprobado | Valor |
|---|---|
| Cómo la publica el BCE | **«% anual»** — «tasas de interés **activas efectivas** referenciales» |
| Segmento del titular «Tasa Activa Referencial» | **Productivo Corporativo** |
| Agosto 2026 | **6,79 % anual** |
| Septiembre 2026 | **7,03 % anual** |

> 🔴 **TRAMPA QUE CASI ME COME, Y QUE HAY QUE DEJAR ESCRITA.** Un buscador devolvió que el 6,79 %
> era **mensual**. Es falso: la serie del BCE se publica **anual**, y 6,79 % mensual sería ~120 %
> anual. **Un producto que aplique esa cifra como mensual cobra doce veces de más, ilegalmente.**
> Se resolvió abriendo la tabla del BCE y leyendo su encabezado, no aceptando el resumen.

**Dos cosas que el decreto NO resuelve y el producto tiene que decidir:**

1. 🔴 **El BCE publica varias tasas activas por segmento** (productivo corporativo, PYMES, consumo,
   microcrédito, vivienda…). El decreto dice «la tasa activa vigente» **sin nombrar segmento**. La
   lectura defendible es la del titular —**Productivo Corporativo**— pero es interpretación.
2. 🔴 **La tasa es anual y el devengo es «por cada mes o fracción de mes».** El decreto **no dice
   cómo se prorratea**. La prensa especializada lo señala como vacío expreso: *«no especifica si
   esta tasa es anual o mensual, ni cómo se prorratea»*.

**Consecuencia de diseño:** la tasa **no puede estar cableada**. Es un dato **externo, variable
mes a mes y con fuente citable**. El producto tiene que guardar *qué tasa se usó, de qué mes y de
qué segmento*, junto al cargo — o el cálculo no se puede defender ante una Asamblea.

### 2.3 · El anatocismo está prohibido, y con base más fuerte de la que ella citó

Ella dijo «es ilegal, se llama anatocismo». **Es correcto, y no depende del Decreto 462** — es
derecho general ecuatoriano:

| Norma | Qué dice |
|---|---|
| **Código Civil, art. 1575, 3.º** | «Los intereses vencidos no producen interés» |
| **Código Civil, art. 2113** | Prohíbe estipular intereses sobre intereses (mutuo) |
| **Código Orgánico Monetario y Financiero, art. 130** | «Prohíbese el anatocismo» |

**Sanción:** se sanciona conforme al delito de **usura**, y los jueces **ordenan el recálculo** de
los intereses cobrados indebidamente.

> **Para `B5` esto es una invariante, no una preferencia:** el interés se calcula **siempre sobre
> capital**. Un interés vencido e impago **nunca** se suma a la base. Es exactamente la clase de
> regla que debe sostener un guardián, no un comentario.

### 2.4 · El orden de imputación del pago — y esto toca código EN PRODUCCIÓN

El decreto fija a qué se aplica un pago, **en este orden**:

1. **Gastos de cobranza**
2. **Intereses de mora**
3. **Expensas extraordinarias**
4. **Aportes al fondo común de reserva**
5. **Expensas ordinarias** — y dentro de todo ello, **empezando por la deuda más antigua**

> ### 🔴 Lo que Vivaru hace hoy, medido
>
> `functions/src/payments.ts:442` ordena los cargos así:
>
> ```
> clave = dueDate ?? `${period}-01` ?? "9999-12-31"
> sort por clave, desempate por id
> ```
>
> **Solo por fecha. El concepto del cargo no entra en la decisión.**
>
> Cumple el desempate legal («la más antigua primero») y **no cumple la cascada de cinco niveles
> que va antes**. En Ecuador, un pago parcial puede acabar aplicado a una expensa ordinaria vieja
> cuando la ley exige que vaya antes a gastos de cobranza y a intereses.
>
> **Hoy no es una ilegalidad viva** —producción tiene cero clientes, y ni `lateFee` ni gastos de
> cobranza existen en el modelo—. **Pero significa que `B5` no es «añadir un recargo»:** el día que
> haya intereses, `aplicarPago` reparte mal. Las dos cosas se construyen juntas o ninguna.

### 2.5 · Gastos de cobranza

El moroso asume además **los gastos de la gestión de cobro, extrajudicial y judicial**. Son un
concepto propio, cobrable, y **primero en la cascada**. Hoy no existe en Vivaru.

---

## 3 · El proceso que la ley obliga a seguir

Esto no es una funcionalidad: es un **procedimiento con plazos**, y el producto tiene que poder
demostrarlo.

| Art. | Qué exige |
|---|---|
| **19.4** | **Notificación previa** identificando **unidad, período adeudado, número de expensas vencidas y saldo total**. Medios: física, correo, mensaje telefónico o el que prevea el reglamento interno. Concede **5 días** para pagar, justificar el pago **o solicitar un convenio** |
| **19.4** | Vencidos los 5 días sin regularizar, **las restricciones se aplican**; y tras el pago o el convenio válido, **se levantan en máximo 24 horas** |
| **19.5** | Con **dos o más expensas vencidas**, el administrador emite **liquidación detallada (capital, intereses, saldo total)**. La Asamblea la aprueba en **máximo 30 días** y **adquiere carácter de TÍTULO EJECUTIVO** |
| **19.6** | El **convenio de pago** consta **por escrito**, con **reconocimiento de deuda, monto, plazo e intereses**. El **incumplimiento de dos cuotas** produce **vencimiento anticipado** del saldo |
| **19.7** | Es **reincidente** quien vuelve a caer en mora **dentro de los doce meses** siguientes a regularizar o a suscribir convenio |

> 🔴 **Las fuentes secundarias se contradicen en la numeración.** Un despacho sitúa el interés en
> **19.2** y las restricciones en 19.1; una editorial jurídica lo pone al revés (**19.1** interés,
> **19.2** restricciones). **Solo el texto del Registro Oficial lo zanja**, y no se pudo abrir. Las
> *reglas* coinciden en todas las fuentes; los *números de artículo*, no. No citar un número de
> artículo en producto ni en un aviso al residente hasta verificarlo.

### El convenio de pago deja de ser opcional para el producto

Ojo al matiz: **la ley no obliga al condominio a firmar un convenio**; obliga a **ofrecer al
deudor la posibilidad de solicitarlo** dentro de los 5 días. Pero una vez firmado, el convenio
**gobierna la restricción** (la levanta en 24 h) y su incumplimiento **acelera toda la deuda**.

**Es una entidad de primera clase, no un campo de texto:** partes, reconocimiento de deuda, monto,
plazo, intereses pactados, cuotas, y un contador de incumplimientos que dispara a las dos.

---

## 4 · Qué se puede restringir y qué no

Ella lo distinguía y nosotros lo tratábamos como una sola cosa. La ley separa:

| ✅ SE PUEDE restringir (común **no indispensable**) | ❌ NO se puede restringir |
|---|---|
| Salones comunales y salas de eventos | Ingreso peatonal al inmueble |
| Piscinas y gimnasios | Acceso al bien exclusivo (su casa o departamento) |
| Canchas deportivas, áreas BBQ | **Acceso a su parqueadero propio** |
| Terrazas recreativas, salas de cine | **Suministro de agua potable fría** |
| Espacios de coworking | Saneamiento |
| **Parqueaderos de visitantes** | **Seguridad básica** |
| **Ascensores de carga** | Rutas de evacuación |
| **Servicios centralizados: agua caliente, internet comunal** | Acceso de ambulancia, bomberos, policía, personal médico |
| | **Movilidad para embarazadas o personas con discapacidad** |

> **Para el producto:** «bloquear al moroso» **no es un interruptor**. Es un permiso **por
> recurso**, y cada recurso nace clasificado como indispensable o no. Vivaru hoy tiene la compuerta
> de morosos **solo sobre reservas**; el resto de la lista —ascensor de carga, agua caliente,
> internet comunal, parqueadero de visitas— no tiene ni modelo.
>
> Y el lado prohibido importa igual: **el parqueadero propio no se puede cortar**, que es
> justamente lo que un control de acceso vehicular haría por defecto si nadie se lo impide.

---

## 5 · La transparencia pasó a ser obligación con sanción

**La administración debe publicar MENSUALMENTE el estado de cumplimiento de pago por unidad
inmobiliaria y el detalle de la cartera vencida.** El incumplimiento se sanciona con **la remoción
del cargo del administrador**.

> **Esto reencuadra dos huecos que ya teníamos anotados como «funcionalidad»:**
>
> - El **informe económico mensual** (§3.7 de la sesión) **no es una comodidad: es una obligación
>   legal con sanción personal para nuestro usuario.**
> - Es la mejor razón para hacerlo **emitible dentro del producto**, y no exportado, maquetado a
>   mano y vuelto a subir, que es lo que ella hace hoy.
>
> **Y el gemelo ya existe:** `monthlyFinancialArchive` (`functions/src/index.ts:3802`) es una
> función **programada** —`0 6 1 * *`, las 06:00 del día 1 de cada mes— y está **`ACTIVE` en
> producción**, verificado el 3 de septiembre. Ya genera y archiva un informe financiero
> mensual solo. Lo que falta no es el mecanismo: es **el contenido que la ley exige** —estado
> de pago por unidad y detalle de cartera vencida— y que sea **emitible y firmable**.

> 🔴 **Y trae una tensión real que hay que decidir, no ignorar:** publicar el estado de pago por
> unidad **expone al moroso** ante la comunidad, y la prensa especializada recoge la advertencia de
> que **en muchos condominios la unidad identifica trivialmente a su propietario**, con riesgo
> frente a la ley de protección de datos. Vivaru ya tiene el candidato **`K2` — qué reportes ve el
> residente**: aquí es donde se paga.

---

## 6 · Lo que esto cambia en el portafolio

1. **`B5` deja de ser un candidato P1 suelto y pasa a ser un bloque.** Interés de mora, gastos de
   cobranza, orden de imputación, notificación de 5 días, convenio de pago, liquidación con valor
   de título ejecutivo y reincidencia a 12 meses **son un solo proceso legal**. Trocearlo produce
   piezas que no cumplen.
2. **Toca código en producción.** `aplicarPago` ordena solo por fecha. No es un módulo nuevo al
   lado: es un cambio en el camino del dinero, con la regla de orden que ya conocemos —**una PRD
   sobre `aplicarPago` no puede estar en vuelo con otra**.
3. **La tasa es un dato externo con fuente.** Hay que guardarla junto al cargo (valor, mes,
   segmento) o el interés no se puede defender.
4. **El anatocismo es un invariante que sostiene un guardián**, no un comentario en el código.
5. **La restricción es por recurso, no un interruptor**, y con una lista negra que nunca se puede
   tocar.
6. **El informe mensual sube de prioridad**: es obligación legal con sanción al administrador.

**Y lo que NO cambia:** todo esto es **Ecuador**. De los nueve conjuntos de producción, ninguno es
cliente real. La ventana para construirlo sin migrar dinero de nadie sigue abierta, y se cierra
sola.

---

## 7 · Los cinco puntos que necesitan abogado ecuatoriano

Marcados 🔴 arriba, reunidos aquí:

1. **Qué segmento del BCE** es «la tasa activa vigente».
2. **Cómo se prorratea** una tasa anual sobre «mes o fracción de mes».
3. **La numeración exacta** de los artículos 19.1–19.7 (las fuentes secundarias se contradicen).
4. **Hasta dónde llega la publicación mensual** sin chocar con protección de datos.
5. **Si el orden de imputación admite pacto en contrario** en el reglamento interno del conjunto.

**Lo que NO necesita abogado para empezar:** el anatocismo (tres normas concordantes), la lista de
lo que no se puede restringir, los plazos de 5 días / 24 horas / 30 días / 2 cuotas / 12 meses, y
que la mora corre desde el día siguiente al vencimiento sin requerimiento.

---

## Fuentes

- [Lexis — Decreto Ejecutivo No. 462 reforma el reglamento de propiedad horizontal sobre mora y cobro](https://www.lexis.com.ec/noticias/decreto-reforma-el-reglamento-de-propiedad-horizontal-sobre-mora-y-cobro)
- [Lexis — Registro Oficial del día: Decreto 462 regula efectos de la mora en propiedad horizontal](https://www.lexis.com.ec/noticias/registro-oficial-del-dia-decreto-462-regula-efectos-de-la-mora-en-propiedad-horizontal)
- [AENA Auditores y Consultores — Nuevas reglas para morosos en condominios: Decreto Ejecutivo 462](https://aena.com.ec/nuevas-reglas-para-morosos-en-condominios-decreto-ejecutivo-462-reforma-la-propiedad-horizontal-en-ecuador/)
- [Primicias — Deudas en condominios generarán intereses automáticos y gastos de cobro](https://www.primicias.ec/economia/ecuador-deudas-condominios-intereses-gastos-cobro-propietarios-morosos-129458/)
- [Primicias — Estas son las nuevas restricciones que podrán aplicarle](https://www.primicias.ec/economia/ecuador-reglas-condominios-morosos-acceso-areas-comunes-servicios-basicos-129296/)
- [Radio Puntual FM — Decreto 462 endurece el cobro a morosos, pero deja vacíos sobre datos y plazos](https://www.radiopuntual-fm.com/2026/08/16/decreto-462-endurece-el-cobro-a-morosos-pero-deja-vacios-sobre-datos-y-plazos/)
- [Expreso — Deudas de alícuotas en Ecuador: qué se puede (y no) prohibir en los condominios](https://www.expreso.ec/ecuador/deudas-alicuotas-ecuador-no-prohibir-urbanizaciones-condominios-291726.html)
- [Vistazo — ¿Qué implica la reforma a la Ley de Propiedad Horizontal?](https://www.vistazo.com/actualidad/2026-08-01-implica-reforma-ley-propiedad-horizontal-estas-son-nuevas-reglas-para-condominios-ecuador-daniel-noboa-vivienda-FF11141523)
- [Banco Central del Ecuador — Tasas de interés activas efectivas referenciales](https://contenido.bce.fin.ec/documentos/Estadisticas/SectorMonFin/TasasInteres/Indice.htm)
- [Banco Central del Ecuador — Tasa Activa Referencial](https://contenido.bce.fin.ec/documentos/informacioneconomica/indicadores/monetario/indTasaActiva.html)
- [El Diario — Qué es el anatocismo y por qué está prohibido en el país](https://www.eldiario.ec/negocios/deudores-de-bancos-en-ecuador-que-es-el-anatocismo-y-por-que-esta-prohibido-en-el-pais-06032026/)
- [Expreso — Anatocismo (columna de Eduardo Carmigniani)](https://www.expreso.ec/opinion/columnas/eduardo-carmigniani/anatocismo-118086.html)
- [Registro Oficial — Cuarto Suplemento No. 339](https://www.registroficial.gob.ec/cuarto-suplemento-no-339/) *(texto oficial, no abierto en esta pasada)*
