# Hallazgo — hay direcciones de DESCONOCIDOS en los datos de producción

> ## ✅ RESUELTO el 27 de agosto de 2026
>
> **Cero direcciones de riesgo en producción**, medido en las tres colecciones. Las siete personas
> pasaron a `@ejemplo.vivaru.app` con `functions/scripts/sanear-correos-de-prueba.mjs`: **22
> documentos y 6 cuentas de Firebase Auth**, con `emailPrevio` guardado en los 22, así que tiene
> vuelta atrás (`--revertir --escribir`).
>
> **Y se falsó, que es lo que lo prueba:** las seis direcciones viejas **ya no resuelven en Auth**.
> Comprobar solo que las nuevas responden habría dado verde aunque las viejas siguieran vivas —
> que es exactamente el modo de fallo de cambiar Firestore sin tocar Auth.
>
> **David confirmó que las cuentas eran del equipo**, así que no hubo incidente. Pero el arreglo
> seguía haciendo falta por la razón de abajo: **las cuentas eran nuestras y los buzones no.**
>
> **LO QUE ESTO NO CIERRA, Y ES LO QUE HAY QUE LEER:** limpia lo que había, **no la puerta**. El
> día que alguien cree otro residente de prueba tecleando `pedro@gmail.com`, vuelve a pasar — y el
> correo de alta sale igual, porque `sendAccountEmail` **no está detrás de ninguna bandera**. Para
> cerrarla de verdad hay que rechazar dominios de buzón real en el formulario de alta cuando el
> conjunto es `isExample`. Eso es una PRD pequeña, no un script. Ver [[el-parche-que-caduca]].

**Encontrado el 27 de agosto de 2026**, preparando la validación de `FLOW-003`. No es un defecto
de código: es un problema de **datos**, y estaba ahí antes de esta ficha.

**Las direcciones NO se escriben aquí.** Se referencian por conjunto y unidad, que es lo que hace
falta para actuar. Repetirlas en un documento del repositorio las extiende a un sitio más sin
ninguna ganancia.

---

## Qué es

Varias unidades de producción tienen como correo del residente una dirección de **proveedor real
con parte local genérica** — nombre de pila suelto, sin puntos ni números, en `@gmail.com`.

Esas direcciones **se agotaron hace veinte años**. Una cuenta de gmail con solo un nombre de pila
casi con seguridad **pertenece a una persona real que no tiene nada que ver con el conjunto**.

## El alcance, medido

| Colección | Activos | Dominio propio (rebota) | Proveedor · local específico | **Proveedor · local genérico** | Dedazo |
|---|---|---|---|---|---|
| `users` | 40 | 24 | 9 | **6** | **1** (`@gmial.com`) |
| `people` | 68 | 38 | 22 | **8** | 0 |

Los de riesgo alto se concentran en **`tenant-santa-maria`** (6 de 7 en `users`); el otro está en
`6PmHBr6DB8WNVMznz8O8`. Se identifican por su unidad, sin escribir la dirección:

| Conjunto | Unidad |
|---|---|
| `tenant-santa-maria` | `T1-403` · `Apartamento 503` · `APARTAMENTO 102` · `1011` · `1014` · `T3` (dedazo) |
| `6PmHBr6DB8WNVMznz8O8` | `Apartamento 502` |

## Por qué importa — son TRES daños distintos, y el peor no es el obvio

1. **El que se ve venir: el rebote.** Los 24 de dominio propio (`@ejemplo.vivaru.app`,
   `@santamaria.co`, `@elnogal.co`…) no existen. Cada envío es un bounce, y los bounces castigan
   la reputación de envío del dominio en Resend.
2. **EL PEOR, Y ES EL QUE NO SE VE: que LLEGUE.** A un extraño le aparece un correo diciéndole que
   **debe la cuota de un conjunto donde no vive**, con un importe y un enlace. Si marca «spam»
   —que es lo razonable—, eso pesa en la reputación **mucho más que un rebote**, y además es
   mandarle a una persona ajena un dato que parece suyo y no lo es.
3. **`FLOW-003` lo hace peor sin querer.** El adjunto de `FEAT-004` va detrás de
   `producto-calendario-de-cobranza`: cuando esa bandera se encienda, el aviso de cobranza viaja
   **con el estado de cuenta de la unidad en PDF**. Eso ya no es un correo molesto: es **mandarle
   a un desconocido el detalle financiero de la unidad de otra persona**.

> **El punto 3 es el que convierte esto en bloqueante.** Mientras las direcciones sean lo que son,
> **encender `producto-calendario-de-cobranza` es una fuga de datos con forma de funcionalidad.**

## Lo que NO es

- **No lo causó ninguna bandera de `FLOW-003`.** Verificado leyendo el orden en `email.ts`: el
  `fetch` a Resend está en la línea 21 y `registrarEnvio` en la 55. La bandera
  `producto-entrega-de-correo` gobierna el **registro**, no el envío.

- **No es que los conjuntos sean de prueba.** Los nueve son `isExample: true`, sí — pero
  `isExample` es una marca en el documento del conjunto. **La dirección de gmail que hay dentro es
  de una persona de verdad**, y a esa persona la marca no la protege de nada.

