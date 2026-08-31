# Encender la IA — el frente 0, y tampoco lleva código

**Escrito el 30 de agosto de 2026.** Existe por la misma razón que
[`encender-el-lote-habitanto.md`](encender-el-lote-habitanto.md): hay capacidades construidas,
probadas, desplegadas y dormidas. **Pero la conclusión es distinta, y por eso este documento no es
una copia de aquel.**

> ## LO PRIMERO, PORQUE CAMBIA LA PREMISA
>
> **El frente se enunció como «lo de IA no se ha empujado a productivo». Medido, es falso en dos
> sentidos y cierto en uno.**
>
> - **El código de IA está desplegado y ACTIVO en producción.** `aiInvoke`,
>   `sombraPqrsAlCrearTicket`, `sombraPqrsAlActualizarTicket`, `getAiUsage` y `registrarFeedbackIa`:
>   las cinco `ACTIVE` en `hogaru-1`.
> - **Tres de las siete banderas llevan encendidas en producción desde el 17 de agosto**, entre ellas
>   **`ia-proveedor-real`, que es la que gasta dinero**.
> - **Y lo cierto: para un usuario no hay nada.** Las cuatro banderas con superficie visible están
>   apagadas, así que ningún administrador puede ver ni tocar una función de IA.
>
> **El cuello de botella no es encender: es que no hay tráfico.** El último ticket de producción es
> del **7 de agosto** — diez días *antes* de encender la sombra. Cero filas en `aiUsage`,
> `aiAssistance`, `aiFeedback` y `aiQuotaCounters`.

## Estado medido — 30 de agosto de 2026

| Bandera | `hogaru-1` (producción) | `vivaru-staging-02` |
|---|---|---|
| `ai-gateway` | 🟢 **encendida** 17 ago 15:10 | 🟢 encendida |
| `ai-pqrs-shadow` | 🟢 **encendida** 17 ago 15:11 | 🟢 encendida |
| `ia-proveedor-real` | 🟢 **encendida** 17 ago 15:11 | 🟢 encendida |
| `ai-pqrs-suggestions` | 🔴 apagada | 🟢 encendida |
| `ai-communications-draft` | 🔴 apagada | 🟢 encendida |
| `ai-onboarding-column-mapping` | 🔴 apagada | 🟢 encendida 30 ago 12:05 |
| `ai-receipts-extraction` | 🔴 apagada | 🟢 encendida 30 ago 12:05 |

Sin kill switch maestro en ninguno de los dos. Sin overrides de IA por conjunto.

**Datos generados hasta hoy:**

| Colección | Producción | Staging |
|---|---|---|
| `aiUsage` | **0** | 41 |
| `aiFeedback` | **0** | 22 |
| `aiQuotaCounters` | **0** | 23 |
| `aiAssistance` | **0** | **0** |

## La regla que gobierna esto — y por qué NO es la del lote de Habitanto

Allí la regla era *«una cada vez, mirando, con los números anotados antes»*, y encender era el mejor
retorno del tablero porque **cada bandera hacía aparecer una capacidad**.

**Aquí no.** Encender las cuatro que faltan en un producto sin tráfico no hace aparecer nada: pone
botones que nadie va a pulsar. **La regla de este frente es otra:**

> **Primero comprobar que el ciclo escribe. Después encender, y solo lo que alguien vaya a usar.**

Encender antes de comprobar es lo que ya pasó: la sombra lleva **trece días encendida en producción
sin haber escrito una sola fila**, y nadie lo sabía.

## El orden

### Paso 1 — Mirar el tope de gasto en la consola. ANTES de todo lo demás

**`ia-proveedor-real` está encendida en producción.** No es un ambiente en simulador: el día que
entre un ticket, se llama a Vertex y se paga. Lleva así trece días sin que nadie mire el tope.

**Se mira en pantalla, no de memoria.** Este proyecto ya leyó un tope de gasto de 80 pesos creyendo
que eran 80.000 — un factor de mil, y estaba escrito en un documento. **Anotar aquí lo que diga la
consola, con captura de la cifra y la fecha.**

Si el tope no existe o no es el que se creía, **este paso bloquea los siguientes**.

### Paso 2 — Responder si la sombra escribe. En STAGING, que es gratis

**`aiAssistance` está en 0 en los DOS ambientes**, y en staging la sombra lleva encendida desde el
17 de agosto con 41 usos de IA registrados. **Eso no cuadra**, y hay tres explicaciones posibles:

