import type { CategoriaDatoFaltante } from "@/lib/ai/datos-faltantes";

/**
 * Qué hizo el administrador con el borrador que le propusimos — Paso 2.5,
 * y precondición del piloto del 2.6.
 *
 * **Sin esto, el 2.6 no se puede correr.** Sus métricas son «propuestas
 * aceptadas», «magnitud de la edición» y si las peticiones de datos sirven de
 * algo; las tres se pierden en el momento en que se cierra el modal si nadie
 * las anota.
 *
 * Módulo puro a propósito: ni React ni Firebase. Es la pieza que decide **qué
 * sale del navegador**, y esa decisión tiene que poder leerse y probarse sin
 * rodearla de infraestructura.
 *
 * ## La regla que manda: metadatos sí, contenido no
 *
 * Es la política de datos del Paso 0, y aquí se cumple igual que en `aiUsage`:
 * **el tipo no tiene dónde meter contenido.** No hay ni un campo de texto
 * libre. De las peticiones descartadas viaja la *categoría* —`duracion`,
 * `fecha`—, nunca la frase, porque la frase habla del conjunto: «¿hasta qué
 * hora estará cerrada la alberca de la torre 3?» es contenido, no métrica.
 *
 * De la edición viaja **un número**, no los dos textos. Se calcula aquí, en el
 * navegador, justo para no tener que mandar el borrador ni lo que quedó.
 */

/** Un documento por sesión de borrador, no uno por clic. */
export interface EstadoFeedback {
  /** Cuántas veces pidió un borrador. Es el denominador de todo lo demás. */
  propuestas: number;
  /** Insertó alguna propuesta en el formulario. */
  aplicada: boolean;
  /** La insertó y se arrepintió. Señal distinta de no aplicarla nunca. */
  deshecha: boolean;
  /** Guardó el comunicado teniendo una propuesta dentro. */
  guardada: boolean;
  /** Categorías que se le enseñaron en la última propuesta. El denominador de los descartes. */
  mostrados: CategoriaDatoFaltante[];
  /** Categorías que marcó «no aplica». Con repetición: descartar dos fechas son dos señales. */
  descartados: CategoriaDatoFaltante[];
  /** 0–100: qué proporción del borrador cambió antes de guardar. `null` si no guardó. */
  distanciaEdicion: number | null;
}

export const FEEDBACK_INICIAL: EstadoFeedback = {
  propuestas: 0,
  aplicada: false,
  deshecha: false,
  guardada: false,
  mostrados: [],
  descartados: [],
  distanciaEdicion: null,
};

export type EventoFeedback =
  | { tipo: "propuesta"; mostrados: CategoriaDatoFaltante[] }
  | { tipo: "descarte"; categoria: CategoriaDatoFaltante }
  | { tipo: "aplicada" }
  | { tipo: "deshecha" }
  | { tipo: "guardada"; distanciaEdicion: number };

export function aplicarEvento(estado: EstadoFeedback, evento: EventoFeedback): EstadoFeedback {
  switch (evento.tipo) {
    case "propuesta":
      return {
        ...estado,
        propuestas: estado.propuestas + 1,
        // Se queda con lo mostrado en la ÚLTIMA propuesta, igual que la pantalla:
        // acumular las de todas las versiones inflaría el denominador con
        // peticiones que el administrador ya resolvió pidiendo otra versión.
        mostrados: [...evento.mostrados],
        descartados: [],
      };
    case "descarte":
      return { ...estado, descartados: [...estado.descartados, evento.categoria] };
    case "aplicada":
      // `deshecha` se limpia: volver a aplicar después de deshacer no deja al
      // administrador marcado como alguien que se arrepintió.
      return { ...estado, aplicada: true, deshecha: false };
    case "deshecha":
      return { ...estado, deshecha: true };
    case "guardada":
      return { ...estado, guardada: true, distanciaEdicion: evento.distanciaEdicion };
    default:
      return estado;
  }
}

/** Palabras, sin puntuación ni mayúsculas: cambiar una coma no es editar. */
function palabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Cuánto cambió el borrador, de 0 a 100.
 *
 * **Distancia de edición sobre PALABRAS, no sobre caracteres.** Sobre
 * caracteres, corregir una tilde y reescribir un párrafo se parecen demasiado;
 * y el costo crece con el cuadrado del texto, que en un comunicado largo se
 * nota. Sobre palabras es más barato y significa lo que queremos saber: qué
 * proporción del texto es distinta.
 *
 * Se calcula **en el navegador a propósito**: es la razón por la que no hace
 * falta mandar ni el borrador propuesto ni el guardado.
 */
export function distanciaEdicion(propuesto: string, final: string): number {
  const a = palabras(propuesto);
  const b = palabras(final);

  if (a.length === 0 && b.length === 0) return 0;
  // Borró la propuesta entera, o la escribió partiendo de nada: 100% cambiado.
  if (a.length === 0 || b.length === 0) return 100;

  // Levenshtein por filas: solo se necesita la anterior, así que la memoria es
  // lineal aunque el comunicado sea largo.
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo);
    }
    previa = actual;
  }

  const distancia = previa[b.length];
  return Math.min(100, Math.round((distancia / Math.max(a.length, b.length)) * 100));
}

/**
 * Lo que se manda al servidor, o `null` si no hay nada que contar.
 *
 * **Sin una sola propuesta no se escribe nada.** Abrir el formulario y cerrarlo
 * sin pedir ayuda no es un dato de esta métrica: sería una fila por cada vez
 * que alguien crea un comunicado a mano, y ensuciaría el denominador de todo.
 */
export function paraEnviar(estado: EstadoFeedback): EstadoFeedback | null {
  return estado.propuestas > 0 ? estado : null;
}
