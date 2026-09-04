# PRD-V-PLAT-004 — Alcance del rol Consejo

| Campo | Valor |
|---|---|
| **ID** | `PRD-V-PLAT-004` |
| **Tipo** | `PLAT` — capacidad transversal (roles y permisos) |
| **Portales** | `ADMIN` (alcance) · `SUPERADMIN` (afectado) · `RESIDENTE` (afectado, ver `RN-01`) |
| **Módulo** | Personas y permisos · Informes |
| **Usuario principal** | Miembro del consejo de administración |
| **Usuarios secundarios** | `tenant_admin` (concede el rol), `superadmin` (soporte) |
| **Responsable** | David |
| **Estado** | Discovery |
| **Dependencias** | `PRD-V-FLOW-007` (firma del informe, **ya en producción**) · `PRD-V-PLAT-002` (multiconjunto) |
| **Riesgo** | Medio-alto — toca permisos y el padrón |
| **Reversibilidad** | Reversible por bandera **salvo el modelo de datos** (ver §13) |

---

## 1 · Resumen ejecutivo

El rol `committee` existe en el código, tiene permisos escritos en `firestore.rules` sobre tres
colecciones y una pantalla en la navegación — **y no hay ninguna forma de concedérselo a nadie**.
En producción hay **cero** personas con ese rol, sobre 41 miembros. Como consecuencia,
`PRD-V-FLOW-007` desplegó la firma del informe mensual por el consejo a producción y esa capacidad
**no la puede ejercer nadie**.

Esta ficha hace que el rol **exista de verdad**: que se pueda conceder y retirar, que la persona
que lo tiene vea las pantallas para las que **ya tiene permiso**, y que tenerlo **no le cueste su
condición de residente**.

---

## 2 · Problema y baseline

**Cómo se resuelve hoy: no se resuelve.** El consejo recibe el informe por fuera del producto
—correo o PDF adjunto— y no tiene acceso propio.

### Lo medido el 4 de septiembre de 2026, en producción (`hogaru-1`)

| Medición | Valor | Fuente |
|---|---|---|
| Personas con rol `committee` | **0** | `tenantUsers`, barrido completo |
| Personas totales | 41 (21 `resident`, 11 `security_guard`, 9 `tenant_admin`) | `tenantUsers` |
| Entradas de navegación del rol | **1** (`/admin/documents`, «Asambleas») | `src/lib/constants/navigation.ts:125` |
| Colecciones que el rol ya puede leer | **3** | `firestore.rules` |
| Roles ofrecidos por la pantalla de Usuarios | **2** (`tenant_admin`, `security_guard`) | `src/app/(admin)/admin/users/page.tsx:314-315` |
| Roles aceptados por el servidor | **2**, mismo par | `assertOperationalRole`, `functions/src/index.ts:781` |
| Rutas que el rol puede abrir | **1** (`/admin/documents`) | `canAccessPath`, `src/lib/auth/routing.ts:28-30` |

### Los tres hallazgos que ordenan el alcance

1. **El rol no se puede conceder por ninguna vía.** La pantalla de Usuarios ofrece dos opciones y
   el tipo está escrito a mano como unión de esas dos; y el servidor lo blinda además en
   `assertOperationalRole`, que rechaza cualquier otro valor. Cliente y servidor coinciden, así que
   **no es un olvido de interfaz: es que el rol nunca fue alcanzable**.

2. **Los permisos van por delante de las pantallas.** `committee` ya puede leer `documents`,
   `monthlyReports` (solo los que no están en `borrador`) y `clearanceCertificates` — pero solo
   tiene navegación para la primera. **El hueco no es de permisos, es de pantallas**, y eso invierte
   lo que parecía la ficha: no hay que abrir accesos, hay que llegar a los ya abiertos.

3. **Hay capacidad muerta en producción.** `identidadParaFirmar`
   (`functions/src/index.ts:4898`) admite explícitamente `committee` para firmar el informe
   mensual, con la comprobación añadida de membresía activa que el camino del administrador no
   necesitaba. Está desplegado, verificado y **es inejecutable**.

### Métrica de éxito

- **Primaria:** número de conjuntos con al menos un `committee` activo. Baseline **0**.
- **Secundaria:** informes mensuales con firma de consejo. Baseline **0**, y hoy imposible.
- **Guardia:** cero residentes que pierdan acceso a su unidad como efecto de esta ficha
  (se mide contando `resident` antes y después; ver `RN-01`).

---

