# PRD-V-PLAT-002 — Administradora: un administrador sobre varios conjuntos

| | |
|---|---|
| **ID** | `PRD-V-PLAT-002` (tentativo hasta registrarlo en `docs/prd/README.md`) |
| **Tipo** | `PLAT` — capacidad transversal: identidad, sesión, permisos y ciclo de vida del conjunto |
| **Portales** | **`ADMIN`** (alcance) · **`SUPERADMIN`** (alcance: alta y gestión de la administradora) · `RESIDENTE` (afectado: ve quién administra su conjunto) · `PORTERIA` (no afectado) |
| **Módulo** | Plataforma · Identidad y acceso |
| **Usuario principal** | `tenant_admin` / `admin_tenant` que lleva más de un conjunto |
| **Usuarios secundarios** | `superadmin` · `resident` |
| **Responsable** | David |
| **Estado** | **EN STAGING, validada en pantalla** — versión 1.1 (25 ago 2026). §11.2 completa (eran **dieciocho** sitios, no once) · sesión con varias membresías, `lastActiveTenantId` y **selector** construidos y verificados por navegador con una cuenta de seis conjuntos: CA2, CA3, CA4, CA5, CA10 y **un cobro real en el segundo conjunto**. **Falta el paso 3** (entidad `managementCompanies` y sus dos callables) y **queda una medición abierta sobre `storage.rules`** — ver §11.3 y la cabecera de `docs/pendientes.md`. **En producción NO hay nada de esto** y la bandera está apagada |
| **Dependencias** | **Ninguna para el MVP.** La consolidación financiera depende del plan de cuentas gobernado (§4) |
| **Riesgo** | **Alto.** Toca la resolución de identidad. Un error aquí es un error de permisos |
| **Reversibilidad** | **Parcial.** El selector y la entidad son reversibles; el cambio en las once callables de §11.2 **no se revierte apagando una bandera** |
| **Fase comercial** | Decisión de David del 21 de agosto de 2026: **Vivaru se vende a conjuntos sueltos y a empresas administradoras.** Ambas rutas deben convivir |

---

## 1. Resumen ejecutivo

Vivaru asume hoy que **una persona pertenece a un conjunto**. Una empresa administradora que
lleva quince edificios necesitaría quince cuentas y quince contraseñas, y no tendría ninguna
vista de su cartera.

Esta PRD añade la **empresa administradora** como entidad por encima del conjunto, permite que
un mismo administrador **cambie de conjunto sin cerrar sesión**, y le da una **vista de su
cartera**.

El hallazgo que la abarata: **el almacenamiento y las reglas de Firestore ya lo soportan.** La
membresía ya es un documento por pareja conjunto-usuario, y las reglas resuelven permisos
leyendo ese documento, no el token. **Lo que no lo soporta es la sesión y once Cloud Functions.**

## 2. Problema y baseline

### Lo que ya funciona, verificado en el código

| Qué | Dónde | Consecuencia |
|---|---|---|
| Membresía por pareja | `tenantUsers/{tenantId}_{uid}` (`firestore.rules:12`) | **Un usuario ya puede ser miembro de N conjuntos.** No hace falta cambiar el almacenamiento |
| Las reglas resuelven por membresía | `tenantMember()`, `tenantRole()`, `sameTenant()` en `firestore.rules:16-39` | **Las reglas no requieren un solo cambio** |
| El único claim que usan las reglas | `request.auth.token.role == 'superadmin'` (`firestore.rules:9`) | El claim `tenantId` **no gobierna ningún permiso de Firestore** |

### Lo que lo impide

