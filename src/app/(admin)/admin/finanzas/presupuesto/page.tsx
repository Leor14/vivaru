"use client";

import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { useChartOfAccounts } from "@/features/finanzas/use-chart-of-accounts";
import { guardarBorrador, watchPresupuesto } from "@/features/finanzas/use-presupuesto";
import { useCommitteeReport } from "@/features/reports/use-committee-report";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import {
  anioSinMovimientos,
  compararPresupuesto,
  cuentasPresupuestables,
  lineasDesdeFormulario,
  porcentajeDelAnio,
  valoresDesdeLineas,
  type FilaDeComparacion,
  type Veredicto,
} from "@/lib/finanzas/presupuesto";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { Budget } from "@/types/domain";

/**
 * `PRD-V-FEAT-009` entrega 1 — el presupuesto contra lo ejecutado.
 *
 * **Lo ejecutado NO se calcula aquí** (`RN-01`): sale de `useCommitteeReport`
 * con el rango del año, el mismo cálculo que `/admin/reports`. Así incluye las
 * cuotas —que no están en los asientos que suma el núcleo— y el día de la
 * asamblea las dos pantallas dicen la misma cifra. Lo vigila un guardián.
 */

const SITUACION: Record<FilaDeComparacion["situacion"], string | null> = {
  presupuestada: null,
  sin_presupuestar: "Sin presupuestar",
  presupuestada_en_cero: "Presupuestado en cero",
  importe_invalido: "Importe inválido",
};

// `RN-06`: la desviación se lee con palabras, no solo con color.
const DESVIACION: Record<NonNullable<FilaDeComparacion["desviacion"]>, string> = {
  sobre_ejecucion: "Sobre-ejecución",
  faltante: "Faltante",
};

const VEREDICTO: Record<Veredicto, string> = {
  superavit: "superávit",
  deficit: "déficit",
  equilibrio: "equilibrio",
};

