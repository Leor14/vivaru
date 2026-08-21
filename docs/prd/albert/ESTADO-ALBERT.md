# Estado de Albert ↔ Vivaru

> Documento **vivo**: se reescribe, no se acumula. Es el sitio donde mirar para retomar
> sin releer los cuatro documentos del intercambio.
> **Actualizado: 21 de agosto de 2026** — los dos números de retención ya están decididos
> (§4.2). Lo que queda de ellos es comunicarlos, no pensarlos.

---

## En una frase

**El contrato técnico está cerrado y no queda ninguna pregunta abierta con Albert.** Lo
que falta es de dos clases: **dos mensajes que tiene que mandar David** —el correo del
`tenant_admin` para el alta, y los dos números de retención ya decididos— y **dos piezas
que Vivaru tiene que construir**: el freno de la invariante y las referencias
cruzadas. **Ya no queda nada por decidir.** Albert no
bloquea nada salvo la fecha de su propio A1, y esa no bloquea construir — solo probar.

---

## Lo primero mañana, por orden

| # | Qué | Quién | Por qué primero |
|---|---|---|---|
| **1** | **Mandar el `tenant_admin` por el canal** — decidido: `comercial@qintilab.com` | **David** | Es un mensaje, y **abre la segunda mitad de `REVOPS-001C`** (ver §5). Sin alta no hay usuario de servicio; sin usuario de servicio no hay credencial con la que leer sus deals. **Ojo: es provisional, ver abajo** |
| **2** | **Mandar `DECISIONES-A-002`** — retención, canal y fecha de A1 | **David** | Ya redactado y sin mandar. Cierra su B3 y reclama lo único que él debe |
| **3** | Construir el freno de la invariante contacto→deal | Técnico | Es una promesa que hoy no vigila nadie. Ver §4.1 |
| **4** | Validar las dos referencias cruzadas | Técnico | Una es texto libre sin validar; la otra no existe. Ver §4.3 |

**Ojo con el correo del punto 1:** Albert pide **expresamente** que no vaya dentro de
ningún documento del intercambio, sino por el canal. Por eso **no está** en
`DECISIONES-A-002` —comprobado, el documento no contiene ninguna dirección— y **no debe
añadirse ahí**.

#### El `tenant_admin` es `comercial@qintilab.com`, y es provisional a propósito

**Decidido por David el 21 de agosto de 2026, con el riesgo sobre la mesa.** El motivo es
que **Vivaru no tiene hoy ningún buzón propio que sirva**, y habría que crearlo — y crear
un buzón no puede frenar una semana lo que abre `REVOPS-001C`.

**Qué se acepta al elegirlo.** No es un buzón personal: el propio repositorio lo describe
como *«un buzón compartido, admite lista separada por comas»*, y es el destino de todos
los avisos de leads y demos en producción. Consecuencias reales:

- **Quien lea ese buzón puede recuperar la cuenta** y, con ella, reconfigurar el pipeline
  — la etapa «en prueba» incluida, que es lo único que el `tenant_admin` protege.
- **Al ser `@qintilab.com`**, el dominio que comparten Vivaru y Albert, la frase que
  repiten los cuatro documentos —el `tenant_admin` es nuestro «para que en prueba no
  dependa de nadie más»— **no es del todo cierta en la práctica**. Queda dicho aquí para
  que nadie la lea como garantía.
- **Mezcla dos funciones:** el buzón que recibe los leads pasa a ser también la identidad
  que administra el CRM donde esos leads acaban.

**La corrección, cuando exista un buzón de Vivaru.** Cambiar el `tenant_admin` después es
barato: se le pide a un superadmin de Albert. **El criterio no es el dominio, es quién
puede leerlo** — una dirección dedicada deja el control de recuperación donde debe estar.

