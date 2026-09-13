// Tipos de `reloj.mjs`, para las pruebas de `functions/tests/` (como `seed-data-*.d.mts`).

export declare const DESFASE_HORAS: number;
export declare function partes(dia: string): { a: number; m: number; d: number };
export declare function diaLocal(instante: Date): string;
export declare function instante(dia: string, hora?: string): Date;
export declare function sumarDias(dia: string, n: number): string;
export declare function diasEntre(desde: string, hasta: string): number;
export declare function diaDeSemana(dia: string): number;
export declare function esHabil(dia: string): boolean;
export declare function mesDe(dia: string): string;
export declare function mesMas(mes: string, n: number): string;
export declare function diasDelMes(mes: string): number;
export declare function diaDelMes(mes: string, d: number): string;
export declare function dias(desde: string, hasta: string): string[];
export declare function meses(desdeMes: string, hastaMes: string): string[];
export declare function sumarHabiles(dia: string, n: number): string;
export declare function habilDesde(dia: string): string;
export declare function habilHasta(dia: string): string;
export declare function ultimoHabil(mes: string): string;
export declare function hoyLocal(): string;