| # | Obstáculo | Dónde |
|---|---|---|
| **O1** | La sesión resuelve **un solo** `tenantId`: claim → `users/{uid}.tenantId` → documento de membresía | `src/features/auth/auth-context.tsx:162-266` |
| **O2** | `SessionUser.tenantId` es un campo único, no una lista | `src/types/domain.ts:74` |
| **O3** | Un `tenant_admin` sin `tenantId` lanza error: «Perfil incompleto» | `auth-context.tsx:298` |
| **O4** | **Once callables comparan el conjunto pedido contra el claim del token y deniegan si difiere** | `functions/src/index.ts` líneas 1349, 1490, 1589, 1674, 1749, 1796, 1913, 1928, 1963, 1993, 2036 |
| **O5** | No existe ninguna entidad por encima de `tenants` | `src/types/domain.ts:22` |

**O4 es el bloqueo duro.** El patrón es:

```
const tokenTenantId = normalizeText(request.auth.token?.tenantId);
if (tokenTenantId && tokenTenantId !== data.tenantId) { throw permission-denied }
const actor = await assertActiveTenantAdmin(data.tenantId, request.auth.uid);
```

Un administrador con claim `tenantId = A` que opere sobre el conjunto B **sería rechazado
aunque sea miembro legítimo de B**.

### Baseline medible

| Indicador | Hoy |
|---|---|
| Administradores con más de un conjunto | **0** — el producto no lo permite |
| Cuentas necesarias para llevar 15 conjuntos | **15** |
| Vistas de cartera de una administradora | **Ninguna** |

**Referencia de mercado, medida en el inventario:** la cuenta de administradora que exploramos
en Habitanto lleva **16 condominios** en una sola sesión, con buscador para saltar entre ellos.

**Métrica de éxito:** que una persona con N membresías entre una vez y opere los N conjuntos
sin volver a autenticarse, y que **ninguna operación cruce datos entre conjuntos** (§10, CF).

## 3. Usuarios, roles y permisos

**Esta PRD no crea ningún rol nuevo.** Es una decisión, y la más importante del diseño: una
administradora no es un rol, es **un `tenant_admin` con varias membresías**. Añadir un rol
obligaría a tocar `roles.ts`, las reglas y las once callables por segunda vez.

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| `tenant_admin` con **una** membresía | Exactamente lo de hoy | Lo de hoy | **Nada cambia para él.** No ve selector ni cartera |
| `tenant_admin` con **varias** membresías | Selector de conjunto y vista de cartera de los conjuntos en los que es miembro | Cambiar de conjunto activo; operar cada uno con sus propios permisos | Ver o tocar un conjunto donde **no** tenga documento de membresía. Operar un conjunto `suspended` o `expired` |
| `resident` | El nombre de la administradora de **su** conjunto | Consultarlo | Todo lo demás de esta PRD. **Un residente con dos unidades en dos conjuntos queda fuera de alcance (§4)** |
| `security_guard` | Nada | — | Acceder al selector |
| `superadmin` | Todas las administradoras y todos los conjuntos | Crear administradoras, asociar conjuntos, asignar y quitar membresías | — |

**La regla que lo hace seguro:** el conjunto activo lo elige el cliente, pero **la autoridad
sigue siendo el documento de membresía**. Si el cliente pide un conjunto del que no es miembro,
las reglas de Firestore lo deniegan sin que nadie tenga que programar la comprobación.

## 4. Objetivo, alcance y exclusiones

**Objetivo.** Que una empresa administradora opere su cartera desde una sola cuenta, sin que un
conjunto pueda ver los datos de otro.

### Entra

1. Entidad **empresa administradora**: nombre, identificación fiscal, país y contacto.
2. Asociación `conjunto → administradora`.
3. Sesión con **varias membresías** y un **conjunto activo**.
4. **Selector de conjunto** para quien tenga más de uno.
5. Corrección de las **once callables** de O4.
6. **Vista de cartera**: los conjuntos del administrador con indicadores operativos.
7. Alta y gestión de administradoras desde la consola de superadmin.
8. El residente ve qué empresa administra su conjunto.

### No entra, y por qué

