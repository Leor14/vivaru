# PRD-V-FEAT-008 — Medición de consumos con foto del medidor

| Campo | Valor |
|---|---|
| **ID** | `PRD-V-FEAT-008` |
| **Tipo** | `FEAT` — capacidad nueva. El cobro es su **consumidor**, no su sujeto |
| **Portales** | `ADMIN` (alcance) · `RESIDENTE` (entrega 3) · `PORTERIA` (ver `TBD-B`) |
| **Módulo** | Cartera y cobro · Finanzas |
| **Usuario principal** | El administrador que toma las lecturas cada mes |
| **Usuarios secundarios** | Residente (ve su consumo), consejo (lo ve en el informe) |
| **Responsable** | David |
| **Estado** | **LAS TRES ENTREGAS EN PRODUCCIÓN** (`6fac4bc`), vistas antes en staging · bandera encendida **solo en Las Playas**, con una demo sembrada (10 sep 2026); apagada en los otros ocho |
| **Dependencias** | `PRD-V-FLOW-001` (reparto por coeficiente, **de donde sale la estructura**) · `PRD-V-PLAT-003` (plan de cuentas) |
| **Riesgo** | Medio — toca dinero, pero no toca permisos ni el modelo de la unidad |
| **Reversibilidad** | Reversible por bandera **salvo los cargos ya emitidos** (§13) |

---

## 1 · Resumen ejecutivo

Cobrar el agua por lo que cada unidad consumió exige tres cosas que Vivaru no tiene:
**saber qué se mide, registrar la lectura, y convertirla en un cargo**. Hoy no existe
ninguna de las tres, así que un conjunto que cobra agua medida **no puede usar Vivaru
para eso**.

La administradora de Habitanto lo señaló como **su cuello de botella declarado**, y no
es el cálculo: es la **evidencia**. Toma la foto de cada medidor y la manda por correo,
en un archivo aparte, porque no hay dónde ponerla.

Esta ficha construye el catálogo, la lectura **con su foto**, y el cargo derivado del
consumo. **La foto no es un adjunto decorativo: es lo que convierte la lectura en algo
que el residente puede discutir y el administrador defender.**

**Y hay una ventaja que se puede tomar, no solo igualar:** Habitanto tiene la pantalla
de lecturas y —textual— **«no nos calcula»**. Vivaru sí va a calcular: consumo, importe
y cargo.

---

## 2 · Problema y baseline

**Cómo se resuelve hoy: fuera del producto.** La administradora recorre los medidores,
fotografía cada uno, teclea las lecturas en otro sitio y **manda las fotos por correo en
un archivo aparte**.

> «Al momento de cobrar el consumo de **agua fría y agua caliente**, nos toca cargar esa
> información. **Yo tengo que cargar manual las fotos, porque tengo que tomar fotos de
> los medidores.** Yo no sé si aquí se puede poner **una ventanita y cargo las fotos**,
> para no enviar por email aparte. **Les tengo que mandar por email, en un archivo
> aparte.**»
> — Sesión del 19 de agosto de 2026, §3.5

**Preguntada directamente qué le lleva más trabajo**, respondió que las cuentas por pagar
son «facilito y rapidito» y que **esto es lo que cuesta**. No es una petición de lista: es
la respuesta a la pregunta de dónde le duele.

### Lo medido en el repositorio y en producción (9 de septiembre de 2026)

| Medición | Valor | Fuente |
|---|---|---|
| Ficheros que mencionan medidor o consumo | **0** | barrido de `src/` y `functions/src/` |
| Conceptos de cobro que sirvan para agua | **0 de 8** | `BillingConcept` |
| Cuentas de INGRESO en el plan | 11, **ninguna de servicios medidos** | `SEMILLA_PLAN_DE_CUENTAS` |
| Unidades en producción | **93**, en 9 conjuntos | `units` |
| Lecturas registradas | **0** — la colección no existe | — |

⚠️ **`/admin/services` NO es esto.** Son **zonas comunes reservables** (`amenity`), y el
nombre invita a confundirlas. La medición de servicios es un módulo distinto.

### Métrica de éxito

- **Primaria:** lecturas registradas **con foto** en un período. Baseline **0**, y hoy
  imposible.
- **Secundaria:** cargos generados desde consumo. Baseline **0**.
- **La que declara el problema resuelto:** que deje de mandar fotos por correo. **No se
  puede medir desde el producto** — se pregunta.

