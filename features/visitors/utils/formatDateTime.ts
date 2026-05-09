// Utilidad para formatear fechas y horas en zona local
export function formatDateTime(dt: Date | string) {
  if (!dt) return '';
  const date = typeof dt === 'string' ? new Date(dt) : dt;
  return date.toLocaleString();
}
