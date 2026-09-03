# Candidatos a PRD para Vivaru, salidos del inventario de Habitanto

> Escrito el 21 de agosto de 2026. Fuente: `docs/inventario-habitanto.md`.
>
> ⚠️ **ESTA LISTA NO VIO LA SESIÓN CON LA ADMINISTRADORA.** Su fuente es el inventario, y el
> inventario se levantó **navegando la aplicación**. Lo que la administradora de Habitanto DIJO
> el 19 de agosto —su cuello de botella, sus obligaciones legales y sus rodeos manuales— no entró
> por esta cadena. **Diez huecos verificados** están en
> [`../sesion-administradora-habitanto.md`](../sesion-administradora-habitanto.md), y hay que
> leerlo junto con esta lista.
>
> **Cada hueco está verificado en los dos lados.** Lo de Habitanto está visto en pantalla; lo
> de Vivaru está **leído del código** (`src/types/domain.ts`, `src/features/**`,
> `functions/src/index.ts`), no de sus documentos.
>
> **Fuera de alcance por decisión de David:** aplicación móvil y rol de Junta Directiva de
> Habitanto (21 ago). **Fuera del producto por decisión del 20 de agosto:** facturación
> electrónica y obligaciones fiscales.

## Cómo leer esta lista

**Estado en Vivaru**

| | |
|---|---|
| **Nuevo** | No existe nada de esto |
| **Parcial** | Existe la base pero le falta la capacidad descrita |
| **Distinto** | Existe resuelto de otra forma; la pregunta es si conviene cambiarla |

**Perfil** — a quién sirve, en los roles reales de Vivaru: **Administración** (`tenant_admin`),
**Residente** (`resident`), **Portería** (`security_guard`), **Consejo** (`committee`),
**Superadmin** (`superadmin`).

**Prioridad**

- **P0** — desbloquea otras cosas o corrige una debilidad estructural
- **P1** — valor alto y directo
- **P2** — valor real, sin urgencia
- **P3** — anotado para no perderlo

---

## A · Modelo de la unidad y las personas

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| A1 | **Alícuota por unidad** | Porcentaje de copropiedad por unidad, con decimales suficientes. Hoy «alicuota» en Vivaru es solo una categoría del libro | Administración | **Nuevo** | **P0** |
| A2 | **Valor de expensa y de seguro por unidad** | Importes fijos guardados en la unidad, que alimentan la generación masiva | Administración | **Nuevo** | **P0** |
| A3 | **Relación tipada persona↔unidad** | Representante · Propietario · Inquilino · Contacto, donde el **representante** es a quien se cobra | Administración · Residente | **Parcial** | **P0** |
| A4 | **Área en m² y plano de la unidad** | Metraje (base alternativa de prorrateo) y plano adjunto | Administración · Residente | Nuevo | P2 |
| A5 | **Banderas ocupada / arrendada** | Estado de ocupación, que gobierna a quién se cobra y quién puede reservar | Administración | Nuevo | P2 |
| A6 | **Bloques / torres como entidad** | Agrupación con número de unidades, para filtrar y destinar comunicaciones | Administración | **Parcial** | P2 |
| A7 | **Componentes de la unidad** | Bodegas y terrazas asociadas, base del certificado de expensas | Administración · Residente | Nuevo | P2 |
| A8 | **Parqueaderos** | Como entidad propia, incluido **el parqueadero alquilado a otro propietario** | Administración · Residente · Portería | Nuevo | P1 |
| A9 | **Vehículos por unidad** | Placa, marca, color; base del control de acceso vehicular | Residente · Portería | Nuevo | P1 |
| A10 | **Habitantes de la unidad** | Quién reside de hecho, distinto de quién es contacto | Residente · Portería | Nuevo | P2 |
| A11 | **Personal contratado por unidad** | Empleados domésticos registrados por el residente, para portería | Residente · Portería | Nuevo | P2 |
| A12 | **Unificación de unidades** | Fusionar dos unidades conservando su historia | Administración | Nuevo | P3 |
| A13 | **Actualización masiva de unidades** | Cambiar expensa/alícuota a muchas unidades de una vez | Administración | Nuevo | P1 |
| A14 | **Indicador de adopción por persona** | Si el residente ha entrado / descargado la app; hoy invisible para el administrador | Administración · Superadmin | Nuevo | P2 |

---

