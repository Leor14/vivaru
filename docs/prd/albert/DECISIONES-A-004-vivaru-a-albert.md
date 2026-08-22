# DECISIONES-A-004 — Vivaru → Albert

> **En una frase:** aceptamos el rango de A1 y lo **atamos al calendario** para que no
> signifique dos cosas; decimos **no** al adelanto del esquema y explicamos por qué es mejor
> trato para vosotros; y ajustamos vuestra **condición de vigilancia** para que cada casa
> pueda comprobarla en la suya. **Este documento cierra el intercambio.**

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Versión** | 0.1 — 22 de agosto de 2026 |
| **Responde a** | `RESPUESTA-A-004` (22 de agosto de 2026) |
| **Contexto** | `docs/politica-retencion-datos.md` · `ESTADO-ALBERT.md` |

Cuatro rondas y esta es la primera en la que no hay nada que discutir. Solo contestamos las
dos cosas que nos preguntáis y cerramos.

---

## 1 · A1 — aceptamos el rango, y lo atamos al calendario

**Nos disteis lo que pedimos, y conviene decirlo tal cual:** pedimos un rango, no una fecha;
lo fijó el owner; y está dentro del documento, no remitido al canal. Es exactamente el
compromiso que faltaba desde el 19. No movemos la portería.

**Solo hay que deshacer un accidente de calendario, y cuesta una línea.** Escribís *«dentro
de esta semana»* y el documento lleva fecha de **sábado 22 de agosto**. Dicho un sábado, esa
frase puede significar «mañana» o «el viernes que viene»: entre una lectura y otra hay **un
día o seis**, que es justo la magnitud que preguntábamos.

**Para no gastar una ronda en una palabra, lo fijamos nosotros y lo damos por bueno:**

> **A1 se publica en la semana del lunes 24 al viernes 28 de agosto de 2026.**

**No hace falta que contestéis** si esa lectura es correcta. Si en realidad sale antes, mejor
para los dos y nadie tiene que corregir nada. Solo escribidnos si el rango que fijó el owner
era **otro**.

(De paso, para el registro: la fecha de ejemplo que circuló en la consulta al owner decía
«viernes 29-ago». El 29 es sábado; el viernes es el **28**. No cambia nada, pero es la clase
de detalle que después se cita como si fuera un compromiso.)

---

## 2 · El adelanto del esquema — **no, gracias**, y por tres razones

Nos ofrecéis separar los campos opcionales del índice y el pulido para que
`externalRef.leadId` exista un par de días antes. **Lo agradecemos y lo declinamos:**

1. **El índice no está en nuestro camino crítico, ni siquiera para probar el circuito.** Para
   empujar un lead no consultamos por `externalRef.leadId`; y para ver la conversión nos
   suscribimos con `onSnapshot` a `tenants/vivaru/deals` —la colección entera de un solo
   tenant—, que tampoco consulta por ese campo. El cruce lead↔deal, con un puñado de deals,
   se casa en memoria.
2. **Los días que ahorraríamos ya están ocupados.** La validación de `crmRef` es construible
   hoy, no depende de vosotros, y con el formato del A-003 §3 ya cerrado **la arrancamos al
   terminar este documento**. Para cuando esté, A1 habrá salido.
3. **Partir un cambio de esquema en dos despliegues sobre un producto vivo, para ganar dos
   días que no necesitamos, es peor trato para vosotros que un despliegue limpio.** Preferimos
   que vaya A1 entero de una.

**La condición por si acaso, para no tener que volver a escribirlo:** si el **viernes 28**
cierra sin A1 publicado, os pedimos el adelanto entonces. No antes.

---

## 3 · La idempotencia de `eraseByExternalRef` — no es un detalle, gracias

No la pedimos y cambia cómo se construye la pieza, así que lo decimos con nombre:

**Sin idempotencia**, «borrar el lead y llamar a `eraseByExternalRef` en la misma operación»
obliga a coordinar dos sistemas ante un fallo a medias — y no hay transacción que abarque a
los dos. **Con idempotencia**, el problema desaparece: se borra, se llama, y si la llamada se
cortó se reintenta sin miedo a doble efecto. Pasa de ser una pieza espinosa a una pequeña.

