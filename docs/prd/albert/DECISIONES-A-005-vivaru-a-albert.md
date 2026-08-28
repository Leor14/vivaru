# DECISIONES-A-005 — Vivaru → Albert

> **En una frase:** damos por cerrado todo lo que confirma vuestra `RESPUESTA-A-005`,
> **cerramos nosotros el `displayName`** mirándolo en pantalla para que no gastéis una ronda en
> contestarlo, y traemos **dos preguntas**: una que condiciona el diseño de lo primero que vamos
> a construir, y otra sobre **cómo nos dais la credencial** — con una propuesta que además
> resuelve el riesgo que abrió vuestro reset self-service.

| | |
|---|---|
| **De** | David (Vivaru / Qintilab) |
| **Para** | Equipo de Albert CRM |
| **Versión** | 0.1 — 28 de agosto de 2026 |
| **Responde a** | `RESPUESTA-A-005` |
| **Contexto** | `ESTADO-ALBERT.md` · sesión navegada del tenant `vivaru` el 28 de agosto |

---

## 1 · Lo que damos por cerrado con vuestra respuesta

**B1 y B3 desplegados es la noticia grande y no la habíamos pedido.** Nuestro estado los
tenía como «por construir» y vuestra cabecera dice que están en producción. Los pasamos a
cerrados. Con eso, del contrato original **no queda nada abierto de vuestro lado**.

Y para que conste el efecto en la retención: la **condición de vigilancia del n.º 2 sigue sin
cumplirse**, y no por vosotros. `eraseByExternalRef` existe ya, pero **Vivaru todavía no lo
llama** — el camino de supresión es nuestro y no está escrito. El n.º 2 se queda en 12 meses
hasta que ese camino exista, exactamente como quedó redactado en las dos casas.

Sobre A1: lo damos por publicado y no volvemos sobre ello. Y gracias por mover la condición
de vigilancia a vuestro documento y por corregir lo de `crmRef`.

---

## 2 · El `displayName`: lo cerramos nosotros, y no hace falta que contestéis

Lo pedimos el 22 de agosto y **ya no hace falta**: entramos al tenant `vivaru` el 28 y el
identificador de sesión muestra **`integracion-vivaru`**, con perfil de asesor comercial. Es
exactamente lo que fija C2.

Lo decimos porque importa para la auditoría, que es para lo que se pidió: como `createdBy`
guarda el `uid`, la trazabilidad depende de que resolverlo devuelva un nombre que signifique
algo. Lo devuelve. **Punto cerrado.**

---

## 3 · La pregunta de diseño: ¿hay una clave estable para «ganado»?

Lo primero que vamos a construir es la señal de vuelta: enterarnos de que un deal se ganó
para activar la suscripción del cliente. Al ir a escribirlo nos paramos en esto.

En el pipeline del tenant hay un panel, **«Configurar etapas del pipeline»**, que es una
lista de texto libre con su botón de guardar. Hoy contiene:

```
Nuevo, Contactado, Propuesta, Negociacion, Ganado, Perdido
```

Y el desplegable «Etapa» del formulario de deal ofrece **esas mismas cadenas**. De ahí
deducimos que la etapa se persiste como ese texto.

**Si es así, no podemos condicionar la activación a `stage === "Ganado"`.** Esa palabra la
puede reescribir cualquiera desde esa pantalla —renombrarla, quitarle o ponerle la tilde,
traducirla, reordenar la lista— y el día que ocurra **nuestro detector deja de disparar sin
dar un error**: ni excepción, ni log, ni prueba en rojo. Sólo clientes que ganáis y a los que
no se les activa nada. Preferimos no construir eso.

Reparamos además en que vuestra propia pantalla dice *«sin perder la etapa Perdido para
analitica y cierre»*: **protegéis «Perdido» y no decís nada de «Ganado»**, que es justo la que
nos hace falta.

> **La pregunta:** ¿existe hoy en el documento del deal algo estable que signifique «ganado»
> —una clave canónica, un `stageKey`, un booleano, un tipo de etapa— independiente del texto
> configurable? Y si no existe, **¿qué os cuesta añadirlo?**

No pedimos que congeléis el texto: la configurabilidad es una virtud de vuestro producto y no
queremos quitárosla. Pedimos **un campo que no se mueva cuando el texto se mueva**. Con eso
escribimos el detector una vez y no vuelve a romperse.

Es la única cosa que nos bloquea **diseño** hoy. Lo que nos bloquea **ejecución** es el §4.

---

## 4 · La credencial: **preferimos una cuenta de servicio a una contraseña**

Aquí hay un hueco que vuestra `RESPUESTA-A-005` no cierra y que nos bloquea a nosotros, no a
vosotros. Decís que al `tenant_admin` lo creasteis **sin contraseña**, a propósito, para no
manejar ninguna en claro — nos parece bien—. **Del usuario de servicio no decís nada**, y
repasando el intercambio entero **nadie ha dicho nunca que esa cuenta tenga una**. Sin
credencial no hay `signInWithEmailAndPassword`, y sin eso no hay señal de vuelta.

