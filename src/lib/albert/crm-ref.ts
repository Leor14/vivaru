/**
 * Referencias cruzadas con Albert CRM — la dirección Albert → Vivaru.
 *
 * `crmRef` es el puente en dos sitios distintos y con DOS FORMATOS distintos:
 *
 * - En el comercial (`salesReps.crmRef`): su identidad en Albert → `albert:user:{uid}`
 * - En el lead (`leads.crmRef`): el DEAL que le corresponde → `albert:deal:{tenantId}:{dealId}`
 *
 * Ojo con el segundo: apunta al **deal**, no a un «lead en Albert». La conversión
 * vive en el pipeline de deals (`PRD-A-OPS-001`), y el deal cuelga de su tenant,
 * así que sin el `tenantId` un `dealId` suelto no resuelve.
 *
 * ## Por qué el envoltorio `albert:user:{uid}` y no el uid pelado
 *
 * Albert (`RESPUESTA-A-001` §A5d) dejó el envoltorio como opción nuestra: «el valor
 * que resuelve es el uid crudo». Lo adoptamos igual, y el motivo NO es simetría
 * estética (`DECISIONES-A-003` §3, aceptado en `RESPUESTA-A-004` §3):
 *
 * Un uid pelado no se puede distinguir de otra referencia del mismo tamaño. Sin
 * prefijo, pegar por error una referencia de deal en la ficha de un comercial —o al
 * revés— es un campo de texto que se traga cualquier cosa y falla meses después, en
 * silencio, cuando alguien intente resolverla. Con prefijo, esa confusión falla en
 * el momento de guardar, que es cuando hay alguien delante para arreglarla.
 *
 * ## Dónde somos estrictos y dónde no, a propósito
 *
 * - El **uid**: exactamente 28 caracteres alfanuméricos. Albert dio ese número dos
 *   veces (A-001 §A5d, A-004 §3) y es el que genera Firebase Auth. Ser estricto aquí
 *   caza el fallo real de este flujo: pegar un uid cortado desde un correo.
 * - El **dealId**: solo estructura y juego de caracteres, sin longitud fija. Albert
 *   nunca dijo cuánto mide, y no inventamos una restricción que nadie declaró.
 *
 * La asimetría es deliberada, y el criterio es el coste de equivocarse: un rechazo
 * falso es ruidoso e inmediato —alguien ve el error y lo corrige—; una aceptación
 * falsa es silenciosa y se descubre tarde.
 */

/** Lo que Albert genera desde Firebase Auth. Ver A-001 §A5d y A-004 §3. */
const UID_LENGTH = 28;
const UID_PATTERN = /^[A-Za-z0-9]{28}$/;

/** Ids de documento y slugs de tenant. Sin `:`, que es el separador del formato. */
const SEGMENTO_PATTERN = /^[A-Za-z0-9_-]+$/;

export type ParsedCrmRef =
  | { kind: "user"; uid: string }
  | { kind: "deal"; tenantId: string; dealId: string };

/**
 * `value` es lo que se guarda en Firestore: la cadena ya normalizada, o `null`
 * cuando el campo se deja vacío (que es válido — vincular a Albert es opcional).
 */
export type CrmRefResult =
  | { ok: true; value: string | null; parsed: ParsedCrmRef | null }
  | { ok: false; error: string };

const VACIO: CrmRefResult = { ok: true, value: null, parsed: null };

function esUidPlausible(valor: string) {
  return UID_PATTERN.test(valor);
}

/** Parte por `:` sin descartar segmentos vacíos: `albert:user:` debe fallar, no colar. */
function segmentos(valor: string) {
  return valor.split(":");
}

/**
 * Lee cualquiera de los dos formatos. No decide si el formato leído es el que
 * tocaba en ese campo — de eso se encargan las dos funciones de abajo.
 */
export function parseCrmRef(raw: string): CrmRefResult {
  const valor = raw.trim();
  if (!valor) return VACIO;

  const partes = segmentos(valor);
  if (partes[0] !== "albert") {
    return {
      ok: false,
      error: 'Una referencia de Albert empieza por "albert:". Revisa lo que pegaste.',
    };
  }

  if (partes[1] === "user") {
    if (partes.length !== 3) {
      return { ok: false, error: "El formato es albert:user:{uid}, sin partes de más ni de menos." };
    }
    const uid = partes[2];
    if (!esUidPlausible(uid)) {
      return {
        ok: false,
        error: `El uid debe tener ${UID_LENGTH} caracteres alfanuméricos; éste tiene ${uid.length}. Suele pasar al copiarlo cortado.`,
      };
    }
    return { ok: true, value: `albert:user:${uid}`, parsed: { kind: "user", uid } };
  }

  if (partes[1] === "deal") {
    if (partes.length !== 4) {
      return {
        ok: false,
        error: "El formato es albert:deal:{tenantId}:{dealId}. Sin el tenant, el deal no resuelve.",
      };
    }
    const [, , tenantId, dealId] = partes;
    if (!SEGMENTO_PATTERN.test(tenantId)) {
      return { ok: false, error: "El tenant de la referencia está vacío o tiene caracteres raros." };
    }
    if (!SEGMENTO_PATTERN.test(dealId)) {
      return { ok: false, error: "El id del deal está vacío o tiene caracteres raros." };
    }
    return {
      ok: true,
      value: `albert:deal:${tenantId}:${dealId}`,
      parsed: { kind: "deal", tenantId, dealId },
    };
  }

  return {
    ok: false,
    error: 'Solo reconocemos "albert:user:…" y "albert:deal:…".',
  };
}

/**
 * Ficha del comercial. Acepta el uid PELADO además del envuelto, y lo envuelve.
 *
 * Es deliberado: por el canal, Albert nos manda el uid tal cual (A-004 §5), así que
 * quien lo pegue va a pegar 28 caracteres sueltos. Obligarle a teclear el prefijo
 * delante es pedirle que haga a mano lo que el programa hace mejor.
 */
export function normalizeSalesRepCrmRef(raw: string): CrmRefResult {
  const valor = raw.trim();
  if (!valor) return VACIO;

  // El uid pelado tal como llega del correo.
  if (!valor.includes(":")) {
    if (!esUidPlausible(valor)) {
      return {
        ok: false,
        error: `Pega el uid de Albert (${UID_LENGTH} caracteres alfanuméricos) o la referencia completa albert:user:{uid}.`,
      };
    }
    return { ok: true, value: `albert:user:${valor}`, parsed: { kind: "user", uid: valor } };
  }

  const resultado = parseCrmRef(valor);
  if (!resultado.ok) return resultado;
  if (resultado.parsed?.kind === "deal") {
    return {
      ok: false,
      error: "Eso es la referencia de un deal, no la identidad de un comercial. Aquí va albert:user:{uid}.",
    };
  }
  return resultado;
}

/**
 * Lead. Exige el formato de deal completo: aquí no hay forma pelada que valga,
 * porque un `dealId` suelto no resuelve sin su tenant.
 */
export function normalizeLeadCrmRef(raw: string): CrmRefResult {
  const valor = raw.trim();
  if (!valor) return VACIO;

  const resultado = parseCrmRef(valor);
  if (!resultado.ok) return resultado;
  if (resultado.parsed?.kind === "user") {
    return {
      ok: false,
      error: "Eso es la identidad de un comercial, no un deal. Aquí va albert:deal:{tenantId}:{dealId}.",
    };
  }
  return resultado;
}
