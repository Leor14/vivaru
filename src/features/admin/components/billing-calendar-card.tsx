"use client";

import { useEffect, useState } from "react";
import { deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase/client";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BillingCalendar } from "@/types/domain";

/**
 * `PRD-V-FLOW-003` §5.2 — el calendario de cobranza del conjunto.
 *
 * **Espejo de `functions/src/calendario-de-cobranza.ts`.** Los dos límites de abajo están ahí y
 * **también en `firestore.rules`**, y los tres tienen que decir lo mismo. Que estén tres veces no
 * es descuido: el formulario es comodidad, la regla es la que no se salta desde la consola, y el
 * servidor es quien decide si envía.
 */

/**
 * El día máximo del mes que se ofrece.
 *
 * **29, 30 y 31 no se ofrecen** porque no existen en todos los meses. Un aviso que a veces no sale
 * es peor que uno que sale siempre el 28: el que falla se descubre justo el mes que hacía falta.
 */
const DIA_MAX = 28;

/**
 * El ciclo mínimo entre avisos de cartera vencida, en días. **Decisión D1.**
 *
 * Un ciclo de un día es un correo diario a alguien que debe dinero, y eso tiene nombre en varias
 * legislaciones. No es un límite técnico.
 */
const MIN_CICLO_DIAS = 7;

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--slate-900)] placeholder:text-[var(--slate-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-700)] disabled:bg-[var(--slate-50)] disabled:text-[var(--slate-400)]";