## B · Cartera y generación de cobro

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| B1 | **Cobro por alícuota** | Generar la cuota de cada unidad según su porcentaje, no un monto plano igual para todas (`BillingCampaign.unitAmount`) | Administración | **Nuevo** | **P0** |
| B2 | **Prorrateo de un gasto entre unidades** | Tomar el total de una cuenta por pagar y repartirlo por alícuota, eligiendo si se cobra a propietario o inquilino | Administración | **Nuevo** | **P0** |
| B3 | **Descuento por pronto pago** | Porcentaje que viaja en el cargo desde que se genera | Administración · Residente | Nuevo | **P1** |
| B4 | **Catálogo de descuentos** | Descuentos con nombre, de cantidad o porcentaje, aplicables al cobrar | Administración | Nuevo | P2 |
| B5 | **Interés de mora calculado** | Recargo automático por días vencidos. **Ni Vivaru ni Habitanto lo tienen** | Administración · Residente | **Nuevo** | **P1** |
| B6 | **Revisión previa a la generación masiva** | Paso «revisar antes de generar» cuando un botón crea decenas de cargos | Administración | Nuevo | **P1** |
| B7 | **Edición y anulación masiva de cargos** | Corregir o anular un lote sin ir uno por uno | Administración | Nuevo | P1 |
| B8 | **División de una cuota en partes** | Convertir un cargo en un plan de pagos | Administración · Residente | Nuevo | P2 |
| B9 | **Cargo con responsable explícito** | El cargo apunta a unidad **y** a la persona responsable | Administración | Parcial | P1 |
| B10 | **Certificado de paz y salvo / de expensas** | Documento emitible de que la unidad está al día. En Vivaru «certificado» solo aparece en textos legales | Administración · Residente | **Nuevo** | **P1** |

---

## C · Recaudo, anticipos y tesorería

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| C1 | **Anticipos** | El pago adelantado se guarda como saldo a favor con su propio comprobante | Administración · Residente | **Nuevo** | **P0** |
| C2 | **Cruce de anticipos** | Aplicar el anticipo al cargo cuando aparece, con historial de cruces | Administración | **Nuevo** | **P0** |
| C3 | **Anticipo automático por sobrepago** | Si pagan de más, el excedente se convierte en anticipo solo | Administración | **Nuevo** | **P1** |
| C4 | **Aplicación de un pago a varios cargos** | Repartir un pago línea a línea entre los cargos seleccionados | Administración | Parcial | **P1** |
| C5 | **El residente indica a qué cuenta pagó** | Al notificar el pago, elegir la cuenta bancaria destino: es la pista que después concilia | Residente | Nuevo | **P1** |
| C6 | **Saldo de la cuenta a la vista al registrar** | Ver el saldo del banco/caja en el propio formulario de pago | Administración | Nuevo | P2 |
| C7 | **Caja chica** | Apertura, reposición y **límite**, con «páguese a la orden de» | Administración | Nuevo | P2 |
| C8 | **Transferencias entre cuentas propias** | Movimiento entre bancos/cajas con comprobante numerado | Administración | Nuevo | P2 |
| C9 | **Cuenta de tipo «cruce»** | Cuenta puente para compensaciones que no tocan banco | Administración | Nuevo | P3 |
| C10 | **Medios de pago locales** | QR y billeteras instantáneas; marcas de tarjeta desglosadas | Administración · Residente | Parcial | P2 |
| C11 | **Registro de intentos de pago con tarjeta** | Guardar los intentos, no solo los éxitos, para diagnosticar fricción | Administración · Residente | Nuevo | P2 |
| C12 | **Liquidación de la pasarela** | Bruto, comisión y neto al conjunto, por corte | Administración · Superadmin | Nuevo | P2 |

---

## D · Conciliación bancaria

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| D1 | **Cierre de conciliación por fecha de corte** | Declarar el saldo del extracto y cerrar el período. Vivaru tiene el casado línea a línea, **no el cierre** | Administración | **Nuevo** | **P0** |
| D2 | **Depósitos en tránsito** | Dinero registrado que el banco aún no muestra | Administración | Nuevo | **P0** |
| D3 | **Cheques girados y no cobrados** | La otra mitad del puente libros↔banco | Administración | Nuevo | **P0** |
| D4 | **Resumen de saldos del cierre** | La aritmética explícita que cuadra contra el extracto | Administración | Nuevo | **P0** |
| D5 | **Bandeja de ingresos no identificados** | Depósitos sin dueño, con acción de identificar | Administración | **Nuevo** | **P1** |
| D6 | **Marca de conciliado en el movimiento** | Que el propio cobro sepa si ya fue conciliado | Administración | Parcial | P2 |

