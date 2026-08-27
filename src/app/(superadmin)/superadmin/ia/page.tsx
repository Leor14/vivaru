"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getAiUsageCallable, type AiUsageBucket, type AiUsageSummaryResponse } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * Consumo de IA (Paso 1.5 de `docs/hoja-de-ruta-ia.md`).
 *
 * Existe para contestar la pregunta exacta del criterio del paso: «cuánto gastó
 * este conjunto este mes», mirando datos y no estimando. Sin línea base no hay
 * proyecto, hay opinión — y esto es la línea base del gasto.
 */

/** Seis decimales: una llamada cuesta millonésimas y a dos decimales todo es 0. */
function usd(valor: number): string {
  if (valor === 0) return "USD 0";
  if (valor < 0.01) return `USD ${valor.toFixed(6)}`;
  return `USD ${valor.toFixed(2)}`;
}

function numero(valor: number): string {
  return valor.toLocaleString("es-CO");
}

/** Motivos de fallo en cristiano. La clave cruda no le dice nada a nadie. */
const MOTIVO_LEGIBLE: Record<string, string> = {
  proveedor_no_responde: "El proveedor tardó demasiado",
  proveedor_error: "El proveedor falló",
  salida_ilegible: "La respuesta no era JSON",
  salida_incumple_contrato: "La respuesta incumplió el contrato",
};

export default function SuperadminIaPage() {
  const [resumen, setResumen] = useState<AiUsageSummaryResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setResumen(await getAiUsageCallable());
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const periodo = useMemo(() => {
    if (!resumen) return "";
    const desde = new Date(resumen.from).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
    const hasta = new Date(resumen.to).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
    return `${desde} — ${hasta}`;
  }, [resumen]);

  const tasaFallo = resumen && resumen.total.llamadas > 0
    ? Math.round((resumen.total.fallos / resumen.total.llamadas) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* El nombre lo pone la cabecera del shell. */}
        <div>
          <p className="max-w-3xl text-sm text-[var(--slate-600)]">
            Mes en curso{periodo ? ` · ${periodo}` : ""}. Se registra cada llamada, incluidas las que
            fallan: una llamada fallida ya consumió tokens, y la tasa de fallo es la métrica que dice
            si la capacidad sirve.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={cargando} onClick={() => void cargar()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {resumen?.truncado ? (
        <Card className="border-amber-300">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Resumen truncado
            </span>
          </CardTitle>
          <CardDescription>
            El período tiene más filas de las que se leen de una vez, así que estos totales se quedan
            cortos. Acota el rango de fechas para verlo completo.
          </CardDescription>
        </Card>
      ) : null}

      {!cargando && resumen && resumen.total.llamadas === 0 ? (
        <EmptyState
          title="Todavía no hay llamadas registradas"
          description="Es lo esperado: la plataforma está construida y ninguna capacidad tiene consumidor todavía. En cuanto la primera operación se use, aparecerá aquí."
        />
      ) : null}

      {resumen && resumen.total.llamadas > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica etiqueta="Costo del período" valor={usd(resumen.total.costoUsd)} />
            <Metrica etiqueta="Llamadas" valor={numero(resumen.total.llamadas)} />
            <Metrica
              etiqueta="Fallos"
              valor={`${numero(resumen.total.fallos)} (${tasaFallo}%)`}
              alerta={tasaFallo >= 10}
            />
            <Metrica etiqueta="Latencia media" valor={`${numero(resumen.total.latenciaMediaMs)} ms`} />
          </div>

          <Card>
            <CardTitle>Por conjunto</CardTitle>
            <CardDescription>
              Ordenado por gasto. La meta de la estrategia es 2–3% del ingreso del conjunto, con
              alerta al 5%.
            </CardDescription>
            <Tabla
              primeraColumna="Conjunto"
              filas={resumen.porConjunto.map((fila) => ({ clave: fila.tenantId, etiqueta: fila.tenantId, ...fila }))}
            />
          </Card>

          <Card>
            <CardTitle>Por operación</CardTitle>
            <CardDescription>
              Dónde se va el gasto. Un modelo carísimo usado diez veces al mes es barato; uno
              baratísimo en un bucle es una factura sorpresa.
            </CardDescription>
            <Tabla
              primeraColumna="Operación"
              filas={resumen.porOperacion.map((fila) => ({
                clave: fila.operationKey,
                etiqueta: fila.operationKey,
                ...fila,
              }))}
            />
          </Card>

          {resumen.fallosPorMotivo.length > 0 ? (
            <Card>
              <CardTitle>Por qué falló</CardTitle>
              <CardDescription>
                Se mide por categoría y no en promedio: un 90% de acierto global puede esconder un
                40% en la categoría que importa.
              </CardDescription>
              <ul className="mt-2 space-y-1.5">
                {resumen.fallosPorMotivo.map((fallo) => (
                  <li key={fallo.outcome} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--slate-800)]">
                      {MOTIVO_LEGIBLE[fallo.outcome] ?? fallo.outcome}
                    </span>
                    <Badge className="bg-[var(--danger-100)] text-[var(--danger-700)]">
                      {numero(fallo.veces)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <p className="text-xs text-[var(--slate-500)]">
            Costos calculados al registrar cada llamada con la tabla de precios{" "}
            <code>{resumen.priceTableVersion}</code>. Se guardan ya calculados a propósito: recalcular
            el pasado con los precios de hoy falsificaría la historia.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Metrica({ etiqueta, valor, alerta }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">{etiqueta}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          alerta ? "text-[var(--danger-600)]" : "text-[var(--slate-900)]"
        }`}
      >
        {valor}
      </p>
    </Card>
  );
}

function Tabla({
  primeraColumna,
  filas,
}: {
  primeraColumna: string;
  filas: Array<{ clave: string; etiqueta: string } & AiUsageBucket>;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="border-b border-[var(--slate-200)] text-left text-xs uppercase tracking-wide text-[var(--slate-500)]">
            <th className="pb-2 pr-3 font-medium">{primeraColumna}</th>
            <th className="pb-2 pr-3 text-right font-medium">Llamadas</th>
            <th className="pb-2 pr-3 text-right font-medium">Fallos</th>
            <th className="pb-2 pr-3 text-right font-medium">Tokens</th>
            <th className="pb-2 text-right font-medium">Costo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.clave} className="border-b border-[var(--slate-100)] last:border-0">
              <td className="py-2 pr-3 text-[var(--slate-800)]">{fila.etiqueta}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{numero(fila.llamadas)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {fila.fallos > 0 ? (
                  <span className="text-[var(--danger-600)]">{numero(fila.fallos)}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {numero(fila.inputTokens + fila.outputTokens)}
              </td>
              <td className="py-2 text-right tabular-nums">{usd(fila.costoUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
