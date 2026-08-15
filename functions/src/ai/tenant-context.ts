import type { Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Contexto del conjunto: lo que la plataforma sabe y el administrador no tiene
 * que volver a escribir.
 *
 * **Por qué existe, medido.** El borrador pregunta «¿a qué torres afecta?» en
 * edificios que no tienen torres. En el corpus de Quito la palabra «torre»
 * aparece **cero veces** en seis años y nueve meses, contra 274 en el de Ciudad
 * de México (`datasets/chat-vecinal-ecuador/analisis.md`), y en la corrida del
 * 14 de agosto de 2026 **seis de los ocho fallos que le quedan a
 * `v2-estructura` incluyen una pregunta de alcance** — en cuatro de ellos, en
 * lugar de la pregunta que sí importaba. En `falta-monto` el modelo preguntó por
 * las torres y se dejó la cifra de dinero.
 *
 * Se venía leyendo como un defecto del modelo. Es un defecto del diseño: el
 * cuarto dato no es igual de relevante en todos los conjuntos y lo tratábamos
 * como si lo fuera.
 *
 * **La salida NO es enseñarle a preguntar menos** —eso destruiría el valor del
 * producto, y está escrito desde el 12 de agosto—. Es darle el hecho y dejar que
 * decida: sin torres que preguntar, la pregunta sobra sola.
 *
 * ---
 *
 * **Lo resuelve el servidor, nunca el cliente.** Es el principio del Paso 1.2:
 * los claims proponen, la membresía dispone. La entrada de la operación sigue
 * siendo tres campos escritos por el administrador; esto viaja al lado, sacado
 * del conjunto de la sesión. Un cliente que mintiera aquí no robaría datos
 * ajenos, pero abriría la costumbre de que el navegador afirme cosas del
 * conjunto — y esa costumbre es justo la que la puerta vino a cerrar.
 *
 * Es además el primer «contexto» del catálogo, y el patrón que van a necesitar
 * PQRS y comprobantes, donde la entrada sí sale de la base de datos.
 */

export interface ContextoConjunto {
  /**
   * `true` — el conjunto está dividido en torres, bloques o manzanas.
   * `false` — es un edificio único.
   * **Ausente — no se sabe**, y entonces no viaja nada: el modelo se comporta
   * exactamente como hoy y pregunta.
   *
   * Que «no se sabe» sea un tercer valor y no un `false` por defecto es la
   * decisión de seguridad de este módulo. Ante la duda se pregunta de más, que
   * es el fallo barato; callar de más es el caro.
   */
  tieneAgrupaciones?: boolean;
}

/**
 * Clave laxa para contar agrupaciones distintas: minúsculas, sin acentos y sin
 * nada que no sea letra o número.
 *
 * **No es `normalizeTower` de `src/utils/tower.ts`, y no lo es a propósito.**
 * Duplicar la canonización real aquí —no se puede importar: App Hosting hace
 * `npm ci` solo en la raíz y `functions/` se despliega aparte— crearía dos
 * reglas que hay que mantener iguales para siempre. Esta clave es más tosca y
 * **solo puede equivocarse en una dirección**: `T1` y `Torre 1` son la misma
 * agrupación y aquí cuentan como dos, así que como mucho sobrestima. Sobrestimar
 * dice «tiene torres» y el modelo pregunta, que es lo que ya hace hoy.
 *
 * La dirección contraria —fundir dos torres de verdad en una y callar la
 * pregunta— no puede pasar: dos agrupaciones distintas difieren siempre en sus
 * letras o sus números.
 */
export function claveDeAgrupacion(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Deduce el contexto a partir de las agrupaciones de las unidades.
 *
 * Pura: se prueba entera sin Firestore, igual que `authorize.ts` y `quota.ts`.
 *
 * Sin unidades cargadas no se afirma nada. Un conjunto recién dado de alta no
 * es un edificio único: es un conjunto del que todavía no sabemos nada.
 */
export function deducirContexto(torres: readonly (string | null | undefined)[]): ContextoConjunto {
  if (torres.length === 0) return {};

  const claves = new Set<string>();
  for (const torre of torres) {
    const clave = claveDeAgrupacion((torre ?? "").trim());
    if (clave) claves.add(clave);
  }

  // Ninguna unidad declara agrupación. No es «edificio único»: es un campo sin
  // rellenar, y de un campo vacío no se concluye nada.
  if (claves.size === 0) return {};

  return { tieneAgrupaciones: claves.size > 1 };
}

/**
 * Lee las agrupaciones del conjunto y deduce el contexto.
 *
 * **Sale de `units.tower`, no de `tenantSettings.agrupaciones`**, y la
 * diferencia importa: la lista canónica de ajustes es lo que se *ofrece* al
 * crear una unidad, y su propia tarjeta advierte de que borrar una entrada NO
 * modifica las unidades existentes. Un conjunto de tres torres al que le
 * vaciaron la lista seguiría teniendo tres torres — y con la lista como fuente
 * diríamos «edificio único» y callaríamos una pregunta legítima. Las unidades
 * son el dato; la lista es una preferencia de formulario.
 *
 * Se lee la colección entera con `select("tower")`, sin límite. Un tope
 * convertiría el conteo en una muestra, y una muestra puede no ver la segunda
 * torre. El costo es despreciable al lado de lo que acompaña: cien lecturas de
 * Firestore valen tres millonésimas de dólar contra los 0,0025 de la llamada al
 * modelo. Si algún día un conjunto tiene miles de unidades, esto pasa a ser un
 * campo mantenido en el tenant; hoy no lo es.
 *
 * **Nunca lanza.** Si Firestore falla, se devuelve «no se sabe» y el borrador
 * sale igual, preguntando como hoy. Perder un matiz del prompt es molesto;
 * perder el trabajo de la persona por no poder leerlo es absurdo — misma regla
 * que la telemetría del Paso 1.5.
 */
export async function resolverContextoConjunto(db: Firestore, tenantId: string): Promise<ContextoConjunto> {
  try {
    const snap = await db.collection("units").where("tenantId", "==", tenantId).select("tower").get();
    return deducirContexto(snap.docs.map((d) => (d.get("tower") as string | undefined) ?? null));
  } catch (error) {
    logger.warn("ai-contexto: no se pudo resolver el contexto del conjunto", {
      tenantId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
