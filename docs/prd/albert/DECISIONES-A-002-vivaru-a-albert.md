# DECISIONES-A-002 — Vivaru → Albert

> **En una frase:** os damos **los dos números de retención** que os faltaban para cerrar
> B3, fijamos **un solo canal** para lo que no cabe en un documento, y os recordamos lo
> único que quedó colgando de vuestro lado: **la fecha de A1**.

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Versión** | 0.1 — 21 de agosto de 2026 |
| **Responde a** | `RESPUESTA-A-002` (19 de agosto de 2026) |
| **Contexto** | `docs/politica-retencion-datos.md` · `ESTADO-ALBERT.md` |

Gracias por dar la razón en las dos contradicciones sin regatear, y por corregir vuestra
propia frase «sin PII» en vez de defenderla. Eso ahorra rondas.

Este documento es corto a propósito: **el contrato técnico ya está cerrado.** Solo queda
lo que no se podía cerrar sin que Vivaru decidiera algo.

---

## 1 · Los dos números de retención (B3) — **12 y 12**

| Número | Qué es | **Decidido** |
|---|---|---|
| **N.º 1** | Cuánto vive un deal **sin actividad** antes de anonimizarse (criterio: su `updatedAt`, como acordamos) | **12 meses** |
| **N.º 2** | Cuánto vive el **registro de auditoría del borrado** (`vivaruLeadId`, `dealId`, fecha, actor) | **12 meses** |

### La precisión que no puede faltar: son dos relojes distintos

**El n.º 2 se cuenta desde la fecha del borrado, no desde la del deal.** Sin esta frase,
«12 meses» es ambiguo y se puede cablear contra el reloj equivocado — que además es el
que tenéis más a mano, porque es el mismo campo del n.º 1.

### Por qué 12 y no los 24 que proponíais

Vuestra propuesta de 24 era razonable y no la descartamos por desconfianza: **la
descartamos porque 12 ya es la cifra de la casa**, y no lo sabíamos cuando os escribimos
la ronda anterior.

Al ir a decidir el número fuimos a mirar nuestro propio código, y aparecieron **tres
ventanas de retención que Vivaru ya aplica en producción todas las noches**, y las tres
dicen 12 meses: la información personal de los comprobantes de pago, la telemetría de uso
de IA y el feedback de los borradores asistidos.

Es decir: os dijimos que Vivaru «no tenía política de retención escrita» y era cierto —
**escrita** no la había. Pero **decidida de hecho sí**, y llevaba tiempo corriendo. Ahora
está escrita, y elegir 24 para el CRM habría dejado la casa con dos criterios sin que
nadie lo decidiera.

Vuestros 24 meses siguen siendo el número correcto **para vuestro contexto** —un ciclo
comercial largo justifica guardar más—. Por eso agradecemos que lo hicierais
**parametrizable** en vez de cablearlo: si el negocio nos pide subirlo, sale barato.

### El riesgo del n.º 2, dicho en voz alta — **y aquí sí queremos vuestra opinión**

Doce meses para el registro de auditoría tiene una contrapartida que asumimos a ojos
abiertos: **pasado ese año no tendremos con qué demostrar que un borrado ocurrió.** Si
alguien reclama a los 18 meses que su dato nunca se suprimió, la prueba ya se purgó.

Lo elegimos así para minimizar la reidentificación —mientras el lead exista de nuestro
lado, `vivaruLeadId` reidentifica, que es justo lo que os señalamos en la ronda anterior—
y porque la coherencia con el resto de la casa vale más que el caso extremo.

**Pero si en vuestro criterio 12 meses se queda corto para acreditar el ejercicio del
derecho de supresión, decidlo.** Preferimos que nos lo discutáis ahora a descubrirlo con
una reclamación delante. No es una decisión cerrada por orgullo: es una decisión tomada
con la información que tenemos.

---

## 2 · El canal — proponemos **uno solo**, no dos

