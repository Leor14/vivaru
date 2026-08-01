"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createTrialWorkspaceCallable } from "@/lib/firebase/callables";

/**
 * Registro público del self-service (Fase 3).
 *
 * Dos pasos, con la fricción mínima: la validación de que es administrador NO
 * se hace aquí —pedir papeles mata el funnel— sino en el follow-up del asesor.
 * El acceso al ambiente llega por correo, así que el enlace ES la verificación:
 * sin acceso al buzón no se entra.
 */

type Step = "contacto" | "conjunto" | "listo";

const PAISES = [
  { value: "MX", label: "México" },
  { value: "CO", label: "Colombia" },
  { value: "EC", label: "Ecuador" },
];

export default function RegistroPage() {
  const [step, setStep] = useState<Step>("contacto");
  const [submitting, setSubmitting] = useState(false);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [conjunto, setConjunto] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [pais, setPais] = useState("MX");
  const [unidades, setUnidades] = useState("");

  function goToConjunto() {
    if (nombre.trim().length < 3) return toast.error("Escribe tu nombre completo.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Escribe un correo válido.");
    setStep("conjunto");
  }

  async function handleSubmit() {
    if (conjunto.trim().length < 3) return toast.error("Escribe el nombre de tu conjunto.");
    if (ciudad.trim().length < 3) return toast.error("Escribe la ciudad.");

    setSubmitting(true);
    try {
      await createTrialWorkspaceCallable({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim() || undefined,
        conjunto: conjunto.trim(),
        ciudad: ciudad.trim(),
        pais,
        unidadesEstimadas: unidades ? Number(unidades) : undefined,
      });
      setStep("listo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible crear tu ambiente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="fixed inset-0 isolate overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/hogaru.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1.5px]" aria-hidden />

      <div className="relative z-10 flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        <Card className="soft-panel w-full max-w-[520px] rounded-2xl border border-[var(--slate-200)] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-9">
          {step === "listo" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Mail className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--slate-900)]">Revisa tu correo</h1>
              <p className="mt-2 text-sm text-[var(--slate-600)]">
                Creamos el ambiente de <strong>{conjunto.trim()}</strong> y te enviamos a{" "}
                <strong>{email.trim().toLowerCase()}</strong> el enlace para definir tu contraseña y entrar.
              </p>
              <p className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3 text-xs text-[var(--slate-600)]">
                Tienes <strong>15 días</strong> de prueba. Si no ves el correo en unos minutos, revisa la
                carpeta de spam.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex items-center rounded-xl border border-[var(--slate-300)] px-5 py-2.5 text-sm font-semibold text-[var(--slate-800)] hover:bg-[var(--slate-100)]"
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-50,#E6F1FB)] text-[var(--brand-700,#0C447C)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--slate-900)]">
                  Prueba Vivaru 15 días
                </h1>
                <p className="mt-1 text-sm text-[var(--slate-600)]">
                  Sin tarjeta y sin instalar nada. Configura tu conjunto y pruébalo hoy.
                </p>
              </div>

              {/* Progreso: dos pasos, para que se vea corto. */}
              <div className="mb-5 flex items-center gap-2 text-xs font-medium">
                <span className={step === "contacto" ? "text-[var(--brand-700,#0C447C)]" : "text-emerald-600"}>
                  {step === "conjunto" ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}
                  1. Tus datos
                </span>
                <span className="h-px flex-1 bg-[var(--slate-200)]" />
                <span className={step === "conjunto" ? "text-[var(--brand-700,#0C447C)]" : "text-[var(--slate-400)]"}>
                  2. Tu conjunto
                </span>
              </div>

              {step === "contacto" ? (
                <div className="space-y-3">
                  <label className="block text-sm text-[var(--slate-700)]">
                    Nombre completo
                    <Input className="mt-1" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Carolina Méndez" autoFocus />
                  </label>
                  <label className="block text-sm text-[var(--slate-700)]">
                    Correo
                    <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
                    <span className="mt-1 block text-xs text-[var(--slate-500)]">
                      Ahí te enviamos el acceso a tu ambiente.
                    </span>
                  </label>
                  <label className="block text-sm text-[var(--slate-700)]">
                    Teléfono <span className="text-[var(--slate-400)]">(opcional)</span>
                    <Input className="mt-1" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52 55 0000 0000" />
                  </label>
                  <Button className="w-full" onClick={goToConjunto}>
                    Continuar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm text-[var(--slate-700)]">
                    Nombre del conjunto
                    <Input className="mt-1" value={conjunto} onChange={(e) => setConjunto(e.target.value)} placeholder="Residencial Las Palmas" autoFocus />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm text-[var(--slate-700)]">
                      Ciudad
                      <Input className="mt-1" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Cancún" />
                    </label>
                    <label className="block text-sm text-[var(--slate-700)]">
                      País
                      <select
                        className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                        value={pais}
                        onChange={(e) => setPais(e.target.value)}
                      >
                        {PAISES.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block text-sm text-[var(--slate-700)]">
                    ¿Cuántas unidades tiene? <span className="text-[var(--slate-400)]">(aproximado)</span>
                    <Input className="mt-1" type="number" min={1} value={unidades} onChange={(e) => setUnidades(e.target.value)} placeholder="120" />
                  </label>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep("contacto")} disabled={submitting}>
                      Atrás
                    </Button>
                    <Button className="flex-1" onClick={() => void handleSubmit()} disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando tu ambiente…
                        </>
                      ) : (
                        "Crear mi ambiente de prueba"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <p className="mt-5 text-center text-xs text-[var(--slate-500)]">
                ¿Prefieres que te acompañemos?{" "}
                <a href="mailto:comercial@qintilab.com?subject=Quiero%20una%20demo%20de%20Vivaru" className="font-medium text-[var(--brand-700,#0C447C)] hover:underline">
                  Habla con un asesor
                </a>
              </p>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}
