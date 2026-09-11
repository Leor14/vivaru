import { describe, expect, it } from "vitest";

import { planearRevocacion } from "../src/resident-access";

/**
 * Revocar el acceso al borrar un residente.
 *
 * Se prueba `planearRevocacion` y no la función que escribe, porque **aquí es
 * donde están las decisiones**: si la cuenta se borra o se conserva, y cuándo hay
 * que negarse. Lo demás es E/S contra Auth y Firestore — y desde `FIX-004` tiene
 * además su propia suite, `fix-004-revocacion.test.ts`, porque el daño de aquel
 * defecto estaba justo en la E/S.
 *
 * El defecto que esto cierra vivió meses sin que nadie lo notara, y no porque
 * faltaran pruebas de borrado: borrar la ficha funcionaba perfectamente. Lo que
 * fallaba era **lo que el borrado NO hacía**. Por eso los casos de abajo están
 * escritos sobre lo que debe sobrevivir, no sobre lo que debe desaparecer.
 */

const SIN_OTRAS: Array<{ tenantId: string; role: string }> = [];

/** Lo normal: la ficha apunta a la cuenta de un residente de este conjunto. */
const DE_AQUI = { cuentaEsResidenteDeEsteConjunto: true };

describe("planearRevocacion · quién se queda sin cuenta y quién no", () => {
  it("la mayoría de residentes no tienen cuenta: no hay nada que revocar", () => {
    const plan = planearRevocacion({ authUid: null, rolEnEsteConjunto: null, membresiasEnOtrosConjuntos: SIN_OTRAS, ...DE_AQUI });
    expect(plan.accion).toBe("sin-cuenta");
  });

  it("una cadena vacía o con espacios NO cuenta como cuenta", () => {
    expect(
      planearRevocacion({ authUid: "   ", rolEnEsteConjunto: null, membresiasEnOtrosConjuntos: SIN_OTRAS, ...DE_AQUI }).accion,
    ).toBe("sin-cuenta");
  });

  it("un residente con cuenta y sin más conjuntos: se le borra la cuenta entera", () => {
    const plan = planearRevocacion({
      authUid: "uid-residente",
      rolEnEsteConjunto: "resident",
      membresiasEnOtrosConjuntos: SIN_OTRAS,
      ...DE_AQUI,
    });
    expect(plan.accion).toBe("revocar-y-borrar");
  });

  // El documento de membresía puede no existir (datos viejos, alta a medias). Eso no
  // es motivo para dejar viva una cuenta QUE ES DE ESTE CONJUNTO. Lo que la hace de
  // este conjunto ya no es que la ficha apunte a ella —el admin podía escribir ese
  // puntero— sino que la propia cuenta lo diga, en `users` o en su claim.
  it("sin documento de membresía, una cuenta de residente de ESTE conjunto se cierra igual", () => {
    expect(
      planearRevocacion({ authUid: "uid-huerfano", rolEnEsteConjunto: null, membresiasEnOtrosConjuntos: SIN_OTRAS, ...DE_AQUI }).accion,
    ).toBe("revocar-y-borrar");
  });
});

describe("planearRevocacion · FIX-004 · una cuenta que NO es de este conjunto no se toca", () => {
  // `D-B`: la ficha apuntaba a la cuenta de otra persona. Hasta el 11 sep 2026 esto
  // salía «revocar-y-borrar» y, si era la del superadmin, se borraba entera.
  it("sin membresía aquí ni en ninguna parte —la del superadmin—: sin-membresia", () => {
    const plan = planearRevocacion({
      authUid: "uid-superadmin",
      rolEnEsteConjunto: null,
      membresiasEnOtrosConjuntos: SIN_OTRAS,
      cuentaEsResidenteDeEsteConjunto: false,
    });
    expect(plan.accion).toBe("sin-membresia");
  });

  it("sin membresía aquí y con membresía en otro: tampoco se le reapunta el claim", () => {
    const plan = planearRevocacion({
      authUid: "uid-admin-b",
      rolEnEsteConjunto: null,
      membresiasEnOtrosConjuntos: [{ tenantId: "conjunto-b", role: "tenant_admin" }],
      cuentaEsResidenteDeEsteConjunto: false,
    });
    expect(plan.accion).toBe("sin-membresia");
  });

  it("el motivo dice que la cuenta no se tocó", () => {
    const plan = planearRevocacion({
      authUid: "uid-ajeno",
      rolEnEsteConjunto: null,
      membresiasEnOtrosConjuntos: SIN_OTRAS,
      cuentaEsResidenteDeEsteConjunto: false,
    });
    expect(plan.motivo).toMatch(/no se tocó/);
  });
});

