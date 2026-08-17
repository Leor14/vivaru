/**
 * Partir el borrador asistido en tramos pintables — la parte con lógica del
 * resaltado de frases marcadas (Fase 3 de `PRD-VAI-FEAT-002`, tras la sesión
 * del 16 de agosto de 2026).
 *
 * **Módulo puro a propósito:** ni React ni Firebase, la misma forma que
 * `datos-faltantes.ts`. Qué se resalta y qué no es la decisión con más carga
 * de producto del cambio —el aviso general ya se probó con una persona y no
 * cambió su conducta—, y tiene que poder probarse sin montar un navegador.
 *
 * **Este módulo NO decide qué frases se marcan.** Eso lo hace el criterio del
 * servidor (`functions/src/ai/afirmaciones.ts`), que es fuente única; aquí
 * solo se corta el texto por las posiciones que el servidor ya calculó.
 * Copiar la expresión regular a este lado sería la segunda copia contra la
 * que ese archivo avisa — y además `src/` no puede importar de `functions/`
 * (trampa número uno de `CLAUDE.md`), así que la posición viaja en la
 * respuesta y el criterio se queda donde está.
 */

/** Lo que manda el servidor: un trozo literal del borrador y dónde está. */
export interface FraseParaResaltar {
  texto: string;
  desde: number;
  hasta: number;
}

/** Un pedazo del borrador, con la única pregunta que la pantalla hace: ¿va resaltado? */
export interface TramoDeBorrador {
  texto: string;
  marcado: boolean;
}

/**
 * ¿La posición corta exactamente el texto que dice cortar?
 *
 * **Un fragmento que no cuadra se DESCARTA, no se estira ni se busca.** El
 * frente y las functions no se despliegan juntos: si el servidor viejo —o uno
 * futuro con otro criterio— manda posiciones que no casan con este borrador,
 * resaltar por esas posiciones marcaría palabras inocentes. Un resaltado que
 * señala lo que no es se deja de creer a los tres tickets, igual que el aviso
 * general; no resaltar deja la pantalla exactamente como estaba ayer, que es
 * el fallback correcto de todo lo asistido.
 */
function cuadra(borrador: string, frase: FraseParaResaltar): boolean {
  return (
    Number.isInteger(frase.desde) &&
    Number.isInteger(frase.hasta) &&
    frase.desde >= 0 &&
    frase.hasta <= borrador.length &&
    frase.desde < frase.hasta &&
    borrador.slice(frase.desde, frase.hasta) === frase.texto
  );
}

/**
 * Corta el borrador en tramos alternos (normal / marcado) por las posiciones
 * del servidor.
 *
 * Propiedades que las pruebas sostienen y la pantalla necesita:
 *
 * - **Concatenar los tramos devuelve el borrador exacto.** El resaltado es
 *   presentación: ni una letra se añade, se quita o se reordena.
 * - Sin tramos vacíos, para no sembrar el DOM de nodos de cero letras.
 * - Fragmentos desordenados se ordenan; solapados o que no cuadran, se
 *   descartan (ver `cuadra`). Con la lista vacía, un solo tramo sin marcar:
 *   la pantalla de siempre.
 */
export function partirEnTramos(
  borrador: string,
  frases: readonly FraseParaResaltar[],
): TramoDeBorrador[] {
  if (!borrador) return [];

  const validas = frases
    .filter((f) => cuadra(borrador, f))
    .sort((a, b) => a.desde - b.desde);

  const tramos: TramoDeBorrador[] = [];
  let cursor = 0;
  for (const frase of validas) {
    // Un solapado empezaría antes de donde va el cursor. No debería llegar
    // ninguno —el criterio del servidor barre de izquierda a derecha—, pero si
    // llega, marcar dos veces el mismo trozo duplicaría texto en pantalla.
    if (frase.desde < cursor) continue;
    if (frase.desde > cursor) tramos.push({ texto: borrador.slice(cursor, frase.desde), marcado: false });
    tramos.push({ texto: frase.texto, marcado: true });
    cursor = frase.hasta;
  }
  if (cursor < borrador.length) tramos.push({ texto: borrador.slice(cursor), marcado: false });

  return tramos;
}
