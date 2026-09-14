import { describe, expect, it } from "vitest";

import { aWinAnsi, documentoEstructurado, fueraDeWinAnsi } from "../scripts/historias/archivos.mjs";
import sharp from "sharp";

import {
  TIPOS_DE_AREA,
  cartel,
  comprobanteDeTransferencia,
  fotoDeObra,
  logoDelConjunto,
  planoDelFraccionamiento,
  portadaDeServicio,
} from "../scripts/historias/ilustraciones.mjs";
import {
  AREAS,
  CASAS_POR_SECCION,
  CUOTA_MENSUAL_TOTAL,
  EGRESOS_RECURRENTES,
  PRESUPUESTO_2026,
  PROVEEDORES,
  SECCIONES,
  construirHistoria,
  construirPadron,
} from "../scripts/historias/lomas-de-sayilbedra.mjs";
import {
  SESIONES_DEL_CONSEJO,
  actaDeAsamblea,
  actaDelConsejo,
  adjuntosDeComunicados,
  archivoMensualAl,
  carteraAl,
  contratoDeServicio,
  convocatoriaDeAsamblea,
  hojaDeTarifas,
  memoriaDeObra,
  planoGeneral,
  polizaDeSeguro,
  reglamentoCompleto,
  relacionDeMovimientos,
} from "../scripts/historias/lomas-documentos.mjs";
import { ACUERDOS, COMUNICADOS, REGLAMENTO, SERVICIOS } from "../scripts/historias/lomas-operacion.mjs";

/**
 * **El maquetador de documentos de la semilla** (docs/plan-documentos-demo-lomas.md, T1.1).
 *
 * No hay en el repositorio con qué leer el texto de un PDF, así que la marca se comprueba con lo que
 * el maquetador devuelve —páginas y marcas pintadas— y el resto, mirando el PDF generado.
 */

describe("el texto que el PDF sabe pintar (WinAnsi)", () => {
  it("cambia lo que tiene equivalente y deja lo que ya se pinta bien", () => {
    expect(aWinAnsi("−5 ≤ 10 → m³ · «ñandú» … € “sí”")).toBe("-5 <= 10 -> m³ · «ñandú» … € “sí”");
    expect(fueraDeWinAnsi("m³ · ñ … € “x” — Artículo 12.")).toEqual([]);
  });

  it("falla con lo que no sabe pintar, y dice cuál es", () => {
    expect(fueraDeWinAnsi("infinito ∞ y check ✓")).toEqual(["∞", "✓"]);
    expect(() => aWinAnsi("infinito ∞")).toThrow(/U\+221E/);
  });
});

describe("el maquetador de documentos", () => {
  it("pone la marca y el número de página en TODAS las páginas de un documento largo", async () => {
    const bloques = Array.from({ length: 60 }, (_, i) => ({
      tipo: "articulo",
      numero: `Artículo ${i + 1}.`,
      texto: "Texto del artículo para llenar la página. ".repeat(12),
    }));
    const { buffer, paginas, marcas } = await documentoEstructurado({ titulo: "Reglamento de prueba", encabezado: "Prueba", bloques });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(paginas).toBeGreaterThan(3);
    expect(marcas).toBe(paginas);
  });

  it("una tabla que no cabe cruza de página sin reventar", async () => {
    const filas = Array.from({ length: 120 }, (_, i) => [`2026-06-${String((i % 28) + 1).padStart(2, "0")}`, `Movimiento ${i}`, "$1,234.56"]);
    const { paginas, marcas } = await documentoEstructurado({
      titulo: "Estado de cuenta de prueba",
      bloques: [{ tipo: "tabla", columnas: ["Fecha", "Concepto", "Importe"], filas, anchos: [1, 3, 1], alinear: ["left", "left", "right"] }],
    });
    expect(paginas).toBeGreaterThan(2);
    expect(marcas).toBe(paginas);
  });

  it("los demás bloques caben en un documento corto de una página", async () => {
    const { paginas } = await documentoEstructurado({
      titulo: "Acta de prueba",
      subtitulo: "Sesión ordinaria",
      bloques: [
        { tipo: "capitulo", texto: "Orden del día" },
        { tipo: "lista", items: ["Lista de asistencia", "Lectura del acta anterior"] },
        { tipo: "parrafo", texto: "Se aprueba por unanimidad." },
        { tipo: "firmas", firmantes: [{ nombre: "Ana Pérez", cargo: "Presidenta" }, { nombre: "Luis Soto", cargo: "Secretario" }] },
      ],
    });
    expect(paginas).toBe(1);
  });

  it("un bloque desconocido falla en vez de desaparecer", async () => {
    await expect(documentoEstructurado({ titulo: "x", bloques: [{ tipo: "otro" }] })).rejects.toThrow(/desconocido/);
  });

  it("un carácter que no se pinta falla antes de escribir el documento", async () => {
    await expect(documentoEstructurado({ titulo: "x", bloques: [{ tipo: "parrafo", texto: "vale ∞" }] })).rejects.toThrow(/U\+221E/);
  });
});

