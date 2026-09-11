import type { AppRole } from "@/lib/constants/roles";

/**
 * `PRD-V-PLAT-004` — el consejo de administración, dentro del portal del residente.
 *
 * **El consejero es un RESIDENTE con una marca, no un rol** (`RN-01`): conserva su unidad,
 * su estado de cuenta y sus pagos, y además ve las pantallas del consejo. Por eso entra por
 * `/resident` y no por `/admin` (`TBD-B`, decidido por David el 11 de septiembre de 2026), y
 * `canAccessPath` no cambia: la ruta ya es del residente. Lo que la cierra a los demás es
 * esta función, en el menú y en la propia pantalla.
 */
export const RUTA_DE_INFORMES_DEL_CONSEJO = "/resident/informes";

/**
 * ¿Ve esta sesión las pantallas del consejo? Las tres cosas a la vez:
 *
 * - **la bandera** `producto-rol-consejo` encendida para el conjunto. Apagarla quita las
 *   pantallas y **no** los permisos, que viven en las reglas y en el dato;
 * - **el rol `resident`**: un administrador ya ve más, y la portería no puede recibir la
 *   marca (`RN-03`);
 * - **la marca** en su membresía. Ausente es sin marca.
 */
export function veLasPantallasDelConsejo(
  usuario: { role: AppRole; isCommittee?: boolean } | null | undefined,
  banderaEncendida: boolean,
): boolean {
  return banderaEncendida && usuario?.role === "resident" && usuario.isCommittee === true;
}
