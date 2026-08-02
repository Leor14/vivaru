"use client";

import { CountrySelect } from "@/components/ui/country-select";
import { Input } from "@/components/ui/input";
import { countryByCode } from "@/lib/countries";

/**
 * Teléfono con indicativo de país aparte.
 *
 * Antes era un campo de texto libre con «+52 55 0000 0000» de marcador, y eso
 * llega como llegue: unos escriben el indicativo, otros no, otros ponen ceros
 * de tronco. Un asesor que marca un número sin indicativo pierde el contacto.
 * Separando el país, el número siempre sale con prefijo y en un solo formato.
 *
 * El valor que sale hacia arriba es E.164 —«+525500000000»— porque es lo que
 * entiende cualquier marcador y cualquier pasarela de SMS.
 */
export function PhoneField({
  country,
  number,
  onCountryChange,
  onNumberChange,
  placeholder = "55 0000 0000",
  id,
}: {
  country: string;
  number: string;
  onCountryChange: (code: string) => void;
  onNumberChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <div className="mt-1 flex gap-2">
      <CountrySelect
        value={country}
        onChange={onCountryChange}
        variant="dial"
        ariaLabel="Indicativo del país"
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="flex-1"
        value={number}
        // Se aceptan espacios y guiones mientras escribe —corregirle el formato
        // en caliente es de las cosas que más molestan de un formulario—; la
        // normalización ocurre al enviar.
        onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Compone el teléfono en E.164. Devuelve `undefined` si no hay número: un
 * indicativo suelto no es un teléfono, y guardar «+52» sería peor que nada.
 */
export function composePhone(country: string, number: string): string | undefined {
  const digits = number.replace(/\D/g, "");
  if (!digits) return undefined;
  const dial = countryByCode(country)?.dial ?? "";
  // Si pegó el número ya con indicativo, no se duplica.
  const local = dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  if (!local) return undefined;
  return `+${dial}${local}`;
}
