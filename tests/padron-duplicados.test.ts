import { describe, expect, it } from "vitest";

import {
  claveDelGrupo,
  cuentasDistintas,
  detectarDuplicados,
  normalizarTexto,
  type PersonaComparable,
} from "@/features/residents/duplicados";

/**
 * **`PRD-V-FEAT-005` — la detección, contra el caso real de producción.**
 *
 * El padrón de `tenant-santa-maria` tenía 24 personas el 30 de agosto de 2026 y la ficha decía
 * «11 registros duplicados en 3 grupos». **Medirlo dio otra cosa: 13 registros**, y los 11/3 de
 * la ficha resultaron ser **la regla de nombre a solas** — el documento y el correo añaden un
 * racimo que esa regla no ve. La ficha se corrigió; este banco fija lo medido.
 *
 * Los correos personales se sustituyen por su equivalente de ejemplo: lo que la prueba necesita
 * es **la colisión**, no la dirección.
 */
const SANTA_MARIA: PersonaComparable[] = [
  // Los siete «David Carmona»: un correo, dos documentos, dos unidades.
  { id: "31PVhu", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "SGWE34675JKG" },
  { id: "AFiW9H", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "SGWE34675JKG" },
  { id: "yVs6ZO", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "SGWE34675JKG" },
  { id: "m8sbjG", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "HHPRD44002235" },
  { id: "rFSa2e", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "HHPRD44002235" },
  { id: "uLYXPX", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "HHPRD44002235" },
  { id: "wwgks6", fullName: "David Carmona", email: "compartido@ejemplo.test", documentNumber: "HHPRD44002235" },
  // El racimo de Luis: dos nombres DISTINTOS comparten documento.
  { id: "8N4xzb", fullName: "David Cancelo", email: "cancelo@ejemplo.test", documentNumber: "65465465" },
  { id: "OUoTjP", fullName: "Luis Otero", email: "otero@ejemplo.test", documentNumber: "65465465", authUid: "uid-A" },
  { id: "mFBWhR", fullName: "Luis Otero", email: "luis@ejemplo.test", documentNumber: "1140897894", authUid: "uid-B" },
  { id: "Y5b8b4", fullName: "Luis", email: "luis@ejemplo.test", documentNumber: "1148759876", authUid: "uid-B" },
  // Jorge Pardo: solo por nombre. Uno sin documento.
  { id: "LmvpkM", fullName: "Jorge Pardo", email: "pardo@ejemplo.test", documentNumber: "88552233", authUid: "uid-C" },
  { id: "p-res-1", fullName: "Jorge Pardo", email: "jorge.resident@demo.co" },
  // Gente sin duplicar, incluida la que NO tiene documento: 21 de 68 en producción.
  { id: "eAq8c1", fullName: "José Salomón", email: "salomon@ejemplo.test", documentNumber: "" },
  { id: "uaxD5i", fullName: "Mariano Rojas", email: "rojas@ejemplo.test" },
  { id: "gBvaCs", fullName: "Mikel Guzmán", email: "guzman@ejemplo.test" },
];

