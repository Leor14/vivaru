# Portafolio de PRD — Vivaru

Toda especificación de producto vive aquí, versionada junto al código que describe. Esa cercanía es el punto: cuando la PRD dice «máximo 5 MB por adjunto» y `SUPPORT_LIMITS.maxAttachmentBytes` dice lo mismo, ambas afirmaciones viajan en el mismo commit. Un documento fuera del repositorio se desincroniza el primer día que alguien cambia uno de los dos lados.

## Estructura

```
docs/prd/
  funcionales/   → Producto sin IA. Prefijo PRD-V-
  ia/            → Capacidades asistidas por IA. Prefijo PRD-VAI-
  albert/        → Vivaru redacta, Albert desarrolla. Prefijo PRD-A-
```

La separación no es cosmética. Una PRD de IA tiene que responder preguntas que una funcional no tiene: con qué datos se evalúa, cuánto cuesta cada ejecución, qué pasa cuando el modelo se equivoca, y quién confirma antes de que algo se guarde. Mezclarlas obligaría a arrastrar esas secciones vacías por todo el portafolio.

## Nomenclatura

| Carpeta | Formato | Tipos |
|---|---|---|
| `funcionales/` | `PRD-V-[TIPO]-NNN-[resultado].md` | `FEAT` · `FLOW` · `PLAT` · `OPS` · `FIX` |
| `ia/` | `PRD-VAI-[TIPO]-NNN-[resultado].md` | `FEAT` · `DOC` · `AGT` · `PRED` · `PLAT` |
| `albert/` | `PRD-A-[TIPO]-NNN-[resultado].md` | Los mismos de `funcionales/` |

La familia `albert/` existe por la decisión de los socios del 17 de agosto de 2026:
Albert es de Qintilab y **se adapta a las reglas de negocio de Vivaru vía PRDs que
Vivaru redacta**. Especifican trabajo en el repo de Albert, no en este — se versionan
aquí porque el contrato (estados, identidad cruzada, permisos) es la mitad de Vivaru
y tiene que viajar con su código. Expediente: `docs/albert-vivaru-integracion.md`.

Se nombra por resultado, no por pantalla: `tickets-soporte`, no `pantalla-tickets`. El número es correlativo dentro de su tipo y carpeta.

## Cómo se crean

Dos skills, una por carpeta:

```bash
/crear-prd-vivaru      # producto sin IA    → docs/prd/funcionales/
/crear-prd-ia-vivaru   # capacidades de IA  → docs/prd/ia/
```

Ambas empiezan por la misma puerta: **¿esto merece una PRD?** Un cambio de copy o un ajuste visual no la merece, y decirlo es parte del trabajo. La skill de IA añade una puerta previa propia: ¿la IA supera a una regla determinística? Si la respuesta es no, la PRD correcta es una funcional.

## Estado del portafolio

> **Qué significa «EN PRODUCCIÓN» en esta tabla, desde el 24 de agosto de 2026.** Significaba «el
> código está desplegado», y eso dejó marcar `FLOW-002` como productiva con **tres criterios de su
> propia ficha sin construir** —§9/CA13, `CF8` y `personId`—, uno de ellos de dinero. **La regla
> nueva: una PRD no se marca EN PRODUCCIÓN hasta que todos sus criterios están cumplidos o movidos
> explícitamente a Fase 2.** Y la columna de estado distingue **tres cosas que antes se leían
> igual**: (a) Fase 2 aplazada al escribir la ficha —la PRD está cerrada—, (b) MVP a medias, y
> (c) criterios del alcance entregado sin construir, que es la que no debería existir.
> **La categoría (c) quedó VACÍA la noche del 24**, al cerrar los tres de `FLOW-002`.
>
> **Y hay un cuarto estado que esta tabla no sabía decir: ENCENDIDA Y SIN DATO.** Tres fichas
> —`PLAT-001`, `PLAT-003` y `FEAT-003`— están desplegadas **y con su bandera encendida**, y aun así
> **no producían nada**, porque la tabla que alimentan estaba vacía en producción: `0` de `88`
> unidades con coeficiente, `0` proveedores, `0` cuentas del plan. Medido el 24 de agosto resolviendo
> las banderas con el código del servidor, no leyendo documentos. **El del plan de cuentas se cerró
> ese mismo día** sembrando los nueve; los otros dos no son ingeniería, son captura de datos.
> **Encender no es lo mismo que poner en uso**, y la columna de estado decía «apagada» de las tres,
> que era la época anterior.


### Funcionales

