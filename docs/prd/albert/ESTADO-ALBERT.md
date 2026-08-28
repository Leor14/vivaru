# Estado de Albert ↔ Vivaru

> Documento **vivo**: se reescribe, no se acumula. Es el sitio donde mirar para retomar
> sin releer los nueve documentos del intercambio.
> **Actualizado: 27 de agosto de 2026** — el intercambio documental **está cerrado**,
> el alta A5 **está ejecutada**, **A1 está publicado en producción** y la validación de
> `crmRef` **ya está en producción también**. Lo que queda es de otra clase: ver §4.0.
>
> **Las cinco filas de §4.0 se volvieron a medir el 27 de agosto**, cinco días después de
> escribirlas, porque una tabla de «qué existe en el código» envejece sin avisar. **Cuatro
> siguen exactamente igual y una mejoró.** Nada del frente se movió en esos cinco días: la
> jornada fue de diseño y experiencia, que no toca esta superficie.

---

## En una frase

**Ya no hay nada bloqueado por Albert, ni nada pendiente de decidir con ellos.** El
contrato se cerró en nueve documentos, el tenant `vivaru` existe con su usuario de
servicio, y A1 salió en producción **antes** de la ventana comprometida. Lo que queda es
trabajo nuestro —el empuje de leads con su freno, y el camino de supresión— más **una
pregunta técnica de una línea** que hay que hacerles antes de escribir el empuje (§4.4).

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

## 2. El intercambio — CERRADO en nueve documentos

Todos en `docs/prd/albert/`. **`DECISIONES-A-004` lo declara cerrado explícitamente**, y esa
declaración es parte del trabajo: un intercambio que nadie cierra sigue por inercia.

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

Después, fuera del hilo numerado: su **estado de integración** (22 ago) y una **ronda de
dudas** contestada por el canal. Ambos recogidos aquí.

---

## 3. Lo que está CERRADO — el contrato

| Punto | Qué quedó | Estado |
|---|---|---|
| **A1 · Campos propios en el deal** | `externalRef {system,leadId}`, `estimatedUnits`, `country` (ISO-2) + `consent` en el contacto + índice | ✅ **PUBLICADO en producción** el 22 ago, antes de la ventana |
| **A2 · Importe** | `amount: 0` al entrar, cifra al calificar. Sin `is_estimate` | ✅ |
| **B1 · Supresión** | Callable `eraseByExternalRef`, dos llaves, **e idempotente** | 🟡 Por construir (Albert) |
| **B2 · Consentimiento** | **Solo en el contacto**; `acceptedAt` lo pone nuestro servidor | ✅ Decidido |
| **B3 · Retención** | **12 y 12**, `updatedAt` del deal / fecha del borrado. Dos parámetros independientes | ✅ Cerrado. 🟡 Por construir (Albert) |
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

### 4.0 · El estado del código, verificado el 22 de agosto por la tarde

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
registro vivo.

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

### 4.4 · La pregunta de una línea, antes de escribir el empuje

**Su prueba de que A1 está publicado no cubre nuestro camino.** Enseñaron dos evidencias: el
índice LIVE en producción —sólida— y **su web desplegada**. Pero nosotros no escribimos por
su web: `RESPUESTA-A-001` C2 dice que escribimos **con el SDK cliente, directo a Firestore**,
y que *«respeta reglas»*. Su `dealSchema` de Zod corre en su código, no sobre nuestras
escrituras.

Y `RESPUESTA-A-003` §3 dice que A1 va *«sin tocar reglas»*. De ahí salen dos mundos:

- Si las reglas **no** validan la forma del deal → `externalRef` nunca estuvo bloqueado
  para nosotros.
- Si **sí** la validan → A1 necesitaba tocar reglas, y dicen que no las tocó.

> **Preguntar antes de construir el empuje:** *¿qué rechaza hoy un `externalRef` escrito
> directamente a `tenants/vivaru/deals` por el usuario de servicio — las reglas, o solo
> vuestra app?*

**No es urgente. Es barato y evita construir contra un supuesto.**

