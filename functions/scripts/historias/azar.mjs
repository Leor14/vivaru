// Azar determinista para la semilla: la misma etiqueta da siempre la misma secuencia.
//
// Lo necesita la idempotencia: una segunda corrida tiene que querer escribir exactamente lo mismo
// que la primera, o el `crearSiFalta` no casaría y la historia se duplicaría. Por eso cada decisión
// se toma con un generador sembrado por una etiqueta estable (`"pago:encinos-03:2026-07"`), nunca
// con `Math.random()`.

/** FNV-1a de 32 bits: una etiqueta → una semilla. */
export function semilla(texto) {
  let h = 2_166_136_261 >>> 0;
  for (const c of String(texto)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h;
}

/** mulberry32 sobre la semilla de la etiqueta. */
export function azar(etiqueta) {
  let a = semilla(etiqueta);
  const real = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    real,
    /** Entero en [min, max], los dos incluidos. */
    entero: (min, max) => min + Math.floor(real() * (max - min + 1)),
    elegir: (lista) => lista[Math.floor(real() * lista.length)],
    probable: (p) => real() < p,
    barajar: (lista) => {
      const r = [...lista];
      for (let i = r.length - 1; i > 0; i -= 1) {
        const j = Math.floor(real() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    },
  };
}