| PRD | Estado | Nota |
|---|---|---|
| [PRD-V-FEAT-001 — Tickets de soporte](funcionales/PRD-V-FEAT-001-tickets-soporte.md) | **Productiva** | Desplegada y verificada de punta a punta el 2026-08-01, correo incluido |
| [PRD-V-FEAT-002 — Importación de datos del conjunto](funcionales/PRD-V-FEAT-002-importacion-datos-conjunto.md) | **Productiva** (`registrarImportacion` desplegada en `hogaru-1`, comprobado el 2026-08-17) | Mapeo de columnas por nombre, contenido y variedad; catálogo único de campos; XLSX con selección de la hoja que mejor encaja; orden entre las dos cargas; y telemetría por pista. Construye el hueco donde entra `PRD-VAI-FEAT-001`. Sin decisiones abiertas |
| [PRD-V-PLAT-001 — Copropiedad: alícuota, expensa y responsable de la unidad](funcionales/PRD-V-PLAT-001-copropiedad-y-modelo-de-unidad.md) | **EN PRODUCCIÓN y ENCENDIDA** en los nueve conjuntos (25 ago 2026; resuelto con el código del servidor, no leyendo documentos) — MVP construido (`626e5f6`, 21 ago): campos en la unidad y su formulario, callable `generateCoefficientCampaign` con vista previa servida por el servidor (dryRun) y reparto por resto mayor (13 pruebas — COP en pesos enteros, MXN/USD en centavos), residente ve su coeficiente. **Encender NO la puso en uso: `0` de las `88` unidades de producción tienen coeficiente** (medido el 24 ago), así que la corrida por coeficiente no puede correr. Falta el DATO antes que la fase 2 (edición masiva, exenciones) | Primera de la tanda 1 del inventario de Habitanto. Añade coeficiente, expensa y responsable a la unidad, y la corrida de cobro por coeficiente. **Aditiva y reversible**: sin coeficiente, la corrida plana de hoy sigue igual. Cerradas: 6 decimales · responsable designado con propietario por defecto · **decimales por moneda** (`COP` 0, `MXN`/`USD` 2 — corregir `formatAmount` es la primera tarea del MVP y cambia el render de todos los importes en esas monedas). G5: **Vivaru no verifica escrituras**; el control es que la suma cuadre al 100% más la visibilidad del listado para el consejo |
| [PRD-V-PLAT-002 — Administradora: un administrador sobre varios conjuntos](funcionales/PRD-V-PLAT-002-administradora-multiconjunto.md) | **MVP COMPLETO Y EN PRODUCCIÓN** desde la tarde del 25 de agosto de 2026 (`e41affa`), verificado antes por navegador de punta a punta en staging (`dbb3f29`…`5894001`). Las **dieciocho** comparaciones del claim retiradas —la ficha decía once y la auditoría de agosto dejó vivas **las seis del dinero**, en `payments.ts` y `advances.ts`—, sesión con varias membresías, `lastActiveTenantId`, **selector**, la entidad `managementCompanies` con sus dos callables y `/superadmin/administradoras`. **Validado con una cuenta de seis conjuntos**: CA2, CA3, CA4, CA5, CA10, un **cobro real de $430.000 en el segundo conjunto** y la subida de un documento ahí. **En producción desde el 25 (tarde)**, con las cuatro piezas comprobadas contra su fuente —77 functions en `ACTIVE`, el ruleset vivo con **0 líneas de diff** contra el fichero, `storage.rules` sin tocar y el build del front identificado por su commit—. **`producto-multiconjunto` está APAGADA y su documento ni existe** (resuelve por `default_catalogo`): para encenderla, `seed-feature-flags.mjs` y después `mover-bandera.mjs` en GLOBAL. **CA1 sigue sin observarse** —haría falta otro administrador y no hay credenciales—: está cumplido por construcción, no visto. **Radio del cambio de autoridad: 0**, medido con el predicado real —id `{tenantId}_{uid}`, campo concordante, rol y estado— con `medir-radio-membresias.mjs`, no con el conteo laxo que había anotado. **Dos correcciones a la propia ficha:** §11.2 decía «once» y §11.3 decía «las reglas no necesitan un cambio» — **son DOS ficheros** y `storage.rules` iba por claim | Segunda de la tanda 1. **Lo que se aprendió y no estaba previsto:** las reglas entre servicios de Storage (`firestore.exists`) **no funcionan en el servicio real** — pasaron 59 pruebas de emulador falsadas en dos direcciones y **rompieron todas las subidas**; el emulador no es el servicio. Por eso el claim **vuelve a seguir** al conjunto activo (`switchActiveTenant` lo re-emite tras comprobar la membresía), con un precio conocido: **dos pestañas en conjuntos distintos se pisan**. §7.1 pedía una lectura que **no es expresable** en reglas, así que el registro se cerró al superadmin y el nombre se desnormaliza en `tenants`. Sin construir, y es Fase 2: la vista de cartera, que el residente vea su administradora. Si se construye, **necesita otro nombre**: «Cartera» ya es `/admin/billing` |
| [PRD-V-FLOW-001 — Prorrateo de un gasto entre las unidades](funcionales/PRD-V-FLOW-001-prorrateo-de-un-gasto-entre-unidades.md) | **Lista para desarrollo** (1.0, 21 ago 2026) — **secuencia: después de `PLAT-001`** | Tanda 2. Une egreso y cartera, que hoy **no se hablan**: no existe puente `Expense`→`BillingStatement`. Incluye **anular una corrida entera**, que hoy tampoco existe. **Bloqueada por `PRD-V-PLAT-001`**. Cerradas: concepto elegido de los siete existentes con `extraordinaria` por defecto (**sin ampliar `BillingConcept`**) · reparto a subconjunto fuera del MVP |
| [PRD-V-FLOW-002 — Anticipos y aplicación del pago a varios cargos](funcionales/PRD-V-FLOW-002-anticipos-y-aplicacion-del-pago.md) | **CERRADA ENTERA** (**1.6**, 24 ago 2026) — servidor y front, con `producto-anticipos` y `producto-pago-multiple` **encendidas globalmente en los nueve conjuntos**. **Ya no le queda ningún criterio propio sin cumplir:** los tres que faltaban se cerraron el 24 —`CF8` (`9f75083`), `§9/CA13` (`c05b274`) y **`personId` RETIRADO del contrato**—. Esta celda decía «encendida solo en el conjunto de demostración» y listaba los tres como pendientes. Lo único que la ficha ya no persigue es el total de anticipos del consejo, que vive en `PLAT-004` | Tanda 2. Tres defectos medidos en `functions/src/payments.ts`: **el sobrepago se evapora** (`balance = max(0, cobrado − pagado)`, y el excedente se contabiliza como ingreso sin dejar saldo a favor), **un pago solo aplica a un cargo**, y **el asiento se escribe con `bankAccountId: null` fijo**. El cambio de firma de `aplicarPago` es **aditivo** para no romper producción. Cerradas: el anticipo es ingreso del mes en que entra, **en su propia línea** · la imputación la decide la administración. **Lo que resuelve la 1.2:** (1) el asiento del anticipo lleva **`sourceType: "advance"` propio** para no heredar `"billingStatement"` de `aplicarPago` — y lo que sostiene la decisión no es ampliar el tipo, que es inerte, sino **el guardián que impide añadir `category === "anticipo"` a la exclusión**; (2) **el cruce no toca `paymentAmount`** sino un `advanceAppliedAmount` que solo escribe el servidor, de modo que `cuotaIncome` no puede ver el dinero del anticipo — lo que obliga a tocar el par de espejos `calcularSaldo` / `computeBalanceStatus` que la 1.1 daba por intocado, y deja el cruce fuera del alcance del cajón de edición manual, que hoy **sí** escribe `paymentAmount` desde el navegador; (3) el reverso **copia el `bankAccountId`** del asiento que anula, que es el **segundo de los dos**. Y entran **R15** (revertir con el anticipo todavía `open` dejaba vivo un saldo a favor de un dinero devuelto) y **R16** (el «% de recaudo» pasa a `amount − balance`, o el informe deja de mentir por un lado y empieza por el otro). **CA6 pasa a medir el total, no el mecanismo:** como estaba, habría pasado en verde con el estado financiero mal |
| [PRD-V-FEAT-003 — Registro de proveedores y beneficiarios](funcionales/PRD-V-FEAT-003-registro-de-proveedores.md) | **EN PRODUCCIÓN y ENCENDIDA** en los nueve conjuntos (25 ago 2026) — MVP construido (`996de59`, 21 ago): colección `vendors` con lectura solo de administración y `delete: if false` (5 pruebas de reglas), registro con datos bancarios y categoría por defecto, selector en el egreso con copia congelada. **Encendida y sin usar: `0` proveedores registrados en producción** (medido el 24 ago), así que el selector del egreso está vacío. Falta el DATO antes que la fase 2 (vincular egresos viejos, estado de cuenta por proveedor, descarga de soportes) | Tanda 3. Hoy **el proveedor no existe como entidad**: `Expense.vendorName` es texto libre y se reteclea en cada egreso. Añade registro, **datos bancarios**, categoría por defecto y estado de cuenta por proveedor. **Restricción dura**: los datos bancarios de un tercero no se muestran al residente nunca. Cerrada: un solo registro con `type` obligatorio; los de tipo `empleado` entran en la política de retención |
| [PRD-V-PLAT-003 — Plan de cuentas gobernado y el concepto que llega al libro](funcionales/PRD-V-PLAT-003-plan-de-cuentas-gobernado.md) | **EN PRODUCCIÓN y ENCENDIDAS** las dos en los nueve conjuntos (25 ago 2026) — entregas 1b y 2 COMPLETAS. 1b validada a mano por David con números; la entrega 2 son `accountCode` en cargo y egreso, el formulario del plan (validado a mano, 6/6), R9 con las etiquetas saliendo del plan, los ingresos por cuenta en el informe de comité y el aviso de R8. **Desplegada el 23 de agosto**, que es lo que desbloqueó `FLOW-002`. Dos decisiones nuevas cerradas: **D3** (la vigilancia son dos cuentas, `1.9` ingreso y `2.9` egreso) y **D4** (rango reservado: la semilla vive en `N.1`–`N.49`, el administrador crea de `N.50`). CA1 pasa a **18 cuentas con `systemKey` y 20 documentos**. **Producción estuvo con `0` cuentas hasta el 24 de agosto** —el plan **solo se siembra al CREAR un conjunto** y los nueve son anteriores a la funcionalidad—; **SEMBRADOS ese día** con `sembrar-plan-de-cuentas.mjs`: 21 cuentas en cada uno, **189 releídas**, cero colisiones. **CA1 pasa de «18 y 20» a `19` con `systemKey` y `21` documentos**: `FLOW-002` añadió `1.10 · Anticipos de residentes` y el criterio no se actualizó | Tanda 3. **La 1.1 corrige dos huecos hallados al leer el código antes de construir: la semilla de trece no cubría tres de los siete conceptos de cargo —`multa` incluida, que es el ejemplo de su propia métrica de éxito— y escribir la cuenta del concepto **duplicaba el ingreso**, porque la exclusión de `use-ledger.ts:220` mira `category === "alicuota"` y `cuotaIncome` ya suma todos los cargos. La exclusión pasa a mirar el origen del asiento. Dos problemas medidos: el vocabulario contable vive **en ocho ficheros** con dos mapas de etiquetas que ya discrepan, y **`aplicarPago`/`revertirPago` escriben `category: "alicuota"` fijo** (`payments.ts` 266 y 578) — una multa, una extraordinaria o un parqueadero se contabilizan todos como cuota de administración. **Habilita el consolidado entre conjuntos de `PLAT-002`.** Cerradas: código numérico jerárquico validado e inmutable una vez usado · plan por conjunto en el MVP. **Alcance movido**: la bitácora transversal de anulaciones pasa a Fase 2 de esta PRD y las notas de crédito/débito, al backlog |
| [PRD-V-FEAT-004 — Estado de cuenta de la unidad y certificado de paz y salvo](funcionales/PRD-V-FEAT-004-estado-de-cuenta-y-paz-y-salvo.md) | **Lista para desarrollo** (1.0, 21 ago 2026) | Tanda 4. Hay PDF de recibo (`recibo-pdf.ts`) y **ninguno de estado de cuenta**; «certificado» solo aparece en los textos legales, referido al borrado de datos. **La condición «saldo cero» se evalúa en el servidor**: es el ejemplo de libro de por qué existe la frontera cliente/callable. Cerrada: el residente emite el suyo; el interruptor por conjunto para restringirlo queda fuera del MVP |
| [PRD-V-FLOW-003 — Cobranza que llega: entrega medida y calendario del conjunto](funcionales/PRD-V-FLOW-003-cobranza-que-llega.md) | **Lista para desarrollo** (1.0, 21 ago 2026) — **el adjunto del estado de cuenta necesita `FEAT-004`** | Tanda 4. **El correo sale por la API de Resend sin webhook**: cero medición de entrega, rebotes y quejas. El calendario de cobranza está en el despliegue, no en manos del conjunto. **Corrige una suposición nuestra**: la bandeja de notificaciones en producto **ya existe** (colección `notifications`); lo que hay es un componente muerto con cuatro notificaciones inventadas, que se borra. Cerradas: ciclo mínimo de **7 días** (Habitanto permite 1) · «sin confirmar» a las 48 h · la lista de rebotes vive tras un **aviso persistente en el panel del administrador** |
| [PRD-V-FIX-001 — Las reglas de reserva se cumplen en el servidor](funcionales/PRD-V-FIX-001-reglas-de-reserva-en-servidor.md) | **MVP COMPLETO Y EN PRODUCCIÓN** (24 ago 2026) — entrega 1 (`20e4f28`) más los **pasos 3 y 4** (`a67088c`): bandera `producto-reservas-servidor` **ENCENDIDA en los nueve** y **la rama del residente RETIRADA del `create` de `reservations`**. Un residente ya no crea por escritura directa; el administrador conserva la suya y el residente sigue cancelando la propia. **La puerta de §13 se midió y se le dio contenido primero**: con la bandera recién encendida decía «abierta» sobre CERO reservas —ausencia, no evidencia—, así que se reservó desde el portal del residente en producción y pasó a `2 servidor · 0 admin · 0 residente`. **Sin vuelta atrás con bandera:** el rollback es redesplegar las reglas anteriores. Entrega 2 (política por área) sin empezar | Tanda 4. **Defecto encontrado leyendo el código:** la compuerta de morosos **ya existe** (`eligibility.ts`, con exención por unidad) pero **se comprueba solo en el cliente**, y `firestore.rules:558` no valida ni la mora ni los límites del área. **6 de 13 reglas se verifican en servidor.** No se arregla solo en reglas: seis exigen contar reservas y una regla de Firestore no cuenta. Cerrada: **entrega 1** = cumplimiento en servidor sin cambiar nada visible; **entrega 2** = política por área. Nunca en el mismo despliegue |

