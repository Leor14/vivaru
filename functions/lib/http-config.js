"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callableCorsOrigins = void 0;
/**
 * Orígenes permitidos para las callables.
 *
 * Vive aparte de `index.ts` para que lo puedan compartir los módulos nuevos sin
 * importar el índice entero (import circular). La lista es la misma de siempre.
 *
 * TRAMPA CONOCIDA: si falta el origen que sirve la app, en los logs solo se ven
 * `OPTIONS 204` y en el navegador `net::ERR_FAILED`. Ver CLAUDE.md.
 */
exports.callableCorsOrigins = [
    "https://www.grupovivaru.com",
    "https://grupovivaru.com",
    "https://vivaru--hogaru-1.us-central1.hosted.app",
    "https://hogaru-web--hogaru-1.us-central1.hosted.app", // legacy, mantener hasta confirmar 0 tráfico
    "https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app", // staging
    "http://localhost:3000",
];
