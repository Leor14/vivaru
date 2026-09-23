# `PRD-V-PLAT-007` — La supresión de un interesado

> **Estado:** en construcción (22 sep 2026). **Decidida por David** el mismo día, al cerrar el frente de
> Albert: con datos de una persona real ya en el CRM, borrar a alguien dejó de ser teórico.
>
> **Qué NO es:** no es una ventana de retención automática para `leads`. Se dejó fuera a propósito —ver
> §6—: la supresión a petición es una obligación; borrar solo a quien lleva un año callado es una
> decisión comercial, y puede llevarse por delante a alguien con quien todavía se quería hablar.

## 1. El problema, en una frase

**Si una persona pide que la borremos, hoy hay que hacerlo a mano y en dos sitios**, y nadie ha escrito
cuáles. Vivaru guarda su ficha; Albert guarda su contacto y su oportunidad. `eraseByExternalRef` existe
desde el 22 de agosto y **nadie la llama** — es la condición de vigilancia que dejó escrita
`docs/politica-retencion-datos.md`.

## 2. Lo que se midió antes de diseñar (22 sep, producción, solo lectura)

El barrido **no buscó nombres de campo: buscó los VALORES** de cada interesado —correo, nombre,
teléfono, id— dentro de las **67 colecciones raíz**. Es el método que en `ONB-002` encontró catorce
referencias que un inventario leído a ojo se dejaba.

**Salieron dos casos, y el diseño entero cuelga de esa diferencia:**

| Caso | Dónde está su rastro |
|---|---|
| **Solo interesado** (el único real, del 2 sep) | **Un único documento: su ficha en `leads`.** En ninguna otra colección aparece su correo, su nombre ni su id |
| **Interesado que ADEMÁS usa el producto** (hoy, el equipo) | `people`, `users`, `tenantUsers`, `accountInvites`, `auditLogs`, `documentFolders`, `documents`, `visitorPasses`, `emailDeliveries`… |

**La ficha guarda más de lo que su nombre sugiere:** además del contacto, lleva **las respuestas
completas del diagnóstico** (conjuntos, unidades, horas manuales, plazo de decisión) y la **atribución**
de por dónde llegó. Todo eso es suyo y todo se va.

> **Y de ahí sale la regla que sostiene la ficha: esos otros rastros NO son del interesado, son del
> USUARIO.** Los pases que autorizó, los documentos que subió y la auditoría del conjunto son
> información de la comunidad. Una supresión comercial no puede tocarlos.

## 3. Alcance

1. **Una acción en la consola de superadmin**, con un humano delante: se elige a la persona, **se ve
   qué se va a borrar** y se confirma.
2. **La puerta, antes de borrar nada:** si esa persona **también es usuario del producto**, la acción
   **se niega y dice por qué**, nombrando dónde aparece. Borrar los datos de alguien que opera un
   conjunto es otra conversación, con contrato de por medio.
3. **Lo que se borra en Vivaru:** su ficha de `leads` —con diagnóstico y atribución— y sus
   `emailDeliveries`, si las hubiera. **Todas sus fichas**, no solo una: la misma persona puede haber
   entrado varias veces.
4. **Lo que se borra en Albert:** su contacto y su oportunidad, llamando con **TODOS sus `leadId`**,
   alias incluidos. Ver §5.
5. **Queda constancia**, sin datos personales: qué ids se borraron, cuándo y quién lo pidió.

## 4. Criterios de aceptación

| # | Criterio |
|---|---|
| `CA1` | Un interesado que **no** es usuario se borra entero: su ficha desaparece de `leads` y Albert confirma la supresión de su deal y su contacto |
| `CA2` | Un interesado que **sí** es usuario **no se borra**: la acción se niega nombrando las colecciones donde aparece |
| `CA3` | Una persona con **varias fichas** se borra con todas a la vez; ninguna queda huérfana apuntando a un deal borrado |
| `CA4` | Repetir la supresión **no falla**: lo ya borrado responde «no estaba» y la operación termina bien |
| `CA5` | Si Albert falla, **Vivaru no borra su ficha**: se informa y se puede reintentar. Una ficha borrada aquí y un deal vivo allá es el peor de los estados, porque deja de existir el hilo para encontrarlo |
| `CA6` | El registro de la supresión **no contiene datos personales** |
| `CA7` | La acción es **solo del superadmin** |
| `CA8` | Si el deal está **GANADO**, Albert no lo borra (`won_not_deleted`) y **Vivaru tampoco borra su ficha**: queda constancia del intento y se decide aparte. Un ganado es un cliente |

## 5. Lo que depende de Albert, y está pedido (22 sep)

**`eraseByExternalRef` NO se puede llamar desde nuestras functions.** Medido: es una *callable*, así que
espera el token de un usuario de Firebase Auth suyo, y su servicio está abierto a `allUsers` con el
control dentro. Nuestras functions solo tienen **identidad de máquina**, y la contraseña del usuario
`sales` es justo lo que dejamos de pedir en `DECISIONES-A-006`.

**Entregado y revisado el 22 sep** (su commit `9ecaf6d`, **sin desplegar**): `vivaruEraseLead`, privado,
`POST` con `{ leadIds: [...] }` (hasta 25) o `{ leadId }`, misma autenticación que los otros dos, y una
respuesta por lead con `erased`, `reason` y los `dealIds` afectados. Por dentro usa **el mismo núcleo**
que la callable, así que no hay dos implementaciones que puedan divergir.

**Dos límites que salieron de revisarlo:**
- **La cuenta de staging no puede borrar ni simular**: recibe 403. Borrar es destructivo y su tenant
  tiene datos reales, así que **la primera prueba se hace en producción con un `leadId` inexistente**,
  que responde `not_found` y no escribe nada.
- **Un deal ganado no se borra por defecto** (`CA8`). Lo propuso Vivaru al revisar el contrato: entre
  «firmó» y «ya opera» hay un hueco en el que la persona todavía no es usuario y su deal ya es una
  venta. Albert devuelve `won_not_deleted` sin tocar nada, y hace falta un `includeWon: true` explícito.
  Si un lead tiene varios deals y alguno está ganado, **no se borra ninguno**: mejor eso que una persona
  a medio borrar.

## 6. Lo que queda fuera, y por qué

- **La ventana automática de retención para `leads`.** Decisión de David: fuera de esta entrega.
- **Borrar a un cliente.** Lo cierra `CA2`: se niega y se decide aparte.
- **Los leads anteriores al trigger de envío**, que nunca llegaron a Albert: su supresión es solo local,
  y el propio contrato lo cubre (`not_found` no es un error).

## 7. Efecto sobre la política de retención

`docs/politica-retencion-datos.md` deja escrita una condición: el número 2 —12 meses para el registro
del borrado— se mantiene **mientras no exista un camino de supresión que borre el lead e invoque
`eraseByExternalRef` en la misma operación**. **Cuando esta ficha esté construida, esa condición se
cumple** y el número 2 se revisa al alza. Es una decisión de David, y la ficha solo la habilita.
