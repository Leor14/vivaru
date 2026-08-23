# Plan de despliegue a producción — olas A y B

**Esto no es «subir `PLAT-003`».** `develop` lleva **67 commits** por delante de `master`, y
`master` no se ha movido desde el 20 de agosto (`d17478d`). Empujar `develop` a `master` despliega
**la ola A entera y la mitad de la B**, no una PRD.

Escrito el 23 de agosto de 2026, con los datos leídos de `hogaru-1`, no deducidos.

## Por qué hay que hacerlo

`PLAT-003` y `FLOW-002` **modifican la misma función** —`aplicarPago`, que está en producción y
mueve dinero—. `PLAT-003` cambia qué valor escribe; `FLOW-002`, su firma. **No pueden estar en
vuelo a la vez**, y `PLAT-003` está en vuelo. Así que **el paso 6 del plan no arranca hasta que
esto aterrice**. No es opcional: es lo que desbloquea seguir.

## Qué contiene

| PRD | Qué entra | Bandera |
|---|---|---|
| `PLAT-002` · auditoría | La autoridad del administrador pasa a ser su membresía, no el campo único del perfil (`5219758`) | **NINGUNA — y no se revierte con una** |
| `FIX-001` · entrega 1 | Las trece reglas de reserva en el servidor | `producto-reservas-servidor`, apagada |
| `PLAT-001` · MVP | Coeficiente en la unidad y corrida de cobro por coeficiente | `producto-cobro-por-coeficiente`, apagada |
| `FEAT-003` · MVP | Registro de proveedores | `producto-registro-proveedores`, apagada |
| `PLAT-003` · 1b y 2 | Plan de cuentas, el concepto al libro, R9, el aviso de R8 | `producto-plan-de-cuentas` y `producto-concepto-al-libro`, **las dos apagadas** |
| Transversal | Decimales por moneda, vocabulario por país, CLABE en México | **NINGUNA** |

## Lo que cambia para un usuario el día uno

**Todo lo demás es inerte. Estas cuatro cosas no.**

| # | Qué | A quién, medido |
|---|---|---|
| 1 | **Los importes en MXN y USD pasan a mostrar dos decimales** | De los nueve conjuntos de producción, **tres tienen MXN y solo uno está activo** (`Conjunto Las Playas`). Los otros dos están `expired`. Seis no tienen `currency` y caen al default |
| 2 | **Las pantallas hablan el idioma del país del conjunto** — coeficiente / alícuota / indiviso | Los conjuntos con `country`: **cuatro**, tres MX y uno CO. Los otros cinco no lo tienen y no cambian |
| 3 | **Dos opciones nuevas en dos selectores**: «Vigilancia / seguridad» al crear un cargo, y «Vigilancia y seguridad» al registrar un egreso | Todos. Es aditivo: nada existente se mueve de sitio |
| 4 | **La autoridad del administrador deja de mirar el claim del perfil** | Invisible si todo está bien. **Es el único cambio que no se apaga con una bandera** |

## Lo que es inerte, y cómo se sabe

No «debería ser inerte»: se comprobó.

- **El plan de cuentas y el concepto al libro** están tras dos banderas apagadas, y además
  **producción no tiene ni un plan sembrado** — `chartOfAccounts` de `hogaru-1` tiene **0
  documentos**, leído el 23 de agosto.
- **`accountCode` en cargos y egresos** va sin bandera y **no lo lee nadie sin plan**: R9 solo
  usa el código **si el plan sabe nombrarlo**. Esa condición se añadió el 23 de agosto
  precisamente al preparar este despliegue — sin ella, un egreso viejo y uno nuevo de la misma
  categoría salían en **dos filas con la misma etiqueta**.
- **La exclusión del doble conteo** (1b-i) es inocua con la bandera apagada: todo asiento de
  cobro es `billingStatement` **y** `alicuota` a la vez, así que la exclusión vieja y la nueva
  seleccionan el mismo conjunto.
- **El aviso de R8** no puede saltar: los ocho conceptos de cargo resuelven a una cuenta propia.

## Orden, y por qué

**Las reglas pueden ir primero, y esto corrige una suposición.** El diff de `firestore.rules`
contra producción es **puramente aditivo**: dos bloques nuevos, `vendors` y `chartOfAccounts`.
**Ninguna regla existente se restringe.** El rango reservado de `PLAT-003` restringe, sí, pero
dentro de una colección que en producción **no existe todavía**, así que no le quita permiso a
nada que hoy funcione. La lección de `FIN-001` —reglas al final cuando restringen— **no aplica
aquí**.

1. **Reglas e índices.** Aditivos. 81 líneas nuevas de índice: conviene desplegarlos **antes**
   que el front, o una consulta nueva falla con `failed-precondition` mientras se construyen.
2. **Functions.** Recompilar (`npm --prefix functions run build` — **no hay predeploy build**) y
   desplegar. Conceden capacidad; ninguna la quita.
3. **Front**, empujando a `master`. App Hosting construye solo, **pero hay que mirar el rollout**:
   la lista está paginada y sin ordenar, y leer la primera página da como «más reciente» algo de
   ayer.

## Verificación, pieza por pieza

Lo que hay que **leer**, no suponer:

| Pieza | Cómo se comprueba |
|---|---|
| Front | Procedencia del build: `commit` del build y su rollout en `SUCCEEDED`, recorriendo `nextPageToken` |
| Functions | `updateTime` y `state` por la API de Cloud Functions. **`firebase functions:list` con el alias falla**; usar el project id completo |
| Reglas | Leer el **ruleset vivo** por la API de Firebase Rules. «Deploy complete» no es evidencia |
| Índices | Que estén `READY`, no `CREATING` |
| Que sigue inerte | El estado financiero de un conjunto de producción **antes y después**: tiene que dar el mismo total y las mismas líneas |

## Rollback

| Parte | Reversible |
|---|---|
| Las cuatro capacidades tras bandera | **Sí**, apagando |
| Decimales y vocabulario | Sí, revirtiendo el commit y volviendo a desplegar el front |
| **La auditoría de `PLAT-002`** | **No con bandera.** Solo revirtiendo el commit |
| Los asientos ya escritos con su cuenta | No, **y no se quieren revertir**: son los correctos |

## Puertas antes de subir

1. **Mirar la pantalla en staging.** Lo único de la entrega 2 que sigue sin hacerse. De los cinco
   defectos del 23 de agosto, **ninguno salió de una suite en verde**.
2. **La puerta completa**: pruebas del front, de functions, **las de reglas con emulador**, y los
   dos typecheck.
3. **Credenciales**: `gcloud auth application-default login` para leer producción — caducan por
   separado del CLI, y el síntoma es `invalid_rapt`, que parece un error de código.
4. **La decisión de David**, explícita. Esto mueve producción por primera vez desde el 20 de
   agosto y lleva un cambio que no se apaga con una bandera.
