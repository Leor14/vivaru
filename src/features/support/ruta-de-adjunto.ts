/**
 * La ruta en Storage de un adjunto de soporte.
 *
 * `PRD-V-FIX-005` · H3c: el equipo de Vivaru sube a `support/equipo/…`, porque la ruta —y la
 * `url`, que la lleva codificada— viaja en el hilo que el administrador del conjunto lee entero,
 * y con el uid de quien subía era la tercera vía a él. El cliente sigue bajo su propio uid, que
 * es suyo y es lo que `storage.rules` le deja escribir. La callable exige la misma carpeta:
 * `prefijoDeAdjuntos` en `functions/src/support.ts` es el espejo del servidor.
 */
export function rutaDeAdjunto(
  tenantId: string,
  uid: string,
  comoEquipo: boolean,
  nombre: string,
  ahora: number,
): string {
  const limpio = nombre.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-").slice(-120);
  return `tenants/${tenantId}/support/${comoEquipo ? "equipo" : uid}/${ahora}-${limpio}`;
}
