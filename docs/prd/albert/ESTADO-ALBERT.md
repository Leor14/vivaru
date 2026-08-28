# Estado de Albert ↔ Vivaru

> Documento **vivo**: se reescribe, no se acumula. Es el sitio donde mirar para retomar
> sin releer los nueve documentos del intercambio.
> **Actualizado: 28 de agosto de 2026** — llegó `RESPUESTA-A-005` y **se navegó el tenant
> `vivaru` con la sesión abierta**. Del contrato **no queda nada abierto del lado de Albert**:
> A5 ejecutada, A1 publicado, **B1 y B3 desplegados**, y el `displayName` **confirmado en
> pantalla**. Lo que queda es trabajo nuestro — más **una pregunta nueva que sí condiciona el
> diseño**: §4.4.
>
> **Las cinco filas de §4.0 se midieron el 27 de agosto** y siguen vigentes: el código no se
> ha movido. Lo que cambió el 28 no es código nuestro, es **lo que se supo mirando** — y por
> eso este documento se reescribe en vez de acumular una nota al pie.

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

> **La recomendación se apoya en una premisa SIN CONFIRMAR: que Albert es producto de Qintilab.**
> Su web pública firma «by Somasoft Colombia». **Pendiente de David: preguntárselo a los socios.**
> Si Albert no es de la casa, media argumentación se cae y hay que releer el comparativo.

**Cuándo se reabre:** si Albert dice que no a la clave estable de «ganado»; si las dos preguntas
tardan más de dos semanas; si el alcance deja de ser solo el pipeline —facturar a los conjuntos o
llevar suscripciones cambia el partido—; o si Albert deja de ser de la casa.

---

## En una frase

**Del lado de Albert ya no queda nada: ni bloqueo, ni entrega, ni confirmación pendiente.**
El contrato se cerró en nueve documentos, el tenant `vivaru` existe con su usuario de
servicio, A1 salió antes de la ventana comprometida, y `RESPUESTA-A-005` añade **B1 y B3
desplegados**. Lo que queda es trabajo nuestro —el empuje de leads con su freno, y el camino
de supresión— más **dos preguntas**: una que salió de navegar su producto y condiciona el diseño
(§4.4.1), y otra sobre **cómo nos dan la credencial** (§4.6).

**Y esa pregunta es de otra clase que la que había antes.** La de §4.4 hasta el 28 de agosto
ya estaba contestada dentro de nuestro propio repositorio. La de ahora **no la contesta ningún
documento, porque no se ve leyendo: se vio usando su consola.**

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

## 2. El intercambio — cerrado en nueve documentos, **reabierto una vez y por buen motivo**

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
| **Nombre del receptor único del canal** | ⟨⟨pendiente de su owner⟩⟩. **No bloquea nada** |
| **`displayName` del usuario de servicio** | ✅ **Confirmado en pantalla el 28 ago**: `integracion-vivaru` |
| **Clave estable para «ganado»** | 🟡 **Preguntado en `DECISIONES-A-005` §3.** Bloquea **diseño** |
| **Credencial de la señal de vuelta** | 🟡 **Preguntado en `DECISIONES-A-005` §4**: cuenta de servicio en vez de contraseña. Bloquea **ejecución** |
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
