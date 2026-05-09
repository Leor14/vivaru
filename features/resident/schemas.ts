import { z } from "zod";

export const residentProfileSchema = z.object({
  fullName: z.string().min(2, "El nombre es requerido"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^[+()\-\s\d]{7,20}$/.test(value), "Telefono invalido"),
  documentNumber: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  avatarId: z.string().optional(),
});

export type ResidentProfileForm = z.infer<typeof residentProfileSchema>;

export const residentEmailSchema = z.object({
  email: z.string().email("Ingresa un correo valido"),
  currentPassword: z.string().min(6, "Ingresa tu contrasena actual"),
});

export type ResidentEmailForm = z.infer<typeof residentEmailSchema>;

export const residentPasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Ingresa tu contrasena actual"),
    newPassword: z.string().min(8, "La nueva contrasena debe tener minimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirma la nueva contrasena"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "La confirmacion de contrasena no coincide",
    path: ["confirmPassword"],
  });

export type ResidentPasswordForm = z.infer<typeof residentPasswordSchema>;
