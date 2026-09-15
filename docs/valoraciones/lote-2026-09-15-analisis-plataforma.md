# Lote «Análisis de la plataforma» — 15 sep 2026

> **Fuente.** El documento «ANÁLISIS PLATAFORMA VIVARU» (14 páginas, 28 capturas), escrito por una
> **administradora de propiedad horizontal en Colombia** que recorrió el portal de administración del
> conjunto demo Santa María el 13 sep 2026. Lo que dice de su práctica vale **0,8** (§5.4 del modelo).
>
> **Cómo se valoró.** Con `docs/modelo-de-priorizacion.md` **v0.3** y la skill `valorar-iniciativa-vivaru`.
> **Día uno activo**: los 10 conjuntos de producción son de ejemplo (medido el 15 sep con
> `scripts/leer-monedas.mjs`). Seis agentes, uno por bloque de módulos, prepararon el expediente y las
> fichas leyendo el código, en solo lectura; la revisión y el orden son de la sesión principal.
>
> **Lo que no se midió:** cuántos tickets llevan la etiqueta sucia (L-21d), cuántos comunicados,
> encuestas y firmas hay, el tope de gasto de la IA, y staging. No se pudo leer la Ley 675: los sitios
> oficiales rechazaron la conexión, así que cuenta como no leída (0,3).
>
> **Aviso de comparabilidad.** Los agentes no leyeron igual el Ingreso 2 («lo pide un prospecto por
> escrito»): uno contó cada «debe» del documento; otros pusieron 1 porque no está definido si ella es
> prospecto. La diferencia en el impacto ajustado es de 0,25–0,4 por necesidad. Ver §6.
>
> **David, 15 sep: la administradora cuenta como prospecto.** Así que lo que pidió por escrito lleva
> Ingreso 2 (0,8). **El recálculo está pendiente**: con la regla de confianza vigente (§5.4, la prueba
> más débil entre las notas de 2 o 3) el cambio no es monótono. Las necesidades cuyo único 2 pasa a
> ser el Ingreso saltan de 0,5 a 0,8 de confianza, y las que ya tenían otro 2 con prueba leída se quedan
> en 0,5. Tener más pruebas puede bajar la nota. Se propone arreglar la regla (v0.4) antes de recalcular.
>
> **Esto ordena; no decide.** Decide David.

---

## 1. El lote ordenado (reglas de §7.3 del modelo)

Horas de trabajo activo; las esperas (§6.5) aparte. IA = impacto ajustado.

### 1.1 Candidatas a obligatorio — reproducir antes de nada

Leídas en el código, **sin reproducir**. Si se confirman, pasan la puerta de §2.1 (datos personales) y
van por delante de todo lo demás.

| Id | Qué | Dónde | Por qué podría ser obligatorio |
|---|---|---|---|
| **D-2** | **Un comunicado dirigido a unas unidades avisa a todos los residentes**: `onCommunicationCreated` no lee `audienceUnitIds` | `functions/src/index.ts` | Si el comunicado lleva información de una unidad (cartera), la ven las demás |
| **D-3** | **En Documentos, la categoría por defecto «otro» la leen los residentes** (está en su lista blanca) | `src/app/(admin)/admin/documents/page.tsx`, `firestore.rules` (~l.1325) | Un informe de cartera subido sin cambiar la categoría queda a la vista de todos |

Cómo se reproducen: minutos en staging, con un comunicado dirigido y un documento de prueba. **Pide
permiso**, porque escribe datos de prueba.

### 1.2 Elegibles hoy (freno A), por puntuación