*(D1–D4 son un solo PRD si se prefiere: «expediente de cierre de conciliación».)*

---

## E · Egresos, proveedores y contabilidad

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| E1 | **Registro de proveedores** | Entidad propia con CI/RUC y razón social. Hoy el proveedor se **reteclea en cada egreso** | Administración | **Nuevo** | **P0** |
| E2 | **Datos bancarios del proveedor** | Institución, número y tipo de cuenta: el registro sabe dónde pagarle | Administración | Nuevo | **P1** |
| E3 | **Rubro por defecto del proveedor** | Preclasifica el gasto al registrarlo | Administración | Nuevo | P2 |
| E4 | **Estado de cuenta por proveedor** | Qué se le debe y qué se le pagó | Administración | Nuevo | **P1** |
| E5 | **Plan de cuentas configurable** | Categorías y rubros creados por el administrador, **con códigos gobernados** (no libres como los suyos, que ya se duplicaron) | Administración | **Nuevo** | **P1** |
| E6 | **Presupuesto anual por rubros** | Simulación del año con los rubros que se elijan | Administración · Consejo | **Nuevo** | **P1** |
| E7 | **Escenarios de presupuesto** | Pesimista · Ajustado · Ideal sobre el mismo año | Administración · Consejo | Nuevo | P2 |
| E8 | **Bitácora transversal de anulaciones** | Un solo registro de todo lo anulado, con **motivo obligatorio** y fecha | Administración · Superadmin | Parcial | **P1** |
| E9 | **Ajustes tipados** | Nota de crédito / nota de débito / intereses como asiento explícito, no como «forma de pago» | Administración | Nuevo | P2 |
| E10 | **Descarga masiva de soportes** | Bajar de una vez las facturas de un período | Administración | Nuevo | P3 |

---

## F · Medición de servicios

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| F1 | **Catálogo de servicios medidos** | Agua, gas, energía: qué se mide y a qué tarifa | Administración | **Nuevo** | **P1** |
| F2 | **Lectura de medidores por unidad** | Lectura anterior, actual y consumo, con período | Administración · Portería | **Nuevo** | **P1** |
| F3 | **Cobro generado desde el consumo** | Solo para las unidades con lectura registrada | Administración | **Nuevo** | **P1** |
| F4 | **El residente ve sus lecturas** | Historial de consumo de su propia unidad | Residente | Nuevo | P2 |

---

## G · Comunicaciones

`Communication` en Vivaru hoy es título, cuerpo, audiencia y fecha. Casi toda esta categoría
es hueco real.

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| G1 | **Medición de entregabilidad** | Entregados, **rebotes** y **quejas**, con lista de rebotes accionable. Hoy Vivaru envía sin saber si llegó | Administración · Superadmin | **Nuevo** | **P0** |
| G2 | **Adjuntar el estado de cuenta de cada unidad** | Un envío masivo donde cada quien recibe **su** estado de cuenta | Administración · Residente | **Nuevo** | **P1** |
| G3 | **Añadir link de pago al envío** | Cobrar dentro del mismo correo. **Depende de que exista pasarela de pago**, que hoy no hay | Administración · Residente | Nuevo | P2 |
| G4 | **Plantillas de comunicación** | Reutilizar textos frecuentes | Administración | Nuevo | P1 |
| G5 | **Programación de envío** | Redactar hoy, enviar el día que toca | Administración | Nuevo | P1 |
| G6 | **Destinatarios por unidad / grupo / bloque** | Segmentación más fina que «todos / propietarios / inquilinos» | Administración | **Parcial** | P1 |
| G7 | ~~Bandeja de notificaciones dentro del producto~~ **→ CORREGIDO 21 ago 2026** | **YA EXISTE**: colección `notifications` con leído/no leído, enlace y deduplicación (`use-notifications.ts`). Lo que hay es `notification-center.tsx`, **código muerto con cuatro notificaciones inventadas**, que se borra en `PRD-V-FLOW-003` | Residente | **Ya existe** | — |
| G8 | **Copia a la administración de lo enviado** | Registro de qué recibió cada residente | Administración | Nuevo | P2 |
| G9 | **Ciclo de vencidas cada N días** | Recordatorio recurrente configurable **desde la interfaz**, no en el despliegue | Administración | **Parcial** | P1 |
| G10 | **Día del mes del aviso de cobro** | Que el administrador elija su calendario de cobranza | Administración | Parcial | P1 |
| G11 | **Firma y pie configurables** | Texto legal y firma del remitente por conjunto | Administración | Parcial | P2 |
| G12 | **Reenviar una comunicación** | Repetir un envío a los mismos destinatarios | Administración | Nuevo | P3 |
| G13 | **Asistente de redacción con IA** | Borrador asistido del comunicado | Administración | Nuevo | P2 |
| G14 | **Canal adicional al correo** | Habitanto usa SMS; en Vivaru **WhatsApp solo existe en el embudo de marketing**, no hacia residentes | Administración · Residente | **Nuevo** | P2 |

