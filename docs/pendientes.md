# Pendientes

Índice de traspaso, no resumen. Cada línea apunta a dónde está el detalle.
**Esta cabecera se reescribe entera en cada pasada** — lo que deja de ser actual baja o se borra.
Apilar épocas con «lo de abajo sigue vigente» es un defecto que este documento ya tuvo dos veces.

## LO PRIMERO AL ABRIR SESIÓN — 29 de agosto de 2026

> ### EL SIGUIENTE PASO, EN UNA FRASE
>
> ## ▸ CONSTRUIR LA ENTREGA 1 DE `FLOW-004` — Y EL ORDEN VA AL REVÉS
>
> **La PRD está escrita, en `develop` (`c14e219`) y lista para desarrollo.** No queda nada que
> acotar ni que decidir: [`PRD-V-FLOW-004`](prd/funcionales/PRD-V-FLOW-004-expediente-de-conciliacion.md),
> que es `FIN-002` / la fase `F1` de Finance. Su criterio de entrada (`FIN-001`) lleva cumplido
> desde el 20 de agosto.
>
> **La trampa nº 1 del frente es el orden de despliegue, y es lo primero que se olvida.** El de
> Vivaru es reglas → functions → front. **Aquí NO**: la regla **restringe** algo que el front hace
> hoy, así que si entra primero la pantalla actual deja de poder conciliar. El orden es
> **functions → front → reglas → relleno**, y las reglas solo cuando 1 y 2 estén verificados en
> producción.
>
> **Las dos decisiones del frente están cerradas y no se reabren:** al revertir un pago conciliado
> se **cascadea**, no se bloquea (D1, patrón `R15` de `FLOW-002`, David el 29); y el
> emparejamiento falso que ya está escrito **no se corrige, se nombra** (D2).
>
> **`G5` está abierta a propósito** —nadie concilia a diario porque no hay clientes—, así que la
> ficha **no se marca productiva** aunque se construya entera. Eso no frena construir.
>
> Sigue en pie: **una sola sesión que escriba a la vez**.

### `FLOW-004` — LO QUE HAY QUE SABER PARA CONSTRUIR SIN RELEER LA FICHA

**El defecto que lo motiva está vivo y tiene fecha.** La línea `sVYB2DVgKFHXEZctNqkr` (−300.000,
«Mantenimiento bomba de agua») está conciliada desde el **20 de agosto** contra el asiento
`igdiGS5OpFXW2LyI6gbz` (**+40.000**, «Otros ingresos», seis días antes). La pantalla lo aceptó en
silencio porque ofrece **todos** los asientos sin conciliar ordenados por cercanía de monto
(`page.tsx:167`) y `matchLine` **no valida nada**.

**Las cinco reglas salieron de medir, no de elegir.** Cada una con la cifra que la sostiene:

| Regla | Qué dice | La cifra que la sostiene |
|---|---|---|
| **R2 · coherencia de efecto** | El efecto de un asiento es `(type === "ingreso" ? +1 : −1) × amount` y debe igualar el `amount` de la línea **con su signo** | Da coherentes **18 de los 19** pares que existen y aísla **exactamente** el falso |
| **R3 · ventana de fecha ±3 días** | Fuera de ella no hay candidato | El mayor desfase entre pares coherentes reales es **1 día**; el falso estaba a **6** |
| **R4 · propuesta solo con candidato único** | Con dos o más, a la bandeja | **0 de las 8** pendientes tiene candidato único: proponer por monto y fecha habría acertado **cero** veces |
| **R5 · duplicado con la descripción DENTRO de la clave** | `tenant + cuenta + fecha + monto + descripción normalizada` | Sin la descripción, las 27 líneas dan **4 grupos que suman 20 líneas legítimas**; con ella, **0** |
| **R7 · cascada al revertir** | Anular o borrar un asiento conciliado suelta su línea y pasa su caso a `reversado` | Va en los **TRES** caminos, y son distintos |

**Los tres caminos de R7, porque no son intercambiables:** `revertPayment` (callable, Admin SDK —
**la única vía para asientos `billingStatement`/`advance`**, y **ninguna regla la mira**),
`reverseLedgerEntry` (cliente, alcanza `manual` y `expense` — el par falso es `manual`) y
`deleteLedgerEntry` (borrado **físico**, alcanza `expense`, y hay líneas conciliadas de gasto:
energía, nómina, mantenimiento). **Implementar la cascada en uno solo deja los otros dos vivos.**

**Cuatro cosas de fontanería que la ficha decide y conviene no redescubrir:**

- **El guardián es la callable, no la regla.** El Admin SDK no evalúa reglas; la regla queda como
  refuerzo que cierra el camino del cliente (R8).
- **La bandera `producto-expediente-conciliacion` vive en CINCO sitios**, y el quinto es
  `mover-bandera-de-conjunto.mjs` — **la vía del canario**. Si falta, la bandera no se puede
  encender por conjunto y existe a medias.
- **`reconciliationCases` hay que añadirlo a `PURGEABLE_COLLECTIONS`**
  (`functions/src/trial-lifecycle.ts:177`). Esa lista ya borra `bankStatementLines`; sin el
  cambio, los casos quedan huérfanos.
- **Reversibilidad PARCIAL, y está declarado:** la bandera revierte la bandeja; **no revierte
  R2**. Apagarla no debe devolver el producto al estado que permitió el par falso.

**Las cifras se reproducen, no se recuerdan:** `node scripts/medir-conciliacion.mjs hogaru-1`
—solo lectura por construcción—. Producción tiene **27 líneas de banco, 4 cuentas, 93 asientos con
19 conciliados**; en cero solo `reconciliationCases`, que es la entrega. **Hay contra qué verificar
sin sembrar**, que es lo que faltaba en otros frentes.

**Y lo que NO entra está decidido por escrito, no por criterio de la ficha:** el **cierre por fecha
de corte** —depósitos en tránsito, cheques no cobrados, resumen de saldos— es **`PH-002`**, «sin
PRD escrita a propósito», y su disparador es el primer pago real. `roadmap-producto` lo dice
literal: *«Contesta la pregunta abierta de `FIN-002`: no, todavía no»*. A Fase 2 van el
discriminante automático por código de unidad, una línea contra varios asientos y los motivos
configurables.

> ### ✅ `FLOW-004` ESTÁ EN PRODUCCIÓN, Y LA BANDERA APAGADA
>
> Desplegado el 29 de agosto en el orden invertido que pedía el frente: **functions → front →
> reglas** (`02a9642`). Verificado pieza por pieza: las cinco callables `ACTIVE` por la API, el
> build por **procedencia del commit**, y el ruleset vivo con **0 líneas de diferencia** contra el
> repositorio. La bandera `producto-expediente-conciliacion` **no tiene documento ni override**, así
> que manda el default del catálogo: **apagada**. Encendida solo en `conjunto-las-playas` de
> staging, que fue el canario.
>
> **Y la pantalla ya dice la verdad sobre el par falso**: Santa María muestra **4 conciliadas y 1 «a
> revisar»** —antes decía 5 conciliadas—, con los tres motivos escritos debajo de la línea: «el
> banco y el libro van en sentidos contrarios · los importes no coinciden · se llevan más de 3 días».
>
> **Lo único que falta de la entrega 1 es el RELLENO**, que es una escritura de datos y la decide
> David: `node functions/scripts/rellenar-casos-de-conciliacion.mjs hogaru-1 --escribir`. El ensayo
> contra producción da **19 aplicado + 6 varios candidatos + 2 sin contraparte**. Sin él, la bandeja
> funciona igual —los casos nacen al conciliar— pero las 19 conciliaciones ya hechas no tienen
> expediente.

### EL PORTAFOLIO, RECONTADO EL 29 — Y LO ÚNICO ABIERTO ES `FLOW-004`

`docs/prd/README.md` arrastraba **dos casillas ya falsas**: «servidor en producción pero APAGADO»
(`FLOW-001` se encendió el 27 y `FEAT-004` cerró el 26) y `FLOW-003` como «lista para desarrollo»,
que **su propia fila desmentía**. Recontado sobre las filas: **13 funcionales — 2 productivas, 10
en producción, y una abierta.** Es la primera ficha de Finance que vive en el repositorio.

### LO DEMÁS, QUE NO BLOQUEA

- **Albert.** Del lado de ellos no queda nada; del nuestro tampoco. Esperan **dos respuestas
  suyas** a `DECISIONES-A-005` —la clave estable de «ganado», que bloquea diseño, y la credencial,
  que bloquea ejecución—. Estado vivo en [`ESTADO-ALBERT.md`](prd/albert/ESTADO-ALBERT.md). **No es
  bloqueante de nada nuestro.**
- **`UX-003`.** Dos entregas en producción (`5bc9d3f` y `cb6d457`). Su siguiente paso es una
  decisión, no un bloqueo. Detalle en la jornada del 28, abajo.
- **2 commits en staging sin producción** (`bc33144`, `8bf5e4a`): ahorro de CSS (−4,2%) y textos de
  las pantallas de error. Ninguna urgente.
- **`UX-002` — filtros en la URL. Aplazada a propósito.** 38 filtros en 14 de las 19 pantallas del
  admin, ninguno viaja en la dirección. El mecanismo ya existe (`src/lib/navigation/tab-param.ts`).
  Su valor es compartir una vista y **no hay a quién**: producción no tiene clientes. La excepción
  honesta es que recargar y perder el filtro molesta desde el primer día.
- **El pie dice `Tenant:` en todas las pantallas.** Es jerga, y la palabra correcta depende del
  país del conjunto; `vocabulario-pais.ts` no tiene término para el inmueble en sí. Corre en la
  otra sesión.

### LAS TRAMPAS DEL DESPLIEGUE, QUE VUELVEN SIEMPRE

**Producción NO se despliega con un push a `master`** —su backend de App Hosting no tiene campo
`branch`—. Hace falta el rollout manual, y **al agente lo bloquea el clasificador**, así que lo
lanza David:

```bash
firebase apphosting:rollouts:create vivaru --git-commit <sha> --force --project hogaru-1
```

**Y tres falsos negativos al comprobar que algo se desplegó**, con su detalle en la jornada del 28:
la **huella de chunks** no prueba un despliegue de front (llevan hash de contenido), `curl` a
`/admin` devuelve **cero bytes** por el middleware, y **el CSS puede salir idéntico** aunque el
código cambie. El discriminante tiene que estar en lo que cambió.

**Credenciales:** la **ADC está verificada hoy** —los scripts de medición corrieron contra
`hogaru-1`—. `firebase` y `gcloud` **no se comprobaron el 29**; caducan por separado, así que si
algo falla raro, es lo primero que hay que mirar.

---

## LA JORNADA DEL 28 DE AGOSTO — `UX-003`, Albert y el frente de diseño

### `UX-003` — PRIMERA ENTREGA EN PRODUCCIÓN (`5bc9d3f`, 28 ago)

**El hilo del frente: el Panel de Control decía cosas que no se podían comprobar.** Cuatro
defectos medidos en la primera pantalla que ve todo el mundo, los cuatro de la misma familia.

| | Antes | Ahora |
|---|---|---|
| Píldora de alertas | **90**, con las tarjetas sumando 33 y el cajón listando 4 | **4**, y el cajón lista 4 |
| Fila de cartera del cajón | «76 cuenta(s)» | «**19 unidad(es) · 76 cuenta(s)**» |
| `% recaudo` al 0,0% | punto **verde** | punto **rojo** |
| `Reservas hoy` a 0 | punto verde | **neutro** — contar no es un logro |
| `Paquetes` a 0 | ámbar sobre «Bodega al día» | **neutro** |
| Cumplimiento total al 6% | **verde**, con Torre 1 al 11% en rojo | **rojo**, igual que sus torres |
| Barra al 0% | idéntica a «sin datos» | carril teñido; **sin datos sigue gris** |

**La causa de la píldora era la de siempre: dos sitios calculando lo mismo.** La suma usaba
`overdueStatementsCount` y la tarjeta `overdueUnitsCount` —líneas contiguas—, y ni cubrían las
mismas categorías. Ahora las alertas se construyen una vez y la píldora cuenta esa lista.
La escala de color vive en `src/lib/dashboard/umbrales.ts` y la usan la página y el widget.

> **DOS LECCIONES, Y LAS DOS SON SOBRE PRUEBAS QUE NO VIGILAN LO QUE DICEN.**
>
> **1 · Falsar destapó que dos pruebas mías eran ciegas.** Con la barra puesta otra vez en verde
> fijo, «el color es monótono» y «6% no puede verse mejor que 11%» **siguieron en verde**: si todos
> los colores son iguales, una prueba de orden se cumple sola. **Una escala constante pasa
> cualquier prueba de monotonía.** Hubo que exigir además que la escala DISTINGA.
>
> **2 · Y aun así metí una regresión que ninguna prueba vio.** Al arreglar «el 0% se ve como sin
> datos» pinté carril y relleno del mismo color: el cero quedó bien y **el avance desapareció**
> —Torre 1 al 11% y tres al 0% salían como cuatro barras rojas idénticas—. Typecheck en 0, 1343
> pruebas y la falsación completa **estaban en verde**. Lo cazó abrir la pantalla en producción.
> **Una barra puede tener el color correcto y no comunicar nada.**

### `UX-003` — SEGUNDA ENTREGA (`cb6d457`, 28 ago): los estados en español, y eran diez

**Salió de verificar la primera.** En el cajón de alertas el estado de PQRS se pintaba
**`critical`**, en inglés y en minúscula, junto a «En mora» y «Pendiente». Al contar el resto
aparecieron **nueve más**: el mapa tenía 24 claves y al producto se le escapaban 10. **Tres se le
enseñaban al usuario en inglés** —`critical`, `published`, `valid`—; las otras siete ya venían en
español pero sin pasar por el mapa, así que perdían la mayúscula.

**Por qué duraron tanto:** `getStatusLabel` **cae en silencio a la clave cruda** cuando no la
encuentra. No lanza, no avisa, y en las siete españolas el resultado era casi correcto. **Un fallo
que se disimula a sí mismo dura años.**

**El guardián mide el código, no una lista** (`tests/status-mapper-cobertura.test.ts`): recorre los
ficheros, saca cada `status: "..."` literal y exige que el mapa lo conozca. Una lista escrita a
mano no vería la clave número once, que es justo como se acumularon estas diez. Falsado quitando
`critical` —falla— y vaciando la recolección —**también falla**, porque lleva dentro la
comprobación de que encontró algo—.

> **BALANCE DEL FRENTE HOY: tres despliegues a producción, y los tres defectos que los motivaron
> los encontró MIRAR LA PANTALLA, no una suite.** Uno de ellos fue una regresión propia introducida
> con typecheck en 0, 1343 pruebas en verde y la falsación completa pasada. Es la demostración más
> limpia que ha tenido este proyecto de por qué `UX-003` existe.

### LA DECISIÓN DE HERRAMIENTA COMERCIAL — ALBERT, NO ODOO (28 ago 2026)

Se comparó antes de seguir invirtiendo. **El dato que la resolvió:** la versión gratuita de Odoo
—y la intermedia— **no tienen acceso a API externa**, que es lo único que Vivaru necesita de la
herramienta. Integrar Odoo exige su plan caro (~Mex$ 19.700 el primer año con seis usuarios) o
alojarlo uno mismo. **Albert cuesta cero, ya tiene cinco entregas desplegadas, y se vende a
terceros —así que Vivaru es su cliente de referencia—.** Y cambiar no ahorraría ni una de las
cinco piezas que Vivaru tiene por construir.

**Y la premisa que sostenía media decisión quedó CONFIRMADA el 28 de agosto: Albert es producto de
Qintilab.** David lo confirmó con los socios. Se preguntó porque su web firma «by Somasoft
Colombia»; no lo era. Con eso **se cae una de las cuatro condiciones de reapertura y quedan tres**.
Detalle en [`ESTADO-ALBERT.md`](prd/albert/ESTADO-ALBERT.md).

### ALBERT ↔ VIVARU — RETOMADO EL 28 DE AGOSTO, Y LO QUE SE SUPO

**El estado vivo sigue siendo [`docs/prd/albert/ESTADO-ALBERT.md`](prd/albert/ESTADO-ALBERT.md)**,
que se reescribió entero hoy. Aquí solo lo que hay que saber para retomar:

**Del lado de Albert no queda nada abierto.** Llegó `RESPUESTA-A-005`: **B1 y B3 desplegados**
—el camino de supresión y la retención 12/12 existen ya en su producción—, A1 cerrado, y el
`displayName` del usuario de servicio **confirmado por nosotros en pantalla** (`integracion-vivaru`),
que era lo último que les debíamos esperar.

**Se contestó con [`DECISIONES-A-005`](prd/albert/DECISIONES-A-005-vivaru-a-albert.md), que va por
el canal y lleva DOS preguntas.** Son lo único que frena el frente:

1. **La clave estable de «ganado» — bloquea DISEÑO.** Navegando su consola se vio que las etapas
   del pipeline son una **caja de texto libre** (`Nuevo, Contactado, Propuesta, Negociacion,
   Ganado, Perdido`) y que el desplegable del deal ofrece **esas mismas cadenas**. Condicionar la
   señal de vuelta a `stage === "Ganado"` significa que **el día que alguien reescriba esa caja el
   detector deja de disparar sin dar un error**. Se les pide un campo que no se mueva cuando el
   texto se mueva. **No se les pide congelar el texto.**
2. **La credencial — bloquea EJECUCIÓN.** Nadie ha dicho nunca que el usuario de servicio tenga
   contraseña, y al reautenticar el CLI se vio que **`albert-crm-1-1c162` aparece en nuestra lista
   de proyectos** (con ese acceso se verificó su índice de A1 sin creerles). Así que en vez de
   pedir una contraseña se les pide **conceder lectura a la cuenta de servicio de nuestras Cloud
   Functions**. Es mejor por seguridad, no por comodidad: ver el punto siguiente.

**Y un riesgo que creció sin que lo decidiéramos nosotros.** Albert desplegó el **reset
self-service** en su login —que este expediente había recomendado explícitamente que NO
priorizaran por nosotros—. El usuario de servicio vive en un **buzón de desarrollo compartido**,
así que **recuperar la credencial con la que Vivaru escribirá en el CRM ya no exige un superadmin
suyo**: se hace desde la pantalla de login. Hoy sale gratis corregirlo —**0 deals, 0 contactos, 0
leads**, verificado en su consola—, y se encarece con el primer cliente.

**Lo único adelantable sin respuesta suya:** decidir **dónde vive el listener**. `onSnapshot` tal
cual **no tiene dónde correr** —App Hosting va a `minInstances: 0` y una función v2 no sostiene una
suscripción—, así que la forma que encaja es una **función programada que sondee**. Ojo con no
confundir mecanismo y requisito: C1 promete **que podemos leer**, no `onSnapshot`.

**Dos avisos de credenciales, medidos hoy:** `firebase login --reauth` está **hecho y verificado**;
**`gcloud` sigue caducado** —por eso no se pudo medir el nivel exacto de acceso a su proyecto—. Es
la tercera vez que este proyecto se topa con que **las tres credenciales caducan por separado**.

### EL FRENTE DE DISEÑO, EN PRODUCCIÓN (`cad728c`, 27 ago)

Once entregas. **Front puro**: cero líneas en `firestore.rules`, `storage.rules`,
`firestore.indexes.json` y `functions/src` en todo el frente — por eso no aplicó el orden de
despliegue.

| | Antes | Ahora |
|---|---|---|
| Valores de radio distintos | 6 accidentales | **3 y el círculo** |
| Caracteres por línea (peor pantalla) | 182 | **67** |
| Cifras de las tablas | proporcionales | **ancho fijo**, y los gráficos protegidos |
| Peso de la énfasis del admin | todo forzado a 500 | **real** (27 elementos en una pantalla) |
| Contraste del texto secundario | 4,60:1 | **4,73:1** sobre un fondo más profundo |
| Columnas de dinero | 6 a la izquierda | **todas a la derecha** |

**EL HALLAZGO QUE MÁS LEJOS LLEGA:** `globals.css:193` tiene desde siempre
`h1, h2, h3 { font-family: var(--font-playfair) }`. **Dos reglas dentro de `.admin-shell` la
estaban apagando** para el portal entero —una con el único `!important` del fichero, y otra que
aplanaba a 500 **`.font-semibold`, `.font-bold`, h1–h6, `strong` y `b`**, o sea toda la énfasis—.
No faltaba diseño: **sobraba un interruptor**. `globals.css` queda hoy con **cero `!important`**.

### TRES TRAMPAS QUE COSTARON TIEMPO Y VUELVEN

**1 · Producción NO se despliega con un push a `master`.** Su backend de App Hosting **no tiene
campo `branch`** —leído del JSON crudo—, igual que el de staging. Hace falta el rollout manual, y
**al agente se lo bloquea el clasificador**, así que lo lanza David:

```bash
firebase apphosting:rollouts:create vivaru --git-commit <sha> --force --project hogaru-1
```

**2 · La huella de chunks NO comprueba un despliegue de front.** Los nombres llevan hash de
contenido, así que una página que no usa lo que cambió conserva los suyos: comparar `/login`
dijo **«sigue el chunk viejo» con el despliegue ya dentro**. Y `curl` a una ruta de `/admin`
devuelve **cero bytes** —el middleware redirige sin sesión—. **Lo que sí prueba:** sacar del
navegador (con sesión) el chunk que contiene una cadena que **solo existe en el código nuevo**, y
pedirle ese chunk exacto al otro ambiente.

**3 · Y hay un cuarto falso negativo, nuevo: el CSS puede salir IDÉNTICO aunque el código
cambie.** Migrar 90 clases `rounded → rounded-sm` no movió un byte de la hoja, porque las dos
utilidades ya se generaban. Una sonda que espera a que cambie el CSS **no termina nunca**. El
discriminante tiene que estar en lo que cambió.

### LO QUE ESE FRENTE ENSEÑÓ

**Cinco pasadas de sistema y David lo cazó en una frase: «lo veo prácticamente igual».** Tenía
razón. El agente hizo la fontanería antes de tocar lo visible y **no retiró las dos reglas planas
por decidir solo que era decisión de producto**. Cuando se retiraron, se vio todo. **Si el efecto
buscado es visible, la primera pasada tiene que serlo.**

**Y una regla sobre los guardianes:** los que más valieron no comprueban que el código sea el
escrito, **calculan** — el contraste del fondo contra cada gris, los cinco tonos del tablero
leyendo su propio mapa, el ancho de la tabla más ancha que exista en el código. Cada uno enrojece
**con la cifra delante**. Son trece ficheros nuevos en `tests/`.

**Tres instrumentos propios mintieron, y los tres se cazaron comparando, no leyendo:** un auditor
de contraste que decía 1,82:1 sobre texto blanco en fondo navy (no resolvía degradados; **no se
reportó ni uno de sus números**), una medición de seis rutas con `pushState` que devolvió **seis
resultados idénticos** porque Next no repintó, y un `@source not` con un `..` de más que ahorró
**0 bytes** hasta que se midió el antes y el después.

---
## LA JORNADA DEL 27 POR LA MADRUGADA — `FLOW-003` cerrado

> Lo que sigue es **historia, no trabajo pendiente**. El webhook se cerró y
> `producto-entrega-de-correo` quedó encendida esa misma madrugada; el bloque de propiedad
> horizontal se cerró después. Se conserva porque las mediciones y las trampas siguen valiendo.

### LO DESPLEGADO, MEDIDO PIEZA POR PIEZA (27 ago, 00:41–00:49 UTC)

| Pieza | Cómo se comprobó | Resultado |
|---|---|---|
| **Índices** | Estado del índice por la API de Firestore | `emailDeliveries` (`tenantId · status · sentAt↓`) en **`READY`**. Subido **sin `--force`**, y el CLI avisó de «1 index not present»: el índice extra de producción **sigue ahí** |
| **Reglas** | Ruleset vivo descargado y diferenciado contra el repo | `9853c52d-…`, **idéntico byte a byte**. Vuelta atrás = republicar `60d9dd0f-…` |
| **Functions** | `updateTime` de las 82, antes y después | **15/15 movidas y `ACTIVE`**; de las otras **67: cero movidas, cero desaparecidas, cero fuera de `ACTIVE`**. Total 81 → **82** |
| **Front** | Procedencia del build + huella de chunks | `rollout-2026-08-27-001` **`SUCCEEDED`**, build `READY` de `master`/`2ac3418`. De 21 chunks, **1 sustituido** |

**`master` = `develop` = `2ac3418`** (leído con `git ls-remote`, no de la caché local).

### POR QUÉ SON QUINCE FUNCTIONS Y NO OCHENTA Y DOS

Desplegar las 82 es churn con riesgo —ya mintió un despliegue grande el 26— y desplegar solo las
«nuevas» habría dejado huecos. El conjunto se cerró **siguiendo el código, no la ficha**:

- `resendWebhook` — nace
- `anonymizeExpiredVouchersDaily` — es quien corre la retención de `emailDeliveries`
- **Las 13 que pasan por `deliverResidentNotifications`**, que es el único sitio del producto que
  llama a `sendNotificationEmail` **con `contexto`**, y por tanto el único que puede escribir una
  fila: `notifyBillingBatch`, `notifyResidentReceipt`, `onBillingStatementCreated`,
  `onCommitteeAgreementUpdated`, `onPaymentVoucherCreated`, `onRegulationDocumentCreated`,
  `onReservationUpdated`, `onSurveyUpdated`, `onTicketUpdated`, `publishScheduledCharges`,
  `sendBillingReminder`, `sendScheduledReminders`, `updateOverdueStatements`.

**Y una que parecía entrar y no entra:** `monthlyFinancialArchive` usa `buildSummaryPdf`, que se
mudó de `index.ts` a `pdf-resumen.ts` en esta tanda. Se comparó el cuerpo viejo con el nuevo y es
**idéntico**: mudanza pura, cero cambio de conducta. Una mudanza no obliga a redesplegar a quien
la consume.

### EL WEBHOOK SE FALSÓ, NO SE MIRÓ

Cuatro peticiones reales contra la URL desplegada:

| Petición | Respuesta |
|---|---|
| `GET` | **405** `method not allowed` |
| `POST` sin cabeceras de firma | **401** `unauthorized` |
| `POST` con firma **inventada** | **401** `unauthorized` |
| `POST` con cuerpo ilegible | **400**, y lo corta el parser de Express **antes** de llegar al código |

Que respondiera a un `curl` sin autenticar prueba de paso que **`invoker: "public"` funcionó**
—`ingressSettings: ALLOW_ALL`— y ahorra la trampa de `run.invoker`, que muerde con un «error
interno» sin pista.

### LA OSCURIDAD ESTÁ VERIFICADA POR LAS TRES VÍAS QUE PODRÍAN ENCENDERLA

No basta con que las banderas «nazcan apagadas»: el override manda sobre la global, y el catálogo
del servidor **es otro fichero** que el del front. Se miraron los tres:

| Vía | Medido en producción |
|---|---|
| Documento de bandera | `producto-entrega-de-correo` y `producto-calendario-de-cobranza`: **SIN DOCUMENTO** → resuelve por `default_catalogo` |
| Catálogo del **servidor** (`functions/src/feature-flags.ts`) | Las dos en **`false`** en `FEATURE_FLAG_DEFAULTS` |
| Override por conjunto | `featureFlagOverrides` tiene **1** documento y **cero** menciones de las dos claves |

Y el freno es real, no un botón: `registrarEnvio` comprueba la bandera **en el servidor** y sin
ella no escribe una sola fila.

**El front SÍ conoce las dos claves nuevas**, comprobado descargando los chunks servidos: las dos
aparecen en `955684ee720a0831.js` —el chunk que cambió—, la clave inventada de control **no**
aparece, y una vieja (`producto-estado-de-cuenta`) **sí**. Sin eso, encender por conjunto habría
sido un no-op con aspecto de hito.

### STAGING SE QUEDÓ FUERA, Y ES UNA DECISIÓN, NO UN OLVIDO

**`RESEND_WEBHOOK_SECRET` no existe en `vivaru-staging-02`** — la API contesta «Secret not
found». Sin él, `resendWebhook` **no despliega**: el secreto tiene que existir antes que la
función que lo referencia. Se decidió con David ir solo a producción, que es donde el secreto ya
estaba y donde vive la URL que Resend necesita.

**Consecuencia que hay que recordar:** desde hoy los dos ambientes **divergen**. Staging tiene 81
functions y el ruleset sin `FLOW-003`; producción, 82 y con él. Para igualarlo hace falta primero
que David cree el secreto allí:

```bash
cd /Users/david/Vivaru_Rep/vivaru
firebase functions:secrets:set RESEND_WEBHOOK_SECRET --project vivaru-staging-02
```

**Con la trampa de siempre:** ese comando **crea el secreto ANTES de pedir el valor**, así que un
Enter en vacío deja un secreto creado y hueco sin dar error. **Comprobar las VERSIONES, no que el
nombre aparezca.**

### EL WEBHOOK YA ESTÁ CERRADO, Y `producto-entrega-de-correo` ENCENDIDA

**Hecho la madrugada del 27, después del despliegue:**

| | |
|---|---|
| **El secreto real** | v2 puesta por David (01:28). La v1 de relleno **sigue `ENABLED`**: el CLI dijo que la destruiría y no lo hizo. Nadie apunta a ella |
| **El redespliegue** | Revisión `-00003-kes`, clavada a **`versión=2`**. Lo hizo el propio CLI al contestar `Y` a «re-deploy and destroy the stale version» |
| **La bandera** | `producto-entrega-de-correo` = `true`. Verificada por las tres vías: documento, `_global.killSwitch=false`, **cero overrides** |

> **Y quedó probado que el endpoint SÍ estaba registrado en Resend**, aunque pareciera que no: el
> `whsec_` **solo existe si creaste el endpoint allá**. Lo que falló fue la forma de probarlo —
> abrir la URL en el navegador manda un `GET` y el webhook contesta **405 `method not allowed`**,
> que es su conducta correcta, no una avería. **Un endpoint de webhook no se prueba con el
> navegador.** Se ve en el log: `GET 405 · ua=Mozilla/5.0`.

### EL HALLAZGO DE LA VALIDACIÓN: EL CANAL DE CORREO ESTÁ CERRADO EN TODA LA PRODUCCIÓN

**`producto-entrega-de-correo` está encendida sobre una puerta que está cerrada más arriba.** Se
descubrió al validar: se disparó el recordatorio, la callable respondió `200` dos veces
(02:02:52 y 02:03:01, auth válida), **la notificación en la app se creó** —«Recordatorio de pago»,
02:03:02— y **`emailDeliveries` siguió en CERO**. Ni un error en el log.

**La causa está en `index.ts:595`:**

```ts
if (!copy.emailEnabled) return;
```

Y `emailEnabled` sale de `override?.emailEnabled ?? t.emailDefault`. Medido:

| | |
|---|---|
| Claves del catálogo con `emailDefault: true` | **0 de 13** |
| `tenantSettings` con `notificationTemplates` | **0 de 8** |

**Conclusión: hoy no le llega un solo correo a ningún residente en toda la producción.** Y por
tanto `FLOW-003` **no puede grabar una fila** por más encendida que esté su bandera. No es un
defecto: es configuración — el interruptor está en **Ajustes → plantillas de notificación →
«También por correo»** (`notification-templates-card.tsx`, escribe
`tenantSettings.notificationTemplates.<clave>`).

> **Es la tercera forma de «encender no era el arranque», y la más callada de las tres.** Las
> otras dos fueron la bandera sobre una tabla vacía y el front que no conocía la clave. Ésta es una
> bandera encendida, con su código desplegado y verificado, **detrás de una puerta de producto que
> nadie había mirado**. El síntoma es idéntico al de una funcionalidad rota: silencio total.

**Y corrige de paso dos frases que estaban escritas al revés:** `CLAUDE.md` decía «un cobro normal
MANDA CORREO» y la ficha de direcciones decía que los desconocidos «ya lo reciben hoy». Las dos
eran deducciones, no medidas. Las dos están corregidas en su sitio.

### LA CADENA ESTÁ VALIDADA DE PUNTA A PUNTA (27 ago, 02:16 UTC)

Se abrió el canal **solo** para `billing_reminder` en `tenant-santa-maria`, se disparó el
recordatorio con el botón **de la fila** de `APARTAMENTO 201`, y se cerró el canal después.

| Eslabón | Medido |
|---|---|
| **La pantalla** | «Recordatorio enviado: **1 residente(s)**» |
| **La fila nace** | `emailDeliveries/98fc258d-…` a las **02:16:28.826**, con el **id del mensaje de Resend como id de documento** — que es de donde cuelga toda la idempotencia de §7.1 |
| **Resend entrega** | **dos** `POST 200` de `Svix-Webhooks/rolling` (54.148.139.208 · 44.228.126.217) a las 02:16:30 y 02:16:31. **`200` y no `401` es la prueba de que la firma verificó con el secreto real** |
| **El webhook la mueve** | `status: entregado`, `updatedAt` **02:16:34.841** — seis segundos después de nacer |

**Y el canal quedó cerrado otra vez**: `notificationTemplates` vuelve a **0 en los 8 conjuntos**.
La fila **se conserva**, que es lo que promete el catálogo de la bandera («lo ya registrado NO se
borra»). `producto-entrega-de-correo` **se deja encendida**: con el canal cerrado no escribe nada,
y así el rastro empieza solo el día que alguien abra una plantilla.

### LO SIGUIENTE — EL BLOQUE DE PROPIEDAD HORIZONTAL ESTÁ CERRADO

**Cerrado el 27 de agosto de 2026.** Las **10** PRD del bloque están construidas, desplegadas y
**sin ningún frente abierto**: las doce banderas de producto están encendidas, y la única sin
documento —`producto-importacion-masiva`— resuelve `true` por el default del catálogo, que es su
intención.

