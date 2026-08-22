# Inventario de Habitanto — Pasada 1: el mapa

> Levantado el 21 de agosto de 2026 navegando `app.habitanto.com` con una sesión real de
> administrador, en modo **solo lectura**: no se creó, guardó, envió ni borró nada.
>
> **Todo lo que sigue está visto en pantalla.** Donde algo no se pudo ver, lo dice.
>
> **Sin datos personales.** El condominio de trabajo tiene residentes reales; aquí se
> registra estructura y funcionamiento, nunca nombres, cédulas, teléfonos ni saldos
> individuales.

---

## 0 · Qué es Habitanto

Plataforma de administración de condominios y edificios, vendida en LATAM (testimonios de
Ecuador, Uruguay y Bolivia; el formulario web abre con México). Se posiciona para
**administradoras profesionales** que llevan varios condominios, no para un conjunto suelto.

El sitio público organiza el producto en **tres audiencias**: Residentes, Administrador y
Junta Directiva. **No publica precios**: tarifa por número de unidades habitacionales y por
país, cerrada por conversación de ventas.

### La jerarquía real, medida

Tres niveles, no dos:

```
Empresa administradora  →  Condominio  →  Unidad
```

La cuenta con la que se navegó pertenece a una administradora con **16 condominios** en su
cartera, y el administrador salta entre ellos desde un buscador modal («Cambiar de
condominio»). El condominio guarda su propia empresa administradora, su RUC, su **correo
remitente de notificaciones** y un **sitio web personalizado**: hay marca blanca.

---

## 1 · El hallazgo estructural: son dos aplicaciones, no una

Habitanto está **a medio migrar** y las dos mitades conviven en la misma sesión:

| | Interfaz nueva | Interfaz vieja |
|---|---|---|
| **URL** | `/v2/...` | `*.do` |
| **Versión en el pie** | `v1.0.0` | `Versión 4.6.4` |
| **Aspecto** | barra blanca, lateral azul oscuro | barra azul, lateral gris |

Navegar de un módulo a otro **salta entre las dos** sin avisar: Accesos, Ingresos,
Transferencias, Cuentas por Pagar, Egresos, Rubros, Reportes y casi toda Comunicaciones
siguen en la vieja; Dashboard, Unidades, Agenda, Áreas comunales, Guardianía, Directiva,
Gestor de Tareas, Conciliaciones, Facturación y Liquidaciones ya están en la nueva.

**Los dos menús no coinciden.** El menú de Comunicaciones de la interfaz nueva ofrece nueve
entradas; el de la vieja, ocho — falta «Reportes de Envíos».

---

## 2 · El mapa por módulo

Seis menús superiores, más un módulo de **Configuración** que no aparece en el menú y solo
se llega por el engranaje.

### Inicio — 4 pantallas

| Pantalla | Qué es |
|---|---|
| **Dashboard** | Cartera vencida por tramos (30/60/90/120/+120), principales morosos, ingresos y egresos del mes con saldo inicial |
| **Dashboard 2** | Forma de pago por ingresos y por egresos, y saldo contable vs **saldo conciliado** por cuenta |
| **Pagos Notificados** | El residente avisa su pago y adjunta comprobante; la administración registra, aprueba o rechaza |
| **Liquidaciones** | Liquidaciones de tarjeta de crédito (valor bruto, comisión, a pagar) y pagos diferidos sin intereses |

### Administrativo — 11 pantallas

| Pantalla | Qué es |
|---|---|
| **Agenda** | Directorio de contactos: relación (propietario/…), unidades que posee, y una columna **«App descargada»** |
| **Unidades** | Bloque, unidad, morosidad, activo, **porcentaje de alícuota** (seis decimales) y valor por expensa. Crear, actualización masiva, bloques y **unificar** |
| **Lectura de Servicios** | Medición por unidad: servicio, fecha, lectura anterior, lectura actual, consumo |
| **Proveedores/Empleados** | Registro con CI/RUC; alimenta cuentas por pagar y **emisión de cheques**. Carga masiva |
| **Áreas comunales** | Tres pestañas: reservaciones, calendario y catálogo de áreas |
| **Guardianía** | Seis pestañas: resumen, visitas, encomiendas, **rondas**, **bitácora de jornadas** y guardias. Con marcaje de entrada de turno |
| **Accesos** | Cuatro pestañas: bitácora, residentes, vehículos y **dispositivos** — control de acceso físico |
| **Directiva** | Miembros de junta con **posición, período y fecha de inicio** |
| **Gestor de Tareas** | Tareas internas con prioridad, participantes, fecha límite, estado, comentarios y calendario |
| **Archivo Virtual** | Carpetas libres (actas, informes económicos, planos, presupuestos, reglamento). El título en pantalla dice «Virtual File», sin traducir |
| **Mi Condominio** | Ficha, logo, perfiles asignados y desasignados con **permisos por usuario**, total de expensa y mapa |

### Financiero — 13 pantallas

| Pantalla | Qué es |
|---|---|
| **Cuentas por Cobrar** | Genera cargos de cuatro maneras: **cuotas por expensas**, **cuota individual**, **consumo de servicios** y **división de cuotas**. Edición y anulación masivas, envío de aviso de cobro |
| **Ingresos** | Registrar cobro, **crear anticipo**, otro ingreso, **cruzar anticipos**, historial |
| **Ingresos no Identificados** | Depósitos sin dueño, con acción **«Identificar»** para casarlos |
| **Links de Pago T.C.** | Genera enlaces de pago con tarjeta; **la comisión se calcula sola** |
| **Cuentas por Pagar** | Obligación al proveedor con factura, vencimiento y descarga masiva de facturas |
| **Egresos** | Registrar pago, otro egreso, historial |
| **Transferencias de fondos** | Transferencias entre cuentas, **apertura y reposición de caja chica**, comprobantes numerados |
| **Conciliaciones** | Por fecha de corte: **saldo real del estado de cuenta vs saldo final en banco**, con estado CONCILIADO |
| **Cajas o bancos** | Cuentas de tipo Banco, Tarjeta Crédito y **Cruce Cuentas**, con saldo inicial y saldo contable |
| **Rubros** | Plan de cuentas: categorías y rubros numerados para ingresos y egresos, con orden manual, unificación y **re-indexado** |
| **Presupuesto** | Vacío en este condominio |
| **Anulaciones** | Bitácora transversal de anulaciones: tipo, comprobante, fecha de anulado y **razón de anulación** |
| **Facturación** | Comprobantes emitidos con CI/RUC y estado, más un aviso de **«No generados»** |

### Reportes — 1 catálogo, 15 reportes

Agrupados en cuatro bloques y etiquetados por área:

- **Estado general del condominio** — ingresos y egresos, consolidado, a detalle, económico
- **Consulta de carteras** — cartera acumulada, cartera por años, **control histórico a fecha de corte**
- **Estados de cuenta** — de caja o bancos, de unidades, de proveedores, y cartera corriente vs vencida
- **Análisis de datos** — ingresos por años, **flujo de ingresos por unidad (generado vs cobrado)**, comparación gráfica, y **reportes ejecutables por macro de Excel**

