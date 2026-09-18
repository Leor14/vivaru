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
 * **Y el registro empieza en un INSTANTE, no un día.** Los comunicados publicados antes van a enseñar
 * cero, y eso **no es que nadie los viera**: es que nadie lo estaba anotando. Decirlo en pantalla es la
 * diferencia entre un dato y una conclusión falsa.
 *
 * **La primera versión comparaba el DÍA local con el 18 sep, y estaba mal.** El día depende de la zona
 * de quien mira: el comunicado de prueba se publicó a las 05:28 UTC del 18 —las 00:28 en Bogotá—, y el
 * navegador de la administración, en Ciudad de México, lo veía publicado el **17** y lo marcaba «Sin
 * registro» para siempre. Una misma pantalla decía cosas distintas según el país del que miraba. El
 * registro empezó cuando el front de producción sirvió con su regla, y eso es un instante.
 */

/**
 * El instante desde el que se anota. Producción empezó a servir el front de `L-13` hacia las
 * 03:28–03:30 UTC del 18 sep 2026 (`rollout-2026-09-18-002`, creado a las 03:22:30; la regla, a las
 * 03:20:18). **Se elige 03:35 a propósito, tarde:** un instante tardío solo hace decir «Sin registro» a
 * un comunicado que sí se contó; uno temprano haría pasar por completo un conteo al que le faltan vistas.
 */
export const LECTURAS_DESDE = "2026-09-18T03:35:00.000Z";

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
 * ¿Se publicó antes de que existiera el registro? Compara **instantes**, así que da lo mismo desde qué
 * zona horaria se mire.
 */
export function anteriorAlRegistro(publishedAt: unknown, desde = LECTURAS_DESDE): boolean {
  if (!publishedAt) return false;
  const fecha =
    typeof publishedAt === "object" && publishedAt !== null && "toDate" in publishedAt && typeof (publishedAt as { toDate?: () => Date }).toDate === "function"
      ? (publishedAt as { toDate: () => Date }).toDate()
      : new Date(String(publishedAt));
  if (Number.isNaN(fecha.getTime())) return false;
  return fecha.getTime() < new Date(desde).getTime();
}