---

## H · Reservas de zonas comunes

Vivaru ya tiene horarios, duración de turno, días disponibles, aforo por turno, duración
máxima, **cuota por unidad al mes** y reglas de uso. Lo que falta es más estrecho de lo que
parecía.

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| H1 | ~~Compuerta de morosos~~ **→ CORREGIDO 21 ago 2026** | **YA EXISTE**, y es más fina que la de Habitanto: `src/features/reservations/eligibility.ts` comprueba política del conjunto (`reservationPolicy.blockOnDebt`), **exención por unidad** (`reservationExempt`) y saldo vencido. **Lo que sí es hueco** es que se comprueba **solo en el cliente** → `PRD-V-FIX-001` | Administración · Residente | **Ya existe** | — |
| H2 | **Aprobación automática por área** | Que el área decida si su reserva necesita visto bueno | Administración | Nuevo | **P1** |
| H3 | **Valor por reserva** | Tarifa de uso del área. **Depende de que exista pasarela de pago**, que hoy no hay | Administración · Residente | Parcial | P2 |
| H4 | **Garantía / depósito por reserva** | Vivaru lo tiene **solo para mudanzas**; falta para cualquier área | Administración · Residente | **Parcial** | P1 |
| H5 | **Horas de anticipación mínima** | Impedir la reserva de última hora | Administración | Nuevo | P2 |
| H6 | **Compuerta de no residentes** | Permitir o no reservar a quien no vive en el conjunto | Administración | Nuevo | P2 |
| H7 | **Reglas del área como documento** | Términos en PDF firmables, no solo texto | Administración · Residente | Parcial | P3 |

---

## I · Seguridad, accesos y portería

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| I1 | **Permisos de acceso por persona** | Quién puede entrar y por dónde | Administración · Portería | **Nuevo** | P2 |
| I2 | **Permisos de acceso por vehículo** | Placa autorizada en talanquera | Administración · Portería | Nuevo | P2 |
| I3 | **Dispositivos** | Tarjetas, mandos y lectoras asociadas a persona o vehículo | Administración · Portería | Nuevo | P2 |
| I4 | **Permisos masivos de acceso** | Otorgar o revocar a muchos de una vez | Administración | Nuevo | P3 |
| I5 | **Bitácora de accesos** | Registro de entradas y salidas físicas | Administración · Portería | Nuevo | P2 |
| I6 | **Bitácora de jornadas del guarda** | Marcaje de entrada y salida de turno, con categoría | Portería · Administración | **Nuevo** | **P1** |
| I7 | **Guarda como empresa** | Que el usuario de portería pueda ser una compañía de seguridad | Administración | Nuevo | P2 |
| I8 | **Integración con sistema de rondas** | Métricas de rondas, incidentes y kilómetros de un tercero. **Habitanto no lo construyó: lo integró** | Administración · Portería | Nuevo | P3 |
| I9 | **Remitente y contenido tipado en paquetería** | Courier, remitente y tipo de contenido; admitir «sin destinatario» | Portería · Residente | **Parcial** | P2 |

---

## J · Novedades y atención

Vivaru gana holgadamente en PQRS. Lo que falta son **tipos operativos** que hoy no tienen
dónde caer.

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| J1 | **Novedades operativas tipadas** | Daños, emergencias y objetos perdidos, con **campos propios por tipo** | Administración · Portería · Residente | **Nuevo** | **P1** |
| J2 | **Indicador de tiempo de resolución** | Promedio de días, resueltas y por atender | Administración · Consejo | Nuevo | **P1** |
| J3 | **Una sola taxonomía para los dos lados** | Que residente y administración usen el mismo vocabulario. **Aquí Habitanto falla y nosotros ya acertamos**: mantenerlo al añadir J1 | Administración · Residente | Ya resuelto | **P0** |

---

