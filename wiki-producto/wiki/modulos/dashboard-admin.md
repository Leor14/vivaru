---
tags: [modulo, admin, dashboard]
tipo: concepto
fuentes: ["PRODUCT.md", "DESIGN.md", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-08-30
---

# Dashboard Admin

Vista principal del portal administrador (`/admin`). Implementa el principio "status at a glance" de [[product-md]]: el administrador debe poder evaluar el estado del conjunto en segundos, sin necesidad de navegar a módulos individuales.

## Estructura de la página

Sigue el patrón de [[layout-patterns|admin page layout]]: Card wrapper → header (título + acción) → KPI grid → widgets de dashboard. Los KPIs usan la escala fluid definida en [[tipografia]]: `kpi-value-fluid`, `kpi-value-fluid-xl` y `kpi-value-fluid-compact` según la densidad de la grilla.

El grid de KPIs usa `grid-cols-2 gap-3 sm:grid-cols-4`. Los widgets de dashboard usan `grid-cols-1 gap-4 lg:grid-cols-2`. Ver [[layout-patterns]].

## Métricas clave

El dashboard muestra indicadores de los módulos principales: resumen de [[billing|cartera]] (cuántas unidades al día / pendientes / vencidas), visitas activas de [[visitantes]], paquetes pendientes de [[paquetes]], y tickets abiertos de [[pqrs]]. Los colores semánticos siguen la convención de [[tokens-color]]: emerald para "Al día", amber para "Pendiente", red para "Vencido".

## Cada indicador declara qué ventana mide (30 ago 2026)

Regla que salió de `UX-004`, y también de un defecto medido: **dos indicadores con el mismo
rótulo en pantallas contiguas medían ventanas distintas y ninguno lo decía**. El «% recaudo» del
Panel mide **un mes**; el de [[billing|Cartera]], **hasta doce períodos**. Medido contra
producción, **divergían en los siete conjuntos** — Palmas y Nogal marcaban `0,0%` aquí y `50,0%`
allí, a un clic de distancia.

**No se resolvió fusionando las dos ventanas, sino nombrándolas**: son preguntas legítimas y
distintas —«cómo va este mes» y «cómo va el histórico»—. Cada tarjeta lleva su ventana bajo el
rótulo, y «Cartera total» dice que es un **acumulado sin ventana**.

La pieza que lo sostiene es `src/lib/dashboard/indicadores.ts`: `lecturaDePorcentaje` une cifra,
tono y ventana, **con la ventana como parámetro obligatorio**. No se puede pintar un porcentaje sin
declarar sobre qué se calculó, y de que las pantallas la usen se encarga un guardián que recorre el
código. **No se tocó ninguna fórmula**: las de `features/billing/collection.ts` estaban bien y su
banco ya las vigilaba — el defecto era el recorte y el rótulo, y diagnosticarlo como «dos fórmulas»
habría llevado a reescribir código correcto.

> **Y el segundo defecto de la misma pantalla:** «sin datos» se disfrazaba de «lo peor». En cuatro
> de los siete conjuntos el panel afirmaba **en rojo** un recaudo del 0,0% en un mes **sin un solo
> cobro emitido** — correcto como número y falso como afirmación. Hoy `tonoPorPorcentaje` pide el
> total, igual que su vecina `colorPorPorcentaje`, y con `charged === 0` la tarjeta dice «—» en
> neutro y «sin cobros emitidos en la ventana».

## El color informa, o no está (28 ago 2026)

Regla que salió de `UX-003`, y salió de un defecto: **un tono que no depende del valor es
decoración, y encima resta significado al color de las tarjetas donde sí lo tiene.** El Panel
tenía tres tonos constantes, así que un recaudo del **0,0% se pintaba en verde**, y el widget de
firma del [[reglamento]] marcaba **6% en verde mientras una torre al 11% salía en rojo**, dentro
del mismo recuadro: las barras por torre aplicaban umbrales y la del total estaba clavada.

**La escala vive en un solo sitio**, `src/lib/dashboard/umbrales.ts`, y la usan la página y el
widget. Antes estaba escrita a mano en dos ficheros y en tres formas — que es exactamente como
nació la contradicción. Sus tres reglas:

1. **70 / 40** para todo lo que se mide en porcentaje y donde más alto es mejor.
2. **Sin datos no es lo peor:** con `total === 0` no hay color, se cae a gris. Pintar de rojo un
   total vacío inventa un problema donde solo falta el dato.
3. **El carril y el relleno nunca son el mismo color.** Igualarlos hace que el 0% se distinga de
   «sin datos» **y borra el avance**: una torre al 11% y tres al 0% se ven idénticas.

**No se aplica a recuentos de actividad** —visitantes, reservas—: contar lo que pasó no es un
logro ni un problema, y van en neutro.

## Las alertas se cuentan una vez

La píldora de «N alertas operativas» **cuenta la misma lista que abre**. Antes había dos cálculos y
derivaron hasta dar tres cifras del mismo concepto en una pantalla —la píldora decía 90, las
tarjetas sumaban 33, el cajón listaba 4— porque uno contaba cuentas vencidas y el otro unidades, y
ni cubrían las mismas categorías. Ver [[trampas-conocidas]].

## Estado: ✅ fixes aplicados

Los fixes implementados corrigen problemas de layout en mobile, aseguran que las transiciones usen propiedades específicas (nunca `transition: all` per [[absolute-bans]]), y que los KPIs fluid respondan correctamente en todos los breakpoints.

## Accesos rápidos

El dashboard incluye accesos directos a las acciones más frecuentes del administrador: registrar pago, crear ticket, ver reservas pendientes. Estos botones usan la variante `default` del [[componentes|Button]] con `rounded-xl` y el color `--brand-700`.

## Relaciones

- Véase también: [[layout-patterns]], [[tipografia]], [[tokens-color]]
- Depende de: [[billing]], [[visitantes]], [[paquetes]], [[pqrs]]
- Se conecta con: [[componentes]], [[absolute-bans]], [[mobile-first-ios]]

## Fuentes

- [[product-md]], [[design-md]], [[backlog-md]]
