// El reloj de la semilla: días de negocio en la hora de Puebla.
//
// `America/Mexico_City` no tiene horario de verano desde octubre de 2022, así que es UTC−6 todo el
// año y basta un desfase fijo. **Todo día es una cadena 'YYYY-MM-DD' LOCAL** y nunca sale de
// `toISOString().slice(0, 10)`: ese es el día UTC, y desde las 18:00 de México ya es mañana
// (CLAUDE.md, «hoy UTC no es hoy local»). Los meses se desplazan con `Date.UTC(año, mes + n, 1)`,
// nunca con `setMonth` sobre una fecha con día: un 31 se desborda.
//
// Puro: no lee el reloj del sistema salvo `hoyLocal()`, que es explícito.

export const DESFASE_HORAS = 6;

const dos = (n) => String(n).padStart(2, "0");
const deUTC = (t) => `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}-${dos(t.getUTCDate())}`;

export function partes(dia) {
  const [a, m, d] = dia.split("-").map(Number);
  return { a, m, d };
}

/** El día local de Puebla de un instante. */
export function diaLocal(instante) {
  return deUTC(new Date(instante.getTime() - DESFASE_HORAS * 3_600_000));
}

/** El instante de un día y una hora locales de Puebla. */
export function instante(dia, hora = "12:00") {
  const { a, m, d } = partes(dia);
  const [h, min] = hora.split(":").map(Number);
  return new Date(Date.UTC(a, m - 1, d, h + DESFASE_HORAS, min));
}

export function sumarDias(dia, n) {
  const { a, m, d } = partes(dia);
  return deUTC(new Date(Date.UTC(a, m - 1, d + n)));
}

export function diasEntre(desde, hasta) {
  const x = partes(desde);
  const y = partes(hasta);
  return Math.round((Date.UTC(y.a, y.m - 1, y.d) - Date.UTC(x.a, x.m - 1, x.d)) / 86_400_000);
}

/** 0 = domingo … 6 = sábado, del día de la cadena (no de un instante). */
export function diaDeSemana(dia) {
  const { a, m, d } = partes(dia);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export const esHabil = (dia) => {
  const w = diaDeSemana(dia);
  return w !== 0 && w !== 6;
};

export const mesDe = (dia) => dia.slice(0, 7);

/** El mes `'YYYY-MM'` desplazado `n` meses. */
export function mesMas(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}`;
}

export function diasDelMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** El día `d` de un mes, sin pasarse del último. */
export const diaDelMes = (mes, d) => `${mes}-${dos(Math.min(d, diasDelMes(mes)))}`;

/** Los días de [desde, hasta], los dos incluidos. */
export function dias(desde, hasta) {
  const lista = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) lista.push(d);
  return lista;
}

/** Los meses `'YYYY-MM'` de [desde, hasta], los dos incluidos. */
export function meses(desdeMes, hastaMes) {
  const lista = [];
  for (let m = desdeMes; m <= hastaMes; m = mesMas(m, 1)) lista.push(m);
  return lista;
}

/** Suma `n` días hábiles, de lunes a viernes y sin festivos. */
export function sumarHabiles(dia, n) {
  let d = dia;
  let faltan = n;
  while (faltan > 0) {
    d = sumarDias(d, 1);
    if (esHabil(d)) faltan -= 1;
  }
  return d;
}

/** El día hábil más cercano en o después de `dia`. */
export function habilDesde(dia) {
  let d = dia;
  while (!esHabil(d)) d = sumarDias(d, 1);
  return d;
}

/** El día hábil más cercano en o antes de `dia`. */
export function habilHasta(dia) {
  let d = dia;
  while (!esHabil(d)) d = sumarDias(d, -1);
  return d;
}

/** El último día hábil de un mes. */
export const ultimoHabil = (mes) => habilHasta(diaDelMes(mes, 31));

/** El único punto que lee el reloj del sistema: el «hoy» de Puebla. */
export const hoyLocal = () => diaLocal(new Date());
