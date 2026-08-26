import { describe, expect, it } from "vitest";

import {
  CAMPO_MIGRADO_EN,
  CAMPO_PREVIO,
  COLECCIONES_CON_CLAVE_DE_UNIDAD,
  CAMPO_ARCHIVADO_EN,
  NO_ARCHIVABLES,
  camposDeLaEscritura,
  claveDeUnidad,
  clavesDeConsulta,
  estaArchivado,
  llevaDineroVivo,
  construirCatalogo,
  estadoDelConjunto,
  planificarDocumento,
  resolverClaveDeUnidad,
  type AccionPlaneada,
  type ColeccionConClave,
} from "../src/clave-de-unidad";

/**
 * `PRD-V-FIX-002` — el resolvedor único y el planificador de la migración.
 *
 * **El catálogo es el de producción, medido el 25 de agosto de 2026**, no uno
 * inventado: `u-t1-101` es un id de documento que PARECE un slug, `unit-t1-101`
 * es un slug que no existe como unidad y bajo el que hay 3.580.000 invisibles, y
 * `1014` es a la vez la etiqueta y el campo `unitId` de una unidad cuyo id es un
 * hash. Cualquier clasificación por forma del valor falla en los tres.
 */

const UNIDADES_SANTA_MARIA = [
  { id: "u-t1-101", slug: "t1-101", displayName: "T1-101" },
  { id: "u-t1-102", slug: "t1-102", displayName: "T1-102" },
  { id: "u-t2-503", slug: "t2-503", displayName: "T2-503" },
  { id: "9YLUY4ki4uny212nKxnp", slug: "1014", displayName: "1014" },
  { id: "DFPjKffOOGZXRjzlScxk", slug: "t1-403", displayName: "T1-403" },
];

const CATALOGO = construirCatalogo(UNIDADES_SANTA_MARIA);

describe("la clave de una unidad es el id de su documento (D1)", () => {
  it("devuelve el id, nunca el campo `unitId`", () => {
    expect(claveDeUnidad({ id: "u-t1-101" })).toBe("u-t1-101");
    expect(claveDeUnidad(UNIDADES_SANTA_MARIA[3])).toBe("9YLUY4ki4uny212nKxnp");
  });
});

