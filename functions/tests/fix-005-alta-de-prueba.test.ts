import fs from "node:fs";
import path from "node:path";

import { HttpsError } from "firebase-functions/v2/https";
import { describe, expect, it, vi } from "vitest";

import { claveDeLimite, decidirIntento } from "../src/limites-de-intentos";
import { esAmbienteDePrueba } from "../src/trial-modules";
import {
  MENSAJE_ALTA_NO_DISPONIBLE,
  RESPUESTA_DEL_ALTA,
  atenderAltaDePrueba,
  type DependenciasDelAlta,
} from "../src/trial-workspace";

/**
 * `PRD-V-FIX-005` · H1 — las puertas públicas no delatan cuentas.
 *
 * `CF1`: el alta de prueba respondía «Ya existe una cuenta con ese correo» a cualquiera, sin
 * sesión, sin límite y sin App Check: bastaba con probar correos. Ahora responde lo mismo
 * exista o no la cuenta, y al dueño le llega un correo.
 * `CF2`: los intentos tienen límite, y el límite se mira ANTES que la cuenta, para que el
 * rechazo tampoco diga nada.
 * `CF4` (R2, opción A de David): en una prueba se puede dar de alta al portero real, pero el
 * alta de usuarios operativos tiene tope, contado antes de buscar el correo.
 */

const HORA = 60 * 60 * 1000;

describe("FIX-005 · el contador de intentos", () => {
  it("el primer intento pasa y abre la ventana", () => {
    expect(decidirIntento(undefined, 5, HORA, 1_000)).toEqual({
      permitido: true,
      siguiente: { conteo: 1, reiniciaEn: 1_000 + HORA },
    });
  });

  it("pasa hasta el máximo, y el siguiente se rechaza sin sumar", () => {
    const quinto = decidirIntento({ conteo: 4, reiniciaEn: 9_999_999 }, 5, HORA, 2_000);
    expect(quinto).toEqual({ permitido: true, siguiente: { conteo: 5, reiniciaEn: 9_999_999 } });
    const sexto = decidirIntento({ conteo: 5, reiniciaEn: 9_999_999 }, 5, HORA, 3_000);
    expect(sexto).toEqual({ permitido: false, siguiente: { conteo: 5, reiniciaEn: 9_999_999 } });
  });

  it("pasada la ventana, vuelve a empezar", () => {
    expect(decidirIntento({ conteo: 5, reiniciaEn: 5_000 }, 5, HORA, 5_000)).toEqual({
      permitido: true,
      siguiente: { conteo: 1, reiniciaEn: 5_000 + HORA },
    });
  });

  it("la clave se guarda con hash: el correo no queda en claro", () => {
    const clave = claveDeLimite("alta-de-prueba:correo:ana@ejemplo.test");
    expect(clave).toMatch(/^[0-9a-f]{64}$/);
    expect(clave).not.toContain("ana");
  });
});

describe("FIX-005 · qué es un ambiente de prueba", () => {
  it("trial y expired lo son; un cliente, un suspendido o un estado ausente, no", () => {
    expect(esAmbienteDePrueba("trial")).toBe(true);
    expect(esAmbienteDePrueba("expired")).toBe(true);
    expect(esAmbienteDePrueba("active")).toBe(false);
    expect(esAmbienteDePrueba("suspended")).toBe(false);
    expect(esAmbienteDePrueba(undefined)).toBe(false);
  });
});

const ALTA = { nombre: "Ana", email: "  Ana@Ejemplo.TEST ", conjunto: "Torres del Parque", ciudad: "Bogotá" };

function dependencias(opciones: { existe?: boolean; limite?: boolean; carrera?: boolean } = {}) {
  const deps = {
    consumirIntento: vi.fn(async () => opciones.limite !== false),
    cuentaConEseCorreo: vi.fn(async () => (opciones.existe ? { tenantId: "tenant-de-ana" } : null)),
    crearAmbiente: vi.fn(async () => {
      if (opciones.carrera) throw new HttpsError("already-exists", "ya existía");
      return { tenantId: "t-nuevo", adminUid: "uid-ana", trialEndsAt: "2026-09-27", demoAccounts: [], seeded: {} };
    }),
    alCrear: vi.fn(async () => undefined),
    avisarQueYaTieneCuenta: vi.fn(async () => undefined),
  };
  return deps satisfies DependenciasDelAlta;
}

