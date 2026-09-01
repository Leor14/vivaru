import { estadoDeAutorizacion } from "./autorizacion";

/**
 * **El historial de visitas de portería que ve el RESIDENTE.** `PRD-V-FLOW-005`, `CA10`: «el
 * residente ve en su portal las visitas de su unidad con esa misma constancia».
 *
 * Existe porque el criterio estuvo EN PRODUCCIÓN sin cumplirse y nada lo delataba (31 de agosto
 * de 2026): el único lector de `visitorPasses` del portal del residente filtraba `pendiente`, así
 * que una visita **desaparecía del portal en el instante de resolverse** — se vio en vivo al
 * autorizar una. Es el gemelo del `CA1` de `FLOW-004`: el ciclo validado con ojos y un criterio
 * entero sin construir.
 *
 * **El vocabulario de la constancia es EL MISMO que ve la portería** («desde la app», «por
 * llamada», «Nadie contestó en cinco minutos») — dos rótulos distintos para el mismo hecho es como
 * nacen los partes que no cuadran. El original está en `GuardVisitors.tsx`.
 *
 * Función pura y sin reloj propio, como `estado-operativo.ts` y por la misma lección: la lógica
 * que vive dentro de un componente no la alcanza ninguna prueba.
 */

export type PaseParaHistorial = {
  id: string;
  visitorName: string;
  documentNumber: string;
  date?: string;
  scheduledTime?: string;
  status?: string;
  origen?: string;
  authorizationStatus?: string;
  /** ISO; el componente convierte el `Timestamp` antes de llegar aquí. */
  authorizationRequestedAt?: string;
  authorizationResolvedAt?: string;
  createdAt?: string;
  authorizedByName?: string;
  authorizationMedium?: string;
};

export type ConstanciaTono = "ok" | "rechazo" | "neutro";

export type VisitaDelHistorial = {
  id: string;
  visitorName: string;
  documentNumber: string;
  fecha: string;
  hora: string;
  ciclo: "dentro" | "finalizado" | null;
  constancia: { texto: string; tono: ConstanciaTono };
};

/** El historial enseña las últimas; por encima de esto es una pantalla de archivo, no un vistazo. */
export const MAX_VISITAS_EN_HISTORIAL = 20;

function ordenDe(p: PaseParaHistorial): number {
  const marca = p.authorizationResolvedAt ?? p.authorizationRequestedAt ?? p.createdAt;
  const ms = marca ? Date.parse(marca) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Las visitas de portería de la unidad, resueltas, de la más reciente a la más vieja.
 *
 * - **Un pase del flujo de QR no entra**: no lleva `authorizationStatus`, y `estadoDeAutorizacion`
 *   devuelve `null` justo para eso — es la única autoridad de «esto es de portería» aquí.
 * - **Una `pendiente` viva tampoco**: esa es del panel «Alguien te visita ahora», que está encima
 *   y con botones. Enseñarla dos veces en la misma pantalla es pedir que se conteste dos veces.
 * - Una `pendiente` de hace más de cinco minutos **sí entra, como «Nadie contestó»**: la caducidad
 *   se DERIVA al leer, no la escribe ningún trabajo programado.
 */
export function visitasDePorteria(
  pases: readonly PaseParaHistorial[],
  ahoraMs: number,
): VisitaDelHistorial[] {
  const visibles: VisitaDelHistorial[] = [];

  for (const p of [...pases].sort((a, b) => ordenDe(b) - ordenDe(a))) {
    const estado = estadoDeAutorizacion(
      p.authorizationStatus,
      p.authorizationRequestedAt ? Date.parse(p.authorizationRequestedAt) : null,
      ahoraMs,
    );
    if (estado === null || estado === "pendiente") continue;

    const nombre = p.authorizedByName?.trim() || "—";
    const constancia =
      estado === "autorizada"
        ? {
            texto: `Autorizada por ${nombre}${p.authorizationMedium === "llamada" ? " (por llamada)" : " (desde la app)"}`,
            tono: "ok" as const,
          }
        : estado === "rechazada"
          ? { texto: `Rechazada por ${nombre}`, tono: "rechazo" as const }
          : { texto: "Nadie contestó en cinco minutos.", tono: "neutro" as const };

    visibles.push({
      id: p.id,
      visitorName: p.visitorName,
      documentNumber: p.documentNumber,
      fecha: p.date ?? "",
      hora: p.scheduledTime ?? "",
      ciclo: p.status === "inside" ? "dentro" : p.status === "completed" ? "finalizado" : null,
      constancia,
    });

    if (visibles.length === MAX_VISITAS_EN_HISTORIAL) break;
  }

  return visibles;
}
