/**
 * El tema del usuario: dato canonico en Firestore, espejo en el navegador.
 *
 * `PRD-V-FEAT-007`. El tema vive en `users/{uid}.tema`, y ese documento no se
 * puede leer antes de que `onAuthStateChanged` resuelva. Sin nada mas, CADA
 * carga se pintaria en claro y saltaria a oscuro al llegar la sesion. El espejo
 * de `localStorage` existe solo para pintar el primer fotograma.
 *
 * **El espejo es cache, nunca fuente de verdad.** Si discrepa del documento,
 * gana el documento y el espejo se reescribe. Y NO guarda nada personal: ni el
 * uid, ni el conjunto, ni el rol — una palabra de siete letras.
 */
export const TEMAS = ["claro", "oscuro"] as const;
export type Tema = (typeof TEMAS)[number];

export const TEMA_POR_DEFECTO: Tema = "claro";
export const CLAVE_ESPEJO = "vivaru.tema";
export const ATRIBUTO = "data-tema";

/** Un valor desconocido NO es un error: se pinta claro y el documento se deja
 *  como esta. Corregirlo en silencio escondería el defecto que lo escribio. */
export function normalizarTema(valor: unknown): Tema {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : TEMA_POR_DEFECTO;
}

/** Toda lectura y escritura del espejo va con red: en una ventana privada, o
 *  con el almacenamiento bloqueado, `localStorage` LANZA al tocarlo. */
export function leerEspejo(): Tema | null {
  try {
    const v = window.localStorage.getItem(CLAVE_ESPEJO);
    return v && TEMAS.includes(v as Tema) ? (v as Tema) : null;
  } catch {
    return null;
  }
}

export function escribirEspejo(tema: Tema): void {
  try {
    window.localStorage.setItem(CLAVE_ESPEJO, tema);
  } catch {
    /* sin espejo se pierde el primer fotograma, no el tema */
  }
}

export function borrarEspejo(): void {
  try {
    window.localStorage.removeItem(CLAVE_ESPEJO);
  } catch {
    /* idem */
  }
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === TEMA_POR_DEFECTO) raiz.removeAttribute(ATRIBUTO);
  else raiz.setAttribute(ATRIBUTO, tema);
}

/**
 * El script que va en `<head>`, BLOQUEANTE y antes de pintar. Se escribe como
 * cadena porque tiene que ejecutarse antes de que React hidrate: cualquier cosa
 * dentro de un componente llega tarde y produce el destello.
 */
export const GUION_ANTI_DESTELLO = `try{var t=localStorage.getItem(${JSON.stringify(
  CLAVE_ESPEJO,
)});if(t==="oscuro")document.documentElement.setAttribute(${JSON.stringify(
  ATRIBUTO,
)},"oscuro")}catch(e){}`;
