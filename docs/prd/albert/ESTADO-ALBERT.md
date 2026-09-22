# Estado de Albert ↔ Vivaru

> Documento **vivo**: se reescribe, no se acumula. Es el sitio donde mirar para retomar
> sin releer los catorce documentos del intercambio.
> **Actualizado: 21 de septiembre de 2026.** Llegó `RESPUESTA-A-007` y **el frente vuelve a moverse**
> después de veinte días parado.

> ### 21 DE SEPTIEMBRE DE 2026 — «GANADO» YA TIENE CLAVE ESTABLE, Y `vivaruWonSignals` TIENE CONTRATO PERO NO ESTÁ DESPLEGADO
>
> **Quién contestó y por dónde:** la sesión de Claude que analiza el repositorio de Albert
> (`Leor14/albertcrm`), a petición de David, con un mensaje entre sesiones. No pasó por el canal.
>
> **Medido desde su proyecto antes de creérselo** (solo lectura, ADC, 21 sep):
>
> | Qué | Medido |
> |---|---|
> | Functions en `albert-crm-1-1c162` | **24**. A las 20:35 UTC eran 23, y la última desplegada databa del 22 ago |
> | **`stampDealOutcome`** | **ACTIVE** desde las 23:18 UTC del 21 sep |
> | Índice **`deals(outcome ASC, updatedAt ASC)`** | **READY** |
> | **`vivaruWonSignals`** | **No existe** |
> | Nuestro código contra Albert | **Cero**: `vivaruWonSignals`, `submitDemoLead`, `externalRef`, `eraseByExternalRef` y `tenants/vivaru` aparecen 0 veces en `src`, `components`, `features` y `functions/src` |
>
> **Lo que se cerró:**
> 1. **§4.4.1, la clave estable de «ganado»: RESUELTA por Albert.** Cada deal lleva `outcome` =
>    `open`/`won`/`lost`, lo pone `stampDealOutcome` a partir de `config/pipeline.wonStage`/`lostStage`
>    (si no están configurados, «Ganado»/«Perdido») y está rellenado en los 25 deals que ya existían.
>    **Nuestra condición será `outcome === "won"`, nunca el texto de la etapa.** El fallo del tenant
>    `demo` (un deal en una etapa que no está en su lista) no desaparece, pero deja de afectar a la señal.
> 2. **§4.6, la credencial: RESUELTA en el contrato.** Token de identidad OIDC de nuestra cuenta de
>    servicio, verificado por ellos (firma, `email`, `email_verified`, audiencia). Sin contraseña y
>    sin buzón.
>
> **La segunda respuesta, el mismo día: aceptan los tres ajustes** (detalle en `RESPUESTA-A-007`,
> segunda parte). Las decisiones las atribuyen a David; conviene que las confirme. Código en su commit
> `7582896`, **sin desplegar**:
> - **Valen las dos cuentas**: `VIVARU_SA_EMAIL` pasa a ser una lista.
> - **Audiencia** `https://vivaruwonsignals-winvdvwn6q-uc.a.run.app`, única y fija.
> - **Servicio PRIVADO** con `roles/run.invoker` para las dos cuentas. Que siga privado es parte del
>   contrato: acepta el token con `SIGNATURE_REMOVED_BY_GOOGLE` que reenvía Cloud Run.
> - **Y el carácter privado se COMPRUEBA** (`e273634`): el endpoint lee su propia política de IAM y falla
>   cerrado (`401`) si es pública o no puede leerla, y un script posterior al despliegue exige que
>   `run.invoker` sean exactamente nuestras dos cuentas. **Si la primera llamada da 401, mirar primero si
>   su cuenta de ejecución puede leer esa política.**
> - **`since` inclusivo** (deduplicamos por `dealId`); `400 invalid_params` si el parámetro está mal;
>   los deals sin `externalRef` salen con `leadId: null`.
> - **Staging lee el tenant `vivaru` real**: aceptado mientras tenga 0 deals, y **se revisa antes de que
>   entren leads reales**.
>
> **DESPLEGADO el 22 sep a las 02:42 UTC, y medido por nosotros en solo lectura:** función ACTIVE; el
> servicio de Cloud Run `vivaruwonsignals` responde en la audiencia acordada; `invokerIamDisabled: false`;
> la política tiene **un solo binding**, `roles/run.invoker`, con **exactamente nuestras dos cuentas**; un
> GET anónimo da **403**. Corre con `1030612300411-compute@…`. El check de Albert dio lo mismo.
>
> **Lo que queda abierto:**
>
> | Qué | Quién |
> |---|---|
> | **La primera llamada real, desde staging** | David y Vivaru, cuando exista el endpoint |
> | **La escritura de deals: DECIDIDA por David (21 sep), SEGUNDO ENDPOINT** con la misma autenticación, no Firestore con `sales`. Albert lo diseña; le mandamos nueve requisitos (idempotencia por `vivaruLeadId`, contacto y deal en una transacción, consentimiento obligatorio, `externalRef` siempre, `dryRun` para staging…) y revisamos su contrato **antes** de que lo despliegue | Albert |
> | **`vivaruPushLead`: DESPLEGADO el 22 sep a las 03:43 UTC**, con B1 y B3 redesplegados antes (03:36 UTC, código `c5cce14`, B3 sigue dormida). Medido por nosotros en solo lectura: 26 functions; en los dos servicios, `run.invoker` solo para nuestras dos cuentas, `invokerIamDisabled: false` y 403 anónimo. **Staging solo con `dryRun=1`**; **producción no escribe sin que lo diga David** | Vivaru llama cuando David decida cómo |
> | **Revisar que staging lea el tenant real** antes de que entren leads reales | **David** |
>
> **Nuestro cliente de la señal de vuelta, CONSTRUIDO el 22 sep** (decisión de David: primero la
> opción B, y **solo registrar**). La función programada `registrarSenalesDeAlbert`
> (`functions/src/albert-senal-de-vuelta.ts`) consulta `vivaruWonSignals` cada 10 minutos con el token
> de identidad de la cuenta de servicio y deja una fila por deal ganado en `albertSenalesGanado/{dealId}`
> (`create`, así que es idempotente). El cursor vive en `integracionAlbert/senalesGanado`. **Solo corre
> en staging** (`AMBIENTES_HABILITADOS`), y producción la enciende David. Tiene 11 pruebas, falsadas
> rompiendo el módulo de tres maneras. **Qué se ACTIVA con un deal ganado sigue sin decidir.**
> **FUNCIONANDO en staging desde el 22 sep a las 04:45 UTC**: 200 con 0 señales, y 77 ejecuciones cada 10
> minutos hasta las 17:25 UTC sin un solo error (medido en sus logs). **Albert confirmó por la traza de su
> revisión `vivaruwonsignals-00002` que nuestro token llega FIRMADO**: se valida dos veces, por IAM en
> Cloud Run y por `verifyIdToken` en su código. **El camino «sin firma» se RETIRÓ el 22 sep a las 17:35
> UTC** (su `eb144bc`, revisiones `-00003`): un token sin firma da 401 siempre, y con él desapareció la
> guarda que leía la política de IAM, que era la única pieza cuya seguridad dependía de que el servicio
> siguiera privado. Privado sigue, así que la doble validación se mantiene. **Comprobado desde aquí**:
> nuestras consultas de las 17:35, 17:45 y 17:55 UTC siguieron en 200. **Si un día la consulta recibe 403, lo
> primero es mirar si redesplegaron con una cuenta Owner**, porque Firebase vacía entonces la lista de
> `run.invoker`. La opción A (una llamada suelta suplantando la cuenta de staging) se descartó: el permiso se concedió y
> se retiró antes de propagarse, y no hubo ninguna llamada.
>
> **Nuestro envío de leads, CONSTRUIDO el 22 sep** (decisión de David: **al crearse el lead**). Es el
> trigger `enviarLeadAAlbert` sobre `leads/{leadId}` (`functions/src/albert-envio-de-leads.ts`). **Trigger
> y no ruta web** porque las rutas corren con la cuenta de App Hosting, que Albert no autoriza. Traduce
> el lead al contrato de `vivaruPushLead`; si falta algo que el contrato exige (consentimiento, nombre,
> email, origen), el lead se marca `omitido` con su motivo en vez de mandarse roto. El resultado queda en
> el propio lead (`albertEnvio`), y en modo real también rellena `crmRef`. **Modo por ambiente
> (`MODO_POR_AMBIENTE`): staging `dryRun`, producción `apagado`** hasta que David ponga `hogaru-1: "real"`.
> La cuenta de producción es la misma para las 90 functions, así que ese mapa es el único freno de nuestro
> lado. **Hoy los leads de `trial` nacen sin consentimiento** (`trial-workspace.ts`) y se omitirán. Un
> error de Albert no se reintenta solo: queda en el lead y se reenvía a mano, lo que es seguro porque el
> envío es idempotente por `leadId`. Tiene 19 pruebas, falsadas con tres roturas.
>
> **PROBADO CONTRA ALBERT DE VERDAD el 22 sep a las 18:43:44 UTC**, con un lead real del formulario de
> demo de staging: `200` con `dryRun: true`, `created: true`, `dealId vl_8eda576d…`, `contactId
> vc_073e8532…`. Quedó en el lead (`albertEnvio`) y **no se tocó `crmRef`**, porque en simulado no hay
> deal al que apuntar. **Cero escrituras en el CRM**, medido por los dos lados: `deals`, `contacts`,
> `timeline`, `vivaruLeadAliases` y `vivaruContactsByEmail`, todos en 0. Albert confirmó en sus logs
> que el token entró **firmado** y aceptado. **El `dealId` es determinista a partir del `leadId`**, así
> que lo guardado hoy en simulado servirá para cruzar el día que ese lead se envíe de verdad.
>
> **Dos cosas que quedan vivas:** los leads que YA existían no se envían nunca (el trigger es de
> creación), así que mandarlos pediría un script aparte; y **encender producción** —`MODO_POR_AMBIENTE`
> con `hogaru-1: "real"`, más desplegar functions— es decisión de David, y desde ese momento cada lead
> real nace como deal en el CRM.
>
> **La condición de reapertura de la herramienta se cumplió y no se usó.** §«La decisión de herramienta»
> la ponía en «si las dos preguntas tardan más de dos semanas», y tardaron veinte días. **Ya están
> contestadas las dos**, así que no hay nada que reabrir.