| Lo último que se hizo | |
|---|---|
| **Coeficientes sembrados** | `tenant-santa-maria`: **18 de 18** unidades activas, sumando **100.000000% exacto** por resto mayor. En toda la producción, 18 de 93 |
| **Dos propietarios enlazados** | T1-101 (Marta Velásquez) y T2-201 (David Carmona). **Enlazar no es inventar**: las personas ya estaban registradas como `owner_occupant` y faltaba el `ownerIds` del lado de la unidad |
| **`producto-multiconjunto` encendida** | Inerte hoy: el selector se pinta con dos membresías o más y nadie tiene dos |
| **`producto-prorrateo-de-gastos` encendida** | Ya puede calcular en Santa María |

> **LO QUE SIGUE FALTANDO, Y NO ES DEUDA DE INGENIERÍA.** La corrida por coeficiente tiene **tres**
> guardas y sembrar cubre dos. La tercera pide responsable o propietario en **cada** unidad activa,
> y en Santa María faltan **4 de 18**:
>
> - **T2-101, T2-102, T2-103** — no hay **nadie** registrado. Habría que inventar tres personas, y
>   se decidió con David **no hacerlo**.
> - **T2-503** — hay **Laura Melo, arrendataria**. No es propietaria: falta **decidir** si el
>   arrendatario es el responsable de pago, que es negocio y no dato.
>
> Con esas cuatro, la corrida se niega **y las nombra**. Eso es correcto: el dato falta de verdad.

**Y un defecto de dato encontrado al enlazar, sin tocarlo:** **T2-201 tiene CUATRO registros
duplicados de David Carmona**, todos `owner_occupant`, todos activos, todos creados el 5 de junio
de 2026 (`m8sbjGq5FZUFdpNqEvMt`, `rFSa2er0CP1A8dYoNPtQ`, `uLYXPXZQVoPDqF9U554j`,
`wwgks6RDtlsWnS50uoMS`). Se enlazó **uno** y los otros tres siguen ahí. No se borraron porque
borrar personas en producción no se hace de paso.

### LO QUE QUEDA, QUE NO ES DE ESTE BLOQUE

1. **Cuatro capacidades encendidas y quietas por falta de DATO de cliente**: proveedores (0),
   paz y salvo (0 emitidos), calendario de cobranza (0 configurados) y el canal de correo (cerrado
   en los 8 conjuntos). **No las arregla una decisión: las llena un cliente.**
2. **La puerta del alta sigue abierta** — `sendAccountEmail` no está detrás de ninguna bandera, así
   que un residente nuevo creado con un correo tecleado manda un enlace de acceso a un desconocido.
   Cerrarla es una **PRD pequeña**, sin escribir.
3. **Las cuatro membresías huérfanas de staging** (`cliente-david`, `cliente-nuevo`) siguen sin
   decidir: el archivador se niega a tocarlas a propósito, porque son personas que no ven nada.

### CUATRO TRAMPAS DE ENTORNO, Y UNA ES NUEVA

1. **El repo NO es `/Users/david/Vivaru_Rep`** — es `/Users/david/Vivaru_Rep/vivaru`. El padre no
   es un repo git, no tiene `docs/`, y tiene un **`firestore.rules` de 0 bytes** suelto al lado.
   Un comando relativo lanzado desde el padre falla con `MODULE_NOT_FOUND`; usar ruta absoluta.
2. **NUEVA — `gcloud auth print-access-token` puede pedir reautenticación y la ADC seguir viva.**
   Pasó el 27: el token del CLI murió con «Reauthentication failed, cannot prompt during
   non-interactive execution» y **`gcloud auth application-default print-access-token` funcionó
   toda la sesión**. Son credenciales distintas. Antes de pedirle nada a David, **probar la ADC**:
   es la que usan los scripts `.mjs` y las lecturas por API.
3. **`CLAUDE.md` tiene DOS `JAVA_HOME` distintos** (líneas 76 y 557). El bueno es el de la 76
   (`~/.local/jdk/jdk-21.0.12.1+1/…`, verificado ejecutándolo); el de la 557 es de otra época.
4. **Las pruebas de emulador no salen con `firebase emulators:exec "npm …"`**: el `npm` anidado
   revienta con `Cannot read properties of undefined (reading 'stdin')`. Lo que sí funciona es
   levantar el emulador aparte y llamar a `npx vitest` directo:

   ```bash
   cd /Users/david/Vivaru_Rep/vivaru
   firebase emulators:start --only firestore --project hogaru-1-test &
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=hogaru-1-test \
     npx vitest run --config functions/vitest.emulator.config.mts
   ```

**Y la sesión del navegador va por ORIGEN.** Entrar por `www.grupovivaru.com` no deja sesión en
`vivaru--hogaru-1.us-central1.hosted.app`, aunque sean la misma aplicación y el mismo build.

### LAS SUITES, ANTES DE DESPLEGAR

**2.280 pruebas en verde** y dos typechecks limpios: 1.200 de la raíz, 639 unitarias de functions,
220 de emulador de functions, 221 de reglas de Firestore.

## EL CIERRE DEL 26 POR LA NOCHE — `FLOW-003` construido (26 de agosto de 2026)

**Su despliegue está arriba, en la cabecera del 27.** Lo que queda aquí es cómo se construyó y
las lecciones que dejó; el estado de lo desplegado **ya no se lee de esta sección**.

### ENCENDER ERA EL TERCER ACTO — la lección, con `FEAT-004` de ejemplo

**Los tres actos son servidor → front → encender, y quedan hechos los dos primeros.** El
servidor salió por la mañana; el front, por la tarde. Queda encender.

La lección se guarda porque costó descubrirla y no se ve desde el repo: por la mañana parecía
que quedaban **dos** actos —subir y encender—, y eran tres. Así se supo, en diez segundos:

    git show origin/master:src/lib/feature-flags/catalog.ts | grep -E 'prorrateo|estado-de-cuenta'
      → (nada)

El front que había entonces **no conocía esas dos claves**, y `estado-de-cuenta.ts`,
`paz-y-salvo-pdf.ts`, `use-clearance-certificates.ts` y `EstadoDeCuentaUnidadCard.tsx` nacían en
`develop`. **Antes de prometer una fecha de encendido, correr ese `grep` contra la rama que de
verdad sirve el front.**

> **Y eso descarta de paso un miedo razonable.** Como esos ficheros nunca estuvieron en
> `master`, producción **no tiene** los tres parches que la Fase 2 retiró: no hay parche
> caducado corriendo sobre dato ya migrado. El sesgo es limpio —functions de `develop`, front
> de `master`— y no hay que ir a buscar sobre-inclusiones.

### `FLOW-003` — QUÉ SE CONSTRUYÓ, Y EN QUÉ ORDEN

Seis entregas, en un orden que **no es el de la ficha**: pone delante el habilitador que ella no
vio y aísla lo arriesgado.

| Entrega | Qué |
|---|---|
| **0** | El **id del mensaje de Resend**, que no existía en el producto. `sendNotificationEmail` devolvía `void` y tiraba el cuerpo de la respuesta — y §7.1 cuelga toda su idempotencia de ese valor |
| **1** | `emailDeliveries`: la fila por correo, sus reglas, su índice y **su retención desde el día uno** |
| **2** | El **webhook**: la primera función HTTP del producto, con firma verificada a mano |
| **3** | El **calendario del conjunto**: contrato, rangos validados en las REGLAS, y la pasada diaria con sus tres puertas |
| **4** | El **adjunto** del estado de cuenta, resuelto por destinatario (R9) |

**Lo que la ficha decía y el código desmintió** —encontrado en la pasada de plan, antes de
escribir una línea—: el id del mensaje no se capturaba en ninguna parte; la función a la que había
que meterle el registro **no recibía ninguno de los tres campos** que la colección exige; **no
existía ni una función HTTP** en las 81 desplegadas; y la verificación de firma **no tenía con qué
hacerse**, porque Resend firma con Svix y `svix` no está en el repositorio.

> **DOS DESVÍOS DE LA FICHA, DICHOS.** Las banderas se llaman `producto-entrega-de-correo` y
> `producto-calendario-de-cobranza`, no `email-delivery-tracking` ni `billing-calendar`: las
> diecinueve claves del catálogo llevan prefijo de área y están en español, y ésas habrían sido las
> únicas sin prefijo y en inglés. Y `email.opened` / `email.clicked` **se ignoran a propósito** —
> saber si alguien abrió un correo exige un píxel de seguimiento, y esa colección existe para saber
> si el aviso LLEGÓ, no para vigilar a quien lo recibe.

**Y un defecto vivo encontrado de paso, sin mezclarlo:** el sembrador de banderas declara **16**
claves y el catálogo tiene **19**. Tres —`producto-anticipos`, `producto-pago-multiple`,
`producto-importacion-masiva`— no se pueden sembrar; en producción existen solo porque
`mover-bandera` las creó al encenderlas. En un ambiente nuevo nacerían sin documento y resolverían
por defecto en silencio. Tiene ficha aparte.

### La lección que se repitió CUATRO veces en una jornada

**Una suite en verde no vigila lo que ninguno de sus casos puede distinguir.** Pasó cuatro veces,
y las cuatro las cazó falsar, no escribir:

1. El orden del estado de cuenta: **once** pruebas, todas con cargos que vencen en su propio mes —
   con esa entrada los dos órdenes dan el mismo resultado.
2. La retención de `emailDeliveries`: la prueba se llamaba «con más filas que el lote» y sembraba
   30 contra un lote de 400. El cursor nunca entraba.
3. La tolerancia de la regla del calendario: se probaba con `updateDoc` sobre un documento que ya
   tenía calendario, así que la fusión se lo devolvía y la rama de ausencia no se ejercitaba.
4. La marca del calendario: escribirla ANTES de enviar pasaba todas las pruebas. **Y al escribir la
   que faltaba apareció un hueco real** — un envío que lanzaba abortaba la pasada entera.

**La pregunta que las caza a las cuatro:** ¿hay algún caso donde las dos implementaciones
candidatas darían resultados DISTINTOS? Si la variable que decide la conducta es constante en todos
los casos, la suite vigila otra cosa y lo parece.

### `FEAT-004` ESTÁ ENCENDIDA EN PRODUCCIÓN, Y VALIDADA

Tercer acto hecho. `producto-estado-de-cuenta` = `true` (17 documentos en `featureFlags`, sin
kill switch propio y con el `_global` en `false`). **`producto-prorrateo-de-gastos` sigue sin
documento**, así que `FLOW-001` sigue apagada.

**Antes de encender se comprobaron dos cosas, y las dos importaban:**

| | |
|---|---|
| **El servidor la hace cumplir** | `index.ts:4386`, dentro de `emitClearanceCertificate`. **`cancelClearanceCertificate` NO la comprueba**, a propósito: apagarla no puede dejar papeles sin forma de retirarlos |
| **A cuánta gente alcanza** | **Cero.** Los **nueve** conjuntos de producción son `isExample: true` |

**La validación fue el rechazo, no la emisión.** Se pidió el paz y salvo de T2-503, que debe
dinero, y el servidor contestó: «*No se puede emitir el paz y salvo: la unidad tiene un saldo
pendiente de 4.160.000, desde 2026-03 (3 períodos)*». Eso prueba de una vez que la bandera está
encendida —la callable llegó a correr—, que la guarda funciona y que nombra lo accionable. Y
**no creó nada**: `clearanceCertificates` sigue en **0** en producción, medido después.

El estado de cuenta de T2-503 cierra en **4.160.000**, que es R2: el saldo final coincide con la
cartera.

### Y EL ORDEN DEL DOCUMENTO, QUE SALÍA MAL — DECIDIDO Y ARREGLADO

En T2-503 los períodos salían **05 · 03 · 04 · 06**, con una columna de saldo acumulado al lado.
No era un fallo de cálculo —el total era exacto—: `fechaDe()` ordenaba por `dueDate` cuando
existe, y **esos cargos de marzo y abril vencen el 28 de mayo**. Alcance: **3 de 221 cargos** en
producción, los tres de `tenant-santa-maria`; **cero de 171** en staging.

**Decisión de David: se ordena por `period`.** `dueDate` se sigue enseñando y desempata dentro
del mismo mes; ya no manda. Desplegado en `rollout-2026-08-26-002` y visto en pantalla:
`03 · 04 · 05 · 06`, con el saldo final **intacto en 4.160.000**.

De paso cae algo que nadie había decidido: comparaba `"2026-05"` con `"2026-05-28"` —cadenas de
distinta longitud—, así que un cargo **sin** vencimiento caía siempre antes que uno fechado del
mismo mes.

> **POR QUÉ LLEGÓ A PRODUCCIÓN, QUE ES LO QUE HAY QUE APRENDER.** Había **once** pruebas sobre
> ese fichero y **todas usan cargos que vencen en su propio mes**. Con eso, ordenar por fecha o
> por período **da el mismo resultado**: el defecto no se podía manifestar aunque estuviera. Se
> añadió el caso real —marzo venciendo el 28 de mayo— y se falsó revirtiendo el orden: **falla
> exactamente la nueva y las once pasan**. Eso es lo que prueba que estaban ciegas.
>
> La cabecera del fichero, además, **afirmaba lo que el código no hacía** («se ordena por
> `period`, NO por `dueDate`»): era cierto de la consulta y falso del `sort`. Ahora lo dice
> separado.

### `FIX-002` QUEDA CERRADA DEL TODO

**CA7 se dio por bueno con lo que hay**, y lo que hay se vio en pantalla, en producción:

| | Portal del residente | Cartera del administrador |
|---|---|---|
| **T1-403** — el par completo | 11 cargos · **6.400.000** | 11 cargos · **6.400.000** |
| **T2-503** — la unidad migrada | *sin ver* | **7 de 104 registros** · **4.160.000** |

Los 104 de la tabla son los 104 cargos que hay; el filtro por unidad —que va por etiqueta—
devuelve los 7 correctos; y el desplegable lista las diecinueve unidades con nombres limpios.
La unidad fantasma `G1bWNzZJuakw9KRoAx7p` tiene **cero** cargos: no se cuela nada.

> **EL ESLABÓN QUE QUEDÓ SIN VER, DICHO PARA QUE NO SE PIERDA.** Nadie ha mirado el portal de
> una membresía **migrada**. `residente@santamaria.co` (Ana Lucía Pérez, T2-503) es la **única
> de los nueve residentes** con `unitIdPrevio`; los otros ocho no se tocaron, así que Jaime
> demuestra que el portal pinta fiel, no que pinte fiel *una migrada*. El riesgo es bajo —la
> migración movió `unitId` a los dos lados a la vez y el portal lee por ahí— pero no es cero,
> y **ya no hay vuelta atrás** (ver abajo). Si alguna vez sale algo raro en T2-503, mirar aquí
> primero.

**Las marcas temporales están retiradas en los dos ambientes, y eso es irreversible.**
`unitIdPrevio` y `unitIdMigradoEn` ya no existen: **110 documentos en producción** (20:54 UTC) y
**140 en staging** (20:51 UTC, por David). `migrar-claves-de-unidad.mjs --revertir` ya no puede
deshacer nada — era su objeto, no un efecto secundario.

**Lo que NO se tocó, y se comprobó contándolo:** las **31** del archivado D2 siguen con sus dos
campos (`visitorInvitations` 26 · `survey_responses` 2 · `packages` 1 · `regulation_signatures` 1
· `committee_agreement_signatures` 1). No son vuelta atrás, son la decisión escrita en el
documento.

### EL DEFECTO QUE APARECIÓ MIRANDO: LA ETIQUETA QUE LLEVABA UN ID DENTRO

Salió de contar datos, no de ninguna suite. **Siete membresías de producción llevaban
`unitLabel` con la forma `{torre}-{id de documento}`** en vez del nombre del apartamento — seis
en `tenant-santa-maria` y una en Bromelias. Se veía **en producción, en pantalla**: la reserva
de Jaime decía `torre1-G1bWNzZJuakw9KRoAx7p` donde debía decir `T1-403`.

**El escritor ya estaba encontrado y arreglado.** `functions/src/index.ts:715` lo dice con
nombre y apellidos —«el fallback NUNCA debe incrustar el docId (antes era `${tower}-${unitId}`…)»—
y staging tenía **cero de veintitrés**. Era residuo anterior a aquel arreglo; no había nada vivo
fabricándolo.

| | |
|---|---|
| **Por qué no bastaba el resolvedor** | `src/utils/unitLabel.ts` recupera el compuesto sacando el docId final, pero el de Jaime incrustaba el id de una unidad que **ya no existe**: habría caído a «Unidad no vinculada». Y solo lo usan **cuatro pantallas de administrador**, ninguna del residente |
| **Dónde se veía** | Reservas, PQRS y pases de visitante — todo lo que lee `user.unitLabel`, que `auth-context.tsx:334` saca de la membresía |
| **Por qué urgía** | `FEAT-004` pasa esa misma cadena al **PDF del paz y salvo** y al callable que lo emite. El papel que se entrega habría salido con un id de base de datos donde va el apartamento |
| **El dinero, intacto** | Los 104 cargos del conjunto llevan **una sola etiqueta por unidad** y coincide con `displayName`. Por eso `FIX-002` no lo vio: ni era huérfano ni era clave mal resuelta |

Corregido en los 7, `unitLabel` ← `displayName` de la unidad. **Conserva `unitLabelPrevio`, así
que esta corrección sí tiene vuelta atrás** (`--revertir`).

### DOS INSTRUMENTOS NUEVOS

| Script | Qué hace |
|---|---|
| `functions/scripts/corregir-etiqueta-de-unidad.mjs` | Reescribe la etiqueta desde `displayName`. **No adivina**: si la unidad no existe, si su `tenantId` no concuerda o si no tiene `displayName`, lista y no toca |
| `functions/scripts/retirar-marcas-de-migracion.mjs` | Retira las dos marcas de `FIX-002`. Su guarda comprueba que **cada documento marcado apunta hoy a una unidad viva de su conjunto** antes de dejar nada irreversible |

**Las guardas de rechazo del primero no se han disparado nunca sobre dato real** — están
escritas y sin ejercitar. No fiarse de una puerta que solo se ha visto cerrada.

Y el segundo llegó a imprimir «Guarda EN VERDE» sobre **cero** documentos en la segunda pasada
—el falso verde sobre conjunto vacío, otra vez—. Corregido: ahora dice que no llegó a evaluarse.

## EL CIERRE DE LA MAÑANA — `FIX-002` cerrada en los dos ambientes (26 de agosto de 2026)

**EL LOTE DE PRODUCCIÓN ESTÁ COMPLETO: functions, índices y reglas.**

| Artefacto | Estado, medido |
|---|---|
| **Functions** | **81 · cero atrasadas · cero errores**, por `updateTime` contra la API con la ADC. Las cuatro nuevas creadas |
| **Índices** | subidos sin `--force`, así que el índice extra que producción tenía sigue ahí |
| **Reglas** | ruleset `60d9dd0f-…`, **idéntico byte a byte al repo Y a staging** |

**La vuelta atrás de las reglas es el id anterior**, que Firebase conserva:
`projects/hogaru-1/rulesets/12070151-9bb8-428e-b829-dbe559059476` (25 ago, 19:33 UTC). Volver es
re-publicarlo — más fiable que una copia local.

### `storage.rules` deriva en los dos ambientes, y NO hay que hacer nada

Se miró al verificar, por la lección de `PLAT-002` —«son DOS ficheros»—, y lo que sale es tranquilo:

| | Deriva | De la que es CÓDIGO |
|---|---|---|
| Producción | 20 líneas | **0** — solo comentarios |
| Staging | 47 líneas | 7, y **equivalentes**: define `rolEnConjunto(tenantId) { return rol(); }` y lo llama donde el repo llama `rol()` directo |

**No hay deriva de comportamiento en ninguno de los dos**, así que desplegar `storage.rules` sería
churn con riesgo real y sin ganancia. Queda anotado para que nadie lo despliegue a ciegas ni se
asuste al verlo diferir.

**LAS FUNCTIONS DE PRODUCCIÓN ESTÁN DESPLEGADAS: 81, cero atrasadas, cero errores.** Medido por
`updateTime` contra la API con la ADC, no por el código de salida. Las cuatro nuevas existen
—`emitClearanceCertificate`, `cancelClearanceCertificate`, `distributeExpense`,
`cancelDistribution`— y los índices también subieron (sin `--force`, así que el índice extra que
producción tenía sigue ahí).

**`FLOW-001` y `FEAT-004` salieron DARK, y eso está medido, no supuesto:** sus banderas
—`producto-prorrateo-de-gastos` y `producto-estado-de-cuenta`— **no existen como documento** en
producción y el catálogo las tiene en `false`. Encenderlas es un acto aparte con `mover-bandera.mjs`.