**Y un desprendimiento que no es de este expediente pero salió aquí.** El dominio
`grupovivaru.com` tiene **cuatro direcciones publicadas en los documentos legales del
sitio**: `privacidad@` (canal para ejercer derechos y reportar incidentes, citado siete
veces en la política de privacidad), `soporte@` (con tiempos de respuesta comprometidos
en los términos), `facturacion@` y `hola@` (correo de contacto de Qintilab S.A.S., junto
al NIT). **Si esos buzones no reciben, es un problema mayor que éste** — no se pudo
comprobar desde el repositorio.

**El canal: uno, no dos.** Los documentos de ambos lados hablaban de un «canal aparte» y
un «canal de coordinación» como si fueran distintos, y **ninguno decía cuál era**.
`DECISIONES-A-002` §2 propone **un único canal por correo** con una regla de una línea:
*el repositorio lleva las decisiones; el correo lleva los datos personales, las
credenciales y las fechas.* Pendiente de que Albert confirme quién lo recibe.

**Y algo que no estaba escrito en ninguna parte:** cuando Albert devuelva el usuario de
servicio, **esa credencial no entra en el repositorio** — va a Secret Manager, como la
clave de Resend. Queda fijado en `DECISIONES-A-002` §2 *antes* de que la credencial
exista, que es cuando se puede fijar sin prisa.

---

## 1. Qué es esto y por qué existe

**Albert CRM es propiedad de Qintilab, igual que Vivaru. No es un tercero.** La decisión
de los socios del 17 de agosto de 2026 no fue «conectar Albert con Vivaru»: fue **adaptar
Albert a las reglas de negocio de Vivaru**, y el mecanismo es que **Vivaru redacta PRDs y
Albert los desarrolla**.

El propósito excede al CRM: estrena la hipótesis de que **las soluciones de Qintilab se
adaptan a la naturaleza de cada cliente**, y no al revés. Vivaru es el primer caso.

**Vivaru es tenant de Albert.** Ese encuadre —decidido en la ronda de agosto— es el que
tumba media lista de bloqueos antiguos, y es el detalle que más veces se ha olvidado al
leer documentos viejos. Ver §5.

---

## 2. El intercambio, en cuatro documentos

Todos en `docs/prd/albert/`.

| Documento | Fecha | Qué es |
|---|---|---|
| `CONSULTA-A-001-preguntas-para-albert.md` | 19 ago | Trece preguntas de Vivaru, ordenadas por urgencia |
| `RESPUESTA-A-001-albert-a-vivaru.md` | 19 ago | Las contesta todas, citando `archivo:línea` de su repo. **Aquí está el C1 que desbloquea `REVOPS-001C`** |
| `DECISIONES-A-001-vivaru-a-albert.md` | 19 ago | Vivaru cierra las seis decisiones y **le nombra dos contradicciones de su propia respuesta** |
| `RESPUESTA-A-002-albert-a-vivaru.md` | 19 ago | **Nos da la razón en las dos sin regatear**, confirma las seis y corrige su frase «sin PII» |
| `DECISIONES-A-002-vivaru-a-albert.md` | **21 ago** | **REDACTADO, SIN MANDAR.** Los dos números de retención (12 y 12, con la frase del reloj), la propuesta de **un solo canal**, y la reclamación de la fecha de A1 |

Además: `PRD-A-OPS-001-vista-de-leads-vivaru.md` — el primer PRD, en borrador, con el §5
(flujos comerciales) en `TBD`.

---

## 3. Lo que está CERRADO — el contrato

No hace falta volver a discutir nada de esto.

| Punto | Qué quedó |
|---|---|
| **A1 · Campos propios en el deal** | Bloque **tipado y opcional**, no un mapa genérico: `externalRef {system:"vivaru", leadId}`, `estimatedUnits`, `country` (ISO de dos letras). Aditivo, sin migración. Más un índice sobre `externalRef.leadId` |
| **A2 · Importe** | `amount: 0` al entrar, cifra al calificar. **Sin campo `is_estimate`.** Un `0` no distorsiona el ingreso ganado ni el forecast |
| **B1 · Supresión** | Callable `eraseByExternalRef`, y acepta **las dos llaves**: `{tenantId, vivaruLeadId}` y `{tenantId, dealId}` |
| **B2 · Consentimiento** | **Solo en el contacto**, retirado del deal. `acceptedAt` lo pone el servidor de Vivaru |
| **B3 · Retención** | Criterio: **`updatedAt` del deal**. La N queda **parametrizable**, no cableada |
| **C1 · Leer sus deals** | **Sí, sin impedimento.** Ver §5 — es lo más importante del expediente |
| **C2 · Identidad de escritura** | **Usuario de servicio del tenant**, sin Cloud Function intermedia. `displayName` = `integracion-vivaru`, rol `sales` |
| **A5 · Alta del tenant** | `tenantId` = `vivaru`. Es **operación, no desarrollo**: lo ejecuta un superadmin de Albert |