describe("el reglamento completo (A1)", () => {
  const doc = reglamentoCompleto(construirPadron("conjunto-de-prueba"));
  type Bloque = { tipo: string; numero?: string; texto?: string; firmantes?: { nombre: string }[] };
  const bloques = doc.bloques as Bloque[];
  const articulos = bloques.filter((b) => b.tipo === "articulo" && b.numero?.startsWith("Artículo"));

  it("conserva palabra por palabra, en su número, los artículos que ya cita el guion", () => {
    for (const p of REGLAMENTO.parrafos) {
      const [, n, texto] = /^Artículo (\d+)\. (.*)$/.exec(p) ?? [];
      expect(articulos.find((b) => b.numero === `Artículo ${n}.`)?.texto).toBe(texto);
    }
  });

  it("numera seguido, sin huecos ni repetidos", () => {
    const numeros = articulos.map((b) => Number(/\d+/.exec(b.numero ?? "")?.[0]));
    expect(numeros).toEqual(numeros.map((_, i) => i + 1));
  });

  it("trae las reglas de cada área, sacadas de su política", () => {
    const texto = articulos.map((b) => b.texto).join("\n");
    for (const a of AREAS) {
      expect(texto).toContain(`${a.name}:`);
      expect(texto).toContain(`de ${a.operatingHoursStart} a ${a.operatingHoursEnd} horas`);
    }
  });

  it("lo firman los dos consejeros con marca del padrón", () => {
    const firmas = bloques.find((b) => b.tipo === "firmas")?.firmantes?.map((f) => f.nombre);
    const consejo = construirPadron("conjunto-de-prueba").cuentas.filter((c: { consejo?: boolean }) => c.consejo).map((c: { fullName: string }) => c.fullName);
    expect(firmas).toEqual(consejo.slice(0, 2));
  });

  it("se pinta sin un solo carácter fuera de WinAnsi", async () => {
    const { paginas, marcas } = await documentoEstructurado(doc);
    expect(paginas).toBeGreaterThan(3);
    expect(marcas).toBe(paginas);
  });
});

