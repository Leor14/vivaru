/**
 * **`L-13` — cuántas personas vieron un comunicado. Funciones puras.**
 *
 * Lote «Análisis de la plataforma», pág. 5: «Sería bueno saber cuántas personas vieron el
 * comunicado». Medido en producción el 17 de septiembre de 2026: **no existía ningún rastro de
 * lectura** —ni colección, ni campo— y el camino que parecía gratis **no sirve**: los 156 avisos de
 * comunicado de `notifications` sí llevan `read` (54 leídos), pero **su `link` es
 * `/resident/communications` para los 156**, sin el id del comunicado. Un aviso leído no se puede
 * atribuir al comunicado que lo originó, así que contar por ahí habría dado un número con la
 * apariencia correcta y sin significado.
 *
 * **Qué significa «vio», exactamente:** que el comunicado estuvo en su pantalla. Se registra cuando
 * la tarjeta entra en el viewport del residente, no cuando la lista se carga: abrir la pantalla no
 * es haber visto los cuarenta. No es «lo leyó» —eso no lo puede saber ningún software— y la
 * pantalla lo dice con esas palabras.
 *
 * **Y el registro empieza el 18 de septiembre de 2026.** Los 40 comunicados publicados antes van a
 * enseñar cero, y eso **no es que nadie los viera**: es que nadie lo estaba anotando. Decirlo en
 * pantalla es la diferencia entre un dato y una conclusión falsa.
 */

/** El día en que empezó a anotarse. Anterior a esto, un cero no significa nada. */
export const LECTURAS_DESDE = "2026-09-18";

export type LecturaDeComunicado = {
  id: string;
  tenantId: string;
  communicationId: string;
  uid: string;
  name?: string;
  /** La ÚLTIMA vez que lo tuvo en pantalla, no la primera: la escritura se repite con `merge`. */
  seenAt?: unknown;
};

/**
 * El id del documento lleva los dos lados, y por eso **una persona no puede contar dos veces**: la
 * segunda escritura cae sobre el mismo documento. La regla de Firestore exige esta misma forma, así
 * que tampoco se puede anotar la lectura de otro.
 */
export function claveDeLectura(communicationId: string, uid: string): string {
  return `${communicationId}_${uid}`;
}

export type VistosDeComunicado = { total: number; nombres: string[] };

/**
 * Agrupa por comunicado. Los nombres salen ordenados y **sin repetir**, y quien no tenga nombre
 * guardado no aparece en la lista pero **sí cuenta**: el total es de personas, no de nombres.
 */
export function resumenDeLecturas(
  lecturas: readonly LecturaDeComunicado[],
): Map<string, VistosDeComunicado> {
  const porComunicado = new Map<string, { uids: Set<string>; nombres: Set<string> }>();
  for (const lectura of lecturas) {
    const id = (lectura.communicationId ?? "").trim();
    const uid = (lectura.uid ?? "").trim();
    if (!id || !uid) continue;
    const acc = porComunicado.get(id) ?? { uids: new Set<string>(), nombres: new Set<string>() };
    acc.uids.add(uid);
    const nombre = (lectura.name ?? "").trim();
    if (nombre) acc.nombres.add(nombre);
    porComunicado.set(id, acc);
  }
  const resumen = new Map<string, VistosDeComunicado>();
  for (const [id, acc] of porComunicado) {
    resumen.set(id, {
      total: acc.uids.size,
      nombres: [...acc.nombres].sort((a, b) => a.localeCompare(b, "es-CO")),
    });
  }
  return resumen;
}

/** «Nadie todavía» · «1 persona» · «7 personas». El plural, concordado. */
export function textoDeVistos(total: number): string {
  if (total <= 0) return "Nadie todavía";
  return total === 1 ? "1 persona" : `${total} personas`;
}

/**
 * ¿Se publicó antes de que existiera el registro? Compara por DÍA y con la fecha local, que es la
 * que ve quien mira la pantalla.
 */
export function anteriorAlRegistro(publishedAt: unknown, desde = LECTURAS_DESDE): boolean {
  if (!publishedAt) return false;
  const fecha =
    typeof publishedAt === "object" && publishedAt !== null && "toDate" in publishedAt && typeof (publishedAt as { toDate?: () => Date }).toDate === "function"
      ? (publishedAt as { toDate: () => Date }).toDate()
      : new Date(String(publishedAt));
  if (Number.isNaN(fecha.getTime())) return false;
  const dos = (n: number) => String(n).padStart(2, "0");
  const dia = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
  return dia < desde;
}