### Dónde va el portafolio (23 ago 2026)

**Trece PRD escritas y versionadas aquí**, más cuatro de IA que siguen en Drive.

| Carpeta | Escritas | Reparto |
|---|---|---|
| `funcionales/` | **11** | `FEAT` 4 · `FLOW` 3 · `PLAT` 3 · `FIX` 1 · `OPS` 0 |
| `ia/` | **1** versionada (+4 en Drive, sin migrar) | `FEAT` 1 |
| `albert/` | **1** | `OPS` 1 |

**Las once funcionales, por estado:** 2 productivas · **7 en producción** (`PLAT-001`,
`PLAT-003`, `FEAT-003`, `FIX-001`, `FLOW-002` y `PLAT-002` entero) · **7 en producción** contando `PLAT-002`, cuyo MVP subió el 25 de agosto (tarde) · 3 listas para desarrollo
sin empezar (`FLOW-001`, `FEAT-004`, `FLOW-003`).

**El plan de construcción son once pasos en tres olas. Van siete, y los siete están EN
PRODUCCIÓN y apagados** (23–24 ago 2026). Lo que falta ya no es desplegar: es **encender, de una
en una y mirando**. Queda `FLOW-001` de la ola B y la ola C entera.

**Lo que falta por ESCRIBIR**, que es otra pregunta:

