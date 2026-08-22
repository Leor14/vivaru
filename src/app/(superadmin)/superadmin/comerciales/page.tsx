"use client";

import { useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SALES_REP_COUNTRY_LABEL,
  saveSalesRep,
  setSalesRepActive,
  watchSalesReps,
  type SalesRep,
  type SalesRepCountry,
} from "@/features/superadmin/sales-reps";
import { normalizeSalesRepCrmRef } from "@/lib/albert/crm-ref";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * Catálogo de comerciales (REVOPS-001E).
 *
 * Aquí viven las personas que venden — hoy cinco, en tres países. No tienen
 * cuenta ni entran al producto: son el registro contra el que se atribuyen
 * leads (dueño) y conjuntos (vendedor). Un comercial que sale se APAGA, no se
 * borra, porque sus atribuciones lo siguen citando.
 */

type FormState = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  country: SalesRepCountry;
  crmRef: string;
};

const FORM_VACIO: FormState = { name: "", email: "", phone: "", country: "MX", crmRef: "" };

export default function SuperadminComercialesPage() {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = watchSalesReps(
      (items) => {
        setReps(items);
        setLoading(false);
      },
      (message) => {
        toast.error(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  async function handleSave() {
    if (!form) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }
    /* La referencia a Albert era texto libre y aceptaba cualquier cosa; ahora falla
       aquí, con alguien delante, en vez de meses después al intentar resolverla. */
    const crmRef = normalizeSalesRepCrmRef(form.crmRef);
    if (!crmRef.ok) {
      toast.error(crmRef.error);
      return;
    }
    setSaving(true);
    try {
      await saveSalesRep({
        id: form.id,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        country: form.country,
        crmRef: crmRef.value ?? undefined,
      });
      toast.success(form.id ? "Comercial actualizado." : "Comercial dado de alta.");
      setForm(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rep: SalesRep) {
    try {
      await setSalesRepActive(rep.id, !rep.active);
      toast.success(rep.active ? `${rep.name} quedó inactivo.` : `${rep.name} está activo de nuevo.`);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle help="Quién vende Vivaru. Contra este catálogo se atribuye el dueño de cada lead y el vendedor de cada conjunto. No son usuarios del producto: no tienen cuenta ni acceso.">
            Comerciales
          </CardTitle>
          <CardDescription className="mt-1">
            {loading ? "Cargando…" : `${reps.length} comercial(es) · ${reps.filter((r) => r.active).length} activo(s)`}
          </CardDescription>
        </div>
        <Button onClick={() => setForm(FORM_VACIO)}>Dar de alta</Button>
      </div>

      {!loading && reps.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Sin comerciales"
            description="Da de alta a quienes venden para poder atribuirles leads y conjuntos."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--slate-200)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
              <tr>
                <th className="px-3 py-2 font-medium">Comercial</th>
                <th className="px-3 py-2 font-medium">País</th>
                <th className="px-3 py-2 font-medium">Referencia CRM</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((rep) => (
                <tr key={rep.id} className="border-t border-[var(--slate-200)] align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-[var(--slate-900)]">{rep.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--slate-500)]">
                      <Mail className="h-3 w-3" /> {rep.email}
                    </p>
                    {rep.phone ? (
                      <p className="inline-flex items-center gap-1 pl-2 text-[11px] text-[var(--slate-500)]">
                        <Phone className="h-3 w-3" /> {rep.phone}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[var(--slate-700)]">{SALES_REP_COUNTRY_LABEL[rep.country]}</td>
                  <td className="px-3 py-2 text-[var(--slate-600)]">
                    {rep.crmRef ?? <span className="text-[11px] text-[var(--slate-400)]">Sin vincular a Albert</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={rep.active ? "bg-emerald-100 text-emerald-700" : "bg-[var(--slate-100)] text-[var(--slate-500)]"}>
                      {rep.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            id: rep.id,
                            name: rep.name,
                            email: rep.email,
                            phone: rep.phone ?? "",
                            country: rep.country,
                            crmRef: rep.crmRef ?? "",
                          })
                        }
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleToggle(rep)}>
                        {rep.active ? "Desactivar" : "Reactivar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={form !== null}
        title={form?.id ? "Editar comercial" : "Dar de alta un comercial"}
        onClose={() => (saving ? undefined : setForm(null))}
      >
        {form ? (
          <div className="space-y-3 text-sm text-[var(--slate-700)]">
            <label className="block">
              Nombre completo
              <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              Correo
              <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                Teléfono <span className="text-xs text-[var(--slate-400)]">(opcional)</span>
                <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="block">
                País
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value as SalesRepCountry })}
                >
                  {Object.entries(SALES_REP_COUNTRY_LABEL).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              Referencia en Albert <span className="text-xs text-[var(--slate-400)]">(opcional — cuando Albert la tenga)</span>
              <Input
                className="mt-1"
                placeholder="Pega el uid que manda Albert (28 caracteres)"
                value={form.crmRef}
                onChange={(e) => setForm({ ...form, crmRef: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Dar de alta"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
