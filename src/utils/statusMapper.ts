const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  trial: "Prueba",
  suspended: "Suspendido",
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  scheduled: "Programado",
  open: "Abierto",
  in_progress: "En gestión",
  responded: "Respondido",
  resolved: "Resuelto",
  closed: "Cerrado",
  delivered: "Entregado",
  inside: "Dentro",
  completed: "Finalizado",
  expired: "Expirado",
  paid: "Al día",
  overdue: "En mora",
  draft: "Borrador",
  archived: "Archivado",
  not_started: "No iniciado",
  used_up: "Usada",
};

export function getStatusLabel(status: string) {
  const key = status?.trim().toLowerCase();
  if (!key) return "Sin estado";
  return STATUS_LABELS[key] ?? status;
}
