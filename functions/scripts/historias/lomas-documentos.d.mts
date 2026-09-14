// Tipos de `lomas-documentos.mjs`, para las pruebas de `functions/tests/` (como `reloj.d.mts`).

type Contenido = {
  titulo: string;
  subtitulo: string;
  encabezado: string;
  fecha: Date;
  bloques: Array<{ tipo: string; [k: string]: unknown }>;
};

export declare const VERSION_DOCUMENTOS: number;

export declare function reglamentoCompleto(padron: unknown): Contenido;

export declare const SESIONES_DEL_CONSEJO: Record<
  string,
  { tipo: string; inicio: string; cierre: string; informe: string[]; notas: Record<string, string>; generales: string[] }
>;

export declare function actaDelConsejo(padron: unknown, dia: string): Contenido;

export declare function actaDeAsamblea(padron: unknown): Contenido;

export declare function convocatoriaDeAsamblea(padron: unknown): Contenido;

export declare function planoGeneral(padron: unknown, imagen: Buffer): Contenido;

export declare function memoriaDeObra(eventos: unknown[], imagenes: { antes: Buffer; despues: Buffer }): Contenido;

export declare function fechaLarga(dia: string): string;

export declare function mesLargo(mes: string): string;

type LineaDeBanco = { date: string; description: string; amount: number };

export declare function relacionDeMovimientos(p: {
  cuenta: { label: string; accountNumber: string };
  mes: string;
  saldoInicial: number;
  lineas: LineaDeBanco[];
  elaborada: string;
  sinIdentificar?: LineaDeBanco;
}): Contenido;

type CargoAlCorte = { id: string; paymentAmount: number; advanceAppliedAmount: number; balance: number; status: string; [k: string]: unknown };
type Hoja = { name: string; rows: unknown[][] };
type DatosDelArchivo = { cargos: unknown[]; asientos: unknown[]; aplicaciones: unknown[] };

export declare function carteraAl(corte: Date, datos: DatosDelArchivo): CargoAlCorte[];

export declare function egresosAl(corte: Date, egresos: unknown[]): Array<{ id?: string; status?: string; [k: string]: unknown }>;

export declare function archivoMensualAl(
  corte: Date,
  datos: DatosDelArchivo & { egresos: unknown[]; saldos: unknown[]; informeAnclado: boolean },
): null | {
  historico: { stamp: string; fileName: string; sheets: Hoja[]; description: string };
  comite: { mes: string; fileNameXlsx: string; fileNamePdf: string; sheets: Hoja[]; titulo: string; subtitulo: string; filasPdf: [string, string][]; description: string };
};

export declare function contratoDeServicio(padron: unknown, clave: string): Contenido;

export declare function polizaDeSeguro(padron: unknown, eventos: unknown[]): Contenido;

export declare function hojaDeTarifas(
  servicio: { clave: string; category: string; title: string; providerName: string; description: string },
  contacto: string,
): Contenido;

export declare function adjuntosDeComunicados(): Array<{
  clave: string;
  titulo: string;
  archivo: string;
  tipo: "pdf" | "cartel";
  contenido?: Contenido;
  cartel?: { tema: string; titulo: string[]; lineas: string[]; pie: string };
}>;
