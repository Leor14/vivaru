import { z } from "zod";

import { explicarProblema, validarPlan } from "./cuotas-del-egreso";

const requiredText = (label: string, min = 2) =>
  z.string().trim().min(min, `${label} es obligatorio`);

const positiveAmount = z.number().positive("El monto debe ser mayor a cero");

const dateText = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida (YYYY-MM-DD)");

/** Fecha opcional que también acepta cadena vacía desde un input vacío. */
const optionalDateText = z.union([dateText, z.literal("")]).optional();

export const expenseCategoryEnum = z.enum([
  "nomina",
  "servicios_publicos",
  "mantenimiento",
  "proveedores",
  "administracion",
  "seguros",
  "impuestos",
  "vigilancia",
  "otros",
]);

export const paymentMethodEnum = z.enum(["transferencia", "cheque", "efectivo", "otro"]);

export const expenseStatusEnum = z.enum(["registrado", "pagado", "anulado"]);

export const expenseSchema = z
  .object({
    category: expenseCategoryEnum,
    description: requiredText("Descripcion", 3),
    /** Id en `vendors` (FEAT-003). El nombre y el taxId de abajo quedan como copia congelada (R2). */
    vendorId: z.string().trim().optional(),
    vendorName: z.string().trim().optional(),
    vendorTaxId: z.string().trim().optional(),
    amount: positiveAmount,
    issueDate: dateText,
    dueDate: optionalDateText,
    status: expenseStatusEnum,
    paymentMethod: z.union([paymentMethodEnum, z.literal("")]).optional(),
    checkNumber: z.string().trim().optional(),
    bankAccountId: z.string().trim().optional(),
    /**
     * `PRD-V-FLOW-008` · el calendario de pagos. **Vacío o ausente = egreso sin
     * plan, como hasta hoy.** La entrega 1 solo declara cuotas `pendiente`: el
     * pago es la entrega 2 y lo sella el servidor.
     */
    installments: z
      .array(
        z.object({
          number: z.number().int().positive(),
          dueDate: dateText,
          amount: positiveAmount,
        }),
      )
      .optional(),
  })
  .refine(
    (data) => data.paymentMethod !== "cheque" || Boolean(data.checkNumber?.trim()),
    { message: "El numero de cheque es obligatorio", path: ["checkNumber"] },
  )
  /**
   * `RN-01`–`RN-03` · **el plan tiene que cuadrar con la factura.**
   *
   * Va en el esquema y no solo en la pantalla porque un plan que no cuadra
   * **descuadra la deuda del conjunto para siempre**, y esa cifra la lee el
   * consejo en el informe mensual. El mensaje **NOMBRA la diferencia**: «no
   * cuadra» obliga a sacar la calculadora; «faltan 11» no.
   *
   * `superRefine` y no `refine` porque el mensaje **depende de los datos**, y eso
   * `refine` no lo admite.
   */
  .superRefine((data, ctx) => {
    if (!data.installments || data.installments.length === 0) return;
    const problemas = validarPlan(
      data.installments.map((c) => ({ ...c, status: "pendiente" as const })),
      data.amount,
    );
    for (const p of problemas) {
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        message: explicarProblema(p, (n) => n.toLocaleString("es-CO")),
      });
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

/**
 * PRD-V-FEAT-003. `type` obligatorio (R9): decide si el registro contiene
 * datos personales — un empleado entra en la política de retención; una
 * empresa no. La unicidad del taxId (R4) no vive aquí: se comprueba contra la
 * lista suscrita antes de escribir (findDuplicateTaxId).
 */
export const vendorSchema = z.object({
  type: z.enum(["proveedor", "empleado"]),
  taxId: z.string().trim().optional(),
  legalName: requiredText("Razon social o nombre", 3),
  tradeName: z.string().trim().optional(),
  email: z.union([z.string().trim().email("Correo invalido"), z.literal("")]).optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  representative: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  accountType: z.union([z.enum(["corriente", "ahorros"]), z.literal("")]).optional(),
  defaultCategory: z.union([expenseCategoryEnum, z.literal("")]).optional(),
  status: z.enum(["active", "inactive"]),
});

export type VendorFormInput = z.infer<typeof vendorSchema>;

export const bankAccountSchema = z.object({
  label: requiredText("Nombre de la cuenta", 2),
  bankName: requiredText("Banco", 2),
  accountNumber: z.string().trim().optional(),
  accountType: z.enum(["corriente", "ahorros"]).optional(),
  currency: z.enum(["COP", "MXN", "USD"]).optional(),
  openingBalance: z.number().optional(),
  active: z.boolean(),
});

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

export const ledgerEntrySchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  date: dateText,
  amount: positiveAmount,
  concept: requiredText("Concepto", 3),
  category: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
});

export type LedgerEntryFormValues = z.infer<typeof ledgerEntrySchema>;

export const fiscalProfileSchema = z.object({
  taxId: z.string().trim().optional(),
  legalName: z.string().trim().optional(),
  address: z.string().trim().optional(),
  country: z.union([z.enum(["EC", "CO", "MX"]), z.literal("")]).optional(),
  voucherSeriesPrefix: z.string().trim().optional(),
  dataRetentionMonths: z.number().positive().optional(),
});

export type FiscalProfileFormValues = z.infer<typeof fiscalProfileSchema>;
