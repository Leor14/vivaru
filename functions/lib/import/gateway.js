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
exports.registrarImportacion = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const http_config_1 = require("../http-config");
const telemetria_1 = require("./telemetria");
/**
 * Callable que registra un intento de importación (`PRD-V-FEAT-002`, `CA-13`).
 *
 * **Es best-effort de punta a punta.** Si esto falla, la importación ya ocurrió
 * y enseñarle un error a la persona sería mentirle sobre lo que pasó con sus
 * datos. Se registra el fallo en los logs y se sigue — misma decisión que tomó
 * el registro de feedback del canario.
 *
 * **Ojo al desplegar:** una callable nueva nace **sin permiso de invocación** en
 * Cloud Run y el síntoma es un «error interno» sin ninguna pista. Hay que
 * comprobarlo después del despliegue; está escrito en `docs/pendientes.md` y ya
 * costó una tarde con `aiInvoke`.
 */
exports.registrarImportacion = (0, https_1.onCall)({ cors: http_config_1.callableCorsOrigins, memory: "256MiB" }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    // El conjunto sale de la sesión, nunca del cuerpo: si el navegador pudiera
    // decir a qué conjunto pertenece la medición, podría atribuirle intentos a
    // otro. Es la misma regla que la puerta de IA.
    const claims = request.auth?.token;
    const tenantId = typeof claims?.tenantId === "string" ? claims.tenantId : "";
    const role = claims?.role;
    if (!tenantId && role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "Tu sesión no pertenece a ningún conjunto.");
    }
    try {
        const registro = (0, telemetria_1.normalizarRegistro)(request.data);
        await (0, telemetria_1.registrarImportacionEn)((0, firestore_1.getFirestore)(), tenantId, uid, registro);
        return { ok: true };
    }
    catch (error) {
        if (error instanceof telemetria_1.RegistroInvalido) {
            throw new https_1.HttpsError("invalid-argument", error.message);
        }
        logger.error("registrarImportacion: no se pudo registrar", {
            uid,
            tenantId,
            error: error instanceof Error ? error.message : String(error),
        });
        // No se propaga: la importación ya pasó y el registro es secundario.
        return { ok: false };
    }
});
