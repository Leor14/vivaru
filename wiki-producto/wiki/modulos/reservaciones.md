---
tags: [modulo, admin, residente, reservaciones, amenidades]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md", "PRD-V-FIX-001"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-09-12
---

# Reservaciones

Reservas de áreas comunes y mudanzas. El residente las pide desde [[portal-residente]], el administrador las aprueba o rechaza en `/admin/reservations` y la portería ve las del día en [[portal-guardia]]. **Desde agosto de 2026 las reglas de reserva se cumplen en el servidor** (`PRD-V-FIX-001`); la pantalla solo las muestra, y si discrepan manda el servidor.

## Entidades principales

El tipo `Reservation` de [[domain-types]] lleva `amenityId`, `date`, `startTime`/`endTime`, `kind` (`amenity | mudanza`), el subobjeto `mudanza` y `status` (`pending | approved | rejected | cancelled`). Las que crea el servidor llevan `createdVia` y un `startAt` calculado en la zona del conjunto. Desde el 12 de septiembre de 2026 el área (`amenities`) puede llevar su propia política.

## Quién escribe

- **El residente no escribe la reserva**: pasa por la callable `createReservationRequest`, y la mudanza por `createMudanzaRequest`. Su rama del `create` en las reglas se retiró el 24 de agosto, así que volver atrás no es apagar una bandera sino redesplegar reglas. Ver [[firebase-firestore]].
- **El administrador sí escribe directo**, y las reglas le exigen `amenityId`: sin él, sus reservas no ocupaban aforo ni cupo.
- **La compuerta de morosos** (`eligibility.ts`) existía y solo se comprobaba en el cliente; ahora la comprueba el servidor contra el saldo vencido de la unidad. Ver [[billing]].

## La política por área (entrega 2)

| Campo | Qué hace | Sin tocarlo |
|---|---|---|
| `blockOnDebt` | Si deja reservar a unidades en mora; **manda sobre la del conjunto** | Hereda la del conjunto |
| `minAdvanceMinutes` | Anticipación mínima, entera, de 0 a 10.080 (una semana) | 30 minutos |
| `autoApprove` | La reserva nace `approved` y el residente recibe «Reserva aprobada» | Nace `pending` |

Sin configurar, todo sigue como antes; el 12 de septiembre ninguna área de producción la tenía. El aviso sale por [[notificaciones-residentes]], y el espejo del cliente (`politica-del-area.ts`) compara sus constantes con las del servidor en una prueba.

## La hora es la del conjunto

Cloud Functions corre en UTC. La hora que elige el residente se lee en la zona del país del conjunto —`zonaDelConjunto`: CO → Bogotá, EC → Guayaquil, el resto → Ciudad de México— y **el día de la semana sale de la fecha escrita, no del instante**. Hasta la entrega 1.1 se leía en UTC y se rechazaban reservas del mismo día a menos de unas seis horas. Un conjunto sin `country` cae a México: en producción son cuatro. Ver [[multi-tenancy]] y [[trampas-conocidas]].

## Caso especial: mudanzas

La mudanza (`kind: mudanza`) lleva depósito, ascensor y notas de hasta 2.000 caracteres. **Estuvo rota del 24 de agosto al 12 de septiembre**: al retirar la rama del residente de las reglas, el asistente seguía escribiendo directo. El detalle se abre con el [[drawer-pattern|patrón Drawer]].

## Mover una reserva nunca funcionó

La regla de `update` usaba helpers de fecha que **fallan siempre** —las reglas no suman texto y número— y un error de evaluación deniega igual que una política. Se reescribieron en la entrega 1.1. Ver [[pruebas-reglas-emulador]] y [[falsacion-de-pruebas]].

## Estado de la pantalla

La página no ha pasado por critique → execute → commit ([[estado-modulos]]): puede tener violaciones de [[absolute-bans]] y de [[mobile-first-ios]]. Debe seguir el [[layout-patterns|patrón admin page]] con [[data-table-pattern|DataTable]].

## Relaciones

- Véase también: [[domain-types]], [[drawer-pattern]], [[data-table-pattern]], [[notificaciones-residentes]]
- Depende de: [[firebase-firestore]], [[multi-tenancy]], [[billing]]
- Se conecta con: [[portal-residente]], [[portal-guardia]], [[layout-patterns]], [[absolute-bans]], [[estado-modulos]], [[trampas-conocidas]]

## Fuentes

- [[domain-types]], [[backlog-md]]
- `docs/prd/funcionales/PRD-V-FIX-001-reglas-de-reserva-en-servidor.md` — §16 (entrega 1.1) y §17 (entrega 2)
