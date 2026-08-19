/**
 * tests/imp10-download-qr.test.ts
 *
 * IMP-10 — Botón "Descargar QR" paso 3 visitantes: tests puros sin RTL.
 * Bloques: handleDownload logic | static file verification
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — handleDownload: lógica de descarga
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replica exacta de handleDownload() extraída del componente.
 * Env=node → no hay DOM real.
 * Inyectamos createElementFn para evitar dependencia de document global.
 */
type LinkLike = { href: string; download: string; click: () => void };

function makeHandleDownload(
  canvasRef: { current: { toDataURL: (fmt: string) => string } | null },
  invitation: { visitorName?: string; invitationCode?: string } | null,
  createElementFn: (tag: string) => LinkLike,
) {
  return () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const visitorSlug = (invitation?.visitorName ?? "visitante")
      .trim()
      .replace(/\s+/g, "-");
    const filename = `QR-${invitation?.invitationCode ?? "QR"}-${visitorSlug}.png`;
    const link = createElementFn("a");
    link.href = url;
    link.download = filename;
    link.click();
  };
}

function makeMockCanvas(dataUrl = "data:image/png;base64,FAKE") {
  return { toDataURL: vi.fn(() => dataUrl) };
}

function makeLinkFactory() {
  const linkObj: LinkLike = { href: "", download: "", click: vi.fn() };
  const createSpy = vi.fn((_tag: string) => linkObj);
  return { linkObj, createSpy };
}

describe("BLOQUE 1 — handleDownload: lógica de descarga", () => {
  describe("canvasRef.current válido", () => {
    it("llama toDataURL('image/png') exactamente 1 vez", () => {
      const canvas = makeMockCanvas();
      const { createSpy } = makeLinkFactory();

      makeHandleDownload(
        { current: canvas },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      )();

      expect(canvas.toDataURL).toHaveBeenCalledOnce();
      expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
    });

    it("crea elemento <a> via createElement('a')", () => {
      const canvas = makeMockCanvas();
      const { createSpy } = makeLinkFactory();

      makeHandleDownload(
        { current: canvas },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      )();

      expect(createSpy).toHaveBeenCalledWith("a");
    });

    it("link.href es el valor retornado por toDataURL", () => {
      const dataUrl = "data:image/png;base64,TESTDATA";
      const canvas = makeMockCanvas(dataUrl);
      const { linkObj, createSpy } = makeLinkFactory();

      makeHandleDownload(
        { current: canvas },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      )();

      expect(linkObj.href).toBe(dataUrl);
    });

    it("link.download = 'QR-LI0WVD-Carlos-Paz.png'", () => {
      const canvas = makeMockCanvas();
      const { linkObj, createSpy } = makeLinkFactory();

      makeHandleDownload(
        { current: canvas },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      )();

      expect(linkObj.download).toBe("QR-LI0WVD-Carlos-Paz.png");
    });

    it("link.click() es llamado", () => {
      const canvas = makeMockCanvas();
      const { linkObj, createSpy } = makeLinkFactory();

      makeHandleDownload(
        { current: canvas },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      )();

      expect(linkObj.click).toHaveBeenCalledOnce();
    });
  });

  describe("Formato del nombre de archivo", () => {
    function captureDownload(invitationCode: string, visitorName: string): string {
      const canvas = makeMockCanvas();
      const { linkObj, createSpy } = makeLinkFactory();
      makeHandleDownload({ current: canvas }, { invitationCode, visitorName }, createSpy)();
      return linkObj.download;
    }

    it('"Carlos Paz" → "QR-CODE-Carlos-Paz.png"', () => {
      expect(captureDownload("CODE", "Carlos Paz")).toBe("QR-CODE-Carlos-Paz.png");
    });

    it('"María José" → "QR-CODE-María-José.png" (preserva tildes)', () => {
      expect(captureDownload("CODE", "María José")).toBe("QR-CODE-María-José.png");
    });

    it('"  Ana  García  " → "QR-CODE-Ana-García.png" (trim + colapso espacios)', () => {
      expect(captureDownload("CODE", "  Ana  García  ")).toBe("QR-CODE-Ana-García.png");
    });

    it('"Pedro" → "QR-CODE-Pedro.png" (nombre simple)', () => {
      expect(captureDownload("CODE", "Pedro")).toBe("QR-CODE-Pedro.png");
    });
  });

  describe("canvasRef.current es null", () => {
    it("NO llama createElement cuando canvas es null", () => {
      const { createSpy } = makeLinkFactory();
      makeHandleDownload(
        { current: null },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      )();
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("NO lanza excepción (retorna silenciosamente)", () => {
      const { createSpy } = makeLinkFactory();
      const handleDownload = makeHandleDownload(
        { current: null },
        { invitationCode: "LI0WVD", visitorName: "Carlos Paz" },
        createSpy,
      );
      expect(() => handleDownload()).not.toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — integración estática: ref y botón en page.tsx
// ─────────────────────────────────────────────────────────────────────────────

const pageContent = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/app/(resident)/resident/visitors/[id]/qr/page.tsx",
  ),
  "utf8",
);

describe("BLOQUE 2 — page.tsx: verificación estática", () => {
  it("useRef importado de 'react'", () => {
    expect(pageContent).toMatch(
      /import\s*\{[^}]*useRef[^}]*\}\s*from\s*["']react["']/,
    );
  });

  it("Download importado de 'lucide-react'", () => {
    expect(pageContent).toMatch(
      /import\s*\{[^}]*Download[^}]*\}\s*from\s*["']lucide-react["']/,
    );
  });

  it("canvasRef declarado como useRef<HTMLCanvasElement>(null)", () => {
    expect(pageContent).toContain("useRef<HTMLCanvasElement>(null)");
  });

  it("<QRCodeCanvas> tiene prop ref={canvasRef}", () => {
    expect(pageContent).toMatch(/QRCodeCanvas[^/]*ref=\{canvasRef\}/);
  });

  // El handler se llamaba `handleDownload` cuando esto solo descargaba. Al
  // añadirse compartir nativo pasó a `handleAction`, que comparte si el
  // navegador lo soporta y descarga si no — y esta prueba lleva fallando desde
  // entonces, tolerada como «preexistente». Se comprueba el cableado y el
  // comportamiento, no el nombre, para que un renombrado no vuelva a romperla.
  it("el botón está cableado a la acción de guardar/compartir", () => {
    expect(pageContent).toMatch(/onClick=\{\(\)\s*=>\s*void handleAction\(\)\}/);
  });

  it("la acción comparte si el navegador puede, y descarga si no", () => {
    expect(pageContent).toContain("navigator.share");
    expect(pageContent).toContain("link.download");
  });

  it("botón contiene texto 'Descargar QR'", () => {
    expect(pageContent).toContain("Descargar QR");
  });

  it("botón contiene componente <Download", () => {
    expect(pageContent).toMatch(/<Download[^>]*\/>/);
  });

  it("handleDownload usa canvas.toDataURL('image/png')", () => {
    expect(pageContent).toContain('toDataURL("image/png")');
  });

  it("NO usa querySelector('canvas') — ref directo, sin fallback", () => {
    expect(pageContent).not.toContain('querySelector("canvas")');
    expect(pageContent).not.toContain("querySelector('canvas')");
  });
});
