# Corpus: chat vecinal de Ecuador, anonimizado

**4.358 mensajes reales de un grupo de residentes de Quito**, de octubre de 2019
a julio de 2026 — **seis años y nueve meses**, casi el triple de historia que el
corpus mexicano. Un solo edificio, 12 departamentos, 12 personas escribiendo
avisos.

Es el segundo corpus del programa de IA, y existe para contestar una pregunta
que los tres documentos del canario dejaban abierta:

> *«Un solo edificio. Las proporciones vienen de un corpus de Ciudad de México.
> Sirven para descubrir qué casos existen, no para afirmar que así se reparten
> en el mercado.»*

Todo lo que sostiene el canario —los cuatro datos, sus frecuencias, la taxonomía
de los 60 casos de evaluación, la línea base de 1,2 de 4— salía de un edificio
de un país. **Este corpus es la comprobación de que generaliza.** El resultado,
en `analisis.md`.

## Qué se le hizo

Dos pasadas, como el mexicano:

1. **Sustitución de nombres y departamentos** (fuera de este repo). Cambió los
   nombres de las personas y los códigos de departamento por otros ficticios.
2. **`scripts/anonimizar-chat-ecuador.mjs`** (este repo, reproducible). Porque
   la primera pasada **no tocó los teléfonos**, y un número identifica a una
   persona igual o mejor que su nombre. Con nombres falsos al lado, el corpus
   parecía anónimo y no lo era.

### Qué limpió la segunda pasada

| Qué | Cuánto |
|---|---|
| Teléfonos, de cualquier país | **48 distintos**, 1.700+ apariciones |
| Nombre del edificio | 555 menciones |
| Correos | 1 |
| Identificadores de reunión | los que hubiera |

### Los cuatro fallos que costó, y cómo aparecieron

Ninguno se vio leyendo. Cada uno lo cazó una comprobación distinta, y por eso
están las cuatro en el script:

1. **Teléfonos con espacios.** `099 9999 999` no lo veía un patrón que exigía
   diez dígitos seguidos. Lo cazó la verificación del propio script. Al
   enumerar **todas** las formas presentes aparecieron cinco distintas.
2. **Una grafía más del edificio.** `Cyprian`, una sola vez en 5.538 líneas,
   donde el patrón buscaba `Cyprien` y `Cypryen`. Lo cazó una comprobación
   **externa**, hecha con otras herramientas. Ahora se sustituye cualquier
   palabra que empiece por esas letras: es más seguro que enumerar las grafías
   que a la gente se le ocurren.
3. **Teléfonos de otros países.** 84 números `+1` y 6 `+91` —vecinos que
   escriben desde el extranjero— que sobrevivieron porque el patrón solo miraba
   `+593`. Los destapó **la lista de autores del análisis**, no la
   anonimización.
4. **Saltos de línea comidos.** El patrón generalizado usaba `\s`, que incluye
   `\n`, y fusionaba un número al final de una línea con los dígitos de la
   siguiente. La salida perdió 7 líneas. **Solo se ve comparando recuentos**, y
   por eso el script ahora falla si la salida no conserva exactamente las mismas
   líneas que la entrada.

La lección es la misma que dejó escrita el script mexicano y que volvió a
cumplirse aquí: **una comprobación que comparte el punto ciego de lo que
comprueba no comprueba nada.** Las dos veces que este script se dio por bueno,
lo desmintió una herramienta distinta.

## Lo que NO se tocó, a propósito

- **Nombres y departamentos**: ya eran ficticios. Volver a mapearlos rompería la
  consistencia con lo que ya se sustituyó.
- **Números que no son teléfonos.** Un número de pedido y un identificador de
  reunión, ninguno con prefijo de celular. Mapear un número de pedido corrompe
  el contenido sin proteger a nadie — es el error que el script mexicano cometió
  con el 911 y dejó documentado.
- **Importes, fechas, horas y el texto.** Son el contenido que hace útil el
  corpus y no identifican a nadie.

## Cómo reproducirlo

```
node scripts/anonimizar-chat-ecuador.mjs <export.txt> datasets/chat-vecinal-ecuador/chat-anonimizado.txt
```

El script **falla y no deja usar la salida** si sobrevive un solo teléfono o si
se pierde una línea. No hay que acordarse de comprobarlo.