**Antes de pediros una contraseña, os proponemos no usar ninguna.** Al reautenticar nuestro CLI
el 28 de agosto vimos que `albert-crm-1-1c162` **aparece en la lista de proyectos** de la cuenta
con la que operamos, y con ella pudimos **listar vuestros índices** — de paso verificamos por
nuestra cuenta que el de A1 está vivo, `deals(externalRef.leadId ASC, updatedAt DESC)`. No
sabemos hasta dónde llega ese acceso y no hemos ido más lejos a propósito.

> **La pregunta:** en vez de una contraseña de usuario, **¿podéis conceder a la cuenta de
> servicio de nuestras Cloud Functions permiso de lectura sobre Firestore de
> `albert-crm-1-1c162`** —o sobre `tenants/vivaru` si sabéis acotarlo—? Os pasamos su dirección
> por el canal.

**Por qué lo preferimos, y no es comodidad:** una contraseña de usuario nos obliga a guardar en
Secret Manager una credencial que además **abre vuestra consola como persona**, y que —desde el
reset self-service— **recupera cualquiera que lea el buzón compartido donde vive** (§5). Una
cuenta de servicio no tiene buzón, no tiene pantalla de login, no se puede recuperar por correo
y se revoca con un clic vuestro. **Resuelve el problema del §5 en vez de convivir con él.**

Si esa concesión os resulta incómoda —es vuestro proyecto y lo entenderíamos— decidlo y vamos
por la contraseña; sólo necesitamos saber cuál de los dos caminos tomamos.

---

## 5 · El reset self-service: una consecuencia que no buscabais

Lo habéis construido y está desplegado; lo comprobamos. **No os pedimos que lo deshagáis** —es
vuestro producto y mejora vuestra recuperación de cuentas—, pero sí queremos dejar escrito lo
que le hace a la nuestra, porque nos toca a nosotros decidir qué hacemos con ello.

El usuario de servicio con el que Vivaru escribirá en el CRM vive en un **buzón de desarrollo
compartido**. Hasta ayer, recuperar esa cuenta exigía que un superadmin vuestro generase un
enlace: había un humano en medio. Desde el reset self-service, **cualquiera que lea ese buzón
recupera la credencial de máquina desde la pantalla de login, sin pasar por nadie**.

Es un riesgo que ya habíamos aceptado a medias por nuestra cuenta, y que acaba de crecer. La
corrección es nuestra —recrear el usuario de servicio con dirección propia cuando existan
alias— y hoy es barata porque **no hay ni un deal escrito**.

> **Lo único que os preguntamos aquí, y sin urgencia:** ¿se puede excluir del reset por correo
> a las cuentas marcadas como de servicio? Si la respuesta es «no y no merece la pena»,
> también nos sirve: cerramos por nuestro lado con el cambio de dirección.

---

## 6 · Una observación menor sobre A1, que no es una reclamación

Al mirar el formulario de creación de deal no aparecen `externalRef`, `estimatedUnits` ni
`country`. **No lo leemos como que A1 no esté desplegado**: son campos opcionales de
integración, el índice está LIVE y es razonable que un formulario manual no los pinte.

Lo decimos por una razón práctica: **nosotros no escribimos por vuestra app.** Escribimos con
el SDK cliente directo a Firestore, así que ni pasamos por `upsertDeal` ni por su Zod. Cuando
llegue el empuje de leads os preguntaremos por el camino correcto —documento crudo o vuestra
callable— porque escribir en crudo nos saltaría también vuestro `timeline` y el estampado de
auditoría, y eso sí nos parece que hay que decidirlo entre los dos. **Hoy no hace falta
contestarlo.**

---

## Resumen — un renglón por punto

| # | Punto | Qué decimos |
|---|---|---|
| **1** | B1 y B3 | Cerrados. Del contrato no queda nada vuestro abierto |
| **1** | Retención n.º 2 | Sigue en 12: falta **nuestro** camino de supresión, no el vuestro |
| **2** | `displayName` | **Cerrado por nosotros**, verificado en pantalla. No contestéis |
| **3** | Clave estable de «ganado» | **Pregunta 1 de 2.** Condiciona lo primero que construimos |
| **4** | La credencial | **Pregunta 2 de 2.** ¿Cuenta de servicio en vez de contraseña? |
| **5** | Reset self-service | No lo deshagáis. ¿Se pueden excluir las cuentas de servicio? |
| **6** | A1 en el formulario | Observación, no reclamación. La decisión de fondo es para más adelante |

---

*Vivaru → Albert · responde a `RESPUESTA-A-005`. Identificadores y credenciales van por el
canal, nunca dentro de este documento.*
