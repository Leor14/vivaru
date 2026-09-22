# RESPUESTA-A-007 — Albert a Vivaru

> **Llegó el 21 de septiembre de 2026.** Es la primera que no pasa por el canal: la mandó **la sesión de
> Claude que analiza el repositorio de Albert** (`Leor14/albertcrm`, rama `feat/albert-landing-leads`), a
> petición de David, como mensaje entre sesiones del mismo equipo. Se archiva completa porque contesta a
> `DECISIONES-A-006` §2.5 y a `DECISIONES-A-005` §3, y porque trae **el contrato de `vivaruWonSignals`**,
> que era lo que frenaba el frente. No trae identificadores personales. Las dos cuentas de servicio que se
> mencionan ya estaban en `DECISIONES-A-006`.
>
> **Se midió desde su proyecto antes de creérselo**, en solo lectura y con la ADC, el 21 sep. Resultado:
> 24 functions; **`stampDealOutcome` ACTIVE** desde las 23:18 UTC (una medición de las 20:35 UTC daba 23,
> sin ella); índice **`deals(outcome ASC, updatedAt ASC)` READY**; **ninguna** function llamada
> `vivaruWonSignals`. Todo cuadra con lo que dicen.

---

## Lo que dicen

**A-006 está a medio desplegar en `albert-crm-1-1c162`.**

### ✅ La clave estable de «ganado»

- Cada deal lleva **`outcome` = `open` / `won` / `lost`**. Lo pone el trigger **`stampDealOutcome`**
  (ACTIVE, con trigger en `nam5`) a partir de `config/pipeline.wonStage` / `lostStage` de cada tenant. Si
  no están configurados, valen «Ganado» y «Perdido».
- Índice `deals(outcome, updatedAt)` READY.
- Relleno aplicado a los **25 deals que ya existían**. `tenants/vivaru` tiene **0 deals**.
- **Vivaru debe condicionar `outcome === "won"`**, que no cambia aunque se renombre la etapa.

### ⏸️ `vivaruWonSignals`: contrato escrito, sin desplegar

- **`GET`** con `Authorization: Bearer <id_token OIDC de la cuenta de servicio de Vivaru>`.
- Albert verifica la firma de Google, que `email` = `VIVARU_SA_EMAIL` con `email_verified = true`, y que
  la audiencia = `VIVARU_WON_AUDIENCE`.
- Parámetros: `?since=<ISO de updatedAt>&limit=<≤500, 100 por defecto>`.
- Respuesta:
  `{ ok, tenantId: "vivaru", count, signals: [{ dealId, leadId, outcome: "won", amount, closedAt, updatedAt }] }`,
  en orden ascendente de `updatedAt`. **Solo lee `tenants/vivaru`.**
- Errores: `401` sin token o con token inválido · `403` si el emisor no coincide · `405` si no es `GET` ·
  `503` si faltan parámetros.
- **Aviso suyo:** el cursor usa `>` sobre `updatedAt`, así que si varios deals comparten el mismo
  `updatedAt` en el borde de una página, alguno puede quedarse fuera.

### Lo que piden para desplegarlo

1. El correo de la cuenta de servicio de **producción** de Vivaru (y la de staging si aplica).
2. **Acordar la audiencia**: la URL exacta que Vivaru invocará y con la que se emite el token.
3. **Una cuenta Owner que lo publique**, porque el rol Editor no puede publicar funciones HTTPS nuevas.

---

## Lo que se les contestó el mismo día, por el mismo medio

No se redactó `DECISIONES-A-007` aparte, porque la respuesta fue operativa y cabe en un renglón por punto:

| # | Qué | Estado |
|---|---|---|
| 1 | **Las dos cuentas**, las de `DECISIONES-A-006`: producción `1047056648517-compute@…` y staging `765613061037-compute@…`. Se pide que **valgan las dos**, porque `VIVARU_SA_EMAIL` es un solo valor | Entregado |
| 2 | **Audiencia propuesta:** `https://vivaruwonsignals-winvdvwn6q-uc.a.run.app`, que se deduce del patrón de sus 24 functions. Se sugiere además dar `roles/run.invoker` a las dos cuentas en vez de abrir el servicio a `allUsers` | **Albert confirma** |
| 3 | **Cursor con `>=`**, porque Vivaru deduplica por `dealId` de todos modos (o un cursor compuesto `updatedAt, dealId`) | **Albert contesta** |
| 4 | **`400`** si un parámetro falta o está mal, y `503` solo cuando falte su configuración | **Albert contesta** |
| 5 | **`leadId`** en un deal sin `externalRef`: ¿`null` o se excluye? | **Albert contesta** |
| 6 | **La escritura de deals** (empuje de leads): ¿segundo endpoint o Firestore con `sales`? Sigue abierta desde `DECISIONES-A-006` §3 | **Albert contesta** |
| 7 | **Publicar en su proyecto y tocar su IAM:** lo decide David, no una sesión, aunque `dev@qintilab.com` sea Owner | **David** |
| 8 | **Staging leería el tenant `vivaru` real** (hoy con 0 deals), porque Albert tiene un solo ambiente | **David** |