---

## La decisión de herramienta, tomada el 28 de agosto de 2026

**Vivaru se queda en Albert.** Se comparó contra Odoo —gratuita, de pago y autoalojada— antes de
seguir invirtiendo, y la comparación no estuvo reñida:

- **La versión gratuita de Odoo no puede integrarse.** El acceso a API externa vive **solo en su
  plan Custom**; ni el gratuito ni el intermedio dejan que un sistema de fuera lea o escriba. Como
  eso es lo único que Vivaru necesita, la opción gratuita **no aplica**, no es que sea peor.
- **Con más de cinco usuarios, Odoo integrable cuesta ~Mex$ 19.700 el primer año** y ~24.600
  después. Albert cuesta cero.
- **El alcance es solo el pipeline**, así que la mayor ventaja de Odoo —traer facturación,
  suscripciones y contabilidad— queda fuera del comparativo.
- **Cambiar no ahorra trabajo:** las cinco piezas que Vivaru tiene por construir siguen siendo
  cinco. Cambia el interlocutor y la factura, no el código.
- **Y Albert se vende a terceros**, así que Vivaru usándolo es su cliente de referencia.

> **La premisa que sostiene media recomendación está CONFIRMADA: Albert es producto de Qintilab.**
> Confirmado por David con los socios el 28 de agosto de 2026. Se preguntó porque su web pública
> firma «by Somasoft Colombia», que dejaba la duda abierta; no lo era. **Queda escrito para que
> nadie vuelva a abrir la pregunta el día que vea esa firma.**

