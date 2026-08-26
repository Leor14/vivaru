"use client";

import { Building2 } from "lucide-react";

import { useAuth } from "@/features/auth/auth-context";

/**
 * Dice EN QUÉ CONJUNTO va a caer lo que se está a punto de confirmar.
 *
 * **Por qué existe, y por qué va aquí y no en una banda permanente.** Con el
 * selector de `PLAT-002`, una misma persona opera varios conjuntos sin cerrar
 * sesión, y el riesgo que eso introduce no es de permisos —la membresía manda
 * en el servidor— sino de **hacer lo correcto en el conjunto equivocado**.
 *
 * La solución fácil sería una banda fija diciendo dónde estás. **No se hace, y
 * la razón está escrita en `CLAUDE.md`: «si se avisa siempre, se deja de leer».**
 * Estar en un conjunto no es un estado anómalo; convertirlo en advertencia
 * permanente lo vuelve papel pintado en dos días.
 *
 * Así que el recordatorio va **donde el acto es irreversible**, no donde es
 * gratis: cambiar de conjunto se deshace con un clic; un reparto de seis cargos
 * o un pago aplicado, no. El selector previene el error y esto lo caza.
 *
 * **Solo se pinta si la persona tiene más de una membresía.** Para quien lleva
 * un solo conjunto es una línea que no informa de nada, y añadirla a todos los
 * diálogos sería exactamente el ruido que este componente evita.
 */
export function ConjuntoActivoNota({ accion }: { accion: string }) {
  const { user } = useAuth();

  if ((user?.memberships?.length ?? 0) < 2) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-[var(--slate-600)]">
      <Building2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--slate-500)]" />
      <span>
        {accion} en{" "}
        {/* El nombre va SIN truncar y en negrita: dos conjuntos que empiezan
            igual —«Torres del Parque I» y «II»— se ven idénticos recortados, y
            es justo el caso que esto tiene que distinguir. */}
        <span className="font-semibold text-[var(--slate-900)]">{user?.tenantName ?? "este conjunto"}</span>
      </span>
    </p>
  );
}