### Comunicaciones — 9 pantallas

Redactar comunicación, borradores, programados, enviados, historial de email, asambleas y
reuniones remotas, votaciones, impresiones y reportes de envíos.

El **redactor** destina por unidad, contacto, grupo o bloque; personaliza el saludo solo;
usa plantillas; adjunta archivos; **adjunta el estado de cuenta de cada unidad**;
**programa el envío**; **añade link de pago**; y tiene un botón **«Generar comunicación con
CHATGPT»**.

**Asambleas** son remotas, y el Zoom con tiempo ilimitado, grabación y hasta 100
participantes **se vende aparte**. **Votaciones** y encuestas son el mismo objeto.
**Impresiones** imprime en lote avisos de cobro, comprobantes de pago y de egreso.

### Novedades — 3 pantallas

El equivalente a PQRS, partido en dos orígenes:

- **Resumen** — **promedio de resolución en días**, resueltas, por atender, totales por tipo y estado
- **De Residentes** — lo que levanta el residente
- **Administración** — tres pestañas: **daños**, **emergencias** y **objetos perdidos**

### Configuración — 7 pantallas, fuera del menú

Solo se llega por el engranaje de la barra superior.

| Pantalla | Qué es |
|---|---|
| **Descuentos** | Descuentos aplicables al registrar cobros y cruzar anticipos |
| **Servicios básicos** | Catálogo de servicios medidos que alimenta las lecturas y la generación de cobros |
| **Plantillas** | Excels de carga masiva (unidades, contactos, **bodegas, parqueaderos, vehículos**, cuentas por cobrar y por pagar). **Se envían por correo a soporte**, no se cargan desde la aplicación |
| **Permiso a Reportes** | Casillas que deciden **qué reportes ve el copropietario** en su perfil |
| **Recibera** | Secuencia de recibos de ingreso y egreso, prefijo concatenable y marca de anulado |
| **Facturación** | Add-on: **«no tiene activada la funcionalidad… solicítela a su ejecutivo de cuenta (disponible solo para Ecuador)»** |
| **Parámetros** | Secuencial del siguiente aviso de cobro, **día del mes en que se dispara la notificación automática** (99 la desactiva), modo de agrupación y texto al pie |

---

## 3 · Lo que este recorrido no vio

- **Las cinco listas de Comunicaciones** (borradores, programados, enviados, historial de
  email, reportes de envíos). Son vistas del mismo objeto que el redactor; queda por
  confirmar.
- **Los 15 reportes por dentro.** Están catalogados por su descripción, no abiertos.
- **Todo el lado del residente y la Junta Directiva.** La sesión es de administrador. Hay
  aplicación móvil en Android e iOS y un perfil de copropietario con reportes propios, y no
  se han visto.
- **Qué pasa al guardar.** Deliberado: no se escribió nada en un sistema ajeno.

---

## 4 · Los diez hallazgos que importan para Vivaru

1. **La alícuota es el eje del cobro.** Cada unidad lleva su porcentaje con seis decimales y
   de ahí sale la expensa. Es el concepto que ordena todo el módulo financiero.
2. **Cobrar y cobrar el dinero son dos cosas distintas.** Cuentas por Cobrar/Pagar guardan la
   obligación; Ingresos/Egresos guardan el movimiento de caja. Separación limpia.
3. **Hay tesorería de verdad**: anticipos y su cruce, caja chica con apertura y reposición,
   cuentas de tipo «cruce», comprobantes numerados y conciliación por fecha de corte.
4. **La conciliación tiene bandeja de entrada**: los depósitos sin dueño caen en «Ingresos no
   Identificados» con un botón para identificarlos.
5. **El cobro se automatiza solo.** Un parámetro fija el día del mes en que salen los avisos,
   y el correo puede llevar el estado de cuenta de cada unidad y un link de pago.
6. **Monetizan el pago, no solo la suscripción.** Las liquidaciones de tarjeta muestran valor
   bruto, comisión y neto a pagar al condominio.
7. **La facturación electrónica es add-on y solo de Ecuador**, activada por un ejecutivo de
   cuenta. No es una capacidad del producto base.
8. **La transparencia al residente es una casilla.** Qué reportes financieros ve el
   copropietario se decide por condominio.
9. **La operación diaria tiene su propio módulo**: gestor de tareas con prioridad y fechas
   límite, guardianía con rondas y turnos, y novedades con promedio de resolución.
10. **Cargan datos por correo.** La carga masiva de un condominio nuevo se hace mandando un
    Excel a soporte. Su puesta en marcha no es autoservicio.

### Y tres señales de deuda que conviene no imitar

- **Dos interfaces conviviendo**, con menús que no coinciden.
- **Un botón «Re-indexar»** en Rubros, justificado en pantalla porque «a veces el orden y los
  reportes no funcionan correctamente».
- **El plan de cuentas se ensucia solo**: hay rubros repetidos con el mismo número y códigos
  escritos a mano con puntos de más.

---

## 5 · Qué sigue

- **Pasada 2 — la profundidad.** Abrir formularios y fichas sin guardar, con peso en lo
  contable y financiero: qué campos pide cada cosa, qué estados tiene un cargo, qué sale en
  los reportes.
- **Pasada 3 — el contraste.** Tres columnas contra Vivaru: lo que ellos tienen y nosotros
  no, lo que nosotros tenemos y ellos no, y lo que está en los dos pero funciona distinto.

---

# Pasada 2 — la profundidad del módulo financiero

> Levantado el 21 de agosto de 2026, abriendo formularios y fichas **sin guardar nada**.
> Ningún cargo, cobro, cruce, conciliación ni descuento fue creado o modificado.

## 1 · Las cuatro maneras de generar un cobro

| | Qué hace | Campos propios | Importe |
|---|---|---|---|
| **Cuotas por Expensas** | Cobra a todas las unidades de golpe (aquí, 55) | Tipo (expensa / seguro / extraordinaria), rubro, filtro por tipo de unidad, **descuento pronto pago (%)** | **No se escribe**: sale del valor guardado en cada unidad |
| **Cuota Individual** | Un cargo a una unidad | Unidad **y contacto por separado**, rubro, descuento pronto pago | Se escribe |
| **Consumo de Servicio** | Cobra el consumo medido | Servicio, tipo de rubro, unidad | Sale de la lectura; **solo genera para unidades con lectura registrada** |
| **División de Cuotas** | **Reparte el total de una cuenta por pagar entre las unidades según su alícuota** | Valor total, rubro, **relación** a quien se cobra, tipo de unidad, **¿redondear valores?** | Se escribe el total; el sistema prorratea |

Las dos masivas (**Cuotas por Expensas** y **Consumo de Servicio**) y la **División** pasan por
un paso intermedio: **«Copiar y Revisar» primero, «Generar Cuentas» después**. No generan a
ciegas.

## 2 · El modelo que se deduce

- Una **unidad** guarda: tipo, bloque, número, **valor por expensa**, **valor por seguro**,
  **porcentaje de alícuota**, **área en m²**, si está ocupada y si está arrendada.