> **`DECISIONES-A-005` YA ESTÁ ENTREGADO** (28 de agosto de 2026). No por correo: **David lo
> descarga del repositorio y se lo pasa a las personas que le ayudan con Albert.** Conviene saberlo
> porque el agente no puede hacer esa entrega ni comprobarla — **el frente pasa a esperar su
> respuesta, no su envío**.

**Cuándo se reabre.** Desde el 21 de septiembre queda **una sola** de las cuatro condiciones. La clave
estable de «ganado» existe (`outcome`), y las dos preguntas se contestaron a los veinte días: tarde,
pero contestadas. La que sigue en pie es que el alcance deje de
ser solo el pipeline —facturar a los conjuntos o llevar suscripciones cambia el partido, y es el
escenario que más probablemente le dé la vuelta—. **La cuarta —que Albert dejara de ser de la
casa— se cayó al confirmarse que sí lo es.**

---

## En una frase

**Las dos preguntas que frenaban el frente están contestadas (21 sep), y lo que queda es desplegar
`vivaruWonSignals` y cerrar los flecos de su contrato.** «Ganado» tiene clave estable (`outcome`) y la
credencial es un token de identidad de nuestra cuenta de servicio. **Falta que exista el endpoint**,
que lo publique una cuenta Owner (lo decide David) y que se confirmen la audiencia y los ajustes del
cursor. Después, lo nuestro: el cliente que consulta el endpoint, el empuje de leads con su freno y el
camino de supresión. La vía de escritura del empuje sigue sin decidir.

**La lección de las dos preguntas sigue valiendo:** la de «ganado» no la contestaba ningún documento.
Se vio usando su consola, y Albert la resolvió con una clave, no congelando el texto.

**Y los dos equipos dejaron de ir en paralelo, a propósito** (decisión de David, 22 ago):
Albert avanza con su roadmap y Vivaru con el lote de Habitanto. No hay nada urgente que
obligue a sincronizarlos.

---

## 1. Qué es esto y por qué existe

**Albert CRM es propiedad de Qintilab, igual que Vivaru. No es un tercero.** La decisión
de los socios del 17 de agosto de 2026 no fue «conectar Albert con Vivaru»: fue **adaptar
Albert a las reglas de negocio de Vivaru**, y el mecanismo es que **Vivaru redacta PRDs y
Albert los desarrolla**.

**Vivaru es tenant de Albert.** Ese encuadre es el que tumbó media lista de bloqueos
antiguos, y es el detalle que más veces se ha olvidado al leer documentos viejos. Ver §5.

---

## 2. El intercambio — cerrado en nueve documentos, **reabierto después por buen motivo**

Todos en `docs/prd/albert/`. **`DECISIONES-A-004` lo declaró cerrado explícitamente**, y esa
declaración fue parte del trabajo: un intercambio que nadie cierra sigue por inercia.

**Y luego se reabrió, que es lo correcto cuando aparece algo que no cabe en el cierre.** Una
ronda de dudas por el canal trajo `RESPUESTA-A-005`, y el 28 de agosto se contestó con
`DECISIONES-A-005`. **Un cierre no es un candado: es el estado por defecto mientras nadie
tenga nada que decir.**