| Qué | Por qué no está |
|---|---|
| **`PRD-V-PLAT-004` — Alcance del rol Consejo** | Candidato identificado en la revisión cruzada. **Ocho PRD le dan capacidades al consejo que hoy no puede alcanzar**: `canAccessPath` lo deja solo en `/admin/documents`. No bloquea a ninguna |
| **Cierre de conciliación** (D1–D4 del inventario, un P0) | En espera de disparador: no se construye hasta el primer mes con pagos reales |
| **Mora y pronto pago** | En espera de disparador: no se puede calibrar sin cartera real |
| **`REVOPS-000`** | Lo único que le falta a `PRD-A-OPS-001` para el canal asistido |
| Las cuatro PRD de IA que viven en Drive | Migrarlas a `ia/`. Mientras tanto su alcance no está versionado — justo lo que este README argumenta en su primera línea |

**Cobertura del inventario:** 108 candidatos en 14 categorías, 15 de ellos P0. El lote de nueve
PRD cubre los P0 salvo el cierre de conciliación, que está en espera a propósito.

### Orden de construcción del lote de Habitanto

Nueve PRD escritas entre el 21 de agosto de 2026, todas **listas para desarrollo**. Este es el
orden que se defiende, y **el orden importa más que ninguna de ellas por separado**: dos tocan la
misma función de producción y una no se puede revertir con una bandera.

