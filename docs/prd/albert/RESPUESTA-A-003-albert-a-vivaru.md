# RESPUESTA-A-003 — Albert → Vivaru

> **Archivado el 28 de agosto de 2026, íntegro.** Llegó por el canal y estuvo fuera del
> repositorio hasta hoy, aunque el estado del frente lo citaba. Se revisó carácter a carácter
> y **no contiene ningún identificador, credencial ni dato personal**: no hizo falta retirar
> nada.

> **En una frase:** aceptamos **12 y 12** y os damos la opinión que pedís sobre el
> segundo número —con un matiz que juega a vuestro favor—; decimos **sí al canal único**
> con vuestra regla tal cual; y cerramos por fin **la fecha de A1**, que era lo único que
> os debíamos.

| | |
|---|---|
| **De** | Equipo de Albert CRM |
| **Para** | David (Vivaru / Qintilab) |
| **Responde a** | `DECISIONES-A-002` (v0.1, 21-ago-2026) |
| **Proyecto** | `albert-crm-1-1c162` · functions en `us-central1` |
| **Fuentes nuevas citadas** | `firestore.rules:85-100` (`timeline`, `approvals`, `auditEvents`) · `shared/src/schemas/audit.ts` |

Convención (igual que en A-001/A-002): ✅ **existe hoy** · 🔧 **requiere construcción** · ⚖️ **decisión de producto/negocio**.

Gracias por la ronda corta. Coincidimos en que el contrato técnico está cerrado; esto solo
ata los tres cabos que dejasteis abiertos.

---

## 1 · B3 — aceptamos **12 y 12**, y respondemos lo que nos preguntáis

**Los dos números, aceptados** ✅⚖️

| Número | Qué | Aceptado |
|---|---|---|
| **N.º 1** | Deal sin actividad → anonimización, criterio `updatedAt` | **12 meses** |
| **N.º 2** | Registro de auditoría del borrado (`vivaruLeadId`, `dealId`, fecha, actor) | **12 meses, contados desde la fecha del borrado** |

Anotada la precisión de los **dos relojes distintos**, y la cableamos exactamente así: N.º 1
se mide contra `updatedAt` del deal; N.º 2 contra la fecha del propio evento de supresión.
No los mezclamos.

### Primero, un hecho de código que respalda vuestra precisión de «dos relojes»

No son dos relojes solo en la política: **son dos relojes en el modelo de datos**, y eso es
lo que hace que la separación sea real y no una promesa.

- El registro de supresión no vive bajo el deal. Vive en **`tenants/vivaru/auditEvents`**,
  que es una colección **hermana** de `/deals`, no hija. Está sellada a escritura de
  cliente —`allow write: if false` (`firestore.rules:98-100`)—, así que solo la escribe una
  Function con Admin SDK y **nadie la puede alterar ni borrar desde el cliente**; la lectura
  queda restringida a `superadmin`/`tenant_admin`.
- Consecuencia: la **cascada de borrado de B1** (que arrasa el deal y su subárbol) **no
  llega** al `auditEvents`, y el **barrido de B3·N.º 1** (que busca *deals* por `updatedAt`)
  **tampoco** lo toca. Cada reloj corre sobre una colección distinta, con su propio job
  programado. La separación es estructural, no de configuración.

Es decir: el registro que prueba que el borrado ocurrió es, por diseño, **inmutable y
sobrevive al borrado que documenta**. Eso es lo que hace que 12 —o el número que sea—
signifique algo.

### La pregunta que nos hacéis: ¿12 se queda corto para el N.º 2?

Nos lo preguntáis en serio, así que respondemos en serio —y con la etiqueta por delante:
**esto es nuestra lectura de ingeniería/producto, no asesoría legal; el número vinculante
lo fija vuestro DPO.**

**Nuestra lectura corta: 12 es defendible, pero para el N.º 2 nos inclinamos a que sea más
largo que el N.º 1 —y el motivo que os llevó a 12 aquí pesa menos de lo que parece.**

El razonamiento, en tres pasos:

1. **El N.º 2 es el artefacto más barato y menos arriesgado que conserváis, y a la vez el
   único que prueba que cumplisteis.** Vaciar antes esa prueba no reduce datos personales de
   forma apreciable —son cuatro campos seudonimizados— pero sí os deja sin con qué acreditar
   la supresión si la reclamación llega tarde. La asimetría no está equilibrada: se arriesga
   mucho (la prueba) para ahorrar poco (cuatro campos).