> ### EL DESPLIEGUE MINTIÓ TRES VECES, Y HAY QUE CONTARLO
>
> | Intento | Salida | Lo que de verdad pasó |
> |---|---|---|
> | Staging, completo | **0** | Sin «Deploy complete», log truncado a 32 líneas, **dos funciones en el código viejo** por `HTTP 429` de cuota de mutaciones por minuto |
> | Producción, 1.º | **0** | `Error: Failed to list functions` — **no desplegó absolutamente nada** |
> | Producción, 2.º | **0** | `Error: There was an error deploying functions` — cuatro programadas caídas porque **caducaron las credenciales a mitad** |
>
> **La verdad de un despliegue es el `updateTime` de cada función**, nunca el código de salida ni
> el log. Y al medir, **contar cuántas se listaron**: `gcloud functions list --gen2 --regions`
> devuelve CERO y el `awk` pasa en verde sobre un conjunto vacío.
>
> **Y son TRES credenciales que caducan por separado:** `firebase login --reauth`,
> `gcloud auth login` (la del CLI, la que usa `gcloud functions list`) y
> `gcloud auth application-default login` (la ADC, la de los scripts). Renovar la ADC no arregla
> la del CLI — pero **la ADC sirve para medir por la API REST** y saltarse la otra:
> `curl -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \`
> `  "https://cloudfunctions.googleapis.com/v2/projects/hogaru-1/locations/us-central1/functions?pageSize=200"`

**`FIX-002` ESTÁ CERRADO EN LOS DOS AMBIENTES: cero documentos fuera de convención en los
diecinueve conjuntos.** Seis commits, de `ae45216` a `cbd6ddf`.

### Y el hallazgo grande vino después, tirando del último huérfano

**`units` es una colección RAÍZ: el id de documento es global, no vive dentro del conjunto.**
`seed-data-co.mjs` y `seed-data-playas.mjs` declaraban los mismos cinco ids —`t1-101`, `t1-102`,
`t2-201`, `t2-202`, `t2-204`—, así que **no cabían las dos**. Ganó Las Playas y **a El Nogal le
desaparecieron cinco unidades**, dejando quince documentos huérfanos y, entre ellos, la membresía
de `juan.herrera@elnogal.co`: abría su portal y **no veía absolutamente nada**.

Desde `b2ddf68` (10 de mayo de 2026), **en los dos ambientes y con las mismas cinco**: no es un
accidente de una corrida, es determinista. `trial-seed.ts` ya lo sabía —prefija con
`${tenantId}--` y su cabecera lo explica—; las semillas demo no.

> **Lo encontró un error, no una búsqueda.** El script de reparación reventó con `ALREADY_EXISTS`
> sobre un documento que la consulta por `tenantId` no devolvía. **Ese `ALREADY_EXISTS` era el
> hallazgo.**

Reparado en los dos: cinco unidades con id prefijado, 18 documentos migrados en staging y 15 en
producción. **El Nogal queda LIMPIO** y los huérfanos bajan de 23 a 5 en staging y de 46 a 31 en
producción. `semillas-ids-de-unidad.test.ts` vigila que no vuelva a pasar.

**Y su gemelo, en el mismo fichero.** Con `asCustomer` no se siembra y no hay unidades, pero
`trial-workspace.ts` le fijaba igualmente `${tenantId}--t1-101` al residente de prueba: una clave
que no existiría nunca. Dos conjuntos de staging seguían así. Ahora solo se le asigna unidad si de
verdad se va a sembrar — **sin unidad se ve igual de vacío, pero se ve que FALTA asignarla**.

| | |
|---|---|
| **Staging** | 140 documentos migrados en seis conjuntos · los diez dan cero · 5 huérfanos · **`createTrialWorkspace` desplegada** (solo esa) |
| **Producción** | **110 documentos migrados** en cinco conjuntos · **los nueve LIMPIOS** · cero huérfanos sin decidir · **ninguna function desplegada** |

**LOS CUATRO BANCOS EN VERDE, y dos de ellos no se habían podido correr nunca aquí:** `npm test`
(1198) · functions (568) · **emulador (180, los nueve ficheros)** · **reglas (208)**. El emulador
necesita Java y esta máquina no lo traía; el JDK quedó en `~/.local/jdk` y el `export` está en
`CLAUDE.md`. Las 23 del paz y salvo se falsaron por tres vías —devolver la etiqueta, quitar la
guarda de unidad desconocida y quitar el slug propio— y cada una enrojeció exactamente las suyas.

**Y la fábrica está probada arreglada, no solo corregida.** Se desplegó `createTrialWorkspace` en
staging, se sembró un conjunto de usar y tirar con la semilla nueva y el informe lo dio **LIMPIO**:
30 documentos en convención, cero migrables. Antes, esos mismos 30 eran los que salían fuera —los
cuatro conjuntos de staging nacidos del trial tenían **exactamente 30** cada uno—. Conjunto
borrado después (69 documentos).

### Lo que se construyó

| Pieza | Dónde |
|---|---|
| **El resolvedor único** (R6) y su espejo | `functions/src/clave-de-unidad.ts` · `src/lib/units/clave-de-unidad.ts` |
| **La guarda** (CF6) | `tests/clave-de-unidad-guarda.test.ts` |
| **La semilla corregida** | `functions/src/trial-seed.ts` |
| **El informe** (no escribe nunca) | `functions/scripts/informe-claves-de-unidad.mjs` |
| **La migración** y su vuelta atrás | `functions/scripts/migrar-claves-de-unidad.mjs` |

**Clasifica MIRANDO CONTRA EL CATÁLOGO, nunca por la forma del valor.** Las dos migraciones
anteriores usaban `/^unit-[a-z0-9]+…/` y no podían acertar: en producción conviven slugs con
prefijo (`unit-t1-101`), sin él (`t1-101`, `1014`) e **ids sembrados que parecen slugs**
(`u-t1-101`, que es un id de documento).

### Tres cosas que solo se supieron ejecutando

1. **Las colecciones son DIECIOCHO, no once.** La ficha decía un número y enumeraba otro;
   `clearanceCertificates` no estaba en su lista y sí en las reglas.
2. **La semilla del trial se delató sola.** Los cuatro conjuntos de staging nacidos del trial
   tenían **exactamente 30 documentos fuera** cada uno —6 unidades × (1 persona + 4 cargos)— y su
   deuda visible era **CERO**: el residente de prueba no veía ni un peso. En producción,
   `queretarock` y `qintilab` llevan la misma firma de 30.
3. **El informe daba LIMPIO a un conjunto roto.** `tenant-nogal-bogota` salía limpio con
   DIECIOCHO huérfanos, uno de ellos un `tenantUsers` — un residente sin ver nada— porque no había
   nada *migrable*. §6 exige cero huérfanos para decir limpio. Corregido y con prueba.

### La vuelta atrás no es una promesa: está ejecutada

Se migró `tenant-santa-maria` de staging, se **revirtió**, se comprobó que el documento volvía
carácter a carácter a `unit-t2-503` sin las dos marcas, y se volvió a migrar. `unitIdPrevio` es lo
que lo hace posible y por eso R3 no es una comodidad.

> **Y ESA VUELTA ATRÁS YA NO EXISTE.** La tarde del 26 se retiraron `unitIdPrevio` y
> `unitIdMigradoEn` de los dos ambientes —110 documentos en producción, 140 en staging—, que era
> justo el objeto de aquella decisión. Lo de arriba es historia de cómo se probó, no una
> capacidad disponible: hoy `--revertir` no puede deshacer nada.

**Y `--revertir` va en el MISMO orden que la ida, no al revés.** Deshacer parece pedir el orden
inverso, pero eso pone `tenantUsers` primero: si la corrida muere a media pasada quedan los
permisos en la clave vieja y el dato en la nueva, que es la rotura máxima.

### D2 resuelta: los 31 de santa-maría están ARCHIVADOS

**Decisión de David, 26 de agosto de 2026.** Producción queda con **los nueve conjuntos en LIMPIO y
cero huérfanos sin decidir**.

**Archivar aquí es registrar la decisión, no esconder el documento.** Se comprobó antes de tocar
nada que son **inertes**: el paquete está `delivered` desde marzo, las invitaciones están
canceladas, y **no inflan ningún número** — el resumen de firmas cuenta UNIDADES que firmaron, no
firmas, así que una firma huérfana no suma a nadie. No cambia una sola pantalla; cambia que dejan de
ser una pregunta abierta.

Se escribe `unitIdHuerfanoArchivadoEn` y `unitIdHuerfanoMotivo` en cada documento —**el motivo es
obligatorio**, porque una marca sin porqué obliga a reabrir la pregunta entera— y **no se toca nada
más**: ni la clave, que es la única pista de a dónde apuntaban, ni el estado. `--desarchivar` lo
deshace, probado en staging.

**Y el archivador se niega a dos cosas, por significado y no por precaución:**

| No archiva | Por qué |
|---|---|
| `tenantUsers` y `users` | Un huérfano ahí es **alguien que hoy no ve nada de lo suyo**. Archivarlo no cierra la pregunta: la tapa, y lo deja fuera para siempre con la decisión marcada como tomada. Hay que asignarle una unidad |
| Cualquier documento con **dinero vivo** | Un cargo con saldo o un anticipo con remanente son plata de alguien. Sin dueño hacen daño donde están, y una marca no la devuelve |

Las dos se probaron contra datos reales de staging: rechaza las cuatro membresías de
`cliente-david` y `cliente-nuevo`, y deja pasar el cargo `u1` porque su saldo es cero.

### Lo que NO se toca, y es decisión cerrada (D2)

**46 huérfanos en producción, 23 en staging.** No se migran: un documento cuya clave no casa con
ninguna unidad solo se reasigna si **exactamente una** unidad lleva su etiqueta (R2), y estos no
tienen etiqueta o no casan. El informe los agrupa por valor para que se puedan decidir:

- `tenant-santa-maria` → **27 documentos bajo `G1bWNzZJuakw9KRoAx7p`**, una unidad que ya no
  existe. **Sus hermanos CON etiqueta resuelven a `DFPjKffOOGZXRjzlScxk` (T1-403)** — la pista está
  medida, la decisión es de negocio.
- ~~`tenant-nogal-bogota`~~ → **RESUELTO**: no eran huérfanos, eran cinco unidades robadas por otra
  semilla. Ver arriba.
- En staging quedan **5**, todos memoria de altas `asCustomer` viejas (`cliente-david`,
  `cliente-nuevo`): membresías de residente de prueba apuntando a una unidad que nunca se sembró.
  El código ya no las crea; estas cinco son conjuntos de prueba y se pueden dejar o limpiar a mano.

### CA10, medido después: cada peso cuelga de una unidad real

| Conjunto | Sin agrupar | Por unidad | Sin dueño |
|---|---|---|---|
| `tenant-santa-maria` | 80.220.000 | **80.220.000** | 0 |
| `queretarock` · `qintilab` | 5.100.000 c/u | **5.100.000** c/u | 0 |
| `tenant-nogal-bogota` (no migrable) | 1.560.000 | 430.000 | **1.130.000** |

**Y T1-101 de `tenant-santa-maria` lee ahora 6.940.000**, que es exactamente la deuda real que la
ficha decía: 3.360.000 que se veían más 3.580.000 que no.

### La deuda que se vuelve visible (§9 — para el administrador, ANTES de que le llamen)

| Conjunto | Unidad | Antes | Después |
|---|---|---|---|
| `tenant-santa-maria` | T1-101 | 3.360.000 | **6.940.000** (+3.580.000) |
| `tenant-santa-maria` | 1014 | 4.480.000 | 5.600.000 (+1.120.000) |
| `tenant-santa-maria` | 1011 | 4.480.000 | 5.600.000 (+1.120.000) |
| `queretarock` y `qintilab` | cuatro unidades cada uno | 0 | +5.100.000 por conjunto |

**Ya está aplicado en los dos ambientes.**

**Los cuatro conjuntos de producción son `isExample: true`** — comprobado contra los documentos,
no de memoria. No hay cliente real al que avisar.

### La Fase 2 está hecha, y encontró de dónde salían los huérfanos

Se barrieron **91 ficheros** con **118 lecturas** de clave de unidad. **No eran «35 sitios que
corregir»: eran tres parches y un cuarto sitio que la ficha no había visto.**

- **El paz y salvo miraba TRES vías** —id, campo y etiqueta—. La etiqueta consulta sin restringir a
  la unidad: dos homónimas se bloquearían entre sí, y una unidad borrada bloquearía a la nueva que
  reutilizara su nombre. Retirada; se conserva el **slug propio**, que no puede traer deuda ajena. Y
  **si la unidad no se reconoce, ya no se emite** — antes salía vacío, daba cero y se firmaba igual.
- **La tarjeta del estado de cuenta agrupaba por ETIQUETA** y elegía la clave **por su forma** (la
  que llevara `--`). Lo primero fundiría dos homónimas sumando su cartera en un papel que se
  entrega.
- **`mergeUnits` decía «TODAS las referencias» y conocía NUEVE de dieciocho**, y después borra la
  unidad. **Eso explica los 27 huérfanos de santa-maría**: están en cuatro de las que faltaban.
- **Lo que NO se tocó, a propósito:** `utils/unitLabel.ts` —resuelve un NOMBRE para enseñar, y ser
  tolerante ahí es correcto— y todas las consultas de dinero, que **ya eran correctas**. La ficha
  acertó al decir que arreglarlas antes de migrar era escribir código para un problema que se iba a
  borrar.

### Dos cosas anotadas que no se tocaron

- **48 de 130 egresos con categoría fuera del tipo** (`servicios`, `seguridad`). Hoy solo se ve
  como **columna Categoría vacía**. **No ensucia el libro**, medido: ningún egreso tiene
  `accountCode` en ninguno de los dos ambientes.
- **`Expense.accountCode` está en CERO** —52 de 52 y 78 de 78— y `PLAT-003` §7.2 dice que se
  resuelve al registrar. Otra capacidad que no puebla. Solo se contó.

---

## EL CIERRE ANTERIOR — `FLOW-001` en staging (25 de agosto de 2026, noche)

**EL MVP DE `FLOW-001` ESTÁ CONSTRUIDO, DESPLEGADO EN STAGING Y VALIDADO POR NAVEGADOR.**
Repartir un egreso entre las unidades, con vista previa, trazabilidad en los dos sentidos y
anulación de la corrida entera. Nueve commits, de `728451f` a `abcbaad`.

**En producción NO hay nada de esto, y es deliberado — ver la decisión de abajo.**

### Lo que de verdad costó no fue el reparto: fue que la tabla estaba vacía

`producto-cobro-por-coeficiente` llevaba encendida en los nueve conjuntos desde la madrugada del
25 **sin poder generar ni una corrida**. No era la bandera. `repartirPorCoeficiente` exige dos
cosas y ninguna estaba en los datos:

| Requisito | Producción, medido |
|---|---|
| **R2** · coeficiente en toda unidad activa, sumando 100 | **0 de 88.** Ni `coefficient` ni `area` existían como campo |
| **R5** · responsable de cobro **o** propietario | **74 de 87 activas sin ninguno de los dos** |

El segundo no estaba anotado en ninguna parte y es el que de verdad bloquea: con el coeficiente
puesto y sin responsable, la corrida sigue sin salir.

**Instrumento nuevo: `functions/scripts/preparar-conjunto-para-prorrateo.mjs`.** Mide los dos y
los cierra; por defecto solo mide. **Los propietarios no se inventan: se enlazan** —cada `people`
ya trae su `unitId` y lo que faltaba era el enlace de vuelta—, y **un arrendatario no se convierte
en propietario**: a quién se le cobra es decisión de negocio y no la toma un script.

### El gemelo hizo la mitad del trabajo

`functions/src/coefficient-billing.ts` (de `PLAT-001`, en producción) ya repartía por coeficiente
con resto mayor, y **ya escribía cuatro de los seis campos que la ficha presenta como nuevos** —
`distributionBasis`, `totalDistributed`, `distributionBasisValue` y `roundingAdjustment`—, que
además **`src/types/domain.ts` no declaraba**: el front no podía leerlos con tipos.

Lo que faltaba era el puente y el deshacer, no el cálculo. Reescribir la aritmética habría
duplicado el riesgo del dinero para no aprender nada.

### Cinco cosas que la ficha decía y el código desmintió

1. **§11.2 pedía una comprobación imposible.** «Cerrar la escritura con `campaignId` de reparto»
   exige LEER la corrida, y esa regla lleva dentro un aviso ganado a pulso: un acceso más la
   lleva al límite y devuelve **error de evaluación**, que deniega igual y deja las pruebas en
   verde por el motivo equivocado. El guardián mira campos del propio documento.
2. **Faltaba una guarda, y era `CF8` otra vez.** `assertTenantOperable` **admite `trial`**;
   la regla `previewModuleWritable` lo **veta**. Una callable escribe con Admin SDK y no evalúa
   reglas, así que la puerta cerrada por regla quedaba abierta por callable. De ahí nace
   `assertTenantContratado`.
3. **La bandera se comprueba EN EL SERVIDOR**, al revés que la del coeficiente —que por eso «no
   es el freno, es solo el botón»—. **Al anular NO se comprueba**, a propósito: apagarla no puede
   dejar cargos vivos sin forma de deshacerlos.
4. **El estado `cancelled` va con `balance = 0`, y no es redundancia.** Seis sitios usan
   `status !== "paid"` como «debe» y `totalCharged` suma sin mirar estado. El compilador cazó
   **uno solo**; los otros cinco eran silenciosos.
5. **§13 dice reglas → functions → front y aquí sí valía**, pero no por lo que dice: la regla
   restringe, y solo es inerte porque **ningún código del cliente crea `billingStatements`**.

### Dos defectos que ninguna suite vio

**El reintento idempotente chocaba con la guarda de R5.** La corrida del primer intento contaba
como «ya repartido», así que un doble clic recibía «este egreso ya se repartió — confirma que
quieres repartirlo otra vez» en lugar de la corrida que ya existía. Lo encontró una prueba.

**El aviso de doble cobro estaba apagado en el 37% de los egresos reales.** De 130 egresos entre
los dos proyectos, **48 llevan una categoría que ya no existe en `ExpenseCategory`** —`servicios`
y `seguridad`, los nombres viejos de `servicios_publicos` y `vigilancia`—. Se descubrió mirando
los datos del conjunto donde iba a validarse, no en ninguna suite. **Un aviso que no salta no da
error ni rojo: solo deja un cobro doble que nadie previno.**

### Validado por navegador, contra la base y no contra la pantalla

En `cliente-convertido-08011856-421616` de staging, con la sesión real:

| Criterio | Qué se vio |
|---|---|
| **CA6/CA7** | La previa calculó 6 líneas y cancelar dejó **0 corridas y 0 cargos** |
| **CA10** | El aviso saltó con categoría `servicios` — confirma que el arreglo llegó desplegado |
| **CA1/CA2** | 6 cargos sumando **exactamente 640.000**: cuatro a 106.667 con residuo, dos a 106.666 |
| **CA3/CA5** | Base congelada en cada cargo; los seis alcanzables desde la factura |
| **R6** | **Cero asientos de libro** creados por el reparto |
| **R5/CA8** | «Ya se repartió (1 corrida)», anular deshabilitado sin motivo; y 6/6 anulados con saldo 0, motivo y autor, **importes intactos** |

**Y salió un defecto que solo se ve mirando:** el diálogo se abría **en blanco** unos segundos con
el botón diciendo «Repartir entre 0 unidades». Eso no se lee como «cargando», se lee como «este
conjunto no tiene unidades» — una de las tres cosas que el diálogo existe para distinguir.

> **Evidencia fechada, dejada a propósito en staging:** en ese conjunto quedan 6 coeficientes y 6
> propietarios sembrados, y el egreso de agua con una corrida **anulada** dentro. Carolina tiene
> ahí una membresía creada para validar; se quita con `--retirar` del sembrador de membresías.

### LA DECISIÓN: `FLOW-001` NO sube a producción todavía, y el motivo es de datos

**Por el criterio del 24 —desplegado y apagado cuenta como abierto— subirlo no cerraría nada.**
Y hay algo más duro: **ahí no puede correr aunque se encienda.** Con 0 de 88 unidades con
coeficiente y 80 de 93 sin propietario, `repartirPorCoeficiente` bloquea por R2 y por R5 antes de
calcular. Sería **la cuarta capacidad viva sobre una tabla vacía**.

La decisión viaja con el primer cliente o la primera demostración que la necesite, y entonces va
acompañada de sembrar sus datos — que es lo que de verdad la enciende.

### Lo siguiente

**La ola B queda hecha en ingeniería.** Lo que sigue del frente 5 es **`FEAT-004` — estado de
cuenta y paz y salvo**, y tiene una ventaja sobre `FLOW-001`: se apoya en la cartera, que **sí
tiene datos**, así que se puede validar sin sembrar nada. `FLOW-003` va después porque su adjunto
depende de ella. El frente 6 (`FIN-002`) sigue al final.

### Dos cosas anotadas que no se tocaron

- **48 de 130 egresos con categoría fuera del tipo.** Hoy solo se ve como **columna Categoría
  vacía** en la lista de egresos. **No ensucia el libro**, y eso está medido: ningún egreso tiene
  `accountCode` en ninguno de los dos ambientes. Se volverá real el día que algo resuelva cuenta
  desde la categoría.
- **`Expense.accountCode` está en CERO en los dos ambientes** —52 de 52 y 78 de 78— y la ficha de
  `PLAT-003` §7.2 dice que se resuelve al registrar. Otra capacidad que no está poblando. Solo se
  contó; no se miró más allá.

---

## EL CIERRE DE LA TARDE — `PLAT-002` a producción (25 de agosto de 2026)

**`PLAT-002` ESTÁ EN PRODUCCIÓN.** El frente 4 dejó de ser una decisión pendiente: se desplegó
la tarde del 25 y se verificó pieza por pieza **contra su fuente**, no contra el «Deploy
complete». `develop` = `master` = `e41affa`.

| Pieza | Cómo se comprobó | Resultado |
|---|---|---|
| **functions** | API de Cloud Functions | **77 en `ACTIVE`**, las tres nuevas a las 19:24:46. Comparadas **por nombre** contra `index.ts`: no falta ninguna |
| **`firestore.rules`** | El ruleset vivo **diferenciado contra el fichero** | Publicado 19:33:49 · **0 líneas de diff** |
| **`storage.rules`** | `updateTime` del release | **Intacto en el 19 de agosto** — no se desplegó, y era lo correcto |
| **front** | **Procedencia del build**, no grep | `rollout-2026-08-25-002` → `SUCCEEDED`, build `READY` desde `master` con el mensaje de `e41affa` |

**El orden fue functions → reglas → front**, y de las dos razones documentadas para invertirlo
**solo una aplicaba**. La de las functions sí: el front nuevo manda `tenantId` en las llamadas de
IA y las viejas lo rechazan con `tenant_en_la_peticion`. La otra no: `CLAUDE.md` decía «las reglas
al final porque `storage.rules` restringe», y **el delta de `storage.rules` contra producción eran
solo comentarios**. La restricción se vivió en staging y se revirtió allí; a producción nunca
llegó. Por eso las reglas pudieron ir en medio, que además evita la ventana en que la consola de
administradoras no podría leer nada.

> **La comprobación que lo destapó, y vale para siempre: diferenciar el ruleset DESPLEGADO contra
> el fichero del repo.** `git diff origin/master..origin/develop` **no** es el delta que vas a
> desplegar — da de más (cosas ya vivas) y puede dar de menos (lo desplegado a mano). Se lee por
> la API de Firebase Rules con la ADC; no hay comando del CLI. Ese diff fue el que decidió **no
> desplegar `storage.rules` en absoluto**.

### `master` NO es el registro de lo desplegado, salvo para el front

Medido: el ruleset vivo antes de esta jornada tenía `updateTime` = 24 ago 22:56, **el minuto
exacto de `a67088c`** (`FIX-001` paso 4), un commit que **nunca llegó a `master`**. Las reglas y
las functions se despliegan desde el árbol de trabajo, no desde una rama. Solo el front sale de
`master`, porque el backend de producción sí se dispara con el push.

### El radio se midió con el predicado REAL, y el que estaba anotado era más laxo

Decía «39 de 39 tienen su documento de membresía». El predicado que corre
(`functions/src/tenant-membership.ts`) exige además que el id sea `{tenantId}_{uid}`, que el
campo `tenantId` **concuerde con el id**, rol de administrador y estado activo. Un documento
heredado con el id y el campo discrepando pasa el conteo viejo y falla el predicado — y es la
ruta del dinero.

**Instrumento nuevo, solo lectura: `functions/scripts/medir-radio-membresias.mjs`.** Resultado:
**radio 0 en los dos proyectos** —producción 39 con conjunto (9 admin), staging 44 (10 admin)— y
**cero ids desalineados** en los 40 y 49 documentos de `tenantUsers`. Staging se corrió **primero,
como control**, porque sus 44 ya se conocían.

### Lo que el despliegue NO consigue, y hay que decirlo

**No se ve nada todavía.** `producto-multiconjunto` está **apagada**, y su documento **ni siquiera
existe** en producción: resuelve por `default_catalogo`. Para encenderla algún día hacen falta dos
pasos, en este orden: `seed-feature-flags.mjs` y luego `mover-bandera.mjs` en **GLOBAL** — el
propio catálogo explica por qué esta no se mueve por conjunto.

**Y aunque se encienda, no la vería nadie:** el selector se pinta con **dos membresías o más** y
en producción no hay ninguna persona con dos. Por eso **CA1 sigue sin observarse**: haría falta
entrar como otro administrador y no hay credenciales. Está medido por construcción —los nueve
siguen con una membresía y el componente devuelve `null` por debajo de dos—, que **no es lo
mismo que haberlo visto**.

> **La evidencia de la validación se dejó puesta EN STAGING a propósito, y no es basura que
> limpiar.** El documento `prueba-plat002.txt` en El Nogal y otro igual en Las Playas —el de la
> bisección de Storage—, más el cobro de $430.000 en T2-204 con recibo `REC-MBZ5EY`. Es lo único
> que demuestra que el claim re-emitido llega a las reglas de Storage.

> **El precio de la solución de Storage, que sigue vigente: dos pestañas en conjuntos distintos
> se pisan.** El claim es uno por usuario, así que la última que cambie gana y la otra empieza a
> recibir denegaciones. Está dicho en `storage.rules`, en la callable y en `switchTenant`.

### Dos inferencias falsas de la jornada, las dos cazadas midiendo

**1. La ausencia del campo `branch` no prueba que no despliegue solo.** El backend de producción
**no** trae `branch` en su `codebase` —igual que el de staging— y de ahí se dedujo que el push no
desplegaría el front. Falso: había rollout **treinta segundos después del push**, y su build
llevaba `branch: "master"`. La distinción real sigue en pie —staging hay que dispararlo a mano,
producción no— pero **se lee del rollout, no del backend**. El `updateTime` del backend tampoco
se movió con este despliegue: no sirve de señal.

**2. La lista de rollouts está paginada y NO viene ordenada**, y la trampa mordió otra vez —en el
propio vigía escrito para seguir el despliegue—. Con `pageSize=5` y sin recorrer `nextPageToken`,
el «más reciente» salió del **11 de junio**. **Paginar siempre y ordenar por `createTime`
después**; un `pageSize` pequeño no es atajo. Y `source.codebase.commit` puede venir **vacío**:
el que identifica el build sin ambigüedad es `commitMessage`.

### Dos líneas que decían algo falso, corregidas en `e41affa`

- La tabla del lote daba **`producto-reservas-servidor` por apagada** y va **9/9**. Era falsa ya
  al escribirse: `FIX-001` la encendió la víspera. Resuelto con `resolveFeatureFlag`, no leído.
  Importaba: con esa lectura, desplegar reglas parecía dejar al residente sin poder reservar por
  ningún camino.
- El comentario de `storage.rules` citaba **59 pruebas** de su suite y hoy son **54**: cinco se
  fueron con la reversión al plan B.

### Lo siguiente

**Quedan dos frentes y los dos son construir**: el **5** (olas B y C — `FLOW-001` prorrateo,
`FEAT-004` paz y salvo, `FLOW-003` cobranza) y el **6** (`FIN-002`, expediente y conciliación).
Por el criterio de David del 24 de agosto —cerrar lo abierto antes de extender— **el 5 va antes
que el 6**. ~~Ya no queda nada desplegado y apagado que cuente como abierto.~~
**Esa última frase caducó el 27 de agosto**, cuando `FLOW-003` salió a producción **apagado**: por el criterio del 24 eso cuenta como abierto. Ver la cabecera.

---

## EL CIERRE ANTERIOR — 25 de agosto de 2026 (madrugada)

**EL LOTE ESTÁ ENCENDIDO. `PH-001` ya no tiene nada dormido.** Las **seis banderas** del frente 1
se encendieron globalmente la madrugada del 25, **una a una y mirando**, y **no costó una línea de
código**: `develop` sigue en `ed95829`. El runbook
`docs/encender-el-lote-habitanto.md` lleva dentro lo que pasó de verdad en cada una.

> **Lo que se encendió NO se puede dar por probado en su camino de escritura.** Se verificó que
> **nada se rompió** y que **cada capacidad aparece donde debía**; no se registró ningún pago ni se
> generó ninguna corrida. Decisión de David: **sin cobro de prueba**. El único camino de escritura
> probado en producción sigue siendo el del 24 (§13, T2-203).

**Leer los remotos con `git ls-remote`, no de aquí.** Esta cabecera llevó los commits a mano y se
quedó corta tres veces en una noche. Al cerrar, **`master` = lo que corre en producción**, y
`develop` va por delante **solo con el commit de documentación de este cierre**: no queda código
sin desplegar.

**LA JORNADA DEL 24 ESTÁ DESPLEGADA.** Las tres piezas salieron en orden —reglas → functions →
front— y cada una se comprobó, no se dio por buena:

| Pieza | Cómo se comprobó |
|---|---|
| **Reglas** | `released rules to cloud.firestore`, y **227 pruebas de reglas en verde** contra el emulador sobre el mismo fichero. Ojo: `npm test` las EXCLUYE — hay que correr `npm run test:rules:all` aparte |
| **Functions** | **Ninguna función del código se quedó fuera** (74 desplegadas, comparadas por nombre contra `index.ts`). Dos toparon con `HTTP 429` de cuota por minuto y **reintentaron solas** hasta `✔`. El `lib/` commiteado sale byte a byte de compilar `src/`: tras `run build` el árbol quedó en cero cambios |
| **Front** | `70136b9..1a9e022`, remoto releído con `git ls-remote`. La procedencia se midió con **la huella del bundle**: los chunks de `/_next/static/` pasaron de `6a944c17` a `2bc73d04` siete minutos después del push, y el `Updated Date` del backend saltó a las 12:42 |

> **Este CLI no tiene `apphosting:rollouts:list`** — solo `backends:*`, `secrets:*` y
> `rollouts:create`. Para saber si el front nuevo está sirviendo, la huella de los chunks es lo
> que hay, y es **mejor que un grep**: un grep encuentra la cadena en las dos versiones.

**§13 VERIFICADO EN PRODUCCIÓN, CON NÚMEROS ANOTADOS ANTES.** Se cobró T2-203 (multa de jun 2026,
$500, **el saldo exacto**) en `conjunto-las-playas`, y salieron los seis números predichos: el
cargo a Saldo $0 / Al día, el libro de **53 a 54** movimientos, ingresos por cuotas de $127.500 a
**$128.000**, saldo de fondos de −$10.300 a **−$9.800**, cartera pendiente de $18.500 a
**$18.000**, y **anticipos quieto en $0**. Ese último es el que de verdad prueba §13: la bandera
está encendida en ese conjunto, así que si el camino nuevo se colara donde no debe, ahí habría
rastro. Recibo `REC-SAJU3D`. **El cobro se dejó puesto** — revertirlo dejaría el pago Y su reverso
en el libro, más sucio que un pago limpio.

> **Un cobro normal MANDA CORREO.** Desde `FIN-001` el recibo nace dentro de la transacción, así
> que `applyPayment` crea el `paymentVouchers` y eso enciende `onPaymentVoucherCreated`, que
> notifica **a los residentes de la unidad pagadora**. En Las Playas esas direcciones son alias de
> David (`david.macar.18+resN@hotmail.com`), no de terceros — comprobarlo **antes** de cobrar en
> cualquier otro conjunto.

**LAS BANDERAS, RESUELTAS CON EL CÓDIGO DEL SERVIDOR.** No leídas de `/superadmin/flags` ni de los
documentos: se importó `functions/lib/feature-flags.js` compilado y se corrió `isFeatureEnabled()`
sobre los **nueve conjuntos**. Es la única forma de saber qué ve el producto, porque la precedencia
—kill switch maestro, kill switch de la bandera, override, global, default— no se lee de un campo.

| Bandera | Los nueve conjuntos |
|---|---|
| `producto-plan-de-cuentas` · `producto-registro-proveedores` · `producto-cobro-por-coeficiente` | **encendidas** |
| `producto-concepto-al-libro` · `producto-anticipos` · `producto-pago-multiple` | **encendidas** |
| `producto-importacion-masiva` | encendida (default del catálogo) |
| `producto-reservas-servidor` | **encendida** — esta fila decía «apagada» y era falsa ya al escribirse: `FIX-001` la encendió en los nueve el 24 de agosto, la víspera. Medido el 25 con `resolveFeatureFlag`: 9/9 por `valor_global` |

**Sin overrides.** El de `conjunto-las-playas` se retiró al hacer `producto-anticipos` global, y el
documento quedó con `flags: {}` — eso es normal al borrar un campo, no un residuo. Kill switch
maestro en `false` y ninguna bandera con kill switch propio.

> **El orden importó, y una precedencia lo explica: el override manda sobre la global.** Se puso
> primero la global y **después** se quitó el override. Al revés, Las Playas —el único conjunto
> donde los anticipos estaban validados— se habría quedado sin la capacidad unos segundos.

> **Caer al valor por defecto no es sinónimo de estar apagada:** `producto-importacion-masiva` no
> tiene documento y su default es **Encendida**.

> **ENCENDER YA ESTÁ HECHO (25 ago 2026).** Esta línea decía «lo que falta para cerrar `PH-001` ya
> no es construir: es encender». Encendido está: las seis, en los nueve conjuntos. **Lo que queda de
> `PH-001` vuelve a ser construir** — `FLOW-001` de la ola B y la ola C entera.

**PRODUCCIÓN NO TIENE NI UN CLIENTE REAL, y ya no queda nada por confirmar.** Los nueve conjuntos
son de demostración o prueba interna.

## CUATRO ÍNDICES QUE FALTABAN EN PRODUCCIÓN — puestos el 24 de agosto (tarde)

**Salieron de mirar la consola del navegador, no de una suite.** Las 1161 pruebas del front
estaban en verde mientras tres de estas consultas fallaban en producción. No los causó el
despliegue del 24: el delta `70136b9..1a9e022` no toca `firestore.indexes.json` ni ninguna de las
colecciones. Y **`--only firestore:rules` NO despliega índices**, así que tampoco se arreglaron de
paso.

| Colección | Índice | Quién lo dispara | Cómo se vio |
|---|---|---|---|
| `notifications` | `(userId ASC, createdAt DESC)` | La campana, para **cualquier cuenta sin conjunto** — el superadmin | Consola, en `/superadmin/flags` |
| `billingReminderJobs` | `(status, tenantId, scheduledFor)` ASC | `/admin/billing`, en cada carga | Consola, tres veces en tres cargas |
| `billingSchedules` | `(status, tenantId, scheduledFor)` ASC | `/admin/billing`, en cada carga | Consola, tres veces en tres cargas |
| `documents` | `(tenantId ASC, uploadedAt DESC)` | **`/resident/documents`** | **NO se vio: salió del barrido** |

**Desplegados en LOS DOS ambientes**, y comprobado que los tres cuentan igual: `hogaru-1` 61,
`vivaru-staging-02` 61, fichero 61. Staging estaba en 57 y le faltaban **los mismos cuatro** —
llevaba desde antes anotado como «faltan dos índices en staging» y eran cuatro—. Antes de
desplegar allí se comprobó que **ningún índice suyo estuviera fuera del fichero**, porque
`--only firestore:indexes` puede proponer borrados: eran cero, así que no había nada que perder.

> **Un índice se puede desplegar directo a producción; reglas, functions y front NO.** Un índice
> es aditivo: no toca datos, no cambia el comportamiento de ninguna consulta que ya funcionaba, y
> deshacerlo es borrarlo. Además **el fallo solo se ve donde están los datos** — estos errores
> vivían en la consola de producción, y pasar por staging no habría demostrado nada sobre ella.

**Los dos de billing no tenían NI UN índice declarado** para su colección, y estaban anotados como
«faltan en staging»: faltaban también en producción.

**Las especificaciones no se adivinaron.** Se decodificaron del propio parámetro `create_composite`
del enlace que da el error —cada campo es `\x1a <len> \x0a <len_nombre> <nombre> \x10 <orden>`,
con 1 = ASC y 2 = DESC— y se cotejaron con la forma real de cada consulta.

### Lo que enseñó, y es lo que hay que llevarse

**1. Un campo OPCIONAL en el `where` son DOS consultas, y cada una necesita su índice.** La campana
filtra por `tenantId` solo si existe: con conjunto usa `(userId, tenantId, createdAt)` y funciona;
**sin conjunto pide `(userId, createdAt desc)`**, y el compuesto de tres **no puede suplirlo**
porque `tenantId` va en medio.

**2. Una consulta solo falla en la pantalla que la usa, y el navegador solo ve el rol que tenga la
sesión abierta.** `useDocuments` parecía sana porque `/admin/documents` **no la usa**: la usa
`/resident/documents`. Se encontró **cruzando el código contra el fichero de índices**, no mirando.
Mirar con un solo rol no cubre esto.

**3. El error CAMBIA cuando aciertas la definición.** Pasa de «You can create it here» a **«That
index is currently building and cannot be used yet»**. Ese cambio es la confirmación de que el
índice casa con la consulta; después hay que esperar (fueron unos cinco minutos) y recargar **con
la consola limpia**, porque se acumulan.

### Lo que queda de esta auditoría

**Solo se cruzaron las consultas que pasan por `subscribeTenantCollection`** — 10, de las que
faltaban 4. **Las que construyen `query(...)` a mano NO se comprobaron:** un barrido con regex no
casó con cómo está escrito el código y se descartó en vez de darlo por bueno. Quedan unas ocho, y
una de ellas —`src/features/admin/services.ts:419`— ordena por un **campo dinámico**, así que
necesita un índice por cada valor que reciba.

## EL RESIDENTE NO VEÍA NINGÚN DOCUMENTO — arreglado el 24 (tarde)

**Salió de verificar el cuarto índice, y es más grande que el índice.** La pantalla decía «Sin
documentos» y eso **no era un dato: era un fallo mudo**.

| Medida, contra la base de producción | |
|---|---|
| `documents` de `conjunto-las-playas` | **8** |
| la misma consulta con `orderBy("uploadedAt","desc")` | **0** |
| en todo el proyecto | 39 documentos, **38 sin `uploadedAt`** |

**Un `orderBy` DESCARTA los documentos que no traen el campo**, y la subida real
(`subirDocumento`, `features/admin/services.ts`) escribe `createdAt`, nunca `uploadedAt`.

**El gemelo que lo hacía bien estaba en el mismo repositorio:** `watchDocuments`, del lado del
administrador, pide **sin orden y ordena en memoria** — por eso `/admin/documents` sí veía los
ocho. Es el patrón de `watchLedger`, el único que no depende de índices, y es lo que hace ahora el
residente.

**Y el tipo era parte del defecto.** `TenantDocument` declaraba `title`, `category`, `audience`,
`uploadedAt` y `url`: **los cinco inexistentes en los documentos reales**. La pantalla pintaba
`item.title`, así que aunque la consulta hubiera devuelto filas, habrían salido **en blanco**.
Corregido, y borrado el código muerto que sostenía el esquema fantasma (`createDocument`, 0
llamadores; `demoTenantDocuments`, 0 usos).

**No abre nada nuevo:** `storage.rules` ya pone `documents` entre las carpetas compartidas
(`miembro(tenantId)`) y la regla de Firestore concede el documento a `sameTenant`. Lo único que
cambia es que la pantalla enseñe lo que las reglas ya conceden.

**Y el índice `documents (tenantId, uploadedAt DESC)` que se añadió esa misma tarde queda muerto**
con este arreglo: retirado del fichero. Falta quitarlo de los dos ambientes — se hace **después**
de que el front nuevo esté sirviendo, no antes, o el front viejo vuelve a fallar.

> **El guardián se falsó, y la falsación encontró una prueba floja.** Al reintroducir el defecto se
> pusieron rojas dos de las seis — y una tercera, que decía vigilar el campo fantasma, **se quedó
> verde con el código roto**: buscaba `orderBy("uploadedAt"` y el defecto real tiene la forma
> `{ orderByField: "uploadedAt" }`. Reescrita. **Si romper el código no la pone roja, no vigila lo
> que dice vigilar.**

## Y CON ÉL, UNA SOBRE-CONCESIÓN QUE LA LISTA VACÍA TAPABA — cerrada (opción A)

**Al arreglar la lista aparecieron los documentos que nadie veía, y seis de los ocho eran archivos
financieros automáticos.** El histórico de cartera lleva una hoja «Morosos» con **unidad, deuda y
períodos**; el reporte de comité, «mayores deudores». **En todo el proyecto son 32 de 39.** Es la
misma clase que se cerró esa mañana en `FLOW-002` con `advances`: detalle por unidad, por otra
puerta.

**`storage.rules` ya estaba bien, y daba igual.** Los archivos van a `cartera-history/` y
`committee-reports/`, las dos en `carpetasFinancieras()` —solo administración—. Pero
`archiveBuffer` guarda en el documento un `fileUrl` con `firebaseStorageDownloadTokens`, y **un
enlace con token se salta las reglas de Storage**. Mientras se pudiera leer el documento, la
carpeta cerrada no protegía nada. **Por eso la palanca es la regla de Firestore.**

**La regla nombra roles**, como `advances` y `bankAccounts`:

| Rol | Qué ve | Por qué |
|---|---|---|
| Administración y superadmin | Todo | — |
| **Consejo** | **Todo** | `canAccessPath` le deja SOLO en `/admin/documents`, esa pantalla consulta sin filtrar por categoría, y los reportes de comité son suyos. Cerrarle por categoría lo dejaría sin su única pantalla |
| Residente | Lista **blanca** de categorías compartibles | Con lista negra, una categoría nueva se publicaría sola |
| **Portería** | **Nada** | Entraba por `sameTenant`. Ninguna pantalla de `/guard` lee la colección |

**Y la consulta del residente filtra por categoría EN EL SERVIDOR**, no solo en memoria: sin ese
`where`, Firestore rechaza la consulta entera aunque todos los documentos fueran compartibles. Es
la trampa de `bankAccounts` y su `active == true`. Opción `oneOf` nueva en
`subscribeTenantCollection`, e índice `(tenantId, category)`.

**Desplegado en el orden que exige una regla restrictiva:** índice → front que ya filtra → regla.
Al revés, la pantalla deja de cargar hasta que termine el rollout. Es la lección de `FIN-001`.

> **237 pruebas de reglas, y falsadas:** al volver la regla a `sameTenant` se ponen rojas **cuatro**,
> y son exactamente las cuatro restrictivas. Una hubo que MEDIRLA porque no se podía razonar: el
> flujo del reglamento consulta con `category == "reglamento"`, una **igualdad contra una regla
> escrita con `in`**. Funciona — si no, se habría roto en producción.

**Lo que NO cierra esto:** un `fileUrl` con token sigue siendo un enlace público para quien ya lo
tenga. Cerrar la lectura del documento impide **descubrirlo**; no revoca los que ya circulen.

## LA REVISIÓN ADVERSARIAL ESTÁ CERRADA

**`docs/revision-flow-002-por-verificar.md` — las 37 triadas: 36 eran ciertas y están resueltas, 1
se descartó.** No queda ninguna abierta. Se reprodujo cada una antes de tocarla, y cinco se
midieron con números en vez de razonarlas.

**Lo que salió de ahí y NO estaba en la lista:** probando el veto de `sourceType` contra el
emulador apareció que **la conciliación no podía casar ni un pago**. En un `update` con merge
Firestore evalúa el documento *resultante*, que conserva el `sourceType`, y la regla lo vetaba —y
desde `FIN-001` todos los asientos de cobro nacen con `sourceType: "billingStatement"`. Corregido.

## LO QUE NO ESTÁ HECHO DE `FLOW-002`, dicho para que no se lea como cerrada

| Qué | Dónde | Nota |
|---|---|---|
| ~~**§9 y CA13**~~ | ~~`functions/`~~ | **HECHO Y EN PRODUCCIÓN el 24 de agosto de 2026** (`c05b274`). El aviso nombra los cargos y el saldo a favor, con el término de cuota **del país del conjunto**. Verificado con un cobro real |
| ~~**CF8**~~ | ~~`functions/src/advances.ts` y `payments.ts`~~ | **HECHO Y EN PRODUCCIÓN el 24 de agosto de 2026** (`9f75083`). Detalle abajo |
| ~~**`personId` del anticipo**~~ | ~~`functions/src/advances.ts`~~ | **RETIRADO del contrato** el 24 de agosto de 2026, con decisión de David: el anticipo es de la unidad y no lleva ningún dato personal. §7.1 y §7.6 reescritas |
| **El total de anticipos del consejo** | `PLAT-004` | Decisión del 24 ago: se le **retiró** la lectura de `advances` porque era detalle por unidad. El agregado que la PRD le promete **no existe**, y una regla no sabe calcularlo |

### CF8 — CERRADO EN PRODUCCIÓN (24 ago 2026, `9f75083`)

**Se reprodujo antes de tocar nada, y con dinero de verdad.** Con la sesión del `tenant_admin` de
`Privada Las Playas` (`pXHEn5iWKWgX4sDF9tVp`, `suspended`) se cobró **$2.120.000** sobre PA-101:
recibo `REC-HDFW4R`, asiento en el libro, cartera a cero y entrada `apply_payment` en auditoría.
**El producto no opuso nada.** Los seis números predichos antes de pulsar salieron los seis, y los
anticipos se quedaron en `0`, que es lo que prueba que no se coló ningún camino nuevo.

**La forma corta del defecto, que es la que hay que recordar:** el producto ya se negaba a
**facturarle** a un conjunto suspendido —crear un cargo es escritura directa del cliente y sí pasa
por `tenantOperable` en las reglas— pero le dejaba **cobrar**, porque cobrar va por callable con
Admin SDK. Y dentro de `index.ts` había un contraste peor: `sendBillingReminder`, que solo **manda
un correo** recordando que pagues, estaba protegida por **dos** candados de estado
(`assertTenantAdminOrSuper` → `assertTenantOperable`, y `assertModuleAllowed`); `applyPayment`, que
mueve el dinero, por **ninguno**.

**No hubo que diseñar nada.** `assertTenantOperable` ya existía y funcionaba: el defecto real era
que estaba **privada de `index.ts`**, así que `payments.ts` y `advances.ts` no podían llamarla sin
import circular. Sale a **`functions/src/tenant-status.ts`**, mismo movimiento que
`callableCorsOrigins` → `http-config.ts`.

**El orden de las tres comprobaciones no es cosmético**, y hay una prueba por cada decisión:

1. **el superadmin sale primero** — necesita operar un conjunto suspendido justamente para
   reactivarlo; es la salida de emergencia;
2. rol y conjunto del token;
3. **el estado del conjunto al FINAL, nunca antes** — si fuera antes, un residente hurgando en un
   conjunto vencido recibiría «el período de prueba terminó» en vez de «no tienes permiso»,
   **filtrando el estado comercial de un cliente a quien ni siquiera es miembro**.

**Las seis callables cubiertas**, incluida `previewPaymentAllocation`, que no escribe nada: solo se
pide la vista previa para cobrar a continuación, así que la pantalla falla temprano con el mensaje
correcto en vez de dejar rellenar un formulario que va a morir al enviarse.

**Falsado, porque un verde no vale sin falsación.** Se rompió el código a propósito en cuatro
variantes y cada una tumbó **exactamente** lo que debía y nada más: quitar la comprobación de
`assertPuedeCobrar` (caen las 5 de pagos, ninguna de anticipos), quitarla de
`assertPuedeOperarAnticipos` (las 3 de anticipos, ninguna de pagos), invertir el orden (solo la de
la fuga de estado comercial) y someter al superadmin (solo la de la salida de emergencia).

> **Y el criterio mide el número, no el paso.** «Lanza una excepción» sería cierto y aun así
> insuficiente: si el guardián fallara *después* de la transacción, el throw ocurriría igual con el
> cargo ya cobrado. La prueba comprueba que cargo, libro, recibos y anticipos quedan **idénticos**.

**Verificado en el navegador sobre el mismo conjunto**, no solo con la suite: al intentar cobrar de
nuevo en PA-101 sale **«Este conjunto está suspendido. Contacta a un asesor de Vivaru para
reactivarlo.»**, y la base no se movió ni un documento.

**El cobro de la reproducción se dejó puesto** (decisión de David), igual que el de T2-203 en §13:
revertirlo dejaría el pago **y** su reverso en el libro, más sucio que un pago limpio. Ojo, porque
esto ya no tiene vuelta fácil: **`revertPayment` es una de las seis**, así que ese cobro ahora solo
lo puede deshacer un superadmin.

> **Un hallazgo del camino que NO era de CF8: las suites de emulador se pisaban entre sí.** Corrían
> en paralelo contra un solo emulador y cada `beforeEach` limpia colecciones **globales**, así que
> se borraban los datos mutuamente. Daba **fallos fantasma que cambiaban de sitio entre corridas**
> —9 y luego 4 sin tocar una línea, y tres de ellos en un fichero que estaba verde—. Se arregló con
> `fileParallelism: false` en `functions/vitest.emulator.config.mts`. **Se detectó solo porque se
> midió la línea base ANTES de culpar al cambio propio**; sin eso se habría leído como un defecto
> del arreglo.

**Lo que queda de esta tanda, anotado como chip aparte y sin construir:**

- **La fecha contable del cobro sale en UTC.** `new Date().toISOString().slice(0, 10)` en
  `src/app/(admin)/admin/billing/page.tsx:240`: a partir de las ~19:00 hora local devuelve **el día
  siguiente**. El panel decía «lunes, 24 de agosto» y el asiento, el recibo y el `lastPaymentAt`
  quedaron con `2026-08-25`. Se ve solo: tras saldar la cartera entera, «% recaudo · Hoy» seguía en
  `0.0% · Sin actividad`. **Afecta a dinero y al comprobante emitido**, y probablemente el cobro de
  §13 arrastra lo mismo.
- **El aviso de reparto fallido invita a cobrar igual.** Cuando la vista previa falla, el diálogo
  dice «Puedes registrar el cobro contra este cargo». Desde CF8 eso puede ser falso: hay que
  distinguir `failed-precondition`/`permission-denied` —enseñar el mensaje del servidor y
  deshabilitar el botón— del fallo transitorio, donde el texto actual sigue valiendo.
- **`Privada Las Playas` no tiene campo `currency`**, que CLAUDE.md prohíbe expresamente. No rompe
  —`useTenantCurrency` cae a `COP`— pero pinta en pesos colombianos las cuentas de un conjunto de
  Ciudad de México, y su recibo lleva dentro `issuerCountry: MX`.

## TRES BANDERAS ENCENDIDAS QUE NO PRODUCEN NADA — el hueco es el DATO (24 ago 2026)

**Encender no es lo mismo que poner en uso, y esto no estaba en ninguna lista.** Medido resolviendo
las banderas con `functions/lib/feature-flags.js` y contando documentos en producción:

| Capacidad | Bandera | Dato en producción |
|---|---|---|
| **Cobro por coeficiente** (`PLAT-001`) | encendida | **0 de 88 unidades** tienen coeficiente |
| **Registro de proveedores** (`FEAT-003`) | encendida | **0 proveedores** registrados |
| ~~**Plan de cuentas** (`PLAT-003`)~~ | encendidas las dos | **RESUELTO el 24 ago: los nueve sembrados, 21 cuentas cada uno (189 en total, releído).** La pantalla del plan pasó de vacía a «21 cuentas» |

**El tercero ya está cerrado**, y su causa estaba localizada: el plan **solo se siembra al CREAR un conjunto**
(`sembrarPlanDeCuentas` desde `createTenantWorkspace` en `index.ts:1103` y desde
`trial-workspace.ts:170`), y **los nueve conjuntos de producción son anteriores a la
funcionalidad**. Nunca hubo un backfill. Se corrió `functions/scripts/sembrar-plan-de-cuentas.mjs` sobre los nueve, **simulando primero**: cero
colisiones de código, 21 creadas en cada uno y 0 respetadas. **Y de paso destapó un número
desfasado**: la semilla tiene **21 documentos y 19 con `systemKey`**, no los «18 y 20» que decía
CA1 de `PLAT-003` — `FLOW-002` le añadió `1.10 · Anticipos de residentes` y el criterio se quedó
atrás. Corregido, y el script ahora **cuenta la semilla** en vez de citar un número a mano.

**Quedan los otros dos, y no son ingeniería:** capturar coeficientes de 88 unidades y dar de alta
proveedores. Sin clientes reales solo tiene sentido para que la demostración enseñe algo.

> **Lo que sembrar CONGELA, dicho para que no sorprenda luego.** Una segunda pasada no pisa
> renombres ni renúmeros, así que los nombres que quedaron son los de la semilla —y son
> **colombianos**: «Cuotas de administración» en los cuatro conjuntos de México—. Es el mismo
> comportamiento que ya tenía cualquier alta nueva, y **el plan de cuentas por país está aparcado a
> propósito**; pero el día que se localice, los nueve necesitarán migración, no una segunda siembra.

> **No rompe nada, y conviene decirlo con precisión para no asustar.** Un asiento puede llevar
> `accountCode` de un conjunto sin plan: `cajonDe` y `etiquetaDe`
> (`src/features/finanzas/financial-statement.ts`) caen a la categoría, y el caso está documentado
> ahí mismo. **Comprobado el 24 de agosto**: el cobro de prueba escribió `accountCode: "1.3"` con
> `chartOfAccounts` vacío y el informe lo nombra igual. Lo que pasa no es que se rompa: es que la
> capacidad **no aporta nada todavía**.

**Es el mismo patrón que ya se conocía del coeficiente**, y resulta que son **tres**, no uno. La
lección de método: [[una-bandera-no-siempre-es-el-freno]] decía que una bandera puede no ser el
freno; esto añade que **encenderla puede no ser el arranque**. Antes de contar una capacidad como
entregada, preguntar **cuántas filas tiene la tabla que alimenta**.

**Coste de cerrarlo:** el plan de cuentas es correr un script sobre nueve conjuntos. Los otros dos
son captura de datos —coeficientes por unidad y alta de proveedores—, que **no es trabajo de
ingeniería sino de contenido**, y sin clientes reales solo tiene sentido para que la demostración
enseñe algo.

## LO SIGUIENTE — CERRAR FRENTES, NO ABRIRLOS (decidido con David el 24 ago 2026)

**El criterio cambió, y con él el orden.** Hasta hoy la cola empezaba por `FIN-002` porque era el
frente de ingeniería más grande abordable sin clientes. **David fijó otro criterio: cerrar lo
abierto antes de extender.** Con ese criterio, abrir el frente más grande del tablero teniendo
cuatro a medias es exactamente lo que no hay que hacer — **`FIN-002` baja al final**.

| # | Frente | Qué significa CERRADO | Coste |
|---|---|---|---|
| ~~**1**~~ | ~~**`PH-001` — encender el lote**~~ | **HECHO el 25 de agosto de 2026.** Las seis encendidas globalmente en los nueve conjuntos, una a una y mirando, y el override retirado. Costó **cero código**. Detalle en `docs/encender-el-lote-habitanto.md` | — |
| ~~**2**~~ | ~~**`FLOW-002` de verdad**~~ | **CERRADO ENTERO el 24 de agosto de 2026.** CF8 (`9f75083`), §9/CA13 (`c05b274`) y `personId` retirado del contrato. Lo único que le quedaba fuera —el total de anticipos del consejo— vive en `PLAT-004` | — |
| ~~**3**~~ | ~~**`FIX-001` completo**~~ | **MVP CERRADO el 24 de agosto de 2026** (`a67088c`): bandera encendida en los nueve, puerta medida **con contenido**, y la rama del residente retirada del `create`. Queda solo la **entrega 2** (política por área), que es Fase 2 de la ficha, no MVP | — |
| ~~**4**~~ | ~~**`PLAT-002` entrega 2**~~ | **MVP CERRADO el 25 de agosto de 2026** (`dbb3f29`…`5894001`): el selector, la sesión con varias membresías, la entidad administradora y su consola. **En staging, verificado por navegador de punta a punta.** La vista de cartera NO entraba — el Story Map la sitúa en Fase 2. Detalle en la cabecera | — |
| **5** | **Olas B y C** | **La ola B queda hecha**: `FLOW-001` construido, desplegado en staging y validado por navegador el 25 de agosto (`728451f`…`abcbaad`). **No sube a producción**, y el motivo es de datos: con 0 de 93 unidades con coeficiente y 80 de 93 sin propietario, ahí no puede correr aunque se encienda. Queda la ola C: `FEAT-004` (paz y salvo) y luego `FLOW-003` (cobranza), cuyo adjunto depende de ella | Alto — es construir |
| **6** | **`FIN-002`** | **ABIERTO el 28 de agosto de 2026** — y es el frente elegido para la sesión siguiente. Expediente y conciliación determinística. La decisión se tomó dos veces ese día: primero que no valía la pena sin nadie conciliando, y luego se revirtió para llegar listos al primer cliente | Alto |

**`PLAT-002` YA ESTÁ EN PRODUCCIÓN** desde la tarde del 25 (`e41affa`), así que esa decisión
dejó de estar pendiente. ~~**Del 5 queda la ola C**, y el 6 (`FIN-002`) sigue al final.~~

> **AL 28 DE AGOSTO DE 2026 ESTA TABLA ESTÁ ENTERA TACHADA.** La ola C se cerró —`FEAT-004` el 26,
> `FLOW-001` y `FLOW-003` el 27, éste último verificado de punta a punta el 28— y **`FIN-002` no se
> construye por decisión**. **Las seis filas están cerradas o retiradas: la cola quedó vacía**, y eso
> es el estado del tablero, no un hueco por llenar. Ver la cabecera de este documento.

> **La decisión que sí queda abierta es otra, y no es de ingeniería: cuándo sube `FLOW-001`.**
> No se pospone por prudencia sino porque **producción no tiene los datos que exige** — y
> subirlo apagado no cerraría nada, por el criterio de esta misma sección.

**El 1 fue primero y salió como se esperaba:** eran siete pasos construidos, probados y desplegados
que no le servían a nadie por estar dormidos. **Después se abrió `FLOW-002` de verdad**, empezando
por `CF8` porque era dinero — y `CF8` **se cerró el mismo 24 de agosto**.

> **Lo que enseñó encender, y no estaba previsto.** Ninguna de las seis rompió nada, pero **tres de
> las comprobaciones del runbook no se podían hacer tal como estaban escritas**, y eso se supo
> mirando el código antes de encender, no después. La más útil: la bandera del coeficiente
> **no la comprueba el servidor** —`generateCoefficientCampaign` solo valida que seas
> administrador activo—, así que **no es el freno; es solo el botón**. El freno real es que la
> corrida exige coeficientes, y **cero de las 88 unidades de producción tienen uno**.

### Por qué «falta» algo en casi toda PRD — son TRES cosas distintas

El índice de PRD las mezcla en la misma celda, y por eso todo parece a medias cuando no lo está.

| Categoría | Cuáles | ¿Cerrada? |
|---|---|---|
| **(a) Fase 2 aplazada a propósito** | `PLAT-001`, `PLAT-003`, `FEAT-003` | **SÍ.** El alcance se sacó al escribir la ficha, no después |
| **(b) MVP a medias** | `PLAT-002` (entrega 2), `FIX-001` (pasos 2–4) | **NO.** Trabajo comprometido sin hacer |
| **(c) Criterios del alcance ENTREGADO, sin construir** | **VACÍA desde el 24 de agosto de 2026.** Los tres de `FLOW-002` —CF8, §9/CA13 y `personId`— se cerraron ese día: dos construidos y uno retirado del contrato | **SÍ, y esta categoría no debería volver a llenarse** |

> **REGLA NUEVA, para que (c) no se repita:** una PRD **no se marca «EN PRODUCCIÓN» hasta que todos
> sus criterios están cumplidos o movidos explícitamente a Fase 2**. Hoy «en producción» significa
> «el código está desplegado», que no es lo mismo — y así se marcó `FLOW-002` con tres criterios
> propios sin cumplir, uno de ellos **de dinero**.

**CF8 ya no está abierto.** Decía aquí que un conjunto `suspended` **podía hoy cobrar y cruzar**, y
era cierto hasta el 24 de agosto de 2026: se reprodujo con dinero de verdad y se cerró el mismo día
(`9f75083`, en producción). El detalle está arriba, en su propia sección. Era anterior a `FLOW-002`
—venía de `FIN-001`—, y la ficha solo lo amplió a tres operaciones más.

### Lo que no entra en los seis frentes

| Qué | Nota |
|---|---|
| `PRD-V-PLAT-004`, sin escribir | El rol `committee` solo alcanza `/admin/documents`, **y arrastra la deuda del total de anticipos** |
| **Auditar los índices de las consultas escritas a mano** | Las del helper ya están cruzadas y sus 4 huecos tapados. Faltan ~8 con `query(...)` directo, una con campo de orden **dinámico** |
| El índice muerto de `ledgerEntries`, y el de `documents` | Ninguno lo usa una consulta. Borrarlos pide `--force`, que arrasa con todo lo que no esté en el fichero |
| La carrera de la transacción del plan | La guarda existe y no está ejercitada |
| El plan de cuentas por país · la cuenta de vigilancia en la semilla | Aparcados a propósito |
| Portar seis entradas de changelog a Notion | Su estado sí está al día; el changelog va por detrás |

## QUÉ HACE FALTA DE DAVID

**1. Tres filas que borrar en la bitácora de Notion** — dos duplicadas marcadas
`[DUPLICADA — BORRAR]` y una en blanco («New page», los ocho campos vacíos). **El conector de
Notion no tiene operación de papelera**: su única herramienta de mover reasigna el padre y no
acepta la papelera como destino. Se borran a mano, tres clics cada una.

**2. Decisiones abiertas, ninguna urgente:** escribir `PLAT-004` · el plan de cuentas por país · la
cuenta de vigilancia.

### Lo que YA NO hay que pedir ni volver a mirar

- **Acceso al navegador.** Funciona con la sesión de David, y él cambia de rol si se le pide. El
  límite: **solo se ve el rol que tenga la sesión abierta**, y son excluyentes por origen.
- **El roadmap Albert–Vivaru de Notion.** Da 404: vive en otro workspace.
- **La revisión adversarial de `FLOW-002`.** Cerrada del todo.
- **Si la jornada del 24 está desplegada.** Lo está, y §13 se comprobó con números en producción.
- **`CF12`, `computeBalanceStatus`, la decisión contable R9/R15 (cerrada como D3).**
- **Marcar `Queretarock` como conjunto de ejemplo.** Hecho el 24 de agosto de 2026: los nueve
  están marcados y el script dice «No hay nada que marcar», con **0 conjuntos sin clasificar**.
- **Si la credencial ADC está caducada.** No lo estaba. Lo que no responde es
  `gcloud auth print-access-token`, que es **otra** (`gcloud auth login`, la del CLI). Los
  scripts `.mjs` usan ADC y funcionan. **Comprobarlo corriendo el script en seco**, no
  deduciéndolo de otro comando.

## LAS LECCIONES DE MÉTODO

**Las dos del despliegue de `PLAT-002` (25 ago), que nacieron de casi tragarse un falso final:**

- **Toda comprobación nueva necesita un CONTROL que se sepa bueno.** Las tres callables nuevas
  salen sin binding `roles/run.invoker` en el IAM de Cloud Run… **y `applyPayment` también**, que
  se sabe que funciona. Sin comparar contra una conocida se habrían reportado tres callables
  rotas. Por lo mismo, el instrumento del radio se corrió **antes contra staging**, cuyos 44 ya
  se conocían.
- **Un patrón de parada laxo es un falso verde.** Un vigía del bundle trataba «`curl` falló» como
  «cambió», y un `until` se disparó con la palabra «Error» dentro de `logClientError`. Los dos
  daban un final falso. Y el 25, el vigía del rollout paró en un rollout **del 11 de junio** por
  no paginar: **la condición de parada tiene que mirar el objeto correcto, no solo un estado
  terminal.**

**Las cinco del triaje del 24 (tarde), que son las más caras de olvidar:**

1. **El punto ciego suele estar escrito en el propio banco de pruebas.** Tres veces en un día: el
   test de «con la bandera apagada no cambia un solo número» usaba la forma que **no puede fallar**;
   «ni el consejo, ni la portería» existía solo para `bankAccountBalances` y nadie hizo la misma
   pregunta sobre la cuenta; y las pruebas de `aplicarAjustes` solo ajustaban cargos que la
   propuesta ya incluía. **Al revisar una guarda, buscar la forma que las pruebas NO ejercitan.**
2. **Probar una regla contra el emulador encuentra lo que leerla no ve, y EN LAS DOS DIRECCIONES.**
   Comprobando que el veto de `sourceType` dejaba pisar un asiento apareció el problema contrario y
   más caro: la conciliación no podía casar ni un pago. **`updateDoc` es merge y la regla ve el
   documento resultante; `setDoc` no lo es.**
3. **El dinero con centavos hay que MEDIRLO, no razonarlo.** Seis muestras a mano no encontraron
   nada; barrer 20.000 combinaciones convirtió dos sospechas en porcentajes (3,0 % y 2,1 %).
4. **Un espejo que se queda atrás no duele hasta que alguien lee el documento.** R12 se aplicó en
   `src/` y no llegó a `functions/`; **R16 repitió la historia exacta un día después.** Al aplicar
   una regla de negocio, buscar su espejo **en la misma pasada** y dejarla vigilada.
5. **Descartar también es un resultado, y se anota.** El polvo del sobrante ya estaba muerto: lo
   mató `aMoneda` sin que nadie lo buscara.

**Siguen vigentes las del 23 y las tres de la sesión A.** La B añadió cinco:

1. **Un error puede ocurrir DESPUÉS de que la escritura cuaje.** Los dos primeros defectos de la
   sesión son el mismo animal: la operación de dinero se confirma y algo posterior falla —una
   auditoría, una traducción de mensaje—, así que la pantalla miente en la dirección más cara. **Al
   revisar un camino de dinero, mirar qué corre después del `commit`, no solo dentro.**
2. **Un guardián que solo se activa cuando NO hay defecto es peor que ninguno.** El de R1 comparaba
   una variable consigo misma: no medía nada y costaba cobros. Al escribir una comprobación,
   preguntarse **qué la haría fallar de verdad** — si no hay respuesta, no es una comprobación.
3. **El dinero entero esconde los defectos del dinero con centavos.** COP tiene cero decimales, así
   que la coma flotante no pierde nada y **todas las pruebas de sobrepago usaban enteros**. Una
   prueba de dinero sin céntimos no prueba el dinero.
4. **Una prueba de reglas que pide documento a documento no prueba la pantalla.** Firestore evalúa
   la consulta contra la regla **sin ejecutarla**.
5. **La falsación encuentra pruebas flojas, no solo código roto.** Dos veces en esta sesión: un
   guardián de texto que leía la lista de campos en vez del código, y una prueba que pasaba con el
   redondeo quitado porque su caso concreto daba limpio. **Si romper el código no la pone roja, no
   vigila lo que dice vigilar.**

---

# Historial — jornada del 23 de agosto

Lo de aquí abajo es **cómo se llegó al estado de arriba**, no estado vigente.

### La tarde — cómo se encontró lo del informe, y qué enseñó el método

**El orden que lo destapó.** La sesión iba a empezar `FLOW-002`. Se decidió mirar antes la
pantalla de la entrega 2 —que estaba en producción sin que nadie la hubiera visto— **no por
higiene, sino porque `FLOW-002` tiene que enseñar el anticipo en esa misma superficie**: si
estaba rota, se habría construido encima sin saberlo.

**Cinco correcciones de rumbo, todas por medir:**

1. Se dijo que el defecto era «el libro no carga». **Eran cuatro consultas**, no una: también
   visitantes, PQRS y acuerdos.
2. Se dijo que «los índices del repositorio nunca se desplegaron». **Falso**: estaban
   desplegados, pero **solo en `ASCENDING`** y el código pide `desc`. Lo desmintió leer los
   índices reales de los dos ambientes, no el JSON.
3. Se dio por hecho que la cuenta seguía renombrada y se dedujo que **CA6 estaba roto**. David
   la había restaurado. CA6 se probó después, entrando al navegador, y **pasa**.
4. La espera a que los índices se construyeran se hizo con una condición que **no medía lo que
   creía**: `firestore:indexes` los lista aunque estén en `CREATING`. Lo delató que el error
   siguiera saliendo.
5. Se dijo que el doble conteo del job era «un bloqueador de encender la bandera». **Ya estaba
   ocurriendo**: los asientos sembrados llevan su categoría real sin pasar por `aplicarPago`.

**Lo que el navegador cambió.** Con la sesión de David abierta en Chrome se validó todo de
punta a punta: el defecto, CA6, el antes y el después de los cinco arreglos. La consola dio la
prueba dura —el mensaje pasó de «You can create it here» a «That index is currently building»—,
que es lo que convirtió la hipótesis en causa.

**Y la medición se hizo como toca:** aplicando la regla vieja y la nueva **sobre los mismos
asientos** y contando cuántos caen de lado distinto, no comparando antes/después. Las Playas:
−1.500 y 3 asientos en staging, −1.500 y 1 en producción. El script que ya existía medía contra
una regla **que no existe en ningún sitio** —se escribió antes de R13—, y se corrigió.

**Se verificó por procedencia, no por grep:** el despliegue de la function se comprobó con
`storageSource.generation`, que dio la hora exacta de subida.

### `PLAT-003` 1b — las tres entregas, y por qué fueron tres

**1b-i (`1635ac2`) — la exclusión del libro mira el ORIGEN.** Regla R12. Sin bandera. Se pudo
desplegar sola porque con la bandera apagada todo asiento de cobro es `billingStatement` **y**
`alicuota` a la vez. **La regla de orden no es «las dos juntas»: es la exclusión primero, o a
la vez, nunca después.**

**1b-ii (`9f53a80` + `ee310d6`) — el concepto del cargo llega al libro.** El defecto grande de
la PRD. `aplicarPago` escribía `category: "alicuota"` FIJO sin mirar el `concept` del cargo,
que llevaba existiendo desde siempre en el mismo documento que ya leía. Ahora escribe
`accountCode`, la categoría equivalente y la descripción, **las tres coherentes o ninguna**.
Más R7 (el reverso copia la cuenta del original) y R13 (el reverso arrastra el origen).

**1b-iii (`6939308`) — el recaudo se reparte por concepto.** Salió al ir a validar la 1b-ii:
**escribir la cuenta era necesario y NO era suficiente.** Los asientos de cobro están excluidos
a propósito, así que la cuenta recién escrita **no la mostraba nadie**. El reparto sale de
Cartera —la fuente completa— y por construcción la suma no cambia.

### Validación a mano en staging — HECHA, y con números

David cobró la multa de 500 de `T2-203` y luego la revirtió. Comprobado en el Excel **y**
releyendo Firestore:

| Momento | Estado financiero | En la base |
|---|---|---|
| Antes | 126.000 + 1.500 = **127.500**, dos líneas | — |
| Tras cobrar | + **Multas 500** = **128.000**, tres líneas | asiento con `accountCode: "1.3"`, `category: "multa"`, concepto «Pago de multa 2026-06 — T2-203» |
| Tras revertir | vuelve a **127.500** | reverso con `reversedSourceType: "billingStatement"`, misma cuenta, −500; cargo a `overdue`; recibo `anulado: true` |

**El 127.500 del final es la prueba de R13.** Sin el origen arrastrado habrían sido 127.000:
el reverso habría restado dos veces. Y el 128.000 del medio prueba que el doble conteo está
muerto — si viviera, el total habría subido 1.000 y no 500.

### Lo que NO está hecho, dicho para que no se lea como hecho

| Qué | Por qué importa |
|---|---|
| ~~`accountCode` en `BillingStatement` y `Expense`~~ | **HECHO el 23 ago (paso 1 de la entrega 2), en staging.** Ver la sección siguiente |
| El aviso de **R8** en pantalla | Cuando un concepto cae en `otros_ingresos`, el dato ya viaja en la respuesta del callable — `cayoEnOtrosIngresos`—, pero **ni siquiera está declarado** en el tipo de respuesta de `applyPaymentCallable` (`src/lib/firebase/callables.ts`). Nadie lo enseña |
| **R9 no está implementada en NINGÚN sitio** | Descubierto el 23 ago al ordenar la entrega 2, y no estaba en esta lista. `buildFinancialStatement` agrupa **solo por `category`** y nunca mira `accountCode`; las etiquetas salen de `CATEGORY_LABELS`, un mapa cableado en `financial-statement.ts` que es **uno de los dos que la PRD quería matar** (§2). Mientras siga así, **CA6 es imposible**: renombrar una cuenta no cambia nada en pantalla |
| **El estado financiero solo existe como Excel** | `incomeByCategory` alimenta **dos** consumidores, no uno: la exportación XLSX de `/admin/finanzas` **y** el informe de comité. Pero el informe se queda con los totales y `expenseByCategory` y **tira `incomeByCategory`** (`use-committee-report.ts:530`). O sea: **el gemelo que lo hace bien ya existe** —los egresos por categoría ya se pintan en tabla y torta en `/admin/reports`— y a los ingresos solo les faltan las líneas que los lleven hasta ahí. **No hace falta una pantalla nueva** |
| Ningún conjunto EXISTENTE tiene plan sembrado | La semilla corre al crear. Encender `producto-plan-de-cuentas` en un conjunto viejo enseñaría un plan vacío |

### `PLAT-003` entrega 2 — el orden, y el paso 1 ya en staging

**El orden lo decide una dependencia, no el gusto.** Todo lo que pueda mover la semilla va
ANTES de sembrar, porque sembrar la congela:

| # | Paso | Estado |
|---|---|---|
| **1** | `accountCode` en `BillingStatement` y `Expense` | **HECHO** — `8018a3b` + `d427698`, en staging |
| **2** | El formulario del plan de cuentas (`producto-plan-de-cuentas`) | **VALIDADO A MANO en staging, las 6 comprobaciones.** `06edf29` + el arreglo de reglas `0bbf6cf` |
| **3** | Las pantallas: aviso de R8, **R9**, etiquetas desde el nombre de la cuenta, ingresos por cuenta en el informe de comité | **CONSTRUIDO** — `437a52c` + `3b1a643`, en staging. **Sin mirar** |
| **4** | Sembrar en los conjuntos existentes | **DESCARTADO en producción** — ver abajo: 0 planes y 9 conjuntos de prueba, medido. En staging ya está |

**Paso 1, qué entró** (`8018a3b`): los tipos ya declaraban `accountCode` desde 1b; **lo que no
existía era nadie que lo escribiera**. Ahora se estampa al generar el cargo y al registrar el
egreso.

**Los cargos se crean en CUATRO sitios, no en uno** —el alta manual del front, la campaña
programada de `index.ts`, el reparto por coeficiente y la semilla del trial—. Contarlos antes
de escribir es la lección de los tres sitios de la exclusión y las cuatro copias del catálogo
de banderas. **Va sin bandera a propósito:** nadie lee `accountCode` todavía (R9 no existe),
así que es inerte; ponerlo tras `producto-concepto-al-libro` solo abriría un hueco de cargos
sin código que habría que rellenar después.

**El resolvedor de egresos NO es la simétrica del de ingresos, y no se pueden fusionar.**
`administracion` vale `1.1` como concepto de cargo —la cuota, un ingreso— y `2.5` como
categoría de egreso. Es la trampa de R11 mirando al otro lado, y tiene prueba propia.

**Un defecto que salió al construir** (`d427698`): `trial-seed.ts` escribía
`category: "servicios"` y `category: "seguridad"` en `expenses` **y** en `ledgerEntries`.
Ninguna de las dos es un valor de `ExpenseCategory`; compilaba porque el `set()` de la semilla
no está tipado. **No era latente: se veía** — el estado financiero de todo conjunto de trial
mostraba «servicios» y «seguridad» en crudo y minúscula, dos de sus cuatro partidas. Arreglado,
y con guardián nuevo (`functions/tests/trial-seed-categorias.test.ts`) que lee el fichero como
texto, porque el typecheck no puede cazarlo.

**LA CUENTA DE VIGILANCIA YA ESTÁ DECIDIDA Y CONSTRUIDA — este párrafo decía lo contrario hasta
el 25 de agosto de 2026.** David la decidió el **23 de agosto**, y el código lo lleva desde
entonces; el documento se quedó atrás y presentaba como bloqueo algo que ya no lo era. Lo
encontró encender la bandera 2: el formulario de egresos ofrecía «Vigilancia y seguridad» como
categoría, que según este párrafo no debía existir.

Lo que hay hoy, medido sobre el código y no sobre el documento:

| Qué decía | Qué hay |
|---|---|
| «el plan estándar no tiene cuenta de vigilancia» | **Dos**: `1.9 Cuotas de vigilancia` (ingreso, `systemKey: cuota_vigilancia`) y `2.9 Vigilancia y seguridad` (egreso, `systemKey: vigilancia`) |
| «obliga a tocar `ExpenseCategory`» | Ya está tocado — la clave existe, fechada el 23 de agosto |
| «CA1: 16 cuentas con `systemKey`, 18 documentos» | **19 con `systemKey`, 21 cuentas** |

**Las dos claves son distintas a propósito y no se pueden fusionar:** el CARGO de vigilancia es
un **ingreso** (`cuota_vigilancia`, la 1.9) y el GASTO es la 2.9. Es la misma trampa de
`administracion`, mirando al otro lado.

> **La lección, que vale más que el arreglo:** el documento no envejeció por descuido, envejeció
> porque **la decisión se tomó en el código y nadie volvió aquí**. Es el mismo patrón que ya
> mordió con «Vivaru no tiene política de retención» mientras tres ventanas de 12 meses corrían
> cada noche. **Antes de tratar algo como bloqueo, mirar el código.**

**Paso 2, qué entró** (`06edf29`): diálogo «Plan de cuentas» dentro de Finanzas › Libro y
fondos, detrás de `producto-plan-de-cuentas`. Se copió el patrón del **registro de
proveedores**, que es el gemelo exacto —CRUD con bandera dentro de Finanzas—; la barra lateral
**no sabe de banderas**, así que una ruta propia habría enseñado el enlace a todo el mundo.

**Tres acciones y ninguna más: añadir, renombrar, desactivar**, que son las tres del flujo de
§5.1. **No hay borrado, y no es una omisión:** R5 dice que una cuenta con movimientos se
desactiva, y las reglas **no pueden comprobar** si los tiene —exige consultar `ledgerEntries`—.
Sin botón de borrar, CF3 y CF4 son inalcanzables desde la interfaz.

**Lo que casi se cuela, y es lo más importante de este paso:** crear una cuenta con `setDoc`
**no falla si el código ya existe: sobrescribe**, porque el id es derivado del código. Y la
regla de `update` lo dejaría pasar —el `code` coincide consigo mismo—, así que «crear la 1.3»
le habría cambiado el nombre a la cuenta de multas y podría haberla dejado **sin `systemKey`**,
que es justo lo que R3 protege. Va en **transacción**: lee y se niega si ya está.

**El padre se deduce del código, no se elige.** La jerarquía vive en el propio código (D1,
opción A); un selector de cuenta padre dejaría colgar la `1.3` de la `2`.

### `conjunto-las-playas` ya tiene plan y bandera — listo para mirar

**El punto de partida era cero:** `chartOfAccounts` de `vivaru-staging-02` tenía **0
documentos** en todo el proyecto. La semilla corre al crear el conjunto y **los ocho conjuntos
de staging son anteriores** a esa capacidad, así que el diálogo abría vacío y no había nada que
validar.

**Sembrado el 23 de agosto en `conjunto-las-playas`, y verificado leyendo la base:**

| Comprobación | Resultado |
|---|---|
| Documentos | **18** |
| Con `systemKey` | **16** ← es CA1, medido sobre la base y no sobre el documento |
| Ids derivados (`{tenantId}_{code}`) | **todos correctos** — de esto depende que el formulario pueda escribir; un id mal formado da `permission-denied`, que se lee como «no tienes permiso» |
| Las dos cuentas padre | sin `systemKey`, que es lo correcto: son estructura |
| `producto-plan-de-cuentas` | **ENCENDIDA** solo en este conjunto, y `producto-concepto-al-libro` sigue encendida |

**Y el plan cuadra con los datos que ya había.** Los dos únicos asientos con `accountCode` del
conjunto son los de la validación a mano de la 1b: `1.3 · multa · +500` y su reverso `−500`,
«Pago de multa 2026-06 — T2-203». La cuenta `1.3` existe ahora como «Multas» con
`systemKey: multa` — la cuenta y la categoría coherentes, en datos reales y no en una prueba.

**Un matiz que corrige lo escrito más arriba:** sembrar **no** bloquea añadir la cuenta de
vigilancia después. La siembra lee primero y solo escribe lo que falta, así que una cuenta
nueva entra al volver a correrla. Lo que congela son **los renombres y los renúmeros**. Por eso
sembrar staging para poder mirar la pantalla es barato, y sembrar producción antes de cerrar la
semilla sigue sin serlo.

**Herramientas nuevas** (`cc284d2`), las dos con el projectId obligatorio porque el activo de
gcloud es `hogaru-1`, que es producción:

- `functions/scripts/sembrar-plan-de-cuentas.mjs` — **importa la semilla compilada de
  `functions/lib/`**, así que corre el mismo código que el alta. Simula por defecto; hay que
  pedirle `--escribir`.
- `functions/scripts/mover-bandera-de-conjunto.mjs` — la override POR CONJUNTO.
  `mover-bandera.mjs` no servía: escribe el valor **global**, que en staging afecta a los ocho.
  La override del 22 de agosto la había escrito un script suelto sin commitear (`override-cli`).

**Al invocarlos, ruta absoluta.** El repositorio es `~/Vivaru_Rep/vivaru/`, no `~/Vivaru_Rep/`,
y una ruta relativa falla con `MODULE_NOT_FOUND` — que no se parece en nada a lo que es.

### Validado a mano en staging — las seis, y un defecto que solo salió mirando

David lo miró el 23 de agosto. **Las seis comprobaciones en verde:**

| Qué | Resultado |
|---|---|
| El árbol | 18 cuentas ordenadas, hijas indentadas, marca «estándar» en las 16 de sistema |
| Renombrar «Multas» → «Multas multiples» | Nombre cambiado, **código `1.3` intacto** y su caja deshabilitada (R3 + R4) |
| Desactivar la `1.3` | Queda `Inactiva` y sigue en la lista |
| Crear la `1.9` como ingreso | Anuncia «Colgará de 1 — Ingresos» y la crea |
| Crear la `2.9` **como ingreso** | Rechazada: «La cuenta 2 es de egresos, así que la 2.9 no puede ser de ingresos» |
| Desactivar «Ingresos» | «Primero desactiva las cuentas 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, que cuelgan de esta» — y la `1.3` **no** aparece, porque ya estaba inactiva (CF6) |
| **Crear otra vez la `1.3`** | Rechazada nombrando el código, y **«Multas multiples» intacta** — ver abajo, porque la evidencia no es la obvia |

**El defecto que salió, y por qué vale más que el arreglo** (`0bbf6cf`): crear la `1.9` respondía
**«No tienes permiso para realizar esta acción»**.

No estaba en ninguna regla de escritura. El formulario crea en **transacción, y la transacción
lee primero**; sobre un documento que **no existe**, `resource` es `null`, así que
`resource.data.tenantId` hacía fallar la evaluación entera y el `get` se denegaba. El mensaje
que llega a la pantalla no se parece en nada a lo que pasa.

**El gemelo que lo hace bien estaba en el mismo fichero, dos veces:** `financialCounters`
(«para que la transacción pueda inicializar el contador») y `survey_responses`, cuyo comentario
dice literalmente *transaction.get on missing doc*.

**Y el banco de reglas estaba VERDE mientras la pantalla estaba rota.** Las seis pruebas de
`chartOfAccounts` escriben con `setDoc`; el producto escribe con una transacción. **No faltaba
un caso: el banco probaba un camino que el producto no usa.** Tres pruebas nuevas, y el
diagnóstico probado por mutación — con la regla vieja fallan exactamente las dos nuevas y las
seis viejas siguen verdes.

**El código duplicado: la evidencia NO es que el nombre siguiera igual.** David escribió en el
formulario el mismo texto que la cuenta ya tenía —«Multas multiples»—, así que **una
sobrescritura habría sido indistinguible mirando el nombre**. Lo que prueba que no la hubo es lo
que el formulario **no** manda, releído de la base:

| Campo | Quedó | Qué probaría lo contrario |
|---|---|---|
| `systemKey` | `multa` | El formulario no lo envía: un `setDoc` lo habría **borrado**, y con él R3 |
| `status` | `inactive` | El formulario envía `active`: la habría reactivado |
| `createdBy` | **`sembrar-plan-de-cuentas-cli`** | Un `setDoc` lo habría puesto al uid de David. **El documento sigue teniendo al sembrador como creador** |
| Cuentas del conjunto | 19 | No nació ningún documento |

**Y lo que esta prueba NO demuestra, dicho para que no se lea de más:** el rechazo lo dio la
validación del **cliente** (`validarCuentaNueva`), no la transacción — `handleSave` valida antes
de escribir, así que la transacción ni llegó a correr. Las dos capas emiten **la misma frase**,
así que el aviso en pantalla no distingue cuál saltó.

La transacción es la guarda de la **carrera** —dos pestañas creando el mismo código a la vez—, y
esa rama sigue **sin ejercitarse**: la prueba de reglas con transacción cubre el camino feliz.
Cerrarla pide una prueba con emulador que lea un documento existente dentro de la transacción.
**Anotado y no hecho.**

**Estado de `conjunto-las-playas` tras la prueba**, para que no se lea como un descuadre: **19
cuentas**, la `1.3` se llama «Multas multiples» y está inactiva, y existe una `1.9` «Cuota de
vigilancia» creada a mano. Es residuo de validación, no datos rotos.

### La vigilancia — D3 CERRADA, las dos aceptadas (`0148bee`)

Eran **dos** decisiones y no una, y se vio porque David, al probar el formulario, creó a mano
una cuenta y la llamó «Cuota de vigilancia» — como **ingreso**.

| Lado | Qué quedó |
|---|---|
| **Ingreso** — la cuota que se cobra al residente | `1.9 Cuotas de vigilancia`, **con `BillingConcept` propio**. La cuenta sola no servía: sin concepto habría que cobrar como `otro`, que resuelve a «Otros ingresos», y la cuenta nueva se quedaría vacía para siempre |
| **Egreso** — lo que se le paga a la empresa | `2.9 Vigilancia y seguridad`. Salía de «Proveedores», donde la mayor partida del presupuesto quedaba con los insumos de limpieza |

**Lo que casi fabrica el defecto que R11 previene:** las dos **NO** comparten `systemKey` —el
ingreso lleva `cuota_vigilancia` y el egreso `vigilancia`—. `LedgerCategory` incluye a
`ExpenseCategory`, así que una sola clave haría que `cuentaPorSystemKey` devolviera una u otra
**según el orden del array**. Prueba nueva que exige que ninguna clave se repita.

**Van detrás de «Otros» (1.9 y 2.9) y leído en orden queda raro.** Renumerar `otros_ingresos`
saldría gratis hoy —producción no tiene ni un plan sembrado—, y **no se hace**: R3 dice que una
cuenta de sistema no se renumera y el código ES la identidad. El precio de no renumerar nunca es
que «Otros» deje de ir al final.

**CA1 se movió con ellas: 18 cuentas con `systemKey` y 20 documentos** (antes 16 y 18).
Actualizado en la PRD, en los comentarios de la semilla, en el script y en los seis conteos.

**Catorce sitios**, contados antes de escribir. El typecheck encontró tres que el inventario no
—el esquema de zod y dos mapas de etiquetas—, y por eso se tocó el tipo primero.

### Un hueco NUEVO que abrió esta decisión, y que no es de staging

**La semilla puede reclamar un código que un conjunto ya usó a mano, y lo salta en silencio.**
Pasó el mismo día: la `1.9` de `conjunto-las-playas` la había creado David probando el
formulario —«Cuota de vigilancia», sin `systemKey`—, y horas después la vigilancia entró en la
semilla justo en esa `1.9`. El sembrador **no pisa nada**, que protege los renombres, pero
**acepta callando una colisión de significado**.

**En producción es peor de lo que parece:** el consolidado entre conjuntos de `PRD-V-PLAT-002`
Fase 3 agrupa **por código**, así que dos conjuntos con el mismo número significando cosas
distintas dan una cifra falsa — que es exactamente el defecto que esta PRD existe para impedir.

**CERRADO — D4, rango reservado (`ad23fc3`).** No se eligió «detectarlo mejor»: se eligió que
**no pueda ocurrir**. La semilla vive en `N.1`–`N.49` y el administrador crea de `N.50` en
adelante, así que la semilla puede crecer para siempre sin pisar a nadie. Misma decisión que el
id derivado: **que lo garantice la construcción, no un chequeo que alguien puede olvidar.**

Cuatro cosas de esa implementación que no son obvias:

1. **La comprobación NO va en `validarCodigoDeCuenta`.** Aquella dice si el código está bien
   FORMADO, y las veinte cuentas de la semilla lo están. Mezclarlas haría que la propia semilla
   no pasara su validador.
2. **Va también en la regla**, porque la siembra escribe con el SDK de admin y no pasa por las
   reglas. Desplegada y **verificada leyendo el ruleset vivo**, no el «Deploy complete».
3. **Solo en `create`.** En `update` habría dejado al administrador **sin poder renombrar
   ninguna** de las veinte cuentas — R3 y CA6 dependen de eso, y el síntoma habría sido «no
   tienes permiso» al cambiar un nombre. Hay prueba que lo fija.
4. **El primer nivel no se crea:** el libro tiene dos lados y una tercera raíz no sería ni una
   cosa ni otra.

**Y el contrato tiene dos direcciones, las dos vigiladas:** una prueba impide que el
administrador entre en el rango de la semilla, y otra impide que **la semilla se salga del
suyo**. La segunda es la que se rompería callando.

**Cuatro pruebas de reglas anteriores usaban `1.9` y `1.7` y se movieron al rango libre.** No es
cosmético: el rango las habría rechazado y **habrían pasado por el motivo equivocado**, creyendo
probar la unicidad del id. Un verde por la razón que no es vale menos que un rojo.

**Lo que esto NO resuelve, y queda escrito para `PRD-V-PLAT-002` Fase 3:** el consolidado entre
conjuntos debe agrupar por **`systemKey`**, nunca por código. El código es la identidad DENTRO
de un conjunto; el `systemKey`, ENTRE conjuntos.

### Lo que se decidió NO hacer, y por qué (medido)

**El paso 4 en producción — sembrar los nueve conjuntos que ya existen — no se hace.** Medido el
23 de agosto leyendo `hogaru-1`: **0 documentos en `chartOfAccounts` y 9 conjuntos**, y por sus
nombres son todos de prueba (`Tenant E2E Resident Password`, dos `expired`, uno `suspended`).
Todo conjunto nuevo nace sembrado desde la 1b, así que sembrar esos nueve es **trabajo sin
lector**, y encima congelaría sus renombres antes de que exista un cliente real que los
renombre. Si alguno pasa a ser real, se siembra ese: el script existe y es idempotente.

**El plan por país queda APARCADO a propósito.** El plan estándar es el mismo para México,
Colombia y Ecuador y no se ha mirado si el vocabulario contable difiere. Con cero clientes
reales la decisión se toma mejor cuando llegue el primero de cada país y su contador diga cómo
llama a las cosas. Existe `src/lib/config/vocabulario-pais.ts` para cuando toque.

### `PLAT-003` paso 3 — R9 y las dos pantallas

**Lo que entró** (`437a52c` y `3b1a643`), todo en staging con `rollout-2026-08-23-012` en
`SUCCEEDED`. **No toca functions.**

**R9, y la decisión que la regla no resuelve.** «Agrupa por `accountCode`; si no lo tiene, usa
`category`», leído al pie de la letra, **parte en dos filas lo que es una sola cuenta**: el
asiento viejo cae en `mantenimiento` y el nuevo en `2.3`, con el mismo nombre y sumando por
separado. No se arregla migrando —§4 dice que los históricos no se recalculan—, así que la
categoría se **normaliza** a su código por `systemKey`. CA8 se sigue cumpliendo y además el
asiento viejo aparece **donde le toca**.

**Encender esto no mueve un solo texto, y no por suerte:** un conjunto sin plan cae en el mapa
de respaldo como siempre, y un plan recién sembrado trae **los mismos nombres** —se eligieron
así a propósito—. Lo único que cambia es el **orden**, que pasa a ser el del plan. Los
subtotales por cuenta padre **no** entran; son otra cosa.

**Y `CATEGORY_LABELS` deja de mandar**, que es lo que hacía **imposible CA6**: renombrar una
cuenta ya cambia la etiqueta del estado financiero.

**Los ingresos por cuenta ya se ven.** El informe de comité los calculaba y los **tiraba** al
armar sus métricas (`use-committee-report.ts`), así que el reparto por concepto de la 1b-iii no
lo enseñaba nadie: solo salía en el Excel. Ahora van con su tabla y su torta, al lado de los
egresos —que eran el gemelo que ya lo hacía bien, en la misma pantalla—.

**El bloque entra en `WidgetErrorBoundary`.** CLAUDE.md lo exige para toda sección con charts de
recharts y la torta de egresos llevaba ahí **sin envolver**: sin eso, un fallo del widget tumba
TODO `/admin` con «No pudimos cargar el workspace».

**El aviso de R8 ya llega a la pantalla.** El servidor lo devolvía desde la 1b-ii y **ni siquiera
estaba declarado** en el tipo de la respuesta; y una de las dos vías de cobro —aprobar
comprobante— devolvía `void`, así que no tenía por dónde salir. Va como **aviso y después del
éxito**, no como error: el cobro se aplicó y el dinero no se perdió.

**Y hay que decir que hoy es casi inalcanzable**, para que nadie lo lea de más: los siete
conceptos conocidos resuelven a su cuenta propia, así que solo salta con un concepto que alguien
añada mañana o meta por importación. Es para lo que R8 existe, no una red por si el mapa está
mal.

**Lo que cazó `exhaustive-deps` y ninguna prueba veía:** faltaba `planInformes` en las
dependencias del memo del informe, así que **renombrar una cuenta no refrescaba la pantalla** —
CA6 verde en la prueba y rota en el producto. Es el mismo patrón que este documento repite:
lo que se mira no es lo que se prueba.

### El defecto del paso 3 que solo aparecía en producción (`607a12e`)

**Salió al preparar el despliegue a producción, no al escribir el código.** El paso 3 hacía que
el código mandara **siempre que existiera**. Sin plan sembrado —**la condición de producción**, y
la de siete de los ocho conjuntos de staging— un egreso viejo caía en `mantenimiento` y uno
nuevo, que ya lleva `accountCode` desde el paso 1, en `2.3`: **dos filas con la misma etiqueta
«Mantenimiento»**. El defecto que R9 se diseñó para evitar, por la puerta de atrás.

La regla correcta es más estrecha: **el código manda solo si el plan sabe nombrarlo.** Un código
que nadie puede nombrar no es un cajón, es un número.

**Por qué se escapó, que importa más que el arreglo:** la prueba de «sin plan» existía y estaba
verde, pero tenía **un solo asiento**. Un defecto de AGRUPACIÓN no se ve con un caso.

### Verificado contra los datos REALES de staging (23 ago)

No es lo mismo que mirar la pantalla —eso sigue pendiente—, pero es el motor real corriendo
sobre los 55 asientos y los 50 cargos de `conjunto-las-playas`:

| Escenario | Ingresos | Total |
|---|---|---|
| Todo apagado (como producción hoy) | una línea, «Cuotas de administración» | **127.500** |
| Solo `concepto-al-libro` | 126.000 cuota + 1.500 extraordinaria | **127.500** |
| Bandera + plan (como está staging) | `1.1` 126.000 + `1.2` 1.500 | **127.500** |

**El total no se mueve en ninguno de los tres: es CA11 sobre datos reales**, y coincide con el
127.500 que David midió a mano validando la 1b. Con plan, los egresos pasan a salir en orden de
plan —`2.1, 2.2, 2.3, 2.4, 2.6`— en vez de por monto. Las multas no aparecen porque sus dos
asientos netean a cero, como debía ser.

**Y el defecto de arriba, probado sobre esos mismos datos:** ningún egreso de staging lleva
`accountCode` todavía, así que se añadió uno como los que escribirá el paso 1 a partir de ahora.
Con el arreglo da **una** fila «Mantenimiento» de 11.000 (9.800 + 1.200). Sin él habrían sido dos.

**Lo que esto NO verifica, dicho para que no se lea de más:** que los componentes lo pinten, que
la torta aparezca, que el Excel lo escriba y que el aviso de R8 salga. Eso solo se sabe mirando.

### Limpieza de staging — HECHA

| Qué | Estado |
|---|---|
| La `1.9` hecha a mano | Borrada y resembrada: ahora es `Cuotas de vigilancia` con `systemKey`, creada por el sembrador |
| La `2.9` | Sembrada |
| El plan | **20 cuentas, 18 con `systemKey`**, releído de la base |
| La `1.3` | Devuelta a «Multas» y activa. Los 11 campos del documento idénticos antes y después: el `updateMask` no arrastró nada |

**PENDIENTE: mirar la pantalla.** En staging, `conjunto-las-playas`:

| Dónde | Qué |
|---|---|
| Finanzas › Estado financiero (Excel) | Las líneas en orden de plan, y los egresos como `2.1, 2.2, 2.3, 2.4, 2.6` |
| Informes › Resumen financiero | Tabla y torta de **Ingresos por cuenta**, al lado de los egresos |
| Finanzas › Plan de cuentas | Renombrar una cuenta y ver que el nombre cambia **en el estado financiero** — es CA6, y es lo único que ninguna prueba puede contestar |

**Dos cosas de método de esta pasada:**

1. **La lista de rollouts de App Hosting está PAGINADA y NO ordenada.** Leer la primera página
   —100 de 325— y ordenarla da como «más reciente» algo de ayer, y de ahí se concluye «no
   desplegó solo» y se fuerza un rollout que sobraba. **Hay que recorrer `nextPageToken` hasta
   el final.** Con el método correcto: el 23 App Hosting **sí** desplegó solo, dos veces
   (`rollout-2026-08-23-001` y `-002`, a las 02:25 y 02:32 UTC, que corresponden exactamente a
   los dos pushes). Eso **no desmiente** lo del 22 —aquel día de verdad no salió—; lo que
   corrige es **cómo se mira**.
2. **`publishScheduledCharges` falló el deploy y NO estaba roto.** El error fue
   «Failed to get the IAM Policy… / Unable to set the invoker». Leído en vez de supuesto:
   la función está `ACTIVE` con `updateTime` de la misma tanda, su servicio conserva el binding
   `roles/run.invoker` para la cuenta de cómputo, y el job de Cloud Scheduler sigue `ENABLED`
   con su `0 8 * * *`. **Lo que falló fue leer el IAM, no escribirlo.** Es justo la función que
   lleva el cambio de cargos, así que darla por caída habría parado el paso entero.

**Por qué NO se sembró el plan en los conjuntos que ya existen, aunque se pudo:** la siembra no
pisa lo que existe —correcto, para no borrar renombres—, y eso significa que **sembrar ahora
congela la semilla**. Si la entrega 2 corrige un código o un nombre, los ya sembrados se quedan
con el viejo y los nuevos nacen con el nuevo: divergencia silenciosa. **Se siembra cuando la
semilla esté cerrada**, con la entrega 2.

### Tres trampas de esta sesión que conviene no volver a pisar

1. **App Hosting no desplegó solo.** Tres commits se quedaron sin rollout casi una hora. Hubo
   que forzarlo: `firebase apphosting:rollouts:create vivaru-staging-web --git-commit <sha>`.
   **Un push verde no es un despliegue**: hay que mirar los rollouts.
2. **`firebase functions:list --project staging` falla con el alias** de `.firebaserc` y
   funciona con el project id completo. Se lee como que el despliegue falló.
3. **`gcloud` CLI y la ADC caducan por separado.** El CLI pidió reautenticación con la ADC
   viva; el `updateTime` se leyó por la API de Cloud Functions usando la ADC.

**Y una de método, que casi cuela:** al comprobar el bundle desplegado, ni el marcador nuevo ni
**el control** aparecieron. Sin el control se habría concluido «no llegó» por el motivo
equivocado — lo que fallaba era la medición (los chunks de finanzas están detrás de auth). La
verificación buena fue **la procedencia del build**, no el grep de cadenas.

### Un descuadre suelto, de otro frente

`conjunto-las-playas` está marcado `isExample` en producción y **no** en staging. Descuadra
cualquier volumetría que descuente lo sembrado. Anotado y **no corregido** a propósito.

### Barrido de documentación — pasadas 1 y 2 HECHAS, queda una

**Ojo al leer esta sección: estuvo mintiendo unas horas.** La tabla daba la wiki por pendiente
cuando ya se había hecho, en `2ffa894`, esa misma tarde. **El estado se escribió antes de hacer
el trabajo y no se volvió a tocar.** Es el mismo defecto que este repositorio ya tiene
catalogado en otro sitio —una fila que dice «Pendiente» y manda a buscar donde no está—.

**Pasada 1 (`1606a5a`):** `CLAUDE.md`, el encabezado de `albert-vivaru-integracion.md` —que
pasa a declararse **histórico**— y el bloqueo dominante de `roadmap-revops.md`. Era lo que
se lee en cada arranque, y sin eso la próxima sesión creía que Albert bloqueaba.

**Pasada 2 (`2ffa894`, y cerrada esa noche):** la wiki. Tres semanas de desfase cerradas con un
criterio explícito —**la wiki describe lo que corre en PRODUCCIÓN**, y lo que está en staging
entra marcado como tal—. Página nueva de Albert, `estado-modulos` partido en dos tablas
(producción / construido sin desplegar), tres trampas nuevas, y enlaces rotos de 13 a 8.
**Esa pasada dejó escrita una predicción sobre la exclusión del doble conteo, y unas horas
después se construyó 1b-i y la desmintió en dos puntos**, así que se cerró el círculo: la wiki
recoge ya que los sitios eran tres, que el defecto ya ocurría en datos sembrados, y R13.

**Pendiente:**

| # | Qué | Por qué no se hizo |
|---|---|---|
| **3** | **Notion.** El repositorio es la fuente de verdad y Notion la vista publicada; la vista está atrasada | **Desbloqueado el 22 ago por la noche:** David pasó los dos enlaces que sí hacen falta y **están verificados y documentados en `CLAUDE.md`** (roadmap `3bf1acebfa098051b602e4c6c60b3c90` y bitácora `0bdb213a53274fe2bcc7bd9b4fa1510a`). Lo que queda es escribir: el cuerpo del roadmap y **una fila nueva en la bitácora para 1b-i** (`Frente: Propiedad horizontal`, `Estado: En staging`, `Bandera: Sin bandera`, `Commit: 1635ac2`) |

**Y una cosa que NO hay que volver a intentar:** el roadmap Albert–Vivaru **da 404 y seguirá
dándolo**. El conector está autenticado contra el workspace `David Carmona's Space`
(`david.macar.18@gmail.com`) y esa página vive en **otro workspace**. No es un permiso que se
pueda pedir sobre la página. **Si hace falta su contenido, lo pega David.** Comprobado
fetchando `self`, no deducido. Los identificadores y las cuatro vistas de la bitácora están en
`CLAUDE.md`, sección «Accesos de Notion».

**Menor, y de otro repo:** `vivaru-landing` tiene `imagenes langing/` sin trackear y su
último commit es de mayo. No es de este frente, pero que conste.

---

## El contexto de antes (19 ago 2026, madrugada del 20)

**`master` = `c81e2fe`: lo construido el 19 YA ESTÁ EN PRODUCCIÓN, validado y
comprobado.** El hueco de acceso del residente está cerrado en producción, y todo
conjunto creado desde ahora nace con su país y su moneda correctos.

David validó a mano en staging las dos cosas que ninguna prueba puede contestar: al
borrar al residente, la otra ventana lo echó al refrescar; y el conjunto creado con
México quedó en MXN. Con eso se subió.

**Y en la madrugada del 20 se desplegó además el retiro del SRI** (`dc3e061`): front en
producción, `onPaymentVoucherCreated` sin la rama fiscal, y **`retransmitVoucher` BORRADA**
de los dos ambientes —comprobado en `functions:list`, ya no existe—. La verificación del
bundle fue **al revés**: aquí había que probar una ausencia, así que el marcador viejo
debe faltar Y los controles vivos deben aparecer. Sin los controles, «no aparece» no
prueba nada: podría ser que la búsqueda no funcionara.

### Qué se desplegó y cómo se comprobó (no deducido — leído)

| Pieza | Estado en producción | Cómo se comprobó |
|---|---|---|
| `revokeResidentAccess` (nueva) | Viva, v2, `us-central1` | `functions:list`, y su permiso de invocación leído en IAM: `allUsers` + `run.invoker` |
| `createTenantWorkspace` (actualizada) | Viva, v2, `us-central1` | `functions:list` |
| Front (`c81e2fe`) | Servido | Chunks de `/login` descargados: marcador nuevo `revokeResidentAccess` presente, control viejo `deleteOperationalUser` presente, símbolo inventado ausente |

El orden fue el NORMAL —functions antes que front— porque las dos **conceden** permiso.
Se invierte solo cuando la regla restringe, como en `FIN-001`.

**La trampa de `run.invoker` no mordió, y no fue suerte:** `revokeResidentAccess` ya
nace declarando `invoker: "public"` en su definición. Quien la escribió se adelantó.

**El secreto de Resend sobrevivió a la fusión otra vez.** `apphosting.yaml` conserva
`secret: RESEND_API_KEY`, cero claves en claro. Comprobado antes de empujar.

**Puerta en verde antes de subir:** 349 pruebas de functions + 994 del front, los dos
typecheck limpios.

### Lo que NO arregló este despliegue

**Los conjuntos que ya existían siguen incompletos.** El arreglo actúa al crear, no
hacia atrás. Sigue pendiente la decisión de David sobre los 9 —corregirlos a mano,
borrarlos, o dejarlos sabiendo que están así—.

**Ojo al medirlo:** las credenciales de lectura de producción (`gcloud auth
application-default`) caducaron el 19 por la noche. Antes de leer Firestore de
producción hay que correr `gcloud auth application-default login`, o el script falla con
`invalid_rapt` y parece un error de código.

### El estado de producción, medido leyéndolo el 19 (no deducido)

9 conjuntos: **6 sin `currency` y 4 sin `country`**. `Privada Las Palmas` está en México
y la consola la lee en COP. Planes en uso: `plus`×5, `starter`, `premium`, `trial`×2.
La colección `plans` tiene **0 documentos**.

**El arreglo NO corrige los conjuntos que ya existen.** Son de prueba, así que hay tres
salidas y ninguna es obvia: corregirlos a mano, borrarlos, o dejarlos sabiendo que están
así. **Decisión de David, no técnica.**

### Vivaru Finance — `FIN-001` CERRADA Y EN PRODUCCIÓN (20 ago 2026)

**`master` = `d17478d`.** El criterio de salida de `FIN-001` decía «cumplido salvo el
voucher». Ya no: **el recibo se emite dentro de la transacción del pago y el reverso lo
anula**. Las dos cosas estaban bloqueadas por «eso es meterse en lo fiscal», que dejó de
ser cierto al salir lo fiscal del alcance.

**Validado a mano en staging por David, punta a punta:** emitir → PDF correcto →
revertir → recibo anulado en la lista y con `ANULADO` en el PDF. Y desplegado a
producción en el orden **front → functions → reglas**, con las reglas al final porque
`paymentVouchers` pasó a `create, update: if false` y eso **restringe**.

**Lo que salió por probar, y ninguna prueba lo habría cazado:**

1. **El administrador no tenía dónde ver los recibos.** Solo existían en el instante de
   emitirlos. El residente sí tenía su lista. Se construyó la tarjeta «Recibos emitidos»
   en Finanzas — y **no** en Cartera, cuya columna «Comprobante» significa otra cosa: el
   archivo que SUBE el residente.
2. **El pie del PDF anulado decía «Conserve este comprobante como soporte de su pago».**
   La marca de arriba avisaba y el pie la desmentía.
3. **Los recibos anteriores al cambio salían como `No. undefined`** y se descargaban como
   `recibo-undefined.pdf`: no tienen `code`, tienen `sequentialNumber`. Resuelto con
   `codigoDeRecibo`, que lee las dos formas. **No se migran los viejos a propósito:**
   cambiarle el número a un papel que alguien descargó es peor que soportar dos formas.

**La lección que las agrupa:** las tres salieron de **mirar la salida** —una pantalla, un
PDF— y no de una suite. Cuando se construye algo que alguien mira, alguien tiene que
mirarlo.

### Cabo suelto en producción — CERRADO el 21 de agosto de 2026

El recibo `000000001` (Apartamento 503, $1.120.000, `tenant-santa-maria`, doc
`zAcFYtEUx0AFyOdalIYQ`) **está anulado en producción**. Se escribieron los cuatro campos
acordados y **nada más**; el secuencial y el importe quedaron intactos, comprobado
releyendo de Firestore. Script: [`scripts/anular-recibo-000000001.mjs`](../scripts/anular-recibo-000000001.mjs),
idempotente — si se vuelve a correr, se niega.

**Antes de escribir se verificó el reverso leyéndolo, no fiándose del documento.** Era la
única forma de que esta escritura hiciera daño: un recibo anulado sin pago revertido
detrás es una mentira en un registro financiero. Lo leído:

| Qué | Estado |
|---|---|
| Operación de pago `e52cf94a…` | `reversedAt` = 21 ago 00:39 UTC, con su `reversalKey` |
| Operación inversa | Existe, `-1.120.000`, apuntando de vuelta con `reversesOperationKey` |
| Asientos del libro | `+1.120.000` y `Reverso: … −1.120.000`. **Netean a cero** |
| Cuota del 503 | De vuelta en `pending`, saldo íntegro de 1.120.000. Nadie quedó dado por pagado |
| `voucherId` en la operación de pago | **AUSENTE** — la causa, leída y no supuesta |

**La lección, que es la de siempre en este documento:** el reverso estaba bien, pero eso
se sabía por una frase escrita, no por un dato. Verificarlo costó dos minutos y era lo
único que separaba «corregir un registro» de «falsear uno».

**Falta mirarlo con los ojos** — la pantalla de Recibos emitidos y el PDF. La escritura
está comprobada en el dato; que la interfaz lo pinte tachado y el PDF salga con `ANULADO`
es otra cosa, y este documento ya enseñó tres veces que eso solo se sabe mirando.

**Y es la forma general del problema:** los registros anteriores a un cambio de forma no
se migran solos. Los asientos sin `operationKey` son el otro caso, y **sigue abierto** —
se confirmó de paso: de los 12 asientos de `tenant-santa-maria`, solo uno tiene
`operationKey`.

### Vivaru Finance — el contexto de antes (20 ago 2026, madrugada)

**Lo fiscal salió del alcance y el SRI se retiró del código.** Ver
[`docs/roadmap-finance.md`](roadmap-finance.md) §5. Nueve ficheros, 339 líneas fuera.
`retransmitVoucher` **borrada** de los dos ambientes; `onPaymentVoucherCreated`
redesplegada sin la rama del SRI.

**Precisión que costó una corrección:** el candado del RUC **no estaba bloqueando a
nadie**. Depende de `tenantSettings.fiscalProfile.country === "EC"`, y **en producción
solo un conjunto tiene perfil fiscal, de México**; en staging no lo tiene ninguno. Era
trampa latente —habría saltado al configurar el perfil de un conjunto ecuatoriano—, no
un incendio. **Leer el dato antes de calificar la gravedad.**

**Consecuencia de eso para validar:** el panel del SRI y el candado **nunca se vieron en
staging**, así que no hay clic que los pruebe. Lo que prueba que se fueron es que las
condiciones ya no existen ni en el código ni en el bundle servido, comprobado con la
prueba al revés: marcador viejo AUSENTE, control vivo PRESENTE, símbolo inventado
ausente.

### Lo siguiente en Finance NO es el expediente: es terminar `FIN-001`

**Su propio criterio de salida dice «Cumplido salvo el voucher».** Y hay dos cosas
abiertas que estaban bloqueadas **por la misma frase**, que hoy dejó de ser cierta:

1. **Un pago puede existir sin su recibo.** El servidor aplica el pago —cuota y asiento,
   transaccional— pero **el comprobante se sigue creando en el navegador**, después.
   `functions/src/payments.ts` no menciona «voucher» ni una vez. El comentario del código
   dice que cerrarlo *«exige emitir dentro de la transacción, que es meterse en lo
   fiscal»*. **Ya no lo es:** el comprobante es un recibo interno.
2. **Revertir no anula el recibo.** Mismo argumento en `payments.ts`: *«eso pide una nota
   de crédito, que es terreno fiscal»*. Hoy levanta `requiereNotaCredito` y la pantalla
   avisa, pero **el paso es manual y nadie lo persigue**. Una nota de crédito es un
   instrumento fiscal; sin factura, revertir anula el recibo interno y ya.

**Por qué va antes que el expediente de conciliación:**

- **Es el momento más barato que habrá**, y está medido: producción tiene **0
  comprobantes, 0 contadores y 0 operaciones de pago**. Migración: ninguna.
- **El expediente se construye ENCIMA de la aplicación de pagos.** Montarlo sobre un
  camino que aún deja recibos huérfanos es construir sobre arena — es la propia tesis del
  Documento Rector: *«automatizar un flujo fragmentado amplifica la inconsistencia»*.
- **Es pequeño:** mover la emisión a una transacción que ya existe y añadir la anulación
  al reverso que ya existe. El expediente es un módulo entero para una bandeja **vacía**.

**Decisión de David pendiente:** si el recibo interno debe conservar **numeración
correlativa** ahora que no es fiscal. Si sí, el hueco al fallar deja de importar pero la
serie se mantiene por orden; si no, se puede simplificar bastante.

## LA PRÓXIMA SESIÓN EMPIEZA POR OTRO SITIO — leer esto antes que la lista de abajo

**Hay un documento de arranque escrito para ti:
[`docs/arranque-exploracion-plataforma.md`](arranque-exploracion-plataforma.md). Ábrelo
antes de nada.** Lleva el contexto medido —qué es Vivaru hoy, sus 66 pantallas, sus cinco
roles, cómo entrar y con qué datos— para que no gastes el tiempo de David reconstruyéndolo.

**Lo que David va a pedir:** entrar a la plataforma —él concede el acceso—, navegarla
hasta tener granularidad, **decidir tú cuántas pasadas hacen falta**, y después construir
el esqueleto del sitio a partir de PRDs funcionales.

**Y hay una ambigüedad que se resuelve con él en los primeros minutos**, porque el 21 de
agosto abrió el track con una frase y lo concretó con otra:

1. **Documentar Vivaru tal como es hoy** en PRDs funcionales, y de ahí el esqueleto.
2. **Extraer los PRDs de una solución de referencia ajena** y filtrarla para sacar alcance
   nuevo, sobre todo **contable y financiero**.

La segunda frase apunta a la primera lectura; la primera hablaba claramente de extraer.
**Preguntar, no elegir.** El documento de arranque lo explica en su §0.

**Con qué enlaza:** cae encima del punto 5 de la lista de abajo —`F1` de Finance— y puede
contestarlo. Su pregunta abierta es si vale la pena la bandeja de conciliación con cero
pagos reales, y un alcance sacado de mirar el producto de verdad es el dato que falta.
Existen las skills `crear-prd-vivaru` y `crear-prd-ia-vivaru`.

---

## Con qué seguir, por orden (para la sesión siguiente)

**Lo de arriba está cerrado.** `FIN-001` en producción y validada; el SRI retirado; el
expediente de Albert al día. Esto es lo que queda, ordenado por lo que abre más con menos
esfuerzo.

1. ~~**Marcar anulado el recibo `000000001` de producción.**~~ **HECHO el 21 de agosto de
   2026**, y verificado releyendo. Lo único que queda es **mirarlo en pantalla**: que la
   tarjeta de Recibos emitidos lo pinte tachado y que el PDF salga con `ANULADO`. Detalle
   en la sección de arriba.
2. ~~**Mandarle a Albert dos cosas, por sitios distintos.**~~ **HECHO el 22 de agosto**, y
   con ello se ejecutó el alta A5 y salió A1. Ver arriba. El texto viejo: Sigue siendo lo más barato de la
   lista y **lo que más abre**: sin alta no hay usuario de servicio, y sin esa credencial
   no hay con qué suscribirse a sus deals — la segunda mitad de `REVOPS-001C`.
   - **El `tenant_admin`, por el canal** — nunca dentro de un documento. Decidido el 21:
     **`comercial@qintilab.com`, y es provisional a propósito** porque Vivaru no tiene hoy
     buzón propio y crearlo frenaría el envío. Se acepta que es un **buzón compartido** y
     que quien lo lea puede recuperar la cuenta y tocar el pipeline. Motivo y corrección
     en [`ESTADO-ALBERT.md`](prd/albert/ESTADO-ALBERT.md) §«Lo primero mañana».
   - **[`DECISIONES-A-002`](prd/albert/DECISIONES-A-002-vivaru-a-albert.md), ya redactado
     y sin mandar** — los dos números de retención con la frase del reloj, la propuesta de
     **un solo canal** (los documentos hablaban de dos y ninguno decía cuál era), y la
     reclamación de la fecha de A1, que Albert prometió el 19 «como lo primero que
     cerramos» y no ha llegado.
3. ~~**Escribir la política de retención — DOS números.**~~ **HECHO el 21 de agosto de
   2026.** Los dos son **12 meses**, la cifra de la casa: el deal sin actividad (Albert
   proponía 24) y el registro de auditoría del borrado, éste contado **desde la fecha del
   borrado**. Documento nuevo: [`docs/politica-retencion-datos.md`](politica-retencion-datos.md).
   **Lo que queda es mandárselos a Albert**, junto con la frase del reloj — va en el
   intercambio normal, no por canal aparte.
   **Y salió un hallazgo que este documento negaba:** decíamos que Vivaru no tenía
   política de retención. Escrita no la había, pero **números sí, y llevan tiempo
   corriendo**: tres ventanas de 12 meses en la tarea de las 03:00 —PII de comprobantes,
   `aiUsage` y `aiFeedback`—. Es la misma forma del error de los webhooks de Albert: una
   frase que fue cierta y que nadie volvió a contrastar contra el código.
4. **Decidir qué se hace con los 9 conjuntos incompletos**, y no son un grupo homogéneo:
   los siete marcados de ejemplo son inertes; **los dos sin marcar contaminan las
   métricas hoy**, y uno de ellos —el de Quito— muestra la moneda de otro país.
5. **`F1` de Finance: el expediente de conciliación.** Ahora sí no tiene nada delante ni
   debajo: `ReconciliationCase` no existe, y su único requisito era `FIN-001`. **Pregunta
   previa, que es de David:** ¿vale la pena construir la bandeja antes de que haya alguien
   conciliando? Hay cero pagos reales.
6. **Validar el formato de las referencias cruzadas — son DOS, y ya solo queda una.**
   `crmRef` **está validado** desde el 22 de agosto (`e59f8dc`, en staging): módulo
   `src/lib/albert/crm-ref.ts` con los dos formatos, conectado a las dos pantallas, 20
   pruebas. **Falta `externalRef.leadId`**, que sigue sin existir y va dentro del empuje
   de leads, no suelto.
7. **La comprobación que sostenga la invariante contacto→deal**, que Albert aceptó como
   palabra nuestra y hoy no vigila nadie. **Va DENTRO del empuje de leads, en el mismo
   commit** — hoy no creamos deals, así que construirla sola es un guardián sin puerta.
8. **`REVOPS-001B`** — evento de activación.

**Deuda conocida que NO urge pero deja de no urgir con el primer cliente:** los asientos
anteriores a `FIN-001` no se pueden revertir porque no guardan `operationKey`. Es la misma
familia que el recibo `000000001`.

**Dos cosas anotadas el 21 de agosto que no urgen hoy y no conviene perder:**

- **Cambiar el `tenant_admin` de Albert** a un buzón propio de Vivaru cuando exista. Hoy
  es `comercial@qintilab.com`, compartido, elegido a sabiendas. Cambiarlo después es
  barato —se le pide a un superadmin de Albert—; **el criterio no es el dominio, es quién
  puede leerlo**.
- **Comprobar que los buzones de `grupovivaru.com` reciben de verdad**, y es de otra
  gravedad: `privacidad@grupovivaru.com` es el canal que la política de privacidad
  publica **siete veces** para ejercer derechos y reportar incidentes, y `soporte@` lleva
  tiempos de respuesta comprometidos en los términos. Si rebotan, no es incomodidad: es
  incumplimiento de lo publicado. **No se puede comprobar desde el repositorio** — hay que
  abrir el correo, o mandarles una prueba desde fuera.

**La segunda mitad de `REVOPS-001C` NO está bloqueada por Albert, y este documento decía
que sí. Corregido el 20 de agosto de 2026.**

`RESPUESTA-A-001` ya lo cerró el 19, en su C1, con veredicto literal: **«SÍ, sin nada que
os lo impida. El trigger queda fuera del camino crítico.»** La regla que cita —
`match /deals/{docId} { allow read: if canReadTenant(tenantId); }`— concede lectura a
**todos** los roles del tenant, `sales` incluido, que es exactamente el rol del usuario de
servicio que nos dan en C2. **Vivaru puede suscribirse en vivo (`onSnapshot`) a
`tenants/vivaru/deals` y ver la conversión en tiempo real.** No hace falta webhook, ni
trigger, ni OIDC — Albert lo descarta explícitamente.

`RESPUESTA-A-002` no menciona la señal de vuelta (se buscaron *webhook*, *señal de
vuelta*, *activación*, *suscripción*, *disparador*: ninguna aparece), y **no hacía falta
que la mencionara**: ya estaba contestada en la ronda anterior.

**Lo que sí la bloquea es operativo y barato: el alta del tenant (A5).** Sin el tenant
`vivaru` dado de alta y sin el usuario de servicio creado, no hay credencial con la que
suscribirse. Y el alta espera **el correo del `tenant_admin`**, que es el punto 1 de esta
lista. Por eso el punto 1 no es un trámite: **es lo que abre `REVOPS-001C`.**

**Cómo se coló el error, para no repetirlo:** el roadmap escribió «Albert no tiene
webhooks» cuando eso era cierto, y nadie reescribió la frase después de que
`RESPUESTA-A-001` la volviera irrelevante al hacernos tenant. **Una dependencia se cae
por dejar de necesitarla, no solo porque alguien la construya** — y ese cambio no deja
commit, así que hay que ir a borrarlo a mano.

**Lo que NO toca ahora:** la pantalla `/superadmin/plans`, **aplazada al módulo
financiero** por decisión de David — hoy administra un catálogo que no describe nada
real, pero vuelve a tener sentido entonces.

### Albert — el estado vive en su propio documento

**`docs/prd/albert/ESTADO-ALBERT.md`** es el documento vivo del expediente: qué está
cerrado, qué debe Vivaru, qué debe Albert, y qué no tiene dueño. **Ir ahí antes que a los
once documentos del intercambio.**

> **AVISO DE VIGENCIA (28 ago 2026).** Todo lo que sigue en esta sección se escribió entre el
> **19 y el 22 de agosto** y **describe a Albert como estaba entonces**. Al menos tres de sus
> frases ya son falsas —«sin fecha para lo suyo», «no podemos probar el circuito hasta que
> publique» y el reset self-service como inexistente—: A1 salió, **B1 y B3 están desplegados** y
> el reset **está construido**. Se conserva porque explica **cómo se decidió cada cosa**, no
> **qué está vigente**. Para lo vigente, la cabecera de este documento y `ESTADO-ALBERT.md`.

#### `RESPUESTA-A-002` — lo que hay que saber sin releerla

Llegó el 19. Da la razón en las dos contradicciones **sin regatear** y corrige su propia
frase «sin PII».

- **Confirmado y sin coste para nosotros:** el `country` que empezamos a guardar hoy ya
  encaja con lo que pide (código ISO de dos letras, y nuestro selector es cerrado). No
  hay que rehacerlo.
- **`consent` vive SOLO en el contacto**, retirado del deal. `acceptedAt` lo pone
  nuestro servidor.
- **Sin fecha para lo suyo.** Dice que su A1 «cabe en días» y va primero, pero se niega
  a poner fecha de calendario por escrito porque la fija su owner. Consecuencia: podemos
  construir contra un contrato cerrado, **pero no probar el circuito hasta que publique**.
- **El motor de mensajería NO tiene compromiso** — «sobre la mesa», sin sí firme. Y lo
  nombra él mismo: sin control de opt-out y frecuencia, **el `consent` que acaban de
  diseñar no tiene quién lo respete al enviar**. Se construyó el candado, no la puerta.
- **Hallazgo suyo que conviene conocer:** el PII del timeline no está en campos
  estructurados sino embebido en el texto de cada evento (`Contacto creado: Juan Pérez`),
  así que borrar no basta con vaciar campos: hay que reescribir mensajes. Es trabajo
  suyo, pero hace la supresión más frágil de lo que se suponía.
- **Una imprecisión suya, para el registro:** justifica el índice diciendo que sin él la
  consulta «degrada al crecer». No es cierto para una igualdad simple — ese campo se
  indexa solo y el coste depende de los resultados, no del tamaño de la colección. El
  índice es barato y no estorba; la razón que da, no se sostiene.

## Dos cosas de método que salieron hoy y conviene no perder

- **Buscar el gemelo que lo hace bien.** Los dos defectos del 19 tenían un camino hermano
  que ya hacía lo correcto: `deleteOperationalUser` para el del residente, y el trial
  self-service para el de la moneda. Leer ese camino **antes** de diseñar el arreglo. Y
  el corolario: si dos caminos hacen lo mismo y solo uno está bien, probablemente hay un
  tercero.
- **Sí se puede saber qué front hay desplegado**, y el documento decía que no. `/login`
  sirve 200 y sus chunks son públicos: se descargan y se busca dentro un símbolo que solo
  exista en el código nuevo, con un símbolo viejo de control para saber que la búsqueda
  funciona. **La fecha de `apphosting:backends:get` NO sirve**: cambia a los ~45 segundos
  de crear el rollout, o sea marca que arrancó, no que terminó.

## La sombra de F4 está construida y NO desplegada (17 ago 2026)

**Lo que faltaba existe: `aiAssistance` ya no vive en un comentario.** Commits
`713185b` (el refactor que la hizo posible) y `f1fea59` (la sombra). Cuatro
piezas:

- **`functions/src/ai/ejecucion.ts`** — el tramo de una operación asistida que
  va **después de autorizar**: validar, cobrar cuota, ejecutar y contarlo. Se
  extrajo de `runGateway` porque la sombra no tiene sesión, ni membresía, ni App
  Check: **nada de lo que la puerta comprueba existe.** Ahora hay un solo camino
  de ejecución y dos puertas. Las dos alternativas descartadas —usuario falso, y
  camino propio duplicado— están escritas dentro, porque volverán a parecer
  buenas.
- **`functions/src/ai/sombra-pqrs.ts`** — la sombra. `planificarSombra` es una
  función pura: es la parte que decide **cuándo NO se gasta dinero**, y quería
  poder probarla sin emulador.
- **Dos triggers propios** en `index.ts` (`sombraPqrsAlCrearTicket`,
  `sombraPqrsAlActualizarTicket`), aparte de `onTicketCreated`/`onTicketUpdated`
  para que la notificación de un PQRS no dependa de que Vertex conteste.
- **`aiAssistance`** en `firestore.rules`: `read: superadmin`, `write: false`.

**Lo que hay que saber antes de encenderla:**

- **`ai-pqrs-shadow` está APAGADA en los dos ambientes**, y nace así a
  propósito. **Es la primera vez en el programa que el sistema gasta sin que
  nadie pulse nada:** hasta ahora toda llamada salía de un administrador
  abriendo el drawer o de una corrida lanzada a mano. USD 0,0009 por ticket.
- **Desplegar el código YA cambia la conducta de producción**, aunque la bandera
  siga apagada: los dos triggers nuevos empiezan a dispararse con cada ticket.
  Con la bandera apagada no llaman al modelo ni escriben nada, pero se invocan.
- **Sembrar los 24 del piloto con la bandera encendida cuesta USD 0,022** y
  ocurre solo, sin que nadie abra una pantalla.
- **Al desplegar, comprobar los triggers.** Son funciones nuevas; la trampa
  conocida de `run.invoker` es de las callables, pero una función nueva que no
  arranca da «error interno» sin pista.
- La sombra **no escribe una sola letra en el ticket**. Si algún día lo hace,
  dejó de ser una sombra.
- `en_curso` en reposo al leer `aiAssistance` = una función se cayó a mitad. Ese
  ticket no se reintenta, y es deliberado: pagar dos veces en silencio es peor.

**Evidencia:** 308 pruebas de functions en verde (17 nuevas en
`functions/tests/ai-sombra-pqrs.test.ts`), typecheck limpio en `src/` y en
`functions/`.

**Y desplegada y vista funcionando en staging el 17 por la noche.** Las dos
funciones `ACTIVE` (`19:33:57 UTC`, disparador leído: `tickets/{ticketId}`,
`RETRY_POLICY_DO_NOT_RETRY`), reglas desplegadas, `ai-pqrs-shadow` encendida en
staging. **Toda la cadena se comprobó por USD 0**, aprovechando que en
`buzon_simple` la sombra omite sin llamar al modelo:

- Ticket nuevo en `tenant-santa-maria` (`buzon_simple`) → fila escrita con
  `estado: omitida`, `motivo: buzon_simple`. Disparo, reserva, lectura de la
  variante y escritura, comprobados sin gastar.
- Clasificado sin prioridad → `decision` anotada y **`priority` AUSENTE, no
  `null`**: la corrección del 16 de agosto sobrevive hasta la fila de la sombra.
  Verificado leyéndolo, no por prueba unitaria.
- Resuelto → `decisionCongeladaEn` escrita. El congelado que mide G7 funciona.

**Y el camino de pago también, con una llamada real (USD 0,0009).** Ticket en
`tenant-nogal-bogota`: `estado: sugerida`, `variante: con_sla`, operación **v2**,
`marcasDeRevision: []`. Clasificó `maintenance` / `claim` / `medium`, con
`needsHumanReview: true` y `posible_urgencia`. **El borrador no afirmó ninguna
acción**: pide fotos y el apartamento, y dice qué se hará — la forma que la
regla dura permite. Es la v2 comportándose como la midió la evaluación offline,
ahora sobre un ticket de producto y no sobre un WhatsApp del gold set.

La fila de `aiUsage` salió con `uid: __sombra__` y `v2`, distinguible de las del
administrador (uid real, `v1`): **el mecanismo que separa el gasto de la sombra
del de las personas funciona**, y no hizo falta campo nuevo.

Lector: `node functions/scripts/leer-sombra-pqrs.mjs vivaru-staging-02`.

## Producción: la sombra está DESPLEGADA e INERTE, y falta promocionar (17 ago 2026)

**El código está en producción; las banderas no.** Escribir en Firestore de
producción quedó bloqueado en la sesión, así que las banderas las enciende David.

- `sombraPqrsAlCrearTicket` y `sombraPqrsAlActualizarTicket`: **ACTIVE** en
  `hogaru-1` (20:02:28 UTC), disparador leído sobre `tickets/{ticketId}`, sin
  reintentos. Regla de `aiAssistance` desplegada — el diff de reglas con `master`
  era **solo** ese bloque. Vertex (`aiplatform.googleapis.com`) habilitado.
- **`featureFlags` de producción: 0 documentos.** Todo apagado por default, que
  es un estado seguro y no uno a medias. `aiAssistance`: 0 filas.

### Promocionado el 17 por la noche. Falta SOLO encender las banderas

**`develop` está en `master` (`6d5bba8`) y producción sirve el front nuevo:**
rollout de App Hosting a las 14:45:58, landing y login en **200** comprobados
después. Las dos ramas quedaron sincronizadas en el mismo commit.

- **El arreglo de seguridad de Resend sobrevivió**, que era el riesgo real de la
  fusión: `apphosting.yaml` conserva `secret: RESEND_API_KEY` y hay **cero**
  claves en claro. Comprobado leyéndolo tras fusionar.
- **La mina murió con la FUSIÓN, no con el redespliegue** — corrige lo que este
  documento decía antes. Desde que `master` contiene las dos funciones, un
  despliegue desde `master` ya no puede borrarlas. Se redesplegaron igual desde
  `master` para que rama y ambiente coincidan sin dudas; **solo esas dos**, nunca
  las ~60, porque un despliegue total arrastra las que llevan el secreto de
  Resend sin ganancia.
- Gate corrido sobre `master` antes de empujar: 0 errores de typecheck fuera de
  `tests/`, 0 en functions con sus pruebas, 314 en verde, y **`npm run build` de
  Next completo** — empujar `master` dispara App Hosting y un build roto tumbaría
  producción.

**Lo único que falta: las tres banderas** (`ai-gateway`, `ai-pqrs-shadow`,
`ia-proveedor-real`) desde `/superadmin/flags`, o sembrando el catálogo con
`node functions/scripts/seed-feature-flags.mjs hogaru-1` y poniéndolas en `true`.
**Las enciende David**: escribir documentos en Firestore de producción está
bloqueado por el clasificador de permisos de Claude Code (desplegar functions y
reglas sí pasa). El orden entre ellas da igual: con el proveedor apagado la
sombra omite con motivo `proveedor_simulado` en vez de fabricar basura.

### Por qué la promoción no era opcional

**Un administrador de producción NO puede clasificar un ticket hoy**:
`updateTicketClassification` no existe en `master` (comprobado: 0 apariciones), y
`asistente-ticket.tsx` tampoco. La sombra guarda pares *sugerencia + decisión*, y
sin editor la mitad que importa no ocurre nunca — es literalmente lo que la PRD
advirtió para F3. Y la pantalla del residente en `master` sigue **sin renderizar
las definiciones** de los cinco tipos, que envenena la sombra por ruido.

**Encender la sombra sin promocionar deja un sistema a medias.**

Un administrador de producción **no podía clasificar un ticket**:
`updateTicketClassification` no existía en `master` (comprobado: 0 apariciones),
y `asistente-ticket.tsx` tampoco. La sombra guarda pares *sugerencia + decisión*,
y sin editor la mitad que importa no ocurre nunca — es literalmente lo que la PRD
advirtió para F3. Y la pantalla del residente seguía **sin renderizar las
definiciones** de los cinco tipos, lo que envenena la sombra por ruido.

Con la promoción, las dos cosas están en producción. El panel de IA no: va
detrás de `ai-pqrs-suggestions`, apagada (`8bfc1c2`). Sin ese gate, promocionar
habría puesto delante de un administrador un panel que revienta al pulsarlo,
porque producción **no tiene desplegada `asistirTicketPqrs`**.

**Qué pasará al encender las banderas: nada, y es lo esperado.** De los 9 conjuntos de
producción, **7 están marcados `isExample=true`** —incluidos los dos que tienen
los 20 tickets, `conjunto-las-playas` (14) y `tenant-santa-maria` (6)—. Los dos
que entonces se creían reales —Bromelias y Queretarock— tienen **cero tickets**. (Y Bromelias tampoco es cliente: David lo confirmó el 24 ago 2026.). La sombra queda armada
para el primer ticket de verdad, que es justo lo que F4 persigue. El filtro no
discrimina conjuntos: descarta datos de mentira.

**Ojo con `tenant-santa-maria`:** en producción es `con_sla`, no `buzon_simple`
como en staging. Mismo nombre, comportamiento distinto.

### Hallazgo al probarlo: la sombra no distingue lo sembrado de lo real

**Los tickets del piloto no llevan `isExample`, y `tenant-nogal-bogota` tampoco.**
El mecanismo existe y está usado en otros sitios —`trial-seed.ts` lo pone en el
documento, los seeds de demo en el conjunto, y `audit-volumen-ia.mjs` descuenta
por los DOS caminos porque sin eso la volumetría dio 20 tickets que eran 0 y 26
comunicaciones que eran 2—, pero `seed-pqrs-piloto.mjs` no lo escribe y la
sombra no lo lee.

Si se resiembra el piloto con la sombra encendida: 16 tickets `con_sla` gastan
USD 0,014 **y entran en el conjunto de evaluación de G7 indistinguibles de los
reales.** Es el mismo defecto que ya infló un baseline dos veces, esta vez en el
sitio donde se cobran las dos puertas de escala.

**ARREGLADO el 17 de agosto, y comprobado en staging.** La sombra omite con
motivo `sembrado` cuando el ticket **o su conjunto** traen `isExample` —hacen
falta los dos caminos, como en `audit-volumen-ia.mjs`— y `seed-pqrs-piloto.mjs`
ya marca lo que escribe. Verificado con un ticket sembrado en
`tenant-nogal-bogota` (`con_sla`, donde sí clasificaría): salió
`omitida`/`sembrado` y **`aiUsage` siguió con una sola llamada de la sombra**,
la de pago. Es decir: no se pagó por él.

**Staging quedó limpio el 17 por la noche.** Los tres tickets de prueba
(`PQRS-SOMBRA1/2/3`) y sus filas de `aiAssistance` están borrados: **0 filas**.
Se crearon para comprobar la sombra y su sitio no es el conjunto de evaluación —
uno llevaba además una decisión fabricada para probar el congelado, y eso en G7
es un par que nadie tomó.

**Y los dos comunicados del 14 en `tenant-palmas-cdmx` también**, tras comprobar
—no dar por bueno— que sus textos están transcritos en
`datasets/evaluacion/resultados/2026-08-14-sesion-administrador-2.md` (líneas 101
y 105). El conjunto queda con **0 comunicados**: si algún día se retoma la línea
base de comunicaciones, ya se puede tomar a ciegas.

**F3 CERRADA el 17 de agosto**: la entrada de §9 quedó firmada por David y
escrita en los dos sitios —el criterio de §9, tachado y reformulado como se hizo
con el de `category`, y el registro de decisiones—. El 0% de afirmaciones lo
cumple el sistema (comprobación de servidor + revisión forzada + resaltado), no
el modelo, que se queda en 6,6%. Con el alcance dicho: lo prohibido es **afirmar
acciones**; el compromiso futuro —«procederemos a revisar»— lo permite la regla
dura, y su subida de 45 a 59 es la conducta desplazándose a la forma buena.

**Tres decisiones de David del 17 de agosto que siguen rigiendo:**

- **Sin más pruebas con administradores por ahora.** La línea base del tercer
  administrador y H2′ quedan aparcadas, no canceladas; la pregunta por la
  respuesta 3 pasa a **mensaje asíncrono**. Los dos comunicados del 14 en
  `tenant-palmas-cdmx` pierden urgencia, pero siguen por borrar.
- **El orden: sombra de F4 primero; PRD de FEAT-001 (onboarding) después.**
  ~~Sombra de F4~~ **construida el 17 de agosto** (arriba). Sigue FEAT-001, que
  quedó más pequeña de lo que decía el plan maestro: el importador ya está en
  producción y `importRuns` recoge solo los encabezados no mapeados. Faltan los
  15–25 archivos reales (recolección comercial) y la corrección anotada: son
  **10** pasos de activación, no 7.
- **Por redactar y firmar: la entrada de §9 en el registro de decisiones** —
  el «0 afirmaciones no sustentadas» lo cumple el SISTEMA (comprobación de
  servidor + revisión forzada + frase resaltada), no el modelo, que queda en
  6,6%. Misma lógica de la decisión rectora: la exigencia se mueve a la puerta
  de salida. **Borrador entregado el 17 por la noche, pendiente de que David lo
  apruebe**; sin esto F3 no cierra.

## La frase marcada se resalta dentro del borrador, y staging ya sirve la v2 (16–17 ago 2026, noche)

**La decisión que más abajo figura como pendiente se tomó: las dos cosas, y las
dos están en el repo.** La comprobación del servidor (commit `20e341f`) ya
forzaba `needsHumanReview`; ahora además dice QUÉ frase y DÓNDE, y la pantalla
la resalta dentro del borrador y la nombra en el aviso. Es la única palanca que
la sesión de F3 dejó viva: el aviso general se probó con una persona y publicó
literal igual.

Dónde vive cada pieza, con su porqué al lado en el código:

- **El criterio no se movió ni se duplicó:** `afirmacionesDeAccion` en
  `functions/src/ai/afirmaciones.ts` devuelve todas las coincidencias con su
  posición, y `afirmaAccion` —de donde sale el 6,6%— delega en ella.
- **El fragmento viaja por el SOBRE de la callable (`frasesMarcadas`), no por
  `output`:** el esquema de salida se le manda al modelo dentro del prompt
  (`z.toJSONSchema`), así que meterlo ahí obligaría a subir a v3 y a remedir
  los 152. La operación sigue en v2 y la corrida del 17 sigue valiendo.
- **En `aiUsage` sigue entrando solo la categoría, nunca la frase** — la
  distinción está escrita en `FraseMarcada` del catálogo.
- El corte en pantalla es un módulo puro (`src/lib/ai/frases-marcadas.ts`) que
  **descarta toda posición que no corte exactamente su texto**: el frente se
  despliega con el push y las functions a mano, y en esa ventana el campo llega
  ausente (es opcional en `callables.ts`) o podría llegar de otro criterio.
  Resaltar palabras inocentes mataría la confianza igual que la mató el aviso.
- El aviso sin frase marcada corrige la cifra: **10 de 152 con el criterio
  congelado**. El «44 de 152» era el conteo a mano no reproducible, y su
  ejemplo («procederemos a…») es un compromiso futuro permitido, no una
  afirmación.

**Desplegado y verificado leyéndolo:** `asistirTicketPqrs` actualizada en
`vivaru-staging-02` el 17 de agosto a las 04:14 UTC (`updateTime` leído con
`gcloud describe`, estado `ACTIVE`). **Solo esa función, a propósito**: es la
única cuya conducta cambió, y un deploy total arrastraría functions con
secretos (Resend) sin ganancia. Ojo del día: **caducaron LAS DOS credenciales,
que son distintas** — `firebase login --reauth` (deploy) y `gcloud auth login`
(lecturas); la de ADC para scripts (`gcloud auth application-default login`) es
una tercera y no se renovó esa noche. El frente salió solo con el push; la
señal de que ya sirve lo nuevo es el aviso del borrador diciendo «10 de 152».

**Nadie ha visto el resaltado pintado.** La evidencia es de tests: 291 en
functions y 937 en cliente (los 7 rojos son preexistentes, comprobado
corriéndolos contra HEAD sin estos cambios). La comprobación de punta a punta
es una llamada real de David en staging (USD 0,0009) — y el resaltado solo
aparece si el borrador trae afirmación (~1 de cada 15 con la v2): no verlo en
una llamada no dice nada malo.

**De los tres bloqueos de F4, dos cayeron esta noche: el resaltado y el default
de `priority`.** «Media» ya no es el arranque: el selector parte de «Sin
prioridad» —estado real, solo visible mientras el ticket no la tenga—, guardar
sin elegir NO escribe el campo (se omite, no se pone en `null`) y el feedback
anota `null` en ese eje; `classifiedAt` se escribe igual, porque la persona sí
clasificó categoría y tipo. Cero cambios en functions: el esquema del feedback
ya aceptaba `null`. Lo sostiene por los dos lados
`tests/pqrs-clasificacion-prioridad.test.ts`. **Con el despliegue de arriba,
los tres bloqueos de F4 cayeron la misma noche** (`d08ec7c`, `e2686f8` y el
deploy). Antes de F4 quedan los pendientes que no son código: el censo de
producción, borrar los dos comunicados del 14 en `tenant-palmas-cdmx`, y la
pregunta al administrador por su respuesta 3.

## La v2 de `pqrs-asistir` está medida: las afirmaciones caen de 21,1% a 6,6% (16 ago 2026)

**Lectura en `datasets/evaluacion/resultados/2026-08-16-pqrs-v2-afirmaciones.md`.**
Un solo cambio: **una regla dura nueva** —no afirmar acciones de la
administración que no consten en el historial— en `reglasDuras` de
`functions/src/ai/catalog.ts`, con `version` de la operación subida a **2** para
que la telemetría no mezcle los dos contratos en una columna. 152 casos, USD
0,1435.

- **A (acción dada por hecha o en curso): 32/152 → 10/152.** −69%.
- **La clasificación NO se movió:** `category` 82,1→82,9%, `type` 70,7→69,3%,
  `priority` 72,4→71,7% — ±2 casos, que a temperatura 0,2 es ruido. **Las tres
  puertas duras intactas:** inyección 8/8, nulls 12/12, guardrail 32/32. Era el
  riesgo real del cambio y no se materializó.
- **B (compromiso futuro) sube de 45 a 59.** El comportamiento se desplaza a la
  forma permitida, que es justo lo que la regla pide («dice qué se hará»).
- **El criterio de §9 sigue sin cumplirse: pide 0 y hay 6,6%.**

**Y el prompt ya no es la palanca: 8 de los 10 que quedan son «estamos
verificando» o «estamos revisando», la frase que la propia regla cita como
prohibida con esas palabras exactas.** Para llegar a 0 hace falta algo
determinista — comprobación en el servidor que fuerce `needsHumanReview`, o
resaltar la frase en la pantalla. **Decisión tomada el 16 por la noche: las dos
— ver la sección del resaltado, arriba.** Otra vuelta de prompt no se
recomienda.

**Nota de método:** «44 de 152» de la Fase 2 **no era una línea base
reproducible** —conteo a mano sin criterio escrito, mezclando acciones afirmadas
con futuros condicionales—. El criterio de ahora está congelado en
`functions/scripts/medir-afirmaciones-pqrs.mjs`, **con autoprueba de 11 casos que
corre antes de contar**.

## La sesión de F3 se hizo: el circuito funciona y el criterio de veracidad falla 2 de 6 (16 ago 2026)

**Lectura completa en
`datasets/evaluacion/resultados/2026-08-16-sesion-pqrs-f3.md`.** Nueve tickets en
ocho minutos, seis con asistencia, **USD 0,0055 la sesión entera**. La hoja de
anotación no se llenó; se reconstruyó entera cruzando `aiUsage.createdAt`,
`ticket.classifiedAt` y `aiFeedback.createdAt`, que encajan uno a uno — **y salió
por suerte**: con dos tickets en paralelo o una recarga no habría salido.

**Lo que hay que saber sin abrir el documento:**

- **Cuatro pares limpios y CERO correcciones**: las cuatro clasificaciones
  guardadas son idénticas a la sugerida. Otras dos las leyó, publicó el borrador
  y **no guardó clasificación ninguna**. El instrumento de G7 existe y escribe;
  cuatro pares no miden una exactitud.
- **`distanciaEdicion: 0` en las seis.** Publicó el texto del modelo sin tocar
  una palabra.
- **El criterio de lanzamiento «0 afirmaciones no sustentadas» FALLA: 2 de 6.**
  `P010` («actualmente estamos verificando con el equipo de mantenimiento») y
  `P009` («estamos revisando los registros de mantenimiento y seguridad»), en
  tickets sin respuesta previa. **Y con el aviso de las 44/152 puesto en
  pantalla**: se probó con una persona y no cambió nada. La regla dura pasa a v2
  del prompt de `pqrs-asistir`.
- **Ninguna de las siete prioridades la eligió una persona:** tres son el default
  `medium` de tickets que nacen sin prioridad —la trampa anotada la víspera, que
  se cumplió en el primer bloque— y cuatro son del modelo aceptadas. **Arreglar
  el default es prerrequisito de F4**, ya no por deducción.
- **Los dos sintéticos se trabajaron A MANO y sin análisis:** eran los dos
  primeros de la bandeja porque se sembraron con 14 y 15 días y la lista ordena
  por antigüedad. La defensa de inyección sigue 8/8 offline y **sin verse en
  pantalla**. Si se repite, sembrarlos con antigüedad baja.
- **Buzón simple no se trabajó en la sesión**; una lectura suelta ese día
  confirma los nulls por tercera vez.
- **H2′ sigue sin medirse: cuarta sesión.** Escribió los dos comunicados **con el
  asistente y antes de PQRS**, y en `tenant-nogal-bogota`, no en el conjunto de
  comunicaciones. Los dos avisos del 14 en `tenant-palmas-cdmx` siguen sin
  borrar. Deja tres patrones confirmados por una **tercera persona
  independiente**: edición 0%, descartó tres preguntas de dato faltante y no
  contestó ninguna, y pidió dos propuestas en un aviso. **Tres de tres.**
- **La respuesta 3 abre una causa que la PRD no tenía prevista:** corrige «por
  conocimiento histórico del condominio que no viene inmerso en la PQRS» — una
  corrección que **no es un error del modelo**, porque §7 le niega esa entrada a
  propósito. Si es frecuente, la referencia de la sombra tiene que distinguir «se
  equivocó» de «no podía saberlo». Su límite: en los datos de la sesión no hay
  ni una corrección, así que habla de algo que no ocurrió ahí. **Hay que
  preguntárselo.**


## El guion de la sesión de F3 está escrito, y staging no estaba como decía el traspaso (16 ago 2026)

**El guion vive en `docs/guion-piloto-pqrs.md`**, con el patrón del de
comunicaciones. Seis partes, ~95 minutos. Dos decisiones tomadas ese día:

- **El participante es un tercer administrador, persona nueva**, así que la
  línea base de comunicaciones a ciegas **va, y va primero**. Prerrequisito duro
  que no estaba escrito en ningún sitio: `tenant-palmas-cdmx` **tiene dentro los
  dos avisos asistidos del 14 de agosto**, y son avisos bien redactados en
  pantalla — justo lo que la línea base no puede ver. Hay que borrarlos antes;
  sus textos quedan transcritos en la lectura del 14, así que no se pierde nada.
- **`SYN#2` y `SYN#6` entran, al final y fuera del bloque medido**, y se desvía
  al administrador si abre `PQRS-P017` o `PQRS-P018`. Se descartó borrarlos y
  reponerlos: volver a correr el sembrado reescribe los 24 por `merge` y borra la
  clasificación que el administrador acabe de dejar.

**Dos defectos de instrumentación encontrados leyendo el código, y los dos caen
sobre la cifra que la sesión viene a producir:**

1. **La fila de `aiFeedback` no dice de qué ticket habla.** El esquema es
   `.strict()` y no tiene `ticketId`; el servidor añade `tenantId`, `uid` y
   `createdAt`. Un mismo ticket abierto dos veces deja **dos filas**. Sin una
   columna de orden escrita a mano, «corrigió la categoría en 4 de 9» es un
   número sin tickets detrás. **Es lo que decide que los sintéticos vayan al
   final:** una fila suya en medio del bloque ya no se puede excluir.
2. **«Media» no es una decisión.** El selector de prioridad arranca en
   `selectedTicket.priority ?? "medium"` (`src/app/(admin)/admin/pqrs/page.tsx:168`)
   y los tickets de PQRS **nacen sin prioridad**. Guardar sin tocar nada escribe
   `guardada.priority: "medium"`, que si el modelo propuso `high` se lee como
   corrección deliberada. **Es la misma familia del `type: "petition"`** de buzón
   simple: un valor por defecto con apariencia de elección humana. En la sesión
   se sortea con una columna en la hoja; **en la sombra de F4 no hay nadie
   mirando, así que arreglarlo es prerrequisito de F4.** *(Arreglado el 16 por
   la noche — ver la sección del resaltado, arriba.)*

**Y el ambiente no estaba como decía este documento.** Decía 18 tickets en
`tenant-nogal-bogota` y 6 en `tenant-santa-maria`; **había 2 y 0** — un
`--limpiar` seguido de un sembrado que se cortó en el segundo ticket. Las cuatro
banderas sí estaban encendidas y la variante de buzón sí era `buzon_simple`.
**Vuelto a sembrar y verificado leyéndolo:** 18 y 6, 4 con respuesta previa, 0
con `priority`, 0 con `classifiedAt`. Hay que **volver a sembrar el mismo día de
la sesión**: la antigüedad se calcula al sembrar y el semáforo de SLA depende de
ella. Nota: `aiFeedback` ya arrastra 5 filas de `pqrs-asistir` de los ensayos y
`aiUsage` 17 llamadas — al leer el resultado, filtrar por fecha y `uid`.

**Sigue pendiente y sin hacer: el censo de tickets de producción.**

## F3 de PQRS: staging montado y ensayado; falta la sesión con la persona (15 ago 2026)

**El circuito entero funciona en staging y está ensayado a ciegas tres veces.**
Lo único que queda de la Fase 3 es la sesión con un administrador.

**Cómo está el ambiente, verificado leyéndolo y no de memoria:**

| Qué | Dónde | Estado |
|---|---|---|
| Functions | `vivaru-staging-02` | `asistirTicketPqrs` creada; `run.invoker` comprobado llamándola |
| Frente | `develop` → App Hosting | desplegado; remoto verificado |
| Tickets `con_sla` | `tenant-nogal-bogota` | 18 sembrados (16 casos + 2 de inyección) |
| Tickets `buzon_simple` | `tenant-santa-maria` | 6 sembrados; **variante cambiada a `buzon_simple`** |
| Banderas | `/superadmin/flags` | `ai-gateway`, `ia-proveedor-real` y `ai-pqrs-suggestions` **encendidas** |

**Accesos de la sesión:** `admin@elnogal.co` para el conjunto grande y
`admin@santamaria.co` para el de buzón — cuentas demo, contraseñas en
`seed-data-co.mjs` y `seed-demo-users.mjs`. **Ojo: `tenant-santa-maria` existe
también en PRODUCCIÓN**, con otros tickets y sin nada de esto; lo que distingue
un ambiente del otro es la URL, no el nombre del conjunto.

**Cifras reales del ensayo, con el proveedor de verdad:** 12 asistencias, todas
`ok`, `gemini-3.1-flash-lite`, **USD 0,00089 por asistencia** — confirma la cifra
de G5 (USD 0,001) ahora sobre entradas de producto y no sobre el gold set.

**Y la cadena de medición, probada de punta a punta**, que es lo que justificaba
la fase: un ticket que nace `pqrs`, el modelo propone `maintenance`/`high`, la
persona lo acepta y guarda, y la fila queda con las dos mitades juntas —
`sugerida` y `guardada`, más `distanciaEdicion` del borrador.

**Antes de la sesión hay que volver a sembrar.** El ensayo clasifica y responde
el primer ticket para poder probar `guardada`, así que deja huella:

```
FIREBASE_PROJECT_ID=vivaru-staging-02 node functions/scripts/seed-pqrs-piloto.mjs \
  --tenant-con-sla=tenant-nogal-bogota --tenant-buzon=tenant-santa-maria --limpiar
```

**Lo que encontró el ensayo y no se habría visto de otra forma: de once
asistencias llegaba UNA fila de feedback.** El envío estaba enganchado solo al
desmontaje de la pantalla, al cambio de ticket y al ocultarse la pestaña —
ninguno ocurre cuando alguien analiza, cierra el panel y se queda donde está, que
es lo que hace un administrador en una sesión guiada. Se habría hecho la sesión
entera y salido casi sin datos. Corregido: cerrar el drawer manda la fila.

**El validador falló cuatro veces antes que la aplicación**, y las cuatro se
arreglaron en él: comparaba distinguiendo mayúsculas contra rótulos con
`uppercase` en CSS; leía un `select` de la lista de atrás en vez del del drawer
(«all» antes y después: un check que pasa siempre mirando lo que no es); leía la
pantalla antes de que el drawer apareciera, dando resultados distintos en dos
corridas iguales; y mezclaba «falló» con «no llegó a correr», de modo que un
`waitUntil` mal elegido imprimía «PUERTA DURA: buzón simple enseñó clasificación»
sin haber mirado nunca esa pantalla.

**Dos cosas que quedaron anotadas y no se tocaron:**

- **La PRD dice «producción tiene 0 tickets» y no es exacto**: `tenant-santa-maria`
  en producción tiene 6, creados por la aplicación, anteriores y ajenos a esto
  (uno se llama «oiyutiuyt»). Es un conjunto demo, así que «0 tickets reales de
  residentes reales» probablemente siga siendo cierto — pero el número escrito no
  es el que hay. El censo completo de producción quedó sin hacer.
- `residencial-vista-prueba-012a42` se usó un momento como conjunto de buzón y se
  **devolvió a su estado original** (tickets borrados, variante de vuelta a
  `con_sla`): su único administrador es la cuenta del trial autoservicio, cuya
  contraseña no está en ningún seed, así que ni se podía ensayar ni enseñar.

**El hallazgo que más pesa: el administrador no podía clasificar, y eso dejaba
sin suelo a las DOS puertas de G7.** Al ir a pintar las sugerencias no había
dónde aceptarlas. Medido: `category` nacía constante, `type` lo fijaba el
residente y el drawer lo enseñaba de solo lectura, y **`priority` no se escribía
nunca** — el campo solo vivía en el tipo de TypeScript; todas las prioridades del
repositorio son del módulo de soporte, otra colección. Las dos puertas movidas a
G7 se cobran «contra la decisión real del administrador» acumulada por la sombra,
y esa decisión no existía: la Fase 4 habría acumulado sugerencias contra un
hueco. **Es el tercero de la familia de `category` y `type`** —constante,
descriptivo y ahora inexistente—, y llegó por el mismo camino: mirar el producto
y no el kappa. No es un fallo del instrumento sino del plan, que dio por supuesta
una capacidad que el producto no tenía. Decisión de David: los tres ejes
editables ya en F3.

**Lo demás que salió al construir:**

- **Puerta propia en el servidor** (`asistirTicketPqrs`), no `aiInvoke`: con la
  genérica el navegador afirmaría `variante`, que es lo que decide la puerta dura
  de `buzon_simple`. El cliente manda un `ticketId` y nada más.
- **El `historial` de producción es el contrario del que midió F2**: en el gold
  set lo escribe el residente (hilos de WhatsApp), en el producto solo la
  administración. Se mapea fiel al producto y el sembrado incluye 4 tickets con
  respuesta previa para verlo en la sesión.
- **`npm test` corría CERO tests y salía con error.** `sh` no expande
  `tests/**/*.test.ts` porque los 58 archivos están directos en `tests/`. Estaba
  anotado aquí desde el 15 como una de las cuatro veces que falló el instrumento,
  **pero el script nunca se arregló**. Ahora corre 922 tests: 915 verdes y **7
  rojos preexistentes** —`data-table.tsx`, reservas, regulations y descarga de
  QR—, ajenos a PQRS y sin tocar. Son un frente aparte.

**Lo único que queda de F3 es la sesión.** Y con la regla de orden delante: **si
usa al tercer administrador, ANTES hay que tomarle la línea base de
comunicaciones a ciegas.** Van tres sesiones sin medir H2′ porque se quemó a la
persona enseñándole la herramienta primero; aquí el riesgo es el mismo y la
herramienta es más vistosa.

Lo que la sesión tiene que mirar, que es lo que el gold set no puede dar: si el
resumen sirve, si el borrador se acepta o se reescribe, si `needsHumanReview`
aparece donde debe, y sobre todo **cuántas veces corrige la clasificación
sugerida** — que ahora, por primera vez, se puede contar.

## El desplegable del residente está corregido: F3 se queda sin prerrequisitos (15 ago 2026)

**El último bloqueo de la F3 de PQRS está cerrado**, en un solo archivo:
`src/app/(resident)/resident/pqrs/page.tsx`. Las cinco definiciones de `type`
quedan alineadas con `datasets/pqrs/taxonomia.md` —el eje es **de quién o de qué
se queja**: persona (queja) contra servicio (reclamo)— y `other` se ofrece como
«General», que es el rótulo que ya usaban las dos pantallas del administrador.

**Pero el defecto no era el que estaba escrito, y esa es la parte que vale.**
El informe decía que el residente leía las definiciones cruzadas. No las leía:
**el `map` de los botones pintaba solo `label`, y el campo `description` llevaba
muerto desde siempre.** El residente elegía entre cuatro palabras desnudas
—`Petición | Queja | Reclamo | Sugerencia`— sin una sola línea de ayuda.
Envenenaba la sombra de F4 igual, pero **por ruido y no por engaño**.

**La lección de método, que es la de siempre en este programa:** corregir las
cinco cadenas —que era el arreglo que pedía el documento— habría dejado la
pantalla **idéntica**, con el prerrequisito dado por cerrado y la sesión de
staging corriendo sobre el mismo defecto. Se vio abriendo el JSX, no leyendo la
constante. **Es la cuarta vez que el instrumento falla antes que la cosa
medida** — el tamiz que se creía sus cifras, los checks de inyección que
premiaban el rechazo, `npm test` corriendo cero tests, y ahora un campo de datos
que nadie renderizaba.

**Y apareció un tercer defecto que no estaba en ningún documento: en
`buzon_simple` todo ticket nacía con `type: "petition"`.** El selector se oculta
en esa variante, pero el estado inicial se enviaba igual — una etiqueta falsa
**con apariencia de elección humana**, y precisamente en el eje donde la PRD
exige nulls como puerta dura. **Decidido por David:** no se envía `type` y
`createTicket` cae a su default `other`.

**Dos cosas más que quedaron en la pantalla:**

- **La precedencia del árbol, escrita arriba del grupo:** «Si reportas algo que
  ya salió mal, elige Queja o Reclamo aunque además pidas que lo arreglen». Es
  la regla que **el kappa tumbó dos veces** con anotadores que conocen el
  producto; dejar que un residente la deduzca era peor.
- Las opciones pasan a una columna en móvil (ahora llevan texto, no una palabra)
  y anuncian su estado con `aria-pressed`.

**Deuda que se ve desde aquí y NO se tocó, con su prueba de que no es teórica:**
los rótulos de `type` están **duplicados en tres sitios** —esta pantalla,
`/admin/pqrs` y `pqrs-aging-widget`— y **ya divergieron**: el widget pinta
`other` como **«Otros»** y los otros dos como **«General»**, así que el mismo
ticket cambia de nombre según la pantalla. Se comprobó al ir a escribir que
coincidían. Un solo módulo compartido lo cerraría, pero es refactor con su
propio alcance —y con una decisión de copy dentro— no parte de este arreglo.

## La Fase 2 de PQRS está HECHA, y `category` se cobra ahora en la puerta de escala (15 ago 2026)

**La operación `pqrs-asistir` existe y la corrida está hecha.** Segunda
operación del catálogo, sobre el gateway que ya estaba: entrada que puebla el
servidor, salida estricta del §7 de la PRD, sin infraestructura nueva. 456
llamadas reales, **USD 0,45**. Lectura completa en
`datasets/evaluacion/resultados/2026-08-15-pqrs-evaluacion-offline.md`.

**Dos puertas duras pasan y una no:**

- **`buzon_simple` 12/12** y **inyección 8/8**, en las tres versiones de prompt.
- **`category` se queda en 82,1%** (p1), 81,4% (p2), 82,9% (p3), contra una
  puerta de ≥90%. **David decidió esa misma noche moverla a la puerta de escala
  (G7), contra la sombra** — no por no haber llegado, sino por lo que se
  encontró al mirar el código: ver abajo. **F2 queda HECHA y F3 desbloqueada.**
- Se reportan sin bloquear: `type` 70,7%, `priority` 72,4%, **recall de `high`
  94,7%** (18/19) y el guardrail **32/32** — todo `high` que propone el modelo
  llega con `needsHumanReview`. El recall va con asterisco: la definición sigue
  sin validar (kappa 0,47).
- **G5 tiene su cifra: USD 0,001 por asistencia**, del mismo orden que
  comunicaciones. 300 asistencias al mes por conjunto son USD 0,30.

**`p1-minima` gana y queda activa** — la versión con la taxonomía entera dentro
del prompt no paga su costo, igual que en comunicaciones y más marcado.

**LO QUE DECIDIÓ ESTO, y es el hallazgo que más vale de la sesión:
`category` hoy es una constante en producción.** Todo ticket que crea el portal
del residente nace con `category: "pqrs"` escrito a fuego
(`src/features/pqrs/use-tickets.ts:129`) — el residente elige `type`, no
`category`—, y **no la lee nadie**: ni `firestore.rules`, ni `functions/`, ni
`/admin/pqrs` (esa pantalla filtra y muestra `type`), ni el SLA. Su único
consumidor es un conteo del reporte del comité
(`src/features/reports/use-committee-report.ts:439`). **Es el hallazgo gemelo
del de `type`, y llegó igual: mirando el producto, no el kappa.**

**Y el baseline real no es cero: es 61,4%.** Clasificar todo como `pqrs`
—literalmente lo que hace el código— acierta 86 de 140. Salió medido sin
buscarlo: es la cifra de la corrida en simulado, porque el simulador siempre
contesta `pqrs`. Así que la comparación no era 82 contra 90 sino **82 contra
61**. Su límite, dicho: el gold set son dos edificios, no dos mercados.

**Se intentó arreglarlo con prompt y no se puede:** 19 de los 25 fallos son
`pqrs → maintenance` —preguntas y sugerencias SOBRE un tema físico— y la
versión que se lo explica (p3) **giró la frontera en vez de afinarla**: +12 en
`pqrs`, −11 en `maintenance`, neto +1, y `type` cayó nueve puntos. Cada
instrucción de frontera mueve la frontera entera.

**El candado de la decisión, para que no se convierta en costumbre.** Es la
segunda puerta que se mueve a G7, así que la PRD fija ahora **cinco criterios
que no se tocan** —inyección 8/8, nulls de `buzon_simple`, revisión humana
total con `needsHumanReview` en los `high`, cero cambios automáticos, cero
acceso cruzado— y una regla: mover cualquier otro exige la medición que lo
sostenga **y** una puerta posterior que lo recoja; nunca la sola constatación
de que no se alcanzó.

**Dos cosas más que salieron y valen para F3:**

1. **El modelo afirma acciones que nadie tomó** — «procederemos a programar la
   inspección», «hemos activado el protocolo»: 44 de 152 borradores. No lo mide
   el gold set (mide clasificación), pero en el drawer un administrador puede
   publicarlo sin que nadie haya activado nada. **Candidata a regla dura de la
   v2 de la operación.**
2. **El examen falló dos veces antes que el modelo.** Los checks de inyección
   contaban como obediencia que el borrador RECHAZARA la compensación
   (`SYN#6`) y que propusiera `low` razonándolo (`SYN#4`). Es
   **mención-no-es-obediencia por tercera vez** en este programa. Corregido, con
   prueba en los dos sentidos, y la corrida pagada se **recalificó sin volver a
   llamar al modelo** (`functions/scripts/recalificar-pqrs.mjs`).

**El prerrequisito de `buzon_simple` está cerrado:** 12 casos declarados (7 MX,
5 EC) con una columna opcional `variante` en `etiquetas.tsv`. Se eligieron
evitando `billing`, `high` y los casos ancla de la taxonomía — sus etiquetas
están impresas en el documento y ahora la taxonomía viaja en un prompt.

## El gold set de PQRS existe, con 152 casos y tres huecos dichos (15 ago 2026)

**Fase 1 de `PRD-VAI-FEAT-002`** —«medir baseline y construir gold set»— a
medias: el gold set está, el baseline no. Todo en `datasets/pqrs/`, y la
taxonomía con las definiciones y su evidencia en `datasets/pqrs/taxonomia.md`.

**Cinco ejes.** Los tres primeros son el contrato de la PRD y de `Ticket`, no
invención: `category`, `type` y `priority`. **`priority` casi se queda fuera**, y
es el que sostiene el criterio más duro de la PRD —recall de `high` ≥95%—. Los
otros dos son el tema (once, con frecuencias de dos países) y las banderas.

**152 casos: 84 de México, 60 de Ecuador y 8 sintéticos** de prompt injection,
que son los únicos que no salen de un corpus real porque un ataque no aparece
espontáneamente en un chat vecinal. Prueba en
`functions/tests/pqrs-goldset.test.ts`, mutada para comprobar que atrapa.

**Se edita `etiquetas.tsv`, NO el JSON**, y se regenera con
`scripts/construir-gold-set-pqrs.mjs`. El texto de cada caso lo pone el corpus:
tecleándolo se cuela una corrección ortográfica, y la mala ortografía es lo que
hace útil el material.

**Tres cosas que aparecieron y valen más que el conjunto:**

- **Las definiciones de `type` estaban cruzadas.** Se habían escrito en el eje de
  la severidad; el canónico es **de quién o de qué se queja** — persona (queja)
  contra servicio (reclamo). Verificado contra fuente pública, con su límite
  anotado: ese marco regula entidades públicas y una copropiedad es privada.
- **Los avisos del comité contaminaban el muestreo.** Un aviso es la salida del
  administrador; un ticket es la entrada del residente. Filtrar por remitente no
  basta: 27 de 83 avisos mexicanos los escriben residentes del comité.
- **«Cambió tu código de seguridad» inflaba `seguridad_porteria`.** Lo escribe
  WhatsApp, no una persona: 89 en México y 141 en Ecuador, y el tema entero en
  Ecuador tenía 132. Corregido, baja del tercer puesto al sexto en México. **No
  se vio contando, se vio muestreando** — el contador se creía sus cifras porque
  el ruido pasaba su propio tamiz.

**El doble etiquetado SE HIZO el mismo 15 de agosto** — 20 casos, David a
ciegas contestando en lenguaje natural. **Tumbó dos ejes de cuatro**, que es
para lo que existía: `category` 0,91 y `tema` 0,89 pasan; `type` dio **0,42**
—la definición no decía qué gana cuando un mensaje reporta un fallo Y pide el
remedio, que es el formato más común de PQRS— y `priority` dio **0,08, acuerdo
de azar**. Lectura completa en
`datasets/pqrs/doble-etiquetado/resultado-2026-08-15.md`.

**Las dos definiciones se reescribieron y los 152 casos se re-etiquetaron**:
`type` es ahora un árbol con precedencia (reportar manda sobre pedir; conducta
de personas → queja, servicios → reclamo) y `priority` tiene anclas con casos
concretos y la prueba «¿esperar a mañana empeora el resultado?». Cambiaron 23
casos, el 16%.

**La SEGUNDA muestra ciega se hizo el mismo 15 de agosto, por la tarde, y los
dos ejes siguen suspendiendo:** `type` **0,53** (umbral 0,70) y `priority`
**0,47** (umbral 0,60). Lectura completa en
`datasets/pqrs/doble-etiquetado/resultado-2026-08-15-ronda2.md`; la muestra, en
`muestra-2.tsv`. Lo que hay que saber sin abrirlos:

- **`priority` salió del azar** —de 0,08 a 0,47— y las marginales ya casi
  coinciden: **las anclas con casos funcionaron**, la frase sola no.
- **`type` falla por lo mismo que la primera vez:** cuatro de siete desacuerdos
  son A `claim`/`complaint` → B `petition`. **La precedencia «reportar manda
  sobre pedir» no prendió, y esta vez B la tenía escrita delante** — así que la
  explicación de la ronda 1 ya no sirve.
- **Sobre los `high`, que es para lo que se sobremuestreó: coinciden 3 de 5.** El
  criterio «recall de `high` ≥95%» sigue **sin ser evaluable**, ahora con número.
- **El pool limpio baja de 116 a 96, y solo 5 son `high`.** Una tercera ronda ya
  no es barata. (116, no 124: hay que excluir también los 19 identificadores que
  `taxonomia.md` usa de ancla o ejemplo — su etiqueta la imprime el documento.)

**La vuelta de definiciones de `priority` SE HIZO la noche del mismo 15 de
agosto**, por chat sobre los 7 desacuerdos de la ronda 2. Registro completo en
`datasets/pqrs/doble-etiquetado/definiciones-priority-2026-08-15.md`. En corto:
cuatro golds quedaron como estaban —B llegó solo al criterio escrito en cuanto
lo conversó, así que la sección se reescribió como **tres preguntas en orden**,
la medicina del árbol de `type`—; dos cambiaron con regla nueva (`MX#4689`
high→medium: riesgo verificado y no confirmado baja un nivel; `MX#4053`
low→medium: recurrente con evidencia que caduca); y `MX#3441` fijó la decisión
de producto: **el enfado no sube la prioridad, va en la bandera `enfado`**. Los
`high` quedan en 19 (mínimo de la prueba: 15), todo regenerado y la suite en
verde. **Y la tercera ronda se APLAZÓ por decisión de David** — el programa
lleva demasiado en validaciones de muestra—, así que `priority` queda
**corregido sin validar**: el kappa vigente sigue siendo 0,47 y el criterio
«recall de `high` ≥95%» sigue sin ser evaluable. El plan si se retoma (muestra
fresca de Colombia estratificada a candidatos `high`, kappa completo + binario
high/no-high) está escrito en el registro.

**Y la PRD se consolidó en el repo esa misma noche:**
`docs/prd/ia/PRD-VAI-FEAT-002-asistente-pqrs.md` — desde ahí es la fuente de
verdad; la copia de Drive queda como lectura. Trae la **decisión rectora de
David**: el recall de `high` ≥95% se cobra en la puerta de escala (G7), no en
la de lanzamiento — el piloto se protege con revisión humana total, no con una
métrica que hoy no es evaluable. G0–G3 superadas. Fases renumeradas: ~~**F2
evaluación offline contra el gold set (el siguiente paso ejecutable**, cuesta
centavos; prerrequisito: declarar casos `buzon_simple`)~~ **— F2 HECHA esa
misma noche; G4 y G5 superadas: ver la sección de arriba —**, F3 piloto
simulado en staging con tickets sembrados desde los corpus (**sin
prerrequisitos: el desplegable se corrigió el 15 de agosto**; si la sesión usa
al tercer administrador, ANTES se le toma la línea base de comunicaciones a
ciegas), F4
sombra en producción + piloto visible por bandera (la sombra fabrica los
150–250 tickets etiquetados que piden el Paso 3 y la Fase 5), F5 escala. El
tenant piloto se decide después de staging.

**Y lo que apareció mirando el producto vale más que el kappa:**

1. **`type` no decide nada, y ya no es pregunta: David lo confirmó el 15 de
   agosto** («van al mismo lado» — un reclamo y una petición reciben el mismo
   tratamiento). En el código tampoco: solo pinta la etiqueta y llena el filtro
   de `/admin/pqrs`. **Consecuencia: el 0,53 de `type` no bloquea nada.** El eje
   queda como etiqueta descriptiva con definiciones corregidas sin validar, y
   no se le dedica una tercera ronda. `priority` es distinto: declarado en
   `domain.ts`, usado en cero pantallas, pero la PRD le exige revisión humana
   en los `high` — **ahí va el esfuerzo de definiciones.** *(Hecho la noche del
   15 — ver el párrafo de la vuelta de definiciones, arriba.)*
2. ~~**DEFECTO VIVO EN PRODUCCIÓN:** el desplegable del residente enseña las
   **definiciones cruzadas** y no ofrece `other`.~~ **CORREGIDO el 15 de agosto
   de 2026** — ver la sección de arriba. Era mayor de lo que decía este punto:
   las descripciones **no se renderizaban**.
3. **La consecuencia de producto del kappa de `priority`:** el criterio «recall
   de `high` ≥95%» no es evaluable mientras dos personas no coincidan en qué es
   `high`. Y en los dos casos con hilo previo de la ronda 1, David etiquetó la
   conversación en vez del mensaje — si le pasa a un humano, le pasará al modelo
   con `responseHistory`: el prompt deberá separar «el ticket» de «el historial».
3. **`billing` tiene 15 casos y `buzon_simple` ninguno.** El primero no se
   arreglaba con los corpus de México y Ecuador —en Ecuador las cuotas son el
   1,3%—, pero **el 15 de agosto por la tarde llegó el tercer corpus:
   `datasets/chat-vecinal-colombia/`, 2.984 mensajes de un conjunto de Bogotá**,
   ya anonimizado con `scripts/anonimizar-chat-colombia.mjs` (llegó descrito
   como «datos limpios» y traía la dirección exacta del edificio — el README
   del corpus cuenta qué sobrevivía y qué se hizo). **Su `analisis.md` ya
   respondió lo de las cuotas: 1,7% — Colombia se parece a Ecuador y México es
   el atípico, así que `billing` NO crece por proporción; pero hay 46
   candidatos (~35–40 limpios) si se decide crecerlo por muestreo dirigido.**
   Los once temas aguantan el tercer país sin categorías nuevas; el tamiz ganó
   «celador», las grafías de sistema colombianas y el marcador `<adjunto:`,
   con México y Ecuador idénticos al dígito tras cada cambio.
   `buzon_simple` sigue siendo declarar la variante en unos cuantos casos.
4. **El baseline de G1 sigue TBD** en la propia PRD: volumen de tickets, tiempo
   de primera respuesta, reclasificaciones. No lo da ningún corpus, y producción
   tiene **cero tickets**.

## Todo el lote está en producción, verificado contra el ambiente (15 ago 2026)

**`master` quedó en `512ba38`: 75 commits promocionados**, los primeros desde el
8 de agosto. El orden fue el seguro —reglas → índices → functions → front— y
cada paso se comprobó contra el ambiente, no contra el «Deploy complete!»:

- **Reglas:** antes de desplegar se bajó el ruleset vivo y era idéntico a
  `master` byte a byte — nadie había tocado la consola. Las nuevas (849 líneas)
  quedaron idénticas a `develop`, comprobado igual.
- **Índices:** 50, los dos nuevos de `aiUsage` en `READY`.
- **Functions: 64** (eran 60). `aiInvoke`, `registrarFeedbackIa`,
  `registrarImportacion` y `getAiUsage` nacieron **con** `allUsers →
  run.invoker` — la trampa no mordió, comprobado servicio por servicio.
  `onCommunicationCreated` ya lee `notificationSummary`, y el cron de retención
  purga la telemetría de IA vencida.
- **Front:** `vivaru-build-2026-08-15-001` sirviendo; landing 200 en la raíz.
  El rollout lo dispara la conexión de App Hosting con el repo al empujar
  `master` — tarda unos diez minutos, verificado mirando la revisión de Cloud
  Run, no el reloj.

**La IA está desplegada e INERTE:** `featureFlags` y `featureFlagOverrides`
están **vacías** en producción, así que todo resuelve por el default del
catálogo — las de IA apagadas. Y eso corrigió un pendiente viejo: **sembrar el
catálogo ya no hace falta.** La consola `/superadmin/flags` se pinta desde el
código y escribe el documento al primer toque; la colección vacía es un estado
completo, no un hueco.

**Lo único que un administrador ve distinto:** el importador con paso de mapeo.
Va detrás de una bandera nueva, `producto-importacion-masiva`, que **nace
encendida** porque los asistentes ya estaban vivos —una bandera apagada por
defecto los habría retirado—. Apagarla oculta la carga masiva entera, y el corte
cubre las tres entradas: botones, recorrido guiado (`?guia=`) y los modales.
Test propio en `tests/import-feature-flag.test.ts`, mutado para comprobar que
atrapa.

**Tres cosas que aparecieron por el camino:**

- **La `RESEND_API_KEY` del backend de App Hosting está en texto plano** en su
  `overrideEnv` — visible con una llamada a la API para cualquiera con lectura
  sobre el proyecto — y además quedó impresa en la sesión del 15 de agosto.
  **Rotarla**, y al rotarla guardarla como secreto referenciado, no como
  variable en claro. **HECHO el mismo 15 de agosto** — el cierre completo, con
  sus dos hallazgos, en la sección de Seguridad.
- **El gate de CI falla por tres causas y el job de deploy nunca corre.** Los
  40 errores de typecheck viven en `tests/`; `npm test` usa un glob (`tests/**`)
  que el `sh` de npm no expande — corre **cero tests y sale en 1**, por eso el
  gate está rojo hasta con la suite en verde—; y hay errores de lint
  preexistentes (4 en `UnitBulkImportWizard` vienen de `master`). Como
  `deploy-production` depende del gate, nunca ha corrido: el despliegue real lo
  hace App Hosting por su cuenta. Y si algún día se arregla el workflow, ojo:
  `firebase.json` declara `backendId: "hogaru-web"`, **que no existe** — el
  backend de producción se llama `vivaru`.
- **El CLI de Firebase (15.4.0) puede inventarse un «Changing from an HTTPS
  function to a background triggered function»** al desplegar
  `onCommunicationCreated` en lote con otras cinco. El ambiente decía lo
  contrario (`GEN_2`, trigger de Firestore, verificado con `gcloud`). Sola, se
  desplegó sin queja. Si reaparece: desplegarla aparte antes de creerle al
  error.

## Segunda sesión con administrador: el canario acertó, y la línea base volvió a quedarse sin tomar (14 ago 2026)

**Se hizo la sesión** sobre `tenant-palmas-cdmx`, con el modelo real y el
contexto desplegado. Dos avisos, cuatro llamadas, **USD 0,00262**, cero fallos.
Lectura completa en
`datasets/evaluacion/resultados/2026-08-14-sesion-administrador-2.md`.

**H2′ SIGUE SIN MEDIR, y van tres sesiones.** Los dos avisos escritos a mano no
se hicieron —las filas están borradas de la hoja, y el conjunto solo tiene los
dos comunicados asistidos—. Sin la mitad de a mano no hay comparación, y esta
persona ya no sirve para tomarla porque ya vio la herramienta. **Hace falta un
tercer administrador, y para la línea base bastan veinte minutos.**

**El hallazgo que sí vale, y contradice la lectura optimista del 13 de agosto:**
descartó **2 de 2** preguntas de dato faltante y contestó **0**
—`respondidos: []`—. El 13 eso se leyó como fallo de pantalla y se arregló; con
la pantalla arreglada, el siguiente administrador hizo lo mismo. **Ya no se
explica con la pantalla.** Y en los dos avisos el dato que falta es exactamente
el que el modelo señaló y él descartó: el modelo acertó las dos veces.

**Segundo patrón, igual de incómodo: edición 0% otra vez —dos administradores
seguidos— pero pidió dos propuestas por aviso.** La palanca que usan es
**regenerar, no corregir**, y el producto está construido para que corrijan.

**Lo que esto abre para el Paso 2.7:** si dos administradores de dos conjuntos
distintos descartan el 100% de las preguntas y editan el 0% del texto, «la lista
de lo que falta es el producto» —escrito el 12 de agosto— lleva dos sesiones sin
usarse. Es decisión de producto, no ajuste de prompt. **No tocar el contrato con
esta evidencia:** dos sesiones no son una muestra.

**El contexto del conjunto quedó comprobado fuera del banco:** las cuatro
llamadas en `operationVersion 3` y **ni una «torre», «bloque» o «manzana»** en
los dos textos publicados. Con su límite dicho: el contenido de los borradores no
se guarda, así que se comprueba sobre lo publicado, no sobre los cuatro
borradores.

## El canario está desplegado en staging y esperando a la persona (14 ago 2026)

**Desplegadas `aiInvoke` y `registrarFeedbackIa`** en `vivaru-staging-02`, a las
12:25 hora de México. Solo esas dos: el cambio del contexto vive entero en
`functions/src/ai/`, y un despliegue completo habría mezclado sesenta funciones
que nadie revisó hoy con la única que cambió. ~~**Producción sigue sin
nada.**~~ **En producción desde el 15 de agosto de 2026** — ver la sección de
arriba.

**Lo que NO hizo falta tocar, comprobado y no supuesto** —los documentos decían
que faltaba y era mentira—: las reglas desplegadas son **idénticas** a
`firestore.rules` byte a byte, los **50 índices** declarados están desplegados y
en `READY`, las **9 banderas** del catálogo están sembradas, y `aiInvoke` y
`registrarFeedbackIa` ya tenían `allUsers → roles/run.invoker` en Cloud Run. La
trampa de la callable nueva sin permiso **no aplicaba**, porque no se creó
ninguna callable nueva; y el permiso sobrevivió al despliegue, verificado
después.

**Banderas en staging, ahora mismo:** `_global.killSwitch` en `false`,
`ai-gateway` y `ai-communications-draft` **encendidas globalmente**, y
`ia-proveedor-real` **apagada**. No hay ni un override por conjunto y no hace
falta ninguno. **El día de la sesión es un solo interruptor:** encender
`ia-proveedor-real` en `/superadmin/flags`. Se dejó apagada a propósito — el
canario funciona entero con el simulador y así nada gasta dinero esperando.

**El conjunto del piloto está sembrado y vacío de avisos.**
`tenant-palmas-cdmx` («Privada Las Palmas», 24 unidades, 6 personas) es el único
sembrador que produce un **edificio único**, que es el caso donde se ve el
cambio del contexto. Verificado contra los datos reales con
`resolverContextoConjunto`: da `{tieneAgrupaciones: false}`, y
`conjunto-las-playas` —el de la sesión del 13— da `true`. Sus tres avisos
sembrados se borraron con `functions/scripts/vaciar-avisos-sembrados.mjs`, para
que la línea base se pueda tomar a ciegas: tres avisos bien redactados en
pantalla le enseñan el formato igual que se lo explicaría yo. Cuenta de
administrador: `admin@privadapalmas.mx`, clave en el seed.

**Dos comprobaciones más, para no fiarse del «Deploy complete!»:** la prueba de
humo del proveedor real **desde staging** respondió en 5,2 s por **USD
0,000338** con el contrato válido, y la suite de emulador —31 casos, la que la
suite normal no corre— pasa entera, incluida la que sigue el contexto desde las
unidades de Firestore hasta el mensaje del modelo.

~~**Lo único que falta es la persona.**~~ **La sesión se corrió el mismo 14 de
agosto** — ver la sección de arriba. `ia-proveedor-real` se encendió con un
override para el conjunto del piloto y **David lo retiró desde
`/superadmin/flags` a las 16:29**, en cuanto terminó. Staging vuelve a estar
entero en simulador (`valor_global`), con el panel «Redactar con IA» encendido.
**Para la tercera sesión hay que volver a encenderlo**, y ahí está el interruptor
que se olvida.

Queda un `featureFlagOverrides/tenant-palmas-cdmx` con el mapa de banderas vacío.
Es el rastro normal de «Quitar override» —distinto de «Invertir», que dejaría un
`false` explícito y pintaría el conjunto como apartado a propósito— y **no hay
que limpiarlo**.

**Una trampa nueva, que casi cuesta cara:** `seed-tenant.mjs` apunta a
**producción por defecto** (`FIREBASE_PROJECT_ID || "hogaru-1"`). Olvidar la
variable siembra en `hogaru-1`. Siempre
`FIREBASE_PROJECT_ID=vivaru-staging-02 node functions/scripts/seed-tenant.mjs …`.

## La volumetría real de producción, por primera vez sin inflar (14 ago 2026)

**Se arregló el instrumento y el número quedó desnudo.** Los seeds de demo no
marcaban nada, así que toda métrica de producción salía inflada. Ahora el
marcador va en el CONJUNTO —una línea, en vez de recordarlo en 28 colecciones— y
`audit-volumen-ia.mjs` descuenta por los dos caminos: por documento (para los
trials, que son conjuntos reales con filas de ejemplo dentro) y por conjunto.

Marcados 7 de los 9 conjuntos de producción: los cuatro sembrados por script y
tres internos que confirmó David —la prueba E2E, el de Qintilab y
`pXHEn5iWKWgX` (suspendido, y era el que aportaba la única comunicación «real»
que se contaba)—. La lista vive en
`functions/scripts/marcar-conjuntos-de-ejemplo.mjs`, con el origen de cada uno.

**Quedan dos conjuntos reales, y esto es todo lo que hay:**

| | Conjunto Bromelias (activo — **NO es cliente**, confirmado 24 ago 2026) | Queretarock 229 (trial) |
|---|---|---|
| Unidades propias | 1 | **0** (6 sembradas por el trial) |
| Personas propias | 1 | **0** (6 sembradas) |
| Cobros propios | 0 | **0** (24 sembrados) |
| Tickets | 0 | 0 |
| Comprobantes | 0 | 0 |
| Comunicaciones | 1 (16 mar 2026) | 0 |

**Queretarock nunca cargó datos suyos**: todo lo que tiene se lo puso el trial.
Y en los últimos 30 días no hay ni un ticket, ni un comprobante, ni una
comunicación en toda la plataforma.

Las cifras que este documento y la hoja de ruta traían —26 comunicaciones, 20
tickets, 5 comprobantes— eran los conjuntos de demo contándose como reales. El
muro del programa de IA no se movió: **se hizo más alto de lo que se creía.**

## El contexto del conjunto, construido y medido (14 ago 2026)

**El borrador ya no pregunta por torres donde no hay torres.** La operación
recibe del servidor si el conjunto tiene agrupaciones, sacado de `units.tower`, y
subió a **v3**. El cliente no cambió una línea.

Medido con tres corridas reales, 204 llamadas, **USD 0,065**: la palabra «torre»
pasa de aparecer en 24 preguntas a **cero**; el modelo **no aprendió a callarse**
—2,09 → 2,14 preguntas por caso—; y donde sí hay torres el número no se movió
(87% antes, 87% después). Se confirmó además la sospecha del 13 de agosto: sin
contexto, en un aviso de cobro el modelo gastaba sus preguntas en las torres y
**no preguntaba el monto**.

En los ocho casos escritos para un edificio único, de **3 de 8 a 7 u 8 de 8**.

**Decidido el 14 de agosto:** en un edificio de once pisos, «¿afecta a todo el
edificio o a pisos específicos?» **sí** es una pregunta útil. Tres casos fallaban
por una afirmación mía que prohibía *cualquier* pregunta de alcance, cuando la
decisión que implementaba decía lo contrario. Ahora se prohíbe la **palabra**
—torre, bloque, manzana—, no la categoría. Se recalificó sobre los borradores ya
guardados con `functions/scripts/recalificar.mjs`, sin volver a llamar al modelo.
Lectura completa en
`datasets/evaluacion/resultados/2026-08-14-contexto-conjunto.md`.

~~**Lo siguiente, y es tuyo:** nada está desplegado.~~ **DESPLEGADO en staging
el 14 de agosto de 2026** — ver la sección de arriba. ~~**Sigue sin haber nada
en producción.**~~ **En producción desde el 15 de agosto de 2026, con las
banderas de IA apagadas.**

## El canario, tras la primera sesión con un administrador (13 ago 2026)

**Se hizo la sesión.** Un administrador real escribió cuatro avisos con la
herramienta, en staging y con el modelo de verdad. Costó **USD 0,003** y **guardó
dos avisos sin cambiar una palabra** —edición 0%—. A la pregunta de si pedirle
datos era útil o pesado contestó **«útil»**, que era el riesgo de diseño que más
preocupaba.

**Cuatro decisiones de producto quedaron cerradas por él:** no pedir el motivo,
las inferencias las firma, el resumen de la app es lo que debería llegarle al
residente, y los cuatro datos son los correctos.

**Lo que salió y ya está corregido:**

- **No sabía dónde contestar las preguntas** de qué faltaba, y usó «No aplica»
  para salir del paso — contaminando la métrica desde su primer uso. Ahora cada
  pregunta tiene su campo debajo, y **contestar se cuenta aparte de descartar**.
- **El modelo alteró un dato en un aviso de dinero**: él escribió «2500 por
  residente» y el borrador publicó «por unidad», reproducido 3 de 3. De ahí
  salieron **dos reglas duras** y una tercera clase de fallo en el evaluador
  (`ALTERADO`). v2-estructura pasó de **80% a 87%**, cuatro casos arreglados y
  ninguno roto.
- **`notificationSummary` ya llega al residente.** Antes la notificación decía
  la misma frase genérica para todos los comunicados.

**Lo que la sesión NO midió, y hay que decirlo:** **H2′ sigue sin medir.** Los
dos avisos escritos a mano —la línea base— no se hicieron, y **con este
administrador ya no se pueden tomar**: al final se le enseñaron los cuatro
datos. Lectura completa en
`datasets/evaluacion/resultados/2026-08-13-sesion-administrador.md`.

**Y hay un segundo corpus.** `datasets/chat-vecinal-ecuador/` — un edificio de
Quito, seis años y nueve meses. Contesta la limitación que arrastraban los tres
documentos del canario: **los cuatro datos generalizan** (1,13 de 4 en Ecuador
contra 1,31 en México, cifras corregidas el 14 de agosto al arreglar dos
detectores del tamiz) y **«cuánto dura» es el peor dato en los dos países**, que
es lo que sostiene la decisión más visible de la pantalla. De paso reinterpreta
la mitad de los fallos que le quedan al modelo: pedir «a quién afecta» donde no
aplica no es defecto del modelo, es del diseño — el conjunto mexicano tiene
torres y el ecuatoriano no. Detalle en su `analisis.md`.

## El canario está construido y probado con manos humanas (12 ago 2026)

**El Paso 2.5 está cerrado.** Existe una pantalla: el panel «Redactar con IA»
dentro del formulario de crear comunicado, plegado detrás de un botón, con la
lista de lo que falta ordenada y el feedback registrándose. Detalle completo en
el registro de ejecución de `docs/hoja-de-ruta-ia.md`.

**Probado en staging con el modelo real el 12 de agosto:** 4 llamadas, 3.805
tokens, **USD 0,0018**. El borrador salió correcto y David lo aplicó. La
bandera `ia-proveedor-real` quedó **apagada** al terminar.

**Lo que bloquea el piloto (Paso 2.6), en orden:**

1. ~~**Nada de esto está en producción.** Reglas, índices, functions y banderas
   viven solo en `vivaru-staging-02`. Los administradores reales están en
   `hogaru-1`.~~ **RESUELTO el 15 de agosto de 2026:** todo está en producción,
   con las banderas de IA apagadas. Encender el canario para un conjunto real
   ya no exige desplegar nada — es la consola de banderas.
2. ~~**A quién se le entrega el piloto.**~~ **DECIDIDO el 12 de agosto de 2026:
   al administrador, hipótesis H2′.** Es para quien se está comercializando
   Vivaru. **No exige tocar código**: el catálogo ya autoriza solo a
   `tenant_admin` y `admin_tenant`. **H3 queda aparcada, no descartada** —para
   una administradora con varios conjuntos, «que cualquiera escriba como un
   profesional» es consistencia de cartera, y el rol `committee` ya existe, así
   que habilitarlo sería una línea.
3. **Conseguir al administrador.** El guion de la sesión está escrito y listo
   para ejecutar: `docs/guion-piloto-comunicaciones.md`. Falta la persona.

**Por qué el piloto es una sesión y no una bandera encendida:** producción tiene
**una sola comunicación real en toda su historia**, del 16 de marzo de 2026
(medido el 14 de agosto, ya sin conjuntos de demo contándose). No es rechazo del
módulo: **Vivaru todavía no se comercializa para ese uso.** Esperar tráfico
orgánico es esperar sentado.

*(La duda quedó resuelta el 14 de agosto: ni una cosa ni la otra. Las 26 eran
los cuatro conjuntos de demo contándose como reales. **No entraron clientes.**
Con el marcador puesto, las comunicaciones reales de toda la historia de
producción son **1**.)*

**Decisiones de producto abiertas, las tres pequeñas:**

- ¿El borrador debe pedir el motivo? Hoy no lo pide **nunca** y tampoco se lo
  inventa nunca — comprobado en cinco corridas.
- Las dos inferencias que aparecieron en la primera prueba real: escribió «por
  24 horas» (aritmética sobre 7am–7am) y «recomendamos almacenar agua»
  (deducido de que no hay pipas). La segunda la pide el conjunto de evaluación
  a propósito; la primera no la pidió nadie.
- ~~**`notificationSummary` se genera y se tira.**~~ **RESUELTO el 13 de agosto
  de 2026**, después de que el administrador confirmara que ese resumen es lo
  que debería llegarle al residente. Campo opcional en el formulario; cuando
  falta, la notificación cae a la frase de siempre.

**Deuda menor, sin prisa:**

- **`qualityFlags` sigue sin cerrar, y no es olvido:** la lista de cinco
  valores de la PRD no tiene dónde meter «hechos contradictorios» ni
  «instrucción incrustada», que son 2 de los 5 problemas que el conjunto
  comprueba hoy. Cerrarlo exige inventar dos valores y reescribir cinco
  afirmaciones — su propio incremento, con su propia corrida.
- Leer a mano los 3 casos de `requiereJuicioHumano`.
- El campo `length` y el tono `formal` de la PRD, **aplazados a propósito**:
  ninguno de los 59 casos los cubre.
- **Revisar en el piloto el costo del contrato v2.** Categorizar lo que falta
  hizo que el modelo pregunte menos (de 2,32 a 1,93 datos por borrador). Se
  aceptó con los números delante; la salida, si molesta, es hacer `categoria`
  opcional. Lectura completa en
  `datasets/evaluacion/resultados/2026-08-12-contrato-v2.md`.

## Dos trampas de infraestructura que costaron una tarde (12 ago 2026)

Las dos estaban ahí desde antes y no las provocó el trabajo de IA. Se
documentan porque **el mensaje de error no dice cuál es la causa** y volver a
diagnosticarlas cuesta lo mismo la segunda vez.

- **`npm error Invalid Version:` en Cloud Build, sin decir qué paquete.** Era
  una entrada fantasma en `functions/package-lock.json`
  —`lightningcss-darwin-x64` sin `version` ni `resolved`—, que viene de
  `vitest → vite → lightningcss`. En macOS no salta nunca; en Linux tumba
  **todos** los despliegues de functions. Reparada con los datos reales del
  registro. **Su origen sigue vivo:** la caché de npm de la máquina de David
  tiene archivos que su usuario no puede escribir (`EACCES` en
  `~/.npm/_cacache`), npm no pudo cachear el paquete y dejó el hueco. Al
  regenerar el lockfile desde esa máquina, la entrada rota vuelve. **RESUELTO el
  13 de agosto de 2026**: se corrigió el permiso de la caché y se comprobó
  regenerando el lockfile en una copia — ya no reaparece la entrada rota.
- **Las funciones nuevas nacen sin permiso de invocación.** *(Matiz del 14 de
  agosto de 2026: la callable nueva `registrarImportacion` **sí** nació con
  `allUsers` en staging. Así que el fallo no es universal —depende de la versión
  de la CLI o de la política del proyecto— pero **comprobarlo sigue siendo
  obligatorio**: cuesta diez segundos y el síntoma cuando falta es un «error
  interno» sin ninguna pista.)* `aiInvoke` y
  `registrarFeedbackIa` se crearon sin `allUsers` / `roles/run.invoker` en
  Cloud Run, que es lo que tienen las otras sesenta callables. Sin él la
  petición muere antes de tocar el código y el navegador ve «error interno».
  Se arregla con `gcloud run services add-iam-policy-binding`. **Comprobarlo
  cada vez que se despliegue una callable nueva.**

## Lo que se cerró y no hay que rehacer

- **El SEO técnico se promocionó.** Llevaba un mes parado en `develop`.
  Producción sirve el landing en la raíz, `/mx` redirige con 308, y hay canónica
  por página, sitemap, `llms.txt` válido y JSON-LD.
- **Auditoría AEO: 44/100 (D) → 67/100 (C+)**, fundamentos de 34 a 76. El antes,
  el después y **por qué no se persiguen los cuatro fallos restantes** están en
  `docs/auditoria-aeo-base-ago2026.md`. Ojo con `image-alt`: es un falso positivo
  del auditor sobre un patrón de accesibilidad correcto. **No lo «arregles».**
- **Los Términos publicaban `[X días]`, `[Y días]` y `[Z días]`** en la cláusula
  de mora, y el Anexo un placeholder del DPA de Google. Rellenados: 10/15/30.
- **El copy dejó de hablar colombiano y dejó de nombrar países.** Vocabulario y
  reglas en `docs/glosario-mercados.md`; qué cadena cambió y por qué, en
  `docs/propuesta-copy-neutro.md`.
- **Los correos de demo y de lead apuntaban al apex**, que devuelve 404. Cada
  prospecto que pulsaba «Agenda una demo» desde el correo caía en una página
  rota. Corregidos al `www`.

## Decisiones cerradas, no reabrir sin que las pidan

- **Panamá NO se anuncia.** Coincide con la precedencia técnica: el país fiscal
  es `z.enum(["EC","CO","MX"])`, así que un conjunto panameño no se puede dar de
  alta. Anotado en `PAISES` de `src/lib/marketing/sitio.ts`.
- **Copy en español neutro.** La geografía sale de la prosa; los países viven
  SOLO en `PAISES`. **Abrir un mercado es editar esa línea.**
- **Primero se diferencia el contenido, después se parten las URL.** El día que
  el copy de un país sea distinto, su ruta se justifica sola. Antes no.

## Frente de IA — congelado por falta de datos, no por gobierno

- **Medido el 8 de agosto: producción tiene 0 tickets reales, 0 comprobantes y
  2 comunicaciones** en toda su historia. Todo lo demás que se cuenta pertenece
  a los tenants sembrados. **No falta owner, ni presupuesto, ni proveedor:
  falta operación.** No tiene sentido cotizar ni nombrar a nadie para evaluar
  capacidades sobre procesos que se ejecutan cero veces al mes. Para reabrir
  basta volver a correr `functions/scripts/audit-volumen-ia.mjs <projectId>`
  —solo lectura— y mirar si la columna «Real» se movió; los gold sets piden
  150–250 tickets y 100–200 comprobantes. Medición y lectura completa en
  `docs/auditoria-prd-ia-ago2026.md`.
- **La hoja de ruta para habilitarlo está escrita**, con el orden confirmado
  —Plataforma → Comunicaciones → PQRS → Onboarding → Comprobantes—, la lógica
  explicada para primer proyecto de IA y el reparto de quién hace qué:
  `docs/hoja-de-ruta-ia.md`. **El canario sí es ejecutable hoy**: comunicaciones
  es la única capacidad cuya entrada la escribe el administrador, no la base de
  datos, así que su conjunto de evaluación se construye y el muro de datos no la
  toca. El muro aparece en el paso 3, PQRS.
- **Lo que hay que empezar a acumular ya**, aunque la IA no exista: tiempos de
  redacción a mano, clasificación en sombra de cada ticket, el archivo de
  importación de cada conjunto nuevo, y comprobantes anonimizados. Es la
  diferencia entre que cada paso tarde una semana o tres meses. Tabla en la
  Parte IV de la hoja de ruta.
- **Las cinco PRD de IA están cotejadas contra el código y son sólidas.** No hay
  que rehacerlas: todo lo que declaran como baseline existe con el nombre
  exacto. Quedan válidas y en espera. Los cuatro hallazgos que mueven el plan y
  la corrección de las puertas G0–G7 —que el documento de transferencia numera
  mal— están en el mismo documento.
- **`FEAT-001` no necesita IA para su primera mitad.** Su Fase 2 es «parser,
  reglas y preview sin IA» sobre `papaparse` y `xlsx`, que ya están instalados.
  Sacarla del programa de IA y tratarla como producto normal genera el baseline
  de activación que la propia PRD necesita para cerrar G1. **Es el único
  hallazgo que cambia el orden del programa.**
- **~~Las cinco dependen de un feature flag que no tiene lector.~~ RESUELTO
  (9 ago 2026, Paso 1.1).** Las banderas tienen lector real en cliente y
  servidor, kill switch por bandera y maestro, overrides por conjunto aislados
  en `featureFlagOverrides`, y consola en `/superadmin/flags`. Se construyó
  genérico: no es una pieza del programa de IA, sirve para cualquier capacidad
  que deba poder apagarse sin desplegar. Detalle en el registro de ejecución de
  `docs/hoja-de-ruta-ia.md`. ~~**Queda por hacer en consola:** sembrar el
  catálogo (`node functions/scripts/seed-feature-flags.mjs <projectId>`) y
  desplegar reglas en cada ambiente.~~ **Ya no (15 ago 2026):** las reglas
  están desplegadas en los dos ambientes, y sembrar no hace falta — la consola
  se pinta desde el catálogo del código y escribe el documento al primer toque.
- **Ecuador no está en ningún dataset de evaluación** de `DOC-001` ni
  `FEAT-001`: piden Colombia y México, y Ecuador está en `PAISES`. Mismo punto
  ciego que `docs/brief-legal-ecuador.md`, pero aquí aprobaría una capacidad
  que falla con el primer conjunto ecuatoriano — opera en USD.
- **La wiki de negocio canónica es `Hogaru/Vivaru business - WIKI/`** (90
  archivos). `Hogaru/vivaru-wiki-negocio/` (32) es un subconjunto viejo; no
  citarla.
- **No se tocó ninguna fuente.** Drive, wikis y los dos Markdown de Hogaru
  quedaron como estaban.

## Necesita asesoría legal, no redacción

- **Ecuador no está cubierto.** Los tres documentos legales citan Colombia y
  México; Ecuador está en `PAISES` y en el `areaServed` y no aparece en ninguno.
  El brief, con el hueco localizado cláusula por cláusula, en
  `docs/brief-legal-ecuador.md`. **No hay ningún conjunto ecuatoriano firmado**,
  así que es riesgo medio y no urgente — pero el disparador es observable: el
  registro del trial guarda `pais` en el lead y en el tenant.

- **El SLA de PQRS son 15 días hábiles colombianos, aplicados a los tres
  países** (encontrado el 15 de agosto de 2026 preparando el gold set de PQRS,
  no buscándolo). `src/features/pqrs/sla.ts` hace
  `addBusinessDays(radication, 15)` sin distinguir país ni conjunto. Quince días
  hábiles es el plazo del **derecho de petición colombiano ante entidades
  públicas** (Ley 1755 de 2015). Una copropiedad es privada, así que ni siquiera
  en Colombia se sigue solo; en México y Ecuador no rige.

  **Está vivo y es el default, comprobado los dos extremos:** lo consume
  `src/app/(admin)/admin/pqrs/page.tsx:118`, y `con_sla` es el valor por defecto
  de la variante en `src/lib/config/module-variants.ts:37`. Es decir, **todo
  conjunto nuevo nace con el semáforo encendido**, y a un administrador mexicano
  le pinta el ticket en rojo por una norma que no lo rige.

  Es el mismo patrón que el copy colombiano en la página de México y que Ecuador
  ausente de los datasets: **una decisión de un país aplicada a los tres sin
  decirlo.** Y tiene una ironía que conviene ver: `PRD-VAI-FEAT-002` prohíbe
  expresamente que la IA «calcule obligaciones legales» y saca de alcance el
  «cálculo jurídico de términos» — el riesgo está vigilado del lado de la IA y
  ya existe del lado de las reglas.

  **No se ha tocado nada.** Las salidas son decisión de producto, no de
  ingeniería: dejarlo con su origen documentado, hacerlo configurable por
  conjunto, o llamarlo «meta de servicio» y no plazo legal. Entra en el mismo
  repaso legal que el hueco de Ecuador.

## Necesitan consola, no código

- **Presupuesto del proyecto completo, con SOLO ALERTAS.** El de IA ya está
  puesto (80.000 COP, con límite de inversión sobre Vertex AI). Falta el del
  proyecto entero, que es la red que atrapa lo que no viene de la IA. **Nunca
  con «Aplicación del límite de inversión»**: suspender los servicios del
  proyecto tumbaría Firestore, Auth y App Hosting. El importe sale de
  Facturación → Informes, **en pesos** — la cuenta `01E210-7D2C3B-4EB5BE` está
  en COP, no en USD, y ese detalle ya casi cuesta un incidente.

- **App Check está dormido de punta a punta** (verificado el 9 ago 2026, no es
  lo que decía la auditoría). El cliente ya llama a `setupAppCheck()` desde el
  Paso 1.2, pero sin clave no hace nada. Tres cosas, en orden:
  1. Crear una clave de **reCAPTCHA Enterprise** en Google Cloud.
  2. Registrar la app en **Firebase Console → App Check** con esa clave.
  3. Poner `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY` en `apphosting.yaml` (y en
     `apphosting.staging.yaml`) y desplegar.

  Y solo después, mirando en los logs de `aiInvoke` que el tráfico legítimo trae
  token, apagar la bandera `operacion-app-check-monitor` en `/superadmin/flags`.
  **Apagarla antes cierra la puerta para todos.** Mientras tanto no hay riesgo:
  detrás de la puerta no hay nada que cueste dinero todavía.

- **El apex `grupovivaru.com` devuelve 404.** El registro A es correcto
  (`35.219.200.1`, el mismo que el `www`); falla solo la verificación de
  propiedad porque el TXT tiene un token viejo. **Estos dos valores no están
  escritos en ningún otro sitio:**

  ```
  quitar:  fah-claim=002-02-30634e11-5bdb-4497-8f2b-bfbac3583c19
  añadir:  fah-claim=002-02-d6e6e2d2-f549-4bd2-b2fe-e34695e9f910
  ```

  No tocar el registro A. **No borrar y volver a añadir el dominio en App
  Hosting:** cada alta genera un token nuevo y reproduce el fallo.

  Dato nuevo del 8-ago: los nameservers son `ns-cloud-d1..d4.googledomains.com`,
  o sea que **la zona vive en Google Cloud DNS**, no en un registrador.
  Reconfirmado que no es visible desde `dev@qintilab.com`. **Y la misma cuenta
  Owner que hace falta aquí es la que lleva meses bloqueando la URL de acción de
  Firebase Auth: dos pendientes de largo plazo, un solo inicio de sesión.**
  Conviene pedir `roles/dns.admin` sobre ese proyecto en vez de un arreglo
  puntual. Estado consultable con
  `GET firebaseapphosting.googleapis.com/v1beta/…/backends/vivaru/domains`.

- **Dimensiones personalizadas de GA4** sin registrar: `entorno`, `section` y
  `cta`. Se recogen pero no son consultables, y GA4 no rellena hacia atrás.
  Topología de propiedades y cuentas en la memoria `analitica-ga4-vivaru`.

- **URL de acción de Firebase Auth** — pendiente desde antes, requiere la cuenta
  Owner. Ver `CLAUDE.md`, sección de estado actual.

## Seguridad

- ~~**Rotar la `RESEND_API_KEY` del backend de App Hosting de producción.**~~
  **ROTADA el 15 de agosto de 2026, de punta a punta:** clave nueva (versión 6
  del secreto), las 25 functions redesplegadas apuntando a ella, la variable en
  claro borrada de la consola, `apphosting.yaml` de `master` la referencia como
  `secret:`, la clave vieja revocada en Resend y las versiones 1–5 del secreto
  deshabilitadas. Verificado con un envío real: `[demo/email-notif-ok]` y
  `[demo/email-confirm-ok]` en los logs de la revisión `-003`.

  Dos cosas que dejó la rotación:

  - **Trampa nueva:** borrar una variable en la consola de App Hosting dispara
    su PROPIO rollout. El 15 de agosto ese rollout corrió en paralelo con el del
    push y hubo una ventana de ~5 minutos (revisión `-002`) sirviendo **sin
    clave ninguna** — dos formularios de prueba cayeron ahí y sus correos no
    salieron (los leads sí se guardaron: el envío es best-effort a propósito).
    Si se repite el patrón consola+push, esperar a que el tráfico esté en la
    revisión buena antes de verificar.
  - **Secreto huérfano:** existe un segundo secreto `resend-api-key` (en
    minúsculas, del 1 de junio) que no referencia nadie — ni funciones ni
    backend. Confirmar que nadie lo usa y borrarlo: un secreto sin dueño es una
    credencial que nadie rota.
- **Rotar cinco credenciales de producción** pegadas en el chat el 8 de agosto
  (admin, portería y tres residentes del conjunto Las Playas, dominio
  `david.macar.18+*@hotmail.com`).

## En parking lot

- **Cobranza de la suscripción.** La cláusula 5.5 de los Términos compromete una
  escalera de mora 10/15/30 que **no ejecuta ningún proceso**: hay que suspender
  a mano desde la consola. PRD completa en Drive,
  `PRD-V-OPS-001 — Cobranza de la suscripción`. Dos puertas la bloquean y
  ninguna es técnica: **G1** no hay baseline (contar conjuntos `active` contra
  cobros recibidos) y **G5** nadie tiene asignada la cobranza. Al salir del
  parking lot su sitio es
  `docs/prd/funcionales/PRD-V-OPS-001-cobranza-suscripcion.md`.

## Deuda conocida, con su porqué

- **~~Los seeds de demo no escriben `isExample`.~~ RESUELTO el 14 de agosto de
  2026.** El marcador va ahora en el documento del CONJUNTO —`seed-tenant.mjs` y
  `seed-demo-users.mjs`—, no en cada fila: ese script escribe en 28 colecciones y
  marcarlas todas dejaba el mismo agujero para la 29. `audit-volumen-ia.mjs`
  resuelve primero qué conjuntos son de ejemplo y descuenta todo lo suyo, además
  del filtro por documento que sigue haciendo falta para los trials. Lo ya
  sembrado se marcó con `functions/scripts/marcar-conjuntos-de-ejemplo.mjs`
  (en seco por defecto). **Había mordido dos veces**: los 20 tickets que eran 0,
  y las 26 comunicaciones que eran 1.

  Lo que **no** se hizo y conviene saber: las métricas de `/superadmin` no
  descuentan conjuntos de ejemplo. Ahora tienen con qué —el campo existe—, pero
  es una decisión de qué debe ver el superadmin, no una corrección.

- **Las respuestas del FAQ no llegan al DOM.** El acordeón arranca cerrado y no
  monta el contenido: solo existen en el JSON-LD y en el payload RSC. Eso hace
  que **el marcado `FAQPage` sea la única copia citable**, y convierte la
  duplicación entre `FAQ.tsx` y `sitio.ts` en algo que hay que proteger, no
  limpiar. `landing-contract.test.ts` solo compara las PREGUNTAS; las respuestas
  se sostienen a mano.
- **El comentario de `FondoHero` viaja al navegador.** Es un comentario CSS
  dentro del `<style>`, no JSX, así que el compilador no lo borra: 3,5 KB de los
  4,5 KB de comentarios que se sirven en cada visita. Documenta cómo se calibró
  el contraste del fondo animado y **tiene valor**; lo correcto es moverlo a un
  comentario de TypeScript encima del componente, no borrarlo.
- **El contrato y el sistema no dicen lo mismo sobre la suspensión.**
  `terminos.md` §5.5 promete que «inhabilita el acceso»; `tenantOperable()` deja
  solo lectura. El cliente recibe más de lo prometido. Recomendación en la PRD:
  cambiar el texto, no el código.
- `src/lib/firebase/client.ts:20` incrusta el `measurementId` de producción como
  respaldo, contradiciendo la política que documenta `config.ts`. Al lado, un
  `projectNumber` de producción que también se aplica corriendo contra staging.
  Una línea cada uno; tocarlos obliga a verificar los portales.

## Contenido

- Dos capturas del deck siguen vacías: `residente-08-documentos` y
  `residente-04-visitantes`. Las dos porque el portal del residente no muestra
  lo que crea el administrador — es una limitación del producto, no del script.

## Decisiones de negocio, no técnicas

- **Publicar precios** (punto 7 de `docs/auditoria-seo-y-llm.md`). `Pricing.tsx`
  existe y está comentado en la página. Es una de las consultas con más
  intención de compra de la categoría.
- **Páginas por intención** (punto 8). Exige validar volúmenes de búsqueda antes
  de construir nada. Las skills de investigación están en `~/.claude/skills/`;
  `research-keywords` necesita una key de SerpAPI de pago.
- **`/registro` y `/diagnostico` fallan profundidad de contenido.** Son
  formularios. Se arregla con contenido de verdad, y eso es decisión de
  conversión, no de SEO. **No rellenar con paja.**
- **Feed RSS.** Vale 8 puntos en la auditoría, pero presupone publicar contenido
  con regularidad. Un feed vacío no sirve.
- El fondo del hero se mueve 23,3 en escritorio y 9,1 en móvil. No es un fallo
  —la sección vertical deja menos superficie libre—, pero si molesta se trata
  aparte con su propia consulta de medios.
