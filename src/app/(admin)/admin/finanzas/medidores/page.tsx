"use client";

import { Camera, Check, Gauge, Lock, LockOpen, Plus, Receipt, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CobrarConsumoDialog } from "@/components/features/medidores/CobrarConsumoDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { watchUnits, type UnitItem } from "@/features/admin/services";
import {
  createMeteredService,
  deleteMeteredService,
  uploadMeterPhoto,
  watchMeterReadings,
  watchMeteredServices,
} from "@/features/medidores/services";
import {
  closeMeterPeriodCallable,
  registerMeterReadingCallable,
  reopenMeterPeriodCallable,
} from "@/lib/firebase/callables";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { MeterReading, MeteredService } from "@/types/domain";

/**
 * `PRD-V-FEAT-008` entrega 1 — la pantalla de lecturas.
 *
 * **Está pensada para usarse de pie, con una mano y con el medidor delante.** Ese
 * es el escenario real: recorre el edificio, fotografía cada contador y hoy manda
 * las fotos por correo en un archivo aparte. Por eso la lectura anterior viene
 * puesta, el consumo se ve al teclear, y **la foto no bloquea el guardado**: se
 * exige para CERRAR el período, no para seguir andando.
 */

const UNIDADES_DE_MEDIDA: Array<{ v: MeteredService["unit"]; etiqueta: string }> = [
  { v: "m3", etiqueta: "m³" },
  { v: "kwh", etiqueta: "kWh" },
  { v: "gal", etiqueta: "galones" },
];

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export default function MedidoresPage() {
  const { user } = useAuth();
  const medicionActiva = useFeatureFlag("producto-medicion-de-consumos");
  const { formatAmount } = useTenantCurrency();

  const [servicios, setServicios] = useState<MeteredService[]>([]);
  const [unidades, setUnidades] = useState<UnitItem[]>([]);
  const [lecturas, setLecturas] = useState<MeterReading[]>([]);
  const [servicioId, setServicioId] = useState<string>("");
  const [periodo, setPeriodo] = useState(periodoActual);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [cobrandoAbierto, setCobrandoAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ name: "", unit: "m3" as MeteredService["unit"], rate: "" });
  const inputFoto = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!user?.tenantId) return;
    return watchMeteredServices(user.tenantId, setServicios, setError);
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId) return;
    return watchUnits(user.tenantId, setUnidades, setError);
  }, [user?.tenantId]);

  useEffect(() => {
    if (!servicioId && servicios.length > 0) setServicioId(servicios[0].id);
  }, [servicios, servicioId]);

  useEffect(() => {
    if (!user?.tenantId || !servicioId) {
      setLecturas([]);
      return;
    }
    return watchMeterReadings(user.tenantId, servicioId, periodo, setLecturas, setError);
  }, [user?.tenantId, servicioId, periodo]);

  const servicio = servicios.find((s) => s.id === servicioId);
  const porUnidad = useMemo(() => new Map(lecturas.map((l) => [l.unitId, l])), [lecturas]);
  const activas = useMemo(() => unidades.filter((u) => u.status === "active"), [unidades]);

  const periodoCerrado = lecturas.length > 0 && lecturas.every((l) => l.status !== "abierto");
  const yaCobrado = lecturas.some((l) => l.status === "cobrado");
  const sinFoto = lecturas.filter((l) => !l.photoUrl).length;
  const totalConsumo = lecturas.reduce((a, l) => a + (l.consumption ?? 0), 0);
  const totalImporte = servicio ? Math.round(totalConsumo * servicio.rate) : 0;

  async function guardarLectura(unidad: UnitItem, valor: string) {
    if (!user?.tenantId || !servicio) return;
    const current = Number(valor);
    if (!Number.isFinite(current) || current < 0) {
      toast.error("La lectura tiene que ser un número positivo.");
      return;
    }
    setGuardando(unidad.id);
    try {
      const r = await registerMeterReadingCallable({
        tenantId: user.tenantId,
        serviceId: servicio.id,
        unitId: unidad.id,
        period: periodo,
        current,
      });
      if (r.esLineaBase) {
        toast.success(`${unidad.displayName}: primera lectura registrada. No genera cargo.`);
      } else if (r.reinicio) {
        toast.warning(
          `${unidad.displayName}: la lectura es menor que la anterior. Se guardó, pero revisa si el medidor se reinició.`,
        );
      } else {
        toast.success(`${unidad.displayName}: ${r.consumption} ${etiquetaUnidad(servicio.unit)}.`);
      }
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setGuardando(null);
    }
  }

  async function subirFoto(unidad: UnitItem, file: File) {
    if (!user?.tenantId || !servicio) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se admiten imágenes (JPG, PNG o HEIC).");
      return;
    }
    const lectura = porUnidad.get(unidad.id);
    if (!lectura) {
      toast.error("Registra primero la lectura de esta unidad, y después su foto.");
      return;
    }
    setGuardando(unidad.id);
    try {
      const { photoUrl } = await uploadMeterPhoto({
        tenantId: user.tenantId,
        serviceId: servicio.id,
        unitId: unidad.id,
        period: periodo,
        file,
      });
      await registerMeterReadingCallable({
        tenantId: user.tenantId,
        serviceId: servicio.id,
        unitId: unidad.id,
        period: periodo,
        current: lectura.current,
        photoUrl,
      });
      toast.success(`Foto de ${unidad.displayName} guardada.`);
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setGuardando(null);
    }
  }

  async function cerrar() {
    if (!user?.tenantId || !servicio) return;
    setCerrando(true);
    try {
      const r = await closeMeterPeriodCallable({
        tenantId: user.tenantId,
        serviceId: servicio.id,
        period: periodo,
      });
      toast.success(`Período cerrado con ${r.lecturas} ${r.lecturas === 1 ? "lectura" : "lecturas"}.`);
    } catch (e) {
      // El servidor deniega **nombrando las unidades sin foto** (`RN-09`). Ese
      // mensaje se enseña tal cual: un «no se puede cerrar» a secas obligaría a
      // buscarlas a mano entre noventa y tres.
      toastFirebaseError(e);
    } finally {
      setCerrando(false);
    }
  }

  async function reabrir() {
    if (!user?.tenantId || !servicio) return;
    setCerrando(true);
    try {
      await reopenMeterPeriodCallable({ tenantId: user.tenantId, serviceId: servicio.id, period: periodo });
      toast.success("Período reabierto.");
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setCerrando(false);
    }
  }

  async function crearServicio() {
    if (!user?.tenantId) return;
    const rate = Number(nuevo.rate);
    if (!nuevo.name.trim() || !Number.isFinite(rate) || rate <= 0) {
      toast.error("El servicio necesita un nombre y una tarifa mayor que cero.");
      return;
    }
    try {
      await createMeteredService({
        tenantId: user.tenantId,
        name: nuevo.name.trim(),
        unit: nuevo.unit,
        rate,
        // `RN-08` — cae en la cuenta de consumos medidos del plan del conjunto.
        accountCode: "1.11",
        active: true,
      });
      setNuevo({ name: "", unit: "m3", rate: "" });
      toast.success("Servicio medido creado.");
    } catch (e) {
      toastFirebaseError(e);
    }
  }

  if (!medicionActiva) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <CardTitle>Esta función no está activa en tu conjunto</CardTitle>
          <CardDescription className="mt-2">
            La medición de consumos permite cobrar el agua, el gas o la energía por lo que
            consumió cada unidad. Escríbenos si quieres activarla.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* El encabezado de nivel 1 lo pone el shell, con el nombre del menú.
          Repetirlo aquí sería el nombre dos veces y dos anclas para el lector de
          pantalla — lo vigila `tests/page-identity.test.ts`, que además cuenta
          la etiqueta ESCRITA EN COMENTARIOS: nombrarla para explicarla también
          lo enrojece. */}
      <p className="text-sm text-[var(--slate-600)]">
        Registra la lectura de cada unidad con su foto. El consumo y el importe los calcula
        Vivaru.
      </p>

      {error ? (
        <Card className="border-[var(--danger-300)] p-4 text-sm text-[var(--danger-700)]">{error}</Card>
      ) : null}

      {/* ── catálogo ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4" /> Servicios que se miden
        </CardTitle>
        <CardDescription className="mt-1">
          Cada servicio tiene su unidad de medida y su tarifa. Se declaran una vez.
        </CardDescription>

        <div className="mt-4 flex flex-wrap gap-2">
          {servicios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServicioId(s.id)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                s.id === servicioId
                  ? "border-[var(--primary-500)] bg-[var(--primary-50)]"
                  : "border-[var(--slate-300)] bg-[var(--surface-strong)]"
              }`}
            >
              <span className="font-medium text-[var(--slate-900)]">{s.name}</span>
              <span className="ml-2 text-xs text-[var(--slate-600)]">
                {formatAmount(s.rate)} / {etiquetaUnidad(s.unit)}
              </span>
            </button>
          ))}
          {servicios.length === 0 ? (
            <p className="text-sm text-[var(--slate-600)]">
              Todavía no hay ningún servicio medido. Declara el primero abajo.
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--slate-200)] pt-4">
          <label className="text-sm">
            Nombre
            <Input
              className="mt-1 w-48"
              placeholder="Agua fría"
              value={nuevo.name}
              onChange={(e) => setNuevo((n) => ({ ...n, name: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Se mide en
            <select
              className="mt-1 h-10 rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={nuevo.unit}
              onChange={(e) => setNuevo((n) => ({ ...n, unit: e.target.value as MeteredService["unit"] }))}
            >
              {UNIDADES_DE_MEDIDA.map((u) => (
                <option key={u.v} value={u.v}>{u.etiqueta}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Tarifa por unidad
            <Input
              className="mt-1 w-36"
              inputMode="numeric"
              placeholder="3200"
              value={nuevo.rate}
              onChange={(e) => setNuevo((n) => ({ ...n, rate: e.target.value }))}
            />
          </label>
          <Button type="button" onClick={() => void crearServicio()}>
            <Plus className="mr-1 h-4 w-4" /> Añadir servicio
          </Button>
        </div>
      </Card>

      {/* ── lecturas ─────────────────────────────────────────────────────── */}
      {servicio ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="mr-auto">Lecturas de {servicio.name}</CardTitle>
            <label className="text-sm">
              Período
              <Input
                type="month"
                className="ml-2 inline-block w-40"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </label>
            {periodoCerrado ? (
              <Button variant="outline" disabled={cerrando || yaCobrado} onClick={() => void reabrir()}>
                <LockOpen className="mr-1 h-4 w-4" />
                {yaCobrado ? "Ya cobrado" : "Reabrir"}
              </Button>
            ) : (
              <Button variant="outline" disabled={cerrando || lecturas.length === 0} onClick={() => void cerrar()}>
                <Lock className="mr-1 h-4 w-4" /> Cerrar período
              </Button>
            )}
            {/* Cobrar es el acto final del mes, así que va como acción principal
                y **solo aparece con el período cerrado**: cerrar es lo que
                garantiza que están todas las fotos (`RN-09`), y un cargo sin la
                evidencia detrás es un cargo que nadie puede defender. */}
            {periodoCerrado && !yaCobrado ? (
              <Button onClick={() => setCobrandoAbierto(true)}>
                <Receipt className="mr-1 h-4 w-4" /> Cobrar el período
              </Button>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--slate-600)]">
            <span>
              <b className="text-[var(--slate-900)] tabular-nums">{lecturas.length}</b> de {activas.length} unidades
            </span>
            <span>
              Consumo total{" "}
              <b className="text-[var(--slate-900)] tabular-nums">
                {redondear(totalConsumo)} {etiquetaUnidad(servicio.unit)}
              </b>
            </span>
            <span>
              Importe <b className="text-[var(--slate-900)] tabular-nums">{formatAmount(totalImporte)}</b>
            </span>
            {sinFoto > 0 && !periodoCerrado ? (
              // `RN-09` — se dice ANTES de intentar cerrar, no después del error.
              <span className="text-[var(--warning-700)]">
                Faltan <b className="tabular-nums">{sinFoto}</b> {sinFoto === 1 ? "foto" : "fotos"} para poder cerrar
              </span>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--slate-200)] text-left text-xs uppercase tracking-wide text-[var(--slate-600)]">
                  <th className="py-2 pr-4">Unidad</th>
                  <th className="py-2 pr-4 text-right">Anterior</th>
                  <th className="py-2 pr-4">Lectura de este mes</th>
                  <th className="py-2 pr-4 text-right">Consumo</th>
                  <th className="py-2 pr-4 text-right">Importe</th>
                  <th className="py-2">Foto</th>
                </tr>
              </thead>
              <tbody>
                {activas.map((u) => {
                  const l = porUnidad.get(u.id);
                  const editable = !l || l.status === "abierto";
                  return (
                    <tr key={u.id} className="border-b border-[var(--slate-100)]">
                      <td className="py-2 pr-4 font-medium text-[var(--slate-900)]">
                        {u.displayName}
                        {l?.esLineaBase ? (
                          <Badge className="ml-2">Primera lectura · no cobra</Badge>
                        ) : null}
                        {l?.reinicio ? <Badge className="ml-2">Revisar: medidor reiniciado</Badge> : null}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--slate-600)]">
                        {l ? redondear(l.previous) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Input
                          // 🔴 `key` con el período dentro, y no es cosmético: el
                          // campo es NO CONTROLADO —`defaultValue`—, así que al
                          // cambiar de mes React reutiliza el nodo y **se queda
                          // con la lectura del mes anterior**. Se vio en pantalla
                          // el 10 de septiembre: octubre en blanco y el campo
                          // enseñando el 1200 de septiembre. Quien lo mirara
                          // daría el mes por registrado y se lo saltaría entero.
                          // El `key` fuerza el remonte, que es lo que lo vacía.
                          key={`${u.id}-${periodo}-${l?.current ?? "vacio"}`}
                          className="w-28"
                          inputMode="decimal"
                          disabled={!editable || guardando === u.id}
                          defaultValue={l ? String(l.current) : ""}
                          placeholder="—"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v || (l && Number(v) === l.current)) return;
                            void guardarLectura(u, v);
                          }}
                        />
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {l ? `${redondear(l.consumption)} ${etiquetaUnidad(servicio.unit)}` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--slate-900)]">
                        {l ? formatAmount(Math.round(l.consumption * servicio.rate)) : "—"}
                      </td>
                      <td className="py-2">
                        <input
                          ref={(el) => {
                            inputFoto.current[u.id] = el;
                          }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void subirFoto(u, f);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant={l?.photoUrl ? "outline" : "default"}
                          disabled={!editable || !l || guardando === u.id}
                          onClick={() => inputFoto.current[u.id]?.click()}
                        >
                          {l?.photoUrl ? (
                            <>
                              <Check className="mr-1 h-4 w-4" /> Cambiar
                            </>
                          ) : (
                            <>
                              <Camera className="mr-1 h-4 w-4" /> Foto
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {yaCobrado ? (
            <p className="mt-4 text-sm text-[var(--slate-600)]">
              Este período ya se cobró. Los cargos están en <b>Cartera</b>, y las lecturas
              quedaron selladas: no se editan.
            </p>
          ) : null}

          {activas.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--slate-600)]">
              Este conjunto todavía no tiene unidades activas.
            </p>
          ) : null}

          {user?.tenantId ? (
            <CobrarConsumoDialog
              open={cobrandoAbierto}
              onClose={() => setCobrandoAbierto(false)}
              tenantId={user.tenantId}
              serviceId={servicio.id}
              period={periodo}
              onCobrado={() => setCobrandoAbierto(false)}
            />
          ) : null}
        </Card>
      ) : null}

      {servicios.length > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              if (servicio) void deleteMeteredService(servicio.id).catch(toastFirebaseError);
            }}
            disabled={!servicio || lecturas.length > 0}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Eliminar «{servicio?.name}»
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function etiquetaUnidad(u: MeteredService["unit"]) {
  return UNIDADES_DE_MEDIDA.find((x) => x.v === u)?.etiqueta ?? u;
}

/** Tres decimales, como el módulo del servidor. Espejo deliberado. */
function redondear(v: number) {
  return Math.round(v * 1000) / 1000;
}