### 4.5 · El usuario de servicio quedó en un buzón de desarrollo — decisión de David

**Decidido el 22 de agosto de 2026, con el riesgo sobre la mesa.** El contrato (C2) decía
`integracion-vivaru`; el alta lo creó sobre un **buzón de desarrollo compartido de
Qintilab**. **David lo mantiene a propósito:** no hay alias de correo en Albert todavía, y
crear uno frenaría lo que el alta abre. Se corregirá con el tiempo.

**Qué se acepta al elegirlo, dicho para que nadie lo lea como definitivo:**

- **Es un buzón humano compartido.** Quien lo lea puede recuperar esa cuenta, y esa cuenta
  es la credencial con la que Vivaru escribe en el CRM.
- **Es además la identidad con la que se opera el CLI de Firebase de Vivaru** —comprobado
  con `firebase login:list` el 22 de agosto—, o sea la cuenta desde la que se despliega.
  Junta en una sola identidad la que despliega y la que escribe en el CRM. **El Owner de
  `hogaru-1` es otra cuenta**, lo que acota el alcance, pero no lo elimina.
- **La auditoría pierde su asa legible**, porque `createdBy` guarda el `uid` y el correo ya
  no dice «integración de Vivaru». **Mitigación pedida a Albert: que el `displayName` sea
  `integracion-vivaru`**, como fija C2. Con eso, resolver el `uid` sigue dando el nombre.

**La corrección, cuando existan los alias:** recrear el usuario de servicio con dirección
propia. **Hoy es gratis porque no hay ni un deal escrito**; cada deal que se cree estampa
ese `uid` en `createdBy` para siempre y encarece el cambio.

**Y una separación que no cuesta esperar a ningún alias:** que el CLI de Vivaru se
autentique con otra cuenta. Separa las dos funciones ya.

### 4.6 · Nuestra mitad, aún sin escribir

La **contraseña del usuario de servicio en Secret Manager** y el **reseteo de las dos
credenciales**. Aplazados por David el 22 de agosto: no hay prisa porque **nada lee ese
secreto todavía** —cero cableado de Albert en `functions/src`—. Cuando se haga:

1. El enlace de reset del `tenant_admin` es de **vida corta**; el que se envió el 22
   probablemente ya caducó. Habrá que pedir uno nuevo.
2. La contraseña del `tenant_admin` va al **gestor de contraseñas**, no a Secret Manager:
   la usa una persona para entrar.
3. La del usuario de servicio va a **Secret Manager**, staging primero.

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
| **B1** — `eraseByExternalRef` idempotente | 🟡 Por construir. Va después de A1 |
| **B3** — retención programada 12/12 | 🟡 Por construir. Va después de B1 |
| **Nombre del receptor único del canal** | ⟨⟨pendiente de su owner⟩⟩. **No bloquea nada** |
| **Confirmar el `displayName` del usuario de servicio** | Pedido el 22 ago (§4.5) |
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

### El reset self-service en el login de Albert

Hoy **no existe**: recuperar una cuenta depende de que un superadmin genere un enlace. Se
ofrecieron a construirlo.

> **Recomendación: que no lo prioricen por nosotros.** Añadiría recuperación por correo a
> **todas** las cuentas, la del usuario de servicio incluida — justo la segunda llave que
> queremos evitar en una credencial de máquina. Tenemos dos cuentas allí y un superadmin a
> un mensaje. Si lo construyen, que sea por su producto.

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

*Pendiente de decidir: si esas apariciones se limpian o se aceptan. Es un buzón de rol
compartido, no una dirección personal.*

**Un documento puede anunciar lo que no entrega, y hay que decirlo.** `RESPUESTA-A-003`
abría con «cerramos por fin la fecha de A1» y su §3 llevaba un marcador vacío. Nombrarlo en
`DECISIONES-A-003` —sin dramatizarlo, reconociendo lo que sí habían mejorado— es lo que
hizo que la siguiente ronda la entregara de verdad.

---

*Documento vivo. Al actualizarlo, reescribir — no acumular. Expediente completo en
`docs/albert-vivaru-integracion.md`.*