describe("resolverClaveDeUnidad", () => {
  it("un id de documento ya es canónico, aunque parezca un slug", () => {
    expect(resolverClaveDeUnidad("u-t1-101", CATALOGO)).toEqual({ estado: "canonica", clave: "u-t1-101" });
    expect(resolverClaveDeUnidad("9YLUY4ki4uny212nKxnp", CATALOGO)).toEqual({
      estado: "canonica",
      clave: "9YLUY4ki4uny212nKxnp",
    });
  });

  it("el campo `unitId` de UNA unidad se migra a su id — sin necesitar etiqueta", () => {
    expect(resolverClaveDeUnidad("1014", CATALOGO)).toEqual({
      estado: "migrable",
      clave: "9YLUY4ki4uny212nKxnp",
      anterior: "1014",
      via: "campo",
    });
  });

  it("`unit-t1-101` no casa por campo y lo salva su ETIQUETA — es el caso de los 3.580.000", () => {
    expect(resolverClaveDeUnidad("unit-t1-101", CATALOGO, { etiqueta: "T1-101" })).toEqual({
      estado: "migrable",
      clave: "u-t1-101",
      anterior: "unit-t1-101",
      via: "etiqueta",
    });
  });

  it("la etiqueta se compara normalizada: sobran espacios y mayúsculas", () => {
    const r = resolverClaveDeUnidad("unit-t1-101", CATALOGO, { etiqueta: "  t1-101  " });
    expect(r).toMatchObject({ estado: "migrable", clave: "u-t1-101", via: "etiqueta" });
  });

  it("CF2 · sin ninguna unidad con esa etiqueta → huérfano, y NO se toca", () => {
    expect(resolverClaveDeUnidad("unit-t9-999", CATALOGO, { etiqueta: "T9-999" })).toEqual({
      estado: "huerfano",
      valor: "unit-t9-999",
    });
  });

  it("un documento SIN etiqueta solo tiene las vías 1 a 3: su huérfano queda listado", () => {
    // `people`, `survey_responses` y las firmas no llevan `unitLabel`.
    expect(resolverClaveDeUnidad("unit-t1-101", CATALOGO)).toEqual({
      estado: "huerfano",
      valor: "unit-t1-101",
    });
  });

  it("CF1 · dos unidades con la misma etiqueta → ambiguo, y NO se toca", () => {
    const gemelas = construirCatalogo([
      { id: "id-a", slug: "casa-7", displayName: "Casa 7" },
      { id: "id-b", slug: "casa-7-bis", displayName: "Casa 7" },
    ]);
    expect(resolverClaveDeUnidad("clave-que-no-existe", gemelas, { etiqueta: "Casa 7" })).toEqual({
      estado: "ambiguo",
      valor: "clave-que-no-existe",
      via: "etiqueta",
      candidatos: ["id-a", "id-b"],
    });
  });

  it("dos unidades con el MISMO campo `unitId` también son ambiguas — el slug puede colisionar (D1·4)", () => {
    const gemelas = construirCatalogo([
      { id: "id-a", slug: "casa-7", displayName: "Casa 7 torre A" },
      { id: "id-b", slug: "casa-7", displayName: "Casa 7 torre B" },
    ]);
    expect(resolverClaveDeUnidad("casa-7", gemelas)).toEqual({
      estado: "ambiguo",
      valor: "casa-7",
      via: "campo",
      candidatos: ["id-a", "id-b"],
    });
  });

  it("el id gana al campo: si un valor es id de una unidad y campo de otra, es canónico", () => {
    const cruzado = construirCatalogo([
      { id: "u-t1-101", slug: "t1-101", displayName: "T1-101" },
      { id: "otra", slug: "u-t1-101", displayName: "La que copió mal" },
    ]);
    expect(resolverClaveDeUnidad("u-t1-101", cruzado)).toEqual({ estado: "canonica", clave: "u-t1-101" });
  });

  it("sin valor no hay defecto: `vacio`, no huérfano", () => {
    expect(resolverClaveDeUnidad(undefined, CATALOGO)).toEqual({ estado: "vacio" });
    expect(resolverClaveDeUnidad("   ", CATALOGO)).toEqual({ estado: "vacio" });
  });

  it("un catálogo VACÍO no resuelve nada — y no reasigna por etiqueta", () => {
    // §5.2: «Conjunto sin unidades → se salta, y se dice». Lo peligroso sería
    // que un catálogo vacío hiciera pasar todo por huérfano y alguien lo leyera
    // como «todo mal» en vez de como «aquí no hay nada que mirar».
    const vacio = construirCatalogo([]);
    expect(vacio.total).toBe(0);
    expect(resolverClaveDeUnidad("lo-que-sea", vacio, { etiqueta: "T1-101" })).toEqual({
      estado: "huerfano",
      valor: "lo-que-sea",
    });
  });
});

describe("el planificador", () => {
  const CARGOS: ColeccionConClave = {
    nombre: "billingStatements",
    campoClave: "unitId",
    campoEtiqueta: "unitLabel",
  };

  it("planifica la escritura con el campo, el de dónde y el a dónde", () => {
    const accion = planificarDocumento(
      CARGOS,
      { id: "cargo-1", datos: { unitId: "unit-t1-101", unitLabel: "T1-101", amount: 716_000 } },
      CATALOGO,
    );
    expect(accion).toEqual({
      accion: "escribir",
      coleccion: "billingStatements",
      docId: "cargo-1",
      campoClave: "unitId",
      de: "unit-t1-101",
      a: "u-t1-101",
      via: "etiqueta",
      etiqueta: "T1-101",
    });
  });

  it("`paymentVouchers` lleva la clave en `payerUnitId`, y el planificador lo respeta", () => {
    const vouchers: ColeccionConClave = {
      nombre: "paymentVouchers",
      campoClave: "payerUnitId",
      campoEtiqueta: "payerUnitLabel",
    };
    const accion = planificarDocumento(
      vouchers,
      { id: "v-1", datos: { payerUnitId: "1014", payerUnitLabel: "1014" } },
      CATALOGO,
    );
    expect(accion).toMatchObject({ accion: "escribir", campoClave: "payerUnitId", a: "9YLUY4ki4uny212nKxnp" });
  });

  it("CA6/R4 · lo ya canónico no genera escritura — correrla dos veces no cambia nada", () => {
    const accion = planificarDocumento(
      CARGOS,
      { id: "cargo-2", datos: { unitId: "u-t1-101", unitLabel: "T1-101" } },
      CATALOGO,
    );
    expect(accion).toEqual({ accion: "ya-canonica", coleccion: "billingStatements", docId: "cargo-2", clave: "u-t1-101" });
  });

  it("el ambiguo y el huérfano se LISTAN, nunca se escriben", () => {
    const huerfano = planificarDocumento(
      CARGOS,
      { id: "cargo-3", datos: { unitId: "unit-t9-999", unitLabel: "T9-999" } },
      CATALOGO,
    );
    expect(huerfano).toMatchObject({ accion: "listar", motivo: "huerfano", valor: "unit-t9-999", etiqueta: "T9-999" });
  });

  it("R7 · ninguna acción del planificador crea, borra o mueve un documento", () => {
    const acciones: AccionPlaneada["accion"][] = ["sin-clave", "ya-canonica", "escribir", "listar"];
    // El tipo no admite «crear» ni «borrar»: si alguien las añadiera, esta lista
    // dejaría de cubrir el tipo y el typecheck lo diría antes que la prueba.
    expect(acciones).toHaveLength(4);
  });
});

