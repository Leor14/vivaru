# Colombia contra México y Ecuador: los temas de PQRS en el tercer país

Medido el **15 de agosto de 2026** sobre los tres corpus anonimizados, con
`scripts/analizar-temas-pqrs.mjs` y el tamiz compartido de
`scripts/lib/temas-pqrs.mjs`.

## Por qué había que hacerlo

La taxonomía de temas del gold set de PQRS (`datasets/pqrs/taxonomia.md`) se
construyó con frecuencias de dos países, y su hueco más citado —`billing` con
15 casos— tenía una explicación de un solo país: en Ecuador las cuotas son el
1,3% de los mensajes. Este corpus responde dos preguntas: si los once temas
aguantan un tercer país, y si Colombia trae cuotas en volumen para cerrar ese
hueco.

## El tamiz tuvo que crecer para leer este export, y el orden protege las cifras

Tres cambios, cada uno medido ANTES de aplicarlo y con regresión DESPUÉS
—México y Ecuador quedaron idénticos al dígito en las tres—:

1. **El marcador `<adjunto: …>`** (325 mensajes): este export es CON medios; los
   otros dos dicen «imagen omitida». El parser lo quita del texto — 224
   mensajes que eran solo el adjunto quedan vacíos y caen del denominador, los
   101 con texto conservan su parte humana. Los otros corpus tienen CERO
   marcadores con ángulo, medido antes de tocar.
2. **Cuatro grafías de sistema colombianas** («se unió CON el enlace», «desde la
   comunidad», «te uniste a un grupo», «creó ESTE grupo»): 43 líneas que el
   filtro `SISTEMA` no cazaba.
3. **«celador»**, la voz colombiana del vigilante: 28 apariciones aquí, 0 en los
   otros dos corpus. Sin ella, Colombia parecía hablar menos de seguridad de lo
   que habla — el «pipa/tanquero» de siempre, y salió **muestreando los largos
   sin tema**, no contando.

**`esAdmin` no se tocó, y el motivo importa:** este corpus no tiene ningún
remitente de administración. Es un chat de vecinos — la voz administrativa
entra por miembros del consejo con nombre propio, que es exactamente el caso
que México ya midió (27 de 83 avisos los escriben residentes del comité). Por
eso «de residentes» = «mensajes» en la tabla, y no es un fallo del filtro.

## El resultado

| % de mensajes con texto | México | Ecuador | **Colombia** |
|---|---|---|---|
| asamblea_administracion | 9,9% | 6,5% | **10,7%** |
| cuotas_pagos | 9,8% | 1,3% | **1,7%** |
| agua | 7,2% | 3,7% | **4,7%** |
| obra_mantenimiento | 6,7% | 2,3% | **2,5%** |
| elevadores | 5,4% | 3,8% | **0,5%** |
| seguridad_porteria | 5,4% | 3,6% | **4,8%** |
| luz_electricidad | 2,8% | 5,6% | **4,0%** |
| amenidades | 2,3% | 0,6% | **2,6%** |
| accesos_estacionamiento | 2,1% | 1,7% | **1,4%** |
| convivencia_ruido | 2,0% | 2,0% | **3,9%** |
| limpieza_basura | 1,7% | 0,9% | **1,5%** |

Colombia: 2.984 mensajes, 2.650 con texto aprovechable, 449 preguntas (212
cortas), 391 largos.

## La respuesta a la pregunta del corpus: `billing` NO se cierra por proporción — y quizá sí por absolutos

**Cuotas en Colombia: 1,7%. Colombia se parece a Ecuador, y México es el
atípico.** La explicación de un país ya es un patrón de dos: donde el grupo es
de vecinos, los pagos no se discuten en público. La cifra mexicana venía además
de un grupo de AVISOS de administración —recordatorios de pago incluidos— y de
que allí «mantenimiento» nombra la cuota mensual.

**Pero el gold set no necesita porcentajes: necesita casos.** Hay **46
candidatos** de `cuotas_pagos` en Colombia, y el muestreo enseñó material de
libro — «hice una consulta sobre mi estado de cuenta hace 10 días y no ha sido
posible obtener respuesta», «los valores entre la relación de cobros y el que
me están cobrando no coinciden». Quitando falsos positivos (abajo), quedan del
orden de 35–40 utilizables. **Si `billing` necesita crecer, el material existe;
lo que no existe es la proporción que México sugería.**

## Lo que se confirma y lo que cambia

- **Los once temas aguantan el tercer país; ningún tema nuevo apareció** en el
  muestreo de largos sin tema — lo que apareció fue vocabulario («celador»), no
  categorías. Lo demás sin tema son clasificados, ventas y vida social, que no
  son PQRS.
- **`asamblea_administracion` es #1 en los tres países** (9,9 / 6,5 / 10,7). La
  decisión de tratarlo como el tema mayor está ahora sostenida en tres.
- **Las preguntas cortas siguen siendo el caso dominante:** 47% de las
  preguntas colombianas van en menos de 80 caracteres — la taxonomía ya lo
  declaraba como el formato que el clasificador más va a ver.
- **`elevadores` se desploma: 0,5%** (12 mensajes) contra 5,4% de México. Es el
  «torre 0» de Ecuador en versión colombiana: estructural del edificio, no
  cultural. Refuerza la misma conclusión — el peso de un tema depende del
  conjunto, y el producto lo sabe por sus datos (`units`), no por el país.
- **`convivencia_ruido` dobla a los otros dos países** (3,9%) y
  `seguridad_porteria` es el #2 local: este corpus trae la saga completa de un
  celador despedido y varias de ruido entre vecinos. Materia prima buena para
  `complaint`, que es el `type` con menos representación limpia.

## Los límites, dichos aquí para que nadie los descubra tarde

- **Un conjunto de Bogotá, dos torres.** Tercer edificio, no tercer mercado.
- **El corpus es de OTRO género que el mexicano:** chat de vecinos contra grupo
  de avisos. Eso hace su voz más parecida a la entrada real de PQRS (17% de
  preguntas contra 12% y 8%) y a la vez ensucia la comparación de cualquier
  tema donde la administración hable distinto que los vecinos — `cuotas_pagos`
  el primero.
- **«transferencias» tiene un falso positivo eléctrico**, encontrado
  muestreando: «tres transferencias, cada una con su propia señal hacia la
  planta» cuenta como cuotas y es un tablero de transferencia de energía. El
  conteo ordena por magnitud; para extraer casos se muestrea y se lee, siempre.
- **54 mensajes con 3+ temas** (contra 15 de Ecuador): los vecinos colombianos
  escriben párrafos que mezclan asuntos. Al extraer casos del gold set habrá
  más `temasSecundarios` que en Ecuador.