/** `YYYY-MM-DD` → «12 de junio de 2026». Sin `new Date(iso)`, que desplaza por zona horaria. */
function fechaLegible(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d} de ${meses[m - 1]} de ${a}`;
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className="relative inline-block h-5 w-9 rounded-full transition-colors"
        style={{ backgroundColor: checked ? "var(--brand-700)" : "var(--slate-200)" }}
      >
        <span
          className="absolute left-0.5 top-0.5 inline-block h-4 w-4 rounded-full bg-[var(--surface-strong)] transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0px)" }}
        />
      </span>
      <span className="text-sm text-[var(--slate-700)]">{label}</span>
    </button>
  );
}

export function BillingCalendarCard({ tenantId }: { tenantId?: string }) {
  const [stored, setStored] = useState<BillingCalendar>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado del formulario. El «activo» va aparte del número porque `null` significa
  // desactivado: sin ese booleano no se puede distinguir «apagado» de «vacío».
  const [avisoActivo, setAvisoActivo] = useState(false);
  const [dia, setDia] = useState("");
  const [vencidasActivo, setVencidasActivo] = useState(false);
  const [ciclo, setCiclo] = useState("");

  useEffect(() => {
    if (!tenantId || !db) return;
    const unsub = onSnapshot(doc(db, "tenantSettings", tenantId), (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const raw = data.billingCalendar;
      const cal: BillingCalendar = typeof raw === "object" && raw ? (raw as BillingCalendar) : {};
      setStored(cal);
      // Se resincroniza el formulario con lo guardado. Es correcto porque esta tarjeta
      // no tiene edición larga: son dos números y se guardan enseguida.
      setAvisoActivo(typeof cal.noticeDayOfMonth === "number");
      setDia(typeof cal.noticeDayOfMonth === "number" ? String(cal.noticeDayOfMonth) : "");
      setVencidasActivo(typeof cal.overdueCycleDays === "number");
      setCiclo(typeof cal.overdueCycleDays === "number" ? String(cal.overdueCycleDays) : "");
      setLoaded(true);
    });
    return unsub;
  }, [tenantId]);

  const diaNum = Number(dia);
  const cicloNum = Number(ciclo);

  const errDia =
    !avisoActivo
      ? null
      : !dia.trim()
        ? "Elige un día del mes."
        : !Number.isInteger(diaNum) || diaNum < 1 || diaNum > DIA_MAX
          ? `Tiene que ser un día entre 1 y ${DIA_MAX}.`
          : null;

  const errCiclo =
    !vencidasActivo
      ? null
      : !ciclo.trim()
        ? "Elige cada cuántos días."
        : !Number.isInteger(cicloNum) || cicloNum < MIN_CICLO_DIAS
          ? `El mínimo son ${MIN_CICLO_DIAS} días.`
          : null;

  const hayError = Boolean(errDia || errCiclo);

  const guardadoDia = typeof stored.noticeDayOfMonth === "number" ? String(stored.noticeDayOfMonth) : "";
  const guardadoCiclo = typeof stored.overdueCycleDays === "number" ? String(stored.overdueCycleDays) : "";
  const sucio =
    avisoActivo !== (guardadoDia !== "") ||
    vencidasActivo !== (guardadoCiclo !== "") ||
    (avisoActivo && dia !== guardadoDia) ||
    (vencidasActivo && ciclo !== guardadoCiclo);

  const hayConfiguracion = guardadoDia !== "" || guardadoCiclo !== "";

  async function handleSave() {
    if (!db || !tenantId || hayError || saving) return;
    setSaving(true);
    try {
      // **RUTAS PUNTEADAS, NUNCA EL OBJETO ENTERO.** `lastNoticeSentAt` y `lastOverdueSentAt` son
      // la memoria de deduplicado del servidor: escribir `billingCalendar` completo las borraría, y
      // el efecto no sería un error visible sino que el aviso volviera a salir a quien ya lo
      // recibió. `deleteField()` para desactivar, que es distinto de guardar `null`.
      await updateDoc(doc(db, "tenantSettings", tenantId), {
        "billingCalendar.noticeDayOfMonth": avisoActivo ? diaNum : deleteField(),
        "billingCalendar.overdueCycleDays": vencidasActivo ? cicloNum : deleteField(),
      });
      toast.success("Calendario de cobranza guardado.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  const ultimoAviso = fechaLegible(stored.lastNoticeSentAt);
  const ultimaVencidas = fechaLegible(stored.lastOverdueSentAt);

  return (
    <Card>
      <CardTitle help={`Decide CUÁNDO salen los avisos de cobro. El día del mes es para el aviso de cuota; el ciclo es cada cuántos días se le recuerda su deuda a quien está en mora. Cualquiera de los dos se puede dejar apagado. El texto de esos avisos se edita más abajo, en Notificaciones a residentes.`}>
        Calendario de cobranza
      </CardTitle>
      <CardDescription className="mt-1">
        Elige cuándo sale el aviso de cuota y cada cuánto se recuerda la cartera vencida. Si dejas
        alguno apagado, ese aviso no se envía.
      </CardDescription>

      {!tenantId || !loaded ? (
        <p className="mt-4 text-sm text-[var(--slate-500)]">Cargando…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Aviso mensual de cuota */}
          <div className="rounded-xl border border-[var(--slate-200)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--slate-900)]">Aviso mensual de cuota</span>
              <Toggle
                checked={avisoActivo}
                onChange={setAvisoActivo}
                label={avisoActivo ? "Activado" : "Desactivado"}
                disabled={saving}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--slate-600)]">
              Sale una vez al mes, el día que elijas, a quien tenga saldo pendiente.
            </p>

            {avisoActivo ? (
              <div className="mt-3 max-w-xs">
                <label className="text-sm text-[var(--slate-700)]" htmlFor="dia-del-aviso">
                  Día del mes
                </label>
                <input
                  id="dia-del-aviso"
                  type="number"
                  min={1}
                  max={DIA_MAX}
                  step={1}
                  className={`${INPUT_CLASS} mt-1`}
                  value={dia}
                  disabled={saving}
                  onChange={(e) => setDia(e.target.value)}
                />
                {errDia ? (
                  <p className="mt-1 text-xs text-[var(--danger-700)]">{errDia}</p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--slate-500)]">
                    Del 1 al {DIA_MAX}. No se ofrecen el 29, 30 ni 31 porque no existen todos los
                    meses, y un aviso que a veces no sale es peor que uno que sale siempre.
                  </p>
                )}
              </div>
            ) : null}

            {ultimoAviso ? (
              <p className="mt-3 text-xs text-[var(--slate-500)]">Último aviso enviado: {ultimoAviso}.</p>
            ) : null}
          </div>

          {/* Recordatorio de cartera vencida */}
          <div className="rounded-xl border border-[var(--slate-200)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--slate-900)]">
                Recordatorio de cartera vencida
              </span>
              <Toggle
                checked={vencidasActivo}
                onChange={setVencidasActivo}
                label={vencidasActivo ? "Activado" : "Desactivado"}
                disabled={saving}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--slate-600)]">
              Se repite cada tantos días mientras la unidad siga debiendo.
            </p>

            {vencidasActivo ? (
              <div className="mt-3 max-w-xs">
                <label className="text-sm text-[var(--slate-700)]" htmlFor="ciclo-de-vencidas">
                  Cada cuántos días
                </label>
                <input
                  id="ciclo-de-vencidas"
                  type="number"
                  min={MIN_CICLO_DIAS}
                  step={1}
                  className={`${INPUT_CLASS} mt-1`}
                  value={ciclo}
                  disabled={saving}
                  onChange={(e) => setCiclo(e.target.value)}
                />
                {errCiclo ? (
                  <p className="mt-1 text-xs text-[var(--danger-700)]">{errCiclo}</p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--slate-500)]">
                    Mínimo {MIN_CICLO_DIAS} días. Recordarle la deuda a alguien todos los días no es
                    cobrar, es hostigar — y en varios países tiene consecuencias legales.
                  </p>
                )}
              </div>
            ) : null}

            {ultimaVencidas ? (
              <p className="mt-3 text-xs text-[var(--slate-500)]">
                Último recordatorio enviado: {ultimaVencidas}.
              </p>
            ) : null}
          </div>

          {!avisoActivo && !vencidasActivo && hayConfiguracion ? (
            <p className="text-xs text-[var(--slate-600)]">
              Al guardar con los dos apagados dejarán de salir avisos por calendario. Los cobros y la
              cartera no se tocan: lo que se apaga es el recordatorio, no la deuda.
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button size="sm" onClick={() => void handleSave()} disabled={!sucio || hayError || saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
