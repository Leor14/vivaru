// Utilidad para generar invitationCode legible y qrToken seguro
export function generateInvitationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
export function generateQRToken() {
  return crypto.randomUUID();
}