## K · Gobierno y transparencia

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| K1 | **Registro del consejo** | Miembros con **cargo, período y estado**. Vivaru tiene el rol pero no el registro | Consejo · Administración | **Nuevo** | **P1** |
| K2 | **Qué reportes ve el residente** | Casillas por conjunto que gobiernan la transparencia financiera | Administración · Residente | **Nuevo** | **P1** |
| K3 | **Asambleas / reuniones** | Convocatoria, acta y asistencia | Administración · Consejo · Residente | Nuevo | P2 |
| K4 | **Votaciones ligadas a la asamblea** | Voto con fecha de cierre y publicación de resultados. Vivaru tiene encuestas; falta el vínculo con la asamblea y el peso por alícuota | Consejo · Residente | **Parcial** | P2 |
| K5 | **Voto ponderado por alícuota** | Que el voto pese lo que pesa la unidad. **Ninguno de los dos lo tiene** | Consejo · Residente | Nuevo | P2 |

---

## L · Operación interna de la administración

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| L1 | **Gestor de tareas** | Tareas con participantes, prioridad, fecha límite, comentarios y calendario | Administración | **Nuevo** | P2 |
| L2 | **Alerta de recordatorio en tareas** | Aviso antes del vencimiento | Administración | Nuevo | P3 |
| L3 | **Archivo por carpetas libres** | Estructura que el administrador arma (actas, informes, planos, presupuestos) | Administración · Residente | **Parcial** | P2 |

---

## M · Multi-conjunto y modelo comercial

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| M1 | **Capa de empresa administradora** | Una administradora sobre N conjuntos. Habitanto lo tiene; **Vivaru asume un tenant = un conjunto** | Superadmin · Administración | **Nuevo** | **P1** |
| M2 | **Cambio de conjunto sin cerrar sesión** | Buscador de conjuntos para el administrador de cartera | Administración | **Nuevo** | **P1** |
| M3 | **Cartera de conjuntos por administradora** | Vista consolidada de la administradora | Superadmin · Administración | Nuevo | P2 |
| M4 | **Consolidado entre conjuntos** | Reportes que sumen varios conjuntos. **Ojo: solo funciona si E5 gobierna los códigos de rubro** | Administración · Superadmin | Nuevo | P2 |
| M5 | **Correo remitente propio por conjunto** | Que el aviso salga del conjunto, no de Vivaru | Administración | **Nuevo** | **P1** |
| M6 | **Dominio o sitio propio por conjunto** | Marca blanca más allá del logo y los colores | Superadmin | Parcial | P3 |
| M7 | **Complementos licenciados aparte** | Un canal o módulo con su propia vigencia, como su SMS | Superadmin | Nuevo | P3 |
| M8 | **Unidades contratadas y vigencia visibles** | Que el conjunto vea qué contrató y hasta cuándo | Administración | Nuevo | P3 |

---

## N · Soporte y adopción del producto

| # | Candidato | Qué es | Perfil | Estado | Pri |
|---|---|---|---|---|---|
| N1 | **Base de conocimiento segmentada por rol** | Guía propia con índice distinto para administración, residente y portería | Todos | **Nuevo** | **P1** |
| N2 | **Chat de soporte embebido** | Ayuda dentro del producto, no por correo | Todos | Nuevo | P2 |
| N3 | **Novedades del producto dentro del producto** | Changelog visible. **Habitanto lo tiene y lo abandonó**: una sola entrada | Todos | Nuevo | P3 |

---

## Resumen

**108 candidatos** en 14 categorías.

> **Recontado el 3 de septiembre de 2026 SOBRE LAS FILAS, no sobre esta tabla.** La tabla decía
> `15 · 41 · 40 · 12` y llevaba meses sin actualizarse: **`G7` y `H1` se construyeron** y quedaron
> tachados con `—`, y dos filas más bajaron de P1 a P2. **Las filas mandan sobre el resumen**, y este
> resumen ya coincide con ellas.

| Prioridad | Cuántos | Qué significa |
|---|---|---|
| **P0** | **14** | Desbloquean otras cosas o corrigen una debilidad estructural |
| **P1** | **38** | Valor alto y directo |
| **P2** | **42** | Valor real, sin urgencia |
| **P3** | 12 | Anotados para no perderlos |
| **Ya construidos** | **2** | `G7` (bandeja de notificaciones) y `H1` (compuerta de morosos), tachados en su fila |

