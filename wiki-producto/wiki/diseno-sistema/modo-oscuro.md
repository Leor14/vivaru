---
tags: [diseno-sistema, tema, accesibilidad]
tipo: tecnica
fuentes: ["PRD-V-FEAT-007"]
fecha_creacion: 2026-09-12
fecha_actualizacion: 2026-09-12
---

# Modo oscuro elegible

Hasta septiembre de 2026 no había interruptor de tema, y aun así producción ya respondía al modo oscuro
del sistema operativo sin que nadie lo decidiera: el CSS del landing llevaba **21 reglas
`prefers-color-scheme`** vivas. `PRD-V-FEAT-007` (épica `UX-006`) dio a cada usuario su tema, **claro u
oscuro, elegido por él**, y guardado en `users/{uid}.tema`. Y dejó quieto el landing: medido el 12 sep,
el CSS que sirve `grupovivaru.com` tiene **0** de esas reglas.

## Cómo funciona

- **El tema no sigue al sistema operativo.** La variante `dark` se declara solo por atributo
  (`@custom-variant dark` en `globals.css`), sobre `<html>`, y ninguna regla de `.admin-shell` la
  gobierna. La [[tipografia]] de marca se ve igual en los dos temas.
- **El espejo anti-destello.** `src/lib/ui/tema.ts` guarda una copia en `localStorage` (`vivaru.tema`) y
  un guion en `layout.tsx` la aplica antes del primer pintado; el dato canónico sigue siendo el documento
  del usuario. **Medido el 12 sep en staging:** un solo cambio en un dispositivo nuevo —de claro a oscuro, 436 ms
  después, al resolverse la sesión— y ninguno en los siguientes.
- El interruptor vive en `/admin/settings` ([[configuracion]]) y en el perfil del [[portal-residente]];
  el cambio es optimista y se revierte si falla.
- **Las reglas:** solo el dueño escribe su `tema`, con una lista cerrada de valores, y puede hacerlo
  aunque el conjunto esté suspendido, una excepción declarada a `tenantOperable` (ver
  [[ciclo-de-vida-tenant]]).
- **Lo impreso sale en claro.** La paleta oscura vive dentro de `@media screen`, así que al imprimir no
  aplica; los PDF se dibujan desde datos y no heredan el tema.

## Lo que costó: seis formas de color literal

Migrar 1.048 usos de color literal en 145 ficheros destapó **seis formas distintas** de pintar un color
sin token, de una en una. La quinta —un hexadecimal dentro del degradado del lienzo común— la vio David
en una captura, y ninguna prueba. `text-white` y `bg-white` cumplían papeles opuestos, y por eso existe
`--on-fill`, que no gira. Recharts pinta en atributos SVG, donde `var()` no vale. Ver [[tokens-color]] y
[[absolute-bans]].

## Bandera y estado

`producto-modo-oscuro` ([[banderas-funcionalidad]]), **global y sin overrides**, encendida en producción
desde el 3 sep. El 12 sep se cerraron las pruebas de reglas (`CA4`, `CA8`, `CA17`), el destello (`CA5`,
`CA6`), los PDF (`CA15`, por construcción), `CA7` —ningún documento ganó `tema` sin que su dueño lo
eligiera—, `CA16`, y la vista previa de impresión: `CA11` mirada con ojos y `CA19` por construcción.
**Con eso, todos sus criterios están cumplidos, y la ficha pasa a Productiva** ([[estado-modulos]]).

## Relaciones

- Se conecta con: [[tokens-color]], [[componentes]], [[tipografia]], [[informe-mensual]]