---

## 3 · Usuarios, roles y permisos

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| **`tenant_admin`** | Catálogo de servicios medidos, lecturas de todas las unidades, consumos e importes | Crear y editar el catálogo · registrar y corregir lecturas · adjuntar la foto · generar la corrida de cobro | Editar una lectura **de un período ya cobrado** (`RN-05`) · borrar una foto que respalda un cargo emitido |
| **`resident`** | **Solo las lecturas de SU unidad**, con su consumo y su foto | Consultar su historial | Ver lecturas de otra unidad · registrar o corregir ninguna |
| **`security_guard`** | Nada, salvo que se resuelva `TBD-B` | Nada en la entrega 1 | Registrar lecturas mientras `TBD-B` esté abierta |
| **`committee`** | El total de servicios medidos **dentro del informe mensual**, sin detalle por unidad | Leer | Ver el consumo de una unidad ajena — es dato de un tercero |
| **`superadmin`** | Todo, como siempre | Soporte | — |

---

## 4 · Objetivo, alcance y exclusiones

**Objetivo:** que un conjunto que cobra servicios medidos pueda hacerlo dentro de Vivaru,
**con la evidencia adjunta a la lectura** y el cálculo hecho por el producto.

### Entra

1. **Catálogo de servicios medidos** por conjunto: qué se mide, en qué unidad de medida y
   a qué tarifa (`F1`).
2. **Lectura por unidad y período**, con anterior, actual, consumo derivado **y foto**
   (`F2` + lo que no estaba en ningún candidato).
3. **Cobro derivado del consumo** (`F3`), como **tercera base de reparto**.
4. **El residente ve sus lecturas** con su foto (`F4`).

### No entra, y por qué

| Fuera | Motivo |
|---|---|
| Leer el medidor desde la foto con IA | No hay corpus. **Ya se decidió tres veces** que sin 15–25 archivos reales no se escribe una ficha de IA. La foto que esta ficha guarda **es precisamente el corpus** que lo desbloquearía |
| Tarifas por tramos o escalonadas | Nadie las ha pedido. Empezar por tarifa plana por unidad de medida. `TBD-C` |
| Medidores con submedición o repartidores de costes | Fuera del mercado que atiende Vivaru hoy |
| Integración con la empresa de agua | No existe API y no la pidió nadie |
| Facturar el servicio | **Vivaru no maneja lo fiscal.** La factura la emite el cliente |
| Alarmas por consumo anómalo | Interesante y no urgente. Fase 2 — el patrón ya existe en `expense-anomaly.ts` |

---

## 5 · Flujo funcional

### Camino feliz

1. El administrador declara una vez el servicio: **«Agua fría», m³, tarifa por m³**.
2. Abre el período y ve **la lista de sus unidades con la lectura anterior ya puesta**.
3. Por cada unidad: teclea la lectura actual y **adjunta la foto**. El producto calcula
   el consumo **y lo enseña en el momento**.
4. Cierra el período. Genera la corrida de cobro: **solo las unidades con lectura**.
5. Cada residente ve su cargo, su consumo y **la foto de su propio medidor**.

### Validaciones y errores

| Caso | Respuesta |
|---|---|
| Lectura actual **menor** que la anterior | «La lectura es menor que la del período anterior. Revísala, o marca que el medidor se reinició.» **No se bloquea**: un medidor que da la vuelta es real (`RN-03`) |
| Unidad sin lectura al generar el cobro | **Se excluye de la corrida y se nombra**, como hace el reparto por coeficiente cuando falta un coeficiente |
| Foto que no es imagen | «Solo se admiten imágenes (JPG, PNG o HEIC).» |
| Período ya cobrado | Las lecturas quedan en solo lectura (`RN-05`) |
| Conjunto suspendido o vencido | Registrar una lectura **se deniega**: es escritura (`tenantOperable`). **Consultarlas sigue permitido** |
| Conjunto en prueba | Funciona igual, sin invitar personas reales |

### Casos límite

- **Unidad nueva sin lectura anterior:** su primera lectura **es la línea base** y no
  genera cargo. Cobrar el acumulado de un medidor desde cero le cobraría a alguien el
  consumo de quien vivió antes.
- **Se corrige una lectura antes de cobrar:** se recalcula el consumo. Después de cobrar,
  no (`RN-05`).

