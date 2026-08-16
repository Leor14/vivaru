# Vuelta de definiciones de `priority` — 15 de agosto de 2026 (noche)

No es una medición: es la vuelta de definiciones que el resultado de la ronda 2
dejó como paso 3. Material: los **7 desacuerdos de `priority`** de
`resultado-2026-08-15-ronda2.md` (el documento solo tabulaba los de `type`;
estos se reconstruyeron con `node scripts/acuerdo-pqrs.mjs --medir --muestra
datasets/pqrs/doble-etiquetado/muestra-2.tsv`). Método: por chat, caso por
caso — B (David) explica qué leyó y por qué eligió su etiqueta, y de la
diferencia entre las dos lecturas sale lo que la definición no decidía.

**El kappa vigente del eje sigue siendo 0,47 (suspenso).** Esta vuelta corrige
la definición; no la valida. Ver «La validación se aplazó», abajo.

## Los 7 desacuerdos, resueltos

| Caso | A (gold) | B | Resolución |
|---|---|---|---|
| `MX#3983` portón abierto | high | medium | **Queda high.** B llegó solo al criterio escrito («el problema se puede agrandar») al conversarlo |
| `MX#3441` música a gritos | medium | high | **Queda medium**, con decisión de producto: el enfado va en bandera (abajo) |
| `MX#730` basura en el sótano | medium | high | **Queda medium.** B llegó solo al criterio («no se acumula más con el tiempo») |
| `MX#4689` revisen sus estufas | high | low | **Gold corregido → medium.** El error era de A: regla nueva de verificación (abajo) |
| `EC#3721` teoría de la bomba | low | medium | **Queda low.** B lo concedió al conversarlo |
| `EC#162` limpiar los derrames | low | medium | **Queda low.** «No es un problema como tal» |
| `MX#4053` popós y multas | low | medium | **Gold corregido → medium.** El error era de A: regla nueva de caducidad (abajo) |

Saldo: cuatro golds quedan, dos cambian, uno fija una decisión de producto. El
material le llevó la contraria a los dos anotadores — la misma señal que el
árbol de `type`: la vuelta no está hecha para darle la razón a quien la corre.

## Las dos reglas nuevas (ya escritas en `taxonomia.md`)

- **Riesgo verificado y no confirmado baja un nivel.** «Ante la duda de riesgo,
  el más alto» vale mientras nadie haya ido a mirar; revisado y sin hallazgo,
  queda `medium` en vigilancia. De `MX#4689`: el guardia y un familiar ya habían
  revisado el posible olor a quemado; el gold decía `high` leyendo el mensaje
  como si el riesgo siguiera sin verificar. El criterio de B era verificación
  («no es señal de que muchos más lo perciban») y era el correcto.
- **Recurrente + actuación que caduca no es `low`.** Esperar no agranda el daño
  pero deja el remedio sin efecto. De `MX#4053`: la multa depende de la cámara
  de ese día; una semana después no hay multa que aplicar. La lectura de A
  («aviso que puede esperar una semana sin que nadie note la diferencia») era
  falsa por las dos puntas: es recurrente y la evidencia expira.

## La decisión de producto: el enfado no sube la prioridad

`MX#3441` era el único desacuerdo donde las dos posturas eran defendibles. B lo
sostenía en high por riesgo de escalada («un vecino enojado puede desencadenar
algo más grande»); la definición mide la consecuencia de esperar el problema,
no el tono. **David decidió el 15 de agosto: queda `medium`, y el enfado se
registra en la bandera `enfado`** — que ya existía en el gold set y que este
caso no tenía puesta (corregido: `enfado` pasa de 11 a 12 casos). El
administrador ve las dos cosas por separado; el recall de `high` no compite con
cada queja furiosa de ruido.

## El hallazgo de método, que vale más que los dos cambios

**En 4 de los 7 casos, B llegó solo al criterio ya escrito en cuanto lo
conversó.** Las anclas se entienden; no prenden aplicadas en frío — el mismo
patrón que la precedencia de `type` en la ronda 2 (regla escrita delante, y no
prendió). Consecuencia: la sección de `priority` en `taxonomia.md` se reescribió
como **tres preguntas en orden** («la primera que dé que sí, decide»), no como
tabla que hay que recordar. Es la misma medicina que el árbol de `type`, con su
límite conocido: el árbol subió `type` de 0,42 a 0,53, no lo aprobó.

## La validación se aplazó, y fue decisión, no olvido

**Decisión de David, 15 de agosto de 2026:** no correr la tercera ronda ahora.
«Estamos tardando mucho en estas validaciones de muestra y no estamos llegando
a donde necesitamos llegar con el plan.» Los números la acompañan: el pool
limpio quedó en 96 casos con **solo 5 `high`**, así que una tercera ronda sobre
el pool mediría sobre todo la frontera low/medium — la que menos consecuencia
tiene.

**Lo que esto deja, dicho sin maquillar:**

- `priority` queda **corregido y sin validar**. El kappa vigente es 0,47.
- El criterio «recall de `high` ≥95%» de la PRD **sigue sin ser evaluable**.
  Antes de medir al modelo contra este eje, o se valida la definición o se
  replantea el criterio en la PRD (que vive en Drive).
- Los dos cambios de gold y la bandera están aplicados en `etiquetas.tsv`,
  regenerados a `gold-set.json` y la suite de functions pasa (los `high` quedan
  en 19; el mínimo de la prueba es 15).

**El plan de validación, escrito para cuando se retome** (acordado con David
antes de aplazarlo, «me cuadra»):

1. Muestra fresca del **corpus de Colombia** (`datasets/chat-vecinal-colombia/`,
   2.984 mensajes) — ninguno de los dos anotadores lo ha visto como material
   etiquetado, así que el pool quemado deja de ser restricción.
2. Estratificada hacia **candidatos a `high`** con el tamiz de palabras (fuga,
   gas, abierto, ascensor…), sin que A los etiquete antes del sorteo.
3. Se miden **dos números fijados antes de correr:** el kappa completo del eje
   (umbral 0,60, el de siempre) y el **binario high/no-high**, que es la única
   frontera con consecuencia escrita en la PRD. Sobre la ronda 2 el binario da
   ~0,47 — no es un atajo para aprobar, es enfocar la medición donde duele.
4. De paso valida que las definiciones viajan al tercer país, que es de donde
   viene la sigla PQRS.

## Qué NO dice esta vuelta

- **No dice que el eje mejoró.** No se midió nada; se corrigió la definición
  con material de una medición que ya suspendió.
- **No autoriza a tratar los 4 «B llegó solo» como acuerdo.** B llegó al
  criterio conversando con A delante; eso es exactamente lo que una muestra
  ciega no tiene. Es evidencia de que la definición es *entendible*, no de que
  sea *aplicable en frío* — y la brecha entre esas dos cosas es el hallazgo.
