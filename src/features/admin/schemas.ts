import { z } from "zod";
import {
  combineDateAndTime,
  getBufferMinutes,
  isDateTimeValid,
} from "@/utils/datetimeValidation";

const requiredText = (label: string, min = 2) => z.string().trim().min(min, `${label} es obligatorio`);

export const unitSchema = z.object({
  displayName: requiredText("Nombre de unidad"),
  tower: z
    .string()
    .trim()
    .min(1, "Torre es obligatorio")
    .transform((val) => {
      const normalized = val.trim().replace(/^(torre\s*|t\s*)(\d+)$/i, (_, __, n) => `Torre ${n}`);
      return normalized || val.trim();
    }),
  type: z.enum(["apartment", "house", "office", "other"]),
  status: z.enum(["active", "inactive"]),
});

export const personSchema = z.object({
  fullName: requiredText("Nombre completo", 3),
  email: z.string().trim().email("Correo invalido"),
  phone: requiredText("Telefono", 7),
  documentNumber: z.string().trim().optional(),
  roleType: z.enum(["owner_occupant", "tenant", "investor", "other"]),
  occupancyType: z.enum(["owner_occupant", "tenant", "investor", "other"]),
  unitId: z.string().trim().min(1, "Selecciona una unidad"),
  tower: requiredText("Torre", 1),
  status: z.enum(["active", "inactive"]),
});

export const primaryHolderSchema = z.object({
  fullName: requiredText("Nombre completo", 3),
  email: z.string().trim().email("Correo invalido"),
  phone: requiredText("Telefono", 7),
  documentNumber: requiredText("Documento", 1),
  occupancyType: z.enum(["owner_occupant", "tenant", "investor", "other"]),
});

export const communicationSchema = z.object({
  title: requiredText("Titulo", 4),
  message: requiredText("Mensaje", 8),
  status: z.enum(["published", "draft", "archived", "scheduled", "expired"]),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  attachmentUrl: z.string().trim().optional(),
  attachmentName: z.string().trim().optional(),
});

export const reservationSchema = z
  .object({
    amenityName: requiredText("Amenidad", 3),
    unitId: z.string().trim().min(1, "Selecciona una unidad"),
    reservedBy: requiredText("Reservado por", 3),
    date: z.string().trim().min(1, "Fecha obligatoria"),
    startTime: z.string().trim().min(1, "Hora inicial obligatoria"),
    endTime: z.string().trim().min(1, "Hora final obligatoria"),
    status: z.enum(["pending", "approved", "cancelled"]),
    paymentConfirmed: z.boolean(),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "La hora final debe ser mayor a la inicial",
    path: ["endTime"],
  });

export const visitorSchema = z
  .object({
    visitorName: requiredText("Nombre visitante", 3),
    visitorDocument: requiredText("Cedula visitante", 5),
    qrCode: requiredText("Codigo QR", 5),
    authorizationType: z.enum(["puntual", "larga_duracion"]),
    visitorCategory: z.enum(["familiar", "servicio", "otro"]),
    unitId: z.string().trim().min(1, "Selecciona una unidad"),
    authorizedBy: requiredText("Autorizado por", 3),
    startDate: z.string().trim().min(1, "Fecha inicial obligatoria"),
    startTime: z.string().trim().min(1, "Hora inicial obligatoria"),
    endDate: z.string().trim().optional(),
    endTime: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    status: z.enum(["active", "expired", "cancelled"]),
  })
  .superRefine((value, ctx) => {
    const startDateTime = combineDateAndTime(value.startDate, value.startTime);
    if (!startDateTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes seleccionar una hora futura.",
        path: ["startTime"],
      });
      return;
    }

    if (!isDateTimeValid(startDateTime, "visitor")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La visita debe registrarse con al menos ${getBufferMinutes("visitor")} minutos de anticipacion.`,
        path: ["startTime"],
      });
    }

    if (value.authorizationType === "larga_duracion") {
      if (!value.endDate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha final es obligatoria para autorizaciones de larga duracion.",
          path: ["endDate"],
        });
      }

      if (!value.endTime?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La hora final es obligatoria para autorizaciones de larga duracion.",
          path: ["endTime"],
        });
      }

      if (value.endDate?.trim() && value.endTime?.trim()) {
        const endDateTime = combineDateAndTime(value.endDate, value.endTime);
        if (!endDateTime || endDateTime.getTime() <= startDateTime.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "La fecha/hora final debe ser posterior al inicio.",
            path: ["endTime"],
          });
        }
      }
    }
  });

export const documentSchema = z.object({
  description: requiredText("Descripcion", 4),
});

export const tenantBrandingSchema = z.object({
  tenantName: requiredText("Nombre del edificio", 3),
  tenantDisplayName: z.string().trim().optional(),
  brandColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color invalido. Usa formato hexadecimal #RRGGBB"),
  logoUrl: z.string().trim().nullable().optional(),
  logoPath: z.string().trim().nullable().optional(),
});

export const adminProfileSchema = z.object({
  fullName: requiredText("Nombre visible", 3),
  avatarId: z.string().trim().min(1, "Selecciona un avatar"),
});

export type UnitInput = z.infer<typeof unitSchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type PrimaryHolderInput = z.infer<typeof primaryHolderSchema>;
export type CommunicationInput = z.infer<typeof communicationSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type VisitorInput = z.infer<typeof visitorSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type TenantBrandingInput = z.infer<typeof tenantBrandingSchema>;
export type AdminProfileInput = z.infer<typeof adminProfileSchema>;
