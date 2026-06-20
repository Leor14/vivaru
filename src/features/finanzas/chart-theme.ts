/**
 * Tema visual compartido de los gráficos del módulo Financiero (recharts).
 *
 * Extraído de la tendencia de cartera (`/admin/billing`) para que todos los
 * tableros del módulo compartan la misma "firma" visual: grid punteado, barras
 * redondeadas, paleta y ejes. Cualquier gráfico nuevo (libro, egresos, flujo de
 * caja) debe leer de aquí en vez de hardcodear estilos, así heredan también la
 * animación de entrada por defecto de recharts. Ver StatTile para los KPIs.
 */

export const chartColors = {
  barBlue: "#8cb2d6",
  barGreen: "#7ec4a9",
  barAmber: "#e0b66a",
  barRed: "#df9a8e",
  line: "#4d7190",
  grid: "#d6dfeb",
  axis: "#b9c6d6",
  axisTick: "#4f6273",
} as const;

/** Props para <CartesianGrid {...chartGrid} />. */
export const chartGrid = {
  strokeDasharray: "4 4",
  stroke: chartColors.grid,
  vertical: false,
} as const;

/** Props comunes de ejes para <XAxis {...chartAxis} /> y <YAxis {...chartAxis} />. */
export const chartAxis = {
  tick: { fill: chartColors.axisTick, fontSize: 12 },
  axisLine: { stroke: chartColors.axis },
  tickLine: { stroke: chartColors.axis },
} as const;

/** Props de forma para <Bar {...chartBar} fill={...} />. */
export const chartBar = {
  radius: [8, 8, 0, 0] as [number, number, number, number],
  maxBarSize: 36,
} as const;

/** Props para <Line {...chartLine} dataKey={...} />. */
export const chartLine = {
  type: "monotone",
  strokeWidth: 2.5,
  stroke: chartColors.line,
  dot: { r: 3 },
  activeDot: { r: 5 },
} as const;

/** Márgenes estándar del lienzo del gráfico. */
export const chartMargin = { top: 16, right: 18, left: 6, bottom: 8 } as const;