#### Antes de nada — ✅ HECHO (`83aea4f`, 21 ago 2026)

**Corregir `formatAmount` por moneda** (`src/lib/currency.ts`): hoy formatea con cero decimales
para `COP`, `MXN` y `USD`, así que una expensa de `140,40` se muestra como `140` en Ecuador,
Panamá y México. Es la primera tarea del MVP de `PLAT-001` porque su regla de reparto redondea a
la unidad que el producto muestra. **Cambia el render de todos los importes en esas dos monedas**
— y con cero clientes reales es el momento más barato.

#### Ola A — sin dependencias

| # | PRD | Por qué aquí |
|---|---|---|
| 1 | **`PLAT-002` · auditoría de las callables** ✅ **en producción** (23 ago) — **pero eran DIECIOCHO, no once**: quedaron vivas las seis del dinero hasta el 25 ago (`dbb3f29`, **en producción** esa tarde) | Va **sola y primero**. Es el único cambio del lote que **no se revierte con una bandera** |
| 2 | **`FIX-001` · MVP completo** ✅ **en producción, bandera ENCENDIDA y regla CERRADA** (24 ago) | Corrección de una regla de negocio que hoy solo vive en el cliente. **No cambia nada visible** |
| 3 | **`PLAT-001` · copropiedad** ✅ **MVP en producción y ENCENDIDA** (25 ago) — pero **`0` de `88` unidades tienen coeficiente**, así que la corrida no puede correr | Base de la que dependen catorce candidatos |
| 4 | **`FEAT-003` · proveedores** ✅ **MVP en producción y ENCENDIDA** (25 ago) — pero **`0` proveedores registrados**, así que el selector está vacío | Independiente de todo lo demás |

