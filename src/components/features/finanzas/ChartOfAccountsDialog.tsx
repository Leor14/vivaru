"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import {
  createAccount,
  esCuentaDeSistema,
  hijasActivasDe,
  renameAccount,
  setAccountStatus,
  validarCuentaNueva,
  type ChartAccount,
  type TipoDeCuenta,
} from "@/features/finanzas/use-chart-of-accounts";
import { codigoPadreDe } from "@/lib/finanzas/codigo-de-cuenta";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * Plan de cuentas del conjunto (`PRD-V-PLAT-003` §5.1, entrega 2).
 *
 * **Tres acciones y ninguna más: añadir, renombrar, desactivar.** No hay borrado
 * —ver la cabecera de `use-chart-of-accounts.ts`—, así que CF3 y CF4 no se
 * pueden alcanzar desde aquí.
 *
 * **El código se enseña siempre y no se edita nunca.** Es lo que separa esto del
 * plan de Habitanto, donde vimos dos rubros con el mismo número: aquí el código
 * es el id del documento, así que cambiarlo no es «editar un campo», es otra
 * cuenta. La caja aparece deshabilitada al renombrar para que eso se vea, en vez
 * de dejar que alguien lo intente y reciba un error.
 */
export function ChartOfAccountsDialog({
  open,
  tenantId,
  userId,
  accounts,
  onClose,
}: {
  open: boolean;
  tenantId: string;
  userId: string;
  accounts: ChartAccount[];
  onClose: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChartAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<TipoDeCuenta>("ingreso");

  const padre = codigoPadreDe(code.trim());
  const cuentaPadre = useMemo(
    () => (padre ? accounts.find((c) => c.code === padre) : undefined),
    [padre, accounts],
  );

  function openCreate() {
    setEditing(null);
    setCode("");
    setName("");
    setType("ingreso");
    setFormOpen(true);
  }

  function openRename(cuenta: ChartAccount) {
    setEditing(cuenta);
    setCode(cuenta.code);
    setName(cuenta.name);
    setType(cuenta.type);
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        await renameAccount(editing.id, userId, name);
        toast.success("Cuenta renombrada. El nombre cambia en los informes y en el correo.");
      } else {
        // Valida aquí para poder DECIR qué falla (CF5). El servidor impide; esto explica.
        const check = validarCuentaNueva({ code, name, type }, accounts);
        if (!check.ok) {
          toast.error(check.error);
          return;
        }
        await createAccount(tenantId, userId, { code, name, type }, accounts);
        toast.success(`Cuenta ${check.code} creada.`);
      }
      setFormOpen(false);
    } catch (error) {
      // Los rechazos propios ya vienen con su frase; los de Firestore, no.
      if (error instanceof Error && !("code" in error)) toast.error(error.message);
      else toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(cuenta: ChartAccount) {
    try {
      const siguiente = cuenta.status === "active" ? "inactive" : "active";
      await setAccountStatus(cuenta, userId, siguiente, accounts);
      toast.success(
        siguiente === "inactive"
          ? "Cuenta desactivada. Deja de ofrecerse, y sus movimientos siguen en los informes."
          : "Cuenta reactivada.",
      );
    } catch (error) {
      if (error instanceof Error && !("code" in error)) toast.error(error.message);
      else toastFirebaseError(error);
    }
  }

  return (
    <Modal open={open} title="Plan de cuentas" onClose={onClose}>
      {!formOpen ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--slate-600)]">
              {accounts.length === 0
                ? "Este conjunto todavía no tiene plan sembrado."
                : `${accounts.length} cuentas. Una cuenta con movimientos no se borra: se desactiva.`}
            </p>
            <Button type="button" size="sm" onClick={openCreate} disabled={accounts.length === 0}>
              Nueva
            </Button>
          </div>

          <div className="mt-3 max-h-96 overflow-y-auto rounded-xl border border-[var(--slate-200)]">
            {accounts.length === 0 ? (
              <p className="p-4 text-sm text-[var(--slate-500)]">
                El plan estándar se siembra al crear el conjunto. Este es anterior a esa
                capacidad, así que hay que sembrarlo antes de poder editarlo.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--slate-50)] text-left text-xs text-[var(--slate-600)]">
                  <tr>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Cuenta</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((cuenta) => {
                    const esHija = Boolean(codigoPadreDe(cuenta.code));
                    const deSistema = esCuentaDeSistema(cuenta);
                    return (
                      <tr key={cuenta.id} className="border-t border-[var(--slate-100)]">
                        <td className="px-3 py-2 font-mono text-xs text-[var(--slate-600)]">
                          {cuenta.code}
                        </td>
                        <td className={esHija ? "px-3 py-2 pl-6" : "px-3 py-2 font-medium"}>
                          {cuenta.name}
                          <span className="ml-2 text-xs text-[var(--slate-500)]">
                            {cuenta.type === "ingreso" ? "ingreso" : "egreso"}
                          </span>
                          {deSistema ? (
                            <span
                              className="ml-2 text-xs text-[var(--slate-500)]"
                              title="Cuenta del plan estándar: se puede renombrar y desactivar, pero no borrar ni renumerar."
                            >
                              · estándar
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={
                              cuenta.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-[var(--slate-200)] text-[var(--slate-600)]"
                            }
                          >
                            {cuenta.status === "active" ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openRename(cuenta)}
                          >
                            Renombrar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleStatus(cuenta)}
                            title={
                              cuenta.status === "active" && hijasActivasDe(cuenta, accounts).length > 0
                                ? "Tiene cuentas activas colgando: desactívalas primero."
                                : undefined
                            }
                          >
                            {cuenta.status === "active" ? "Desactivar" : "Reactivar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium" htmlFor="cuenta-codigo">
              Código
            </label>
            <Input
              id="cuenta-codigo"
              value={code}
              disabled={Boolean(editing)}
              onChange={(event) => setCode(event.target.value)}
              placeholder="1.9"
            />
            <p className="mt-1 text-xs text-[var(--slate-500)]">
              {editing
                ? "El código no se cambia: identifica a la cuenta en todos los asientos ya escritos."
                : cuentaPadre
                  ? `Colgará de ${cuentaPadre.code} — ${cuentaPadre.name}.`
                  : padre
                    ? `Para crear la ${code.trim()} tiene que existir antes la cuenta ${padre}.`
                    : "Un nivel (1) o dos (1.2). Sin ceros a la izquierda."}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="cuenta-nombre">
              Nombre
            </label>
            <Input
              id="cuenta-nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cuota de vigilancia"
            />
          </div>

          {!editing ? (
            <div>
              <label className="text-sm font-medium" htmlFor="cuenta-tipo">
                Tipo
              </label>
              <select
                id="cuenta-tipo"
                className="h-10 w-full rounded-xl border border-[var(--slate-200)] px-3 text-sm"
                value={type}
                onChange={(event) => setType(event.target.value as TipoDeCuenta)}
              >
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : editing ? "Renombrar" : "Crear cuenta"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