describe("las actas del consejo (A2)", () => {
  const padron = construirPadron("conjunto-de-prueba");
  type Bloque = { tipo: string; numero?: string; texto?: string; firmantes?: { nombre: string }[] };
  const bloquesDe = (dia: string) => actaDelConsejo(padron, dia).bloques as Bloque[];
  const sesiones = [...new Set(ACUERDOS.map((a) => a.sesion))];

  it("hay guion para cada sesión con acuerdos, y para ninguna otra", () => {
    expect(Object.keys(SESIONES_DEL_CONSEJO).sort()).toEqual([...sesiones].sort());
  });

  it("cada acuerdo va palabra por palabra en el acta de su sesión, con su número del año", () => {
    ACUERDOS.forEach((a, i) => {
      expect(bloquesDe(a.sesion).find((b) => b.numero === `Acuerdo ${i + 1} de 2026.`)?.texto).toBe(a.detalle);
    });
  });

  it("un acta trae los acuerdos de su sesión y ninguno de otra", () => {
    for (const dia of sesiones) {
      const suyos = bloquesDe(dia).filter((b) => b.numero?.startsWith("Acuerdo")).map((b) => b.texto);
      expect(suyos).toEqual(ACUERDOS.filter((a) => a.sesion === dia).map((a) => a.detalle));
    }
  });

  it("la firman los dos consejeros con marca del padrón", () => {
    const consejo = padron.cuentas.filter((c: { consejo?: boolean }) => c.consejo).map((c: { fullName: string }) => c.fullName);
    for (const dia of sesiones) {
      expect(bloquesDe(dia).find((b) => b.tipo === "firmas")?.firmantes?.map((f) => f.nombre)).toEqual(consejo.slice(0, 2));
    }
  });

  it("una fecha sin sesión falla en vez de inventar un acta", () => {
    expect(() => actaDelConsejo(padron, "2026-06-19")).toThrow(/No hay sesión/);
  });

  it("cada acta se pinta entera, con la marca en todas las páginas", async () => {
    for (const dia of sesiones) {
      const { paginas, marcas } = await documentoEstructurado(actaDelConsejo(padron, dia));
      expect(marcas).toBe(paginas);
    }
  });
});

describe("la asamblea de enero (A3)", () => {
  const padron = construirPadron("conjunto-de-prueba");
  type Bloque = { tipo: string; texto?: string; items?: string[]; columnas?: string[]; filas?: string[][]; firmantes?: { nombre: string }[] };
  const acta = actaDeAsamblea(padron).bloques as Bloque[];
  const convocatoria = convocatoriaDeAsamblea(padron).bloques as Bloque[];
  const tabla = (bloques: Bloque[], primera: string) => bloques.find((b) => b.tipo === "tabla" && b.columnas?.[0] === primera)?.filas ?? [];
  const ordenDe = (bloques: Bloque[]) => bloques[bloques.findIndex((b) => b.tipo === "capitulo" && b.texto === "Orden del día") + 1]?.items;

  it("la lista de asistencia trae las 48 casas, cada una con su propietario", () => {
    const filas = tabla(acta, "Casa");
    const personas = new Map(padron.personas.map((p) => [p.id, p.fullName]));
    expect(filas.map((f) => f[0])).toEqual(padron.casas.map((c) => c.displayName));
    expect(filas.map((f) => f[1])).toEqual(padron.casas.map((c) => personas.get(c.ownerIds[0])));
  });

  it("hay quórum en primera convocatoria, y el acta dice el que suma la lista", () => {
    const filas = tabla(acta, "Casa");
    const quorum = padron.casas.filter((_, i) => filas[i][3] !== "Ausente").reduce((s, c) => s + c.coefficient, 0);
    expect(quorum).toBeGreaterThan(50);
    const texto = quorum.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(acta.some((b) => b.texto?.includes(`suman el ${texto} % de los indivisos`))).toBe(true);
  });

  it("el consejo que firma estuvo presente", () => {
    const filas = tabla(acta, "Casa");
    const consejo = padron.cuentas.filter((c) => c.consejo);
    const casas = new Map(padron.casas.map((c) => [c.id, c.displayName]));
    for (const c of consejo) expect(filas.find((f) => f[0] === casas.get(c.casaId ?? ""))?.[3]).toBe("Presente");
    expect(acta.find((b) => b.tipo === "firmas")?.firmantes?.map((f) => f.nombre)).toEqual(consejo.map((c) => c.fullName));
  });

  it("el presupuesto suma lo sembrado, y la cuota de mantenimiento son doce cuotas", () => {
    const filas = tabla(acta, "Cuenta");
    const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;
    const suma = (prefijo: string) => PRESUPUESTO_2026.filter((l) => l.accountCode.startsWith(prefijo)).reduce((s, l) => s + l.amount, 0);
    expect(filas.find((f) => f[1] === "Total de ingresos")?.[2]).toBe(pesos(suma("1.")));
    expect(filas.find((f) => f[1] === "Total de egresos")?.[2]).toBe(pesos(suma("2.")));
    expect(PRESUPUESTO_2026.find((l) => l.accountCode === "1.1")?.amount).toBe(CUOTA_MENSUAL_TOTAL * 12);
  });

  it("la convocatoria y el acta llevan el mismo orden del día", () => {
    expect(ordenDe(acta)?.length).toBeGreaterThan(5);
    expect(ordenDe(convocatoria)).toEqual(ordenDe(acta));
  });

  it("las dos se pintan enteras, con la marca en todas las páginas", async () => {
    for (const doc of [actaDeAsamblea(padron), convocatoriaDeAsamblea(padron)]) {
      const { paginas, marcas } = await documentoEstructurado(doc);
      expect(marcas).toBe(paginas);
    }
  });
});

