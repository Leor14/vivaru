/**
 * El aviso de mora que manda Cartera («Enviar aviso a residentes») a las unidades elegidas.
 *
 * **`D-1` (lote «Análisis de la plataforma», 15 sep 2026).** Hasta ese día el aviso exigía elegir
 * unidades pero creaba un comunicado **sin audiencia**, que ve todo el conjunto: le decía «tienes
 * cartera en mora» también a quien estaba al día, y el mensaje de éxito lo daba por «enviado a N
 * unidad(es) en mora». En producción quedó uno así en Santa María.
 *
 * Ahora el comunicado va dirigido (`audience: "units"`) a esas unidades y a ninguna más: la regla
 * de `communications` solo deja leerlo a sus residentes (`D-2b`) y el aviso solo les llega a ellos
 * (`D-2`). **Sin unidades no se construye**: un comunicado dirigido sin unidades no lo podría leer
 * nadie.
 */

export const TITULO_AVISO_DE_MORA = "Aviso de cartera — Saldo pendiente";

export function construirAvisoDeMora(input: { unitIds: readonly string[]; mensaje: string }) {
  const unidades = [...new Set(input.unitIds.filter((unitId) => typeof unitId === "string" && unitId.trim().length > 0))];
  if (unidades.length === 0) {
    throw new Error("El aviso de mora necesita al menos una unidad.");
  }
  return {
    title: TITULO_AVISO_DE_MORA,
    message: input.mensaje.trim(),
    status: "published" as const,
    audience: "units" as const,
    audienceTowers: [] as string[],
    audienceUnitIds: unidades,
  };
}

/** Lo que dice la pantalla al terminar: a quién se publicó, sin afirmar que están en mora. */
export function textoDeAvisoEnviado(unidades: number) {
  return unidades === 1
    ? "Aviso publicado para los residentes de 1 unidad."
    : `Aviso publicado para los residentes de ${unidades} unidades.`;
}