---

## 6 · Estados y transiciones

El sujeto con ciclo de vida es **el período de lectura**, no la lectura suelta.

| Estado | Qué significa | Quién lo mueve |
|---|---|---|
| `abierto` | Se registran y corrigen lecturas | `tenant_admin` |
| `cerrado` | Ya no se editan; listo para cobrar | `tenant_admin` |
| `cobrado` | Tiene corrida asociada. **Terminal** | `tenant_admin`, al generar |
| `anulado` | Se descartó sin cobrar. **Terminal**, con motivo obligatorio | `tenant_admin` |

**Nada queda a medias:** un período `abierto` con lecturas parciales es un estado válido
—se recorren los medidores en varios días— y su dueño es quien lo abrió. **Anular exige
motivo**, como la corrida de cobro (`R8` de `FLOW-001`).

---

## 7 · Contrato de datos y multi-tenancy

Dos colecciones nuevas. **Las dos llevan `tenantId` y toda consulta de lista lo filtra**
— las reglas rechazan la consulta entera, no filtran.

### `meteredServices` — el catálogo (`F1`)

| Campo | Tipo | Obligatorio | Quién escribe |
|---|---|---|---|
| `tenantId` | `string` | Sí | Cliente |
| `name` | `string` | Sí | Cliente |
| `unit` | `"m3" \| "kwh" \| "gal"` | Sí | Cliente |
| `rate` | `number` | Sí | Cliente |
| `accountCode` | `string` | Sí | Cliente, del plan del conjunto |
| `active` | `boolean` | Sí | Cliente |

### `meterReadings` — la lectura (`F2`)

| Campo | Tipo | Obligatorio | Quién escribe |
|---|---|---|---|
| `tenantId` · `serviceId` · `unitId` | `string` | Sí | Cliente |
| `period` | `string` `YYYY-MM` | Sí | Cliente |
| `previous` · `current` | `number` | Sí | Cliente |
| `consumption` | `number` | Sí | **Solo servidor** (`RN-02`) |
| `photoUrl` | `string` | No (ver `TBD-A`) | Cliente |
| `readAt` · `readBy` | `Timestamp` · `uid` | Sí | Cliente |
| `status` | ver §6 | Sí | Cliente / servidor |
| `billingCampaignId` | `string` | No | **Solo servidor**, al cobrar |

**La foto vive en Storage**, en `tenants/{tenantId}/meter-readings/{resto}` — el mismo
patrón que las notas de visita del guarda, que ya sube fotos y ya tiene su regla.

**Retención:** la foto respalda un cargo de dinero, así que **vive lo que viva el cargo** y
no entra en la ventana de 12 meses de los comprobantes de pago. Se declara aquí porque no
declararlo la metería en la purga nocturna por defecto.

---

## 8 · Reglas de negocio

| # | Regla |
|---|---|
| **`RN-01`** | **El cobro por consumo es una TERCERA BASE DE REPARTO**, no un mecanismo nuevo. `BillingCampaign` ya lleva `distributionBasis`, `totalDistributed` y `distributionBasisValue` por línea desde `FLOW-001`: el consumo entra como `"consumption"` y el valor de la base es el consumo medido |
| **`RN-02`** | **El consumo lo calcula el servidor**, nunca el cliente. Es la diferencia con Habitanto —«no nos calcula»— y además un número que decide dinero |
| **`RN-03`** | Una lectura menor que la anterior **avisa pero no bloquea**: un medidor que completa su vuelta es real. Bloquearlo dejaría al administrador sin forma de registrar el mes |
| **`RN-04`** | **La primera lectura de una unidad es línea base y no genera cargo.** Cobrar el acumulado le cobraría a alguien lo que consumió otro |
| **`RN-05`** | Una lectura de un período **`cobrado` no se edita**, y su foto no se borra. El cargo ya salió: cambiar su respaldo reescribiría la prueba de una deuda |
| **`RN-06`** | Solo se cobra a las unidades **con lectura**. Las que falten **se nombran**, como ya hace el reparto por coeficiente |
| **`RN-07`** | El residente ve **solo su unidad**. El consumo de un vecino es dato de un tercero |
| **`RN-08`** | El servicio medido **cuelga de una cuenta del plan del conjunto**, y esa cuenta debe existir antes |
| **`RN-09`** | **La foto es obligatoria para CERRAR el período, no para guardar la lectura** (`TBD-A`). Cerrar con lecturas sin foto se deniega **nombrando las unidades que faltan**, igual que el reparto por coeficiente |
| **`RN-10`** | **`previous` lo pone el servidor**, leyendo el período anterior. No viaja en la petición: si el cliente pudiera declararlo, podría fijar el consumo que quisiera sin tocar `consumption` |

