/**
 * `PRD-V-FIX-004` `CA7` — el aviso final de «Enviar acceso a N».
 *
 * El bucle de `/admin/residents` tragaba cada error y el aviso solo nombraba a la
 * persona. Desde `FIX-004` el servidor rechaza con un motivo que dice qué hacer, y
 * tirarlo convertía un rechazo explicado en un misterio.
 *
 * **Agrupa por motivo** porque el caso real es uno repetido: un padrón con varios
 * correos de administración daría el mismo texto largo una vez por persona. Enseña los
 * dos primeros motivos con hasta tres nombres cada uno, y cuenta el resto.
 */
export type EnvioFallido = { nombre: string; motivo: string };

const MAX_MOTIVOS = 2;
const MAX_NOMBRES = 3;

export function resumirEnvioDeAccesos(
  ok: number,
  total: number,
  fallidas: EnvioFallido[],
): { tipo: "exito" | "aviso"; texto: string } {
  if (fallidas.length === 0) {
    return { tipo: "exito", texto: `Acceso enviado a ${ok} persona${ok !== 1 ? "s" : ""}.` };
  }

  const porMotivo = new Map<string, string[]>();
  for (const { nombre, motivo } of fallidas) {
    porMotivo.set(motivo, [...(porMotivo.get(motivo) ?? []), nombre]);
  }

  const grupos = [...porMotivo.entries()];
  const partes = grupos.slice(0, MAX_MOTIVOS).map(([motivo, nombres]) => {
    const visibles = nombres.slice(0, MAX_NOMBRES).join(", ");
    const resto = nombres.length > MAX_NOMBRES ? ` y ${nombres.length - MAX_NOMBRES} más` : "";
    return `${visibles}${resto}: ${motivo}`;
  });
  const otros = grupos.length - MAX_MOTIVOS;
  const cola = otros > 0 ? ` · y ${otros} motivo${otros !== 1 ? "s" : ""} más` : "";

  return { tipo: "aviso", texto: `Acceso enviado a ${ok} de ${total}. No se pudo con ${partes.join(" · ")}${cola}` };
}
