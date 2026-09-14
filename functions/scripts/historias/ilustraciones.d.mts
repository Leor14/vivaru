// Tipos de `ilustraciones.mjs`, para las pruebas de `functions/tests/` (como `reloj.d.mts`). Solo lo
// que las pruebas usan.

export declare const TIPOS_DE_AREA: string[];

export declare function fotoDeArea(tipo: string, vista?: number): Promise<Buffer>;

export declare function cartel(p: { tema: string; titulo: string[]; lineas: string[]; pie: string }): Promise<Buffer>;

export declare function planoDelFraccionamiento(p: { secciones: string[]; casasPorSeccion: number }): Promise<Buffer>;

export declare function fotoDeObra(etapa: "antes" | "despues"): Promise<Buffer>;

export declare function logoDelConjunto(p: { nombre: string; color?: string }): Promise<Buffer>;

export declare function comprobanteDeTransferencia(p: {
  fecha: string;
  importe: string;
  ordenante: string;
  beneficiario: string;
  cuentaDestino: string;
  concepto: string;
  referencia: string;
  rastreo: string;
  recortado?: boolean;
}): Promise<Buffer>;

export declare function portadaDeServicio(p: { clave: string; titulo: string; detalle: string; tercero: boolean }): Promise<Buffer>;