> **CORRECCIÓN — este documento decía «esas direcciones ya lo reciben hoy», y era FALSO.** Se
> dedujo en vez de medirse. Al validar `FLOW-003` la tarde del 27 salió lo contrario: **hoy no le
> llega correo a ningún residente en toda la producción**. Las **13** claves del catálogo de
> notificaciones tienen `emailDefault: false`, y **cero** de los 8 `tenantSettings` tienen
> `notificationTemplates`, así que `deliverResidentNotifications` **se para en
> `index.ts:595`** —`if (!copy.emailEnabled) return;`— antes de intentar ningún envío.
>
> **El riesgo es LATENTE, no activo. Y eso no lo hace menor: lo hace silencioso.** Se activa
> entero el día que alguien encienda «También por correo» en **Ajustes**, que es un interruptor de
> una pantalla, sin aviso ni confirmación. **Arreglar las direcciones ANTES de tocar ese
> interruptor** es lo que separa un cambio de configuración de un incidente.


## Qué se hizo — la salida 1, y por qué

**Se eligió la primera.** Y la medición de la ejecución corrigió dos cosas de esta ficha:

- **Seis de las siete tenían cuenta de Firebase Auth**, cuatro con accesos reales y una con acceso
  el 26 de agosto a las 18:22. **Eso no eran extraños: era el equipo.** La ficha decía «casi con
  seguridad pertenecen a una persona real que no tiene nada que ver con el conjunto», y era una
  inferencia por la FORMA de la dirección. La forma no distingue quién usa la cuenta.
- **`isDemoAccount` no sirve para distinguirlas**: solo 4 de las 40 membresías lo tienen en `true`,
  y **ninguna** de las siete. Si hiciera falta volver a separar cuentas de prueba de cuentas
  reales, ese campo no es el criterio.

**Lo que NO cambió con eso:** las cuentas eran del equipo, pero **los buzones no**. Nadie del
equipo controla `jorge@gmail.com`; se tecleó, y la contraseña se puso desde la consola.

## Qué hacer — tres salidas, y la primera es la buena

1. **Sustituirlas por direcciones de un dominio que no exista de verdad** —
   `@ejemplo.vivaru.app`, que es el que ya usan 4 usuarios—. Deja de alcanzar a nadie, y de paso
   los rebotes se vuelven predecibles en vez de aleatorios. **Es la que menos supone.**
2. **Apuntarlas a buzones que el equipo controle** (`+alias` sobre una cuenta propia). Sirve si se
   quiere seguir validando envíos de verdad contra esos conjuntos.
3. **Borrar esos residentes.** Solo si nadie los usa para probar la pantalla del residente. Ojo
   con [[archivar-no-es-esconder]]: detrás de una membresía hay una persona, aunque sea de mentira.

**Mientras no se haga ninguna, la regla operativa es:** en Cartera, **nunca** los botones masivos
—«Recordatorio a cartera vencida», «a morosos», el de campaña—. Solo el botón **de la fila**, y
solo sobre una unidad cuya dirección se haya mirado antes.

## Cómo se volvió a medir

Sin escribir nada. Clasifica el dominio y la forma de la parte local, y enmascara antes de
imprimir:

```js
const PROVEEDOR = /^(gmail|hotmail|outlook|yahoo|icloud|live|msn)\./i;
const TYPO      = /^(gmial|gmai|hotmial|outlok|yaho)\./i;
// riesgo alto = proveedor real + parte local de solo letras (3–10), sin punto ni número
const generico  = /^[a-z]{3,10}$/i.test(local);
```

Se corre contra `users` y `people`, filtrando por `status === "active"`.

---

## Anexo — otro residuo encontrado en la misma pasada, y este SÍ está tapado

**Los 7 `unitLabel` con un id de documento dentro siguen en la colección `users`.** La corrección
del 26 de agosto se aplicó a **`tenantUsers`** —que quedó en **0 sucios**, con sus marcas
`unitLabelPrevio` y `unitLabelCorregidoEn`— y **no tocó `users`**, donde los 7 siguen intactos.

**No está vivo, y se comprobó por las dos vías:**

| Vía | Resultado |
|---|---|
| El front | `auth-context.tsx` lee `users.unitLabel` en la **línea 209** y lo **pisa** con el de la membresía en la **334**. Los **7 de 7** tienen membresía con etiqueta limpia: `torre1-G1bWNzZJuakw9KRoAx7p` → `T1-403`, etc. **Cero vivos** |
| El servidor | **Nadie lee `users.unitLabel`.** `emitClearanceCertificate` saca la etiqueta de `tenantUsers/{tenantId}_{uid}`; el prorrateo, de `units.displayName` |

**Por qué se anota igual:** es exactamente [[buscar-el-gemelo-que-lo-hace-bien]] al revés — el
arreglo encontró una colección y dejó la gemela. Hoy lo tapa el orden de dos líneas del front. El
día que una membresía se quede sin `unitLabel`, el id sale a la pantalla. Y la vuelta atrás
(`unitLabelPrevio`) **solo existe en `tenantUsers`**, así que corregir `users` hoy sería sin red.