Nuestros documentos y los vuestros mencionan un «canal aparte» y un «canal de
coordinación» como si fueran cosas distintas. Somos dos equipos pequeños: dos canales con
nombre acabarían con la mitad de las cosas en el sitio equivocado.

**Proponemos un único canal directo por correo** entre David (Vivaru) y quien designéis
por vuestra parte, con esta regla:

> **El repositorio lleva las decisiones. El correo lleva los datos personales, las
> credenciales y las fechas.**

**Qué viaja por ahí, en concreto:**

| Dirección | Qué |
|---|---|
| **Vivaru → Albert** | El **correo del `tenant_admin`** para el alta A5 |
| **Albert → Vivaru** | El `uid` del `tenant_admin`, el **`uid` y correo del usuario de servicio**, y la confirmación del doc `tenants/vivaru` |
| **Albert → Vivaru** | La **fecha de A1** (§3) |

**Por qué correo y no mensajería.** Lo que va a viajar no es conversación: son
identificadores y credenciales que alguien va a tener que localizar dentro de unos meses
para saber de dónde salieron. Un correo fechado se encuentra; un hilo de chat se pierde
hacia arriba.

**Y una cosa que ninguno de los dos documentos dice y conviene fijar ahora:** la
credencial del usuario de servicio **no va a entrar en nuestro repositorio**. Va a Secret
Manager, como el resto de nuestros secretos. Lo decimos aquí para que quede por escrito
antes de que exista la credencial, y no después.

**El correo del `tenant_admin` no va en este documento**, tal y como pedisteis. Sale por
el canal en cuanto confirméis quién lo recibe de vuestra parte.

---

## 3 · Lo único que quedó colgando: la fecha de A1

En `RESPUESTA-A-002` escribisteis que la ventana concreta de A1 —esta semana o la
siguiente— nos la confirmaba vuestro owner por el canal de coordinación **«en cuanto
veamos este documento»**, y que era **«lo primero que cerramos»**.

Eso fue el 19. Hoy es 21 y no ha llegado.

**No os lo reclamamos como incumplimiento**, y entendemos perfectamente por qué no la
fijasteis por escrito: no era vuestra para fijarla. Lo reclamamos porque **de esa fecha
depende qué construye Vivaru mientras tanto**, que es exactamente lo que os dijimos en la
ronda anterior y que vosotros reconocisteis.

Con el contrato cerrado podemos **construir** contra él sin esperaros. Lo que no podemos
es **probar el circuito completo** hasta que A1 esté publicado. Saber si hablamos de días
o de semanas cambia si esa prueba entra en esta iteración o en la siguiente.

---

## 4 · Lo que sigue de nuestro lado, para que sepáis dónde estamos

No os pide nada; es transparencia sobre nuestra parte del trato.

| Qué | Estado |
|---|---|
| **La invariante contacto→deal** | Aceptasteis nuestra palabra en vez de romper vuestro esquema. Nos toca convertirla en **algo que falle**, no en un comentario. Pendiente |
| **`externalRef.leadId`** | **No existe todavía en nuestro código.** Es lo primero que construimos cuando A1 esté publicado |
| **`crmRef`** | Hoy es texto libre sin validar de nuestro lado. Vamos a validarlo contra los dos formatos que nos disteis |
| **Precio de plan** | **Hecho y en producción** desde el 20 de agosto, sin esperaros, como acordamos |

---

## Resumen — un renglón por cosa

| # | Qué | Nuestra respuesta |
|---|---|---|
| **B3 · n.º 1** | Deal sin actividad | **12 meses**, criterio `updatedAt` |
| **B3 · n.º 2** | Registro de auditoría del borrado | **12 meses, desde la fecha del borrado** — y abiertos a que nos digáis que es corto |
| **Canal** | ¿Uno o dos? | **Uno**, por correo. Repositorio = decisiones; correo = datos personales, credenciales y fechas |
| **A5** | Alta del tenant | El correo del `tenant_admin` sale **por el canal**, no aquí. Confirmadnos quién lo recibe |
| **A1** | Fecha | **La seguimos esperando.** No bloquea construir; bloquea probar |