2. **El argumento de reidentificación que os empujó a 12 se neutraliza casi entero en este
   caso concreto.** `vivaruLeadId` solo reidentifica **mientras el lead siga existiendo de
   vuestro lado** —eso es exactamente lo que nos señalasteis en la ronda anterior, y tenéis
   razón—. Pero la premisa entera de este borrado es que el lead **ya no existe** en Vivaru.
   Una vez suprimido en origen, el `vivaruLeadId` de nuestro `auditEvents` es un **puntero
   colgante que no apunta a ningún registro vivo**: deja de reidentificar a una persona
   localizable. El riesgo que justifica acortar el N.º 2 se apaga justo cuando el borrado se
   completa en los dos lados.

3. **Por tanto, la coherencia con «los 12 de la casa» os cuesta aquí más de lo que os
   ahorra.** Vuestras otras tres ventanas de 12 (comprobantes, telemetría de IA, feedback de
   borradores) son datos que **siguen vivos y reidentificando** durante esos 12 meses; ahí 12
   es una decisión de minimización con sentido. El registro de supresión es lo contrario: un
   dato que **deja de reidentificar** en cuanto cumple su función. Meter los dos bajo el mismo
   número trata igual dos cosas que el propio criterio de reidentificación distingue.

**Qué recomendamos, en concreto —y sin pediros que cambiéis nada hoy:**

Vosotros nombrasteis el riesgo exacto: «a los 18 meses no podréis probar que el borrado
ocurrió». Si vuestro DPO confirma que la ventana en la que un titular puede reclamar ante la
SIC (Colombia) o el INAI (México) por una supresión presuntamente no ejecutada es **mayor de
12 meses** —que es lo habitual—, entonces 12 para el N.º 2 es precisamente ese hueco.

Lo bueno es que **no tenéis que decidirlo ahora ni decidirlo una sola vez para los dos
relojes.** Como construimos la N **parametrizable** (os lo confirmamos en A-002), **N.º 1 y
N.º 2 son dos parámetros de configuración independientes**, no uno. Podéis dejar **N.º 1 = 12
en firme hoy** y fijar **N.º 2 en lo que vuestro DPO acabe determinando**, más tarde, como
cambio de config y no de código. Nuestra recomendación de partida: **N.º 2 alineado a la
ventana de reclamación, probablemente 24 o 36 meses**, no 12. Pero es vuestra llamada, y la
respetamos: si aun así elegís 12 por coherencia de casa, lo cableamos sin objeción y queda
por escrito que os avisamos del hueco.

> En una frase: **N.º 1 = 12, cerrado. N.º 2 = 12 es defendible, pero como el registro deja
> de reidentificar en cuanto el lead muere en Vivaru, os recomendamos alargarlo a la ventana
> de reclamación; y como son dos parámetros distintos, podéis subir solo ese, luego, sin
> tocar código.**

---

## 2 · El canal — **sí, uno solo**, con vuestra regla tal cual

De acuerdo en todo, sin matices:

- **Un único canal por correo** entre David y quien designemos por nuestra parte. Dos canales
  con nombre para dos equipos pequeños es una forma garantizada de perder la mitad de las
  cosas. Aceptado.
- **La regla, adoptada literalmente:** *el repositorio lleva las decisiones; el correo lleva
  los datos personales, las credenciales y las fechas.* Es exactamente la línea que ya
  respetábamos al no meter el correo del `tenant_admin` en el documento; ahora queda como
  norma común.
- **Secret Manager para la credencial de servicio: confirmado, y coincide con cómo ya
  operamos.** La credencial del usuario `integracion-vivaru` **no entra en el repositorio**;
  va a Secret Manager como el resto de nuestros secretos (es el mecanismo que `apphosting.yaml`
  ya contempla para *secret parameters*). Lo dejamos por escrito antes de que exista la
  credencial, como pedís.

**Qué viaja, confirmado por nuestra parte:**

| Dirección | Qué |
|---|---|
| **Vivaru → Albert** | El correo del `tenant_admin` para el alta A5 |
| **Albert → Vivaru** | El `uid` del `tenant_admin`; el `uid` **y** correo del usuario de servicio; la confirmación del doc `tenants/vivaru` |
| **Albert → Vivaru** | La fecha de A1 (§3) |

**Quién lo recibe por nuestra parte —y por qué el nombre no va en este documento.** Nos
pedís que confirmemos el receptor. Por vuestra propia regla —que compartimos— **el correo de
esa persona es un dato personal y no va en el repositorio**: sale por el canal. Lo que sí
fijamos aquí es el compromiso: nuestro owner designa un receptor único y os lo confirmamos
por correo en el primer mensaje del canal, junto con la fecha de A1.

> ⟨⟨PENDIENTE-OWNER: nombre del receptor por parte de Albert. Su correo va por el canal, no
> en el documento.⟩⟩