describe("planearRevocacion · la cuenta que pertenece a más de un conjunto", () => {
  // Este es el caso que el patrón de `deleteOperationalUser` no contemplaba.
  // Borrar la cuenta dejaría a la persona fuera de un conjunto con el que esta
  // operación no tiene nada que ver.
  it("si le queda otro conjunto, la cuenta SOBREVIVE", () => {
    const plan = planearRevocacion({
      authUid: "uid-doble",
      rolEnEsteConjunto: "resident",
      membresiasEnOtrosConjuntos: [{ tenantId: "otro-conjunto", role: "resident" }],
      ...DE_AQUI,
    });
    expect(plan.accion).toBe("revocar-y-conservar");
  });

  it("y el claim se reapunta al conjunto que le queda, no se deja colgando", () => {
    const plan = planearRevocacion({
      authUid: "uid-doble",
      rolEnEsteConjunto: "resident",
      membresiasEnOtrosConjuntos: [{ tenantId: "otro-conjunto", role: "resident" }],
      ...DE_AQUI,
    });
    expect(plan).toMatchObject({ tenantIdRestante: "otro-conjunto", rolRestante: "resident" });
  });

  // Una membresía sin tenantId no identifica ningún conjunto: no puede ser el
  // motivo por el que una cuenta sobreviva. Si valiera, un documento corrupto
  // mantendría vivo un acceso que debía cerrarse — el defecto otra vez.
  it("una membresía sin tenantId no salva la cuenta", () => {
    const plan = planearRevocacion({
      authUid: "uid-basura",
      rolEnEsteConjunto: "resident",
      membresiasEnOtrosConjuntos: [{ tenantId: "", role: "resident" }],
      ...DE_AQUI,
    });
    expect(plan.accion).toBe("revocar-y-borrar");
  });

  it("si le quedan varios, el motivo dice cuántos", () => {
    const plan = planearRevocacion({
      authUid: "uid-triple",
      rolEnEsteConjunto: "resident",
      membresiasEnOtrosConjuntos: [
        { tenantId: "conjunto-b", role: "resident" },
        { tenantId: "conjunto-c", role: "resident" },
      ],
      ...DE_AQUI,
    });
    expect(plan.motivo).toContain("2");
  });
});

describe("planearRevocacion · lo que se niega a hacer", () => {
  // Borrar un residente no puede dejar al conjunto sin administrador porque
  // alguien tenía la ficha de persona y la cuenta de admin atadas al mismo uid.
  it("se niega si la cuenta es de un administrador", () => {
    expect(() =>
      planearRevocacion({ authUid: "uid-admin", rolEnEsteConjunto: "tenant_admin", membresiasEnOtrosConjuntos: SIN_OTRAS, ...DE_AQUI }),
    ).toThrow(/Usuarios operativos/);
  });

  // `admin_tenant` es el alias antiguo que las reglas todavía aceptan
  // (`firestore.rules`, `tenantRole`). Si aquí no se contemplara, el guardrail
  // tendría un agujero exactamente del tamaño de los tenants viejos.
  it("se niega también con el alias antiguo admin_tenant", () => {
    expect(() =>
      planearRevocacion({ authUid: "uid-admin", rolEnEsteConjunto: "admin_tenant", membresiasEnOtrosConjuntos: SIN_OTRAS, ...DE_AQUI }),
    ).toThrow(/Usuarios operativos/);
  });

  it("se niega si la cuenta es de un guarda", () => {
    expect(() =>
      planearRevocacion({
        authUid: "uid-guarda",
        rolEnEsteConjunto: "security_guard",
        membresiasEnOtrosConjuntos: SIN_OTRAS,
        ...DE_AQUI,
      }),
    ).toThrow(/Usuarios operativos/);
  });

  // `FIX-004` R2: quitar acceso solo actúa sobre una membresía de RESIDENTE. Un rol
  // que no está en la lista de operativos —el alias viejo `security`, el `committee`
  // que no concede nadie— no es permiso para borrar: antes pasaba de largo y seguía.
  it("se niega con cualquier otro rol que no sea de residente, aunque no sea operativo", () => {
    for (const rol of ["security", "committee"]) {
      expect(() =>
        planearRevocacion({ authUid: "uid-x", rolEnEsteConjunto: rol, membresiasEnOtrosConjuntos: SIN_OTRAS, ...DE_AQUI }),
      ).toThrow();
    }
  });

  // El rechazo va ANTES de mirar si tiene otros conjuntos: un admin no se
  // gestiona por esta vía ni aunque el plan resultante fuera conservador.
  it("el rechazo del admin manda sobre el caso de varios conjuntos", () => {
    expect(() =>
      planearRevocacion({
        authUid: "uid-admin",
        rolEnEsteConjunto: "tenant_admin",
        membresiasEnOtrosConjuntos: [{ tenantId: "otro", role: "resident" }],
        ...DE_AQUI,
      }),
    ).toThrow();
  });
});