| Categoría | Total | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| A · Unidad y personas | 14 | 3 | 3 | 7 | 1 |
| B · Cartera y cobro | 10 | 2 | 6 | 2 | — |
| C · Recaudo y tesorería | 12 | 2 | 3 | 6 | 1 |
| D · Conciliación | 6 | 4 | 1 | 1 | — |
| E · Egresos y contabilidad | 10 | 1 | 5 | 3 | 1 |
| F · Medición de servicios | 4 | — | 3 | 1 | — |
| G · Comunicaciones | 14 | 1 | **6** | **5** | 1 | *(+1 construido: `G7`)* |
| H · Reservas | 7 | **—** | **2** | **3** | 1 | *(+1 construido: `H1`)* |
| I · Seguridad y portería | 9 | — | 1 | 6 | 2 |
| J · Novedades | 3 | 1 | 2 | — | — |
| K · Gobierno | 5 | — | 2 | 3 | — |
| L · Operación interna | 3 | — | — | 2 | 1 |
| M · Multi-conjunto y comercial | 8 | — | 3 | 2 | 3 |
| N · Soporte y adopción | 3 | — | 1 | 1 | 1 |

### Los P0, en orden de dependencia — **quedan 14: `H1` ya se construyó**

1. **A1 · Alícuota por unidad** — de aquí cuelgan B1, B2, K5 y el certificado de expensas
2. **A2 · Expensa y seguro por unidad** — el importe que la generación masiva necesita leer
3. **A3 · Relación tipada persona↔unidad** — a quién se cobra
4. **B1 · Cobro por alícuota** — deja de cobrar lo mismo a todas las unidades
5. **B2 · Prorrateo de un gasto entre unidades** — el trabajo diario del administrador
6. **C1 + C2 · Anticipos y su cruce** — el pago adelantado es normal en el mercado
7. **D1–D4 · Cierre de conciliación** — tenemos el casado, falta el cierre
8. **E1 · Registro de proveedores** — hoy se reteclea el proveedor cada mes
9. **G1 · Medición de entregabilidad** — enviamos sin saber si llega
10. **H1 · Compuerta de morosos en reservas** — **la más barata de todas**
11. **J3 · Una sola taxonomía de novedades** — no es construir: es **no romperlo** al añadir J1

### Lo que NO está en esta lista, y por qué

- **Facturación electrónica y lo fiscal** — fuera del producto por decisión del 20 de agosto.
  Habitanto lo vende como complemento **solo para Ecuador**: ni ellos lo tratan como base.
- **Aplicación móvil y Junta Directiva de Habitanto** — fuera de alcance por decisión de David.
- **Reportes en macro de Excel** — cuatro de sus reportes viven fuera del producto, en una
  plantilla sin actualizar desde 2023. Si alguno hace falta, se construye dentro.
- **Su modelo de permisos** — cinco perfiles pero solo un perfil y dos interruptores por
  usuario. No es un ejemplo a seguir.
- **Sus dos interfaces conviviendo** — la deuda que les esconde funciones del propio producto.

### Correcciones aplicadas al escribir las PRD

Escribir las nueve PRD obligó a **leer el código antes de afirmar**, y eso anuló dos candidatos
y degradó otros dos:

| Candidato | Qué decía | Qué es verdad |
|---|---|---|
| **H1** — compuerta de morosos | «Nuevo, P0, la palanca más barata» | **Ya existe**, y con exención por unidad que Habitanto no tiene. El hueco real es que **solo se comprueba en el cliente** |
| **G7** — bandeja de notificaciones | «Nuevo, P1» | **Ya existe** y funciona |
| **G3** — link de pago · **H3** — valor por reserva | P1 los dos | Bajados a **P2**: los dos **dependen de una pasarela de pago que Vivaru no tiene** |

**El recuento de prioridades del resumen no se ha rehecho**, y se dice aquí para que nadie lo dé
por exacto: **P0 son 14, no 15**, y hay dos P1 menos.

### Lo que ya tenemos y conviene defender

No aparece arriba porque no es hueco, pero es lo que nos distingue: **PQRS con taxonomía
controlada, radicado, prioridad e hilo**; **pase de visitante con QR, vigencia y control de
entrada/salida**; **acuerdos de comité con firma por unidad**; **proyección de flujo de caja,
cobertura del fondo y detección de anomalías en egresos**; **flujo de mudanza con depósito**;
**directorio de servicios entre residentes y terceros**; y la **maquinaria comercial de trial,
planes y atribución de lead**. Nada de esto existe en Habitanto.