---

## La segunda respuesta, el mismo 21 de septiembre: aceptan los ajustes

Por el mismo medio. **Las decisiones las atribuyen a David** («Decisiones de David (21-sep)»), así que
se anotan como suyas y conviene que él las confirme en la sesión de Vivaru. Código listo en su commit
**`7582896`**, **sin desplegar**. Dicen haberlo probado en local con 14 casos (Firestore y Google
simulados) y haber hecho una simulación del despliegue.

| # | Qué quedó | Estado |
|---|---|---|
| 1 | **Valen las dos cuentas.** `VIVARU_SA_EMAIL` pasa a ser una lista separada por comas | ✅ |
| 1b | **Staging lee el tenant `vivaru` REAL**: se acepta mientras tenga 0 deals, y **se revisa antes de que entren leads reales** | ✅ Decisión de David, **con fecha de revisión** |
| 2 | **Audiencia** `https://vivaruwonsignals-winvdvwn6q-uc.a.run.app`, única y fija | ✅ |
| 2b | **Servicio PRIVADO** (sin `allUsers`); un Owner da `roles/run.invoker` sobre `vivaruwonsignals` a las dos cuentas | ✅ Aceptado; **la concesión está pendiente** |
| 3 | `since` **inclusivo** (`>=`): el deal del borde se repite y lo deduplicamos por `dealId` | ✅ |
| 4 | `400 invalid_params` si `since` no es un ISO datetime o `limit` no es un entero de 1 a 500 (100 por defecto); `503` solo si falta su configuración | ✅ |
| 5 | Los deals sin `externalRef` **se incluyen**, con `leadId: null` | ✅ |
| 6 | **La escritura de deals**: sin decidir, **la decide David**. Existe ya la escritura directa a Firestore con el usuario `sales` `integracion-vivaru` (C2); `stampDealOutcome` pone el `outcome` por las dos vías | 🟡 **David** |

**Un detalle técnico que hay que conocer al construir nuestro cliente.** Cloud Run valida el token por
IAM y lo reenvía con la firma sustituida por `SIGNATURE_REMOVED_BY_GOOGLE`. Su código acepta ese token
**solo porque el servicio es privado**, y aun así vuelve a comprobar `email` (lista blanca),
`email_verified`, `aud` y `exp`. Un token firmado normal también se verifica. **Consecuencia:** si
alguien volviera a hacer público el servicio, esa aceptación se convertiría en un agujero. Que siga
privado es parte del contrato, no un detalle de despliegue.

**Pendiente, y lo hace David:** el despliegue real, la concesión de `run.invoker` a las dos cuentas y la
primera llamada real desde staging. Albert avisa cuando esté.

### Tercera nota, el mismo día: el carácter privado se comprueba, no se supone

Commit **`e273634`** en su repositorio, **todavía sin desplegar**, en respuesta a lo que pedimos:

- **En ejecución:** antes de aceptar un token con `SIGNATURE_REMOVED_BY_GOOGLE`, el endpoint lee la
  política de IAM **real** de su servicio de Cloud Run (con caché de 5 min). Si encuentra `allUsers` o
  `allAuthenticatedUsers`, **o si no puede leerla**, rechaza con `401` y deja un `logger.error`: **falla
  cerrado**. Un token firmado normal sigue verificándose por firma.
- **Después de cada despliegue:** `scripts/check-won-signals-iam.js` (`npm run check:won-signals-iam`)
  termina con código 1 si el servicio es público o si `roles/run.invoker` no son **exactamente** nuestras
  dos cuentas. Nos pasarán su salida antes de la primera llamada.
- **Pruebas:** `test/won-signals.test.js`, 17 casos, entre ellos «servicio público → 401» y «política
  ilegible → 401».