| Documento | Fecha | Qué es |
|---|---|---|
| `CONSULTA-A-001` | 19 ago | Trece preguntas de Vivaru |
| `RESPUESTA-A-001` | 19 ago | Las contesta todas citando `archivo:línea`. **Aquí está el C1 que desbloquea `REVOPS-001C`** |
| `DECISIONES-A-001` | 19 ago | Cierra seis decisiones y **le nombra dos contradicciones suyas** |
| `RESPUESTA-A-002` | 19 ago | **Da la razón en las dos sin regatear** |
| `DECISIONES-A-002` | 21 ago | Los dos números de retención, el canal único, y la reclamación de la fecha de A1 |
| `RESPUESTA-A-003` | 22 ago | Acepta 12 y 12 pero **recomienda subir el n.º 2**; dice sí al canal; **anuncia la fecha de A1 y deja el marcador vacío** |
| `DECISIONES-A-003` | 22 ago | Contesta su recomendación **con una medición que le da la vuelta**; resuelve la deriva de `crmRef`; nombra que el documento anunció lo que no entregaba |
| `RESPUESTA-A-004` | 22 ago | Concede las tres. **Entrega el rango de A1** y regala la idempotencia de `eraseByExternalRef` |
| `DECISIONES-A-004` | 22 ago | Ata «esta semana» al calendario, declina el adelanto del esquema, **y cierra el intercambio** |
| `RESPUESTA-A-005` | 28 ago | Confirma los dos datos del alta, define «A1 publicado», **anuncia B1 y B3 desplegados**, concede las dos correcciones y anuncia el **reset self-service** |
| `DECISIONES-A-005` | 28 ago | Cierra el `displayName` **por nuestra cuenta**, acusa B1/B3, y hace **la única pregunta viva**: una clave estable para «ganado» |
| `RESPUESTA-A-006` | 1 sep | Nota operativa: **piden el correo de nuestra cuenta de servicio** para autenticar contra un endpoint nuevo, `vivaruWonSignals` |
| `DECISIONES-A-006` | 1 sep | Entrega las dos cuentas (producción y staging), **pide el contrato del endpoint**, y deja de pedir contraseña y exclusión del reset |
| `RESPUESTA-A-007` | 21 sep | **`outcome` como clave estable de «ganado»**, ya desplegado, y **el contrato de `vivaruWonSignals`**, todavía sin desplegar. Llegó entre sesiones, no por el canal; lleva al final lo que se contestó ese día |

Además, fuera del hilo numerado: su **estado de integración** (22 ago) y la **ronda de dudas**
contestada por el canal. Ambos recogidos aquí.

**Las once están archivadas desde el 28 de agosto**, y hasta ese día **faltaban tres**:
`RESPUESTA-A-003`, `-A-004` y `-A-005` vivían fuera del repositorio mientras este documento las
citaba. Las dos primeras entraron **íntegras** —revisadas carácter a carácter, no traían ningún
identificador—. De `RESPUESTA-A-005` se retiraron **los dos `uid` y las dos direcciones**, marcados
en su sitio con `⟨⟨…⟩⟩`; el texto y los argumentos están completos.

> **Y al falsar esa limpieza salió lo de §8**, que es más grande que el archivado: **los dos `uid`
> ya no existen en ningún sitio del repositorio, pero las dos direcciones siguen en 33 ficheros**,
> y la mayoría no son documentos. Ver §8.

---

## 3. Lo que está CERRADO — el contrato

| Punto | Qué quedó | Estado |
|---|---|---|
| **A1 · Campos propios en el deal** | `externalRef {system,leadId}`, `estimatedUnits`, `country` (ISO-2) + `consent` en el contacto + índice | ✅ **PUBLICADO en producción** el 22 ago, antes de la ventana |
| **A2 · Importe** | `amount: 0` al entrar, cifra al calificar. Sin `is_estimate` | ✅ |
| **B1 · Supresión** | Callable `eraseByExternalRef`, dos llaves, **e idempotente** | ✅ **Desplegado** (`RESPUESTA-A-005`) |
| **B2 · Consentimiento** | **Solo en el contacto**; `acceptedAt` lo pone nuestro servidor | ✅ Decidido |
| **B3 · Retención** | **12 y 12**, `updatedAt` del deal / fecha del borrado. Dos parámetros independientes | ✅ Cerrado y **desplegado** (`RESPUESTA-A-005`) |
| **C1 · Leer sus deals** | `onSnapshot` sobre `tenants/vivaru/deals`. Sin trigger, sin webhook, sin OIDC | ✅ |
| **C2 · Identidad de escritura** | Usuario de servicio del tenant, rol `sales`, **SDK cliente directo a Firestore** | ✅ Creado |
| **A5 · Alta del tenant** | `tenantId = vivaru` | ✅ **EJECUTADA** el 22 ago |

**El alta devolvió lo acordado y se verificó, no se supuso.** `tenants/vivaru` existe y está
`active`; el rol `sales` está confirmado **en tres sitios** —custom claims, `users/{uid}` y
`tenants/vivaru/users/{uid}`—. Y como `canWriteTenantData` incluye `sales`, la identidad
sirve para leer **y** para escribir.

**Los identificadores y las credenciales NO están en este repositorio**, y es la regla que
fijamos en `DECISIONES-A-002` §2 antes de que existieran: *el repositorio lleva las
decisiones; el correo lleva los datos personales, las credenciales y las fechas.* Viven en
el canal. La contraseña del usuario de servicio va a **Secret Manager**.

**Dos precisiones suyas que conviene no olvidar:**

- **La auditoría guarda el `uid`, no el nombre legible.** En `createdBy`/`updatedBy` queda
  el `uid` del usuario de servicio. La trazabilidad existe, pero se resuelve mirando el
  documento del usuario — y por eso el `displayName` importa (§4.5).
- **Normalizan el correo a minúsculas.** Nuestro `saveSalesRep` ya lo hace
  (`sales-reps.ts:107`). Verificado.

---

## 4. Lo que le toca a VIVARU

### 4.0 · El estado del código, medido el 22 y **vuelto a medir el 27** de agosto