Es la diferencia entre un requisito que se cumple y uno que se documenta como riesgo
aceptado. Anotado como lo que es: **una decisión vuestra que nos ahorra trabajo a nosotros.**

---

## 4 · La condición de vigilancia — aceptada, con un matiz de observabilidad

**La idea es buena y la adoptamos.** Un disparador que vive en el hilo de dos documentos se
olvida; escrito como condición en la política de retención, se revisa porque está escrito que
debe revisarse. Nos lo llevamos a `docs/politica-retencion-datos.md`.

**El matiz:** vuestra redacción —*«mientras `eraseByExternalRef` no reciba llamadas de
supresión originadas en Vivaru»*— es observable **desde vuestro lado**, no desde el nuestro.
Nosotros no vemos vuestras invocaciones. Proponemos que cada casa escriba la condición contra
lo que puede comprobar, siendo la misma condición:

| Casa | Redacción | Cómo se comprueba |
|---|---|---|
| **Albert** | «…mientras `eraseByExternalRef` no reciba llamadas originadas en Vivaru» | Vuestros logs |
| **Vivaru** | «…mientras no exista en el código de Vivaru un camino de supresión que borre el lead e invoque `eraseByExternalRef`» | Un `grep`. Hoy: **cero apariciones** |

Las dos describen el mismo estado del mundo. La diferencia es que cada uno puede verificar la
suya sin pedirle nada al otro, que es lo que hace que una condición de vigilancia sobreviva.

---

## 5 · `crmRef` — cerrado, y arrancamos

Nada que añadir salvo el acuse operativo, para que quede sin ambigüedad:

- **Vosotros nos mandáis el `uid` crudo** (los 28 caracteres de Firebase Auth), sin envolver.
- **Nosotros envolvemos y desenvolvemos** `albert:user:{uid}` al guardar y al resolver.
- **`albert:deal:{tenantId}:{dealId}` se queda como estaba** — ese fue siempre consistente
  entre A-001 y A-003, y lo confirmamos releyéndolos. La deriva era solo la del usuario.

---

## 6 · Esto cierra el intercambio

**Cuatro rondas de documentos y ya no queda nada que decidir por escrito.** Lo decimos
explícitamente porque un intercambio que no se declara cerrado tiende a seguir, y a partir de
aquí cada documento nuevo cuesta más de lo que aporta.

**Lo que sigue no son documentos: es construir y el canal.**

| Vivo | Dónde se resuelve |
|---|---|
| El **nombre del receptor único** de vuestra parte | Por el canal, cuando el owner lo designe. **No bloquea el alta**, como ya acordamos |
| El **día exacto** de A1 dentro de la semana del 24 | Por el canal, al desplegar |
| El **correo del `tenant_admin`** | **Sale ya**, por el medio actual. Con él ejecutáis A5 |
| Los identificadores de vuelta (`uid` del `tenant_admin`, `uid` y correo del usuario de servicio, confirmación de `tenants/vivaru`) | Por el canal, con receptor fijado |

Si aparece algo que de verdad exija otra ronda, la abrimos. Pero por defecto, la siguiente
noticia entre los dos equipos debería ser **«A1 desplegado»** por vuestra parte y **«circuito
probado»** por la nuestra.

---

## Resumen — un renglón por cosa

| # | Qué | Nuestra respuesta |
|---|---|---|
| **A1 · rango** | «Esta semana», dicho un sábado | **Lo fijamos: semana del lunes 24 al viernes 28.** No contestéis salvo que el rango del owner fuera otro |
| **Adelanto del esquema** | ¿Lo separamos? | **No.** El índice no está en nuestro camino crítico y esos días ya están ocupados. Os lo pediríamos solo si el 28 cierra sin A1 |
| **Idempotencia** | `eraseByExternalRef` | **Gracias, con nombre:** convierte el camino de supresión de espinoso en pequeño |
| **Condición de vigilancia** | Adoptada | Con **una redacción por casa**, para que cada uno la compruebe sin depender del otro |
| **`crmRef`** | Cerrado | Nos mandáis el `uid` crudo; envolvemos nosotros. **Empezamos a construirlo hoy** |
| **El intercambio** | — | **Cerrado.** Lo siguiente es construir y el canal, no otro documento |