---

## 9 · Notificaciones y correo

**Esta ficha no crea ningún aviso nuevo.** El cargo generado desde el consumo notifica
**por el camino que ya existe** para cualquier cargo, con el mismo catálogo y el mismo
remitente verificado.

Se decide así a propósito: un aviso propio de «tu lectura fue registrada» avisaría dos
veces del mismo hecho —la lectura y su cargo—, y el residente solo actúa sobre el segundo.

---

## 10 · Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| `CA1` | El administrador declara «Agua fría», m³, y una tarifa, y queda disponible para lecturas |
| `CA2` | Registra la lectura de una unidad **con foto**, y el consumo **se calcula y se ve sin recargar** |
| `CA3` | La lectura anterior **viene puesta** desde el período pasado, sin teclearla |
| `CA4` | Genera la corrida y **solo se cobra a las unidades con lectura**; las que faltan se **nombran** |
| `CA5` | El importe del cargo es **consumo × tarifa**, comprobado a mano sobre un caso con decimales |
| `CA6` | El asiento del cargo cae en **la cuenta del plan** que declara el servicio |
| `CA7` | El residente abre su estado de cuenta y ve **su consumo y la foto de su medidor** |
| `CA8` | La primera lectura de una unidad **no genera cargo** (`RN-04`) |
| `CA9` | Una lectura menor que la anterior **avisa y deja continuar** (`RN-03`) |
| `CA9b` | Se guarda una lectura **sin foto** y el recorrido continúa; el período queda abierto (`RN-09`) |

### **Deben fallar**

| # | Criterio que tiene que ser rechazado |
|---|---|
| `CA10` | Un residente lee la lectura **de otra unidad** → denegado por reglas |
| `CA11` | Un residente **escribe** una lectura → denegado |
| `CA12` | Se edita una lectura de un período **`cobrado`** → denegado (`RN-05`) |
| `CA13` | El cliente escribe **`consumption`** directamente → denegado por reglas (`RN-02`) |
| `CA14` | Se registra una lectura con el conjunto **suspendido** → denegado por `tenantOperable` |
| `CA15` | Se genera la corrida **dos veces** sobre el mismo período → la segunda se rechaza |
| `CA16` | Se **cierra** un período con alguna lectura **sin foto** → denegado, **nombrando las unidades** (`RN-09`) |
| `CA17` | La petición manda un **`previous` inventado** → se ignora: manda el del período anterior (`RN-10`) |

> **Falsación obligatoria.** Al escribir las reglas de `CA10`, `CA12` y `CA13`, **borrar el
> bloque entero y comprobar que enrojecen**. Una prueba de denegación pasa igual sin
> ninguna regla: la satisface el deny por defecto. Cada denegación va con su **pareja
> positiva** — el mismo documento leído por quien sí debe.

---

## 11 · Arquitectura y dependencias

### La decisión obligatoria: **mixta, y por pieza**

| Pieza | Vía | Por qué |
|---|---|---|
| Catálogo de servicios | **Escritura directa** | CRUD del administrador que las reglas protegen por completo. No sostiene ningún invariante |
| Registrar la lectura | **Callable** | ⚠️ **Esta celda decía «escritura directa» y se corrigió el 9 de septiembre, ANTES de escribir código.** El motivo que la tumbó no es `consumption`: es **`previous`**. `CA3` exige que la lectura anterior **la ponga el sistema**, y si viaja en la petición el cliente puede mentir sobre ella — con lo que el consumo sale mal aunque el servidor lo calcule bien. **Los dos campos deciden dinero juntos, así que los escribe el mismo lado** |
| Generar la corrida | **Callable, sin discusión** | Escribe en varias colecciones, crea asientos, mueve dinero y no puede ser falsificable. **Es exactamente el camino de `distributeExpense`** |

### Piezas y el gemelo que ya lo hace bien

