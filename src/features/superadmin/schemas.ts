import { z } from "zod";

export const moduleVariantsSchema = z.object({
  visitors: z.enum(["qr_full", "registro_simple"]),
  packages: z.enum(["con_evidencia", "aviso_simple"]),
  pqrs: z.enum(["con_sla", "buzon_simple"]),
  finance: z.enum(["completa", "solo_consulta"]),
  governance: z.enum(["formal", "informativo"]),
});

export const tenantCreateSchema = z.object({
  name: z.string().min(3, "Nombre minimo 3 caracteres"),
  city: z.string().min(2, "Ciudad obligatoria"),
  planId: z.string().min(1, "Selecciona un plan"),
  status: z.enum(["active", "suspended", "trial"]),
  onboardingStatus: z.enum(["not_started", "in_progress", "completed"]),
  currency: z.enum(["COP", "MXN", "USD"]),
  // Modos de operación elegidos al crear el conjunto. Opcional para no afectar el update,
  // que reutiliza este schema; el formulario de creacion siempre los provee por defaultValues.
  moduleVariants: moduleVariantsSchema.optional(),
});

export const tenantUpdateSchema = tenantCreateSchema;

export const adminCreateSchema = z.object({
  tenantId: z.string().trim().min(1, "Selecciona tenant"),
  fullName: z.string().trim().min(3, "Nombre minimo 3 caracteres"),
  email: z.string().trim().email("Correo invalido"),
  status: z.enum(["active", "inactive"]),
});

export const adminUpdateSchema = z.object({
  uid: z.string().trim().min(1),
  tenantId: z.string().trim().min(1, "Selecciona tenant"),
  fullName: z.string().trim().min(3, "Nombre minimo 3 caracteres"),
  email: z.string().trim().email("Correo invalido"),
  status: z.enum(["active", "inactive"]),
});

export const planCreateSchema = z.object({
  id: z.string().min(2, "Id minimo 2 caracteres").regex(/^[a-z0-9_-]+$/, "Usa minusculas, numeros, _ o -"),
  name: z.string().min(2, "Nombre requerido"),
  description: z.string().min(10, "Descripcion minima de 10 caracteres"),
  maxUnits: z.number().int().positive("Debe ser mayor que 0"),
  maxNotificationsPerMonth: z.number().int().positive("Debe ser mayor que 0"),
  slaLabel: z.string().min(2, "SLA requerido"),
  isActive: z.boolean(),
  featuresEnabledCsv: z.string().optional(),
});

export const planUpdateSchema = planCreateSchema.omit({ id: true });

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
