# Qué dice el corpus vecinal

Análisis de `chat-anonimizado.txt` — 7.319 mensajes de un edificio real, abril
2024 a agosto 2026. Sirve para tres cosas: **descubrir las categorías de PQRS con
evidencia**, **saber cómo escribe la gente de verdad**, y un par de hallazgos de
producto que no tienen nada que ver con IA.

**Cómo leerlo:** los temas se contaron con patrones de palabras derivados de
leer una muestra, no al revés. Es aproximado y los temas se solapan —un mensaje
puede tocar tres—. Sirve para ordenar por magnitud, no para citar cifras exactas.

## Lo primero: el 35% son adjuntos

De 7.319 mensajes, **2.543 no tienen texto**: son fotos y PDF. Y una parte
grande son comprobantes de pago — el mismo residente mandando cada mes «mando
comprobante de mantenimiento» con la imagen.

Eso es `DOC-001` en estado salvaje. **El flujo real de comprobantes hoy es mandar
una foto a un grupo de WhatsApp**, y alguien del comité la mira y la apunta. No
hace falta imaginar el problema que resuelve la lectura de comprobantes: está
ocurriendo, todos los meses, a la vista.

## Los temas, por magnitud

Sobre los 4.038 mensajes de residentes:

| Tema | Menciones | En mensajes largos | En preguntas |
|---|---|---|---|
| Cuotas, pagos y morosidad | 335 | 55 | 38 |
| Agua: fugas, filtraciones, presión, cortes | 230 | 55 | 40 |
| Asambleas, comité y administración | 211 | 66 | 24 |
| Obra, estructura y mantenimiento | 177 | 52 | 17 |
| Elevadores | 153 | 34 | 12 |
| Seguridad, guardias y paquetería | 138 | 42 | 22 |
| Luz e instalaciones eléctricas | 98 | 11 | 19 |
| Convivencia y ruido | 76 | 24 | 8 |
| Alberca y amenidades | 66 | 25 | 10 |
| Portón, accesos y estacionamiento | 60 | 15 | 12 |
| Limpieza y basura | 48 | 20 | 7 |

Dos cosas que no se ven en una tabla de categorías inventada en una reunión:

- **El agua no es un tema, es *el* tema técnico.** Fugas, filtraciones,
  presión, bombas, cortes: 230 menciones y 40 preguntas. Un clasificador de PQRS
  que trate «agua» como una categoría más va a meter en el mismo cajón un corte
  programado y una filtración que está dañando el departamento de abajo.
- **«Asambleas y administración» pesa tanto como los problemas físicos.** 211
  menciones, y son las de tono más áspero. No es una categoría de mantenimiento:
  es descontento con el servicio. Un producto que solo clasifica averías se
  pierde un tercio de lo que la gente realmente plantea.

## Cómo escribe la gente

- **Mediana: 41 caracteres.** La mitad del chat es «gracias», «👍», «de
  acuerdo». El material con contenido son **298 mensajes de más de 190
  caracteres** y **397 preguntas**.
- **48% de los mensajes son de la tarde**, 31% de la mañana, 19% de noche. **90
  mensajes de residentes llegan de las 22:00 en adelante** — la hora que el plan
  menciona como el caso incómodo existe de verdad, aunque sea el 2%.
- **Los cinco más activos escriben la mitad de todo.** Un piloto que mida
  «adopción» va a estar midiendo a cinco personas.

## Los casos difíciles, que son los que hay que meter en la evaluación

El plan pide que el conjunto de evaluación incluya lo incómodo, no lo bonito.
Están todos, y contados:

| Caso | Cuántos |
|---|---|
| **Preguntas cortas sin contexto** (<80 caracteres) | **243** |
| Mensajes con tono de queja o enfado (>120c) | 42 |
| Mensajes que mezclan 3 temas o más | 28 |
| Mensajes de las 22:00 en adelante | 90 |

**El caso dominante no es el residente enfadado: es la pregunta de once
palabras sin contexto.** 243 de las 397 preguntas —el 61%— son demasiado cortas
para saber de qué van sin leer lo anterior. Ese es el caso que más va a aparecer
y el que más fácil se le pasa a un modelo: no es ambiguo por mal escrito, es
ambiguo porque el contexto está en los tres mensajes anteriores.

Y hay un caso que merece estar en la evaluación por sí solo. Este aviso lo
escribió la administración, palabra por palabra:

> «Se le recuerda respetuosamente a la Sra. Cristina, del departamento T1-11,
> que debe esperar a que se le abra el portón, independientemente de la prisa
> que lleve.»

Un comunicado público que señala a una vecina por nombre y departamento. La
pregunta para `FEAT-003` no es si el modelo *sabe* redactarlo — sabe de sobra.
Es **si debe**, y qué hace Vivaru cuando un administrador se lo pide.

## Dos hallazgos de producto que no son de IA

**1. Quien escribe los avisos no siempre es el administrador.** De los 83 avisos
largos del corpus, 56 los firma la administración y **27 los escriben
residentes** — miembros del comité publicando reportes de trabajos y
programación de mantenimiento de elevadores.

Eso choca con el catálogo: `comunicaciones-redactar` solo la pueden pedir
`tenant_admin` y `admin_tenant`. En este edificio, un tercio de las
comunicaciones las escribiría alguien que hoy no tendría permiso. **Hay que
revisar si el rol de comité debe poder redactar**, y eso es una decisión de
producto, no de IA.

**2. Los avisos reales tienen una forma muy estable.** Los del administrador van
de 160 a 700 caracteres, con una estructura que se repite: saludo, el hecho,
cuándo, a quién afecta, qué tiene que hacer el residente, y cierre cortés. Los
hechos que llevan casi siempre son fecha, hora, duración y zona afectada.

Eso valida el esquema de entrada del Paso 1.3 —propósito, hechos, tono— y sugiere
que los «hechos» más frecuentes son cuatro: **cuándo, cuánto dura, a qué zona
afecta y qué debe hacer el residente**. Un panel de hechos con esos cuatro campos
cubriría la mayoría.

## Ruido a tener en cuenta

- Hay al menos un mensaje que es una **transcripción pegada de un bot de
  atención telefónica** («¿Algo más en que le pueda ayudar?»). Si entra al
  conjunto de evaluación sin filtrar, se estaría evaluando contra la salida de
  otra máquina.
- Los «Reporte de trabajos» son listas largas de tareas de mantenimiento.
  Formalmente son avisos, pero de estructura muy distinta al resto; conviene
  tratarlos como un tipo aparte y no promediarlos con los demás.

## Qué NO prueba esto

**Es un edificio.** Lo que aquí pesa mucho puede no pesar en Bogotá o en Quito, y
las proporciones no son las del mercado. Sirve para **descubrir** categorías y
registro —y para eso es mucho mejor que inventarlas—, no para fijarlas.

Y sigue sin ser un conjunto de evaluación: un conjunto de evaluación lleva la
respuesta esperada escrita de antemano. Esto es la materia prima para armarlo.