export default function PresupuestoPage() {
  const { user } = useAuth();
  const activa = useFeatureFlag("producto-presupuesto-anual");
  const { formatAmount } = useTenantCurrency();

  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  // El año va DENTRO del estado leído: al cambiar de año, lo del anterior deja de
  // valer sin tener que borrarlo a mano. Es la lección del campo de lectura de
  // medidores, que conservaba el valor del mes anterior.
  const [leido, setLeido] = useState<{ anio: number; presupuesto: Budget | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editandoAnio, setEditandoAnio] = useState<number | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erroresForm, setErroresForm] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const rango = useMemo(() => ({ start: `${anio}-01-01`, end: `${anio}-12-31` }), [anio]);
  const informe = useCommitteeReport(user?.tenantId, rango);
  const { accounts, loading: cargandoPlan } = useChartOfAccounts(user?.tenantId);

  useEffect(() => {
    if (!user?.tenantId) return;
    return watchPresupuesto(user.tenantId, anio, (p) => setLeido({ anio, presupuesto: p }), setError);
  }, [user?.tenantId, anio]);

  const cargado = leido?.anio === anio;
  const presupuesto = cargado ? leido.presupuesto : null;
  const editando = editandoAnio === anio;
  const cargandoEjecutado = informe.loading || informe.sectionLoading.financial;

  const cuentasDelFormulario = useMemo(
    () => cuentasPresupuestables(accounts, presupuesto?.lines),
    [accounts, presupuesto],
  );
  const comparacion = useMemo(
    () => compararPresupuesto({ cuentas: accounts, lineas: presupuesto?.lines ?? [], ejecutado: informe.financial }),
    [accounts, presupuesto, informe.financial],
  );
  const sinMovimientos = !cargandoEjecutado && anioSinMovimientos(informe.financial);
  const transcurrido = anio === anioActual ? porcentajeDelAnio(new Date(), anio) : null;
  const nombreDe = useMemo(() => new Map(accounts.map((c) => [c.code, c.name])), [accounts]);

  function empezarAEditar() {
    setValores(valoresDesdeLineas(presupuesto?.lines));
    setErroresForm([]);
    setEditandoAnio(anio);
  }

  async function guardar() {
    if (!user?.tenantId || !user.uid) return;
    const { lineas, errores } = lineasDesdeFormulario(valores);
    setErroresForm(errores);
    if (errores.length) return;
    setGuardando(true);
    try {
      await guardarBorrador({ tenantId: user.tenantId, year: anio, lines: lineas, uid: user.uid, previo: presupuesto });
      toast.success(`Presupuesto ${anio} guardado como borrador`);
      setEditandoAnio(null);
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setGuardando(false);
    }
  }

  if (!activa) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <CardTitle>Esta función no está activa en tu conjunto</CardTitle>
          <CardDescription className="mt-2">
            El presupuesto anual te deja comparar lo que aprobó la asamblea con lo que se
            ejecutó, cuenta por cuenta. Escríbenos si quieres activarla.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* El encabezado de nivel 1 lo pone el shell, con el nombre del menú. */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Presupuesto {anio}</CardTitle>
            <CardDescription className="mt-1">
              Lo presupuestado contra lo ejecutado, por cuenta. Lo ejecutado es el mismo que
              ves en Reportes para el año entero.
            </CardDescription>
            {presupuesto ? (
              <p className="mt-2 text-sm text-[var(--slate-600)]">Estado: Borrador</p>
            ) : null}
          </div>
          <div role="group" aria-label="Año" className="flex gap-2">
            {[anioActual, anioActual - 1].map((a) => (
              <Button
                key={a}
                variant={a === anio ? "default" : "outline"}
                aria-pressed={a === anio}
                onClick={() => setAnio(a)}
              >
                {a === anioActual ? `${a} · en curso` : `${a} · cerrado`}
              </Button>
            ))}
          </div>
        </div>
        {transcurrido !== null ? (
          <p className="mt-3 text-sm text-[var(--slate-600)]">
            Va transcurrido el {transcurrido} % del año. Es una referencia, no un veredicto:
            hay gastos que no caen parejos mes a mes.
          </p>
        ) : null}
      </Card>

      {error ? (
        <Card className="border-[var(--danger-300)] p-4 text-sm text-[var(--danger-700)]">{error}</Card>
      ) : null}

      {cargandoPlan || !cargado ? (
        <Card className="p-6 text-sm text-[var(--slate-600)]">Cargando…</Card>
      ) : cuentasDelFormulario.length === 0 ? (
        <Card className="p-6">
          <CardTitle>Falta el plan de cuentas</CardTitle>
          <CardDescription className="mt-2">
            El presupuesto se hace por cuenta del plan, y este conjunto aún no tiene cuentas
            con las que hacerlo.
          </CardDescription>
        </Card>
      ) : editando ? (
        <Card className="p-6">
          <CardTitle>{presupuesto ? "Editar" : "Cargar"} el presupuesto {anio}</CardTitle>
          <CardDescription className="mt-1">
            Una cifra por cuenta, para el año entero. Deja vacía la cuenta que no se
            presupuestó: vacío no es cero.
          </CardDescription>
          <div className="mt-4 space-y-6">
            {(["ingreso", "egreso"] as const).map((tipo) => (
              <fieldset key={tipo} className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-[var(--slate-900)]">
                  {tipo === "ingreso" ? "Ingresos" : "Egresos"}
                </legend>
                {cuentasDelFormulario
                  .filter((c) => c.type === tipo)
                  .map((c) => (
                    <label
                      key={`${anio}-${c.code}`}
                      className="grid grid-cols-[1fr_minmax(8rem,12rem)] items-center gap-3 text-sm"
                    >
                      <span className="text-[var(--slate-900)]">
                        <span className="text-[var(--slate-600)]">{c.code}</span> · {c.name}
                        {c.status === "inactive" ? (
                          <span className="text-[var(--slate-600)]"> (desactivada)</span>
                        ) : null}
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={valores[c.code] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [c.code]: e.target.value }))}
                        aria-label={`Presupuesto de ${c.name}`}
                        aria-invalid={erroresForm.includes(c.code)}
                      />
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
          {erroresForm.length ? (
            <p role="alert" className="mt-4 text-sm text-[var(--danger-700)]">
              Revisa estos importes, tienen que ser números iguales o mayores que cero:{" "}
              {erroresForm.map((code) => nombreDe.get(code) ?? code).join(", ")}.
            </p>
          ) : null}
          <div className="mt-6 flex gap-2">
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button variant="ghost" onClick={() => setEditandoAnio(null)} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--slate-600)]">
              {presupuesto
                ? `${presupuesto.lines.length} cuentas presupuestadas.`
                : `Aún no hay presupuesto para ${anio}. Lo ejecutado ya se ve por cuenta; cárgalo para compararlo.`}
            </p>
            <Button variant="outline" onClick={empezarAEditar}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              {presupuesto ? "Editar presupuesto" : "Cargar presupuesto"}
            </Button>
          </div>

          {cargandoEjecutado ? (
            <Card className="p-6 text-sm text-[var(--slate-600)]">Calculando lo ejecutado…</Card>
          ) : sinMovimientos ? (
            <Card className="p-6">
              <CardTitle>No hay movimientos registrados en {anio}</CardTitle>
              <CardDescription className="mt-2">
                Sin movimientos no hay nada que comparar: una tabla de ceros se leería como que
                no se gastó nada, y no es lo que pasó — es que el año no se llevó en Vivaru.
              </CardDescription>
            </Card>
          ) : (
            <>
              <TablaDeComparacion titulo="Ingresos" filas={comparacion.ingresos} formatAmount={formatAmount} />
              <TablaDeComparacion titulo="Egresos" filas={comparacion.egresos} formatAmount={formatAmount} />

              <Card className="p-6">
                <CardTitle>Resultado del año</CardTitle>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--slate-600)]">Ingresos</dt>
                    <dd className="text-[var(--slate-900)]">
                      {formatAmount(comparacion.totales.ingresos.ejecutado)} ejecutados
                      {comparacion.hayPresupuesto
                        ? ` de ${formatAmount(comparacion.totales.ingresos.presupuestado)} presupuestados`
                        : " · sin presupuesto cargado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--slate-600)]">Egresos</dt>
                    <dd className="text-[var(--slate-900)]">
                      {formatAmount(comparacion.totales.egresos.ejecutado)} ejecutados
                      {comparacion.hayPresupuesto
                        ? ` de ${formatAmount(comparacion.totales.egresos.presupuestado)} presupuestados`
                        : " · sin presupuesto cargado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--slate-600)]">Resultado presupuestado</dt>
                    <dd className="text-[var(--slate-900)]">
                      {!comparacion.hayPresupuesto
                        ? "Sin presupuesto cargado"
                        : `${VEREDICTO[comparacion.totales.resultado.veredictoPresupuestado]}${
                            comparacion.totales.resultado.presupuestado
                              ? ` de ${formatAmount(Math.abs(comparacion.totales.resultado.presupuestado))}`
                              : ""
                          }`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--slate-600)]">Resultado ejecutado</dt>
                    <dd
                      className={
                        comparacion.totales.resultado.veredictoEjecutado === "deficit"
                          ? "font-semibold text-[var(--danger-700)]"
                          : "text-[var(--slate-900)]"
                      }
                    >
                      {VEREDICTO[comparacion.totales.resultado.veredictoEjecutado]}
                      {comparacion.totales.resultado.ejecutado
                        ? ` de ${formatAmount(Math.abs(comparacion.totales.resultado.ejecutado))}`
                        : ""}
                    </dd>
                  </div>
                </dl>
                {anio === anioActual && informe.financial.supplierDebt > 0 ? (
                  // `RN-09`: lo ejecutado es lo que dice el libro. Sin esta nota, una
                  // factura sin pagar se leería como ahorro.
                  <p className="mt-4 text-sm text-[var(--warning-700)]">
                    Hoy hay además {formatAmount(informe.financial.supplierDebt)} comprometidos con
                    proveedores y aún no pagados. No cuentan como ejecutados hasta que se paguen.
                  </p>
                ) : null}
                {comparacion.lineasInvalidas.length ? (
                  <p role="alert" className="mt-4 text-sm text-[var(--danger-700)]">
                    Hay líneas del presupuesto que no se pudieron leer y no entran en ningún total:{" "}
                    {comparacion.lineasInvalidas.join(", ")}. Edita el presupuesto para corregirlas.
                  </p>
                ) : null}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TablaDeComparacion({
  titulo,
  filas,
  formatAmount,
}: {
  titulo: string;
  filas: FilaDeComparacion[];
  formatAmount: (n: number) => string;
}) {
  return (
    <Card className="p-6">
      <CardTitle>{titulo}</CardTitle>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--slate-600)]">Sin movimientos ni presupuesto.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--slate-200)] text-left text-[var(--slate-600)]">
                <th className="py-2 pr-4 font-medium">Cuenta</th>
                <th className="py-2 pr-4 text-right font-medium">Presupuestado</th>
                <th className="py-2 pr-4 text-right font-medium">Ejecutado</th>
                <th className="py-2 pr-4 text-right font-medium">Diferencia</th>
                <th className="py-2 pr-4 text-right font-medium">%</th>
                <th className="py-2 font-medium">Observación</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const observacion = [SITUACION[f.situacion], f.desviacion ? DESVIACION[f.desviacion] : null]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={`${f.tipo}-${f.code}`} className="border-b border-[var(--slate-100)]">
                    <td className="py-2 pr-4 text-[var(--slate-900)]">
                      {f.label}
                      {f.label !== f.code ? <span className="ml-2 text-[var(--slate-600)]">{f.code}</span> : null}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {f.presupuestado === null ? "—" : formatAmount(f.presupuestado)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatAmount(f.ejecutado)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {f.diferencia === null ? "—" : formatAmount(f.diferencia)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {f.porcentaje === null ? "—" : `${f.porcentaje} %`}
                    </td>
                    <td
                      className={
                        f.desviacion || f.situacion === "importe_invalido"
                          ? "py-2 font-medium text-[var(--warning-700)]"
                          : "py-2 text-[var(--slate-600)]"
                      }
                    >
                      {observacion || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