| Pieza | Cambio |
|---|---|
| `functions/src/consumption-billing.ts` | **Nuevo, calcado de `coefficient-billing.ts`** — que ya reparte importes distintos por unidad en una sola corrida |
| `BillingCampaign.distributionBasis` | Añadir `"consumption"`. ⚠️ `expense-distribution.ts:31` avisa: **ese campo se escribe fijo, y mentir en él deja cargos que nadie puede explicar** |
| `SEMILLA_PLAN_DE_CUENTAS` | **Cuenta de ingreso nueva** — no hay ninguna para servicios medidos entre las once |
| `firestore.rules` | Dos colecciones nuevas; `consumption` cerrado al cliente; el residente solo su unidad |
| `storage.rules` | `tenants/{tenantId}/meter-readings/{resto}` |
| Bandera | `producto-medicion-de-consumos`, en **los CINCO sitios** del catálogo o no se podrá encender por conjunto |

### `TBD`

| # | Pregunta | Bloquea |
|---|---|---|
| ~~`TBD-A`~~ | ✅ **CERRADA el 9 sep: la foto es obligatoria para CERRAR el período, no para guardar la lectura.** Se puede registrar sin foto y seguir andando —recorre los medidores en varios días, y hay sótanos sin señal—, pero **el período no se cierra ni se cobra hasta que todas la tengan**. Así ningún cargo sale sin evidencia sin obligarla a rehacer el recorrido | — |
| ~~`TBD-B`~~ | ✅ **CERRADA el 9 sep: solo la administración.** `F2` decía «Administración · Portería», pero **Paola las toma ella**: añadir un rol a las reglas por una necesidad que nadie midió es superficie de permisos a cambio de nada. Si aparece, se abre después | — |
| `TBD-C` | ¿Tarifas por tramos? Ninguno de los dos productos lo tiene. No bloquea el MVP | Fase 2 |

---

## 12 · Riesgos

| Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|
| **Se cobra de más por una lectura mal tecleada** | El importe se aparta de la media de esa unidad | La foto **es la defensa**: se puede comprobar. `RN-05` impide reescribirla después |
| Se cobra el acumulado del inquilino anterior | Un primer cargo desproporcionado | `RN-04`: la primera lectura es línea base |
| Se construye sobre tabla vacía, otra vez | El catálogo sigue en 0 filas | **La entrega 1 no cobra nada**: guarda lecturas con foto, que es lo que ella ya hace a mano. Sirve desde el primer día |
| Las fotos engordan el almacenamiento | Tamaño por conjunto | 93 unidades × 12 meses ≈ 1.100 fotos/año. **No es un problema de escala**, pero conviene comprimir en el cliente |
| `distributionBasis` mal escrito | Cargos que no se pueden explicar | Lo avisa el propio código; se escribe fijo por rama |

---

## 13 · Despliegue, rollback y Story Map

### Orden

**Reglas → functions → front**, el habitual. Aquí **no se invierte**: las reglas nuevas
solo *abren* colecciones que no existen, no restringen nada vigente.

### Rollback

- **Reversible por bandera** en lo que se ve.
- **NO reversible:** los **cargos ya emitidos**. Apagar la bandera oculta el módulo y
  **no anula dinero cobrado** — para eso se anula la corrida, que ya sabe hacerlo.

### Story Map

| Entrega | Qué | Por qué en este orden |
|---|---|---|
| **1** | Catálogo + lectura con foto + consumo calculado | **Resuelve su dolor declarado sin tocar dinero.** Deja de mandar fotos por correo desde el primer día |
| **2** | El cobro derivado del consumo | Toca dinero. Va después de que las lecturas sean fiables |
| **3** | El residente ve sus lecturas y su foto | Es lo que hace discutible el cargo, y solo tiene sentido con el cargo puesto |

### Qué se valida dónde

- **En staging:** los quince criterios, los de reglas contra el emulador (**sí hay Java**).
- **Solo en producción, y con ojos:** que la foto se vea en el estado de cuenta del
  residente desde un teléfono — que es como se toma y como se mira.

---

## 14 · Lo que se vio al construir y validar la entrega 1 (10 de septiembre de 2026)

### Observado con ojos en staging · `tenant-palmas-cdmx`, 25 unidades

