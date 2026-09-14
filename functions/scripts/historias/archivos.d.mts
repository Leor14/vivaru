// Tipos de `archivos.mjs`, para las pruebas de `functions/tests/` (como `reloj.d.mts`).

export declare function tokenDe(ruta: string): string;
export declare function subir(
  ctx: unknown,
  ruta: string,
  contenido: Buffer,
  contentType: string,
  opciones?: { reemplazar?: boolean },
): Promise<string>;
export declare function imagenDeEjemplo(opciones: {
  titulo: string;
  lineas?: string[];
  ancho?: number;
  alto?: number;
  fondo?: string;
  tinta?: string;
}): Promise<Buffer>;
export declare function documentoPdf(opciones: { titulo: string; subtitulo?: string; parrafos?: string[]; pie?: string }): Promise<Buffer>;

export declare function huellaDe(valor: unknown): string;
export declare function subirSiCambia(
  ctx: unknown,
  ruta: string,
  contenido: Buffer,
  contentType: string,
  huella: string,
): Promise<{ estado: "igual" | "creado" | "reemplazado" | "crearia" | "reemplazaria"; url: string }>;

export declare function fueraDeWinAnsi(texto: string): string[];
export declare function aWinAnsi(texto: string): string;

export type BloqueDeDocumento =
  | { tipo: "capitulo"; texto: string }
  | { tipo: "articulo"; numero: string; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "tabla"; columnas: string[]; filas: (string | number)[][]; anchos?: number[]; alinear?: ("left" | "right" | "center")[] }
  | { tipo: "firmas"; firmantes: { nombre: string; cargo: string }[] }
  | { tipo: "salto" }
  | { tipo: "imagen"; buffer: Buffer; clave: string; alto?: number; pie?: string }
  | { tipo: string; [k: string]: unknown };

export declare function documentoEstructurado(doc: {
  titulo: string;
  subtitulo?: string;
  encabezado?: string;
  fecha?: Date;
  bloques?: BloqueDeDocumento[];
}): Promise<{ buffer: Buffer; paginas: number; marcas: number }>;