describe("los adjuntos de los comunicados (A4)", () => {
  const adjuntos = adjuntosDeComunicados();

  it("cada uno es de un comunicado del guion, y el producto no le cambiaría el nombre", () => {
    for (const a of adjuntos) {
      expect(COMUNICADOS[Number(a.clave.slice(-2)) - 1]?.titulo).toBe(a.titulo);
      expect(a.archivo).toBe(a.archivo.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-"));
    }
    expect(new Set(adjuntos.map((a) => a.clave)).size).toBe(adjuntos.length);
  });

  it("la circular de la alberca da el horario de su política", () => {
    const alberca = AREAS.find((a) => a.clave === "alberca");
    const circular = adjuntos.find((a) => a.titulo === "Vacaciones de verano: reglas de la alberca");
    const lista = circular?.contenido?.bloques.find((b) => b.tipo === "lista") as { items?: string[] } | undefined;
    expect(lista?.items?.some((i) => i.includes(`de ${alberca?.operatingHoursStart} a ${alberca?.operatingHoursEnd} horas`))).toBe(true);
  });

  it("las circulares se pintan enteras y los carteles son JPEG de menos de 5 MB", async () => {
    for (const a of adjuntos) {
      expect(a.tipo === "pdf" ? a.contenido : a.cartel).toBeDefined();
      if (a.tipo === "pdf" && a.contenido) {
        const { paginas, marcas } = await documentoEstructurado(a.contenido);
        expect(marcas).toBe(paginas);
      } else if (a.cartel) {
        const jpeg = await cartel(a.cartel);
        expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
        expect(jpeg.length).toBeLessThan(5 * 1024 * 1024);
      }
    }
  });

  it("un tema de cartel desconocido falla en vez de pintar un cartel vacío", async () => {
    await expect(cartel({ tema: "otro", titulo: ["x"], lineas: [], pie: "" })).rejects.toThrow(/tema de cartel/);
  });
});

describe("el plano y la memoria de obra (A5)", () => {
  const padron = construirPadron("conjunto-de-prueba");
  const { eventos } = construirHistoria({ tenantId: "conjunto-de-prueba", hoy: "2026-09-13" });
  type Bloque = { tipo: string; filas?: string[][] };
  const tablaDe = (bloques: unknown[]) => (bloques as Bloque[]).find((b) => b.tipo === "tabla")?.filas ?? [];
  const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;

  it("la tabla del plano cuenta las casas de cada sección y suma el indiviso entero", async () => {
    const filas = tablaDe(planoGeneral(padron, await planoDelFraccionamiento({ secciones: SECCIONES, casasPorSeccion: CASAS_POR_SECCION })).bloques);
    expect(filas.map((f) => f[0])).toEqual([...SECCIONES, "Total"]);
    expect(filas.slice(0, -1).map((f) => Number(f[1]))).toEqual(SECCIONES.map(() => CASAS_POR_SECCION));
    expect(filas[filas.length - 1][1]).toBe(String(padron.casas.length));
    expect(filas[filas.length - 1][3]).toBe("100.0000");
  });

  it("la memoria dice lo que la historia pagó, y cuándo", async () => {
    const [antes, despues] = await Promise.all([fotoDeObra("antes"), fotoDeObra("despues")]);
    const filas = tablaDe(memoriaDeObra(eventos, { antes, despues }).bloques);
    const pagos = ["anticipo", "finiquito"].map((e) => eventos.find((x) => x.clave === `egreso-impermeabilizacion-${e}`)?.datos as { monto: number; pago: string });
    expect(filas.slice(0, 2).map((f) => f[2])).toEqual(pagos.map((p) => pesos(p.monto)));
    expect(filas.slice(0, 2).map((f) => f[1].split(" ")[0])).toEqual(pagos.map((p) => String(Number(p.pago.slice(8, 10)))));
    expect(filas[filas.length - 1][2]).toBe(pesos(pagos[0].monto + pagos[1].monto));
  });

  it("los dos se pintan enteros, con sus imágenes y la marca en todas las páginas", async () => {
    const [imagen, antes, despues] = await Promise.all([
      planoDelFraccionamiento({ secciones: SECCIONES, casasPorSeccion: CASAS_POR_SECCION }),
      fotoDeObra("antes"),
      fotoDeObra("despues"),
    ]);
    for (const doc of [planoGeneral(padron, imagen), memoriaDeObra(eventos, { antes, despues })]) {
      const { paginas, marcas } = await documentoEstructurado(doc);
      expect(marcas).toBe(paginas);
    }
  });

  it("una imagen sin su archivo falla en vez de dejar un hueco en el documento", async () => {
    await expect(documentoEstructurado({ titulo: "x", bloques: [{ tipo: "imagen", clave: "x" }] })).rejects.toThrow(/no trae su archivo/);
  });
});

describe("las áreas y los servicios (B1 y B2)", () => {
  it("cada área del padrón tiene su ilustración", () => {
    for (const a of construirPadron("conjunto-de-prueba").areas) expect(TIPOS_DE_AREA).toContain(a.clave);
  });

  it("cada servicio tiene portada y hoja de tarifas de una página, que empieza por su descripción", async () => {
    for (const s of SERVICIOS) {
      const jpeg = await portadaDeServicio({ clave: s.clave, titulo: s.title, detalle: s.serviceType, tercero: s.category === "third_party" });
      expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
      const hoja = hojaDeTarifas(s, "Por medio de la administración");
      expect((hoja.bloques[0] as { texto?: string }).texto).toBe(s.description);
      const { paginas, marcas } = await documentoEstructurado(hoja);
      expect([paginas, marcas]).toEqual([1, 1]);
    }
  });

  it("un servicio sin dibujo falla en vez de subir una portada vacía", async () => {
    await expect(portadaDeServicio({ clave: "otro", titulo: "x", detalle: "", tercero: false })).rejects.toThrow(/portada/);
  });
});

describe("los contratos y la póliza (C3)", () => {
  const padron = construirPadron("conjunto-de-prueba");
  const { eventos } = construirHistoria({ tenantId: "conjunto-de-prueba", hoy: "2026-09-13" });
  const conCuotaFija = ["vigilancia", "jardineria", "limpieza", "alberca"];
  type Bloque = { tipo: string; numero?: string; texto?: string; firmantes?: { nombre: string }[] };

  it("cada contrato cobra lo que la historia paga cada mes, y lo firma su prestador", () => {
    for (const g of EGRESOS_RECURRENTES.filter((e) => conCuotaFija.includes(e.clave))) {
      const bloques = contratoDeServicio(padron, g.clave).bloques as Bloque[];
      expect(bloques.find((b) => b.numero === "Tercera. Precio.")?.texto).toContain(`$${(g.monto as number).toLocaleString("es-MX")} al mes`);
      expect(bloques.find((b) => b.tipo === "firmas")?.firmantes?.map((f) => f.nombre)).toContain(PROVEEDORES.find((p) => p.clave === g.proveedor)?.legalName);
    }
  });

  it("el de vigilancia no habla del QR, que llegó en septiembre", () => {
    expect(JSON.stringify(contratoDeServicio(padron, "vigilancia"))).not.toMatch(/QR/);
  });

  it("la póliza dice la prima que la historia pagó", () => {
    const prima = (eventos.find((e) => e.clave === "egreso-seguro-2026")?.datos as { monto: number }).monto;
    expect(JSON.stringify(polizaDeSeguro(padron, eventos))).toContain(`$${prima.toLocaleString("es-MX")}, pagada el`);
  });

  it("un prestador sin cuota fija no tiene contrato", () => {
    expect(() => contratoDeServicio(padron, "cfe")).toThrow(/cuota fija/);
  });

  it("todos se pintan enteros, con la marca en todas las páginas", async () => {
    for (const doc of [...conCuotaFija.map((c) => contratoDeServicio(padron, c)), polizaDeSeguro(padron, eventos)]) {
      const { paginas, marcas } = await documentoEstructurado(doc);
      expect(marcas).toBe(paginas);
    }
  });
});

describe("los comprobantes de transferencia (C4)", () => {
  const datos = {
    fecha: "5 de junio de 2026, 10:14 h", importe: "$1,798.67 MXN", ordenante: "Guadalupe Castro Rivera",
    beneficiario: "Asoc. de Colonos Lomas de Sayilbedra", cuentaDestino: "****1234", concepto: "Cuota 2026-06 Encinos 10",
    referencia: "0123456", rastreo: "7654321",
  };

  it("el completo es la captura entera, y el rechazado viene sin la parte de arriba", async () => {
    const entero = await sharp(await comprobanteDeTransferencia(datos)).metadata();
    const recortado = await sharp(await comprobanteDeTransferencia({ ...datos, recortado: true })).metadata();
    expect([entero.format, recortado.format]).toEqual(["jpeg", "jpeg"]);
    expect(entero.height).toBe(1280);
    expect(recortado.height).toBe(1280 - 252);
  });
});

describe("el archivo mensual del cron, rellenado hacia atrás (C2)", () => {
  const ts = (iso: string) => ({ toMillis: () => Date.parse(iso) });
  const junio = { period: "2026-06", dueDate: "2026-06-10", createdAt: ts("2026-06-01T14:00:00Z"), status: "paid" };
  const cargos = [
    { ...junio, id: "c1", amount: 1000, unitId: "u1", unitLabel: "Encinos 01" },
    { ...junio, id: "c2", amount: 500, unitId: "u2", unitLabel: "Encinos 02" },
    { id: "c3", period: "2026-07", amount: 1000, dueDate: "2026-07-10", unitId: "u1", unitLabel: "Encinos 01", createdAt: ts("2026-07-01T14:00:00Z"), status: "overdue" },
  ];
  const asientos = [
    { id: "a1", type: "ingreso", sourceType: "billingStatement", sourceId: "c1", amount: 1000, date: "2026-06-08", createdAt: ts("2026-06-08T16:00:00Z") },
    { id: "a2", type: "ingreso", sourceType: "billingStatement", sourceId: "c2", amount: 500, date: "2026-07-05", createdAt: ts("2026-07-05T16:00:00Z") },
    { id: "a3", type: "ingreso", sourceType: "billingStatement", sourceId: "c2", amount: 500, date: "2026-06-20", createdAt: ts("2026-06-20T16:00:00Z"), reversedByEntryId: "r3" },
    { id: "r3", type: "ingreso", sourceType: "reversal", sourceId: "a3", amount: -500, date: "2026-06-25", createdAt: ts("2026-06-25T16:00:00Z") },
  ];
  const corte = new Date("2026-07-01T06:00:00Z");

  it("al corte no cuenta el pago posterior ni el revertido antes, y el cargo nacido después no existe", () => {
    const al = carteraAl(corte, { cargos, asientos, aplicaciones: [] });
    expect(al.map((c) => [c.id, c.paymentAmount, c.balance, c.status])).toEqual([["c1", 1000, 0, "paid"], ["c2", 0, 500, "overdue"]]);
  });

  it("llevada al final de los tiempos, reproduce lo que se guarda hoy", () => {
    const hoy = carteraAl(new Date("2999-12-31T00:00:00Z"), { cargos, asientos, aplicaciones: [] });
    expect(hoy.map((c) => [c.id, c.paymentAmount, c.balance])).toEqual([["c1", 1000, 0], ["c2", 500, 0], ["c3", 0, 1000]]);
  });

  it("sin cargos creados al corte no hay archivo, como cuando el cron se salta el conjunto", () => {
    expect(archivoMensualAl(new Date("2026-06-01T06:00:00Z"), { cargos, asientos, aplicaciones: [], egresos: [], saldos: [], informeAnclado: true })).toBeNull();
  });

  it("el reporte es del mes anterior, pinta el dinero con el formato del cron y los morosos salen de la cartera al corte", () => {
    const a = archivoMensualAl(corte, { cargos, asientos, aplicaciones: [], egresos: [], saldos: [], informeAnclado: true });
    expect(a?.comite.mes).toBe("2026-06");
    expect(a?.comite.filasPdf.slice(0, 3)).toEqual([["Facturado del mes", "$1.500"], ["Recaudado del mes", "$1.000"], ["Liquidado del mes", "$1.000"]]);
    expect(a?.historico.sheets[1].rows).toEqual([["Unidad", "Deuda total", "# períodos"], ["Encinos 02", 500, 1]]);
  });
});

describe("el logo del conjunto (D1)", () => {
  it("es un PNG que cabe en el límite de la pantalla de Ajustes (1.2 MB, `validateTenantLogoFile`)", async () => {
    const png = await logoDelConjunto({ nombre: "Lomas de Sayilbedra", color: construirPadron("conjunto-de-prueba").ajustes.brandColor });
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png.length).toBeLessThan(1_200_000);
  });
});