**Dos precisiones suyas que conviene no olvidar:**

- **La auditoría guarda el `uid`, no el nombre legible.** En `createdBy`/`updatedBy`
  quedará el `uid` del usuario de servicio, no la cadena `integracion-vivaru`. La
  trazabilidad existe, pero se resuelve mirando el documento del usuario.
- **Normalizan el correo a minúsculas.** Cualquier cruce nuestro debe normalizar igual o
  fallará **en silencio**.

**Y una cosa que ya está bien de nuestro lado:** el `country` que Vivaru empezó a guardar
el 19 de agosto **ya encaja** con lo que pide — código ISO de dos letras, salido de un
selector cerrado. No hay que rehacerlo. Verificado leyendo el código.

---

## 4. Lo que le toca a VIVARU

Esto es la deuda real, y toda es nuestra.

### 4.1 · Una promesa que hoy no vigila nadie

Albert se negó —**con razón**— a hacer `contactId` obligatorio en su esquema, porque
rompería a sus usuarios actuales que crean deals sueltos. En su lugar **aceptó nuestra
palabra**: Vivaru creará siempre el contacto **antes** del deal. Lo llama literalmente
*«invariante del lado de Vivaru»*.

**Traducido:** si algún día nuestro código crea un deal sin contacto, el consentimiento
no tendrá dónde guardarse y **ningún sistema nos avisará**. Dejó de ser una regla y pasó
a ser una promesa.

**Pendiente:** un freno nuestro que lo impida. No un comentario — algo que falle.

### 4.2 · Dos números de retención · **DECIDIDOS el 21 de agosto de 2026**

**Los dos son 12 meses.** David eligió la cifra de la casa para las dos ventanas.
Documento completo, con el razonamiento y el riesgo aceptado:
[`docs/politica-retencion-datos.md`](../../politica-retencion-datos.md).

| Número | Qué es | **Decidido** |
|---|---|---|
| **N.º 1** | Cuánto vive un deal **sin actividad** antes de anonimizarse (criterio: su `updatedAt`) | **12 meses** — Albert proponía 24 |
| **N.º 2** | Cuánto vive el **registro de auditoría del borrado** (`vivaruLeadId`, `dealId`, fecha, actor) | **12 meses**, contados **desde la fecha del borrado**, no desde la del deal |

**Por qué existe el segundo.** Vivaru le señaló que llamar «sin PII» a ese registro era
impreciso: mientras el lead exista de nuestro lado, `vivaruLeadId` **reidentifica**.
Albert lo aceptó, declaró la base legal —acreditar que se ejerció el derecho de
supresión— y dijo que ese registro **no vive para siempre**, sino con ventana propia.
Esa ventana es el segundo número.

**Por qué 12 y no los 24 de Albert.** Este documento sostenía que «Vivaru tampoco tiene
política de retención escrita». **Escrita no la había; números sí.** Al ir a mirar el
código aparecieron **tres ventanas ya corriendo en producción todas las noches a las
03:00, y las tres dicen 12 meses**: la PII de los comprobantes, `aiUsage` y `aiFeedback`.
Los 24 de Albert son su contexto comercial, no el nuestro, y el campo es parametrizable
para que subirlo después salga barato.

