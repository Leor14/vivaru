/**
 * Ambiente de despliegue — fuente única de verdad.
 *
 * Gobierna las cuatro separaciones entre staging y producción (ver
 * `docs/plan-self-service-trial.md` §13): indexación, correo, analítica e
 * identificación visual. Un solo flag para no tener cuatro criterios distintos.
 *
 * OJO: `NEXT_PUBLIC_APP_ENV` debe leerse SIEMPRE de forma literal. Next.js solo
 * inyecta en el bundle del cliente los accesos escritos textualmente; un acceso
 * dinámico (`process.env[key]`) llega como `undefined` en el navegador. Ese bug
 * ya nos costó un incidente con la configuración de Firebase.
 */

export type AppEnv = "production" | "staging" | "development";

export const APP_ENV: AppEnv = ((): AppEnv => {
  const raw = process.env.NEXT_PUBLIC_APP_ENV;
  if (raw === "staging" || raw === "development") return raw;
  return "production";
})();

/** `true` solo en el ambiente productivo real. */
export const isProduction = APP_ENV === "production";

/**
 * `true` en cualquier ambiente que NO sea producción. Es el que se usa para
 * decidir si algo debe quedar oculto a buscadores, marcado visualmente o
 * desviado a un buzón interno.
 */
export const isNonProduction = !isProduction;

/** Etiqueta corta para banners y asuntos de correo. */
export const APP_ENV_LABEL: Record<AppEnv, string> = {
  production: "Producción",
  staging: "Ambiente de pruebas",
  development: "Desarrollo local",
};
