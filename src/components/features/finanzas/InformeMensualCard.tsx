"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, PenLine, RefreshCw, Stamp, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import {
  watchMonthlyReports,
  type MonthlyReport,
} from "@/features/finanzas/use-monthly-reports";
import {
  issueMonthlyReportCallable,
  regenerateMonthlyReportCallable,
  signMonthlyReportCallable,
  voidMonthlyReportCallable,
} from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * `PRD-V-FLOW-007` entrega 2 — el informe mensual, desde la administración.
 *
 * **Todo lo que cambia estado va por callable.** Aquí no se escribe un solo campo
 * de `monthlyReports`: la regla lo tiene cerrado al cliente entero. Esta pantalla
 * lee y pide; el servidor recalcula, congela y sella.
 *
 * **Y no manda ni una cifra.** Los números que se ven aquí salen del documento
 * que escribió el servidor; al emitir se vuelven a calcular allí. Si esta pantalla
 * los enviara, el informe diría lo que dijera el navegador.
 */

/** `YYYY-MM` → «marzo de 2026». El período es lo que la gente reconoce del informe. */
function rotuloDelPeriodo(period: string): string {
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return period;
  const texto = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function fecha(sello: { seconds: number } | undefined): string {
  if (!sello?.seconds) return "";
  return new Date(sello.seconds * 1000).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function InformeMensualCard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? undefined;
  const { formatAmount } = useTenantCurrency();

  const [informes, setInformes] = useState<MonthlyReport[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    setCargando(true);
    return watchMonthlyReports(
      tenantId,
      (items) => {
        setInformes(items);
        setCargando(false);
      },
      (mensaje) => {
        setCargando(false);
        // **El error se enseña, no se traga.** Un `catch` que deja la lista vacía
        // convierte un fallo ruidoso en un dato falso: «no hay informes» se lee
        // como una afirmación sobre el conjunto y no como un problema de lectura.
        toast.error(mensaje);
      },
    );
  }, [tenantId]);

  /** El mes cerrado más reciente. Es el que el flujo espera que se emita. */
  const periodoDelMesPasado = useMemo(() => {
    const hoy = new Date();
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const hayInformeDelMesPasado = informes.some((i) => i.period === periodoDelMesPasado);

  async function conAviso(clave: string, accion: () => Promise<void>) {
    setOcupado(clave);
    try {
      await accion();
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setOcupado(null);
    }
  }

  if (!tenantId) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Informe económico mensual</CardTitle>
          <p className="mt-1 text-sm text-[var(--slate-600)]">
            El estado de caja del mes, anclado al saldo del banco. Se emite una vez, congela sus
            cifras y se firma dentro del producto.
          </p>
        </div>
        {!hayInformeDelMesPasado && (
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado !== null}
            onClick={() =>
              conAviso("generar", async () => {
                await regenerateMonthlyReportCallable({ tenantId: tenantId!, period: periodoDelMesPasado });
                toast.success(`Borrador de ${rotuloDelPeriodo(periodoDelMesPasado)} generado.`);
              })
            }
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Generar {rotuloDelPeriodo(periodoDelMesPasado)}
          </Button>
        )}
      </div>

      {cargando && <p className="mt-4 text-sm text-[var(--slate-500)]">Cargando informes…</p>}

      {!cargando && informes.length === 0 && (
        <p className="mt-4 text-sm text-[var(--slate-500)]">
          Todavía no hay informes. El día 1 de cada mes se genera el borrador del mes anterior, y
          también puedes generarlo aquí.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {informes.map((informe) => {
          const firmas = informe.signatures ?? [];
          const yaFirme = firmas.some((f) => f.uid === user?.uid);
          return (
            <div
              key={informe.id}
              className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--slate-500)]" />
                  <span className="font-medium text-[var(--slate-900)]">
                    {rotuloDelPeriodo(informe.period)}
                  </span>
                  <StatusBadge status={informe.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {informe.status === "borrador" && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={ocupado !== null}
                        onClick={() =>
                          conAviso(informe.id, async () => {
                            await regenerateMonthlyReportCallable({
                              tenantId: tenantId!,
                              period: informe.period,
                            });
                            toast.success("Borrador actualizado con los asientos de hoy.");
                          })
                        }
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Regenerar
                      </Button>
                      <Button
                        size="xs"
                        disabled={ocupado !== null}
                        onClick={() =>
                          conAviso(informe.id, async () => {
                            await issueMonthlyReportCallable({
                              tenantId: tenantId!,
                              period: informe.period,
                            });
                            toast.success("Informe emitido. Sus cifras quedan congeladas.");
                          })
                        }
                      >
                        <Stamp className="mr-1.5 h-3.5 w-3.5" />
                        Emitir
                      </Button>
                    </>
                  )}
                  {(informe.status === "emitido" || informe.status === "publicado") && (
                    <>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={ocupado !== null || yaFirme}
                        onClick={() =>
                          conAviso(informe.id, async () => {
                            await signMonthlyReportCallable({ tenantId: tenantId!, reportId: informe.id });
                            toast.success("Firma registrada.");
                          })
                        }
                      >
                        <PenLine className="mr-1.5 h-3.5 w-3.5" />
                        {yaFirme ? "Ya firmaste" : "Firmar"}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={ocupado !== null}
                        onClick={() => {
                          setAnulando(anulando === informe.id ? null : informe.id);
                          setMotivo("");
                        }}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Anular
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* `RN-14` · un informe anulado se conserva y **se ve anulado, con su motivo**. */}
              {informe.status === "anulado" && informe.voidReason && (
                <p className="mt-2 text-sm text-[var(--mapa-rojo-texto-1)]">
                  Anulado el {fecha(informe.voidedAt)}: {informe.voidReason}
                </p>
              )}

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--slate-500)]">Saldo inicial</dt>
                  {/* `CA4` · sin dato NO se escribe «$0»: nadie afirmó ese cero. */}
                  <dd className="font-medium text-[var(--slate-900)]">
                    {informe.openingBalanceSource === "registrado" ? (
                      formatAmount(informe.openingBalance)
                    ) : (
                      <span className="text-[var(--slate-500)]">Sin saldo de apertura</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--slate-500)]">Resultado del mes</dt>
                  <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.netResult)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--slate-500)]">Saldo final</dt>
                  <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.closingBalance)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--slate-500)]">Por cobrar</dt>
                  <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.receivables?.total ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--slate-500)]">Deuda a proveedores</dt>
                  <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.payables?.total ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--slate-500)]">Firmas</dt>
                  <dd className="font-medium text-[var(--slate-900)]">
                    {firmas.length === 0 ? (
                      <span className="text-[var(--slate-500)]">Sin firmar</span>
                    ) : (
                      firmas.map((f) => f.name).join(", ")
                    )}
                  </dd>
                </div>
              </dl>

              {anulando === informe.id && (
                <div className="mt-3 rounded-lg bg-[var(--slate-100)] p-3">
                  <label className="text-sm font-medium text-[var(--slate-900)]" htmlFor={`motivo-${informe.id}`}>
                    Motivo de la anulación
                  </label>
                  <p className="mt-0.5 text-xs text-[var(--slate-600)]">
                    Queda escrito en el informe y a la vista de quien lo consulte. Un informe
                    anulado no se borra.
                  </p>
                  <Textarea
                    id={`motivo-${informe.id}`}
                    className="mt-2"
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por ejemplo: se registró un egreso de marzo con fecha de abril."
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="xs"
                      variant="danger"
                      /* El servidor lo exige igual (`CA16`); esto solo evita el viaje. */
                      disabled={ocupado !== null || motivo.trim().length === 0}
                      onClick={() =>
                        conAviso(informe.id, async () => {
                          await voidMonthlyReportCallable({
                            tenantId: tenantId!,
                            reportId: informe.id,
                            reason: motivo,
                          });
                          setAnulando(null);
                          setMotivo("");
                          toast.success("Informe anulado.");
                        })
                      }
                    >
                      Anular informe
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setAnulando(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
