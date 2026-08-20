import type { FiscalCountry, VoucherType } from "@/types/domain";

/**
 * Formato de recibo pluggable por país. `buildVoucher` es puro: calcula los campos
 * del comprobante sin I/O, de modo que cada país pueda formatear su documento sin
 * tocar el core contable.
 *
 * **Vivaru NO emite documentos fiscales** (decisión de David, 20 de agosto de 2026):
 * la factura la emite el cliente, en los tres países. Este seam era la capa fiscal
 * pluggable y el adaptador de Ecuador transmitía al SRI; el 20 de agosto se retiró
 * la transmisión entera. Lo que queda es un recibo interno, y el seam se conserva
 * porque el formato del recibo sí puede diferir por país aunque no haya factura.
 */
export interface VoucherInput {
  type: VoucherType;
  sequentialValue: number;
  sequentialNumber: string;
  issueDate: string;
  amount: number;
  concept: string;
  payer?: {
    name?: string | null;
    taxId?: string | null;
    unitId?: string | null;
    unitLabel?: string | null;
  };
  issuer?: {
    taxId?: string | null;
    legalName?: string | null;
    address?: string | null;
    country?: FiscalCountry | null;
  };
  sourceType?: "billingStatement" | "expense" | "manual" | null;
  sourceId?: string | null;
}

/** Campos del comprobante listos para persistir (sin id/tenant/timestamps/ledger/pdf). */
export interface VoucherDraft {
  type: VoucherType;
  sequentialNumber: string;
  sequentialValue: number;
  issueDate: string;
  amount: number;
  concept: string;
  payerName: string | null;
  payerTaxId: string | null;
  payerUnitId: string | null;
  payerUnitLabel: string | null;
  issuerTaxId: string | null;
  issuerLegalName: string | null;
  issuerAddress: string | null;
  issuerCountry: FiscalCountry | null;
  sourceType: "billingStatement" | "expense" | "manual" | null;
  sourceId: string | null;
}

export interface ComprobanteFiscalProvider {
  readonly id: string;
  buildVoucher(input: VoucherInput): VoucherDraft;
}

/** Recibo interno, válido para los tres países. No es un documento fiscal. */
export const reciboGenericoProvider: ComprobanteFiscalProvider = {
  id: "recibo-generico",
  buildVoucher(input) {
    return {
      type: input.type,
      sequentialNumber: input.sequentialNumber,
      sequentialValue: input.sequentialValue,
      issueDate: input.issueDate,
      amount: input.amount,
      concept: input.concept,
      payerName: input.payer?.name ?? null,
      payerTaxId: input.payer?.taxId ?? null,
      payerUnitId: input.payer?.unitId ?? null,
      payerUnitLabel: input.payer?.unitLabel ?? null,
      issuerTaxId: input.issuer?.taxId ?? null,
      issuerLegalName: input.issuer?.legalName ?? null,
      issuerAddress: input.issuer?.address ?? null,
      issuerCountry: input.issuer?.country ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
    };
  },
};

/**
 * Resuelve el formato de recibo por país. Hoy los tres usan el mismo, y por eso
 * este selector parece de más — se conserva porque es el punto donde enchufar un
 * formato propio sin tocar el core contable, y porque quitarlo obligaría a
 * reescribir a sus llamadores el día que haga falta.
 *
 * Hasta el 20 de agosto de 2026 aquí se devolvía `sriEcuadorProvider` para `EC`,
 * que marcaba el comprobante para transmitirlo al SRI. **Eso ya no existe.**
 */
export function getComprobanteProvider(_country?: FiscalCountry | null): ComprobanteFiscalProvider {
  return reciboGenericoProvider;
}