#### Ola B — contabilidad

| # | PRD | Por qué en este orden |
|---|---|---|
| 5 | **`PLAT-003` · plan de cuentas** ✅ **en producción y ENCENDIDAS** las dos (25 ago) — pero **`0` cuentas sembradas en producción**: el plan solo se siembra al CREAR un conjunto | **Antes que `FLOW-002`.** Si va después, `FLOW-002` añade el valor `"anticipo"` a un enum que `PLAT-003` sustituye acto seguido |
| 6 | **`FLOW-002` · anticipos** ✅ **CERRADA ENTERA** (24 ago) | **PRD en v1.6.** Las dos banderas encendidas globalmente. **Ya no le falta ningún criterio propio**: `CF8` y `§9/CA13` construidos, `personId` retirado del contrato |
| 7 | **`FLOW-001` · prorrateo** | Necesita `PLAT-001`, **que ya está en producción: es lo único que queda de esta ola** |

> **`PLAT-003` y `FLOW-002` modifican la misma función: `aplicarPago`, que está en producción y
> mueve dinero.** `PLAT-003` cambia **qué valor** escribe en la categoría; `FLOW-002` cambia **su
> firma**. **No pueden estar en vuelo a la vez.**
>
> **Estado al 24 de agosto de 2026: las DOS aterrizaron, y las dos están ENCENDIDAS.** `PLAT-003`
> entró el 23 y `FLOW-002` el 24; las banderas se encendieron globalmente el 25, así que **no queda
> nada en vuelo sobre `aplicarPago`**. Esta nota decía «con sus banderas apagadas». Se conserva la regla —no pueden estar en vuelo a la vez— porque vuelve a
> aplicar en cuanto haya una tercera PRD sobre la misma función.

#### Ola C — lo que se ve

| # | PRD |
|---|---|
| 8 | **`FEAT-004` · estado de cuenta y paz y salvo** — después de `FLOW-002`, para que el documento sepa mostrar el saldo a favor |
| 9 | **`FLOW-003` · cobranza que llega** — su adjunto necesita el 8 |
| ~~10~~ | ~~**`PLAT-002` · entrega 2**~~ ✅ **HECHA y EN PRODUCCIÓN** (25 ago, tarde). La **vista** de cartera no entraba: el Story Map la sitúa en Fase 2 |
| 11 | **`FIX-001` · entrega 2** — política de reserva por área |

#### En espera de disparador

**No se construyen hasta el primer mes con pagos reales**, por decisión del 21 de agosto:

- **Cierre de conciliación** — depósitos en tránsito, cheques no cobrados y resumen de saldos.
  Vivaru ya tiene el casado línea a línea; le falta el cierre. **Se beneficia del
  `bankAccountId` que aporta `FLOW-002`.**
- **Mora y pronto pago** — el recargo **no lo tiene ninguna de las dos plataformas**. Es ventaja
  que ganar, y no se puede calibrar sin cartera real.

#### Solapamientos declarados

| Entre | Qué |
|---|---|
| `PLAT-001` y `FEAT-003` ↔ `FEAT-002` | Sus campos nuevos **extienden el catálogo del importador que ya existe**. Ninguna construye un segundo importador |
| `PLAT-001` ↔ `FLOW-001` | Comparten la regla de reparto del residuo por resto mayor. **Se define una vez, en `PLAT-001` R6** |
| `FLOW-002` ↔ cierre de conciliación | `FLOW-002` corrige `bankAccountId: null`, que aquella necesitará |
| `PLAT-003` ↔ `PLAT-002` | El consolidado entre conjuntos **solo es correcto con códigos gobernados** |

#### Revisión cruzada de las nueve — 21 ago 2026

Antes de construir nada se cotejaron las nueve entre sí y contra el código, buscando
**contradicciones**, no erratas. **Salieron cinco.** Cuatro están corregidas; la quinta es de
portafolio y está marcada en las PRD afectadas.

| # | Hallazgo | Estado |
|---|---|---|
| 1 | **`FLOW-003` decía que Comunicaciones está `limitado` en prueba.** `TRIAL_MODULE_ACCESS` dice **`libre`** — el `limitado` es Documentos, por almacenamiento. Y la «cuota de correo a terceros» que mencionaba **no existe**: no hay nada de eso ni en `email.ts` ni en `trial-modules.ts` | **Corregido** |
| 2 | **`PLAT-002` decía que `managementCompanies` sería la primera colección sin `tenantId`.** No lo es: `tenants`, `users`, `plans` y `featureFlags` tampoco lo llevan. Sí es la primera que **agrupa conjuntos** | **Corregido** |
| 3 | **`PLAT-003` decía «ocho ficheros».** Son **seis ficheros distintos**, con ocho apariciones entre los dos vocabularios | **Corregido** |
| 4 | **El acoplamiento `PLAT-003` ↔ `FLOW-002` vivía solo aquí, en el índice.** Las dos modifican `aplicarPago` y no pueden estar en vuelo a la vez. **Una dependencia que solo vive en el índice es una dependencia que alguien se salta** | **Declarada en el encabezado de las dos** |
| 5 | **El rol `committee` no puede llegar a lo que ocho PRD le asignan.** `canAccessPath` (`src/lib/auth/routing.ts:28`) lo deja **solo en `/admin/documents`**. A nivel de reglas **sí puede leer** —es miembro del conjunto— así que **el bloqueo es de navegación, no de permisos** | **Marcado en las ocho.** Ver abajo |