describe("las relaciones de movimientos bancarios (C1)", () => {
  const cuenta = { label: "Cuenta operativa", accountNumber: "012650000000008448" };
  const lineas = [
    { date: "2026-06-02", description: "SPEI RECIBIDO VECINA REF ENCINOS 01", amount: 1500.5 },
    { date: "2026-06-05", description: "SPEI ENVIADO PROVEEDOR", amount: -1200.25 },
    { date: "2026-06-30", description: "INTERESES GANADOS", amount: 10.1 },
  ];
  type Tabla = { tipo: string; filas?: string[][] };
  const tablas = (bloques: unknown[]) => (bloques as Tabla[]).filter((b) => b.tipo === "tabla").map((b) => b.filas ?? []);

  it("el cierre es la apertura más los abonos menos los cargos, y la última fila de la tabla lo repite", () => {
    const [resumen, movimientos] = tablas(relacionDeMovimientos({ cuenta, mes: "2026-06", saldoInicial: 1000, lineas, elaborada: "2026-07-03" }).bloques);
    expect(resumen.map((f) => f[1])).toEqual(["$1,000.00", "$1,510.60", "$1,200.25", "$1,310.35"]);
    expect(movimientos[movimientos.length - 1][4]).toBe("$1,310.35");
  });

  it("una línea de otro mes hace fallar la relación en vez de descuadrarla", () => {
    expect(() => relacionDeMovimientos({ cuenta, mes: "2026-07", saldoInicial: 0, lineas, elaborada: "2026-08-03" })).toThrow(/otro mes/);
  });

  it("no lleva el nombre del banco, solo la cuenta y su terminación", async () => {
    const doc = relacionDeMovimientos({ cuenta, mes: "2026-06", saldoInicial: 1000, lineas, elaborada: "2026-07-03" });
    expect(doc.subtitulo).toBe("Cuenta operativa ····8448 · junio de 2026");
    expect(JSON.stringify(doc)).not.toMatch(/BBVA|banco [A-Z]/);
    const { paginas, marcas } = await documentoEstructurado(doc);
    expect(marcas).toBe(paginas);
  });
});
