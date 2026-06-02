"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveFiscalProfile, watchTenantSettings } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import { fiscalProfileSchema, type FiscalProfileFormValues } from "@/features/finanzas/schemas";
import { toastFirebaseError } from "@/lib/utils/error-handler";

export function FiscalProfileCard() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const form = useForm<FiscalProfileFormValues>({
    resolver: zodResolver(fiscalProfileSchema),
    defaultValues: { taxId: "", legalName: "", address: "", country: "", voucherSeriesPrefix: "" },
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = watchTenantSettings(
      user.tenantId,
      (item) => {
        const fp = item?.fiscalProfile;
        if (fp) {
          form.reset({
            taxId: fp.taxId ?? "",
            legalName: fp.legalName ?? "",
            address: fp.address ?? "",
            country: fp.country ?? "",
            voucherSeriesPrefix: fp.voucherSeriesPrefix ?? "",
          });
        }
      },
      () => undefined,
    );
    return () => unsub();
  }, [user?.tenantId, form]);

  async function onSubmit(values: FiscalProfileFormValues) {
    if (!user?.tenantId) return;
    setSaving(true);
    try {
      await saveFiscalProfile(user.tenantId, user.uid, {
        taxId: values.taxId,
        legalName: values.legalName,
        address: values.address,
        country: values.country || undefined,
        voucherSeriesPrefix: values.voucherSeriesPrefix,
      });
      toast.success("Datos fiscales guardados.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle help="Datos fiscales del conjunto que aparecen en los comprobantes/recibos de pago: identificación tributaria (RUC en Ecuador, NIT en Colombia, RFC en México), razón social y dirección.">
        Datos fiscales del conjunto
      </CardTitle>
      <CardDescription className="mt-1">Aparecen en los comprobantes de pago emitidos.</CardDescription>
      <form className="mt-4 space-y-3" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--slate-700)]">
            País
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              {...form.register("country")}
            >
              <option value="">Sin definir</option>
              <option value="EC">Ecuador</option>
              <option value="CO">Colombia</option>
              <option value="MX">México</option>
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Identificación tributaria (RUC / NIT / RFC)
            <Input className="mt-1" {...form.register("taxId")} placeholder="1790012345001" />
          </label>
        </div>
        <label className="block text-sm text-[var(--slate-700)]">
          Razón social
          <Input className="mt-1" {...form.register("legalName")} placeholder="Conjunto Residencial ..." />
        </label>
        <label className="block text-sm text-[var(--slate-700)]">
          Dirección
          <Input className="mt-1" {...form.register("address")} placeholder="Dirección del conjunto" />
        </label>
        <label className="block text-sm text-[var(--slate-700)]">
          Serie de comprobantes (opcional)
          <Input className="mt-1" {...form.register("voucherSeriesPrefix")} placeholder="001-001" />
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar datos fiscales"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
