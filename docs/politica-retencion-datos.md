# Política de retención de datos — Vivaru

> **Decidida por David el 21 de agosto de 2026.** Es el primer documento de retención de
> Vivaru: hasta hoy había números corriendo en producción, pero ninguna frase que
> dijera por qué.

---

## En una frase

**Vivaru retiene 12 meses.** Un solo número para toda la casa, incluido lo que Albert
gestione en nuestro nombre. No es la propuesta de nadie: es la cifra que Vivaru ya
aplicaba en producción sin haberla escrito.

---

## 1. La decisión

| # | Qué | Número | Criterio de arranque del reloj |
|---|---|---|---|
| **1** | Un deal del CRM **sin actividad** antes de anonimizarse | **12 meses** | `updatedAt` del deal |
| **2** | El **registro de auditoría del borrado** (`vivaruLeadId`, `dealId`, fecha, actor) | **12 meses** | La fecha del borrado, no la del deal |

Estos son los dos números que Albert pidió para cerrar su **B3**. La maquinaria es suya y
es parametrizable; los números son nuestros.

### Por qué 12 y no los 24 que proponía Albert

Porque **12 ya es la cifra de la casa**, y tener dos criterios obliga a explicar la
diferencia cada vez que alguien pregunte. Ver el inventario del §2: los tres mecanismos
de retención que Vivaru ya tiene corriendo dicen 12.

La propuesta de 24 de Albert es defendible —un lead comercial puede dormir un año y
despertar— pero es **su** contexto, no el nuestro. Y el campo es parametrizable
justamente para que subirlo después sea barato si el negocio lo pide.

### El riesgo que se acepta con el número 2, escrito a propósito

**A los 18 meses no habrá con qué demostrar que un borrado ocurrió.** Si alguien reclama
entonces que su dato nunca se suprimió, el registro que lo probaba ya se purgó.

Esto **no es un descuido**: es la contrapartida de la coherencia. La alternativa habitual
—guardar la prueba 36 meses— sobrevive a la reclamación, pero mantiene vivo un
identificador que **reidentifica** mientras el lead exista de nuestro lado. Se eligió
minimizar la reidentificación y asumir la ventana corta.

**Cuándo volver sobre esto — ya no es «cuando alguien se acuerde».** Ver la condición de
vigilancia de abajo, que es lo que salió de discutirlo con Albert el 22 de agosto.

### Condición de vigilancia del número 2 — escrita para que se revise sola

Albert recomendó subir el n.º 2 a 24–36 meses, y su argumento era bueno: el registro de
borrado **deja de reidentificar** en cuanto el lead muere en Vivaru, porque `vivaruLeadId`
pasa a ser un puntero colgante. Si eso fuese cierto hoy, 12 sería un número mal elegido.

**Se fue a medir y la premisa no se cumple** (22 ago 2026): `eraseByExternalRef` **no se
invoca desde ningún sitio** de Vivaru, y `leads` **no tiene ventana** (§3). O sea que **hoy
nada borra un lead**, el puntero apunta a un registro vivo y **sigue reidentificando** — que
es exactamente la razón por la que se eligió 12.

Su argumento no era falso: era **condicional**, y la condición es una pieza nuestra que aún
no existe.

> **CONDICIÓN — redacción de Vivaru, comprobable en casa:**
> El número 2 permanece en **12 meses** mientras **no exista en el código de Vivaru un
> camino de supresión que borre el lead e invoque `eraseByExternalRef` en la misma
> operación**. El día que exista, el puntero cuelga de verdad y **el número 2 se revisa al
> alza**.
>
> **Cómo se comprueba:** `grep -rn "eraseByExternalRef" src/ functions/src/`.
> **Estado hoy (22 ago 2026): cero apariciones.**

**Por qué la redacción es nuestra y no la suya.** Albert la escribió como *«mientras
`eraseByExternalRef` no reciba llamadas originadas en Vivaru»*, que es observable **desde su
lado** — nosotros no vemos sus invocaciones. Misma condición, una redacción por casa, para
que ninguno dependa del otro para verificarla. La suya vive en su
`docs/POLITICA-RETENCION-ALBERT.md`.

**Y subirlo será barato:** Albert construyó los dos números como **parámetros
independientes**, así que cambiar el 2 no toca el 1 ni pide despliegue.

---

## 2. Lo que Vivaru YA retiene — inventario leído del código, no supuesto

Las tres corren en la **misma tarea nocturna**, `anonymizeExpiredVouchersDaily`, todos los
días a las **03:00**. Ver `functions/src/data-retention.ts`.

| Qué | Ventana | Qué hace exactamente |
|---|---|---|
| **Comprobantes de pago** | **12 meses** (configurable por conjunto en `tenantSettings.fiscalProfile.dataRetentionMonths`) | **Anonimiza, no borra**: vacía cédula y nombre del pagador y marca `anonymizedAt`. Conserva secuencial, monto y fecha |
| **Telemetría de IA** (`aiUsage`) | **12 meses** (`AI_USAGE_RETENTION_MONTHS`) | Borra la fila |
| **Feedback de borradores asistidos** (`aiFeedback`) | **12 meses** (misma constante) | Borra la fila |

**Detalle que importa:** el de comprobantes es el único **por conjunto**. Un cliente puede
pedir otra ventana y se le configura sin tocar código. Los otros dos son globales.

**Y por qué el de comprobantes anonimiza en vez de borrar:** conservar el documento es
obligación del contribuyente y del ente fiscal, no de la plataforma. Vivaru puede purgar
la PII que almacena sin destruir el rastro contable.

---

## 3. Lo que esta política NO cubre — los huecos, dichos en voz alta

**Ninguna otra colección con dato personal tiene ventana de retención.** Se comprobó
enumerando las tareas programadas: solo hay una que purgue por antigüedad, y cubre las
tres filas del §2.

Quedan fuera, al menos:

| Colección | Qué guarda | Estado |
|---|---|---|
| `tickets` | PQRS en **texto libre**, donde el residente escribe lo que quiera | Sin ventana |
| `people` | Residentes y su información de contacto | Sin ventana |
| `leads` | Interesados comerciales del lado Vivaru | Sin ventana. **Es la que sostiene la condición de vigilancia del §1**: mientras un lead viva para siempre, el registro de borrado de Albert sigue reidentificando |
| `errorLogs` | Errores del navegador, que pueden arrastrar contexto | Sin ventana |

**El más incómodo es `tickets`**, y por la misma razón que Albert descubrió en su
timeline: el dato personal **no está en un campo, está dentro del texto**. Vaciar campos
no lo quita; habría que reescribir el contenido. Es el mismo problema, en nuestra casa.

**No se decide aquí.** Se deja anotado para que la próxima vez que alguien pregunte «¿y
esto cuánto vive?» la respuesta no sea un silencio.

---

## 4. Lo que se le mandó a Albert — HECHO y aceptado

Los dos números salieron en `DECISIONES-A-002` (21 ago) con la frase del reloj: **la ventana
del registro de auditoría arranca en la fecha del borrado, no en la del deal.** Sin ella,
«12 meses» era ambiguo y podía cablearse contra el reloj equivocado — que además era el que
tenían más a mano.

**Aceptados los dos en `RESPUESTA-A-004`** (22 ago), con la condición de vigilancia del §1
recogida en ambos lados. **B3 deja de estar bloqueado por nosotros.**
