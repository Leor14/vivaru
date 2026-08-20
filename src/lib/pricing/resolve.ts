import type { AppCurrency } from "@/lib/currency";

import {
  MONEDA_POR_PAIS,
  TARIFAS,
  TRAMOS,
  type Frecuencia,
  type PaisTarifado,
  type Segmento,
  type TarifaPorUnidad,
} from "./catalog";

/**
 * Resuelve la **tarifa de referencia** de la guía, por país, tamaño y frecuencia.
 *
 * **No es «lo que paga este conjunto», y la diferencia no es de matiz.** A cada
 * conjunto vendido se le pueden aplicar reglas de diferencia de precio, así que
 * dos conjuntos idénticos en país y tamaño pueden pagar distinto. Esto sirve
 * para **cotizar**, no para facturar ni para pintar en la ficha de un conjunto.
 *
 * **Esta función puede decir que no sabe, y es su parte más importante.** La guía
 * maestra solo publica el segmento Core en trimestral; el resto de la tabla está
 * vacío. Devolver una cifra inventada para un conjunto de 300 unidades produciría
 * una cotización que parece válida y no lo es — y nadie la revisaría, porque el
 * sistema la habría calculado.
 */

export type CapasPorUnidad = {
  /** Lo que le queda a Vivaru. `null` si la guía no publica base para ese país. */
  base: number | null;
  /** Lo que se lleva el canal. Se DERIVA restando; no se guarda por separado. */
  canal: number | null;
  /** Lo que paga el cliente. */
  final: number;
};

export type ResultadoTarifa =
  | {
      estado: "tarifada";
      pais: PaisTarifado;
      segmento: Segmento;
      frecuencia: Frecuencia;
      unidades: number;
      currency: AppCurrency;
      porUnidad: CapasPorUnidad;
      /**
       * Precio de referencia por unidad × unidades, mensual.
       *
       * Se llama «de referencia» a propósito: es lo que costaría **según la
       * guía**, no lo que un conjunto concreto paga.
       */
      totalMensualReferencia: number;
    }
  | {
      estado: "sin-tarifa";
      motivo: string;
      /** El segmento sí se resuelve aunque no haya tarifa: sirve para pedirla. */
      segmento: Segmento | null;
    };

/**
 * En qué tramo cae un conjunto por su número de unidades.
 *
 * Devuelve `null` por debajo de 50: la guía **no tarifa** conjuntos más pequeños.
 * Meterlos en «emergente» sería extender la tabla por nuestra cuenta.
 */
export function segmentoPorUnidades(unidades: number): Segmento | null {
  if (!Number.isFinite(unidades) || unidades <= 0) return null;
  const n = Math.floor(unidades);
  for (const tramo of TRAMOS) {
    if (n >= tramo.min && (tramo.max === null || n <= tramo.max)) return tramo.segmento;
  }
  return null;
}

/**
 * Lo que se lleva el canal, por diferencia. Sin base publicada no hay resta
 * posible — y estimarla sería inventar el margen de un tercero.
 */
export function compensacionCanal(tarifa: TarifaPorUnidad): number | null {
  if (tarifa.baseVivaru === null) return null;
  return redondear(tarifa.finalCliente - tarifa.baseVivaru);
}

export function resolverTarifa(input: {
  pais: PaisTarifado;
  unidades: number;
  frecuencia: Frecuencia;
}): ResultadoTarifa {
  const segmento = segmentoPorUnidades(input.unidades);
  if (!segmento) {
    return {
      estado: "sin-tarifa",
      segmento: null,
      motivo: "La guía de precios no tarifa conjuntos de ese tamaño.",
    };
  }

  const tarifa = TARIFAS[input.frecuencia]?.[segmento]?.[input.pais] ?? null;
  if (!tarifa) {
    return {
      estado: "sin-tarifa",
      segmento,
      motivo: `La guía de precios todavía no publica tarifa para ${segmento} en ${input.frecuencia}.`,
    };
  }

  const unidades = Math.floor(input.unidades);
  return {
    estado: "tarifada",
    pais: input.pais,
    segmento,
    frecuencia: input.frecuencia,
    unidades,
    currency: MONEDA_POR_PAIS[input.pais],
    porUnidad: {
      base: tarifa.baseVivaru,
      canal: compensacionCanal(tarifa),
      final: tarifa.finalCliente,
    },
    totalMensualReferencia: redondear(tarifa.finalCliente * unidades),
  };
}

/**
 * Dos decimales. No es cosmética: `3.15 * 150` en coma flotante no da `472.5`
 * exacto, y una cotización con una cola de decimales parece un error de cálculo
 * aunque el número sea correcto.
 */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
