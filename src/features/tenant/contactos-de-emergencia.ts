/**
 * **Los números de emergencia del conjunto** (`L-32`, lote «Análisis de la plataforma», fase 7,
 * bloque 2).
 *
 * Una administradora colombiana los pidió para que el residente no tenga que buscar el teléfono de
 * la portería, los bomberos o el ascensorista en un grupo de WhatsApp. **David decidió el 18 de
 * septiembre de 2026 que son DEL CONJUNTO**: los escribe la administración, y los leen el residente
 * y la portería. No son de la plataforma ni los redacta Vivaru.
 *
 * Aquí está la parte pura —leer, limpiar y validar la lista—, separada de la pantalla porque es lo
 * que decide qué se guarda y qué se enseña, y quería poder probarlo sin navegador.
 */

/** Lo que se guarda en `tenantSettings.contactosDeEmergencia`. */
export type ContactoDeEmergencia = {
  nombre: string;
  telefono: string;
  /** Opcional: «Solo de 8 a 18», «Torre 2», «Marcar antes al 300…». */
  nota?: string;
};

/**
 * Tope de contactos. No es una restricción técnica: una lista larga en una emergencia no se lee.
 * Si un conjunto necesita más, la conversación es qué sobra, no subir el número.
 */
export const MAXIMO_DE_CONTACTOS = 12;

/** Lo que cabe en un teléfono de verdad: dígitos, espacios, `+`, `-`, paréntesis y `#`. */
const TELEFONO = /^[+()#\-\s\d]{3,24}$/;

export type ErrorDeContacto = { indice: number; campo: "nombre" | "telefono"; mensaje: string };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Lee la lista que viene de la base. **Descarta en silencio lo que no tenga forma** —un contacto sin
 * nombre o sin teléfono no sirve de nada en una emergencia— y recorta al tope, para que un dato
 * viejo o manipulado no rompa la pantalla del residente.
 */
export function normalizarContactos(raw: unknown): ContactoDeEmergencia[] {
  if (!Array.isArray(raw)) return [];
  const contactos: ContactoDeEmergencia[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const nombre = texto(r.nombre);
    const telefono = texto(r.telefono);
    if (!nombre || !telefono) continue;
    const nota = texto(r.nota);
    contactos.push({ nombre, telefono, ...(nota ? { nota } : {}) });
    if (contactos.length === MAXIMO_DE_CONTACTOS) break;
  }
  return contactos;
}

/**
 * Valida lo que escribe la administración. **Al guardar sí se avisa**, al revés que al leer: si
 * alguien dejó una fila a medias, lo que hay que hacer es decírselo, no tragársela.
 *
 * Una fila **entera vacía** no es un error: es la fila que el formulario deja al añadir, y se cae
 * sola al guardar (`contactosParaGuardar`).
 */
export function validarContactos(filas: ReadonlyArray<Partial<ContactoDeEmergencia>>): ErrorDeContacto[] {
  const errores: ErrorDeContacto[] = [];
  filas.forEach((fila, indice) => {
    const nombre = texto(fila.nombre);
    const telefono = texto(fila.telefono);
    if (!nombre && !telefono) return;
    if (!nombre) errores.push({ indice, campo: "nombre", mensaje: "Escribe a quién se llama." });
    if (!telefono) {
      errores.push({ indice, campo: "telefono", mensaje: "Escribe el número." });
    } else if (!TELEFONO.test(telefono)) {
      errores.push({ indice, campo: "telefono", mensaje: "El número solo lleva dígitos, espacios y + ( ) - #." });
    }
  });
  if (filas.filter((f) => texto(f.nombre) || texto(f.telefono)).length > MAXIMO_DE_CONTACTOS) {
    errores.push({
      indice: MAXIMO_DE_CONTACTOS,
      campo: "nombre",
      mensaje: `Como máximo ${MAXIMO_DE_CONTACTOS} contactos: en una emergencia una lista larga no se lee.`,
    });
  }
  return errores;
}

/** Lo que se manda a Firestore: sin filas vacías y con los espacios recortados. */
export function contactosParaGuardar(
  filas: ReadonlyArray<Partial<ContactoDeEmergencia>>,
): ContactoDeEmergencia[] {
  return normalizarContactos(filas);
}

/**
 * El `href` del enlace para llamar. **Los espacios y los paréntesis no van en un `tel:`** —los
 * teclados de algunos teléfonos los marcan como tonos—, así que se quitan y se conserva el `+`.
 */
export function enlaceParaLlamar(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+#]/g, "")}`;
}
