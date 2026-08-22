import { describe, expect, it } from "vitest";

import {
  normalizeLeadCrmRef,
  normalizeSalesRepCrmRef,
  parseCrmRef,
} from "@/lib/albert/crm-ref";

/**
 * El punto de esta validación no es aceptar lo bueno: es FALLAR con lo malo.
 * `crmRef` llevaba desde su alta siendo un <Input> de texto libre, y el fallo
 * que importa —pegar la referencia de un deal donde va la de un comercial— solo
 * se puede cazar porque adoptamos el envoltorio (`DECISIONES-A-003` §3).
 */

const UID = "aB3xY7kQ9mNp2rTsVw5zLc8dEf1g"; // 28 alfanuméricos, como los de Firebase Auth

describe("parseCrmRef — lo que debe aceptar", () => {
  it("lee la identidad de un comercial", () => {
    const r = parseCrmRef(`albert:user:${UID}`);
    expect(r).toEqual({
      ok: true,
      value: `albert:user:${UID}`,
      parsed: { kind: "user", uid: UID },
    });
  });

  it("lee la referencia de un deal con su tenant", () => {
    const r = parseCrmRef("albert:deal:vivaru:h3K9mQ2xRt7bNp4vLd8c");
    expect(r).toEqual({
      ok: true,
      value: "albert:deal:vivaru:h3K9mQ2xRt7bNp4vLd8c",
      parsed: { kind: "deal", tenantId: "vivaru", dealId: "h3K9mQ2xRt7bNp4vLd8c" },
    });
  });

  it("el campo vacío es válido — vincular a Albert es opcional", () => {
    expect(parseCrmRef("")).toEqual({ ok: true, value: null, parsed: null });
    expect(parseCrmRef("   ")).toEqual({ ok: true, value: null, parsed: null });
  });

  it("recorta espacios de un pegado sucio", () => {
    const r = parseCrmRef(`  albert:user:${UID}  `);
    expect(r.ok && r.value).toBe(`albert:user:${UID}`);
  });
});

describe("parseCrmRef — lo que debe fallar", () => {
  it("rechaza texto libre, que es lo que se guardaba hasta hoy", () => {
    const r = parseCrmRef("el de Juan");
    expect(r.ok).toBe(false);
  });

  it("rechaza un uid cortado al copiarlo — el fallo real de este flujo", () => {
    const r = parseCrmRef(`albert:user:${UID.slice(0, 20)}`);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("28");
  });

  it("rechaza un uid con caracteres que Firebase no genera", () => {
    expect(parseCrmRef(`albert:user:${UID.slice(0, 27)}-`).ok).toBe(false);
    expect(parseCrmRef("albert:user:correo@ejemplo.com").ok).toBe(false);
  });

  it("rechaza un deal sin tenant: un dealId suelto no resuelve", () => {
    const r = parseCrmRef("albert:deal:h3K9mQ2xRt7bNp4vLd8c");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("tenant");
  });

  it("rechaza segmentos vacíos en vez de colarlos", () => {
    expect(parseCrmRef("albert:user:").ok).toBe(false);
    expect(parseCrmRef("albert:deal::abc").ok).toBe(false);
    expect(parseCrmRef("albert:deal:vivaru:").ok).toBe(false);
  });

  it("rechaza partes de más", () => {
    expect(parseCrmRef(`albert:user:${UID}:extra`).ok).toBe(false);
    expect(parseCrmRef("albert:deal:vivaru:abc:extra").ok).toBe(false);
  });

  it("rechaza un prefijo o un tipo que no son los nuestros", () => {
    expect(parseCrmRef(`hubspot:user:${UID}`).ok).toBe(false);
    expect(parseCrmRef(`albert:contact:${UID}`).ok).toBe(false);
  });
});

describe("normalizeSalesRepCrmRef — el uid llega pelado por el canal", () => {
  it("envuelve el uid crudo que manda Albert", () => {
    const r = normalizeSalesRepCrmRef(UID);
    expect(r).toEqual({
      ok: true,
      value: `albert:user:${UID}`,
      parsed: { kind: "user", uid: UID },
    });
  });

  it("acepta también la referencia ya envuelta, sin envolverla dos veces", () => {
    const r = normalizeSalesRepCrmRef(`albert:user:${UID}`);
    expect(r.ok && r.value).toBe(`albert:user:${UID}`);
  });

  it("rechaza una referencia de deal pegada en la ficha del comercial", () => {
    const r = normalizeSalesRepCrmRef("albert:deal:vivaru:h3K9mQ2xRt7bNp4vLd8c");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("deal");
  });

  it("rechaza un uid pelado que no tiene pinta de uid", () => {
    expect(normalizeSalesRepCrmRef("juan.perez").ok).toBe(false);
    expect(normalizeSalesRepCrmRef(UID.slice(0, 27)).ok).toBe(false);
  });

  it("vacío sigue siendo desvincular", () => {
    expect(normalizeSalesRepCrmRef("")).toEqual({ ok: true, value: null, parsed: null });
  });
});

describe("normalizeLeadCrmRef — aquí solo vale el deal", () => {
  it("acepta la referencia completa del deal", () => {
    const r = normalizeLeadCrmRef("albert:deal:vivaru:h3K9mQ2xRt7bNp4vLd8c");
    expect(r.ok && r.value).toBe("albert:deal:vivaru:h3K9mQ2xRt7bNp4vLd8c");
  });

  it("rechaza la identidad de un comercial pegada en el lead", () => {
    const r = normalizeLeadCrmRef(`albert:user:${UID}`);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("comercial");
  });

  it("NO acepta un dealId pelado: sin tenant no resuelve", () => {
    expect(normalizeLeadCrmRef("h3K9mQ2xRt7bNp4vLd8c").ok).toBe(false);
  });

  it("vacío sigue siendo desvincular", () => {
    expect(normalizeLeadCrmRef("")).toEqual({ ok: true, value: null, parsed: null });
  });
});