| Excluido | Por qué |
|---|---|
| **Rol nuevo de «administrador de cartera»** | §3. Un rol nuevo multiplicaría el trabajo en reglas y callables |
| **Consolidado financiero entre conjuntos** | **Depende del plan de cuentas gobernado.** Consolidar sobre códigos de rubro libres da sumas falsas — es exactamente el defecto que Habitanto arrastra. La cartera de esta PRD lleva indicadores **operativos**, no un estado financiero consolidado |
| **Correo remitente propio por conjunto** (`M5` del backlog) | Exige verificar dominios por conjunto con el proveedor de correo: es una decisión de infraestructura, no del modelo de acceso. **PRD aparte** |
| **Residente con unidades en dos conjuntos** | Caso real pero distinto: el residente elige unidad, no conjunto. Se resuelve después y no bloquea esto |
| **Facturar a la administradora en vez de al conjunto** | Modelo comercial, no producto. Hoy el plan vive en `Tenant.planId` y ahí se queda |
| **Jerarquía de más de dos niveles** | Nadie la ha pedido. Administradora → conjunto y nada más |

## 5. Flujo funcional

### 5.1 Entrar con varias membresías

```mermaid
flowchart TD
    A[Inicia sesión] --> B[Se leen sus documentos de membresía]
    B --> C{¿Cuántas?}
    C -->|Ninguna y no es superadmin| D[Error de perfil incompleto · comportamiento actual]
    C -->|Una| E[Entra directo · IDÉNTICO a hoy]
    C -->|Varias| F{¿Hay último conjunto usado y sigue siendo miembro?}
    F -->|Sí| G[Entra en ese conjunto]
    F -->|No| H[Pantalla de selección de conjunto]
    G --> I[Barra superior muestra el conjunto activo y permite cambiarlo]
    H --> I
```

**Quien tiene una sola membresía no ve absolutamente nada nuevo.** Es la condición para que
esta PRD no rompa a los usuarios actuales.

### 5.2 Cambiar de conjunto

```mermaid
flowchart TD
    A[Pulsa el conjunto activo] --> B[Buscador de sus conjuntos]
    B --> C[Elige uno]
    C --> D{¿Sigue siendo miembro?}
    D -->|No| E[Aviso y vuelta al selector · la membresía pudo revocarse]
    D -->|Sí| F[Se limpia el estado del conjunto anterior]
    F --> G[Se recarga el contexto en el conjunto nuevo]
    G --> H[Queda registrado el cambio]
```

**«Se limpia el estado del conjunto anterior» no es un detalle de implementación: es la regla
de seguridad.** Cualquier dato en memoria del conjunto A que sobreviva al cambio a B es una
fuga.

### 5.3 Casos límite

| Caso | Comportamiento |
|---|---|
| Le revocan la membresía mientras opera | La siguiente operación es denegada por las reglas; se le devuelve al selector |
| Su único conjunto queda `suspended` | Entra en solo lectura, como hoy |
| Uno de sus conjuntos está `suspended` y otro `active` | Cada uno se comporta según su propio estado. **El estado no se hereda de la administradora** |
| Uno está en `trial` y otro `active` | Igual: la matriz de prueba se evalúa por conjunto |
| Un conjunto sin administradora asociada | Funciona exactamente como hoy. **La asociación es opcional** |
| Superadmin operando | Ve todos los conjuntos; su acceso no pasa por membresías |

## 6. Estados y transiciones

### Empresa administradora

| Estado | Qué significa | Quién transiciona | Salida |
|---|---|---|---|
| **`active`** | Opera con normalidad | Superadmin | → `inactive` |
| **`inactive`** | Registro conservado, sin conjuntos nuevos | Superadmin | → `active` |

**`inactive` NO suspende sus conjuntos.** Cada conjunto conserva su propio `TenantStatus`.
Mezclarlos permitiría cortarle el servicio a un conjunto que paga por un problema comercial de
su administradora — **y el cliente de ese conjunto no es la administradora**.

### Membresía

| Estado | Quién transiciona | Salida |
|---|---|---|
| **Existe** | Superadmin o el administrador del conjunto | Se revoca borrando el documento |
| **No existe** | — | Se crea al asignar |

