# DECISIONES-A-003 — Vivaru → Albert

> **En una frase:** el **canal queda cerrado** y no hay nada más que negociar en él;
> contestamos vuestra recomendación sobre el **N.º 2** con un dato de nuestro código que le
> da la vuelta —de momento—; **resolvemos el formato de `crmRef`**, que A-001 y A-003 no
> dicen igual; y la **fecha de A1** sigue siendo lo único vivo entre los dos equipos.

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Versión** | 0.1 — 22 de agosto de 2026 |
| **Responde a** | `RESPUESTA-A-003` (22 de agosto de 2026) |
| **Contexto** | `docs/politica-retencion-datos.md` · `ESTADO-ALBERT.md` |

Gracias por contestar en serio a la pregunta del N.º 2. Pedimos una opinión y nos disteis
un razonamiento, no una cortesía. Este documento es todavía más corto que el anterior:
solo queda un punto abierto de verdad, y no es de contrato.

---

## 1 · B3 · N.º 2 — vuestro argumento es bueno, y su premisa aún no se cumple

**Empezamos por lo que os concedemos, porque es lo importante.** Vuestro paso 3 ataca la
razón real por la que elegimos 12, y acierta: nuestras otras tres ventanas de 12 son datos
que **siguen vivos y reidentificando** durante esos meses, mientras que el registro de
supresión es lo contrario. Meter los dos bajo el mismo número trata igual dos cosas que
nuestro propio criterio distingue. Es un argumento mejor que «coherencia de la casa», y lo
reconocemos.

**Fuimos a comprobar vuestro paso 2 antes de aceptarlo, y ahí es donde no se sostiene
todavía.** Vuestro razonamiento descansa en una premisa: *«la premisa entera de este borrado
es que el lead ya no existe en Vivaru»*, y por eso `vivaruLeadId` queda como puntero
colgante. Lo medimos en nuestro código, hoy:

| Qué | Medido |
|---|---|
| `eraseByExternalRef` — llamadas desde Vivaru | **Cero apariciones.** No invocamos vuestra callable de supresión desde ningún sitio |
| Ventana de retención sobre nuestros `leads` | **No existe.** Nuestra tarea nocturna cubre comprobantes, telemetría de IA y feedback — los leads **no están** |

**Traducido: hoy nada en Vivaru borra un lead, nunca.** Así que el `vivaruLeadId` de
vuestro `auditEvents` apuntaría a un lead **vivo**, y sigue reidentificando — que es
exactamente la razón por la que elegimos 12 en la ronda anterior.

Vuestro argumento no es incorrecto: es **condicional**, y la condición es una pieza
**nuestra** que no existe. Por eso nuestra respuesta no es «sí» ni «no»:

> **N.º 1 = 12 meses, firme.**
> **N.º 2 = 12 meses hoy**, por vuestro propio criterio aplicado al revés: el puntero no
> cuelga porque nada borra el lead de nuestro lado.
> **El disparador para subirlo no es una fecha ni una opinión: es que exista en Vivaru un
> camino de supresión que borre el lead y llame a `eraseByExternalRef` en la misma
> operación.** El día que exista, el puntero pasa a colgar de verdad y subimos el
> parámetro.

**Y aquí es donde vuestra decisión de hacerlos parametrizables paga.** Que N.º 1 y N.º 2
sean **dos parámetros independientes** —nos lo confirmáis en A-003 y es lo mejor del
documento— convierte esto en un cambio de configuración futuro en vez de una ronda más.
Cableadlos los dos a 12 y seguid con B3; no os bloquea nada.

### Una precisión sobre a quién le pasáis la decisión

A-003 dice tres veces que el número vinculante *«lo fija vuestro DPO»*. Lo decimos para que
no quede una decisión aparcada en un rol inexistente: **Vivaru no tiene DPO nombrado.**
Nuestros documentos legales identifican a Qintilab S.A.S. como encargado del tratamiento
respecto de los residentes y responsable respecto de los administradores, y publican
`privacidad@grupovivaru.com` como canal para ejercer derechos. No hay oficial de protección
de datos designado.

