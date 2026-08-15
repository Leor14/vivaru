/**
 * Los datos que le faltan a un borrador, y en qué orden se le enseñan a quien
 * lo escribe — Paso 2.5 de `docs/hoja-de-ruta-ia.md`.
 *
 * **Módulo puro a propósito:** ni React ni Firebase. La decisión de qué va
 * arriba es la pieza con más carga de producto de toda la pantalla, y tiene que
 * poder probarse sin montar un navegador. Es la misma forma que
 * `functions/src/ai/authorize.ts` y `quota.ts` en el servidor.
 *
 * Duplica las categorías del catálogo de `functions/` **sin alternativa**:
 * importar desde `functions/` rompe el `next build` de App Hosting, que hace
 * `npm ci` solo en la raíz. Es la trampa número uno de `CLAUDE.md`. Hay una
 * prueba que falla si las dos listas dejan de coincidir.
 */

/**
 * El orden NO es alfabético ni casual: **es el orden en que se muestran.**
 *
 * `duracion` va primera porque falta en el 95% de los avisos reales del corpus
 * y en el 68% de los de corte de agua — es el dato que hace que la gente baje a
 * caseta a preguntar cuándo vuelve el agua. Era el requisito número uno que
 * salió de la hipótesis de valor, y la razón por la que la operación subió a
 * v2: con una lista de frases sueltas, poner la duración arriba solo se podía
 * hacer buscando palabras.
 */
export const CATEGORIAS_DATO_FALTANTE = ["duracion", "fecha", "alcance", "accion", "otro"] as const;

export type CategoriaDatoFaltante = (typeof CATEGORIAS_DATO_FALTANTE)[number];

export interface DatoFaltante {
  categoria: CategoriaDatoFaltante;
  detalle: string;
}

/**
 * Cómo se le llama a cada categoría delante del administrador.
 *
 * En su idioma, no en el del esquema: nadie que administre un conjunto piensa
 * en «alcance», piensa en «a quién le afecta».
 */
export const ETIQUETA_CATEGORIA: Record<CategoriaDatoFaltante, string> = {
  duracion: "Cuánto dura",
  fecha: "Cuándo",
  alcance: "A quién afecta",
  accion: "Qué debe hacer el residente",
  otro: "Otro dato",
};

/**
 * Clave estable de un ítem: el modelo no devuelve identificadores, así que se
 * construye con lo que sí es estable dentro de una misma propuesta.
 */
export const claveDatoFaltante = (d: DatoFaltante): string => `${d.categoria}::${d.detalle}`;

/**
 * Ordena por prioridad de producto, **estable dentro de cada categoría**.
 *
 * La estabilidad importa: si dos datos son de la misma categoría, se conserva
 * el orden en que los puso el modelo. Reordenarlos sin motivo haría que dos
 * propuestas parecidas se leyeran distinto sin razón visible.
 */
export function ordenarDatosFaltantes(datos: readonly DatoFaltante[]): DatoFaltante[] {
  const peso = (c: CategoriaDatoFaltante): number => {
    const i = CATEGORIAS_DATO_FALTANTE.indexOf(c);
    // Una categoría desconocida no se descarta ni se cuela arriba. El servidor
    // ya la validó contra el enum, pero si mañana el catálogo crece y esta
    // copia se queda atrás, el dato se sigue viendo — al final, no perdido.
    return i === -1 ? CATEGORIAS_DATO_FALTANTE.length : i;
  };
  return [...datos].sort((a, b) => peso(a.categoria) - peso(b.categoria));
}

/** Etiqueta legible, con salida para una categoría que esta copia no conozca. */
export function etiquetaDe(categoria: CategoriaDatoFaltante): string {
  return ETIQUETA_CATEGORIA[categoria] ?? ETIQUETA_CATEGORIA.otro;
}