**No se añade un campo de estado a la membresía.** Existe o no existe: es lo que las reglas ya
evalúan con `exists()`.

## 7. Contrato de datos y multi-tenancy

### 7.1 Colección nueva: `managementCompanies`

| Campo | Tipo | Obligatorio | Quién escribe |
|---|---|---|---|
| `id` | `string` | Sí | Sistema |
| `name` | `string` | Sí | Superadmin |
| `taxId` | `string` | No | Superadmin |
| `country` | `string` | Sí | Superadmin |
| `contactEmail` | `string` | No | Superadmin |
| `contactPhone` | `string` | No | Superadmin |
| `status` | `"active" \| "inactive"` | Sí | Superadmin |
| `createdAt` / `updatedAt` / `createdBy` | — | Sí | Sistema |

**Esta colección NO lleva `tenantId`**, porque vive por encima del conjunto. **No es la primera
sin `tenantId`** —`tenants`, `users`, `plans` y `featureFlags` tampoco lo llevan— pero **sí es la
primera que agrupa conjuntos**, y por eso su regla no se parece a ninguna de las existentes. Su regla es **lectura para los miembros de un conjunto asociado, escritura
solo para superadmin**. Debe declararse explícitamente y no puede caer en
`relaxedTenantCollection` (`firestore.rules:80`).

### 7.2 Campo nuevo en `tenants`

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `managementCompanyId` | `string` | **No** | Ausente = conjunto suelto. **Sin migración: los 9 conjuntos actuales siguen igual** |

### 7.3 Campo nuevo en `users`

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `lastActiveTenantId` | `string` | No | Comodidad, **no autoridad**. Si el usuario ya no es miembro, se ignora |

### 7.4 El claim `tenantId`

**Se conserva y deja de ser autoridad.** Hoy se escribe en `setCustomUserClaims` en once
sitios. Seguirá escribiéndose para no romper nada, pero pasa a significar **«el último conjunto
conocido»**, no «el único conjunto permitido».

**La autoridad es, y sigue siendo, el documento de membresía.** Es lo que ya hacen las reglas.

### 7.5 Multi-tenancy

- Ninguna consulta de datos de conjunto cambia: **siguen filtrando por `tenantId`**, ahora por
  el conjunto **activo**.
- **`suspended` / `expired`** → solo lectura, por conjunto, sin herencia de la administradora.
- **`trial`** → la matriz de módulos en prueba se evalúa **por conjunto activo**. Una
  administradora puede tener uno en prueba y otro contratado a la vez.

### 7.6 Retención y borrado

`managementCompanies` guarda datos de una empresa, no de personas: **fuera de la política de
retención de 12 meses**. `contactEmail` y `contactPhone` son datos de contacto profesional y se
borran al borrar la administradora.

## 8. Reglas de negocio

| # | Regla |
|---|---|
| **R1** | La autoridad sobre qué conjuntos puede operar un usuario es **el conjunto de sus documentos de membresía**, nunca el claim del token |
| **R2** | Un usuario con **una** membresía tiene exactamente el comportamiento de hoy: sin selector, sin cartera |
| **R3** | Al cambiar de conjunto activo, **todo estado del conjunto anterior se descarta** antes de cargar el nuevo |
| **R4** | El estado de la administradora **no altera** el `TenantStatus` de sus conjuntos |
| **R5** | Un conjunto pertenece **a lo sumo a una** administradora |
| **R6** | Asociar o desasociar un conjunto a una administradora **no crea ni borra membresías** de usuarios: son ejes independientes |
| **R7** | La vista de cartera lista **solo** los conjuntos donde el usuario tiene membresía, aunque la administradora tenga más |
| **R8** | Cada cambio de conjunto activo queda registrado con usuario, origen, destino y fecha |
| **R9** | Ninguna callable acepta un `tenantId` que no esté respaldado por una membresía del llamante |