- Una **persona** se relaciona con la unidad con uno de cuatro papeles: **Representante,
  Contacto, Inquilino, Propietario**. El **representante** es a quien se le asignan los
  cobros, y es distinto del propietario.
- Crear una unidad **crea también a su primera persona en el mismo formulario**, con
  **«¿Dar permisos y acceso al sistema?» encendido por defecto**.
- Un **cargo** no tiene estado propio: su situación se deduce de *valor vs saldo* y de
  **días vencidos**, ambos calculados. Guarda marcas de sistema de creación y actualización.
- Cada **línea de cobro** de ese cargo lleva dos banderas: **«Activo»** (si no fue anulada) y
  **«¿Fue conciliado?»**. La conciliación vive en el movimiento de dinero, no en una tabla
  aparte.

## 3 · Cómo se aplica un pago

El formulario **Registrar Cobro** es el más denso del sistema:

- Se llega **seleccionando primero los cargos** a pagar; sin selección, valida y no deja pasar.
- Pide forma de pago, fecha, caja o banco, número de documento, valor cobrado y descuento.
- El **número de recibo lo pone la secuencia** de la Recibera, no la persona.
- El pago **se reparte línea a línea** entre los cargos seleccionados (columna «Pago» frente
  a «Saldo»).
- El recibo se emite **a nombre de** una persona con su identificación y dirección, editables
  en ese momento.
- **Si el valor pagado supera el total de los cargos, el sistema genera un anticipo
  automáticamente.**
- **Tras registrar, sale correo y mensaje a la app del residente**, según la configuración de
  notificaciones de esa persona.
- El formulario **no tiene botón de cancelar**: se sale por el menú o por el navegador.

### Las trece formas de pago

Transferencia · Depósito · Cheque · Efectivo · **Cruce de Cuentas** · **NC / Intereses** ·
**Pago Pendiente** · Tarjeta de Crédito · TC DINERS · TC MASTERCARD · TC VISA · **QR** ·
Tarjeta de Débito · **Deuna**

Están desglosadas por marca de tarjeta, e incluyen medios locales (Deuna es la billetera
instantánea ecuatoriana). «NC / Intereses» y «Pago Pendiente» no son medios de pago reales:
son asientos de ajuste disfrazados de forma de pago.

## 4 · Anticipos

Los residentes **pagan meses por adelantado** y es común: la bandeja de pendientes de cruce
tenía más de mil dólares esperando, con detalles del tipo «anticipo alícuota mes de
septiembre». El anticipo se guarda con su número de recibo y su saldo, y se **cruza** contra
el cargo cuando este aparece. Hay historial de cruces realizados.

## 5 · La conciliación bancaria, completa

Registrarla es declarativo: se elige **caja o banco** y **fecha de corte** (obligatoriamente
posterior a la última), y **se escribe el saldo que dice el extracto bancario**.

El detalle resultante es una conciliación de manual, en cuatro bloques:

- **Transacciones Conciliadas**
- **Resumen de Saldos**
- **Depósitos en Tránsito** — dinero registrado que el banco aún no muestra
- **Cheques Girados y No Cobrados** — tres páginas de ellos, alguno de 2022

Y la aritmética cuadra al centavo:

```
SALDO EN LIBROS AL CORTE
  (−) DEPÓSITOS EN TRÁNSITO
  (+) CHEQUES GIRADOS Y NO COBRADOS
  (=) SALDO FINAL EN BANCO   ← igual al saldo declarado del extracto
```

**Habitanto tiene las dos cosas, y son distintas:** «Ingresos no Identificados» es la bandeja
de excepciones del día a día (dinero que llegó sin dueño), y «Conciliaciones» es el cierre
periódico contra el banco.

## 6 · El estado de cuenta que ve la unidad

Es un **libro corrido**: tipo (cuenta por cobrar / pago), rubro, fecha, vencimiento, número
de recibo, detalle, valor con signo, descuento y **saldo acumulado**, con reimpresión del
recibo línea a línea. Tiene vista detallada y un interruptor de **historia completa**, y se
puede exportar, imprimir o **descargar el de todas las unidades a la vez**. Es el documento
que se adjunta a los correos de cobranza.

## 7 · Descuentos y automatismos

**Descuentos:** nombre, tipo **cantidad o porcentaje**, y redondeo. Se aplican al registrar
cobros y al cruzar anticipos. Aparte existe el **descuento por pronto pago (%)** que viaja en
el propio cargo desde que se genera.

**Parámetros del condominio** tiene tres bloques, y define **dos ciclos automáticos
distintos**:

1. **Avisos de cobro** — se disparan el día del mes que se configure (99 lo desactiva), con
   modo de agrupación y un pie de texto en HTML.
2. **Cuentas vencidas** — un recordatorio recurrente **cada N días** (1 = todos los días).
3. **Comunicaciones** — si se copia a todos los contactos de la unidad o solo al titular, y
   la firma del remitente.

## 8 · Lo que Habitanto NO hace

- **No calcula interés por mora.** No hay ningún parámetro de interés en la configuración del
  condominio. El interés existe solo como **rubro para cobrarlo a mano** y como forma de pago
  de ajuste. Toda la cadena de cobranza está automatizada menos el recargo.
- **No carga datos masivos desde la aplicación**: la plantilla de Excel se manda por correo a
  soporte.
- **No tiene salida del formulario de cobro** sin usar el menú o el navegador.

## 9 · Lo que esta pasada no vio

- El detalle de creación de una **cuenta por pagar** y del **cheque** que la paga.
- Los otros **catorce reportes** por dentro (se abrió el estado de cuenta de unidades).
- El **presupuesto**, vacío en este condominio.
- Todo el **lado del residente y de la Junta Directiva**, incluida la app móvil.

---

# Pasada 2b — el lado del residente

> Recorrido el 21 de agosto de 2026 con una sesión de residente, en **solo lectura**: no se
> notificó ningún pago, no se reservó nada, no se reportó ninguna novedad.
>
> El condominio del residente **no es el mismo** que el de la sesión de administrador, así que
> los contrastes entre ambos se marcan cuando aplican.

## 1 · El residente vive entero en la aplicación vieja

Todas sus pantallas son `.do` y el pie dice **«Versión 4.6.4»**. **La migración a la interfaz
nueva no ha tocado el lado del residente.** Toda la inversión visible en `/v2/` está en la
administración.

## 2 · El mapa del residente

| Menú | Pantallas |
|---|---|
| **Inicio** (lateral) | Dashboard · Unidad · Avisos de Cobro · Cuentas Generadas · **Notificar un pago** · Archivo Virtual |
| **Estado de Cuenta** | Mi Unidad · Historial de Pagos · **Historial Pagos TC** |
| **Reportes** | Catálogo filtrado por permiso |
| **Áreas comunales** | Nueva reservación · Mis Reservaciones · Mi Calendario · Áreas comunales |
| **Novedades** | Reportar novedad · Mis novedades |
| **Mi Condominio** | Detalles · **Directiva** · Visitas |
| **Campana** | Notificaciones |