O sea: «vuestro DPO» somos nosotros. La decisión de arriba es la nuestra, tomada con la
información que tenemos, y queda por escrito que nos avisasteis del hueco — igual que
queda por escrito que os avisamos de que la premisa todavía no se cumple.

> **Nota añadida al repositorio el 22 de agosto por la tarde, después de mandarlo.** El
> párrafo de abajo dice que nuestra política «no dice lo que no cubre». **Es falso, y no se
> corrige el texto enviado a propósito — se anota.** El §3 de
> `docs/politica-retencion-datos.md` se titula literalmente «Lo que esta política NO cubre —
> los huecos, dichos en voz alta» y **lista `leads` entre ellos**. El hecho de fondo —que los
> leads no tienen ventana— es cierto y es lo que sostiene el argumento; lo equivocado era
> decir que no estaba escrito. Se afirmó lo que un documento decía sin abrirlo, que es el
> error que este mismo expediente lleva tres rondas nombrando en otros.

### Un hueco de nuestra casa que sale de aquí, y lo decimos nosotros

Nuestra política de retención presenta su inventario como *«leído del código, no
supuesto»*, y lo es. Lo que no dice es lo que **no** cubre: **los leads de Vivaru no tienen
ninguna ventana de retención.** Es la segunda vez en dos rondas que ir a mirar el código a
cuenta de una pregunta vuestra nos encuentra algo de nuestro lado. Queda anotado y es
nuestro.

---

## 2 · El canal — cerrado, y rompemos el bucle del receptor

Nada que discutir: aceptáis el canal único, adoptáis la regla literal y confirmáis Secret
Manager para la credencial de servicio. Cerrado.

**Sobre el receptor, tenéis razón en la forma y os proponemos no esperar al fondo.** Es
correcto que su correo no vaya en el documento — es nuestra propia regla y nos alegra que
la apliquéis contra nosotros. Pero tal como queda, se cierra un bucle: nos confirmáis el
receptor **por el canal**, y el canal no existe hasta que alguien mande el primer mensaje.

**Así que lo rompemos nosotros.** El correo del `tenant_admin` para el alta A5 **sale ya**,
por el medio que hoy usamos para hablar, sin esperar a la designación. El razonamiento:

- Esa dirección **no es una credencial ni un secreto**: es un buzón compartido nuestro, ya
  publicado como destino de los avisos de leads. Que llegue a varias personas de vuestro
  equipo no cambia su exposición.
- **Lo que sí es sensible viaja en la otra dirección** —el `uid` y el correo del usuario de
  servicio, y la confirmación del doc `tenants/vivaru`—. Para **eso** sí queremos el
  receptor único designado, y lo esperamos.

Dicho de otro modo: no dejemos parada la única operación que abre la lectura en vivo de
vuestros deals por una ceremonia que protege un dato que no lo necesita.

---

## 3 · `crmRef` — resolvemos el formato, porque A-001 y A-003 no dicen lo mismo

A-003 §4 nos escribe: *«nuestros dos formatos son `albert:deal:{tenantId}:{dealId}` y
`albert:user:{uid}` (A-001, A5d). Validad contra esos»*.

**A-001 decía otra cosa**, literalmente, en su A5d:

> *«Guardad ese `uid` en `salesReps.crmRef`. Si queréis simetría con el formato de deals,
> podéis envolverlo como `albert:user:{uid}`, pero **el valor que resuelve es el `uid`
> crudo**.»*

Allí el envoltorio era **opción nuestra**; en A-003 aparece como **el formato**. No es
grave y no cambia ninguna decisión vuestra, pero si lo dejamos correr acabamos validando
contra una norma que nadie decidió. Lo señalamos con el mismo criterio con que vosotros
corregisteis vuestra frase «sin PII».

**Decisión de Vivaru: adoptamos el envoltorio `albert:user:{uid}`.** Y no por simetría
estética, que era el motivo que ofrecíais:

> **Un `uid` crudo de 28 caracteres no se puede validar.** No hay nada que lo distinga de
> cualquier otra cadena de esa longitud, así que «validar `crmRef`» se reduciría a
> comprobar que no está vacío. El prefijo es lo único que permite que la validación
> **falle** con una entrada mala, que es para lo que la queremos.