## 3 · Usuarios, roles y permisos

> ⚠️ **`RN-01` gobierna esta sección entera.** Ver §8: el consejero **conserva** su rol de
> residente; «consejo» es un atributo, no un reemplazo del rol.

| Rol | Ve | Puede | **NO puede** |
|---|---|---|---|
| **Consejero** (residente con `isCommittee`) | Todo lo del residente, más: documentos del conjunto, informes mensuales emitidos, paz y salvo del conjunto | Leer los informes **emitidos**, firmarlos, descargar documentos | Ver informes en `borrador` · escribir o anular un informe · ver o editar cartera por unidad fuera de la suya · crear, editar o borrar documentos · entrar a `/admin` fuera de las rutas declaradas en §4 · conceder el rol a nadie |
| **`tenant_admin`** | La pantalla de Personas con la marca de consejo | Conceder y retirar la marca de consejo; ver quién la tiene | Concedérsela a un `security_guard` o a otro `tenant_admin` (`RN-03`) · quitarse su propia condición de administrador |
| **`resident`** sin la marca | Lo de siempre | Lo de siempre | Nada de lo del consejero |
| **`security_guard`** | Nada nuevo | Nada nuevo | Recibir la marca de consejo (`RN-03`) |
| **`superadmin`** | Todo, como hoy | Conceder y retirar en soporte | — |

---

## 4 · Objetivo, alcance y exclusiones

**Objetivo:** que un conjunto pueda tener consejo en el producto, y que ese consejo llegue por su
cuenta a lo que el conjunto ya le reconoce.

### Entra

1. **Conceder y retirar la condición de consejero** desde la pantalla de Personas, sobre una
   persona que ya es residente del conjunto.
2. **Las pantallas para los permisos que ya existen**: informes mensuales emitidos y paz y salvo,
   además de los documentos que ya tenía.
3. **La firma del informe por el consejo**, que ya está construida, pasa a ser ejercitable.
4. **La marca visible en el padrón**: quién es consejo, desde cuándo y quién lo puso.

### No entra, y por qué

| Fuera | Motivo |
|---|---|
| Aprobar o rechazar egresos | Es un flujo de autorización con dinero. Merece su propia ficha |
| Ver cartera por unidad de terceros | Dato personal de morosidad. `FLOW-006`/`FLOW-007` lo tienen bloqueado **por el abogado**; esta ficha no lo desbloquea |
| Convocar asambleas o votar | Producto distinto |
| Un portal `/committee` propio | El consejero es un residente con más alcance; un cuarto portal multiplica el coste sin necesidad medida |
| Jerarquía dentro del consejo (presidente, tesorero) | No hay necesidad medida. `TBD-A` |

---

## 5 · Flujo funcional

### Camino feliz — conceder

1. El `tenant_admin` entra a Personas y busca a un **residente activo**.
2. Marca «Miembro del consejo». Confirma.
3. El servidor valida (`RN-02`, `RN-03`, `RN-04`) y escribe la marca con quién y cuándo.
4. La persona ve, en su siguiente carga, las entradas nuevas en su menú.

### Camino feliz — retirar

1. El `tenant_admin` desmarca. Confirma.
2. La marca se retira con registro de auditoría. **El residente conserva todo lo suyo.**
3. **Las firmas ya puestas no se tocan** (`RN-06`).

### Validaciones y errores

| Caso | Respuesta |
|---|---|
| La persona no es residente del conjunto | «Solo un residente del conjunto puede ser consejero.» |
| Membresía inactiva | «Su membresía está inactiva. Actívala antes de nombrarla consejo.» |
| Conjunto suspendido o vencido | Se deniega: es escritura (`tenantOperable`) |
| Conjunto en prueba | Se permite, pero sin invitar personas reales (Regla B) |
| Ya tenía la marca | Idempotente: no escribe y no falla |

### Casos límite

- **El consejero deja de ser residente** (se le retira la membresía o cambia de unidad): la marca
  se retira con él, porque cuelga de la misma membresía. `RN-05`.
- **Último administrador**: no aplica; esta ficha no toca administradores.

---

## 6 · Estados y transiciones

La condición de consejero **no es una máquina de estados propia**: es un atributo booleano de una
membresía que ya tiene su ciclo (`active` / `inactive`). Se declara así a propósito — un estado
nuevo con dueño propio sería un estado más que alguien tendría que operar, sin necesidad medida.