describe("FIX-005 · CF1 · el alta responde lo mismo exista o no la cuenta", () => {
  it("correo nuevo: crea el ambiente y manda la activación", async () => {
    const deps = dependencias();
    await expect(atenderAltaDePrueba(ALTA, deps)).resolves.toEqual(RESPUESTA_DEL_ALTA);
    expect(deps.crearAmbiente).toHaveBeenCalledOnce();
    expect(deps.alCrear).toHaveBeenCalledOnce();
    expect(deps.avisarQueYaTieneCuenta).not.toHaveBeenCalled();
  });

  it("correo con cuenta: la MISMA respuesta, nada creado, y al dueño le llega el aviso", async () => {
    const deps = dependencias({ existe: true });
    await expect(atenderAltaDePrueba(ALTA, deps)).resolves.toEqual(RESPUESTA_DEL_ALTA);
    expect(deps.crearAmbiente).not.toHaveBeenCalled();
    expect(deps.alCrear).not.toHaveBeenCalled();
    // Al conjunto de ESA cuenta, para que la puerta de buzones actúe como con cualquier otro correo.
    expect(deps.avisarQueYaTieneCuenta).toHaveBeenCalledWith("ana@ejemplo.test", "tenant-de-ana");
  });

  it("si otra alta con el mismo correo gana la carrera, la respuesta sigue siendo la misma", async () => {
    const deps = dependencias({ carrera: true });
    await expect(atenderAltaDePrueba(ALTA, deps)).resolves.toEqual(RESPUESTA_DEL_ALTA);
    expect(deps.avisarQueYaTieneCuenta).toHaveBeenCalledOnce();
  });
});

describe("FIX-005 · CF2 · el límite, antes de mirar la cuenta", () => {
  it("agotado el límite, se rechaza SIN preguntar si la cuenta existe", async () => {
    const deps = dependencias({ limite: false, existe: true });
    await expect(atenderAltaDePrueba(ALTA, deps)).rejects.toMatchObject({
      code: "resource-exhausted",
      message: MENSAJE_ALTA_NO_DISPONIBLE,
    });
    expect(deps.cuentaConEseCorreo).not.toHaveBeenCalled();
    expect(deps.crearAmbiente).not.toHaveBeenCalled();
  });

  it("el correo cuenta con la dirección normalizada, no con lo que se tecleó", async () => {
    const deps = dependencias();
    await atenderAltaDePrueba(ALTA, deps);
    expect(deps.consumirIntento).toHaveBeenCalledWith("alta-de-prueba:correo:ana@ejemplo.test", 5, HORA);
  });
});

// El cableado: que las dos callables usen lo de arriba, y en el orden que importa.
const INDEX = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const cuerpoDe = (nombre: string) => {
  const inicio = INDEX.indexOf(`export const ${nombre} = onCall`);
  expect(inicio).toBeGreaterThan(-1);
  const fin = INDEX.indexOf("\nexport const ", inicio + 1);
  return INDEX.slice(inicio, fin === -1 ? undefined : fin);
};

describe("FIX-005 · el cableado de las dos callables", () => {
  it("createTrialWorkspace atiende el alta con atenderAltaDePrueba", () => {
    expect(cuerpoDe("createTrialWorkspace")).toContain("atenderAltaDePrueba(");
  });

  it("CF4 · createTenantOperationalUser cuenta el intento de una prueba ANTES de buscar el correo", () => {
    const cuerpo = cuerpoDe("createTenantOperationalUser");
    const prueba = cuerpo.indexOf("esAmbienteDePrueba(");
    const intento = cuerpo.indexOf("consumirIntento(");
    const busqueda = cuerpo.indexOf("getUserByEmail(");
    expect(prueba).toBeGreaterThan(-1);
    expect(intento).toBeGreaterThan(prueba);
    expect(busqueda).toBeGreaterThan(intento);
  });
});