| Qué | Visto |
|---|---|
| `CA1` · declarar el servicio | «Agua fría · $3.200/m³», y la tabla con las 25 unidades |
| `CA3` · la lectura anterior **la pone el sistema** | Octubre trajo `1200` de septiembre sin teclearlo |
| **`CA5` · el cálculo** | 1247 − 1200 = **47 m³** → **$150.400**, exacto a la predicción escrita antes |
| `CA8` · `RN-04` línea base | «primera lectura registrada. No genera cargo», consumo 0 |
| `RN-09` · la foto para cerrar | «Faltan 1 foto para poder cerrar», **antes** de intentarlo |
| `RN-10` · en el DATO, no en el pixel | `previous=1200` escrito por el servidor, `esLineaBase=false` |

**Sin observar todavía:** `CA2` (la foto subida de verdad, que pide un archivo real),
`CA7` (el residente ve la suya — es la entrega 3) y todo lo de cobro, que es la entrega 2.

### 🔴 Un defecto que encontró MIRAR, y que ninguna prueba podía ver

Al cambiar de septiembre a octubre, **el campo conservaba la lectura del mes
anterior**: la fila decía «—» en anterior, consumo e importe —octubre estaba
vacío— **y el campo enseñaba el `1200` de septiembre**. Quien lo mirara daría el
mes por registrado y **se saltaría el mes entero**, que aquí significa no
cobrarle el agua a nadie.

**No era un error de tipos ni de lógica: era una identidad de nodo.** El campo es
no controlado (`defaultValue`, que React solo lee al montar) y la `key` no
llevaba el período, así que React reutilizaba el input. Typecheck en 0 y 1806
pruebas en verde no podían verlo.

Corregido y con guardián que **mide el código**
(`tests/campo-no-controlado-con-periodo.test.ts`), con su propio control para no
medir la nada, y falsado reintroduciendo el defecto exacto.

### Y tres guardianes que ya existían corrigieron el trabajo

- **`clave-de-unidad-guarda`** — nada comprobaba que la unidad existiera.
- **`page-identity`** — el encabezado de nivel 1 lo pone el shell. Y volvió a
  enrojecer **con el comentario que lo explicaba**, porque cuenta la etiqueta
  escrita en comentarios: el gemelo de Tailwind resucitando una clase nombrada.
- **`status-mapper-cobertura`** — los tres estados nuevos faltaban en el mapa.
  **No bastaba con que la clave ya estuviera en español**: `getStatusLabel` cae en
  silencio a la clave cruda, y «cobrado» se habría visto casi bien para siempre.

---

## 15 · La entrega 2, vista de punta a punta (10 de septiembre de 2026)

El ciclo entero en staging/Palmas, con la predicción escrita antes de cada paso:

| Paso | Visto |
|---|---|
| `CA2` · subir la foto | «Foto de EA-101 guardada», el aviso de la foto que faltaba **desapareció solo** |
| `RN-09` · cerrar | Antes se negaba nombrando la unidad; con la foto, «Período cerrado con 1 lectura» |
| **La vista previa** | **«24 unidades no tienen lectura y no se les va a cobrar este mes»**, nombradas una a una, arriba y en ámbar |
| `CA5` · el importe | 1 unidad · 47 m³ · **$150.400** |
| `CA15` · después de cobrar | El botón pasa a **«Ya cobrado»** y no deja reabrir |

**En el dato, no en el pixel:** el cargo con `accountCode: 1.11` —no «otros ingresos»—, el consumo **congelado** en `distributionBasisValue: 47`, la campaña con `distributionBasis: "consumption"` y `unitAmount: 0`, y la lectura sellada como `cobrado` con su campaña.

**Y la cadena cierra con el número exacto:** la Cartera enseña **$163.200 pendientes**, que son **$150.400 del consumo + $12.800** de lo que ya había. Del medidor al cargo, y del cargo a la cartera.

**Control negativo:** septiembre siguió `abierto` y sin tocar. La corrida de octubre no perturbó lo que no le tocaba.

### Tres defectos propios, cazados por tres cosas distintas

1. **La cuenta `1.11` iba a quedarse vacía para siempre.** La entrega 1 la creó sin el concepto de cargo, y `aplicarPago` resuelve la cuenta del asiento **desde el concepto**, no del `accountCode`. Lo cazó **medir antes de construir**, y el precedente estaba escrito palabra por palabra en el comentario de la cuota de vigilancia: *«la cuenta sola no bastaba»*.
2. **El orden de dos guardas hacía inalcanzable la idempotencia**: el segundo clic decía «ese período ya se cobró» a quien acababa de cobrarlo. Lo cazó **una prueba**.
3. 🔴 **Una prueba mía era CIEGA.** La de `CA15` comparaba dos llamadas seguidas, así que falsarla metiendo un `Date.now()` en el id **pasó en verde** — dos llamadas en el mismo milisegundo dan lo mismo. Lo cazó **falsarla**, y de esa estabilidad depende no cobrar dos veces.