El **Dashboard** trae selector de unidad arriba a la derecha —**un residente puede tener
varias**—, quién es el representante, **si está en mora**, una fecha de corte ajustable y
cuatro cifras: valor de expensa, total de aportes, valor pendiente y **anticipos**. Debajo,
un banner que vende el pago con tarjeta, y la lista de pagos pendientes.

## 3 · La unidad del residente abre siete pestañas

Y algunas no se veían desde administración:

| Pestaña | Qué es |
|---|---|
| **Unidad** | Ficha completa, **editable por el residente** |
| **Contactos** | Personas relacionadas |
| **Habitantes** | Quién vive ahí |
| **Vehículos** | Los vehículos de la unidad |
| **Componentes** | **Bodegas y Terrazas** — «para ayuda en generación de certificados de expensas» |
| **Personal contratado** | Empleados domésticos de la unidad, «para mantener la seguridad global del Condominio» |
| **Servicios** | Servicios asociados |

**El residente ve su propio porcentaje de alícuota y su valor de expensa, y puede editar los
datos de su unidad.** La transparencia sobre cómo se calcula lo que paga es el
comportamiento por defecto, no una opción.

## 4 · Notificar un pago

Seis campos, **todos obligatorios**: caja o banco, fecha, valor, documento, descripción y
**el comprobante adjunto**. La pantalla promete el retorno: *«Te notificaremos cuando el
administrador registre el pago y actualice el estado.»*

Que el residente **elija a qué cuenta bancaria pagó** es lo que después permite conciliar.

## 5 · Los reportes que ve son los que el administrador marcó

El catálogo del residente tiene la misma estructura que el del administrador pero **filtrado
por las casillas de «Permiso a Reportes»**: en esta cuenta se veían dos reportes y dos grupos
enteros vacíos. La configuración y el resultado coinciden en pantalla.

Uno de los que puede habilitarse es el **estado de cuenta de proveedores** — el residente
llega a ver a quién le paga el condominio y cuánto.

## 6 · Las notificaciones se archivan dentro del producto

La campana abre una bandeja con **remitente, destinatarios, copia, copia oculta, adjunto,
asunto y el cuerpo HTML renderizado**, con filtro de no leídos y marcado en lote.

Se ven los dos ciclos automáticos funcionando de verdad: *«Aviso de cobro para [mes]»* y
*«Muchas gracias por realizar tu pago»*. El aviso de pago llega **con la marca del edificio,
el detalle de las cuotas cubiertas y copia oculta a la administración**.

El remitente es **el correo propio del edificio** — en este caso, una cuenta de Gmail. La
marca blanca del remitente es real, pero se apoya en correo gratuito.

## 7 · Tres cosas que llaman la atención

1. **El «Tipo» de una novedad es texto libre.** El formulario de reportar novedad pide foto
   opcional, descripción, **tipo escrito a mano** («Ejem. Daño») y fecha. No hay lista de
   categorías, ni prioridad. Y sobre ese texto libre el administrador construye su gráfico de
   «Total por Tipo».
2. **Visitas es solo historial.** El residente ve quién entró, pero **no puede anunciar una
   visita por adelantado** desde la web.
3. **El historial de tarjeta registra intentos**, no solo pagos: la pantalla se titula
   «Intentos de pago con Tarjeta de crédito».

## 8 · Detalle menor pero revelador

En este condominio el rubro se llama **«1.1 Alícuota Mensual»**; en el de la sesión de
administrador, **«1.1 Expensa Mensual»**. Mismo número, distinto nombre: **el plan de cuentas
es libre por condominio**, y eso hace que ningún reporte consolidado entre condominios pueda
agrupar por nombre de rubro.

## 9 · Lo que sigue sin verse

- La **aplicación móvil** (Android e iOS), que es donde Habitanto dice estar la experiencia.
- El rol de **Junta Directiva**, que el sitio público vende como tercera audiencia.
- El flujo de **reserva** completo: este condominio no tiene áreas reservables configuradas.
- Del lado contable, el detalle de **crear una cuenta por pagar y girar el cheque**.

---

# Pasada 3 — el contraste contra Vivaru

> Escrito el 21 de agosto de 2026. **El lado de Habitanto está visto en pantalla; el lado de
> Vivaru está leído del código**, no de sus documentos — este proyecto ya tuvo papeles que
> afirmaban cosas falsas sobre su propio repositorio.
>
> Ficheros consultados: `src/types/domain.ts`, `src/features/finanzas/*`,
> `src/features/committee-agreements/*`, `functions/src/index.ts`, y el árbol de rutas de
> `src/app`.
>
> **Fuera de este contraste, por decisión de David:** la aplicación móvil de Habitanto y su
> rol de Junta Directiva.

## A · Lo que Habitanto tiene y Vivaru no

Ordenado por lo que más cambiaría el producto, no por tamaño.

### A.1 — La alícuota como porcentaje de copropiedad

**Es la diferencia de fondo, y de ella cuelgan otras tres.**

En Habitanto cada unidad guarda un **porcentaje de alícuota con seis decimales**, más su
valor de expensa y su valor de seguro. En Vivaru, «alícuota» es solo una **categoría de
ingreso del libro** (`LedgerCategory = "alicuota"`, etiquetada «Cuotas de administración»).
No existe el porcentaje por unidad.

La consecuencia está en `BillingCampaign.unitAmount`: **Vivaru cobra un monto plano igual a
todas las unidades**. Habitanto cobra a cada una lo suyo.

### A.2 — Repartir un gasto entre las unidades

De A.1 se deriva **División de Cuotas**: coger el total de una cuenta por pagar y prorratearlo
entre las unidades según su alícuota, eligiendo si se cobra al propietario o al arrendatario,
con opción de redondeo. Vivaru no tiene forma de hacer esto.

### A.3 — Plan de cuentas configurable

Habitanto tiene **rubros** en árbol, numerados, ordenables y creados por el administrador de
cada condominio. Vivaru tiene **enumeraciones fijas en el código**: `BillingConcept` (7
valores), `ExpenseCategory` (8) y `LedgerCategory`. Añadir un concepto en Vivaru es un
despliegue; en Habitanto es un formulario.

**Con su matiz:** el plan de cuentas libre de Habitanto se ensucia. Vimos rubros repetidos
con el mismo número y códigos escritos a mano. Y como cada condominio nombra los suyos, **su
propio consolidado entre condominios no puede agrupar por nombre de rubro**.

### A.4 — Registro de proveedores

Habitanto tiene un **registro de Proveedores/Empleados** con CI/RUC, razón social y estado,
que alimenta las cuentas por pagar y la emisión de cheques, con carga masiva.

En Vivaru **no existe la colección**: `Expense.vendorName` y `Expense.vendorTaxId` se escriben
a mano en cada egreso. El mismo proveedor se teclea otra vez cada mes, y no hay estado de
cuenta por proveedor.

### A.5 — Anticipos

