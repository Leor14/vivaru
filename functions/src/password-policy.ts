import { randomInt } from "crypto";
import { HttpsError } from "firebase-functions/v2/https";

const MIN_LENGTH = 8;

/**
 * Política unificada de contraseñas tecleadas (admins y usuarios operativos).
 * Centraliza la regla que antes vivía dispersa: el form de superadmin exigía
 * complejidad, pero el backend de usuarios operativos solo validaba longitud.
 * Lanza HttpsError("invalid-argument") si no cumple.
 */
export function assertStrongPassword(raw: string, field = "contrasena"): void {
  const value = (raw ?? "").trim();

  if (value.length < MIN_LENGTH) {
    throw new HttpsError("invalid-argument", `La ${field} debe tener al menos ${MIN_LENGTH} caracteres.`);
  }

  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  if (!hasLower || !hasUpper || !hasDigit || !hasSymbol) {
    throw new HttpsError(
      "invalid-argument",
      `La ${field} debe incluir mayuscula, minuscula, numero y simbolo.`,
    );
  }
}

/**
 * Genera una contraseña aleatoria fuerte para cuentas que se activan por enlace
 * (el usuario nunca la conoce: define la suya vía correo de restablecimiento).
 * Garantiza al menos un carácter de cada clase para cumplir la política.
 */
export function generateStrongPassword(length = 20): string {
  const sets = [
    "abcdefghijkmnpqrstuvwxyz", // sin l
    "ABCDEFGHJKLMNPQRSTUVWXYZ", // sin I, O
    "23456789", // sin 0, 1
    "!@#$%^&*-_=+",
  ];
  const all = sets.join("");

  // Un carácter garantizado de cada clase.
  const chars: string[] = sets.map((set) => set[randomInt(set.length)]);

  // Completar el resto desde el conjunto total.
  for (let i = chars.length; i < length; i += 1) {
    chars.push(all[randomInt(all.length)]);
  }

  // Fisher-Yates para no dejar las clases garantizadas siempre al inicio.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
