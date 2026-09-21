"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneCall, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveContactosDeEmergencia, watchTenantSettings } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import {
  MAXIMO_DE_CONTACTOS,
  validarContactos,
  type ContactoDeEmergencia,
  type ErrorDeContacto,
} from "@/features/tenant/contactos-de-emergencia";
import { toastFirebaseError } from "@/lib/utils/error-handler";

type Fila = Partial<ContactoDeEmergencia>;

const FILA_VACIA: Fila = { nombre: "", telefono: "", nota: "" };

/**
 * **Los números de emergencia del conjunto** (`L-32`), que escribe la administración y leen el
 * residente y la portería.
 *
 * A diferencia de la lista de agrupaciones —que persiste en cada añadir y quitar— aquí se edita la
 * tabla entera y se guarda con un botón: son tres campos por fila, y guardar a cada tecla dejaría
 * medio contacto publicado en la pantalla del residente mientras se escribe.
 */
export function EmergencyContactsCard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [filas, setFilas] = useState<Fila[]>([FILA_VACIA]);
  const [errores, setErrores] = useState<ErrorDeContacto[]>([]);
  const [saving, setSaving] = useState(false);
  // La primera carga pisa el formulario; después manda lo que se está escribiendo. Es una ref y no
  // un estado porque no pinta nada: con estado, cada snapshot volvería a renderizar sin motivo.
  const cargado = useRef(false);

  useEffect(() => {
    if (!tenantId) return;
    return watchTenantSettings(
      tenantId,
      (item) => {
        if (cargado.current) return;
        cargado.current = true;
        const guardados = item?.contactosDeEmergencia ?? [];
        setFilas(guardados.length > 0 ? guardados.map((c) => ({ ...c })) : [FILA_VACIA]);
      },
      () => {
        cargado.current = true;
      },
    );
  }, [tenantId]);

  function actualizar(indice: number, campo: keyof ContactoDeEmergencia, valor: string) {
    setFilas((previas) => previas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)));
  }

  function errorDe(indice: number, campo: "nombre" | "telefono") {
    return errores.find((e) => e.indice === indice && e.campo === campo)?.mensaje;
  }

  async function handleGuardar() {
    if (!tenantId || !user) return;
    const encontrados = validarContactos(filas);
    setErrores(encontrados);
    if (encontrados.length > 0) {
      toast.error("Revisa los contactos marcados.");
      return;
    }
    setSaving(true);
    try {
      await saveContactosDeEmergencia(tenantId, user.uid, filas);
      toast.success("Números de emergencia guardados.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <PhoneCall className="mt-1 h-5 w-5 text-[var(--brand-700)]" />
        <div>
          <CardTitle>Números de emergencia</CardTitle>
          <CardDescription className="mt-1">
            A quién llamar y en qué número. Los ven los residentes en su inicio y la portería en su panel.
            Hasta {MAXIMO_DE_CONTACTOS}: en una emergencia una lista larga no se lee.
          </CardDescription>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {filas.map((fila, indice) => (
          <li
            key={indice}
            className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                label={indice === 0 ? "A quién se llama" : undefined}
                value={fila.nombre ?? ""}
                placeholder="Portería, Bomberos, Ascensorista…"
                onChange={(event) => actualizar(indice, "nombre", event.target.value)}
                error={errorDe(indice, "nombre")}
              />
              <Input
                label={indice === 0 ? "Número" : undefined}
                value={fila.telefono ?? ""}
                placeholder="+57 601 555 0000"
                onChange={(event) => actualizar(indice, "telefono", event.target.value)}
                error={errorDe(indice, "telefono")}
              />
              <Input
                label={indice === 0 ? "Nota (opcional)" : undefined}
                value={fila.nota ?? ""}
                placeholder="24 horas, solo torre 2…"
                onChange={(event) => actualizar(indice, "nota", event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                className={`h-10 px-2 text-[var(--slate-500)] hover:text-[var(--danger-700)] ${indice === 0 ? "md:mt-6" : ""}`}
                onClick={() => setFilas((previas) => (previas.length === 1 ? [FILA_VACIA] : previas.filter((_, i) => i !== indice)))}
                disabled={saving}
                aria-label={`Quitar el contacto ${indice + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setFilas((previas) => [...previas, { ...FILA_VACIA }])}
          disabled={saving || filas.length >= MAXIMO_DE_CONTACTOS}
        >
          <Plus className="mr-1 h-4 w-4" />
          Agregar contacto
        </Button>
        <Button type="button" onClick={() => void handleGuardar()} disabled={saving}>
          {saving ? "Guardando..." : "Guardar números"}
        </Button>
      </div>
    </Card>
  );
}