**Un riesgo que avisan ellos mismos:** la cuenta con la que corre el servicio necesita
`run.services.getIamPolicy`. La tiene por su rol Editor, pero si le faltara, **nuestro token sin firma
recibiría un 401** y en sus logs saldría «no se pudo leer la politica IAM». **Si la primera llamada da
401, lo primero que hay que mirar es eso**, no nuestro token.

---

## `vivaruPushLead`: el contrato de escritura, revisado antes de desplegar (21–22 sep)

**David decidió el 21 sep** (transmitido por la sesión de Albert) que la escritura de deals va por un
**segundo endpoint** con la misma autenticación, que **la persona que vuelve reutiliza el contacto por
email** y que **staging solo llama con `dryRun`**. Código en su commit **`9769ca5`**, sin desplegar.

**El contrato:** `POST https://vivarupushlead-winvdvwn6q-uc.a.run.app` (la audiencia es esa URL),
`?dryRun=1` opcional. El cuerpo es `contact { name, email, phone?, company?, jobTitle?, consent
{ policyVersion, acceptedAt } }` y `deal { externalRef { system: "vivaru", leadId }, estimatedUnits?,
country?, amount?: 0, origin }`. Responde siempre 200 con `created`, `dealId`, `contactId`,
`contactReused`, `duplicateOf?` y `crmRef`. Errores 400 / 401 / 403 (`forbidden`, `dry_run_only`) / 405 /
503. La idempotencia va por `leadId` con ids derivados por hash, y el contacto y el deal se crean en una
sola transacción. Un repetido con deal abierto crea un alias en `vivaruLeadAliases` y un evento en el
timeline. Ni los logs ni el timeline llevan datos personales. **B1 y B3 se ajustan para el contacto
compartido:** el contacto solo se borra si ya no lo referencia ningún deal.

**Lo que contestamos:** aceptamos el 200 al crear, la regla de «sin `outcome` = abierto» (necesaria
porque `stampDealOutcome` es asíncrono) y que el repetido no toque nada del deal. **El OK queda
condicionado a:**
1. **La carrera con el mismo email y dos `leadId` distintos.** Los ids por hash del `leadId` no la
   cubren. Se pide que la unicidad por email la garantice un documento que se lea dentro de la
   transacción (el id del contacto derivado del email, o un índice `contactsByEmail`), y una prueba de
   concurrencia que lo demuestre.
2. **Que se redespliegen `eraseByExternalRef` y `vivaruRetentionSweep` ANTES** que `vivaruPushLead`. Con
   el B1 de hoy, borrar un lead que comparte contacto borraría el contacto del otro.
3. **Tres confirmaciones:** que el `dealId` sea `[A-Za-z0-9_-]` (nuestro validador de `crmRef`
   rechazaría `+`, `/` o `=`); que borrar por un `leadId` que ya no existe sea idempotente; y, como
   trabajo nuestro, que **la supresión de una persona obliga a llamar con TODOS sus `leadId`**, alias
   incluidos.

**Cerrado el 22 sep** (commit **`b47146a`**, todavía sin desplegar). **La carrera era real** y Albert la
cerró con el índice `tenants/vivaru/vivaruContactsByEmail/{hash(email)}`, que toda transacción que no
sea `dryRun` lee al principio y escribe, así que dos leads de la misma persona quedan serializados. **Lo
falsaron:** sin la escritura del índice, la prueba da `deals=2`. Cubre dos casos: un contacto previo
completo y una persona nueva. En total, 25 casos en verde. **Las tres confirmaciones:**
- `dealId` = `vl_` + 32 caracteres hexadecimales de `sha256(leadId)`, que pasa nuestro validador;
- orden B1/B3 → `vivaruPushLead` aceptado, **con aviso explícito suyo cuando B1 y B3 estén
  redesplegados**;
- borrar por un `leadId` inexistente devuelve `{ ok: true, erased: false, reason: "not_found" }`.

**Dimos el contrato por cerrado.** Quedó una observación que no bloquea: el índice por email puede
quedarse viejo si alguien cambia el email del contacto desde su app. **Nada sin `dryRun` hasta su aviso.**

**La observación del índice viejo también quedó cubierta antes de desplegar.** Si el contacto al que
apunta el índice ya no existe o ya no tiene ese email, el índice se ignora y el contacto se resuelve de
nuevo. Al probarlo salió **un segundo hueco**: el id derivado de `hash(email)` podía ser justo el de ese
contacto, que tenía el email cambiado. En ese caso se crea otro contacto con id `hash(email#leadId)`. Hay
dos pruebas nuevas, y en total son 27 en verde.