| Id | Necesidad | IA | Horas | Puntuación | Cuadrante | Esperas |
|---|---|---|---|---|---|---|
| **L-27** | Presupuesto del año, privado del administrador: **ya existe y ya es privado**; en Santa María está apagado | 2,75 | 0,45 | **6,1** | Relleno | Encender la bandera en producción |
| **L-21d** | **Defecto: PQRS enseña la unidad como un id crudo** («torre1-G1bW…») y al residente como «Residente» | 5,5 | 1,1 | **5,0** | **Ganancia rápida** | Push; corregir los datos es opcional y con permiso |
| **L-08a** | **Defecto: la portería no puede registrar la salida de un visitante frecuente** (la regla niega `inside→scheduled`, sin test). Desbloquea L-10 | parte de L-08 (5,0) | ~0,8 | — | — | Permiso de reglas, sesión de portería |
| **L-20** | Paquetería: qué empresa lo trajo, en qué estado llegó, la entrega a la vista y el protocolo | 3,4 | 1,2 | 2,8 | Relleno | Push, portería |
| **L-24** | Tendencia de cartera mensual y acumulada del año | 2,5 | 0,9 | 2,8 | Relleno | Push |
| **L-22** | Subir el informe del contador sobre la cartera, forzando la categoría `financiero` | 2,25 | 0,85 | 2,6 | Relleno | Permiso |
| **L-23** | Correo de cobro a los deudores. Incluye **el defecto D-1**: «Enviar aviso a residentes» dice «tienes cartera en mora» **a todos**, también a los que están al día | 3,5 | 1,4 | 2,5 | Relleno; **Ganancia rápida** si se reproduce D-1 | CLI de firebase, functions, correo real |
| **L-29** | Saber qué guarda hizo cada gestión: la entrada y salida por QR no guardan autor (**309 ingresos sin autor** en producción) | 4,2 | 1,8 | 2,3 | **Ganancia rápida** | Reglas (amplía), portería |
| **L-07** | Ver las unidades de un mismo dueño | 2,0 | 1,0 | 2,0 | Relleno | Push |
| **L-21** | PQRS: adjuntar evidencia de la solución y exportar el detalle a Excel | 3,0 | 1,8 | 1,7 | Relleno | `storage.rules`, residente |
| **L-13** | Cuántas personas vieron un comunicado | 1,5 | 1,5 | 1,0 | Relleno | Reglas, push |

### 1.3 Esperan una decisión de David (freno B), por puntuación

| Id | Necesidad | Qué hay que decidir | IA | Horas | Punt. | Cuadrante |
|---|---|---|---|---|---|---|
| **L-04** | «Porcentaje de copropiedad» en vez de «coeficiente»: **Santa María no tiene país** (medido) | Poner `country: CO` (punto 4 del menú, permiso uno a uno) | 2,75 | ~0,5 | **5,5** | Relleno |
| **L-17** | Encuestas: un nombre más cercano. **El editor de formularios ya existe** | El nombre (con él, XS) | 1,8 | 0,5 | 3,6 | Relleno |
| **L-08b** | El residente crea su propio visitante frecuente | Si puede hacerlo él solo | 5,0 (con L-08a) | 1,5 | 3,3 | **Ganancia rápida** |
| **L-18** | **El reglamento pide firmas que en propiedad horizontal nadie da.** El modo sin firmas (`governance: informativo`) ya existe; el reglamento no lo consulta, y el panel avisa en rojo de «17 firmas pendientes» | El valor por defecto por país; qué pasa con la firma de acuerdos | 3,4 | 1,1 | 3,1 | Relleno, a 0,6 de Ganancia rápida |
| **L-32** | Números de emergencia y preguntas frecuentes del conjunto | ¿FAQ del conjunto o de la plataforma? ¿Quién redacta? | 3,9 | 1,3 | 3,0 | Relleno |
| **L-03** | El alta de unidad pide área y valor del seguro, **que ningún código lee** | ¿Retirar, esconder o por país? Si incluye H.39, cierra el cabo de T3.5 | 2,1 | 0,85 | 2,5 | Relleno |
| **L-19** | Reservas con valor de alquiler, depósito, aforo en personas y protocolo | ¿El valor solo se informa o genera un cargo? | 4,8 | 1,9 | 2,5 | **Ganancia rápida** |
| **L-15** | Clase del comunicado (noticia, general, cartera) | La taxonomía | 2,2 | 1,0 | 2,2 | Relleno |
| **L-06** | Tercera figura: el administrador del apartamento (inmobiliaria). Es el candidato `A3` | ¿Recibe cobros, avisos o acceso? | 2,0 | 1,0 | 2,0 | Relleno |
| **L-10** | Personal de servicios del edificio por categoría y con horario (`createVisitor` pierde hoy la categoría y la hora de fin) | ¿Catálogo del conjunto o personal por unidad (`A11`)? | 3,9 | 2,0 | 2,0 | Relleno, al borde |
| **L-09** | Foto del visitante para que el residente apruebe | Cómo lee la foto el residente; cuánto se guarda | 2,5 | 1,3 | 1,9 | Relleno |
| **L-16** | Servicios como clasificados de la copropiedad, incluida la unidad en arriendo o venta | El nombre; quién publica | 1,8 | 1,1 | 1,6 | Relleno |
| **L-14** | Registro de comunicados borrados | Qué se conserva (choca con la protección de datos) | 1,5 | 1,1 | 1,4 | Relleno |
| **L-26** | Matriz de mantenimientos para el consejo y la copropiedad | Qué activos, qué periodicidad, quién la ve | 2,25 | 2,6 | 0,87 | Relleno |
| **L-25** | Consumo de las zonas comunes con tendencia (el producto mide por unidad) | ¿Dentro de Medidores o como vista sobre los egresos? | 1,7 | 2,0 | 0,85 | Relleno |
| **L-30** | Novedades y minuta de vigilancia | La taxonomía de novedades (`J1`/`J3`) | 1,9 | 2,8 | 0,7 | Relleno |
| **L-28** | Convivencia: llamados de atención, descargos, tabla de medición | ¿Solo registro o proceso de descargos? | 2,25 | 3,3 | 0,68 | Relleno |
| **L-01b** | Un tema de color más llamativo | Decisión de diseño | 1,3 | 2,6 | 0,5 | Relleno |
| **L-05** | Exención por mora también en el parqueadero | Depende de `A8` (parqueaderos) | 2,0 | 3,75 | 0,5 | Relleno; Pozo al doble de horas |

