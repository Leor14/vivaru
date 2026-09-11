// tests/rol-consejo-portal.test.ts
// `PRD-V-PLAT-004` entrega 2 — el consejero entra por el portal del RESIDENTE.
//
// La marca de consejo es un atributo de la membresía de residente (`RN-01`), no un rol.
// Hasta la entrega 1 el front solo conocía el rol `committee` —que no tenía nadie y abría
// `/admin/documents`— y **no leía la marca en ningún sitio**: un consejero nombrado no tenía
// una sola pantalla desde la que abrir o firmar un informe. `TBD-B` (David, 11 sep 2026):
// entra por `/resident`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { RUTA_DE_INFORMES_DEL_CONSEJO as RUTA, veLasPantallasDelConsejo } from "@/lib/auth/consejo";
import { canAccessPath, routeByRole } from "@/lib/auth/routing";
import { firmantes } from "@/features/finanzas/informe-mensual-texto";
import { resolvePageIdentity } from "@/lib/navigation/page-identity";
import { buildRoleSidebarGroups } from "@/lib/navigation/role-sidebar-groups";

const hrefs = (grupos: ReturnType<typeof buildRoleSidebarGroups>) =>
  grupos.flatMap((g) => g.items.map((i) => i.href));

describe("quién ve las pantallas del consejo", () => {
  const residente = { role: "resident" as const };

  it("un residente con la marca y la bandera encendida, sí", () => {
    expect(veLasPantallasDelConsejo({ ...residente, isCommittee: true }, true)).toBe(true);
  });

  it("sin la marca, no — aunque la bandera esté encendida", () => {
    expect(veLasPantallasDelConsejo({ ...residente, isCommittee: false }, true)).toBe(false);
  });

  it("la marca ausente es «sin marca»: así están casi todas las membresías", () => {
    expect(veLasPantallasDelConsejo(residente, true)).toBe(false);
  });

  it("con la bandera apagada, no — aunque tenga la marca", () => {
    expect(veLasPantallasDelConsejo({ ...residente, isCommittee: true }, false)).toBe(false);
  });

  it("un administrador con la marca escrita, no: su portal es otro y ya ve más", () => {
    expect(veLasPantallasDelConsejo({ role: "tenant_admin", isCommittee: true }, true)).toBe(false);
  });

  it("la portería tampoco (`RN-03`)", () => {
    expect(veLasPantallasDelConsejo({ role: "security_guard", isCommittee: true }, true)).toBe(false);
  });

  it("sin sesión, no", () => {
    expect(veLasPantallasDelConsejo(null, true)).toBe(false);
  });
});

describe("el menú del residente", () => {
  it("con la marca gana «Informes del conjunto», y la cabecera la nombra así (`CA1`)", () => {
    const grupos = buildRoleSidebarGroups("resident", undefined, false, true);
    expect(hrefs(grupos)).toContain(RUTA);
    expect(resolvePageIdentity(RUTA, grupos)).toEqual({ title: "Informes del conjunto" });
  });

  it("sin la marca la pierde y conserva todo lo de residente (`CA5`)", () => {
    const con = hrefs(buildRoleSidebarGroups("resident", undefined, false, true));
    const sin = hrefs(buildRoleSidebarGroups("resident", undefined, false, false));
    expect(sin).not.toContain(RUTA);
    expect(con.filter((h) => h !== RUTA)).toEqual(sin);
    expect(sin).toContain("/resident/account");
  });

  it("sin decir nada, no la ve: por defecto no hay consejo", () => {
    expect(hrefs(buildRoleSidebarGroups("resident"))).not.toContain(RUTA);
  });

  it("en un conjunto en prueba no aparece: es un módulo de firma, como el reglamento", () => {
    expect(hrefs(buildRoleSidebarGroups("resident", undefined, true, true))).not.toContain(RUTA);
  });
});

describe("las rutas", () => {
  it("la pantalla del consejo es del portal del residente", () => {
    expect(canAccessPath("resident", RUTA)).toBe(true);
  });

  it("y un residente no entra a `/admin`, tampoco a `documents`, la vieja puerta del rol `committee`", () => {
    expect(canAccessPath("resident", "/admin/documents")).toBe(false);
  });

  it("el residente aterriza en su portal", () => {
    expect(routeByRole("resident")).toBe("/resident");
  });
});

describe("las firmas se leen con su cargo (`CA3`)", () => {
  it("la del consejo dice que es del consejo", () => {
    const informe = {
      signatures: [
        { uid: "a", name: "Ana Pérez", role: "Administración" },
        { uid: "c", name: "Carmen García", role: "Consejo de administración" },
      ],
    };
    expect(firmantes(informe)).toBe("Ana Pérez (Administración), Carmen García (Consejo de administración)");
  });

  it("sin cargo escrito, el nombre solo; sin firmas, nada", () => {
    expect(firmantes({ signatures: [{ uid: "a", name: "Ana Pérez", role: "" }] })).toBe("Ana Pérez");
    expect(firmantes({})).toBe("");
  });
});

describe("la pantalla pregunta por los informes que el consejo PUEDE leer", () => {
  // La regla le concede al consejo solo los informes que no están en `borrador`, y Firestore
  // evalúa la consulta contra la regla SIN ejecutarla: `watchMonthlyReports` no nombra el
  // estado, así que al consejo se la rechazaría entera y la pantalla solo diría «error».
  const sinComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const codigo = sinComentarios(
    readFileSync(resolve(process.cwd(), "src/app/(resident)/resident/informes/page.tsx"), "utf8"),
  );

  it("usa `watchInformesEmitidos`", () => {
    expect(codigo).toMatch(/watchInformesEmitidos\(/);
  });

  it("y no `watchMonthlyReports`", () => {
    expect(codigo).not.toMatch(/watchMonthlyReports\b/);
  });

  it("y no pregunta sin la marca: la puerta va antes de la consulta", () => {
    expect(codigo).toMatch(/veLasPantallasDelConsejo\(/);
  });

  it("y no abre el PDF: no consulta `documents` (con `K2` cerrado, el PDF lleva la cartera por unidad)", () => {
    expect(codigo).not.toMatch(/["']documents["']/);
    expect(codigo).not.toMatch(/informe_mensual/);
  });
});
