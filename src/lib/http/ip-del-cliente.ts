/**
 * `PRD-V-FIX-005` · H5 / R7 — la IP de un límite es la que ve la infraestructura, no la que manda
 * el cliente.
 *
 * **Medido en staging el 12 sep de 2026**, con una petición a `/api/lead` que traía un
 * `X-Forwarded-For` falso: detrás de App Hosting llega «lo que mandó el cliente, la IP real, y DOS
 * saltos de Google». La IP del cliente es la tercera empezando por el final. `/api/lead` y
 * `/api/demo` tomaban la PRIMERA, que la escribe quien llama: un encabezado falso esquivaba el límite.
 *
 * Las callables, que el navegador llama directo, reciben un solo salto menos: allí la buena es la
 * última (`functions/src/ip-del-cliente.ts`). Por eso el número de saltos va por parámetro.
 *
 * Con menos entradas de las esperadas, la infraestructura cambió: se devuelve `null` —el límite por
 * IP no se aplica— en vez de adivinar. Adivinar mal sería peor: contaría una IP de Google, la misma
 * para todo el mundo, y el límite frenaría a todos a la vez.
 */
export const SALTOS_DE_APP_HOSTING = 2;

export function ipDelCliente(
  xff: string | null | undefined,
  saltosDeLaInfraestructura = SALTOS_DE_APP_HOSTING,
): string | null {
  if (!xff) return null;
  const entradas = xff
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e !== "");
  const posicion = entradas.length - 1 - saltosDeLaInfraestructura;
  return posicion >= 0 ? entradas[posicion] : null;
}