### 1.4 Esperan a un tercero (freno C)

| Id | Necesidad | Qué falta | Punt. | Cuadrante |
|---|---|---|---|---|
| **L-31** | Calificación del edificio unida a la de Google | La ficha de Google de cada edificio y sus términos | 0,4 | Relleno |
| **L-32b** | Chatbot 24/7 | Preguntas reales y corpus; el tope de gasto de IA. Iría por `crear-prd-ia-vivaru` | 0,4 | **Pozo** (8 h; se parte) |

### 1.5 Puerta XS: sin puntuar, se hacen juntas (menos de 2 horas en total)

- **L-01a** Añadir menta y violeta a los colores sugeridos del conjunto.
- **L-02** Enseñar el formato de la carga masiva fuera del asistente, en Excel y no solo CSV, con parqueadero y bodega en «valores válidos».
- **L-11** Decir en Visitantes, Reservas y Paquetería que **la portería tiene su propio panel**: lo que ella pidió, «dos perfiles», ya existe y no se ve.
- **L-12** Enseñarle al administrador la fecha de publicación que pone la plataforma. El residente ya la ve.
- Tildes: «Tipo de ocupación» y «Núcleo familiar».
- **L-17**, en cuanto David decida el nombre.

**Fila nueva que sugiere el bloque 1, sin valorar:** poner el coeficiente y la cuota en la carga masiva
de unidades (candidato `A13`). Unas 1,7 h, con Día uno 2.

---

## 2. Qué dice el lote, en conjunto

- **La mitad de lo que pide ya existe y no se ve, o se ve mal.** El presupuesto privado, los perfiles de
  portería, el modo sin firmas, el editor de encuestas y la fecha de publicación. El problema más
  repetido no es construir, es **enseñar**: la demo y las pantallas.
- **Los defectos pesan más que las mejoras.** Tres de las cuatro Ganancias rápidas son o contienen
  defectos: L-21d; L-29, que pierde el autor de 309 ingresos; y L-08, que contiene L-08a. La cuarta,
  L-19, no lo es. L-23 pasaría a Ganancia rápida si se reproduce D-1, y D-2 y D-3 pueden ser
  obligatorios.
- **Casi todo lo nuevo es pequeño**: 22 de las 31 filas puntuadas cuestan menos de 2 horas.
- **Hay muchos frenos B**: 19 necesidades esperan una decisión de producto. Ordenadas por puntuación, la
  lista de §1.3 dice qué decisión vale más tomar primero.

## 3. Las tres señales de que un módulo sobra

