/**
 * Tipos mínimos de la semilla demo, **solo para que las pruebas puedan leerla**.
 *
 * El fichero es un `.mjs` de datos puros —no ejecuta nada— y no va a pasarse a
 * TypeScript: lo corre `seed-tenant.mjs` con node, sin compilar. Pero
 * `functions/tests` sí pasa por `tsc`, y sin esto la importación entra como
 * `any` y el typecheck se pone en rojo, que está en 0 y así se queda.
 *
 * Se declara **lo que las pruebas usan**, no todo lo que exporta: un `.d.mts`
 * exhaustivo sería una segunda copia del fichero, y envejecería sola.
 */
export type UnidadDeSemilla = { id: string; unitId: string; displayName: string; tower?: string };

export declare const TENANT_MX: { id: string; name?: string };
export declare const UNITS_MX: UnidadDeSemilla[];