describe("detección de duplicados del padrón", () => {
  const grupos = detectarDuplicados(SANTA_MARIA);

  describe("CA1 y CA2 — lo medido en producción", () => {
    it("da 5 grupos y 13 registros distintos", () => {
      expect(grupos).toHaveLength(5);
      expect(new Set(grupos.flatMap((g) => g.ids)).size).toBe(13);
    });

    it("CA2 — «David Carmona» sale como UN grupo de siete, no como cuatro filas", () => {
      const david = grupos.find((g) => g.ids.length === 7);
      expect(david, "falta el grupo de siete").toBeDefined();
      expect(david!.ids).toEqual(["31PVhu", "AFiW9H", "m8sbjG", "rFSa2e", "uLYXPX", "wwgks6", "yVs6ZO"]);
    });

    it("CA2 — y enseña sus DOS documentos distintos como motivos, sin repetir el grupo", () => {
      const david = grupos.find((g) => g.ids.length === 7)!;
      const docs = david.motivos.filter((m) => m.regla === "documento").map((m) => m.valor).sort();
      expect(docs).toEqual(["hhprd44002235", "sgwe34675jkg"]);
      expect(david.motivos.map((m) => m.regla)).toContain("correo");
      expect(david.motivos.map((m) => m.regla)).toContain("nombre");
    });

    it("R8 — todo grupo dice por qué se agrupó", () => {
      for (const g of grupos) expect(g.motivos.length).toBeGreaterThan(0);
    });
  });

  describe("un grupo por coincidencia, y NO por cierre transitivo", () => {
    /**
     * **Es la decisión de diseño que más protege, y la destapó medir.** «David Cancelo» y «Luis
     * Otero» comparten el documento `65465465`. Encadenando grupos que comparten a alguien, los
     * cuatro del racimo caen en una sola propuesta de fusión con **dos nombres distintos dentro**.
     * Un duplicado se ve; una fusión mala, no.
     */
    it("«David Cancelo» y «Luis Otero» comparten grupo SOLO por su documento, y son dos", () => {
      const porDocumento = grupos.find((g) => g.ids.includes("8N4xzb"))!;
      expect(porDocumento.ids).toEqual(["8N4xzb", "OUoTjP"]);
      expect(porDocumento.motivos).toEqual([{ regla: "documento", valor: "65465465" }]);
    });

    it("y NINGÚN grupo junta a los cuatro del racimo", () => {
      const racimo = ["8N4xzb", "OUoTjP", "mFBWhR", "Y5b8b4"];
      for (const g of grupos) {
        expect(racimo.filter((id) => g.ids.includes(id)).length).toBeLessThan(3);
      }
    });

    it("una persona puede estar en dos grupos, y eso es correcto", () => {
      const conOtero = grupos.filter((g) => g.ids.includes("OUoTjP"));
      expect(conOtero).toHaveLength(2);
      expect(conOtero.map((g) => g.motivos[0].regla).sort()).toEqual(["documento", "nombre"]);
    });
  });

  describe("R5 — cuentas de acceso DISTINTAS, no registros con cuenta", () => {
    /**
     * El caso que separa las dos lecturas está en producción: «Luis» y «Luis Otero» son dos fichas
     * apuntando al **mismo** uid. Contar registros con `authUid` los habría bloqueado como si
     * fueran dos personas con acceso propio.
     */
    it("dos fichas con el MISMO uid son una sola cuenta: se pueden fusionar", () => {
      const porCorreo = grupos.find((g) => g.ids.includes("Y5b8b4"))!;
      const personas = SANTA_MARIA.filter((p) => porCorreo.ids.includes(p.id));
      expect(cuentasDistintas(personas)).toEqual(["uid-B"]);
    });

    it("dos uid distintos SÍ son dos cuentas, y ahí R5 tiene que frenar", () => {
      const porNombre = grupos.find((g) => g.ids.includes("OUoTjP") && g.motivos[0].regla === "nombre")!;
      const personas = SANTA_MARIA.filter((p) => porNombre.ids.includes(p.id));
      expect(cuentasDistintas(personas)).toEqual(["uid-A", "uid-B"]);
    });

    it("y sin cuentas no hay nada que resolver", () => {
      expect(cuentasDistintas([{ id: "x" }, { id: "y", authUid: "" }])).toEqual([]);
    });
  });

  describe("qué NO agrupa", () => {
    it("un documento vacío no agrupa a nadie, y son 21 de 68 en producción", () => {
      const sinDocumento = detectarDuplicados([
        { id: "a", fullName: "Ana Uno", documentNumber: "" },
        { id: "b", fullName: "Ana Dos", documentNumber: "" },
        { id: "c", fullName: "Ana Tres" },
      ]);
      expect(sinDocumento).toEqual([]);
    });

    it("CA8 — un padrón limpio no devuelve grupos vacíos, devuelve ninguno", () => {
      expect(detectarDuplicados([{ id: "a", fullName: "Ana", email: "a@x.test" }])).toEqual([]);
      expect(detectarDuplicados([])).toEqual([]);
    });

    it("un registro YA fusionado no vuelve a la lista", () => {
      const base: PersonaComparable[] = [
        { id: "a", fullName: "Ana Ruiz" },
        { id: "b", fullName: "Ana Ruiz" },
      ];
      expect(detectarDuplicados(base)).toHaveLength(1);
      expect(detectarDuplicados([base[0], { ...base[1], fusionadaEn: "2026-08-30" }])).toEqual([]);
    });
  });

  describe("la normalización, que es lo que decide qué es «el mismo»", () => {
    it("ignora tildes, mayúsculas y dobles espacios", () => {
      expect(normalizarTexto("  José   SALOMÓN ")).toBe("jose salomon");
      expect(normalizarTexto("DELSI PAZ")).toBe(normalizarTexto("delsi paz"));
    });

    it("y por eso agrupa lo que una comparación cruda no vería", () => {
      const g = detectarDuplicados([
        { id: "a", fullName: "José Salomón" },
        { id: "b", fullName: "jose  salomon" },
      ]);
      expect(g).toHaveLength(1);
      expect(g[0].motivos[0]).toEqual({ regla: "nombre", valor: "jose salomon" });
    });
  });

  describe("CA7 — la clave del grupo caduca sola", () => {
    it("es la huella de sus ids, sin importar el orden", () => {
      expect(claveDelGrupo(["b", "a"])).toBe(claveDelGrupo(["a", "b"]));
    });

    it("y CAMBIA si entra un registro nuevo, así que el descarte deja de cubrirlo", () => {
      const dos = detectarDuplicados([
        { id: "a", fullName: "Ana Ruiz" },
        { id: "b", fullName: "Ana Ruiz" },
      ]);
      const tres = detectarDuplicados([
        { id: "a", fullName: "Ana Ruiz" },
        { id: "b", fullName: "Ana Ruiz" },
        { id: "c", fullName: "Ana Ruiz" },
      ]);
      expect(tres[0].clave).not.toBe(dos[0].clave);
    });
  });

  describe("CA9 — la detección no escribe nada", () => {
    it("correrla dos veces da lo mismo y no toca la entrada", () => {
      const copia = structuredClone(SANTA_MARIA);
      const a = detectarDuplicados(SANTA_MARIA);
      const b = detectarDuplicados(SANTA_MARIA);
      expect(a).toEqual(b);
      expect(SANTA_MARIA).toEqual(copia);
    });
  });
});
