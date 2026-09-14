// Tipos de `lomas-operacion.mjs`, para las pruebas de `functions/tests/` (como `reloj.d.mts`). Solo
// lo que las pruebas usan; el resto del guion se queda sin tipar a propósito.

export declare const REGLAMENTO: {
  clave: string;
  fecha: string;
  titulo: string;
  archivo: string;
  parrafos: string[];
  firmas: number;
};

export declare const COMUNICADOS: Array<{ fecha: string; hora: string; titulo: string; texto: string; inicio?: string; fin?: string }>;

export declare const SERVICIOS: Array<{
  clave: string;
  category: string;
  seccion?: string;
  title: string;
  serviceType: string;
  providerName: string;
  description: string;
}>;

export declare const ACUERDOS: Array<{
  clave: string;
  sesion: string;
  enviado: string;
  modo: string;
  titulo: string;
  detalle: string;
  firmas?: number;
  sinDemo?: boolean;
}>;
