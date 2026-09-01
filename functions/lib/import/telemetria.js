"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistroInvalido = exports.COLECCION = void 0;
exports.normalizarRegistro = normalizarRegistro;
exports.registrarImportacionEn = registrarImportacionEn;
const firestore_1 = require("firebase-admin/firestore");
/**
 * Telemetría de la importación tabular — `PRD-V-FEAT-002`, `CA-13`.
 *
 * **POR QUÉ EXISTE.** La PRD no puede cerrar su puerta `G1` sin baseline:
 * cuántas importaciones se intentan y cuántas terminan, por pista. Hoy no se
 * sabe, así que tampoco se podría decir si el paso de mapeo mejoró algo. Y la
 * lección de la sesión del 14 de agosto fue exactamente esa: **la hoja de papel
 * se queda vacía; la instrumentación no.**
 *
 * **POR QUÉ LO ESCRIBE EL SERVIDOR Y NO EL NAVEGADOR.** Es la misma regla que
 * ya está escrita en `firestore.rules` para `aiFeedback`: si el cliente pudiera
 * escribir aquí, cualquiera podría fabricar la evidencia con la que se decide
 * si la funcionalidad sigue. Cuesta una callable; la alternativa cuesta la
 * credibilidad del número.
 *
 * **QUÉ NO SE GUARDA, Y ES DELIBERADO: ni una celda del archivo.** Se registran
 * los NOMBRES de las columnas y cuántas filas hubo, nunca su contenido. Un
 * padrón lleva nombres, correos y documentos de personas reales; medir no puede
 * convertirse en una segunda copia de esos datos. Es la misma decisión que tomó
 * `aiUsage`, cuya fila no contiene nada de lo que escribió el administrador.
 *
 * **Y hay un segundo uso, que es el que la hace valiosa dentro de un año:**
 * `encabezadosSinUsar` es la lista de columnas que el catálogo no supo
 * reconocer. Esa lista **es** el trabajo pendiente del mapeo asistido de
 * `PRD-VAI-FEAT-001`: con datos reales de qué trae la gente, en vez de suponerlo.
 *
 * **Desde el 1 de septiembre de 2026 ese segundo uso es explícito, y es la
 * respuesta a «¿cómo se acumula corpus sin guardar archivos?».** Guardar copia
 * de los ficheros del cliente contradice §7 de la PRD —la razón de que el
 * importador viva entero en el navegador—, así que David decidió guardar la
 * FORMA: cuánto preámbulo traía el archivo (`filasDePreambulo`), si la unidad
 * venía partida en dos columnas (`unidadPartida`) y qué palabras usa donde
 * nosotros tenemos vocabulario cerrado (`valoresNoReconocidos`). La regla de
 * arriba no se toca: **ni una celda**, y por eso los valores solo se envían
 * cuando la columna se comporta como vocabulario y no como texto libre — la
 * puerta está en `formaDelArchivo`, y aquí se acota otra vez.
 */
exports.COLECCION = "importRuns";
/** Tope defensivo: una lista de encabezados no debería crecer sin fin. */
const MAX_ENCABEZADOS = 40;
const MAX_LARGO_ENCABEZADO = 80;
/** Un vocabulario que no lo es se delata por tamaño. Ver `formaDelArchivo`. */
const MAX_VALORES_NO_RECONOCIDOS = 20;
const MAX_LARGO_DE_VALOR = 40;
class RegistroInvalido extends Error {
}
exports.RegistroInvalido = RegistroInvalido;
function texto(valor, campo) {
    if (typeof valor !== "string" || !valor.trim()) {
        throw new RegistroInvalido(`Falta ${campo}.`);
    }
    return valor.trim();
}
function entero(valor, campo) {
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
        throw new RegistroInvalido(`${campo} debe ser un número no negativo.`);
    }
    return Math.floor(valor);
}
/**
 * Valida y normaliza lo que llega del navegador.
 *
 * **Recorta en vez de rechazar** en lo accesorio —una lista de encabezados
 * larguísima o un nombre de columna kilométrico— porque perder la medición
 * entera por un archivo raro sería el peor resultado posible: nos quedaríamos
 * sin el dato justo en el caso interesante.
 */
function normalizarRegistro(data) {
    if (!data || typeof data !== "object")
        throw new RegistroInvalido("Cuerpo vacío.");
    const d = data;
    const fase = d.fase === "inicio" || d.fase === "fin" ? d.fase : null;
    if (!fase)
        throw new RegistroInvalido("Fase desconocida.");
    const entidad = d.entidad === "unit" || d.entidad === "person" ? d.entidad : null;
    if (!entidad)
        throw new RegistroInvalido("Entidad desconocida.");
    const formato = d.formato === "csv" || d.formato === "xlsx" ? d.formato : null;
    if (!formato)
        throw new RegistroInvalido("Formato desconocido.");
    const encabezados = Array.isArray(d.encabezadosSinUsar) ? d.encabezadosSinUsar : [];
    const registro = {
        runId: texto(d.runId, "runId"),
        fase,
        entidad,
        formato,
        hojas: entero(d.hojas, "hojas"),
        filas: entero(d.filas, "filas"),
        camposPorAlias: entero(d.camposPorAlias, "camposPorAlias"),
        camposAMano: entero(d.camposAMano, "camposAMano"),
        encabezadosSinUsar: encabezados
            .filter((h) => typeof h === "string")
            .slice(0, MAX_ENCABEZADOS)
            .map((h) => h.trim().slice(0, MAX_LARGO_ENCABEZADO))
            .filter(Boolean),
    };
    if (typeof d.filasDePreambulo === "number") {
        registro.filasDePreambulo = entero(d.filasDePreambulo, "filasDePreambulo");
    }
    if (typeof d.unidadPartida === "boolean")
        registro.unidadPartida = d.unidadPartida;
    if (Array.isArray(d.valoresNoReconocidos)) {
        // El cliente ya filtró por «esto parece un vocabulario». Esto es la segunda
        // puerta, y existe porque el cliente es quien puede mentir: sin tope, una
        // llamada fabricada convertiría la telemetría en el almacén de datos
        // personales que §7 evita.
        const valores = d.valoresNoReconocidos
            .filter((v) => typeof v === "string")
            .slice(0, MAX_VALORES_NO_RECONOCIDOS)
            .map((v) => v.trim().slice(0, MAX_LARGO_DE_VALOR))
            .filter(Boolean);
        if (valores.length > 0)
            registro.valoresNoReconocidos = [...new Set(valores)];
    }
    if (typeof d.pista === "string" && d.pista.trim())
        registro.pista = d.pista.trim();
    if (fase === "fin") {
        registro.importadas = entero(d.importadas, "importadas");
        registro.omitidas = entero(d.omitidas, "omitidas");
    }
    return registro;
}
/**
 * Escribe la fila. Una por fase, no un documento mutado: el par
 * inicio/fin **contado** es la métrica, y un documento que se actualiza no deja
 * ver cuántos empezaron y nunca acabaron — que es justo lo que se quiere medir.
 */
async function registrarImportacionEn(db, tenantId, uid, registro) {
    await db.collection(exports.COLECCION).add({
        ...registro,
        tenantId,
        uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