| Transición | Quién | Efecto |
|---|---|---|
| sin marca → consejero | `tenant_admin`, `superadmin` | Gana lectura y firma |
| consejero → sin marca | `tenant_admin`, `superadmin` | Pierde lectura y firma; **conserva** lo de residente |
| membresía → `inactive` | `tenant_admin` | Pierde la firma (`identidadParaFirmar` ya lo exige) y la lectura |
| membresía borrada | `tenant_admin` | La marca desaparece con ella (`RN-05`) |

**Nada queda a medias:** no hay estado intermedio ni proceso que pueda interrumpirse.

---

## 7 · Contrato de datos y multi-tenancy

**No hay colección nueva.** Se añaden tres campos a `tenantUsers/{tenantId}_{uid}`:

| Campo | Tipo | Obligatorio | Quién escribe |
|---|---|---|---|
| `isCommittee` | `boolean` | No (ausente = `false`) | **Solo callable** |
| `committeeSince` | `Timestamp` | No | **Solo callable** |
| `committeeGrantedBy` | `string` (uid) | No | **Solo callable** |

**Invariantes de Vivaru, declarados:**

- `tenantUsers` **ya lleva `tenantId`** y su id es `{tenantId}_{uid}`, así que la pertenencia al
  conjunto está en el id y en el campo. Toda consulta de lista sigue filtrando `tenantId`.
- **Conjunto `suspended` o `expired`:** solo lectura. Conceder o retirar la marca **se deniega**
  (`tenantOperable`). Leer los informes ya emitidos **sigue permitido** — no es una excepción, es
  que leer no es operar.
- **Conjunto en prueba:** funciona igual, sin invitar personas reales.
- **Retención y borrado:** los tres campos viven y mueren con la membresía. No se archivan aparte.

---

## 8 · Reglas de negocio

| # | Regla |
|---|---|
| **`RN-01`** | **La condición de consejo es un ATRIBUTO de la membresía de residente, no un valor de `role`.** `tenantUsers` tiene un único documento por persona y conjunto con un único campo `role`: usar `role: "committee"` **le quitaría a la persona su condición de residente**, y con ella su unidad, su estado de cuenta, sus pagos y su firma del reglamento — `residentOwnUnit` exige `role == 'resident'`, y el guardián de rutas lo sella: `canAccessPath` (`src/lib/auth/routing.ts:34`) responde `role === "resident"` para **todo** `/resident`, así que un `role: "committee"` queda **fuera del portal del residente entero**. No es una inferencia: está escrito. Un consejero es un propietario; dejarlo sin su unidad es inaceptable |
| **`RN-02`** | Solo un `resident` con membresía `active` del mismo conjunto puede recibir la marca |
| **`RN-03`** | Un `security_guard` no puede recibirla. Un `tenant_admin` tampoco la necesita: ya ve más |
| **`RN-04`** | La marca la concede y retira **solo** `tenant_admin` o `superadmin` del mismo conjunto |
| **`RN-05`** | La marca no sobrevive a su membresía: si se borra, desaparece |
| **`RN-06`** | **Retirar la marca no borra firmas ya puestas.** Una firma es constancia de un acto pasado; borrarla reescribiría un documento con valor frente a la comunidad |
| **`RN-07`** | El consejero **no ve informes en `borrador`**. Ya lo dice la regla desplegada, y esta ficha no la relaja |
| **`RN-08`** | Todo cambio de la marca deja registro de auditoría con quién, a quién y cuándo |

---

## 9 · Notificaciones y correo

**No se envía correo en esta ficha.** Se decide explícitamente: nombrar a alguien consejo es un
acto que el administrador comunica por sus canales, y un correo automático desde el producto
anunciaría un cargo que el producto no otorga —lo otorga la asamblea—.

Si se añadiera después, saldría por `functions/src/email.ts` con el remitente verificado. **Sin
promesas de plazo**, que el producto no controla.

---

## 10 · Criterios de aceptación

### Deben pasar

| # | Criterio |
|---|---|
| `CA1` | Un `tenant_admin` concede la marca a un residente activo y la persona ve, sin volver a entrar dos veces, las entradas nuevas de menú |
| `CA2` | Ese consejero **abre un informe mensual emitido** de su conjunto y lo lee |
| `CA3` | Ese consejero **firma** un informe emitido, y el PDF lo nombra con «Consejo de administración» |
| `CA4` | Ese consejero **sigue viendo su unidad**: su estado de cuenta, sus cargos y sus pagos. Medido comparando la pantalla antes y después de la marca |
| `CA5` | Al retirar la marca, pierde las pantallas nuevas y **conserva** las de residente |
| `CA6` | La marca aparece en el padrón con quién la puso y cuándo |
| `CA7` | Cada concesión y retirada deja su línea de auditoría |