##### El hallazgo 5 merece PRD propia

Ocho PRD dan al consejo capacidades de consulta —coeficientes, plan de cuentas, proveedores,
estados de cuenta, entregabilidad— que **hoy son intención declarada, no capacidad disponible**.

Ampliarlo no es cambiar una línea de `routing.ts`: hay que **decidir qué pantallas ve** y
**comprobar que las reglas no le abran datos personales por el camino** — muchas colecciones
tienen `allow read: sameTenant(...)`, y el consejo es miembro del conjunto.

**Candidato: `PRD-V-PLAT-004 — Alcance del rol Consejo`.** No bloquea a ninguna de las nueve:
todas funcionan sin la fila del consejo.

##### Lo que se cotejó y salió consistente

- **La regla de reparto del residuo se define una sola vez**, en `PLAT-001` R6; `FLOW-001` la
  referencia en vez de repetirla.
- **La frontera cliente/callable** no se contradice entre PRD.
- **Sin colisiones de identificador** con `FEAT-001` y `FEAT-002`.
- Los niveles de prueba de **Cartera, Finanzas y Reservas** están bien citados en las siete PRD
  que los mencionan.

#### Dos correcciones que este lote produjo

Escribir las PRD obligó a leer el código, y eso **anuló dos huecos** del inventario: la
**compuerta de morosos en reservas** y la **bandeja de notificaciones en producto** **ya
existen**. Están corregidos en `candidatos-prd-desde-habitanto.md`.

### Albert

| PRD | Estado | Nota |
|---|---|---|
| [PRD-A-OPS-001 — Vista de Leads de Vivaru](albert/PRD-A-OPS-001-vista-de-leads-vivaru.md) | **Borrador 0.3 — NO lista para desarrollo** | **Bisagra decidida: Vivaru es un tenant de Albert.** Con eso el vocabulario de estados pasa a ser configuración en vez de desarrollo. La ficha técnica de Albert corrigió dos supuestos —«convertido» vive en el pipeline de deals, no en `leads`; y `crmRef` necesita estructura porque un deal vive bajo su tenant—. El §5 de inbound ya está escrito (el lead cruza **al asignarle dueño**, no al entrar). **Solo falta `REVOPS-000`** para el flujo del canal asistido |
| [CONSULTA-A-001 — Qué necesita Vivaru de Albert](albert/CONSULTA-A-001-preguntas-para-albert.md) | **RESPONDIDA** el 19 ago 2026 — ver `RESPUESTA-A-001` | Su *Análisis detallado* del 19 amplía la ficha del 18 pero **no responde a esta consulta**: cierra A3 y A4 y no toca el bloque B. La 0.2 marca esas dos como resueltas, **corrige una premisa nuestra** —dijimos que la decisión de ser tenant dependía de que `wonDealStage` fuera por tenant; no se cae, solo cuesta que los terminales se llamen «Ganado»/«Perdido»— y **baja C1 y C2** de prioridad, porque su propio análisis dice que siendo tenant el trigger es opcional y OIDC innecesario. **A1 es ahora el único bloqueo total**: `dealSchema` es un Zod cerrado y el `vivaruLeadId` no tiene dónde ir |
| [RESPUESTA-A-001 — Albert → Vivaru](albert/RESPUESTA-A-001-albert-a-vivaru.md) | **Recibida** (19 ago 2026) | Contesta las trece preguntas con cita a `archivo:línea` de su repositorio, separando hecho de código de decisión de producto. **A1 se desbloquea construyendo**: su `dealSchema` es cerrado y sella dos veces, tal como habíamos diagnosticado. Confirma seis ausencias en su producto y **cae un supuesto nuestro: los límites de plan no se aplican**. Deja seis decisiones en nuestro tejado |
| [DECISIONES-A-001 — Vivaru → Albert](albert/DECISIONES-A-001-vivaru-a-albert.md) | **ENVIADA** (19 ago 2026) | Cierra las seis decisiones. Y abre con **dos contradicciones de su propia respuesta**: `consent` aparece en el deal (A1) y recomendado en el contacto (B2), y su propio A3 permite deals sin contacto — que con B2 dejaría el consentimiento sin sitio. Se resuelve eligiendo el contacto y **comprometiéndonos a crear siempre contacto**. La **N de retención queda como propuesta, no como compromiso**: Vivaru tampoco tiene política escrita. Les pedimos una fecha para A1, no un tamaño |

