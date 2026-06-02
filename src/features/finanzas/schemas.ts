import { z } from "zod";

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
  "otros",
]);

export const paymentMethodEnum = z.enum(["transferencia", "cheque", "efectivo", "otro"]);

export const expenseStatusEnum = z.enum(["registrado", "pagado", "anulado"]);

export const expenseSchema = z
  .object({
    category: expenseCategoryEnum,
    description: requiredText("Descripcion", 3),
    vendorName: z.string().trim().optional(),
    vendorTaxId: z.string().trim().optional(),
    amount: positiveAmount,
    issueDate: dateText,
    dueDate: optionalDateText,
    status: expenseStatusEnum,
    paymentMethod: z.union([paymentMethodEnum, z.literal("")]).optional(),
    checkNumber: z.string().trim().optional(),
    bankAccountId: z.string().trim().optional(),
  })
  .refine(
    (data) => data.paymentMethod !== "cheque" || Boolean(data.checkNumber?.trim()),
    { message: "El numero de cheque es obligatorio", path: ["checkNumber"] },
  );

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

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
  country: z.enum(["EC", "CO", "MX"]).optional(),
  voucherSeriesPrefix: z.string().trim().optional(),
});

export type FiscalProfileFormValues = z.infer<typeof fiscalProfileSchema>;