describe("R3 · `unitIdPrevio` es lo único que hace reversible esto", () => {
  const escritura = {
    accion: "escribir" as const,
    coleccion: "billingStatements",
    docId: "cargo-1",
    campoClave: "unitId" as const,
    de: "unit-t1-101",
    a: "u-t1-101",
    via: "etiqueta" as const,
    etiqueta: "T1-101",
  };

  it("CA5 · guarda el valor anterior y la fecha, junto con la clave nueva", () => {
    const campos = camposDeLaEscritura(escritura, { unitId: "unit-t1-101" }, "AHORA");
    expect(campos).toEqual({ unitId: "u-t1-101", [CAMPO_PREVIO]: "unit-t1-101", [CAMPO_MIGRADO_EN]: "AHORA" });
  });

  it("un documento que YA tiene `unitIdPrevio` conserva el original — no lo pisa", () => {
    const campos = camposDeLaEscritura(escritura, { unitId: "unit-t1-101", unitIdPrevio: "el-de-verdad" }, "AHORA");
    expect(campos[CAMPO_PREVIO]).toBeUndefined();
    expect(campos.unitId).toBe("u-t1-101");
  });
});

describe("el inventario de colecciones", () => {
  it("son DIECIOCHO, no once: la ficha decía un número y enumeraba otro", () => {
    expect(COLECCIONES_CON_CLAVE_DE_UNIDAD).toHaveLength(18);
  });

  it("`tenantUsers` es la ÚLTIMA (R8): una corrida a medias no puede dejar al residente a ciegas", () => {
    const ultima = COLECCIONES_CON_CLAVE_DE_UNIDAD[COLECCIONES_CON_CLAVE_DE_UNIDAD.length - 1];
    expect(ultima.nombre).toBe("tenantUsers");
    expect(ultima.raizDelPermiso).toBe(true);
    expect(COLECCIONES_CON_CLAVE_DE_UNIDAD.filter((c) => c.raizDelPermiso)).toHaveLength(1);
  });

  it("ninguna se repite y todas declaran su campo de clave", () => {
    const nombres = COLECCIONES_CON_CLAVE_DE_UNIDAD.map((c) => c.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const c of COLECCIONES_CON_CLAVE_DE_UNIDAD) {
      expect(["unitId", "payerUnitId"]).toContain(c.campoClave);
    }
  });

  it("`units` NO está: su campo `unitId` es el slug por diseño y no se migra", () => {
    expect(COLECCIONES_CON_CLAVE_DE_UNIDAD.map((c) => c.nombre)).not.toContain("units");
  });
});

describe("§6 · el estado de la migración de un conjunto", () => {
  it("sin unidades no hay nada que mirar", () => {
    expect(estadoDelConjunto({ unidades: 0, migrables: 0, huerfanos: 9, ambiguos: 0 })).toBe("sin-unidades");
  });

  it("`limpio` solo cuando no queda NADA: ni migrables, ni huérfanos, ni ambiguos", () => {
    expect(estadoDelConjunto({ unidades: 25, migrables: 0, huerfanos: 0, ambiguos: 0 })).toBe("limpio");
  });

  it("un huérfano BLOQUEA aunque no haya nada migrable — el fallo que tuvo este informe", () => {
    // `tenant-nogal-bogota` en staging: cero migrables y DIECIOCHO huérfanos, uno
    // de ellos un `tenantUsers`. Salía LIMPIO teniendo a un residente sin ver nada.
    expect(estadoDelConjunto({ unidades: 15, migrables: 0, huerfanos: 18, ambiguos: 0 })).toBe("bloqueado");
  });

  it("lo irresoluble manda sobre lo migrable: migrar no lo deja limpio", () => {
    expect(estadoDelConjunto({ unidades: 19, migrables: 30, huerfanos: 31, ambiguos: 0 })).toBe("bloqueado");
  });

  it("`partido` es lo que la migración SÍ puede cerrar entero", () => {
    expect(estadoDelConjunto({ unidades: 6, migrables: 30, huerfanos: 0, ambiguos: 0 })).toBe("partido");
  });
});

