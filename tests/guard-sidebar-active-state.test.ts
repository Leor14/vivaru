import { describe, expect, it } from "vitest";

import { resolveActiveNavHref } from "../src/lib/navigation/active-item";

const guardNavHrefs = ["/guard", "/guard/reservations", "/guard/visitors", "/guard/packages/new", "/guard/packages"];

describe("guard sidebar active state", () => {
  it("activates only Inicio on /guard", () => {
    expect(resolveActiveNavHref("/guard", guardNavHrefs)).toBe("/guard");
  });

  it("activates only Reservas on /guard/reservations", () => {
    expect(resolveActiveNavHref("/guard/reservations", guardNavHrefs)).toBe("/guard/reservations");
  });

  it("activates only Visitantes on /guard/visitors", () => {
    expect(resolveActiveNavHref("/guard/visitors", guardNavHrefs)).toBe("/guard/visitors");
  });

  it("activates only Registrar paquete on /guard/packages/new", () => {
    expect(resolveActiveNavHref("/guard/packages/new", guardNavHrefs)).toBe("/guard/packages/new");
  });

  it("activates only Paquetes recibidos on /guard/packages", () => {
    expect(resolveActiveNavHref("/guard/packages", guardNavHrefs)).toBe("/guard/packages");
  });

  it("keeps the same active item after pathname normalization", () => {
    expect(resolveActiveNavHref("/guard/packages/new/", guardNavHrefs)).toBe("/guard/packages/new");
  });
});