Habitanto guarda el pago adelantado como **anticipo con saldo propio** y lo **cruza** contra
el cargo cuando aparece, con historial de cruces. Además, **si el pago supera lo adeudado, el
anticipo se genera solo**.

En Vivaru la palabra aparece una sola vez en todo el repositorio. No hay figura de anticipo.

### A.6 — Medición de consumos

Catálogo de servicios básicos → lectura de medidor por unidad (anterior, actual, consumo) →
generación del cobro solo para las unidades con lectura. Vivaru no tiene medición.

### A.7 — Tesorería

Caja chica con **apertura y reposición**, transferencias entre cuentas con comprobante
numerado, y cuentas de tipo «cruce de cuentas». Vivaru tiene `BankAccount` con saldo inicial,
pero no movimientos entre cuentas ni caja chica.

### A.8 — El cierre de conciliación

Ver §C.3: los dos concilian, pero Vivaru no tiene el **cierre de período** con depósitos en
tránsito, cheques girados y no cobrados, y el resumen de saldos que cuadra contra el extracto.

### A.9 — Bandeja de dinero sin dueño

**Ingresos no Identificados**: los depósitos que llegaron al banco sin poder atribuirse, con
un botón «Identificar». Vivaru no tiene ese buzón.

### A.10 — Otros, en corto

| | Habitanto | Vivaru |
|---|---|---|
| **Presupuesto** | Módulo propio | No existe |
| **Bitácora de anulaciones** | Transversal, con **motivo obligatorio** y fecha | Solo el `anuladoMotivo` del recibo |
| **Descuentos** | Configurables (cantidad o %) + pronto pago en el cargo | No existen |
| **Empresa administradora** | Capa sobre N condominios, con cambio de condominio | No existe: un tenant = un conjunto |
| **Junta directiva** | Registro con cargo, período y estado | Rol `committee`, sin registro de miembros |
| **Componentes de la unidad** | Bodegas y terrazas, para certificados de expensas | No existen |
| **Personal contratado** | Empleados domésticos por unidad, para portería | No existe |
| **Vehículos** | Por unidad, y control de acceso con dispositivos | No existe |
| **Guardianía** | Rondas y bitácora de jornadas del guarda | No existe |
| **Liquidaciones de tarjeta** | Bruto, comisión y neto al condominio | No existe |
| **Gestor de tareas interno** | Con prioridad, participantes y fecha límite | No existe |

## B · Lo que Vivaru tiene y Habitanto no

### B.1 — PQRS de verdad

`Ticket` lleva **categoría y tipo controlados** (`pqrs | maintenance | billing`;
`petition | complaint | claim | suggestion | other`), **radicado**, **cinco estados**,
**prioridad** e **hilo de respuestas** con autor y fecha.

En Habitanto el residente escribe **el tipo a mano** —el marcador del campo dice «Ejem.
Daño»— y no hay prioridad. Y sobre ese texto libre el administrador construye su gráfico de
«Total por Tipo».

**Es la ventaja más clara de Vivaru, y es justo donde más se ha trabajado.**

### B.2 — El visitante

`VisitorPass` lleva **QR**, tres estados, **autorización puntual o de larga duración con
ventana de vigencia**, marca de entrada y de salida, notas del guarda con foto, y un aviso
automático diario de visitantes sin salida registrada.

En Habitanto el residente **solo ve el historial**: no puede anunciar una visita desde la web.

### B.3 — Acuerdos de comité con firma

Acuerdos por sesión, **firma write-once por unidad**, y un resumen de cumplimiento que dice
cuántas firmas faltan. Habitanto tiene asambleas y votaciones, pero no el acuerdo firmado con
seguimiento unidad por unidad.

### B.4 — Finanzas que miran hacia adelante

Habitanto reporta el pasado —quince reportes, todos descriptivos—. Vivaru tiene tres piezas
que ninguno de ellos insinúa:

- **Proyección de flujo de caja**: cruza el cobro esperado de cartera con las cuentas por
  pagar por vencer, en varios horizontes.
- **Cobertura del fondo**: cuántos meses de gasto cubre el saldo al ritmo reciente.
- **Anomalía de monto en egresos**: avisa cuando un importe se aparta 10× de la mediana
  histórica de su categoría — el cero de más al teclear.

### B.5 — El reporte de consejo, en una pieza

Un solo informe que junta cartera, financiero, paquetes, PQRS, visitantes, reservas y
acuerdos. Habitanto obliga a abrir quince reportes distintos.

### B.6 — Maquinaria comercial

`Tenant` lleva **plan, país, moneda, marca propia (logo y colores), fechas de trial,
atribución del lead que lo originó y sello de conversión**, con un proceso diario que gobierna
el ciclo de prueba.

Habitanto **no publica precios**, tarifa por unidades y país en conversación de ventas, activa
la facturación «solicitándola a su ejecutivo de cuenta» y **carga los datos de un condominio
nuevo mandando un Excel por correo a soporte**.

**Vivaru está construido para venderse solo; Habitanto está construido para que lo vendan
personas.** Es la diferencia estratégica más grande de las dos plataformas.

### B.7 — Higiene que no se ve

Anonimización automática de comprobantes vencidos por política de retención, archivo
financiero mensual, superadmin con banderas, métricas, auditoría y errores. Nada de esto
asoma en Habitanto.

## C · Lo que está en los dos, pero funciona distinto

### C.1 — El recibo

| | Habitanto | Vivaru |
|---|---|---|
| Numeración | **Secuencia** con prefijo configurable, y marca «¿sin anular?» | **Código derivado del id** (`REC-A7F3K2`), sin correlativo |
| Por qué | Sigue siendo documento con serie | **Dejó de ser fiscal el 20 ago 2026**; el contador solo serializaba pagos |
| Anulación | Registro en bitácora con motivo | `anulado` + motivo, al revertir el pago dentro de la transacción |

No es un hueco de Vivaru: es una decisión tomada.

### C.2 — El residente avisa que pagó

**Los dos lo tienen, y casi igual.** Habitanto: «Notificar un pago» con banco, fecha, valor,
documento, descripción y **comprobante obligatorio**. Vivaru: `PaymentReceipt` con archivo,
monto declarado, ciclo *pending → approved | rejected* y **motivo de rechazo**.

Diferencia real: en Habitanto **el residente elige a qué cuenta bancaria pagó**, lo que después
ayuda a conciliar. En Vivaru esa pista no se pide.

### C.3 — La conciliación

**Resuelven mitades distintas del mismo problema.**

- **Vivaru** importa el extracto en líneas (`BankStatementLine`, con lote de importación) y
  **casa línea contra asiento**, con marca de conciliado por línea.
- **Habitanto** no importa nada: **declara** el saldo del extracto a una fecha de corte y
  construye el **puente** (libros − depósitos en tránsito + cheques no cobrados = banco).

Vivaru tiene el casado y no el cierre. Habitanto tiene el cierre y no el casado — pero
compensa con la bandeja de no identificados.

### C.4 — Los ciclos automáticos

**Los dos automatizan la cobranza**, con parámetros distintos:

