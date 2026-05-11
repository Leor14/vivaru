# RES-02 — Manual Validation Checklist

## Sección A — Setup de prueba

1. Abre Firebase Console → proyecto `hogaru-1` → Firestore → colección `tenantSettings`
2. Localiza el doc `{tenantId}` del tenant de prueba. Verifica que el campo `reservationPolicy.blockOnDebt` existe (puede estar en `false` o ausente — si está ausente el feature se comporta como desactivado).
3. En la app: Admin > Configuración → sección **"Políticas de Reservas"** → activa el toggle "Bloquear reservas a unidades con saldo vencido".
4. Vuelve a Firebase Console → abre el doc `tenantSettings/{tenantId}` → verifica:
   - `reservationPolicy.blockOnDebt = true`
   - Los demás campos del documento (`tenantName`, `logoUrl`, `brandColor`, etc.) **no cambiaron** (la escritura usó `updateDoc` con dot-notation, no reemplazó el doc).

---

## Sección B — Flujo de bloqueo

5. Toma una unidad de prueba (ej: `T1-101`). En `billingStatements`, asegúrate de que tenga al menos 1 doc con:
   - `unitId = "t1-101"` (o el valor que corresponda al campo `unitId` del doc de unidad)
   - `status = "overdue"`
   - `balance > 0`
6. Haz login como el residente titular de esa unidad.
7. Navega a **Reservas**. El banner de bloqueo debe aparecer en la parte superior con:
   - El monto total vencido formateado en COP (ej: "$ 225.000")
   - Un enlace visible hacia el módulo de cartera
8. El formulario de reserva debe seguir visible **debajo del banner** (no desaparece ni se deshabilita por el bloqueo).
9. Intenta crear una reserva (completa el formulario y presiona "Reservar"). El submit debe fallar con el mensaje de error en español:
   > "Tu unidad tiene un saldo pendiente. Regulariza tu pago para hacer reservas."
   
   No debe aparecer un error técnico ni un stack trace.
10. Verifica en Firestore → colección `reservations` que **no se creó ningún documento nuevo** durante el intento.

---

## Sección C — Flujo de desbloqueo y exención

11. En el módulo de **Cartera** (Admin > Cartera), registra el pago de la cuota vencida o cambia manualmente el campo `status` del doc en `billingStatements` de `"overdue"` a `"paid"`.
12. Recarga la página de Reservas (o navega de nuevo a ella). El banner de bloqueo **debe desaparecer**.
13. Crea una reserva → debe completarse normalmente. Verifica el doc en `reservations`.
14. Admin > Residentes → busca la unidad de prueba → acción "Editar unidad" → activa el checkbox **"Exenta de bloqueo por adeudo"** → guarda.
    - En Firestore → doc en `units/{id}` → verifica que `reservationExempt = true`.
15. Vuelve a crear una cuota vencida para esa unidad (`status = "overdue"`, `balance > 0` en `billingStatements`).
16. Login como el residente de esa unidad → navega a Reservas → el banner **NO debe aparecer** (unidad exenta).
17. Admin > Configuración → desactiva el toggle "Bloquear reservas por adeudo" (pone `blockOnDebt = false`).
18. Login como cualquier residente con deuda → navega a Reservas → el banner **NO debe aparecer** (política global desactivada).

---

## Deuda técnica conocida

### Stale eligibility check en page load

El banner se calcula una sola vez al montar el componente (`useEffect` on-mount). Si un administrador registra el pago de una cuota **mientras el formulario de reserva está abierto**, el banner no desaparecerá hasta que el residente recargue la página.

La barrera autoritativa es el check en `createReservation()` (capa de escritura): si el residente intenta crear una reserva con el estado stale del formulario, el error `"RESERVATION_INELIGIBLE"` aparecerá en el submit, no antes. El documento **no se escribirá en Firestore**.

Mitigación futura: suscripción reactiva (`onSnapshot` sobre billingStatements) en el componente para re-evaluar en tiempo real.

### reservationExempt fuera del schema de UnitInput

`UnitInput` (Zod) no incluye `reservationExempt`. La exención se persiste vía `updateDoc` separado, después de la llamada a `updateUnit()`.

Si en el futuro se refactoriza `updateUnit()` para enviar el objeto completo de la unidad (reemplazando campos), revisar que el nuevo payload incluya `reservationExempt` — de lo contrario, ese campo quedaría sin actualizar o podría ser sobrescrito a `undefined`.
