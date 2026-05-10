import { z } from "zod";

export const supportTicketCreateSchema = z.object({
  tenantId: z.string().min(1, "Selecciona un tenant"),
  tenantName: z.string().min(1, "Nombre de tenant requerido"),
  reportedBy: z.string().email("Email inválido"),
  reportedByName: z.string().optional(),
  category: z.enum(["technical", "billing", "operational", "other"]),
  subject: z.string().min(5, "Mínimo 5 caracteres").max(100, "Máximo 100 caracteres"),
  description: z.string().min(10, "Mínimo 10 caracteres").max(1000, "Máximo 1000 caracteres"),
  priority: z.enum(["high", "medium", "low"]),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
});

export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;