- Habitanto: día del mes para el aviso de cobro (99 lo apaga) + recordatorio de vencidas
  **cada N días**, configurables por condominio desde la interfaz.
- Vivaru: siete procesos diarios en el código —recordatorios, publicación de cargos
  programados, marcado de vencidos, archivo mensual, anonimización, visitantes sin salida y
  ciclo de trial—, con horarios fijos.

Habitanto deja el calendario en manos del administrador; Vivaru lo tiene en el despliegue.

### C.5 — El interés de mora

**Ninguno de los dos lo calcula solo.** En Habitanto es un rubro que se cobra a mano; en
Vivaru es `BillingConcept = "interes_mora"`, también manual. Toda la cadena de cobranza está
automatizada en ambos **menos el recargo**, que es la parte que aprieta.

### C.6 — Comunicaciones

Habitanto tiene plantillas, programación de envío, **adjuntar el estado de cuenta de cada
unidad**, **añadir link de pago** y un botón de **redactar con ChatGPT**. Vivaru tiene
plantillas de notificación editables por conjunto y comunicados, pero no el adjunto
personalizado ni el link de pago en el mismo envío.

## D · Los diez candidatos a alcance, ordenados

Si hubiera que elegir, este es el orden que defiendo:

1. **Alícuota por unidad** — desbloquea 2 y acerca el producto a la propiedad horizontal real.
2. **División de un gasto entre unidades** por alícuota.
3. **Anticipos y su cruce**, incluido el anticipo automático por sobrepago.
4. **Registro de proveedores** con estado de cuenta.
5. **Cierre de conciliación** (depósitos en tránsito, cheques no cobrados, resumen de saldos).
6. **Bandeja de ingresos no identificados.**
7. **Plan de cuentas configurable** — pero **con códigos gobernados**, no libres como los suyos.
8. **Descuento por pronto pago** en el cargo.
9. **Caja chica** con apertura y reposición.
10. **Interés de mora calculado**, que **ninguno de los dos tiene** y que es donde hay ventaja
    que ganar, no que copiar.

## E · Lo que NO deberíamos copiar

- **Dos interfaces conviviendo.** Habitanto arrastra `/v2/` y `.do` en la misma sesión, con
  menús que no coinciden, y **el residente entero se quedó en la vieja**.
- **Un botón «Re-indexar»** justificado en pantalla porque «a veces el orden y los reportes no
  funcionan correctamente».
- **Códigos de rubro escritos a mano**, que ya produjeron duplicados y rompen el consolidado.
- **Tipo de novedad en texto libre.**
- **La carga inicial por correo a soporte.**
- **La facturación electrónica**, que está fuera del alcance de Vivaru por decisión del 20 de
  agosto. Habitanto la vende como add-on **solo para Ecuador**: no la trata como capacidad del
  producto base.

---

# Pasada 4 — assessment completo: lo que faltaba del residente

> 21 de agosto de 2026, en solo lectura. Cierra los huecos que las pasadas 1 y 2b dejaron
> abiertos en el lado del residente.

## 1 · Las siete pestañas de la unidad, completas

| Pestaña | Qué guarda | Para qué dice servir |
|---|---|---|
| **Unidad** | Tipo, bloque, número, valor de expensa, valor de seguro, **alícuota**, área, ocupada, arrendada, teléfono, ubicación, descripción, **plano** | Ficha, editable por el residente |
| **Contactos** | Identificación, nombre, **relación**, celular, correo, **¿representante?** | «Contactos que recibirán comunicaciones e información del Condominio» |
| **Habitantes** | Quién reside en la unidad | «Por información precisa hacia la Guardianía» |
| **Vehículos** | Dos bloques: **Vehículos** y **Parqueaderos** | «Para ayuda de la Administración y Guardianía… **si alquila algún Parqueadero de su propiedad regístrelo aquí**» |
| **Componentes** | **Bodegas** y **Terrazas** | «Ayuda en generación de certificados de expensas» |
| **Personal contratado** | Empleados domésticos de la unidad | «Para mantener la seguridad global del Condominio» |
| **Servicios** | Lecturas mensuales de servicios básicos de la unidad | Consulta, con exportación a Excel |

**Los parqueaderos viven aquí**, no en el catálogo de unidades — y el producto contempla que
un propietario **alquile su parqueadero a otro**.

## 2 · Dinero, desde el lado del residente

- **Avisos de Cobro** — historial de los avisos recibidos, **con reimpresión de cada uno**.
- **Cuentas Generadas** — sus cargos con valor y saldo, y el total.
- **Historial de Pagos** — filtrable por rubro y fechas: número de recibo, fecha, rubro,
  **forma de pago**, número de documento, **qué meses cubrió el pago**, valor y reimpresión.
  Confirma que **pagar varios meses de una vez es lo normal**.
- **Historial Pagos TC** — titulado «Intentos de pago con Tarjeta de crédito»: registra los
  intentos, no solo los éxitos.
- **Estado de Cuenta → Mi Unidad** — el libro corrido, con pagos parciales visibles.

## 3 · El ciclo de la reserva, visto desde el calendario

«Mi Calendario» filtra por tres estados: **Por revisar · Aprobadas · Canceladas**. Ese es el
ciclo de vida de una reservación, aunque este condominio no tenga áreas configuradas.

## 4 · El residente ve el contrato comercial

«Mi Condominio → Detalles» muestra, además de RUC, dirección y administrador:

- **Número de unidades contratado** — la unidad de tarifación
- **Fecha fin de licencia**
- **Fecha expiración SMS** — el SMS se licencia **aparte** del resto
- **Compañía de seguridad**

Es decir: **el residente puede ver cuándo vence la licencia del condominio**.

«Mi Condominio → Directiva» lista cargo, período, nombre y correo de cada miembro, con el
contacto del administrador arriba. En este condominio el período mostrado es **2019-2020**:
el registro existe pero nadie lo mantiene.

## 5 · Ayuda: un sitio de guías segmentado por rol

El icono de interrogación abre **`guide.habitanto.com`**, una base de conocimiento propia con
índice por rol. El del residente cubre inicio de sesión, panel, unidad, contactos y
parqueaderos, estados de cuenta, pagos y reportes, mi condominio, directiva y visitas,
solicitudes, quejas y sugerencias, áreas comunales, reservaciones, archivo virtual y app
móvil.

El índice del administrador añade **«Comunicaciones — Envío de emails y SMS»**, lo que
confirma el SMS como canal, y una sección **«Actualizaciones»** que hace de changelog público.
**Esa sección tiene una sola entrada.**

Además, la aplicación lleva un **chat de soporte embebido** (widget abajo a la izquierda).

## 6 · Estado del recorrido del residente

**Completo**, salvo lo que David dejó fuera del alcance (aplicación móvil y rol de Junta
Directiva) y el flujo de reserva de punta a punta, que no se puede ver porque este condominio
no tiene áreas reservables configuradas.

---

# Pasada 5 — assessment completo del lado administrativo

> 21 de agosto de 2026, en solo lectura. Cubre todo lo que las pasadas 1 y 2 dejaron a nivel
> de listado: pestañas, formularios de alta y salidas de reporte.