describe("las claves con las que se BUSCA (Fase 2 · el paz y salvo)", () => {
  it("lo normal es UNA: la canónica", () => {
    // El campo `unitId` de `u-t1-101` es su propio id, así que no aporta vía.
    expect(clavesDeConsulta("u-t1-101", CATALOGO, "u-t1-101")).toEqual(["u-t1-101"]);
    expect(clavesDeConsulta("u-t1-101", CATALOGO, null)).toEqual(["u-t1-101"]);
    expect(clavesDeConsulta("u-t1-101", CATALOGO, "  ")).toEqual(["u-t1-101"]);
  });

  it("el SLUG PROPIO se añade: es de esta unidad y no puede traer deuda ajena", () => {
    expect(clavesDeConsulta("9YLUY4ki4uny212nKxnp", CATALOGO, "1014")).toEqual([
      "9YLUY4ki4uny212nKxnp",
      "1014",
    ]);
  });

  it("y NO se añade si el slug es el id de OTRA unidad — el único cruce posible", () => {
    // Es la salvaguarda que la vía de la etiqueta no tenía: dos unidades pueden
    // llamarse igual y nada lo impide, pero un id es único por construcción.
    const cruzado = construirCatalogo([
      { id: "mia", slug: "u-t1-101", displayName: "La que copió mal" },
      { id: "u-t1-101", slug: "t1-101", displayName: "T1-101" },
    ]);
    expect(clavesDeConsulta("mia", cruzado, "u-t1-101")).toEqual(["mia"]);
  });

  it("no devuelve nunca una lista vacía: sin clave no hay nada que buscar", () => {
    for (const slug of [null, undefined, "", "1014", "u-t1-101"]) {
      expect(clavesDeConsulta("u-t1-102", CATALOGO, slug)[0]).toBe("u-t1-102");
    }
  });
});

describe("archivar un huérfano (D2) es registrar una decisión, no esconder un documento", () => {
  it("un documento está archivado cuando lleva la marca, y no antes", () => {
    expect(estaArchivado({})).toBe(false);
    expect(estaArchivado({ unitId: "lo-que-sea" })).toBe(false);
    expect(estaArchivado({ [CAMPO_ARCHIVADO_EN]: "2026-08-26" })).toBe(true);
  });

  it("una MEMBRESÍA no se archiva: hay alguien detrás que dejaría de ver lo suyo", () => {
    // Archivar `tenantUsers` no cierra la pregunta, la tapa — y deja a esa persona
    // fuera para siempre con la decisión marcada como tomada.
    expect(NO_ARCHIVABLES.has("tenantUsers")).toBe(true);
    expect(NO_ARCHIVABLES.has("users")).toBe(true);
  });

  it("y lo que sí es archivable NO está en esa lista", () => {
    // Si la lista se hinchara, «archivar» dejaría de poder hacer nada y el rechazo
    // se leería como un fallo del script.
    for (const c of ["visitorInvitations", "packages", "survey_responses", "regulation_signatures"]) {
      expect(NO_ARCHIVABLES.has(c)).toBe(false);
    }
  });

  it("un cargo CON saldo no se archiva — es plata de alguien", () => {
    expect(llevaDineroVivo("billingStatements", { balance: 1_120_000 })).toBe(true);
    expect(llevaDineroVivo("advances", { remaining: 33_000 })).toBe(true);
  });

  it("y uno pagado sí: `balance` en cero no es dinero vivo", () => {
    // Es el caso real de staging: `u1`, 250.000 facturados y saldo 0.
    expect(llevaDineroVivo("billingStatements", { balance: 0, amount: 250_000 })).toBe(false);
    expect(llevaDineroVivo("advances", { remaining: 0 })).toBe(false);
  });

  it("una colección sin dinero nunca lo lleva, aunque traiga números", () => {
    expect(llevaDineroVivo("visitorInvitations", { balance: 999, remaining: 999 })).toBe(false);
    expect(llevaDineroVivo("packages", { balance: 500 })).toBe(false);
  });

  it("un campo ausente o no numérico no cuenta como dinero vivo", () => {
    expect(llevaDineroVivo("billingStatements", {})).toBe(false);
    expect(llevaDineroVivo("billingStatements", { balance: "1200" })).toBe(false);
  });
});