**El riesgo que se acepta en el n.º 2, dicho aquí también:** a los 18 meses no habrá con
qué demostrar que un borrado ocurrió. Es la contrapartida de minimizar la
reidentificación, y está elegida a ojos abiertos — no es un olvido.

**Al mandárselos, incluir la frase del reloj:** «12 meses **desde la fecha del borrado**».
Sin eso el n.º 2 es ambiguo y podría implementarse contra el reloj del deal.

**Ya no bloquea el B3.** Lo que falta para cerrarlo es mandárselos.

### 4.3 · Dos referencias cruzadas que validar, no una

| Dirección | Campo | Formato | Estado hoy |
|---|---|---|---|
| **Albert → Vivaru** | `crmRef` | Deals: `albert:deal:{tenantId}:{dealId}`. Comerciales: **el `uid` crudo** de Firebase Auth (~28 chars) | **Texto libre sin ninguna validación**, en el catálogo de comerciales y en leads. Verificado leyendo el código |
| **Vivaru → Albert** | `externalRef.leadId` | `{system:"vivaru", leadId}` | **No existe en nuestro código**: cero apariciones |

**Por qué el `dealId` suelto no sirve:** el deal vive bajo su tenant, así que sin el
`tenantId` no resuelve.

---

## 5. La corrección que más cambia el plan

> **La segunda mitad de `REVOPS-001C` NUNCA estuvo bloqueada por Albert, y tres
> documentos de Vivaru decían que sí.** Corregido el 20 de agosto de 2026 en
> `pendientes.md`, `roadmap-revops.md` y `roadmap-producto.md`.

**Qué decían:** «Albert no tiene webhooks; `REVOPS-001C` depende de construirla».

**Qué dice Albert, desde el 19, en `RESPUESTA-A-001` C1:**

> **«SÍ, sin nada que os lo impida. El trigger queda fuera del camino crítico.»**

Con la regla citada: `match /deals/{docId} { allow read: if canReadTenant(tenantId); }`,
y `canReadTenant` incluye **todos** los roles del tenant — `sales` entre ellos, que es
justo el rol del usuario de servicio de C2.

**Traducido:** Vivaru se **suscribe en vivo** (`onSnapshot`) a `tenants/vivaru/deals` y ve
la conversión al instante. **Sin webhook, sin trigger, sin OIDC** — Albert descarta los
tres explícitamente.

**Por qué se coló el error, que es lo que hay que llevarse:** la frase era **cierta**
mientras Vivaru fuese un tercero consumiendo su API. Dejó de serlo al convertirse en
**tenant** suyo. Y ese tipo de muerte **no deja rastro**: ni commit, ni prueba en rojo,
ni error en pantalla. Solo deja una frase obsoleta que nadie contradice.
**Una dependencia se cae por dejar de necesitarla, no solo porque alguien la construya.**

**Lo único que falta para abrirla es el alta del tenant (A5)** — sin el usuario de
servicio no hay credencial con la que suscribirse. Por eso el correo del punto 1 no es
un trámite.

**Y `RESPUESTA-A-002` no menciona la señal de vuelta** (se buscaron *webhook*, *señal de
vuelta*, *activación*, *suscripción*, *disparador*: ninguna aparece). **No hacía falta
que la mencionara** — ya estaba contestada en la ronda anterior. Buscar en el documento
equivocado lleva a concluir «sigue parado» cuando está abierto.

---

## 6. Lo que le toca a ALBERT

| Qué | Estado |
|---|---|
| **Construir A1** (extender los dos esquemas + el índice) | Confirmado, «cabe en días», y lo pone **por delante** de B1 y del precio |
| **Construir B1** (la callable de supresión) | Confirmado, 🔧 mediano |
| **Construir B3** (la función programada de retención) | Confirmado. **Los dos números ya están decididos (12 y 12); espera que se los mandemos** |
| **Ejecutar el alta A5** | **Espera el correo del `tenant_admin`** |

**Devuelve tras el alta:** el `uid` del `tenant_admin`, el `uid` y correo del usuario de
servicio, y confirmación del documento `tenants/vivaru`.

