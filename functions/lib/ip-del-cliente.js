"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipQueAnadioGoogle = ipQueAnadioGoogle;
/**
 * `PRD-V-FIX-005` · H5 / R7 — la IP de un límite es la que añade la infraestructura, no la que
 * manda el cliente.
 *
 * **Medido en staging el 12 sep de 2026**, con una llamada a `createTrialWorkspace` que traía un
 * `X-Forwarded-For` falso: la callable recibe «lo que mandó el cliente, la IP que vio Google» —el
 * valor falso delante y la IP real añadida AL FINAL—. Y `request.rawRequest.ip` devuelve **la
 * falsa**, porque Express se fía del primer valor: ningún límite puede apoyarse en él.
 *
 * Vale para las callables, que el navegador llama directo. Lo que va detrás de otro balanceador
 * —el front de App Hosting— se mide aparte.
 */
function ipQueAnadioGoogle(xff) {
    const cabecera = Array.isArray(xff) ? xff[xff.length - 1] : xff;
    if (typeof cabecera !== "string")
        return null;
    const entradas = cabecera
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e !== "");
    return entradas.length ? entradas[entradas.length - 1] : null;
}
