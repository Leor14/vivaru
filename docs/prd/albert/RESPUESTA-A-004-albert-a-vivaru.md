# RESPUESTA-A-004 — Albert → Vivaru

> **Archivado el 28 de agosto de 2026, íntegro.** Llegó por el canal y estuvo fuera del
> repositorio hasta hoy, aunque el estado del frente lo citaba. Se revisó carácter a carácter
> y **no contiene ningún identificador, credencial ni dato personal**: no hizo falta retirar
> nada.

> **En una frase:** tenéis razón en las tres —el N.º 2 se queda en 12 porque nuestra premisa
> aún no se cumple, `crmRef` lo resolvemos con vuestro envoltorio, y el bucle del receptor se
> rompe como decís—; y esta vez sí os damos lo que pedíais: **A1 sale en días, esta semana**,
> con lo que el circuito se prueba en esta iteración.

| | |
|---|---|
| **De** | Equipo de Albert CRM |
| **Para** | David (Vivaru / Qintilab) |
| **Responde a** | `DECISIONES-A-003` (v0.1, 22-ago-2026) |
| **Proyecto** | `albert-crm-1-1c162` · functions en `us-central1` |
| **Fuentes citadas** | A-001 §A5d · A-003 §4 · `firestore.rules:98-100` |

Convención (igual que en A-001…A-003): ✅ **existe hoy** · 🔧 **requiere construcción** · ⚖️ **decisión de producto/negocio**.

Ronda de concesiones más que de contrato. Vamos punto por punto y sin regatear donde acertáis.

---

## 1 · B3 · N.º 2 — tenéis razón: **12 y 12**, y el disparador es vuestro, no una fecha

**Aceptamos vuestra medición y la conclusión.** Fuisteis a mirar el código —el vuestro esta
vez— y encontrasteis que la premisa de nuestro paso 2 no se cumple hoy:

- `eraseByExternalRef` no se invoca desde Vivaru (cero llamadas).
- No hay ventana de retención sobre vuestros `leads`.

De donde se sigue, correctamente, que **hoy nada borra un lead de vuestro lado**, así que el
`vivaruLeadId` de nuestro `auditEvents` apunta a un lead **vivo** y **sigue reidentificando**.
Nuestro argumento no era falso: era **condicional**, y la condición —que el borrado se
complete también en origen— es una pieza vuestra que aún no existe. Dicho de otro modo:
teníais razón en elegir 12, y teníamos razón en describir cuándo dejaría de aplicar; las dos
cosas caben.

**Por tanto, cerrado así, y lo cableamos tal cual:**

> **N.º 1 = 12 meses, firme** (criterio `updatedAt`).
> **N.º 2 = 12 meses hoy**, porque el puntero no cuelga: nada borra el lead en Vivaru.
> **Disparador para subir el N.º 2 — no una fecha ni una opinión:** que exista en Vivaru un
> camino de supresión que **borre el lead y llame a `eraseByExternalRef` en la misma
> operación**. El día que exista, el puntero cuelga de verdad y el N.º 2 sube como cambio de
> config, no de código.

**Que el disparador no se pierda: lo escribimos como condición nombrada.** Un disparador que
vive solo en el hilo de dos documentos se olvida. Proponemos anotarlo en la política de
retención de ambos lados como una **condición de vigilancia** explícita —p. ej. *«N.º 2
permanece en 12m mientras `eraseByExternalRef` no reciba llamadas de supresión originadas en
Vivaru; al activarse ese camino, revisar al alza»*—. Así el día que cambie el estado, el
número se revisa porque está escrito que debe revisarse, no porque alguien se acuerde.

**Un aporte técnico para cuando construyáis ese camino de supresión.** Vais a querer *«borrar
el lead + `eraseByExternalRef` en una sola operación»*. Para que esa operación sea segura
ante un fallo a medias (borrasteis el lead pero la llamada a Albert se cortó), **hacemos
`eraseByExternalRef` idempotente**: llamarla dos veces con el mismo `vivaruLeadId` produce el
mismo estado final y no falla la segunda vez (si el deal ya no está, devuelve «nada que
hacer», no error). Así vuestro lado puede **reintentar** sin miedo a doble efecto. 🔧 Lo
dejamos anotado como requisito de esa callable, no como algo aparte.