### IA

**Este párrafo decía, hasta el 14 de agosto de 2026, que no había «una sola línea de IA en el código» y que el programa estaba en Fase 0. Dejó de ser cierto y nadie lo actualizó.** Hoy existen el gateway (`functions/src/ai/gateway.ts`), la telemetría (`aiUsage`), las cuotas, el adaptador real de Vertex, el registro de feedback (`aiFeedback`) y el contexto del conjunto — **en producción desde el 15 de agosto de 2026**. El canario de comunicaciones está construido y probado con dos administradores reales.

**Y desde el 17 de agosto dejaron de estar inertes:** `ai-gateway`, `ai-pqrs-shadow` e `ia-proveedor-real` están **encendidas en producción**, con el modo sombra de PQRS clasificando en silencio. Las banderas de las capacidades visibles siguen apagadas, así que ningún usuario ve nada. El límite ya no es técnico: **producción no tiene ni un conjunto real** — los nueve son pruebas, corregido el 18 de agosto de 2026. No es que los clientes no generen tickets; es que no hay clientes.

El estado paso a paso vive en `docs/hoja-de-ruta-ia.md`; el índice de lo pendiente, en `docs/pendientes.md`. El cotejo contra el código, en `docs/auditoria-prd-ia-ago2026.md`.

| PRD | Estado |
|---|---|
| `PRD-VAI-PLAT-001` — Gateway, auditoría y cuotas | Implementada. **En producción desde el 15 ago 2026**, inerte tras banderas |
| `PRD-VAI-FEAT-003` — Asistente de comunicaciones | Implementada, probada con dos administradores. **En producción, banderas apagadas.** Falta la línea base H2′ (tercer administrador) |
| [PRD-VAI-FEAT-002 — Asistente de PQRS](ia/PRD-VAI-FEAT-002-asistente-pqrs.md) | **F1–F3 hechas y F4 en producción** (17 ago 2026). Gold set de 152 casos, evaluación offline corrida, piloto con un administrador, y modo sombra desplegado y encendido en `hogaru-1`. Falta F5 (escala), que depende de que existan tickets reales. Las dos puertas de G7 y el criterio de afirmaciones de §9 tienen decisión firmada dentro |
| `PRD-VAI-FEAT-001` — Onboarding asistido | En espera. Su primera mitad **no necesita IA** y es `PRD-V-FEAT-002` (productiva) |
| `PRD-VAI-DOC-001` — Lectura de comprobantes | Bloqueada por falta de comprobantes reales. No se sintetiza |

Las otras cuatro siguen viviendo fuera del repositorio (Drive). Migrarlas a `ia/` sigue pendiente; hasta entonces la fuente de verdad de su alcance es Drive, con el costo de versionado que eso implica — que es exactamente lo que este README argumenta en su primera línea. Para `FEAT-002`, desde el 15 de agosto, **la fuente de verdad es el repo** y la copia de Drive queda como lectura.

## Documentos que gobiernan el programa de IA

No son PRD —son el marco que las ordena— y hoy viven fuera del repositorio, en `/Users/david/Claude Coworker/Hogaru/GPT/`:

- **`Estrategia_IA_Minima_Viable_Vivaru.md`** — la decisión ejecutiva: dos capacidades externas durante 12 meses (un modelo generativo económico y OCR documental), y el techo de costo de 2–3% del ingreso por conjunto.
- **`Plan_General_Implementacion_IA_Vivaru.md`** — el plan maestro: fases 0–6, puertas G0–G7, matriz de dependencias y backlog ejecutivo.

Esa carpeta no es un repositorio git, así que estos dos documentos no tienen historial de versiones. Conviene traerlos.

Resumen de ambos en la wiki: [[programa-ia]].

## Reglas del portafolio

1. Una PRD describe **resultado y reglas**, no implementación — salvo en su sección de arquitectura, que existe justamente para decidir eso.
2. Todo rol declara qué puede **y qué no**. La columna de lo prohibido es la que evita los agujeros.
3. Todo estado tiene dueño y transición de salida. Un estado sin dueño se atasca.
4. Los criterios de aceptación incluyen **los casos que deben fallar**.
5. Un `TBD` lleva la pregunta mínima que lo cierra. Un `TBD` sin pregunta es una decisión aplazada disfrazada de documento.
6. Cuando la implementación contradiga a la PRD, **gana la implementación** — y la PRD se corrige en el mismo commit.

La regla 6 es la que mantiene esto vivo. Una PRD que describe algo que ya no es cierto es peor que no tenerla, porque alguien la va a creer.
