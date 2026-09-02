/**
 * `PRD-V-PLAT-006` · **la capa que EXPLICA el rechazo de la puerta de buzones.**
 *
 * **Es un ESPEJO de `functions/src/buzones-admisibles.ts`**, copiado a mano porque `src/` no puede
 * importar de `functions/` sin romper el build de App Hosting (CLAUDE.md). Lo vigila
 * `tests/buzones-espejo.test.ts`, que lee aquel fichero como texto: copiar a mano es el error que
 * este repositorio ya cometió tres veces, y el daño nunca fue la copia sino que **nada avisara
 * cuando una se quedaba atrás**.
 *
 * ## Por qué esta capa existe, si las reglas ya impiden
 *
 * Es la misma razón que `validarCodigoDeCuenta` de `PLAT-003`: **una regla de Firestore no puede
 * decir POR QUÉ**. Rechaza con `permission-denied`, que es indistinguible de «no eres
 * administrador», y `CA1` pide que el alta falle **diciendo el motivo de `RN-3`**. El servidor es
 * quien impide; esta capa es quien explica.
 *
 * ## Y por qué EXPLICA en vez de VALIDAR antes
 *
 * Porque no puede validar: el predicado completo necesita `config/correosDelEquipo`, y **el
 * `tenant_admin` no puede leerla** —lo prohíbe D2, y las reglas lo cumplen—. Un front que
 * rechazara todo lo que no es dominio inerte daría falsos positivos justo sobre las cuentas con
 * las que el equipo valida el producto, que es lo que D2 vino a proteger.
 *
 * Así que el reparto es: se intenta la escritura, y **si el servidor la rechaza**, esto decide si
 * el rechazo lo explica la puerta. Para eso solo mira lo que el administrador SÍ puede leer —la
 * marca del conjunto y las banderas— y nunca afirma nada sobre la lista del equipo.
 */

/**
 * Dominios que no alcanzan a nadie. **Espejo de `DOMINIOS_INERTES`.**
 *
 * Aquí se usa solo para DESAMBIGUAR: si el correo es inerte, el rechazo no puede ser de la puerta
 * y hay que dejar el mensaje genérico. Nunca para afirmar que una dirección es admisible — eso lo
 * decide el servidor, que además conoce la lista del equipo.
 */
export const DOMINIOS_INERTES = [
  "ejemplo.vivaru.app",
  "demo.grupovivaru.com",
  "hogaru.test",
  "demo.co",
  "example.com",
] as const;

/** Espejo de `MOTIVO_RECHAZO`. El guardián exige que esta frase esté contenida en el mensaje. */
export const MOTIVO_RECHAZO =
  "En un conjunto de demostración solo se admiten direcciones de prueba o del equipo.";

/**
 * Lo que ve quien teclea. Lleva el motivo del servidor **y qué hacer**, que el servidor no dice
 * porque su mensaje también lo lee una máquina.
 */
export const MENSAJE_PUERTA = `${MOTIVO_RECHAZO} Si es una dirección del equipo, pide al superadministrador que la añada a la lista.`;

/** El dominio de una dirección, en minúsculas, o `null` si no es una dirección. */
export function dominioDe(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const arroba = email.lastIndexOf("@");
  if (arroba <= 0 || arroba === email.length - 1) return null;
  return email.slice(arroba + 1).trim().toLowerCase();
}

/** Un dominio es inerte si está en el catálogo o es un subdominio suyo. */
export function esDominioInerte(dominio: string | null): boolean {
  if (!dominio) return false;
  return DOMINIOS_INERTES.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

/**
 * ¿Este rechazo lo explica la puerta de buzones?
 *
 * **Solo dice que sí cuando las tres condiciones se cumplen a la vez**, y todas se miden con datos
 * que el administrador puede leer:
 *
 * 1. el conjunto lleva la marca `sinClienteDetras`,
 * 2. la bandera está encendida para ese conjunto,
 * 3. la dirección **no** es de dominio inerte.
 *
 * Si alguna falla, devuelve `null` y el llamador deja su mensaje de siempre. **Es deliberadamente
 * conservador**: decir «tu correo no cabe aquí» cuando en realidad faltaba un permiso manda a
 * quien lo lee a arreglar lo que no está roto. Cf. el aviso de `codigo-de-cuenta.ts`.
 *
 * Puede equivocarse en un solo sentido, y es el barato: una dirección **del equipo** —que el
 * servidor admitiría— rechazada por otra causa recibiría este mensaje. No pasa, porque si el
 * servidor la admite no hay rechazo que explicar.
 */
export function laPuertaExplicaElRechazo(input: {
  conjuntoMarcado: boolean;
  puertaEncendida: boolean;
  email: string | null | undefined;
}): boolean {
  if (!input.conjuntoMarcado || !input.puertaEncendida) return false;
  return !esDominioInerte(dominioDe(input.email));
}