**Sobre el DPO — aceptado y corregido.** Tenéis razón: escribimos tres veces «lo fija vuestro
DPO» y no hay DPO nombrado. Retiramos la fórmula. La decisión del N.º 2 es **vuestra, tomada
con la información disponible**, y queda por escrito lo que corresponde a cada uno: vosotros
nos avisasteis de que la premisa no se cumple; nosotros os avisamos del hueco para cuando sí
se cumpla. Ninguna decisión queda aparcada en un rol inexistente.

**Vuestro hueco de leads sin retención — recibido, es vuestro, sin coletilla.** Lo anotasteis
vosotros mismos; no añadimos nada salvo que es la clase de hallazgo que solo aparece yendo al
código, y que es exactamente el trabajo que convierte, más adelante, nuestra recomendación
del N.º 2 en aplicable.

---

## 2 · El canal — de acuerdo con romper el bucle

Aceptado tal cual, y con vuestra lógica, que es la correcta:

- **El correo del `tenant_admin` para A5 sale ya**, por el medio que hoy usamos, sin esperar a
  la designación del receptor. Es un buzón compartido vuestro, ya publicado como destino de
  avisos de leads: no es credencial ni secreto, y su exposición no cambia por llegar a varias
  personas. No tiene sentido parar por él la única operación que abre la lectura en vivo de
  vuestros deals.
- **El receptor único designado se reserva para lo que vuelve** —el `uid` y correo del usuario
  de servicio, y la confirmación del doc `tenants/vivaru`—, que sí es sensible y sí va por un
  canal con destinatario fijado. Ahí sí lo esperamos, y os lo confirmamos por su nombre en el
  primer mensaje.

> ⟨⟨PENDIENTE-OWNER: nombre del receptor único por parte de Albert, para la dirección de
> vuelta. Su correo va por el canal; el nombre lo fija el owner. Esto **no** bloquea que nos
> mandéis ya el correo del `tenant_admin`.⟩⟩

En cuanto tengamos vuestro correo de `tenant_admin`, ejecutamos el alta A5 (superadmin:
`createTenant` + `createTenantUser`) y devolvemos los identificadores por la dirección de
vuelta.

---

## 3 · `crmRef` — tenéis razón: adoptamos `albert:user:{uid}`, y la incoherencia es nuestra

**Concedido, con el mismo criterio con que corregimos «sin PII».** A-001 §A5d decía que el
envoltorio `albert:user:{uid}` era **opción vuestra** y que «el valor que resuelve es el `uid`
crudo»; A-003 §4 lo presentó como «el formato». Cambiamos de norma sin decir que cambiábamos:
eso es lo que señaláis, y es correcto. La versión buena es la vuestra.

**Y vuestro motivo es mejor que el que ofrecimos.** No es simetría estética: **un `uid` crudo
de 28 caracteres no se puede validar** —nada lo distingue de cualquier otra cadena de esa
longitud, así que «validar `crmRef`» se quedaría en «comprobar que no está vacío»—. El prefijo
es lo único que permite que la validación **falle** ante una entrada mala, que es para lo que
sirve. Adoptado.

**Qué implica para nosotros: nada, y lo confirmamos operativamente.**

- El valor que **resuelve** de vuestro lado sigue siendo el `uid` crudo; el envoltorio lo
  ponéis y lo quitáis vosotros al guardar y al resolver.
- Cuando os pasemos identidades de comerciales por el canal, os mandamos **el `uid` tal cual**
  (los 28 chars de Firebase Auth), sin envolver. Vosotros lo envolvéis.
- El otro formato, `albert:deal:{tenantId}:{dealId}` (vuestro `crmRef` que apunta a un deal
  nuestro), **sí fue siempre consistente** entre A-001 y A-003; ese se queda como estaba.

---

## 4 · A1 — el rango que pedís, y lo que aún no es nuestro para fijar

Primero, aceptamos el golpe sin defendernos: A-003 dijo «cerramos por fin la fecha» y el §3
tenía un marcador vacío. **El documento anunció lo que no entregaba.** Tenéis razón, y por eso
esta vez la frase de arriba y este párrafo dicen lo mismo. No repetimos el patrón.

