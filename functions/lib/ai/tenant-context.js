"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.claveDeAgrupacion = claveDeAgrupacion;
exports.deducirContexto = deducirContexto;
exports.resolverContextoConjunto = resolverContextoConjunto;
const logger = __importStar(require("firebase-functions/logger"));
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
function claveDeAgrupacion(valor) {
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
function deducirContexto(torres) {
    if (torres.length === 0)
        return {};
    const claves = new Set();
    for (const torre of torres) {
        const clave = claveDeAgrupacion((torre ?? "").trim());
        if (clave)
            claves.add(clave);
    }
    // Ninguna unidad declara agrupación. No es «edificio único»: es un campo sin
    // rellenar, y de un campo vacío no se concluye nada.
    if (claves.size === 0)
        return {};
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
async function resolverContextoConjunto(db, tenantId) {
    try {
        const snap = await db.collection("units").where("tenantId", "==", tenantId).select("tower").get();
        return deducirContexto(snap.docs.map((d) => d.get("tower") ?? null));
    }
    catch (error) {
        logger.warn("ai-contexto: no se pudo resolver el contexto del conjunto", {
            tenantId,
            detail: error instanceof Error ? error.message : String(error),
        });
        return {};
    }
}