| Pieza | En el código |
|---|---|
| **Validación de `crmRef`** | ✅ **HECHA Y EN PRODUCCIÓN.** `src/lib/albert/crm-ref.ts`, los dos formatos, conectada a las dos pantallas, 20 pruebas. Verificado el 27 ago: el fichero está en `origin/master` |
| Empuje de leads (`submitDemoLead`) | ❌ **Cero apariciones.** No lo llamamos desde ningún sitio |
| `externalRef.leadId` | ❌ **Cero apariciones** |
| `eraseByExternalRef` | ❌ **Cero apariciones.** El camino de supresión no existe |
| Ventana de retención sobre `leads` | ❌ **No existe.** `data-retention.ts` cubre comprobantes, `aiUsage` y `aiFeedback` — los leads no |

**Medido de nuevo el 27 de agosto**, no releído: `submitDemoLead`, `externalRef` y
`eraseByExternalRef` siguen con **cero apariciones** en `src/`, `components/`, `features/` y
`functions/src`, y `data-retention.ts` sigue sin cubrir `leads` —sus ventanas son
`DEFAULT_RETENTION_MONTHS`, `AI_USAGE_RETENTION_MONTHS` y `EMAIL_DELIVERY_RETENTION_MONTHS`,
esta última de `FLOW-003`—.

**El orden que sigue en pie:** el empuje **con su freno dentro** —no antes, porque hoy no
creamos deals y un freno solo sería un guardián sin puerta— y después el camino de
supresión, que depende de B1.

### 4.1 · Una promesa que hoy no vigila nadie

Albert se negó —**con razón**— a hacer `contactId` obligatorio, porque rompería a sus
usuarios que crean deals sueltos. En su lugar **aceptó nuestra palabra**: Vivaru creará
siempre el contacto **antes** del deal.

**Pendiente:** un freno que lo impida. No un comentario — algo que falle. **Va dentro del
empuje, en el mismo commit.**

### 4.2 · Retención — cerrada, comunicada y aceptada

**12 y 12.** Documento completo en [`docs/politica-retencion-datos.md`](../../politica-retencion-datos.md).

Albert recomendó subir el n.º 2 a 24–36 meses con un buen argumento: el registro de
borrado deja de reidentificar en cuanto el lead muere en Vivaru, así que el puntero cuelga.
**Fuimos a medirlo y la premisa no se cumple:** `eraseByExternalRef` no se invoca y los
leads no tienen ventana, o sea que **hoy nada borra un lead** y el puntero apunta a un
registro vivo. **Desde el 28 de agosto la callable existe y está desplegada** —B1—, pero eso
no mueve la conclusión ni un milímetro: **el disparador no era que existiera, era que la
llamáramos.** Sigue sin llamarla nadie.

> **Conclusión aceptada por los dos lados:** n.º 1 = 12 firme; n.º 2 = 12 hoy; y el
> **disparador para subirlo no es una fecha ni una opinión, es que exista en Vivaru un
> camino de supresión que borre el lead y llame a `eraseByExternalRef` en la misma
> operación.**

**Escrito como condición de vigilancia en las dos casas, con una redacción por casa** para
que cada uno la compruebe sin depender del otro: Albert por sus logs, Vivaru por un `grep`.
La suya vive en su `docs/POLITICA-RETENCION-ALBERT.md`.

### 4.3 · Las dos referencias cruzadas

| Dirección | Campo | Estado |
|---|---|---|
| **Albert → Vivaru** | `crmRef` | ✅ **Validado.** `albert:user:{uid}` y `albert:deal:{tenantId}:{dealId}` |
| **Vivaru → Albert** | `externalRef.leadId` | ❌ No existe en nuestro código |

**Por qué adoptamos el envoltorio:** un `uid` pelado de 28 caracteres no se distingue de
otra referencia de la misma forma, así que sin prefijo la validación se queda en «comprobar
que no está vacío». **Albert nos manda el `uid` crudo y lo envolvemos nosotros.**

### 4.4 · La pregunta — cambió de dueño el 28 de agosto

**La vieja ya estaba contestada, y en nuestro propio repositorio.** Preguntábamos qué rechaza
un `externalRef` escrito directo a `tenants/vivaru/deals`: ¿las reglas o sólo su app?
`RESPUESTA-A-001` lo dice en dos sitios que nadie cruzó: cita `canWriteTenantData = superadmin
| tenant_admin | sales` sobre `firestore.rules:45-47` —**filtro por rol, no por forma del
documento**— y sitúa el Zod cerrado dentro de `upsertDeal`, que es **código suyo**.
`RESPUESTA-A-005` §2b lo remata: *«podéis escribir»*. Conclusión: **A1 nunca bloqueó nuestro
camino de escritura**, que era el mundo 1 de los dos que planteábamos.

Con una salvedad que no conviene borrar: **eso es leer la regla, no probarla**, y esta casa ya
sabe lo que cuesta confundirlo. Así que la pregunta no se manda — **se convierte en la primera
aserción de la primera prueba** el día que haya credencial.

*(Dato menor de la misma visita: el formulario de creación de deal **no pinta** `externalRef`,
`estimatedUnits` ni `country`. No prueba que A1 no esté desplegado —son campos opcionales de
integración y el índice está LIVE— pero confirma el fondo: **su prueba pasa por su app y
nuestro camino no**.)*

