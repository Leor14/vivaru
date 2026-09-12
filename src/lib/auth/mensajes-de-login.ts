/**
 * Los mensajes de un inicio de sesión fallido, en UN solo sitio.
 *
 * `PRD-V-FIX-005` · H4 / R5 / `CF7` — credenciales inválidas dan **un solo** mensaje, exista o
 * no la cuenta, con o sin la protección de enumeración de Firebase. Estos textos vivían en dos
 * mapas —`normalizeLoginError` y `normalizeFirebaseError`— y los dos distinguían la cuenta
 * inexistente de la contraseña incorrecta: el día que alguien apagara esa protección, el login
 * volvería a decir quién tiene cuenta. Y cualquier otro error de Auth salía crudo, en inglés.
 */

export const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos.";
export const MENSAJE_CUENTA_DESACTIVADA = "Tu cuenta está desactivada. Contacta a la administración de tu conjunto.";
export const MENSAJE_DEMASIADOS_INTENTOS = "Demasiados intentos. Espera unos minutos.";
export const MENSAJE_CORREO_MAL_ESCRITO = "El correo no tiene un formato válido.";
export const MENSAJE_SIN_CONEXION = "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.";
export const MENSAJE_LOGIN_GENERICO = "No fue posible iniciar sesión. Intenta de nuevo.";

/** Los códigos que significan «estas credenciales no sirven», sin decir por qué. */
const CREDENCIALES_INVALIDAS = new Set([
  "invalid-credential",
  "invalid-login-credentials",
  "wrong-password",
  "user-not-found",
]);

/**
 * El mensaje de un código de Firebase Auth, con o sin el prefijo `auth/`. Un código de Auth
 * que no está aquí da el genérico: **nunca** el mensaje crudo de Firebase.
 */
export function mensajeDeLogin(codigo: string): string {
  const c = codigo.replace(/^auth\//, "");
  if (CREDENCIALES_INVALIDAS.has(c)) return MENSAJE_CREDENCIALES;
  if (c === "user-disabled") return MENSAJE_CUENTA_DESACTIVADA;
  if (c === "too-many-requests") return MENSAJE_DEMASIADOS_INTENTOS;
  if (c === "invalid-email") return MENSAJE_CORREO_MAL_ESCRITO;
  if (c === "network-request-failed") return MENSAJE_SIN_CONEXION;
  return MENSAJE_LOGIN_GENERICO;
}