**Qué implica para vosotros: nada.** El valor que resuelve de vuestro lado sigue siendo el
`uid` crudo; el envoltorio lo ponemos y lo quitamos nosotros al guardar y al resolver. Solo
os pedimos que, cuando nos paséis identidades de comerciales por el canal, nos mandéis el
`uid` tal cual — nosotros lo envolvemos.

---

## 4 · A1 — la fecha sigue sin existir, y esta vez no es reproche

**Reconocemos el cambio, que es real:** el 19 os negasteis a poner fecha por escrito y la
remitisteis al canal; ahora os comprometéis a que viva **en el documento**, y vuestro pie
nombra los dos marcadores `⟨⟨pendiente-owner⟩⟩` en vez de disimularlos. Eso es mejor
práctica que la nuestra en algún documento, y lo decimos en serio.

**Y aun así:** vuestro «en una frase» dice que *«cerramos por fin la fecha de A1»*, y el §3
contiene un marcador vacío. **El documento anuncia lo que no entrega.** Es la tercera ronda
sin fecha, y lo dejamos escrito sin dramatizarlo: no os pedimos que inventéis lo que no es
vuestro.

**Lo que os pedimos es más barato que una fecha: un rango.** «Días» o «la semana del 1 de
septiembre» nos basta. No lo queremos para llevar la cuenta — lo queremos porque decide qué
construimos esta semana:

| Si A1 sale en… | Lo que hace Vivaru |
|---|---|
| **Días** | Esperamos y encadenamos el empuje de leads con su freno y `externalRef.leadId` en la misma iteración |
| **Semanas** | Movemos esa iteración a nuestro roadmap interno y dejamos el circuito para la siguiente |

No es una pregunta retórica: hoy, sin A1 publicado, **lo único de esta integración que
podemos construir es la validación de `crmRef` del §3**, y es pequeña.

---

## 5 · Lo que sigue de nuestro lado

No os pide nada; es transparencia, como en A-002.

| Qué | Estado |
|---|---|
| **Validación de `crmRef`** | **Lo único que podemos construir sin esperaros.** Con el formato del §3. Es lo siguiente que tocamos |
| **La invariante contacto→deal** | Pendiente, y con una precisión que nos costó descubrir: **va dentro del empuje, no antes**. Hoy Vivaru **no crea deals en absoluto** —comprobado, cero llamadas—, así que construir el freno solo sería un guardián sin puerta |
| **`externalRef.leadId`** | **Espera a A1 publicado**, como decís vosotros mismos en vuestro §4 |
| **Camino de supresión** (borrar el lead + `eraseByExternalRef` en una sola operación) | **Nuevo, y sale del §1 de este documento.** No estaba en ninguna lista. Es la condición que convierte vuestra recomendación del N.º 2 en aplicable |
| **Precio de plan** | En producción desde el 20 de agosto |

---

## Resumen — un renglón por cosa

| # | Qué | Nuestra respuesta |
|---|---|---|
| **B3 · N.º 1** | Deal sin actividad | **12 meses.** Cerrado |
| **B3 · N.º 2** | Registro de auditoría | **12 meses hoy.** Vuestro argumento es bueno pero su premisa no se cumple: nada borra el lead de nuestro lado. **Cableadlo a 12**; lo subimos como config cuando exista nuestro camino de supresión |
| **DPO** | ¿Quién fija el número? | **No tenemos DPO nombrado.** La decisión es nuestra y está tomada |
| **Canal** | Receptor | **No esperamos a la designación** para el `tenant_admin`: sale ya. Sí la esperamos para lo que vuelve (uid y correo del usuario de servicio) |
| **`crmRef`** | Dos formatos en dos documentos | **Adoptamos `albert:user:{uid}`**, porque el `uid` crudo no se puede validar. De vuestro lado no cambia nada |
| **A1** | Fecha | **Sigue vacía.** Nos basta un **rango**: decide si el circuito se prueba esta iteración o la siguiente |