### **Deben fallar**

| # | Criterio que tiene que ser rechazado |
|---|---|
| `CA8` | Un consejero **lee un informe en `borrador`** → denegado por reglas |
| `CA9` | Un consejero **escribe** en `monthlyReports` → denegado (`allow create, update, delete: if false`) |
| `CA10` | Un consejero **se concede la marca a sí mismo** → `permission-denied` |
| `CA11` | Un `tenant_admin` concede la marca a alguien de **otro conjunto** → `permission-denied` |
| `CA12` | Un `security_guard` recibe la marca → `invalid-argument` |
| `CA13` | Se concede la marca con el conjunto **suspendido** → denegado por `tenantOperable` |
| `CA14` | El cliente escribe `isCommittee` **directamente** en `tenantUsers` → denegado por reglas |
| `CA15` | Un consejero con membresía **inactiva** firma un informe → `failed-precondition` |

> **Falsación obligatoria** (lección del 4 de septiembre): al escribir las reglas de `CA8`, `CA9` y
> `CA14`, **borrar el bloque entero** y comprobar que enrojecen. Una prueba de denegación pasa
> igual sin ninguna regla: la satisface el deny por defecto.

---

## 11 · Arquitectura y dependencias

### La decisión obligatoria: **callable**, no escritura directa

Conceder la marca es **callable**, y por tres motivos, cada uno suficiente:

1. **Permisos cruzados**: hay que comprobar el rol de *quien concede* y el de *quien recibe*, en
   documentos distintos. Las reglas de Firestore no pueden leer el rol del destinatario y validar
   el del emisor sobre el mismo `update` sin volverse ilegibles.
2. **Un campo escribible por el cliente no sostiene un invariante** — es la lección ya escrita en
   `CLAUDE.md`. `isCommittee` decide quién firma un documento con valor frente a la comunidad.
3. Es **exactamente el mismo camino** que ya usan `createTenantOperationalUser` y
   `updateOperationalUser`. Hacer esto por escritura directa sería el único de su clase.

**La regla de Firestore acompaña, no sostiene:** `tenantUsers` debe negar al cliente escribir
`isCommittee`, `committeeSince` y `committeeGrantedBy` — y hay que recordar que **la callable va con
Admin SDK y no evalúa las reglas**, así que la validación real vive en el servidor y la regla solo
cierra la puerta del cliente.

### Piezas

| Pieza | Cambio |
|---|---|
| `functions/src/index.ts` | Callable nueva `setCommitteeMembership`. **`assertOperationalRole` NO se toca** — `committee` no es un rol operativo, y ampliarla abriría el alta de personal a un valor que no debe estar ahí |
| `firestore.rules` | `tenantUsers`: negar al cliente los tres campos. `monthlyReports` y `clearanceCertificates`: **cambiar `tenantRole(..., 'committee')` por el predicado de la marca** |
| `src/lib/constants/navigation.ts` | Entradas nuevas — pero ver `TBD-B` |
| `src/lib/auth/routing.ts` | `canAccessPath`: hoy el rol abre **solo** `/admin/documents`. Con `RN-01` el consejero es residente, así que la rama tiene que leer la marca, no el `role` |
| `src/app/(admin)/admin/users/page.tsx` | La marca en el padrón |
| Bandera | `producto-rol-consejo`, en **los cinco sitios** del catálogo, incluido `mover-bandera-de-conjunto.mjs`, o no se podrá encender por conjunto |

> 🔴 **Consecuencia de `RN-01` que hay que mirar antes de construir:** hoy el permiso se concede por
> `tenantRole(tenantId, 'committee')`, que compara el campo `role`. Con la marca como atributo, ese
> predicado **deja de ser cierto para nadie** y hay que sustituirlo por uno que lea `isCommittee`.
> Son **tres sitios** en `firestore.rules` (líneas 1100, 1441, 1449) más `identidadParaFirmar` en
> el servidor. **Contarlos antes de firmar la conclusión**, que es la trampa del plural.

### `TBD`