**R7 es la que separa lo comercial de lo operativo:** la administradora puede tener 16
conjuntos y un asistente suyo tener acceso solo a 3.

## 9. Notificaciones y correo

**No se crean notificaciones nuevas.** El correo transaccional sigue saliendo por
`functions/src/email.ts` con el remitente verificado, y **sigue siendo por conjunto**: un aviso
al residente nombra su conjunto, no su administradora.

Un cambio de contenido menor: donde hoy el correo dice el nombre del conjunto, **puede añadir la
administradora** si el conjunto la tiene. Opcional, no bloqueante.

**No se promete ningún plazo de respuesta.**

## 10. Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| CA1 | Un usuario con una sola membresía entra y **no ve selector ni cartera**: el flujo es idéntico al de hoy |
| CA2 | Un usuario con tres membresías ve el selector con sus tres conjuntos |
| CA3 | Cambia de conjunto y la Cartera, los Residentes y los Egresos muestran los del conjunto nuevo |
| CA4 | Tras cambiar, **ninguna pantalla muestra un dato del conjunto anterior** |
| CA5 | Vuelve a entrar y aterriza en el último conjunto usado |
| CA6 | Si le revocaron la membresía del último usado, aterriza en el selector sin error |
| CA7 | Superadmin crea una administradora, le asocia dos conjuntos y los ve asociados |
| CA8 | Un conjunto sin administradora funciona exactamente igual que antes |
| CA9 | Una administradora `inactive` **no cambia** el estado de sus conjuntos |
| CA10 | Con un conjunto `active` y otro `suspended`, el primero se opera y el segundo es solo lectura |
| CA11 | Las once callables de O4 aceptan la operación sobre cualquier conjunto donde el llamante es miembro |
| CA12 | El residente ve el nombre de la administradora de su conjunto |

### Deben fallar

| # | Criterio |
|---|---|
| CF1 | Pedir el conjunto B sin membresía en B → **denegado por reglas**, no por la interfaz |
| CF2 | Una callable llamada con `tenantId` de un conjunto sin membresía → **`permission-denied`** |
| CF3 | Manipular `lastActiveTenantId` a un conjunto ajeno → **no da ningún acceso** |
| CF4 | Un guarda intenta abrir el selector → **denegado** |
| CF5 | Un `tenant_admin` intenta crear o editar una administradora → **denegado** |
| CF6 | Operar en un conjunto `suspended` desde el selector → **denegado** |
| CF7 | Asociar un conjunto a una segunda administradora → **rechazado** (R5) |
| CF8 | Una consulta sin `where("tenantId")` tras cambiar de conjunto → **denegada entera** |

**CF1 y CF3 son los dos criterios que prueban que el diseño es seguro:** el cliente elige el
conjunto activo, y elegir mal no da acceso a nada.

## 11. Arquitectura y dependencias

### 11.1 La decisión obligatoria: cliente directo o callable

| Operación | Decisión | Por qué |
|---|---|---|
| **Leer las membresías propias** | **Cliente directo** | Consulta a `tenantUsers` por `uid`. Las reglas la protegen |
| **Cambiar el conjunto activo** | **Cliente directo** | No es una operación de servidor: es estado de sesión. **La seguridad no depende de dónde se elige, sino de que las reglas verifiquen la membresía en cada lectura** |
| **Crear o editar una administradora** | **Cloud Function callable** | Escribe en una colección **sin `tenantId`**, fuera del modelo que las reglas saben proteger por conjunto. Solo superadmin |
| **Asociar un conjunto a una administradora** | **Cloud Function callable** | Escribe en `tenants`, que gobierna facturación y ciclo de vida. No puede quedar en el cliente |
| **Indicadores de la vista de cartera** | **Cliente directo, N consultas** | Una por conjunto, cada una filtrando su `tenantId`. Sin agregación de servidor en el MVP |

### 11.2 El cambio que no es reversible con una bandera

Las comparaciones de O4 deben pasar de *«el conjunto pedido debe ser igual al del token»* a
*«el llamante debe ser miembro del conjunto pedido»*.

