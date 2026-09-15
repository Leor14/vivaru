import type { DocumentCategory } from "@/features/admin/services";

/**
 * **`D-2c` — con qué categoría se registra en Documentos el adjunto de un comunicado.**
 *
 * Lote «Análisis de la plataforma», plan `docs/plan-lote-analisis-plataforma.md`. Es el espejo de
 * `D-2b`: la regla ya limita quién lee un comunicado dirigido, pero sus adjuntos se registraban
 * en Documentos como `comunicado`, que la regla de `documents` concede a TODO residente. El
 * adjunto de un aviso para la torre 1 se leía desde la torre 2.
 *
 * Un comunicado general sigue dejando su adjunto a la vista de todos. Uno dirigido lo registra
 * como `comunicado_dirigido`, solo-administración: su audiencia lo ve dentro del comunicado.
 */
export function categoriaDelAdjuntoDeComunicado(audience: "all" | "towers" | "units"): DocumentCategory {
  return audience === "all" ? "comunicado" : "comunicado_dirigido";
}