| # | Pregunta | Bloquea |
|---|---|---|
| `TBD-A` | ¿Hace falta distinguir presidente / tesorero / vocal? | Solo el §4 excluido; no bloquea el MVP |
| `TBD-B` | ¿El consejero entra por `/admin/...` o por rutas de `/resident`? Hoy su única entrada es `/admin/documents`, lo que le da vista de administrador a un residente. **Recomendación: llevarlo a `/resident`**, porque `RN-01` lo hace residente. Obliga a tocar `canAccessPath`, que hoy le abre solo `/admin/documents` | Entrega 2 |
| `TBD-C` | ¿Debe el consejo ver el paz y salvo de **cualquier** unidad? La regla ya se lo permite. Es dato de morosidad ajena — **misma familia que lo que espera al abogado** | Entrega 2 |

---

## 12 · Riesgos

| Riesgo | Señal que lo detecta | Mitigación |
|---|---|---|
| **Un residente pierde su unidad** al ser nombrado consejo | Contar `resident` activos antes y después | `RN-01`: la marca no reemplaza el rol. `CA4` lo mide |
| El predicado viejo `tenantRole(...,'committee')` se queda vivo y el permiso no llega | Las tres pruebas de lectura enrojecen | Sustituir los **tres** sitios contados, no «los sitios» |
| Se abre morosidad ajena por la puerta del paz y salvo | Revisión de `CA13`/`TBD-C` | No ampliar nada hasta el abogado |
| Se construyen pantallas y **nadie tiene el rol** | La métrica primaria sigue en 0 | **La entrega 1 es conceder el rol**, no las pantallas. Es el freno de «encendido sobre tablas vacías», ya pagado tres veces |
| Firmas huérfanas al retirar la marca | Informe firmado por quien ya no es consejo | `RN-06`: se conservan a propósito, y el PDF lleva la fecha |

---

## 13 · Despliegue, rollback y Story Map

### Orden

**Functions → reglas → front.** Se invierte respecto del habitual porque **la regla restringe**
(niega al cliente tres campos nuevos) y porque la callable tiene que existir antes de que el front
la llame. Es el mismo orden que `FLOW-008`.

### Rollback

- **Reversible por bandera** en lo que se ve: apagar `producto-rol-consejo` oculta las pantallas y
  el control de concesión.
- **NO reversible por bandera:** los campos ya escritos en `tenantUsers` se quedan, y **deben
  quedarse** — borrarlos dejaría informes firmados por alguien que el sistema ya no reconoce como
  consejo. Apagar la bandera **no retira permisos ya concedidos**; para eso se retira la marca.
- **Para apagar los nueve conjuntos: kill switch**, no `enabled: false`, si llegara a haber
  overrides puestas.

### Story Map

| Entrega | Qué | Por qué en este orden |
|---|---|---|
| **1** | Conceder y retirar la marca: callable, reglas, control en Personas, auditoría | **Sin esto todo lo demás es código muerto**, y ya hay una capacidad muerta en producción por saltarse este paso |
| **2** | Las pantallas de lo que ya tiene permiso: informes emitidos y documentos. Resuelve `TBD-B` | El permiso ya existe; solo falta llegar |
| **3** | Paz y salvo, sujeto a `TBD-C` y al abogado | Dato de terceros |

### Qué se valida dónde

- **En staging:** los quince criterios, con el emulador para los de reglas (**sí hay Java**:
  `~/.local/jdk`), y la recorrida por pantalla con una sesión de consejero real.
- **Solo en producción:** que un consejero de verdad abra un informe real. Hoy imposible —
  es precisamente lo que esta ficha viene a arreglar.

---

## Puertas

| Puerta | Estado |
|---|---|
| **`G0` Necesidad** | ✅ Medida: 0 de 41, y una capacidad desplegada e inejecutable |
| **`G1` Valor** | ✅ Baseline 0, métrica declarada |
| **`G2` Datos y permisos** | ✅ Modelo definido; `RN-01` resuelve el choque con el rol único |
| **`G3` Riesgo** | ✅ Auditoría, bandera y rollback declarados, incluido lo que **no** revierte |
| **`G4` Aceptación** | ✅ Quince criterios, ocho de ellos que deben fallar |
| **`G5` Operación** | ⚠️ **Abierta.** Quién mantiene el consejo al día cuando la asamblea lo renueva cada año. Hoy nadie, porque no existe |
| **`G6` Escala** | ✅ Un conjunto tiene entre 3 y 7 consejeros. Sin problema de volumen |

> **No está lista para desarrollo hasta cerrar `G5`** —y `G5` es una pregunta de operación, no de
> código—. `G0`–`G4` están superadas.