## 1 · Seguridad y accesos

### Guardianía — seis pestañas

| Pestaña | Qué es |
|---|---|
| **Resumen** | Marcaje de entrada de jornada e indicadores del día |
| **Visitas** | Registro con unidad, visitante, identificación, hora de ingreso, **autorizado por** y estado |
| **Encomiendas** | Unidad, destinatario (admite **«sin destinatario»**), remitente, contenido y tipo, fecha de ingreso |
| **Rondas** | **Sistema Externo de Rondas** |
| **Bitácora de jornadas** | Entradas y salidas de turno, con **categoría** y descripción |
| **Guardias** | Registro de usuarios guarda, con estado activo |

**Las rondas no son suyas.** La pantalla se titula «Sistema Externo de Rondas» y solo muestra
métricas traídas de fuera: rondas completadas, tiempo promedio, **incidentes** y **kilómetros
recorridos**, con tabla de inicio, fin, guardia y recorrido. Es una integración, no una
capacidad propia.

**El guarda puede ser una empresa**, no una persona: en este condominio el usuario guarda es
una compañía de seguridad.

### Accesos — control físico, en la aplicación vieja

Cuatro pestañas: **Bitácora**, **Residentes**, **Vehículos** y **Dispositivos**.

Tanto residentes como vehículos llevan una columna **Dispositivos** y un botón **Permisos**
por fila, más **Permisos masivos**. Es decir: se otorgan permisos de acceso físico por
persona y por vehículo, y se asocian dispositivos (tarjetas, mandos, lectoras). En este
condominio no hay ningún dispositivo registrado.

## 2 · Áreas comunales: una máquina de políticas de reserva

El catálogo lista por área: **valor por reserva**, aforo, **¿permitir reservas a morosos?**,
**¿reserva con aprobado automático?** y si está en servicio.

El formulario de alta va mucho más lejos:

**Datos generales** — tipo de área, nombre, foto, **reglas y términos en PDF**, **valor por
reserva**, **valor de la garantía por reserva**, **¿permitir reservas compartidas con varios
residentes en el mismo horario?**, aforo por reserva, ¿aprobado automático?

**Horarios** — modo de establecerlos, hora de inicio y fin, **frecuencia** (duración del
turno) y un generador «Crear horarios».

**Opciones avanzadas** — **cantidad de reservas permitidas por unidad** y su **frecuencia**,
**horas de anticipación para reservar**, **total de horarios consecutivos permitidos en una
reserva**, **¿permitir reservas a morosos?** y **¿permitir reservas de personas que no
residen en el condominio?**

**Es lo más sofisticado del producto.** Y la compuerta de morosos ata el acceso a la amenidad
al estado de cartera: una palanca de cobranza que no es financiera.

Ciclo de la reserva, visto desde el calendario del residente: **por revisar → aprobada →
cancelada**.

## 3 · Novedades: dos vocabularios distintos

| | Quién lo usa | Tipo |
|---|---|---|
| **Reportar novedad** | Residente | **Texto libre** («Ejem. Daño») |
| **Registrar Novedad** | Administración | **Lista cerrada**: Daños · Urgencias · Encomiendas · Objetos perdidos · Residentes |

Cada tipo del lado administrativo trae **sus propios campos** (objetos perdidos pide «lugar
donde se encontró»; daños pide el lugar del daño).

**Lo que reporta el residente y lo que registra la administración no comparten vocabulario**,
y el gráfico de «Total por Tipo» del resumen se construye sobre esa mezcla.

## 4 · Gestor de tareas

Alta con: tarea, **participantes** (varios), **prioridad** (por defecto Media), fecha de
inicio, **fecha límite**, **¿crear alerta de recordatorio?**, adjunto (5 MB) y descripción.
La lista tiene pestañas de **tareas, comentarios y calendario**, con estados y exportación.

## 5 · Comunicaciones: el envío y su medición

**Enviados** registra por comunicación: asunto, fecha, **número de destinatarios**, **número
de documentos adjuntos**, y tres acciones — ver, **ver destinatarios** y **reenviar**.

**Historial Email** baja al detalle: **una fila por destinatario**, con **hora de creación** y
**hora de envío** separadas. En el envío observado, 98 correos salieron en unos dos minutos.
Esta pantalla **no muestra entrega**.

**Reporte de emails enviados** —al que **solo se llega desde el menú nuevo**— sí la muestra:
**Total evaluados · Entregados · Rebotes · Quejas**, con **lista de rebotes** y la indicación
de corregir el correo en la Agenda. La capacidad existe; el menú viejo la esconde.

**Qué envían de verdad:** el tráfico real de este condominio es el **informe económico
mensual** a ~98 destinatarios, más actas de asamblea y convocatorias.

**Impresiones** imprime en lote en tres pestañas: avisos de cobro, comprobantes de pago y
comprobantes de egreso.

## 6 · Lo contable que faltaba

### Cuenta por pagar

Proveedor o empleado (del registro), rubro, fecha de emisión, **fecha de vencimiento**,
número de factura, **adjuntar Factura o RIDE**, total y detalle.

### Pago de un egreso

Forma de pago, fecha, total a pagar, **número de egreso** (de la secuencia), caja o banco,
**saldo de la caja o banco a la vista**, valor pagado, y reparto línea a línea.

**Ocho formas de pago de egreso** (frente a trece en el cobro): Cheque · Transferencia ·
Efectivo · **Débito** · Depósito · **Cruce de Cuentas** · **ND / IVA / Intereses** · Tarjeta
de Crédito.

### Caja chica

*«La caja chica tiene el fin de cubrir aquellos gastos menores, urgentes e imprevisibles.»*
La apertura pide forma de pago, caja o banco de origen (con su saldo), **caja chica destino**
(con su saldo y su **límite**), valor, fecha, **«páguese a la orden de»** y detalle. Existe
además un **listado de reposiciones**.

### Transferencia entre cuentas

Origen (con saldo), destino, valor, fecha, número de documento y detalle.

### Presupuesto

**Una simulación anual**: año, descripción y **escenario — Pesimista · Ajustado · Ideal**,
más una **lista de rubros a incluir** marcable uno a uno.

### Factura

Fecha de emisión, unidad, contacto, rubro, y **selección de las cuentas por cobrar a
facturar**. Advertencia en pantalla: **«solo puedes facturar a personas con CI o RUC
válido»**.

### Proveedor / empleado

Tipo, **CI/RUC**, razón social, nombre comercial, correo, teléfono, representante,
**institución bancaria, número y tipo de cuenta**, **rubro por defecto** y dirección. El
registro **sabe dónde pagarle**.

## 7 · Reportes: lo que hay dentro

**Flujo de Ingresos por Unidad** resultó ser un arrastre de saldos por unidad y período:
**valor de expensa · saldo inicial · cargos del período · abonado · descuento · anticipo ·
saldo**, con marca de **«a favor»** cuando el saldo es negativo.