> **CORRECCIÓN (25 ago 2026): eran DIECIOCHO, no once.** Esta sección decía «las once» y listaba
> líneas de `index.ts`, así que la auditoría de `5219758` buscó ahí y retiró **doce**. Quedaron
> **seis** haciendo lo mismo en `functions/src/payments.ts:378` (`assertPuedeCobrar`) y
> `functions/src/advances.ts:112` (`assertPuedeOperarAnticipos`) — **las seis del dinero**:
> `applyPayment`, `revertPayment`, `previewPaymentAllocation`, `applyAdvance`,
> `undoAdvanceApplication` y `cancelAdvance`.
>
> Y eran **más duras** que las retiradas: aquellas decían `if (claim && claim !== pedido)` —
> inertes sin claim—; estas, `claim !== pedido` a secas.
>
> **El alcance de una auditoría se define por PATRÓN, no por fichero.** El grep bueno no era «las
> líneas que cita la ficha», era `grep -rn "tokenTenant" functions/src`. Cerrado en `dbb3f29`.

En el sitio revisado (`index.ts:1349`) la comprobación de membresía **ya existe justo después**
(`assertActiveTenantAdmin`), así que la guarda del claim es redundante y puede retirarse sin
perder seguridad. **Hay que verificar sitio por sitio que esa comprobación existe**, y añadirla
donde no.

> **Y en las seis del dinero NO existía.** La comparación con el claim era lo ÚNICO que ataba al
> llamante con el conjunto, así que borrarla a secas habría dejado a cualquier `tenant_admin`
> cobrar en cualquier conjunto. **Antes de retirar una guarda, la pregunta es qué otra cosa
> sostiene el invariante** — y si la respuesta es «ninguna», el arreglo es sustituir, no borrar.

**Es trabajo de auditoría, no de diseño, y es el mayor riesgo de esta PRD.**

### 11.3 Reglas — y son DOS ficheros, no uno

> **CORRECCIÓN (25 ago 2026).** Esta sección se titulaba «Reglas de Firestore» y concluía que las
> reglas no necesitaban un cambio. **Es falso, y el error fue el singular.** Hay dos ficheros de
> reglas: `firestore.rules` **sí** resolvía por membresía —de ahí la conclusión— y
> `storage.rules` **no**: su `delConjunto()` comparaba `request.auth.token.tenantId == tenantId`,
> y esa función es la base de `miembro`, `admin` y `porteria`, o sea de **todas** sus rutas.
>
> Consecuencia con el selector encendido: cambiar de conjunto dejaba **Firestore abierto y Storage
> cerrado entero** —documentos, comprobantes, notas de portería y evidencia de soporte—, sin más
> síntoma que un error de permisos.
>
> Lo encontró una **revisión adversarial**, no las suites: 59 pruebas de Storage pasaban porque
> ninguna ejercía a un administrador operando un conjunto distinto del de su claim.
>
> **Cuando una conclusión empieza con un plural —«las reglas», «los catálogos», «las
> callables»— hay que contar cuántos son antes de firmarla.** Ese mismo día el plural falló tres
> veces: dos ficheros de reglas, cinco sitios de catálogo de banderas, y dieciocho comparaciones
> del claim donde esta ficha decía once.

| Qué | Cambio |
|---|---|
| Colecciones de conjunto (`firestore.rules`) | **Ninguno.** Ya resuelven por membresía |
| **`storage.rules`** | **SÍ cambia.** `delConjunto` pasa a `firestore.exists(tenantUsers/{tenantId}_{uid})`, y **el rol sale de la membresía**, no del token: la misma persona puede administrar un conjunto y ser residente de otro. El superadmin sigue saliendo del token, porque no tiene membresía en ninguno |
| `managementCompanies` | **Bloque nuevo y explícito**: lectura para miembros de un conjunto asociado, escritura solo superadmin. **No puede caer en `relaxedTenantCollection`** |
| `tenants` | Sin cambio: `managementCompanyId` queda cubierto por la regla existente |

