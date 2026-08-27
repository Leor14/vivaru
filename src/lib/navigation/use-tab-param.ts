"use client";

import { useCallback, useEffect, useState } from "react";

import { escribirTab, leerTab } from "./tab-param";

/**
 * **La pestaña activa, sincronizada con la URL.**
 *
 * Usa la History API y **no `useSearchParams`**, a propósito: en Next 16 una
 * pantalla que llama a `useSearchParams` y se prerenderiza obliga a envolverla
 * en `Suspense`, y aquí quien lee la pestaña es el cuerpo entero de la página —
 * habría que envolver las cuatro páginas completas. Actualizar los parámetros de
 * consulta con `history.pushState` es un patrón que Next soporta expresamente
 * para filtros y ordenaciones, y no toca el árbol de componentes.
 *
 * `pushState` y no `replaceState`: **el botón «atrás» debe volver a la pestaña
 * anterior**, no salir de la pantalla. Es la mitad del valor de esta pasada.
 *
 * El estado arranca en el valor por defecto y la URL se lee **después de
 * hidratar**. Es deliberado: leerla en el primer render daría un desajuste de
 * hidratación cuando la dirección traiga una pestaña distinta de la que pintó el
 * servidor.
 */
export function useTabParam<K extends string>(
  param: string,
  keys: readonly K[],
  fallback: K,
): [K, (valor: K) => void] {
  const [value, setValue] = useState<K>(fallback);

  const leerDeLaUrl = useCallback(
    () => leerTab(window.location.search, param, keys, fallback),
    // `keys` es un literal `as const` en cada pantalla: estable entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [param, fallback],
  );

  useEffect(() => {
    setValue(leerDeLaUrl());
    // `popstate` cubre el botón «atrás» y el «adelante».
    const alNavegar = () => setValue(leerDeLaUrl());
    window.addEventListener("popstate", alNavegar);
    return () => window.removeEventListener("popstate", alNavegar);
  }, [leerDeLaUrl]);

  const set = useCallback(
    (valor: K) => {
      setValue(valor);
      const busqueda = escribirTab(window.location.search, param, valor, fallback);
      window.history.pushState(null, "", `${window.location.pathname}${busqueda}`);
    },
    [param, fallback],
  );

  return [value, set];
}
