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

  /**
   * **Las diez que faltaban, contadas el 28 de agosto de 2026.**
   *
   * Se vio una —`critical`, en el cajón de alertas del Panel de Control, en inglés y en minúscula
   * junto a «En mora» y «Pendiente»— y al contar el resto aparecieron nueve más. **Tres se le
   * enseñaban al usuario en inglés**: `critical`, `published` y `valid`.
   *
   * Nadie las había visto porque `getStatusLabel` **cae en silencio a la clave cruda** cuando no
   * la encuentra: no lanza, no avisa, y en las siete que ya venían en español el resultado era
   * casi correcto — solo perdía la mayúscula—. Un fallo que se disimula a sí mismo dura años.
   */
  // `PRD-V-FLOW-004` — los cinco estados del expediente de conciliación. Van
  // aquí y no en su módulo por la misma razón que los demás: el mapa cae en
  // silencio a la clave cruda, así que un estado sin etiqueta no da error —
  // sale en pantalla tal cual y nadie se entera.
  detectado: "Sin revisar",
  propuesto: "Con un movimiento que encaja",
  aplicado: "Conciliada",
  rechazado: "Descartada",
  reversado: "Se deshizo sola",
  critical: "Crítico",
  published: "Publicado",
  valid: "Válido",
  borrador: "Borrador",
  emitido: "Emitido",
  enviado: "Enviado",
  nuevo: "Nuevo",
  perdido: "Perdido",
  registrado: "Registrado",
  vigente: "Vigente",
};

export function getStatusLabel(status: string) {
  const key = status?.trim().toLowerCase();
  if (!key) return "Sin estado";
  return STATUS_LABELS[key] ?? status;
}