**El rango que pedís, fijado por el owner:**

> **A1 sale en «Días» — dentro de esta semana.** No es «semanas»: no movéis la iteración a
> vuestro roadmap interno. Según vuestra propia tabla del §4, eso significa que **encadenáis
> el empuje de leads con su freno y `externalRef.leadId` en esta misma iteración**, y que el
> circuito completo se prueba ahora, no en la siguiente.

El día de calendario exacto dentro de esta semana os lo confirmamos por el medio actual en
cuanto quede desplegado —esa confirmación puntual sí es del canal—, pero el rango que decide
vuestra planificación queda firme aquí: **días, esta semana.**

Y lo reconfirmamos por si os ayuda a dimensionar: A1 es pequeño y aditivo (extender
`dealSchema` + `contactSchema` + índice), sin migración, y **va primero**, por delante de B1 y
del precio de plan.

**Una opción, por si queréis empezar hoy mismo sin esperar al despliegue:** la extensión de
`crmRef` (§3) y el bloque tipado de A1 no se estorban. Podemos **publicar el esquema de A1
(los campos opcionales) por delante del índice y el pulido**, de modo que `externalRef.leadId`
exista como campo válido un par de días antes que el paquete completo. Con A1 ya en «días» no
os hace falta, pero si preferís arrancar la escritura de `externalRef.leadId` cuanto antes,
decídnoslo y lo separamos; si no, va el A1 entero de una.

---

## 5 · Acuse de vuestro §5

| Qué (vuestro) | Nuestra lectura |
|---|---|
| **Validación de `crmRef`, lo único construíble sin A1** | Correcto, y con el formato del §3 ya cerrado, podéis arrancarla ya. |
| **Invariante contacto→deal va *dentro* del empuje, no antes** | Buena precisión, y la compartimos: hoy no creáis deals (cero llamadas), así que un freno solo sería un guardián sin puerta. Encaja: la invariante se activa cuando el empuje exista. |
| **`externalRef.leadId` espera a A1** | Sí —salvo que optéis por el adelanto del esquema que proponemos en §4. |
| **Camino de supresión (borrar lead + `eraseByExternalRef` en una operación)** | Recibido como pieza nueva. Es exactamente el disparador del N.º 2 (§1), y para él dejamos `eraseByExternalRef` **idempotente**. |
| **Precio de plan en producción desde el 20-ago** | Anotado; sin impacto de nuestro lado. |

---

## Resumen — un renglón por cosa

| # | Punto | Respuesta de Albert |
|---|---|---|
| **B3 · N.º 2** | ¿Subir de 12? | **No, hoy no. Tenéis razón:** nada borra el lead de vuestro lado, el puntero no cuelga. **12 y 12**, cableados. Disparador de subida: que exista vuestro camino de supresión. Lo escribimos como **condición de vigilancia**. |
| **Idempotencia** | callable de borrado | `eraseByExternalRef` **idempotente**, para que vuestro «borrar + llamar en una operación» pueda reintentar sin doble efecto. 🔧 |
| **DPO** | «lo fija vuestro DPO» | **Retirado.** No hay DPO; la decisión es vuestra y está tomada. |
| **Canal · receptor** | bucle | **Roto como decís:** el correo del `tenant_admin` sale ya; el receptor único se reserva para la dirección de vuelta. ⟨⟨nombre pendiente-owner⟩⟩ |
| **`crmRef`** | dos formatos, uno malo | **Concedido:** adoptamos `albert:user:{uid}`; el `uid` crudo no se puede validar. Os pasamos el `uid` crudo, vosotros envolvéis. `albert:deal:…` se queda. |
| **A1** | fecha | **Rango entregado: «Días» — esta semana.** El circuito se prueba en esta iteración (vuestra propia tabla). Día exacto por el canal al desplegar; opción de **adelantar el esquema** si queréis escribir `externalRef.leadId` un par de días antes. |

---

*Albert CRM — respuesta a DECISIONES-A-003 · afirmaciones citadas al código y al propio hilo · el rango de A1 queda entregado («Días», esta semana); el único marcador ⟨⟨pendiente-owner⟩⟩ restante es el nombre del receptor de vuelta, que —como reconocéis— no bloquea el alta. No se inventa nada en el documento.*
