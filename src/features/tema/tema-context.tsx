"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { updateUserProfile } from "@/features/users/profile-service";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import {
  aplicarTema,
  escribirEspejo,
  temaEfectivo,
  type Tema,
} from "@/lib/ui/tema";

/**
 * El tema en ejecucion: lee el campo del usuario, lo aplica y guarda el espejo.
 *
 * `PRD-V-FEAT-007` entrega 3. El dato canonico vive en `users/{uid}.tema` y lo
 * trae `AuthProvider`, que YA lee ese documento: aqui no se añade ni una
 * lectura. El espejo de `localStorage` solo existe para el primer fotograma —si
 * discrepa del documento, gana el documento y el espejo se reescribe.
 */
interface TemaContextValue {
  /** Lo que se esta pintando ahora mismo. */
  tema: Tema;
  /** `false` con la bandera apagada: no hay interruptor que pintar. */
  disponible: boolean;
  /** `true` mientras la escritura viaja. */
  guardando: boolean;
  cambiarTema: (tema: Tema) => Promise<void>;
}

const TemaContext = createContext<TemaContextValue | null>(null);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const disponible = useFeatureFlag("producto-modo-oscuro");
  const [optimista, setOptimista] = useState<Tema | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Con la bandera APAGADA no se lee el campo: quien ya tuviera `tema: "oscuro"`
  // guardado ve claro. Es `RN-11`, y el criterio que prueba que la bandera
  // gobierna algo y no es un boton (`CA2`).
  const delDocumento: Tema = temaEfectivo({ banderaEncendida: disponible, temaDelUsuario: user?.tema });
  const tema = optimista ?? delDocumento;

  // Si el documento cambia (otra pestaña, otro dispositivo, recarga), manda el.
  const ultimoDelDocumento = useRef(delDocumento);
  useEffect(() => {
    if (ultimoDelDocumento.current !== delDocumento) {
      ultimoDelDocumento.current = delDocumento;
      setOptimista(null);
    }
  }, [delDocumento]);

  useEffect(() => {
    aplicarTema(tema);
    // El espejo solo se escribe con sesion: sin ella no hay tema de nadie que
    // recordar, y la pantalla de acceso no debe delatar al ultimo usuario.
    if (user) escribirEspejo(tema);
  }, [tema, user]);

  const cambiarTema = useCallback(
    async (siguiente: Tema) => {
      if (!user || !disponible || siguiente === tema) return;
      const anterior = tema;
      setOptimista(siguiente); // la interfaz cambia en el acto (CA1)
      setGuardando(true);
      try {
        await updateUserProfile(user.uid, { tema: siguiente });
        ultimoDelDocumento.current = siguiente;
      } catch (error) {
        // Se revierte y NO se guarda el espejo: un espejo que no corresponde al
        // documento es peor que no tener espejo.
        setOptimista(anterior === delDocumento ? null : anterior);
        throw error;
      } finally {
        setGuardando(false);
      }
    },
    [user, disponible, tema, delDocumento],
  );

  const value = useMemo<TemaContextValue>(
    () => ({ tema, disponible, guardando, cambiarTema }),
    [tema, disponible, guardando, cambiarTema],
  );

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaContextValue {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema debe usarse dentro de TemaProvider");
  return ctx;
}