### 4.4.1 · La pregunta que SÍ hay que hacer: una clave estable para «ganado»

> **CERRADA el 21 de septiembre de 2026** (`RESPUESTA-A-007`): cada deal lleva `outcome` =
> `open`/`won`/`lost`, calculado por `stampDealOutcome` a partir de `config/pipeline.wonStage`. **Se
> condiciona `outcome === "won"`.** Lo de abajo se conserva porque explica por qué nunca el texto.

**Salió de navegar su consola el 28 de agosto, y no se ve en ningún documento.** En el pipeline
del tenant hay un panel, **«Configurar etapas del pipeline»**, que es una **caja de texto libre**
con su botón de guardar. Contiene hoy:

```
Nuevo, Contactado, Propuesta, Negociacion, Ganado, Perdido
```

Y el desplegable «Etapa» del formulario de deal ofrece **esas mismas cadenas**, no claves
normalizadas. O sea que la etapa se persiste como ese texto.

> **Si es así, la señal de vuelta no puede condicionarse a `stage === "Ganado"`.** Esa palabra
> la reescribe cualquiera desde esa pantalla —renombrarla, la tilde, traducirla, reordenar la
> lista— y ese día **el detector deja de disparar sin dar un error**: ni excepción, ni log, ni
> prueba en rojo. Sólo clientes ganados a los que no se les activa nada.

Es la forma exacta del defecto que ya nos mordió: **una condición que usa un valor como
sustituto de un hecho.** Y hay un detalle que lo subraya — su propia pantalla dice *«sin perder
la etapa Perdido para analitica y cierre»*: **protegen «Perdido» y no dicen nada de «Ganado»**,
que es justo la que REVOPS necesita. El panel, además, **se ve desde nuestra propia sesión
`sales`**.

**Preguntado en `DECISIONES-A-005` §3:** ¿existe una clave canónica, un `stageKey`, un booleano
o un tipo de etapa que signifique «ganado» con independencia del texto configurable? Y si no,
¿qué cuesta añadirlo? **No se pide congelar el texto** —la configurabilidad es virtud suya—:
se pide **un campo que no se mueva cuando el texto se mueva**.

**Esto bloquea diseño.** Lo que bloquea ejecución es la credencial, en §4.6.

### 4.5 · El usuario de servicio quedó en un buzón de desarrollo — decisión de David

**Decidido el 22 de agosto de 2026, con el riesgo sobre la mesa.** El contrato (C2) decía
`integracion-vivaru`; el alta lo creó sobre un **buzón de desarrollo compartido de
Qintilab**. **David lo mantiene a propósito:** no hay alias de correo en Albert todavía, y
crear uno frenaría lo que el alta abre. Se corregirá con el tiempo.

**Qué se acepta al elegirlo, dicho para que nadie lo lea como definitivo:**

- **Es un buzón humano compartido.** Quien lo lea puede recuperar esa cuenta, y esa cuenta
  es la credencial con la que Vivaru escribe en el CRM. **Y el 28 de agosto ese riesgo
  creció**: Albert desplegó el reset self-service (§7), así que recuperarla ya **no exige un
  superadmin suyo** — se hace desde la pantalla de login. Se aceptó el riesgo cuando había un
  humano en medio; ya no lo hay.
- **Es además la identidad con la que se opera el CLI de Firebase de Vivaru** —comprobado
  con `firebase login:list` el 22 de agosto—, o sea la cuenta desde la que se despliega.
  Junta en una sola identidad la que despliega y la que escribe en el CRM. **El Owner de
  `hogaru-1` es otra cuenta**, lo que acota el alcance, pero no lo elimina.
- **La auditoría conserva su asa legible, y esto ya está verificado.** `createdBy` guarda el
  `uid`, así que la trazabilidad depende del `displayName`. **Confirmado en pantalla el 28 de
  agosto: dice `integracion-vivaru`**, como fija C2. Resolver el `uid` devuelve un nombre que
  significa algo. **Punto cerrado sin gastar una ronda de correo.**

**La corrección, cuando existan los alias:** recrear el usuario de servicio con dirección
propia. **Hoy es gratis porque no hay ni un deal escrito** —verificado en su consola el 28 de
agosto: 0 deals, 0 contactos, 0 leads, 0 tareas—; cada deal que se cree estampa ese `uid` en
`createdBy` para siempre y encarece el cambio. **La ventana está abierta y se cierra sola en
cuanto entre el primer cliente.**

### 4.6 · Nuestra mitad — y **el aplazamiento que acaba de caducar**

> **Para la señal de vuelta, RESUELTA el 21 de septiembre de 2026:** token de identidad OIDC de nuestra
> cuenta de servicio contra `vivaruWonSignals`, sin contraseña ni Secret Manager. **Para el empuje de
> leads sigue abierta**: si Albert da un segundo endpoint con la misma autenticación, lo de abajo sobre
> la contraseña deja de aplicar; si la escritura va directa a Firestore con `sales`, sigue en pie.

La **contraseña del usuario de servicio en Secret Manager** y el **reseteo de las dos
credenciales** se aplazaron el 22 de agosto con este argumento: *no hay prisa porque nada lee
ese secreto todavía —cero cableado de Albert en `functions/src`—.*