**Reportes ejecutables — macros Excel** es el hallazgo incómodo: cuatro reportes —**frecuencia
de proveedores, cartera a detalle, egreso por año y reservas**— **no viven en el producto**.
Son una plantilla de Excel con macros que el administrador descarga y ejecuta en su máquina.
**Actualizada por última vez el 6 de marzo de 2023.**

## 8 · Perfiles y permisos: más simple de lo que parece

El candado de «Perfiles asignados» abre tres campos, no una matriz:

- **Perfil**: Administrador · Asistente · Auditor · **Contífico** · Directivo
- **¿Mod. Administración?** Sí / No
- **¿Recibir alertas?** Sí / No

No hay permisos por módulo ni por acción: **se elige un perfil y dos interruptores**.

«Contífico» es el nombre de un software contable ecuatoriano; que exista como perfil apunta a
una integración con él, aunque **no se pudo confirmar en pantalla**.

Aparte, la unidad tiene bloques (`Gestión de Bloques`: bloque y número de unidades) y las
unidades admiten **actualización masiva** y **unificación**.

## 9 · Soporte y documentación como parte del producto

- **Chat de soporte embebido** en toda la aplicación.
- **`guide.habitanto.com`**: base de conocimiento propia, **con índice separado por rol**.
- Su sección **«Actualizaciones»** (changelog público) **tiene una sola entrada**.

## 10 · Lo que sigue sin verse, dicho sin adornos

Recorrido a nivel de listado pero **no abierto por dentro**:

- Comunicaciones: **borradores** y **programados**; los formularios de **nueva asamblea** y
  **nueva votación**.
- **Doce de los quince reportes** (catalogados por su descripción, abiertos dos).
- Formularios de: **registrar lectura manualmente**, **edición y anulación masiva** de cuentas
  por cobrar, **enviar aviso de cobro**, **nuevo link de pago**, **nueva caja o banco**,
  **registrar e identificar un ingreso no identificado**, **actualización masiva** y
  **unificación** de unidades, **editar condominio**, y el detalle de un contacto en Agenda.
- El interior de una carpeta del **Archivo Virtual** y sus permisos.

Fuera de alcance por decisión de David: **aplicación móvil** y **rol de Junta Directiva**.

---

# Pasada 5b — qué cambia el assessment completo en el contraste

> Correcciones y añadidos a la pasada 3, después de ver la plataforma entera.

## A · Una corrección a lo dicho antes

En la pasada 3 se listó «**Guardianía: rondas y bitácora de jornadas**» como capacidad de
Habitanto. **Es impreciso.** La bitácora de jornadas sí es suya; **las rondas no**: la
pantalla se titula «Sistema Externo de Rondas» y solo muestra métricas de un tercero. Al
comparar, lo que Habitanto tiene es **una integración**, no una funcionalidad.

## B · Lo que Habitanto tiene y Vivaru no — añadidos

Todo esto sale del barrido completo y **no estaba en la lista original**:

### B.1 — Motor de políticas de reserva

Vivaru tiene reservas. Habitanto tiene **reglas sobre las reservas**: garantía además del
valor, aforo, reglas en PDF, aprobación automática por área, reservas compartidas, horarios
generados por frecuencia, **cuota de reservas por unidad y período**, **horas de
anticipación**, **máximo de turnos consecutivos**, y dos compuertas — **morosos** y **no
residentes**.

**La compuerta de morosos es la más barata y la más potente:** ata el acceso a la amenidad al
estado de cartera sin tocar nada financiero.

### B.2 — Escenarios de presupuesto

Presupuesto anual por rubros seleccionados, en **tres escenarios: pesimista, ajustado e
ideal**. Vivaru no tiene presupuesto de ningún tipo.

### B.3 — Medición de entregabilidad del correo

**Entregados, rebotes y quejas**, con lista de rebotes accionable hacia el contacto. Vivaru
envía correo pero **no mide si llegó**.

### B.4 — Control de acceso físico

Permisos de acceso **por persona y por vehículo**, con dispositivos asociados y **permisos
masivos**. Vivaru no tiene capa de acceso físico.

### B.5 — Encomiendas con remitente

La encomienda de Habitanto guarda **remitente** (courier y persona) y **contenido con tipo**,
y admite «sin destinatario». La de Vivaru guarda referencia, descripción y el ciclo
pendiente → entregado. **Ciclo de entrega lo tiene Vivaru; trazabilidad del origen, Habitanto.**

### B.6 — Detalles contables que suman

- **Caja chica con límite** y «páguese a la orden de».
- **Proveedor con datos bancarios** (institución, número y tipo de cuenta) y rubro por defecto.
- **Saldo de la cuenta a la vista** al registrar un pago.
- **Adjuntar la factura o el RIDE** a la cuenta por pagar.

## C · Lo que Vivaru tiene y Habitanto no — reforzado

La ventaja en **PQRS** es mayor de lo que parecía. No es solo que el tipo sea texto libre para
el residente: es que **Habitanto tiene dos vocabularios distintos** —lista cerrada de cinco
tipos para la administración, texto libre para el residente— **y los mezcla en el mismo
gráfico**. Vivaru tiene una sola taxonomía controlada para ambos lados, con radicado,
prioridad, cinco estados e hilo de respuestas.

## D · Lo que NO deberíamos copiar — añadidos

- **Cuatro reportes viven en una macro de Excel** que el administrador descarga y ejecuta en
  su máquina, **sin actualizar desde marzo de 2023**.
- **El modelo de permisos es un perfil y dos interruptores**, sin permisos por módulo ni por
  acción — a pesar de tener cinco perfiles distintos.
- **Una capacidad real escondida por el menú viejo**: la medición de entregabilidad solo se
  alcanza desde la interfaz nueva.
- **El changelog público tiene una sola entrada.**

## E · La lista de candidatos, revisada

Sustituye a la de la pasada 3.

| # | Candidato | Por qué aquí |
|---|---|---|
| 1 | **Alícuota por unidad** | Desbloquea el 2 y acerca el producto a la propiedad horizontal real |
| 2 | **Repartir un gasto entre unidades** por alícuota | El prorrateo es el trabajo diario del administrador |
| 3 | **Compuerta de morosos en reservas** | **La más barata de todas**: cobranza sin tocar finanzas |
| 4 | **Anticipos y su cruce**, con anticipo automático por sobrepago | El pago adelantado es normal en el mercado |
| 5 | **Registro de proveedores** con datos bancarios y estado de cuenta | Hoy se reteclea el proveedor en cada egreso |
| 6 | **Cierre de conciliación** | Tenemos el casado, nos falta el cierre |
| 7 | **Bandeja de ingresos no identificados** | La excepción diaria del dinero sin dueño |
| 8 | **Medir entregabilidad del correo** | Enviamos sin saber si llega |
| 9 | **Plan de cuentas configurable, con códigos gobernados** | Añadir un concepto no debería ser un despliegue |
| 10 | **Interés de mora calculado** | **Ninguno de los dos lo tiene**: ventaja que ganar, no que copiar |

Quedan fuera del top 10, pero anotados: presupuesto con escenarios, caja chica, descuento por
pronto pago, medición de consumos y control de acceso físico.