---

## 3 · La fecha de A1 — la cerramos aquí

Tenéis razón, y no la esquivamos. El 19 dijimos «lo primero que cerramos» y el 21 seguía sin
llegar; eso es nuestro, no vuestro. Lo dijisteis con precisión: la fecha no bloquea que
**construyáis** contra el contrato, pero bloquea que **probéis** el circuito, y saber si son
días o semanas decide si esa prueba entra en esta iteración o en la siguiente. Por eso lo
cerramos ahora y no lo volvemos a mandar «al canal».

**Lo técnico, reconfirmado** ✅🔧: A1 es pequeño y aditivo —extender `dealSchema` con el
bloque opcional + extender `contactSchema` con `consent` + índice sobre `externalRef.leadId`—,
sin migración de datos y sin tocar reglas. Días, no semanas. Va **primero**, por delante de B1
y del precio de plan.

**La fecha de calendario, comprometida:**

> ⟨⟨PENDIENTE-OWNER: fecha de publicación de A1 en producción — p. ej. «A1 publicado el
> viernes 28-ago-2026» o «semana del 1-sep». La fija el owner de Albert; en cuanto la tengamos
> queda escrita aquí y confirmada por el canal.⟩⟩

En cuanto A1 esté publicado, el orden acordado sigue en pie: A1 → B1 → A2/A5 en paralelo →
C/D. Y os avisamos por el canal el día que quede desplegado, para que arranquéis la prueba del
circuito completo.

---

## 4 · Vuestro lado (§4) — acuse, y todo alineado

No nos pedís nada aquí; solo confirmamos que lo vuestro encaja con lo nuestro.

| Qué (vuestro) | Nuestra lectura |
|---|---|
| **Invariante contacto→deal → «algo que falle»** | Correcto y es lo que necesitamos: mientras sea un comentario, un deal huérfano vuelve a ser posible por vuestra vía. Convertirla en una comprobación que rompe es justo lo que cierra la contradicción 2 sin que toquemos `contactId`. |
| **`externalRef.leadId` aún no existe de vuestro lado** | Alineado: tampoco existe del nuestro hasta que publiquemos A1. Es la primera pieza que os desbloquea; por eso A1 va primero (§3). |
| **`crmRef` validado contra los dos formatos** | Bien. Recordatorio de simetría: nuestros dos formatos son `albert:deal:{tenantId}:{dealId}` y `albert:user:{uid}` (A-001, A5d). Validad contra esos. |
| **Precio de plan, en producción desde el 20-ago** | Recibido, y coincide con lo que acordamos en D1: era vuestro para cablear sin esperarnos. Cero impacto de nuestro lado; los límites de plan siguen sin aplicarse (A5c). |

---

## Resumen — un renglón por cosa

| # | Punto | Respuesta de Albert |
|---|---|---|
| **B3 · N.º 1** | Deal sin actividad | ✅ **12 meses**, criterio `updatedAt`. Cerrado. |
| **B3 · N.º 2** | Registro de auditoría del borrado | ✅ **12 aceptado y cableable**, pero **recomendamos alargarlo** (24–36m, ventana de reclamación): el registro deja de reidentificar en cuanto el lead muere en Vivaru. Son **dos parámetros independientes**; podéis subir solo ese, luego, sin tocar código. |
| **Dos relojes** | ¿Separación real? | ✅ Sí, **estructural**: el log vive en `auditEvents` (hermano de `/deals`, `write:false`), fuera del alcance de la cascada de B1 y del barrido de N.º 1. |
| **Canal** | ¿Uno o dos? | ✅ **Uno**, por correo, con vuestra regla literal. Credencial de servicio → **Secret Manager**, nunca al repo. |
| **A5 · receptor** | ¿Quién recibe? | Owner lo designa; **nombre por el canal** (su correo es dato personal, no va al doc). ⟨⟨pendiente-owner⟩⟩ |
| **A1** | Fecha | La **cerramos aquí**, no en «el canal». Técnicamente días, va primero. ⟨⟨fecha pendiente-owner⟩⟩ |
| **§4** | Vuestro lado | Todo alineado: invariante que falla ✅, `externalRef` tras A1 ✅, `crmRef` vs. 2 formatos ✅, precio de plan ✅. |

---

*Albert CRM — respuesta a DECISIONES-A-002 · afirmaciones citadas al código del repo `albertcrm` · los dos únicos marcadores ⟨⟨pendiente-owner⟩⟩ (fecha de A1 y receptor del canal) son decisiones del owner, no hechos de código, y por eso no los inventamos en el documento.*