> Y una guarda del propio script de edición evitó un cuarto: `| "vigilancia"` aparece **dos veces** en `domain.ts` —en `BillingConcept` y en `ExpenseCategory`—, así que un reemplazo sin comprobar unicidad habría metido el concepto de cobro entre las categorías de gasto. La colisión exacta que `R11` existe para impedir.

### Lo que queda

**Entrega 3:** el residente ve sus lecturas y su foto. ⚠️ Su consulta —`tenantId` + `unitId`— **no se ha ejercitado contra un índice real**; las tres del administrador sí, y funcionan.

---

## 16 · La entrega 3, vista con la sesión del residente (10 de septiembre de 2026)

Con la sesión de **Carmen García Vidal** (Privada Las Palmas, EA-101), que es
además la consejera de `PLAT-004` — así que una sesión verificó las dos fichas.

| Qué | Visto |
|---|---|
| `CA7` · la tarjeta | «Tus consumos medidos», con **dos filas** |
| Octubre | **47 m³ · $150.400**, con «Ver foto» |
| Septiembre · `RN-04` | **«primera lectura»** e importe «—»: se dice POR QUÉ no se cobra, en vez de enseñar un cero que parece un error |
| El orden | Lo más reciente arriba — **puesto en memoria, sin índice** |
| La foto | Se abre a tamaño completo con su título |
| **`RN-07`** | **Falsado con un dato de prueba**: se sembró una lectura de 99 m³ en EA-102, y Carmen **siguió viendo solo sus dos filas** |
| **`RN-01` de `PLAT-004`** | Carmen es consejera y **conserva su unidad y su estado de cuenta** |

**`RN-07` no se dio por bueno con la regla escrita ni con la prueba del emulador:
se metió el dato del vecino y se comprobó que no aparece.** Es la diferencia entre
«la consulta filtra» y «el vecino no lo ve», y solo la segunda es la promesa.

Y `RN-01` cierra el hueco que quedó ayer: **es el invariante que ninguna de las
374 pruebas de reglas puede demostrar**, porque lo que hay que ver es que un
consejero SIGA entrando a su portal de residente.

### Antes de escribir código se midieron dos cosas, y las dos decidieron el diseño

1. **`tenantId + unitId + orderBy(period)` EXIGE índice compuesto**; sin orden, no.
   Un índice que falta **no da error**: Firestore rechaza la consulta entera y el
   residente vería «no tienes lecturas» teniendo doce. Por eso el orden va en
   memoria — patrón `watchLedger`, con guardián.
2. **El `unitId` de las lecturas CASA con el de las membresías** (1 de 1). Si no
   casaran, `residentOwnUnit` rechazaría y el residente vería vacío: el defecto de
   `FIX-002` con otro nombre.

---

## Puertas

| Puerta | Estado |
|---|---|
| **`G0` Necesidad** | ✅ Medida y **citada textualmente**. Es la respuesta a «¿qué le lleva más trabajo?» |
| **`G1` Valor** | ✅ Baseline 0 en las tres mediciones |
| **`G2` Datos y permisos** | ✅ Dos colecciones nuevas, sin tocar el modelo de la unidad ni los roles |
| **`G3` Riesgo** | ✅ Bandera, rollback y lo que **no** revierte, declarados |
| **`G4` Aceptación** | ✅ Quince criterios, **ocho de ellos que deben fallar** |
| **`G5` Operación** | ✅ **El dueño ya existe y ya hace la tarea**: la administradora que hoy recorre los medidores. Es la misma razón por la que `FLOW-007` pasó y `FLOW-006` no |
| **`G6` Escala** | ✅ 93 unidades × 12 meses. Sin problema de volumen ni de coste |

> **`G0`–`G6` superadas: LISTA PARA DESARROLLO**, con tres `TBD` de los que **solo `TBD-A`
> cambia el uso diario** y conviene resolver antes de la entrega 1.
