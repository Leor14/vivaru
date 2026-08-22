"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/shared/modal";
import { vendorSchema, type VendorFormInput } from "@/features/finanzas/schemas";
import {
  createVendor,
  findDuplicateTaxId,
  setVendorStatus,
  updateVendor,
  type VendorItem,
} from "@/features/finanzas/use-vendors";
import { toastFirebaseError } from "@/lib/utils/error-handler";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Sin categoría por defecto" },
  { value: "nomina", label: "Nómina" },
  { value: "servicios_publicos", label: "Servicios públicos" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "proveedores", label: "Proveedores" },
  { value: "administracion", label: "Administración" },
  { value: "seguros", label: "Seguros" },
  { value: "impuestos", label: "Impuestos" },
  { value: "otros", label: "Otros" },
];

const EMPTY: VendorFormInput = {
  type: "proveedor",
  taxId: "",
  legalName: "",
  tradeName: "",
  email: "",
  phone: "",
  address: "",
  representative: "",
  bankName: "",
  accountNumber: "",
  accountType: "",
  defaultCategory: "",
  status: "active",
};

/**
 * Registro de proveedores y beneficiarios (PRD-V-FEAT-003). Sin borrado: un
 * proveedor con historia se DESACTIVA (R5) — la regla de Firestore ya lo
 * impide con `delete: if false`, esto solo lo hace visible.
 */
export function VendorRegistryDialog({
  open,
  tenantId,
  userId,
  vendors,
  onClose,
}: {
  open: boolean;
  tenantId: string;
  userId: string;
  vendors: VendorItem[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<VendorItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<VendorFormInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: EMPTY,
  });

  function openCreate() {
    setEditing(null);
    form.reset(EMPTY);
    setFormOpen(true);
  }

  function openEdit(vendor: VendorItem) {
    setEditing(vendor);
    form.reset({
      type: vendor.type,
      taxId: vendor.taxId ?? "",
      legalName: vendor.legalName,
      tradeName: vendor.tradeName ?? "",
      email: vendor.email ?? "",
      phone: vendor.phone ?? "",
      address: vendor.address ?? "",
      representative: vendor.representative ?? "",
      bankName: vendor.bankName ?? "",
      accountNumber: vendor.accountNumber ?? "",
      accountType: vendor.accountType ?? "",
      defaultCategory: vendor.defaultCategory ?? "",
      status: vendor.status,
    });
    setFormOpen(true);
  }

  async function handleSave(values: VendorFormInput) {
    // R4: identificación única por conjunto. La regla no puede consultarlo;
    // se comprueba contra la lista suscrita antes de escribir (CF1).
    const duplicate = findDuplicateTaxId(vendors, values.taxId, editing?.id);
    if (duplicate) {
      toast.error(`Ya existe un registro con esa identificación: ${duplicate.legalName}.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...values,
        email: values.email || undefined,
        accountType: values.accountType || undefined,
        defaultCategory: values.defaultCategory || undefined,
      };
      if (editing) {
        await updateVendor(editing.id, userId, payload);
        toast.success("Proveedor actualizado.");
      } else {
        await createVendor(tenantId, userId, payload);
        toast.success("Proveedor registrado.");
      }
      setFormOpen(false);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(vendor: VendorItem) {
    try {
      await setVendorStatus(vendor.id, userId, vendor.status === "active" ? "inactive" : "active");
      toast.success(vendor.status === "active" ? "Proveedor desactivado. Su historia se conserva." : "Proveedor reactivado.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  return (
    <Modal open={open} title="Proveedores y beneficiarios" onClose={onClose}>
      {!formOpen ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--slate-600)]">
              {vendors.length === 0
                ? "Aún no hay proveedores registrados."
                : `${vendors.length} registrados. Un proveedor con historia no se borra: se desactiva.`}
            </p>
            <Button type="button" size="sm" onClick={openCreate}>
              Nuevo
            </Button>
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-[var(--slate-200)]">
            {vendors.length === 0 ? (
              <p className="p-4 text-sm text-[var(--slate-500)]">Registra el primero para dejar de teclearlo en cada egreso.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--slate-50)] text-left text-xs text-[var(--slate-600)]">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Identificación</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="border-t border-[var(--slate-100)]">
                      <td className="px-3 py-2">
                        {vendor.legalName}
                        {vendor.bankName ? (
                          <span className="block text-xs text-[var(--slate-500)]">{vendor.bankName}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{vendor.taxId || "—"}</td>
                      <td className="px-3 py-2">{vendor.type === "empleado" ? "Empleado" : "Proveedor"}</td>
                      <td className="px-3 py-2">
                        <Badge className={vendor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-[var(--slate-200)] text-[var(--slate-600)]"}>
                          {vendor.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(vendor)}>
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => void toggleStatus(vendor)}>
                          {vendor.status === "active" ? "Desactivar" : "Reactivar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <form
          onSubmit={form.handleSubmit(handleSave)}
          className="space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("type")}>
                <option value="proveedor">Proveedor (empresa o persona)</option>
                <option value="empleado">Empleado del conjunto</option>
              </select>
              <span className="mt-0.5 block text-xs text-[var(--slate-500)]">
                Los datos de un empleado son personales y entran en la política de retención.
              </span>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Identificación (RUC / NIT / RFC)
              <Input className="mt-1" {...form.register("taxId")} placeholder="Opcional" />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Razón social o nombre
              <Input className="mt-1" {...form.register("legalName")} />
              {form.formState.errors.legalName ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.legalName.message}</p>
              ) : null}
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Nombre comercial
              <Input className="mt-1" {...form.register("tradeName")} placeholder="Opcional" />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Correo
              <Input className="mt-1" {...form.register("email")} placeholder="Opcional" />
              {form.formState.errors.email ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.email.message}</p>
              ) : null}
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Teléfono
              <Input className="mt-1" {...form.register("phone")} placeholder="Opcional" />
            </label>
          </div>

          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3">
            <p className="text-xs font-medium text-[var(--slate-700)]">Datos bancarios — dónde se le paga. Nunca visibles para residentes.</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-[var(--slate-700)]">
                Banco
                <Input className="mt-1" {...form.register("bankName")} placeholder="Opcional" />
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Nº de cuenta
                <Input className="mt-1" {...form.register("accountNumber")} placeholder="Opcional" />
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Tipo de cuenta
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("accountType")}>
                  <option value="">—</option>
                  <option value="corriente">Corriente</option>
                  <option value="ahorros">Ahorros</option>
                </select>
              </label>
            </div>
          </div>

          <label className="block text-sm text-[var(--slate-700)]">
            Categoría de gasto por defecto
            <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("defaultCategory")}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="mt-0.5 block text-xs text-[var(--slate-500)]">Preclasifica el egreso al elegir este proveedor.</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              Volver
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
