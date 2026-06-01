"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/marketing/ui/dialog";
import { Button } from "@/components/marketing/ui/button";
import { Input } from "@/components/marketing/ui/input";
import { Label } from "@/components/marketing/ui/label";
import { track } from "@/lib/marketing/analytics";

/**
 * Demo lead-capture wizard.
 *
 * Step 1 — Contacto: nombre, email, teléfono/WhatsApp (opcional)
 * Step 2 — Perfil: empresa/conjunto, cargo (opcional), conjuntos administrados,
 *           unidades aprox (opcional), timeline
 * Confirmation — success screen, resets state on close
 *
 * Submits to POST /api/demo → notifies comercial@qintilab.com + sends
 * confirmation to the lead's email via Resend.
 */

type Step = "contact" | "profile" | "confirm";

interface ContactData {
  nombre: string;
  email: string;
  telefono: string;
}

interface ProfileData {
  empresa: string;
  cargo: string;
  conjuntos: string;
  unidades: string;
  timeline: string;
}

const EMPTY_CONTACT: ContactData = { nombre: "", email: "", telefono: "" };
const EMPTY_PROFILE: ProfileData = {
  empresa: "",
  cargo: "",
  conjuntos: "",
  unidades: "",
  timeline: "",
};

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export interface DemoDialogProps {
  /** The trigger button. Must be a single React element. */
  children: React.ReactNode;
  /** Section identifier for `cta_primary_click` telemetry. */
  section:
    | "topbar"
    | "hero"
    | "pricing"
    | "pilot"
    | "final"
    | "mobile_bottom"
    | "diagnostico_result";
}

export function DemoDialog({ children, section }: DemoDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("contact");
  const [contact, setContact] = React.useState<ContactData>(EMPTY_CONTACT);
  const [profile, setProfile] = React.useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trigger = React.Children.only(children) as React.ReactElement;

  function resetAll() {
    setStep("contact");
    setContact(EMPTY_CONTACT);
    setProfile(EMPTY_PROFILE);
    setLoading(false);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Delay reset until after the close animation finishes
      setTimeout(resetAll, 300);
    }
  }

  function validateContact(): string | null {
    if (!contact.nombre.trim()) return "Por favor ingresa tu nombre.";
    if (
      !contact.email.trim() ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)
    )
      return "Ingresa un email válido.";
    return null;
  }

  function validateProfile(): string | null {
    if (!profile.empresa.trim())
      return "Por favor ingresa el nombre del conjunto o empresa.";
    if (!profile.conjuntos)
      return "Selecciona la cantidad de conjuntos que administras.";
    if (!profile.timeline) return "Selecciona cuándo planeas implementar.";
    return null;
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateContact();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep("profile");
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateProfile();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, ...profile }),
      });
      if (!res.ok) throw new Error("api_error");
      track("demo_booked", { section });
      setStep("confirm");
    } catch {
      setError(
        "Ocurrió un error. Por favor intenta de nuevo o escríbenos directamente a comercial@qintilab.com."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        onClick={() => track("cta_primary_click", { section })}
        render={trigger}
      />
      <DialogContent className="sm:max-w-lg bg-white shadow-2xl p-0 gap-0 overflow-hidden">
        <div className="overflow-y-auto max-h-[90svh] p-6">
        {/* ── Step 1: Contacto ───────────────────────────────────────── */}
        {step === "contact" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-h3 text-slate-900">
                Agenda una demo
              </DialogTitle>
              <DialogDescription>
                Te mostramos Vivaru en 30 minutos, sin compromiso.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleStep1Submit}
              className="mt-6 flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-nombre">Nombre completo</Label>
                <Input
                  id="demo-nombre"
                  placeholder="María García"
                  value={contact.nombre}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, nombre: e.target.value }))
                  }
                  autoComplete="name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-email">Correo electrónico</Label>
                <Input
                  id="demo-email"
                  type="email"
                  placeholder="maria@miconjunto.com"
                  value={contact.email}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, email: e.target.value }))
                  }
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-telefono">
                  WhatsApp / Teléfono{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  id="demo-telefono"
                  type="tel"
                  placeholder="+52 55 1234 5678"
                  value={contact.telefono}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, telefono: e.target.value }))
                  }
                  autoComplete="tel"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="mt-2 w-full">
                Continuar{" "}
                <span aria-hidden="true" className="ml-0.5">
                  →
                </span>
              </Button>
            </form>
          </>
        )}

        {/* ── Step 2: Perfil ─────────────────────────────────────────── */}
        {step === "profile" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-h3 text-slate-900">
                Cuéntanos sobre tu operación
              </DialogTitle>
              <DialogDescription>
                Paso 2 de 2 — Nos ayuda a preparar la demo correcta para ti.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleStep2Submit}
              className="mt-6 flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-empresa">
                  Nombre del conjunto o empresa
                </Label>
                <Input
                  id="demo-empresa"
                  placeholder="Conjunto Residencial Las Palmas"
                  value={profile.empresa}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, empresa: e.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-cargo">
                  Cargo{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </Label>
                <Input
                  id="demo-cargo"
                  placeholder="Administrador, Gerente, etc."
                  value={profile.cargo}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, cargo: e.target.value }))
                  }
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="demo-conjuntos">Conjuntos administrados</Label>
                  <select
                    id="demo-conjuntos"
                    value={profile.conjuntos}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, conjuntos: e.target.value }))
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      Seleccionar…
                    </option>
                    <option value="1">1 conjunto</option>
                    <option value="2-5">2 a 5</option>
                    <option value="6-15">6 a 15</option>
                    <option value="16+">16 o más</option>
                  </select>
                </div>

                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="demo-unidades">
                    Unidades{" "}
                    <span className="font-normal text-slate-400">(aprox.)</span>
                  </Label>
                  <Input
                    id="demo-unidades"
                    type="number"
                    min={1}
                    max={9999}
                    placeholder="150"
                    value={profile.unidades}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, unidades: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-timeline">
                  ¿Cuándo planeas implementar?
                </Label>
                <select
                  id="demo-timeline"
                  value={profile.timeline}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, timeline: e.target.value }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="" disabled>
                    Seleccionar…
                  </option>
                  <option value="30dias">En los próximos 30 días</option>
                  <option value="trimestre">Este trimestre</option>
                  <option value="anio">Este año</option>
                  <option value="investigando">Solo explorando opciones</option>
                </select>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => {
                    setError(null);
                    setStep("contact");
                  }}
                >
                  <span aria-hidden="true" className="mr-0.5">
                    ←
                  </span>{" "}
                  Atrás
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? "Enviando…" : "Enviar"}
                  {!loading && (
                    <span aria-hidden="true" className="ml-0.5">
                      →
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}

        {/* ── Confirmation ───────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path
                  d="M20 6 9 17l-5-5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <DialogTitle className="font-display text-h3 text-slate-900">
              ¡Listo, {contact.nombre.split(" ")[0]}!
            </DialogTitle>

            <p className="max-w-xs text-sm text-slate-600">
              Nuestro equipo revisará tu solicitud y te contactará a la
              brevedad, normalmente en{" "}
              <strong>menos de 24 horas hábiles</strong>.
            </p>

            <p className="text-xs text-slate-400">
              Enviamos una confirmación a{" "}
              <strong className="text-slate-600">{contact.email}</strong>
            </p>

            <Button
              size="lg"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => handleOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
