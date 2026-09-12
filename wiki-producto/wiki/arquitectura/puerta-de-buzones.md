---
tags: [arquitectura, correo, datos]
tipo: decision
fuentes: ["PRD-V-PLAT-006"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# La puerta de buzones

Producción no tiene clientes, pero sus conjuntos de ejemplo guardaban direcciones de correo de personas
reales: un envío masivo habría escrito a desconocidos o rebotado contra la reputación del dominio.
`DATO-001` limpió siete por su forma y dejó once. `PRD-V-PLAT-006` (3 sep 2026) construyó una
**puerta**: en un conjunto marcado como «sin cliente detrás», solo entran y salen direcciones de prueba o
del equipo.

## Las dos puertas

- **La de entrada es una regla**, `puertaDeBuzonesPermite`, en el `create` de `people` y en el `update`
  **solo si el correo cambia**: `updateDoc` fusiona y la regla ve el documento resultante, así que
  mirarlo siempre bloquearía cambiarle el teléfono a quien ya está dentro (ver [[firebase-firestore]]).
  Hace falta porque `people` lo escribe el cliente, con el formulario y con la importación masiva del
  [[onboarding-guiado]].
- **La de salida está en el servidor**: `puertaDeBuzones`, delante de los envíos de
  `functions/src/email.ts`, deja una fila `rechazado-puerta` por cada rechazo. `users` y `tenantUsers`
  los escriben callables con Admin SDK, que no evalúan reglas; es la lección de `CF8` que recoge
  [[trampas-conocidas]].
- `functions/src/buzones-admisibles.ts` es el espejo del servidor, y se llama en las cuatro callables de
  alta. En el front, un rechazo se traduce a un mensaje legible en vez de «Ocurrió un error inesperado».

## Lo que la gobierna

- La marca `tenants/{id}.sinClienteDetras`, puesta con `functions/scripts/marcar-conjuntos-sin-cliente.mjs`;
  ninguna pantalla la escribe. **`isExample` no servía de criterio**: lo llevan todos, pruebas incluidas.
- `config/correosDelEquipo`, la lista del equipo, que solo lee y escribe el [[superadmin]]. Nació
  ilegible para todos, y su criterio `CA8` pasaba por la razón equivocada: ver
  [[falsacion-de-pruebas]].
- La bandera `producto-puerta-de-buzones` ([[banderas-funcionalidad]]): **apagada en producción**, con el
  canario en Santa María de staging.

## Estado

Código completo en los dos ambientes. En producción hay siete conjuntos marcados, diez direcciones
saneadas al dominio inerte y la lista del equipo cargada. **Para encenderla falta identificar una cuenta
de portería de Privada Las Playas** —la única dirección que quedaría sin admitir—, y decidir si se marca
el décimo conjunto, *Lomas de Sayilbedra*, que nació después. Ver [[correos-mensajeria]] y
[[notificaciones-residentes]].

## Relaciones

- Se conecta con: [[correos-mensajeria]], [[notificaciones-residentes]], [[multi-tenancy]], [[ciclo-de-vida-tenant]]