- **Libro y fondos**: «no tan requerido; eso se da en los estados financieros o en la asamblea». Ella
  valora lo que se entrega —el informe de FLOW-007—, no la pantalla de trabajo. El Libro alimenta el
  informe, así que no se puede quitar.
- **Tesorería (FEAT-010)**: la misma frase. **Es una prueba de 0,8 de que para una administradora
  colombiana la tesorería no forma parte de su mes**: Día uno ≤ 1 en Colombia. Pesa contra seguir
  invirtiendo en ella o encenderla global.
- **Conciliación (FLOW-004)**: «manejo directo de contabilidad». **Choca con Paola**, que en Ecuador
  concilia ella misma. En Colombia lo haría el contador, y ese rol no existe en el producto.

## 4. Defectos vistos, además de los de §1

Leídos en el código, sin reproducir:
- **Seis de diez conjuntos de producción no tienen `currency`** en el documento del conjunto, entre
  ellos Santa María, Nogal y Palmas. Choca con la trampa de `CLAUDE.md`; puede que el script lea otro
  campo. Hay que confirmarlo.
- `createTicket` y `createPackage` fabrican `unit-<slug>` desde la etiqueta cuando falta `unitId`. Es la
  trampa de FIX-002.
- La fecha de un comunicado programado es la de su creación (gemelo de H.50).
- El reglamento cuenta sus firmas de una forma y las enseña de otra.
- `billingResponsiblePersonId` lo lee el servidor y ninguna pantalla lo escribe.
- La ocupación tiene dos vocabularios: «Propietario ocupante / Arrendatario» en el alta y «Propietario
  residente / Inquilino» en la importación.
- La invitación de varios días del residente crea un pase de un solo día; `visitasEsperadasHoy` enseña
  un frecuente solo el primer día; `data-retention.ts` no cubre las fotos de `visitor-notes`.
- La PRD de FEAT-009 (línea 60) sigue diciendo que el consejo solo entra en Documentos: está obsoleta
  desde el 11 sep.

## 5. Qué cambiaría las valoraciones

- **Reproducir D-1, D-2 y D-3** en staging (minutos) cambia el orden entero.
- **Preguntarle a ella tres cosas**:
  - si arma cada mes el informe de PQRS y la tendencia de cartera en Excel (sube L-21 y L-24);
  - si la minuta de vigilancia es diaria y en papel (L-30 pasaría a Ganancia rápida);
  - si su manual de convivencia fija horarios del personal de servicio (L-10 pasaría a Ganancia rápida).
- **Que David diga si ella cuenta como prospecto**, que sube el Ingreso de casi todo.

## 6. Hallazgos para la v0.4 del modelo

Los encontraron los seis agentes; varios, más de uno por su lado.
1. **Cierre** no tiene nota para mejorar algo ya cerrado, que ni abre ni extiende un frente (tres bloques).
2. **Ingreso 2**: no está definido si una administradora que evalúa la demo por escrito es un prospecto.
   Si lo es, todo lo del documento sube a 2 y el criterio deja de distinguir (tres bloques).
3. **Día uno**:
   - no distingue por país, y aquí se contradicen Colombia y Ecuador (la conciliación);
   - mide si falta una capacidad, no la fricción en una que existe;
   - no dice qué es lo mínimo de «controlar la portería».
4. **§6.2 no tiene referencias de solo datos ni de encender una bandera** (menos de 0,6 h), y la puerta XS
   excluye los datos de producción: arreglos de minutos como L-04 y L-27 salen con horas de componentes.
5. **Falta una clase «ya existe y no se ve»**. Hoy solo cabe en XS por tamaño.
6. **Confianza**: falta un nivel para «práctica conocida del sector que nadie dijo»; una ley que no se
   pudo leer quedó en 0,3.
7. **Un defecto que rompe una promesa escrita** carga a la vez el Dolor y la Obligación con una sola
   causa.
8. **Alcance**: no dice cómo contar una tarea que pasa una vez por conjunto (el alta, la carga masiva).

La prueba de dispersión (§9.3) se cumple por poco: de 31 filas puntuadas, cuatro Ganancias rápidas, 26
Rellenos y un Pozo. La concentración en Relleno se explica sobre todo porque casi todo cuesta menos de 4
horas, no porque las notas no distingan.
