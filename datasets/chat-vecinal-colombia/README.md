# Corpus: chat vecinal de Colombia, anonimizado

**2.984 mensajes reales de un conjunto de Bogotá, dos torres**, de abril de 2024
a agosto de 2026, 111 remitentes distintos (incluye avisos de sistema). Es el
tercer corpus del programa de IA, detrás del de Ciudad de México (5.158
mensajes) y el de Quito (4.358).

## Para qué existe

Colombia es el tercer país del producto y no tenía voz en ningún dato: el gold
set de PQRS salió de México y Ecuador (`datasets/pqrs/`), y las frecuencias de
tema que sostienen la taxonomía venían de dos países. Este corpus permite
comprobar si generalizan a un tercero — y mirar si el hueco de `billing` (15
casos en el gold set, porque en Ecuador las cuotas son el 1,3% de los mensajes)
se puede cerrar con material colombiano. **Respondido en `analisis.md`:** los
once temas aguantan; las cuotas dan 1,7% —México es el atípico, no la regla—
y `billing` no crece por proporción, aunque hay ~35–40 casos utilizables si se
decide crecerlo a mano.

## Qué se le hizo

Dos pasadas, por herramientas distintas, igual que los otros dos corpus:

1. **Sustitución de nombres de personas** (herramienta previa, fuera de este
   repo). Cambió los nombres y NO tocó nada más — el mismo estado en que llegó
   el corpus mexicano.
2. **`scripts/anonimizar-chat-colombia.mjs`** (este repo), que limpió lo que la
   medición del 15 de agosto de 2026 encontró vivo: 15 teléfonos (incluidos
   cuatro REMITENTES que eran un número y uno en formato «(304) 618-9142»),
   6 correos —dos con dominio propio del edificio—, 20 números de apartamento
   en cuatro grafías, 134 menciones del nombre real del conjunto, la dirección
   exacta del edificio (aparecía dos veces dentro de un directorio vecinal de
   40 entradas), 3 placas de carro, el nombre de la empresa de vigilancia, y
   los nombres de contacto en los archivos `.vcf` adjuntos.

La cabecera del script documenta las trampas y el porqué de cada decisión; la
verificación corre dentro del propio script y además se pasó un escáner
independiente escrito ANTES que el limpiador (lección 2: una comprobación que
comparte el punto ciego de lo que comprueba no comprueba nada).

## Qué NO se tocó, a propósito

- **El directorio de edificios vecinos** (39 nombres y direcciones de otros
  conjuntos de la zona). Son entidades públicas, no personas; solo se sustituyó
  la entrada del edificio propio.
- **Importes, fechas, horas y el texto de los mensajes.** Incluido el hilo del
  trabajador despedido: su nombre ya era ficticio, y con el edificio, la
  empresa y la dirección anónimos, el hecho deja de acotar a una persona.
- **Nombres de personas**: ya eran ficticios de la pasada 1.

## El crudo NO está en el repo

Como en México y Ecuador, aquí solo vive el anonimizado. El archivo de origen
queda fuera de git, en el Drive privado del propietario. **«Nombres cambiados»
no es «datos limpios»**: si llega un corpus nuevo con esa promesa, medir
primero — este llegó descrito como limpio y traía la dirección del edificio.