> **Ese argumento se cae solo en cuanto se empieza lo único construible.** La segunda mitad de
> `REVOPS-001C` **es** ese cableado: es lo primero que va a leer el secreto. El aplazamiento no
> envejeció por el paso del tiempo — deja de valer por lo que decidamos construir. **Es la misma
> forma del §8: una frase cierta que nadie vuelve a contrastar cuando cambia el supuesto.**

Y hay un hueco que **`RESPUESTA-A-005` no cierra**: dice que al `tenant_admin` lo crearon **sin
contraseña**, a propósito, para no manejar ninguna en claro. **Del usuario de servicio no dice
nada** — ni si tiene contraseña ni cómo se obtiene. Repasados los once documentos: **nadie ha
dicho nunca que esa cuenta tenga una.**

> **Y el 28 de agosto, al reautenticar el CLI, apareció un camino mejor que pedirla.**
> `albert-crm-1-1c162` **sale en la lista de proyectos** de la cuenta con la que operamos, y con
> ella se pudieron **listar sus índices** — de paso quedó verificado por nosotros, y no por su
> palabra, que **el índice de A1 está vivo**: `deals(externalRef.leadId ASC, updatedAt DESC)`.
> **Hasta dónde llega ese acceso no se sabe**: medirlo exige `gcloud`, que es la **tercera**
> credencial y estaba caducada. No se fue más lejos a propósito.

**De ahí sale la petición que reemplaza a «dadnos la contraseña»** y que está en
`DECISIONES-A-005` §4: que concedan a **la cuenta de servicio de nuestras Cloud Functions**
lectura sobre su Firestore. **Resuelve el problema de §4.5 en vez de convivir con él** — una
cuenta de servicio no tiene buzón, no tiene pantalla de login, **no se recupera por correo** y se
revoca desde su lado. Una contraseña de usuario, en cambio, es la que cuelga del buzón compartido.

El orden, cuando se haga:

1. **Decidir la vía de credencial**, y hay tres por orden de preferencia: **cuenta de servicio**
   (pedida), contraseña por el canal, o el **reset self-service** —que funciona ya y no depende de
   nadie, con la ironía de armar la credencial de máquina usando justo el mecanismo que §7
   recomendaba no construir—.
2. Si acaba siendo contraseña, va a **Secret Manager**, staging primero.
3. La del `tenant_admin` va al **gestor de contraseñas**, no a Secret Manager: la usa una persona
   para entrar. *(El enlace de vida corta del 22 ya no hace falta pedirlo: hay self-service.)*

**Y una separación que no cuesta esperar a ningún alias:** que el CLI de Firebase de Vivaru se
autentique con otra cuenta. Comprobado el 28 de agosto, además, que **su credencial estaba
caducada** —`firebase projects:list` devuelve `credentials are no longer valid`—, así que ese
día no se podía desplegar nada. Es la tercera credencial de este proyecto que caduca por su
cuenta.

---

## 5. La corrección que más cambió el plan

> **La segunda mitad de `REVOPS-001C` NUNCA estuvo bloqueada por Albert, y tres documentos
> de Vivaru decían que sí.** Corregido el 20 de agosto de 2026.

`RESPUESTA-A-001` C1, literal: **«SÍ, sin nada que os lo impida.»** La regla
`match /deals/{docId} { allow read: if canReadTenant(tenantId); }` incluye a `sales`.

**Y desde el 22 de agosto ya no queda ni el impedimento operativo:** el tenant existe y el
usuario de servicio también. **La suscripción en vivo se puede construir cuando queramos.**

**Por qué se coló el error, que es lo que hay que llevarse:** la frase era cierta mientras
Vivaru fuese un tercero. Dejó de serlo al hacernos tenant. Y ese tipo de muerte **no deja
rastro**: ni commit, ni prueba en rojo. **Una dependencia se cae por dejar de necesitarla.**

---

## 6. Lo que le toca a ALBERT

| Qué | Estado |
|---|---|
| **A1** | ✅ **Publicado en producción** el 22 ago |
| **A5** | ✅ **Ejecutada** |
| **B1** — `eraseByExternalRef` idempotente | ✅ **Desplegado** (`RESPUESTA-A-005`). Nadie lo llama todavía: eso es nuestro |
| **B3** — retención programada 12/12 | ✅ **Desplegado** (`RESPUESTA-A-005`) |
| **Nombre del receptor único del canal** | ⟨⟨pendiente de su owner⟩⟩. **No bloquea**, y se comprobó por las malas el 28 de agosto: se dio por bloqueante porque el agente no podía mandar el correo, y resultó que **el canal no es el correo** — David descarga el documento y se lo pasa a mano a quien le ayuda con Albert. **La entrega no depende de que exista un buzón único** |
| **`displayName` del usuario de servicio** | ✅ **Confirmado en pantalla el 28 ago**: `integracion-vivaru` |
| **Clave estable para «ganado»** | ✅ **`outcome`**, con `stampDealOutcome` ACTIVE y el índice READY (medido el 21 sep) |
| **Credencial de la señal de vuelta** | ✅ **Token OIDC de nuestra cuenta de servicio**, en el contrato de `RESPUESTA-A-007` |
| **`vivaruWonSignals` desplegado** | 🟡 **Contrato escrito, sin desplegar.** Esperan la audiencia y una cuenta Owner que lo publique (David) |
| **Flecos del contrato** | 🟡 Las dos cuentas, el cursor `>=`, `400`/`503` y `leadId` sin `externalRef` |
| **Vía de escritura de deals** | 🟡 ¿Segundo endpoint o Firestore con `sales`? Abierta desde `DECISIONES-A-006` §3 |
| **Endurecer su `/leads` público** | Deuda suya. No nos toca: escribimos deals, no leads |