> **ABIERTO al cerrar el 25 de agosto:** el cambio de `storage.rules` usa **reglas entre
> servicios**, y **no se pudo verificar en el servicio real** — el emulador no es el servicio.
> Subir un documento en staging falla, y falla también en el conjunto donde el claim y el activo
> coinciden. La bisección quedó a medias. **Detalle y siguiente paso en la cabecera de
> `docs/pendientes.md`.** Si resulta que las reglas entre servicios no sirven, la alternativa es
> **emitir el claim al cambiar de conjunto**, que arregla esto de raíz pero **rompe el
> multipestaña**.

### 11.4 Índices, jobs y banderas

- **Índice nuevo:** `tenantUsers` por `uid`, para listar las membresías de una persona.
- **Jobs:** ninguno.
- **Bandera:** `producto-multiconjunto`, que gobierna **el selector**. **No gobierna §11.2**, que
  se despliega antes y es compatible hacia atrás.
  > Esta ficha la llamaba `multi-tenant-admin`. Se renombró al construirla: las dieciséis
  > existentes llevan prefijo de área y `FeatureFlagArea` lo exige. **Y vive en CINCO sitios, no
  > en cuatro**: el catálogo del cliente, el del servidor, el sembrador, el movedor global y el
  > movedor **por conjunto**. Nació sin el quinto, así que se podía encender para todos pero no
  > para uno solo — que es la vía del canario. Corregido en `ccc78e1`.

## 12. Riesgos y mitigaciones

| Riesgo | Señal | Mitigación |
|---|---|---|
| **Fuga entre conjuntos** al cambiar | Un dato del conjunto A aparece en B | R3 y CA4. Prueba manual obligatoria conjunto a conjunto |
| Retirar la guarda del claim **sin** comprobación de membresía detrás | Una callable acepta un conjunto ajeno | §11.2: revisión sitio por sitio, con CF2 por callable |
| El selector permite pedir un conjunto ajeno | — | **No es un riesgo real:** las reglas deniegan. CF1 lo prueba |
| Un usuario con una membresía ve algo distinto | Reclamo | R2 y CA1 |
| La administradora se confunde con el conjunto y alguien suspende quince clientes | Conjuntos suspendidos en bloque | R4 y CA9 |
| Confusión de a qué conjunto se está escribiendo | Cargos creados en el conjunto equivocado | El conjunto activo va **siempre visible** en la barra superior. Fue lo primero que se vio en Habitanto y funciona |
| Coste | — | **Nulo.** N consultas por N conjuntos del propio administrador |

## 13. Despliegue, rollback y Story Map

### Orden

**Reglas → functions → front**, en tres despliegues separados:

1. **Reglas** — bloque de `managementCompanies`. Inerte: nadie escribe todavía.
2. **Functions** — §11.2 (las once) y las callables de administradora. **Compatible hacia
   atrás**: un usuario con una membresía se comporta igual.
3. **Front** — selector, vista de cartera y consola de superadmin, con `multi-tenant-admin`
   apagada.

### Rollback

| Parte | Reversible |
|---|---|
| Selector y vista de cartera | **Sí**, apagando la bandera |
| Entidad administradora | **Sí**: sin `managementCompanyId`, un conjunto es un conjunto suelto |
| **§11.2, las once callables** | **No con una bandera.** Requiere revertir el despliegue de functions |

**Por eso §11.2 va en su propio despliegue y antes que el resto**: si algo falla, se revierte
solo eso, con el selector aún apagado y sin ningún usuario afectado.

### Validación

| Dónde | Qué |
|---|---|
| **Staging** | Todo. Se puede sembrar un usuario con tres membresías con `seed-tenant.mjs` |
| **Producción** | La comprobación de que **nada cambió** para los usuarios de una sola membresía. Con cero clientes reales, es lo único que producción aporta |

### Story Map

