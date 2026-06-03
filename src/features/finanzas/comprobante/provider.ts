import type { FiscalCountry, VoucherType } from "@/types/domain";

/**
 * Capa fiscal pluggable por país (F1 = recibo genérico; F2 = comprobante SRI EC).
 * `buildVoucher` es puro: calcula los campos del comprobante sin I/O, de modo que
 * cada país pueda formatear su documento sin tocar el core contable.
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
  fiscalStatus: "none" | "pending" | "transmitted" | "error";
}

export interface ComprobanteFiscalProvider {
  readonly id: string;
  buildVoucher(input: VoucherInput): VoucherDraft;
}

/** Recibo genérico válido para CO/MX y base para EC (sin transmisión fiscal). */
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
      fiscalStatus: "none",
    };
  },
};

/**
 * Adaptador Ecuador (F2). Igual al recibo genérico pero marca el comprobante
 * como `pending` para que la Cloud Function de transmisión al SRI lo tome.
 * La transmisión en sí vive server-side (ver functions/), no aquí.
 */
export const sriEcuadorProvider: ComprobanteFiscalProvider = {
  id: "sri-ecuador",
  buildVoucher(input) {
    return { ...reciboGenericoProvider.buildVoucher(input), fiscalStatus: "pending" };
  },
};

/**
 * Resuelve el provider fiscal por país. CO/MX usan el recibo genérico (sin
 * transmisión); EC usa el adaptador SRI. El seam permite enchufar nuevos
 * países sin tocar el core contable.
 */
export function getComprobanteProvider(country?: FiscalCountry | null): ComprobanteFiscalProvider {
  return country === "EC" ? sriEcuadorProvider : reciboGenericoProvider;
}