**Un hallazgo suyo que conviene conocer.** El dato personal de su timeline **no está en
campos estructurados** sino embebido en el texto de cada evento (`Contacto creado: Juan
Pérez`). La anonimización tiene que **reescribir mensajes**, no vaciar campos.

---

## 7. Lo que NADIE tiene y sigue SIN compromiso

### El motor de mensajería — el hueco que importa

Sin control de **opt-out y frecuencia**, el `consent` que se diseñó **no tiene quién lo
respete al enviar**. Se construyó el candado y no la puerta. Albert lo nombra él mismo y
dice que **no está en un roadmap comprometido**. **No bloquea nada hoy. Bloqueará el día
que se manden correos de verdad.**

### El reset self-service en el login de Albert — **construido, y contra nuestra recomendación**

**Ya no es un hueco: es un hecho.** `RESPUESTA-A-005` §5 anuncia que lo desplegaron, y se
verificó mirando: la pantalla de login de producción tiene «¿Olvidaste tu contraseña?».

Lo que este documento recomendaba, y sigue siendo el análisis correcto: *que no lo prioricen
por nosotros, porque añade recuperación por correo a **todas** las cuentas, la del usuario de
servicio incluida — justo la segunda llave que queremos evitar en una credencial de máquina.*

**Lo construyeron igual, y en respuesta a una duda nuestra.** No es reprochable —mejora su
producto— pero **la consecuencia es nuestra y hay que administrarla**: la credencial con la que
Vivaru escribirá en el CRM vive en un buzón compartido que ahora se auto-recupera. Ver §4.5.

**Preguntado en `DECISIONES-A-005` §4, sin urgencia:** si se pueden excluir del reset por correo
las cuentas de servicio. Si la respuesta es que no merece la pena, se cierra por nuestro lado
cambiando la dirección.

**Lección de método que deja:** una recomendación nuestra sobre **su** producto no es una
decisión, es una opinión — y ellos deciden. Lo que sí es nuestro es **volver a mirar el riesgo
que habíamos aceptado** cuando cambia el supuesto sobre el que se aceptó.

### La agenda de demos

**No se pide y no se construye.** Con cero clientes firmados es infraestructura para una
demanda inexistente.

---

## 8. Dos cosas de método que salieron de este expediente

**La regla del canal se adoptó cuando ya estaba rota.** Fijamos que el correo del
`tenant_admin` no viajaría dentro de ningún documento — y esa dirección **ya llevaba tiempo
escrita en `PRD-A-OPS-001`**, que es un documento del intercambio, en otro papel: el buzón
de avisos de leads. Nadie contrastó la regla contra el estado real al escribirla.

Es la misma forma que «Vivaru no tiene política de retención» —la tenía, corriendo cada
noche— y que «Albert no tiene webhooks» —dejó de importar—. **Una regla nueva también hay
que verificarla contra el código y los documentos que ya existen.**

> **Y esta nota se quedó corta ella misma, medido el 28 de agosto.** Decía «escrita en
> `PRD-A-OPS-001`», en singular, como si fuese un papel despistado. **No lo es:**
>
> | | `comercial@qintilab.com` | `dev@qintilab.com` |
> |---|---|---|
> | Ficheros en total | **16** | **17** |
> | Documentos | 4 | 4 |
> | **Código fuente** | **8** | **7** |
> | Build compilado | 3 | 4 |
> | **`apphosting.yaml`** | **1** | **2** |
>
> **Las dos son configuración del producto, no una cita despistada en un papel.** Son el destino
> de los avisos de leads, de demos y de tickets, están escritas en `functions/src` y en `src`, y
> **viajan dentro de la configuración desplegada**. `dev@qintilab.com` está ahí **desde el 8 de
> agosto**, semanas antes de ser la cuenta de servicio del CRM.
>
> **Con lo cual la pregunta pendiente cambia de forma.** No es «¿se limpian los documentos?»:
> limpiarlos sería cosmético y dejaría intactas las quince apariciones que de verdad mandan.
> Es **si estas dos direcciones deben seguir siendo el buzón de producto de Vivaru**, que es una
> decisión de operación y no de higiene documental. Y enlaza con §4.5: la que además es credencial
> del CRM es `dev@qintilab.com`.
>
> **La forma del error es la de siempre: un plural sin contar.** «Está escrita en un documento» se
> escribió sin medir cuántos eran, dentro de la misma nota que existe para avisar de eso.

**Un documento puede anunciar lo que no entrega, y hay que decirlo.** `RESPUESTA-A-003`
abría con «cerramos por fin la fecha de A1» y su §3 llevaba un marcador vacío. Nombrarlo en
`DECISIONES-A-003` —sin dramatizarlo, reconociendo lo que sí habían mejorado— es lo que
hizo que la siguiente ronda la entregara de verdad.

---

*Documento vivo. Al actualizarlo, reescribir — no acumular. Expediente completo en
`docs/albert-vivaru-integracion.md`.*
