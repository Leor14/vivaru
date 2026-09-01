# DECISIONES-A-006 — Vivaru a Albert

> **1 de septiembre de 2026.** Contesta a vuestra nota sobre la cuenta de servicio
> (`RESPUESTA-A-006`). Va en el mismo formato de siempre: lo que damos, lo que preguntamos, y un
> renglón por punto al final. **David os lo hace llegar por el canal.**

---

## 1 · Las cuentas, medidas y no copiadas de una pantalla

Las noventa Cloud Functions de Vivaru corren **todas con la misma cuenta de servicio** en cada
ambiente —lo comprobamos leyendo la configuración de las noventa por la API de Cloud Functions, no
abriendo una—. La función que os llamará **no existe todavía**; cuando exista correrá con la de su
ambiente, porque no declaramos cuentas por función:

| Ambiente | Cuenta de servicio con la que corre el código que os llamará |
|---|---|
| **Producción** (`hogaru-1`) | `1047056648517-compute@developer.gserviceaccount.com` |
| **Staging** (`vivaru-staging-02`) | `765613061037-compute@developer.gserviceaccount.com` |

**Pedimos que aceptéis las dos**, o que nos digáis si queréis un endpoint por ambiente. Vamos a
probar contra staging antes que contra producción, y si el endpoint rechaza la de staging con 403 la
primera prueba no dirá nada.

Son identidades de máquina: sin buzón, sin contraseña, sin pantalla de login. Es justo lo que
pedíamos en `DECISIONES-A-005` §4, y **os lo agradecemos**: resuelve el riesgo del buzón compartido
(§4.5 de nuestro estado) en vez de convivir con él.

## 2 · Lo que necesitamos saber de `vivaruWonSignals` antes de escribir una línea

Es la primera vez que ese endpoint aparece en el intercambio, y **en vuestro proyecto todavía no
está desplegado** —lo miramos el 1 de septiembre: veintitrés funciones, ninguna con ese nombre—. Para
construir el cliente sin adivinar, nos hace falta el contrato:

1. **URL y método.** ¿Es una función HTTP de Cloud Run con `Authorization: Bearer <token de
   identidad>` y `aud` igual a la URL del servicio? Es lo que asumimos; decidnos si es otra cosa.
2. **Qué devuelve.** Por deal ganado: `dealId`, `externalRef.leadId` —el nuestro—, la fecha en que
   se ganó, y a ser posible `amount` y `estimatedUnits`. Si el deal no lleva `externalRef` no lo
   podemos casar con nada: ¿los excluís o los mandáis igual?
3. **Cómo se pagina y desde dónde.** ¿Un cursor por `updatedAt`, un `since`, o la lista entera?
   Lo consultaremos cada pocos minutos desde un proceso programado, así que preferimos un `since`.
4. **Idempotencia.** Vamos a leer el mismo deal ganado más de una vez y activaremos una sola. Lo
   resolvemos nosotros con el `dealId`; solo pedimos que **ese id no cambie**.
5. **Y la pregunta de `DECISIONES-A-005` §3, que este endpoint puede contestar por sí solo:**
   ¿qué significa «ganado» para `vivaruWonSignals`? Si el endpoint decide por vuestra cuenta qué
   deal está ganado —con una clave interna y no con el texto de la etapa—, **la clave estable ya no
   nos hace falta**: la abstrae el endpoint, y es mejor solución que la que pedíamos. Si por dentro
   compara `stage == "Ganado"`, el problema sigue ahí, solo que en vuestro lado: **lo medimos en
   vuestro Firestore el 1 de septiembre** —el pipeline es `stages: string[]` en
   `tenants/{tenantId}/config/pipeline`, editable por el `tenant_admin`, y el tenant `demo` ya lo
   tiene reescrito a `["Ganado", "Perdido"]` con un deal en `"Propuesta"` que no casa con nada—.
   Contadnos cuál de las dos es.

## 3 · Lo que dejamos de pedir

- **La contraseña del usuario de servicio.** Con el token de identidad no la necesitamos para la
  señal de vuelta. Para **escribir** deals (el empuje de leads) seguimos con la duda: ¿queréis un
  segundo endpoint con la misma autenticación, o la escritura directa a Firestore con el usuario
  `sales` que ya existe? Nuestra preferencia es la misma: **la cuenta de servicio, por el mismo
  endpoint o por otro**, y que el usuario `integracion-vivaru` quede solo como identidad legible en
  la auditoría.
- **La exclusión del reset self-service para cuentas de servicio** (`DECISIONES-A-005` §5). Si la
  credencial de máquina es esta, el buzón deja de ser credencial y esa pregunta se cierra sola.

## Resumen — un renglón por punto

| # | Qué | Quién |
|---|---|---|
| 1 | Dos cuentas de servicio, producción y staging; pedimos que valgan las dos | Vivaru entrega |
| 2 | Contrato de `vivaruWonSignals`: URL, respuesta, paginación, idempotencia, y qué es «ganado» | **Albert contesta** |
| 3 | Escritura de deals: ¿endpoint propio o Firestore con `sales`? | **Albert contesta** |
| 4 | Contraseña y exclusión del reset: dejan de pedirse | Cerrado |