1. Los 41 usos vienen de los scripts del piloto (`evaluar-pqrs.mjs`, `probar-sombra.mjs`) y no del
   disparador, y **nunca ha entrado un ticket nuevo** desde que se encendió.
2. El disparador corre y **falla en silencio** — `sombraPqrsAlCrearTicket` traga su error a
   propósito, para que un fallo de la sombra no rompa el ticket.
3. Escribe en otro sitio del que se cree.

**Cómo se responde:** crear un ticket nuevo en staging y medir `aiAssistance` antes y después.

**Por qué en staging y no en producción:** si el disparador no escribe, el defecto es de código y se
arregla sin haber tocado producción. Y si escribe, ya sabemos que el ciclo vive.

> **Este paso es el que decide si el frente 0 tiene sentido.** Si la sombra no escribe, encenderla
> en producción **no acumula nada**, y todo el argumento de «esperar acumulando» de la hoja de ruta
> de IA es humo. Es la pregunta más barata y más cara de no hacerse.

### Paso 3 — Solo entonces, el canario de lo visible

Las cuatro apagadas en producción, **una a una, en `tenant-santa-maria`** y por override de
conjunto, igual que el push y el expediente de conciliación:

```bash
node functions/scripts/mover-bandera-de-conjunto.mjs hogaru-1 tenant-santa-maria <clave> true
```

| Orden | Bandera | Por qué en este orden | Qué mirar |
|---|---|---|---|
| 1 | `ai-pqrs-suggestions` | La sombra ya lleva su gemela encendida: es la que menos añade | Que la sugerencia aparezca y que el administrador siga pudiendo clasificar a mano |
| 2 | `ai-communications-draft` | Tiene consumidor real y su línea base **lleva tres sesiones sin tomarse** | Que el borrador aparezca dentro del formulario y no lo sustituya |
| 3 | `ai-onboarding-column-mapping` | **No tiene consumidor: no la enciendas todavía** | — |
| 4 | `ai-receipts-extraction` | Sin corpus (`DOC-001`): 0 comprobantes con fichero en producción | — |

> **`ai-onboarding-column-mapping` no hace nada.** Medido: **cero referencias en el código** fuera del
> catálogo de banderas. Encenderla —como se hizo en staging el 30 de agosto— no cambia nada. Es la
> tercera forma de «una bandera no siempre es el freno»: aquí ni siquiera hay código detrás que
> frenar. Su capacidad la construirá el frente 5 (`AI-ONB-001`).

### Paso 4 — Anotar el antes y el después

Los números de arriba, releídos al terminar. **Si no cambió ninguno, el frente cerró sin producir
nada y eso también es un resultado** — significa que el cuello está donde dice el paso siguiente.

## Lo que este frente NO puede desbloquear

**Sin conjuntos activos no hay tickets, y sin tickets la IA de PQRS no tiene sobre qué correr.** Se
escribe aquí para no volver a discutirlo:

- La clasificación en sombra necesita **tickets nuevos**. Producción no tiene uno desde el 7 de agosto.
- La extracción de comprobantes necesita **100–200 comprobantes reales** y hay **cero ficheros**.
- El mapeo de columnas necesita **15–25 archivos de importación** y no se está guardando ninguno.

**Ninguna de las tres la desbloquea encender una bandera.** Las desbloquea vender y activar
conjuntos, o recolectar a mano. Es el mismo diagnóstico que ya tienen `AI-DATA-001` y `FIN-AI-001`.

## Cuándo parar

- **Si el tope de gasto no es el esperado** (paso 1), parar y decidir antes de seguir.
- **Si la sombra no escribe** (paso 2), parar: hay un defecto que arreglar y encender más sería
  acumular banderas sobre un mecanismo roto.
- **Si al encender la primera del paso 3 aparece cualquier cosa rara**, parar. Una cada vez existe
  para esto.

## Corrección al roadmap que sale de esta medición

`docs/roadmap-producto.md`, iniciativa **`AI-PQRS-001`**, dice: *«Su bandera está apagada en
producción y su callable no está desplegada ahí»* (17 ago 2026).

**Las dos mitades están desactualizadas.** Medido el 30 de agosto: `aiInvoke` está **desplegada y
`ACTIVE` en `hogaru-1`**, y de las dos banderas de PQRS **`ai-pqrs-shadow` está encendida** —solo
`ai-pqrs-suggestions` sigue apagada—. Se corrige en su ficha.