**Un hallazgo suyo que conviene conocer.** Al verificar B1 descubrieron que el dato
personal de su timeline **no está en campos estructurados**, sino **embebido en el texto
de cada evento** (`Contacto creado: Juan Pérez`). Borrar el contacto no basta: el nombre
sobrevive en el mensaje. La anonimización tiene que **reescribir los mensajes**, no
vaciar campos. Es trabajo suyo, pero hace la supresión más frágil de lo que se suponía.

---

## 7. Lo que NADIE tiene y sigue SIN compromiso

### El motor de mensajería — **el hueco que importa**

Sin control de **opt-out y frecuencia**, el `consent` que se acaba de diseñar **no tiene
quién lo respete a la hora de enviar**. Se construyó el candado y no la puerta.

**Lo nombra Albert mismo**, y es honesto: la lleva a priorización de producto, pero
**«aún no está en un roadmap comprometido»** y dice que no puede dar un sí firme hoy.
Quedó el acuerdo de que avisará claro —también si sale que no— **para que Vivaru no la
escriba esperándolos**.

**No bloquea nada hoy. Bloqueará el día que se manden correos de verdad.**

### La agenda de demos

**No se pide y no se construye.** Con cero clientes firmados es infraestructura para una
demanda inexistente. El formulario aguanta para una persona prospectando.

### El precio de plan

**Lo cablea Vivaru sin esperarlos**, y Albert confirma que no bloquea nada de su lado.
Primera mitad de `REVOPS-001C`, **ya construida y en producción** desde el 20 de agosto.

---

## 8. Lo único que Albert NO cierra por escrito

**La fecha de calendario de A1.** Dice que el trabajo «cabe en días, no semanas» y que lo
eleva como primer incremento, pero se niega a poner fecha porque **la fija su owner**, y
argumenta que escribirla sin él sería inventarla.

**Consecuencia práctica, y no es menor:** Vivaru puede **construir** contra un contrato
ya cerrado, **pero no probar el circuito completo** hasta que Albert publique. La ventana
concreta la confirma su owner por el canal de coordinación.

---

## 9. Tres imprecisiones suyas, nombradas

No son errores nuestros y ninguna cambia una decisión, pero quedan registradas porque
adoptarlas como criterio sí costaría.

1. **`consent` en dos sitios a la vez** (`RESPUESTA-A-001`). Su bloque de A1 lo metía en
   el deal y su B2 lo recomendaba en el contacto. **Resuelto en A-002:** solo en el
   contacto.
2. **Un deal huérfano no podía guardar consentimiento.** Su propio A3 confirmaba que
   `contactId` es opcional. **Resuelto en A-002**, por nuestra invariante (§4.1).
3. **La justificación del índice no se sostiene.** Dice que sin él la consulta «degrada
   al crecer». No es cierto para una igualdad simple: ese campo se indexa solo y el coste
   depende de cuántos resultados devuelve, no del tamaño de la colección. **El índice es
   barato y no estorba** — no vale la pena discutirlo, pero **no adoptar ese motivo** como
   criterio para futuros índices.

---

## 10. Riesgo de fondo, dicho en voz alta

**Se está especificando un CRM a medida con cero recorrido comercial registrado.**
Diseñar sobre supuestos es justo lo que el roadmap prohíbe en `ONB-001` y `AI-ONB-001`, y
no deja de aplicar porque quien construya sea de casa.

**La mitigación no es esperar, es de dónde salen los requisitos:** la conversación de
`REVOPS-000` con los comerciales —que corrigió la premisa y dejó claro que **no son cinco
vendiendo, sino una persona prospectando en frío con cero firmados**— es la entrada del
PRD, no solo línea base. Sin ella, el primer PRD describiría el CRM que nos imaginamos.

De ahí salió además una regla que nadie había pedido: **la lista fría NO entra al CRM.**

---

*Documento vivo. Al actualizarlo, reescribir — no acumular. Expediente completo en
`docs/albert-vivaru-integracion.md`; los cuatro documentos del intercambio, en esta misma
carpeta.*
