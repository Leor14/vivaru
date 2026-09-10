"use client";

import { Gauge } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/shared/modal";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useMisLecturas } from "@/features/medidores/use-mis-lecturas";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";

/**
 * `PRD-V-FEAT-008` entrega 3 · lo que el residente ve de su medidor.
 *
 * **La foto es la razón de ser de esta tarjeta.** Un cargo por consumo es
 * discutible por naturaleza —«yo no gasté eso»— y lo que lo hace defendible por
 * las dos partes es poder mirar el contador. Por eso la foto no es un adjunto
 * escondido: se abre a tamaño completo desde la fila.
 *
 * **Si el conjunto no mide nada, la tarjeta no se pinta.** Un módulo vacío en el
 * estado de cuenta de alguien que no paga agua medida es ruido.
 */
const ETIQUETA_UNIDAD: Record<string, string> = { m3: "m³", kwh: "kWh", gal: "galones" };

export function MisLecturasCard({ tenantId, unitId }: { tenantId?: string; unitId?: string }) {
  const { lecturas, porServicio, cargando } = useMisLecturas(tenantId, unitId);
  const { formatAmount } = useTenantCurrency();
  const [foto, setFoto] = useState<{ url: string; titulo: string } | null>(null);

  // Sin lecturas no hay nada que contar. **No se pinta un estado vacío**: el
  // residente de un conjunto que no mide consumos no tiene por qué enterarse de
  // que esta función existe.
  if (cargando || lecturas.length === 0) return null;

  return (
    <Card className="p-5">
      <CardTitle className="flex items-center gap-2">
        <Gauge className="h-4 w-4" /> Tus consumos medidos
      </CardTitle>
      <CardDescription className="mt-1">
        La lectura de tu medidor cada mes, con la foto que tomó la administración.
      </CardDescription>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-[var(--slate-200)] text-left text-xs uppercase tracking-wide text-[var(--slate-600)]">
              <th className="py-2 pr-4">Mes</th>
              <th className="py-2 pr-4">Servicio</th>
              <th className="py-2 pr-4 text-right">Consumo</th>
              <th className="py-2 pr-4 text-right">Importe</th>
              <th className="py-2">Medidor</th>
            </tr>
          </thead>
          <tbody>
            {lecturas.map((l) => {
              const servicio = porServicio.get(l.serviceId);
              const medida = servicio ? (ETIQUETA_UNIDAD[servicio.unit] ?? servicio.unit) : "";
              return (
                <tr key={l.id} className="border-b border-[var(--slate-100)]">
                  <td className="py-2 pr-4 font-medium text-[var(--slate-900)]">{l.period}</td>
                  <td className="py-2 pr-4 text-[var(--slate-700)]">{servicio?.name ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--slate-700)]">
                    {l.esLineaBase ? (
                      // `RN-04`. Se dice por qué no se cobra, en vez de enseñar
                      // un cero que parece un error.
                      <span className="text-[var(--slate-500)]">primera lectura</span>
                    ) : (
                      `${l.consumption} ${medida}`
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--slate-900)]">
                    {l.esLineaBase || !servicio ? "—" : formatAmount(Math.round(l.consumption * servicio.rate))}
                  </td>
                  <td className="py-2">
                    {l.photoUrl ? (
                      <button
                        type="button"
                        onClick={() => setFoto({ url: l.photoUrl!, titulo: `${servicio?.name ?? "Medidor"} · ${l.period}` })}
                        className="rounded-lg border border-[var(--slate-300)] px-2 py-1 text-xs text-[var(--slate-700)] hover:bg-[var(--slate-50)]"
                      >
                        Ver foto
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--slate-500)]">sin foto</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={foto !== null}
        title=""
        header={<h3 className="text-lg font-semibold text-[var(--slate-900)]">{foto?.titulo ?? ""}</h3>}
        onClose={() => setFoto(null)}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.url}
            alt={`Foto del medidor · ${foto.titulo}`}
            className="w-full rounded-xl border border-[var(--slate-200)]"
          />
        ) : null}
      </Modal>
    </Card>
  );
}