**MVP** — ~~membresías múltiples en sesión~~ ✅ · ~~selector con último usado~~ ✅ ·
~~las once callables~~ ✅ (**eran dieciocho**) · ~~entidad administradora y asociación desde
superadmin~~ ✅ — **el MVP está completo**.

**Fase 2** — vista de cartera con indicadores operativos · el residente ve su administradora ·
registro de cambios de conjunto.

> **Ojo al leer otros documentos:** la cabecera de `docs/pendientes.md` describía el frente 4 como
> «selector **y vista de cartera**», pero **la vista es Fase 2 según este Story Map**, no MVP. Y si
> se construye necesita otro nombre: **«Cartera» ya es `/admin/billing`** en la barra lateral
> (`admin-sidebar.tsx:76`), y CA3 usa la palabra con ese otro significado.

**Fase 3** — consolidado entre conjuntos, **cuando exista el plan de cuentas gobernado**.

## 14. Decisiones abiertas

### D1 · ¿Quién puede asignar membresías de un conjunto a un administrador?

Hoy `createTenantOperationalUser` lo hace un `tenant_admin` dentro de **su** conjunto. Si una
administradora quiere dar de alta a un asistente en cinco de sus conjuntos, o entra cinco veces,
o alguien puede asignarlo de una vez.

- **Opción A** — solo superadmin asigna en varios conjuntos. Seguro, y **convierte cada alta en
  un ticket de soporte**.
- **Opción B** — el administrador puede asignar en cualquier conjunto **donde él mismo sea
  miembro administrador**. Se apoya en la membresía que ya existe.

**Recomendación: B.** No inventa autoridad nueva —usa la que el usuario ya tiene— y evita que
el crecimiento de una administradora dependa de nuestro soporte. **A contradice además la
decisión de vender por autoservicio.**

> **CERRADA el 21 ago 2026 — aceptada la opción B.** Un `tenant_admin` puede asignar
> membresías en **cualquier conjunto donde él mismo sea administrador**, y solo ahí.

### D2 · ¿Qué indicadores lleva la vista de cartera?

Cerrado como **operativos, no financieros**, hasta que exista el plan de cuentas gobernado
(§4). Propuesta: unidades, residentes con acceso, PQRS abiertos, cargos vencidos y estado del
conjunto. **Confirmable en construcción**, no bloquea.

## 15. Puertas

| Puerta | Estado |
|---|---|
| **G0 Necesidad** | ✅ Decisión comercial de David del 21 ago 2026, y referencia medida: 16 condominios en una cuenta de Habitanto |
| **G1 Valor** | ✅ Baseline y métrica en §2 |
| **G2 Datos y permisos** | ✅ Modelo, roles y prohibiciones definidos. **La autoridad sigue siendo la membresía, que ya existe** |
| **G3 Riesgo** | ✅ **Cerrada con condición.** Hay rollback para todo salvo §11.2, que se aísla en su propio despliegue y va primero, con el selector apagado y ningún usuario afectado. **La condición: la auditoría sitio por sitio de las once callables es la primera tarea del MVP, con un CF2 por callable como criterio de cierre** |
| **G4 Aceptación** | ✅ 12 criterios que pasan y 8 que deben fallar, incluidos los dos que prueban que el diseño es seguro |
| **G5 Operación** | ✅ **Cerrada el 21 ago 2026.** **Superadmin** crea la administradora y le asocia el primer conjunto, en el alta comercial. A partir de ahí **el propio administrador asigna membresías** en los conjuntos donde ya es administrador (D1, opción B). **Vivaru no queda en el camino crítico** del crecimiento de una administradora |
| **G6 Escala** | ⚠️ La vista de cartera hace N consultas por N conjuntos. Con 16 es trivial; **con 200 habría que agregar en servidor**. Aceptable para el MVP, anotado como límite conocido |

**Lista para desarrollo**, con una condición explícita: **la auditoría de las once callables de
§11.2 es la primera tarea del MVP** y se despliega sola, antes que nada del resto.
