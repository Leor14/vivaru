# Arranque — Exploración de la plataforma y PRDs funcionales

> **Para quien abra la próxima sesión.** Léelo entero antes de tocar nada. Está escrito
> el 21 de agosto de 2026 por la sesión anterior, con el repositorio delante, para que no
> gastes el tiempo de David reconstruyendo contexto que ya está medido.
>
> **Todo lo que dice está leído del código o de producción, no deducido.** Donde algo no
> se pudo comprobar, lo dice.

---

## 0 · Qué te va a pedir David — léelo antes que nada

En sus palabras, del 21 de agosto:

> *«Quiero que entre a la plataforma. Me solicite el acceso y yo se los concedo, y navegue
> por el sitio hasta tener la granularidad de la plataforma. Que defina el número de
> pasadas que necesite para navegar y entender a profundidad. Posterior a ello
> construiremos el esqueleto del sitio con base en PRDs funcionales del sitio.»*

**Traducido a lo que tienes que hacer, por orden:**

1. **Pedirle acceso.** Él lo concede. Lee §3 antes de pedirlo — **hay una forma correcta
   de pedirlo y una que no puedes usar**.
2. **Navegar la plataforma hasta entenderla con granularidad.**
3. **Decidir tú cuántas pasadas hacen falta** y decírselo antes de empezar. No es
   retórico: te está delegando el diseño del recorrido. §4 te da el material para
   calcularlo, no la respuesta.
4. **Después, construir el esqueleto del sitio a partir de PRDs funcionales.**

**Una ambigüedad que hay que resolver con él en los primeros minutos, no a mitad.** El 21
de agosto David abrió un track con esta frase: *«sacar PRDs de una solución de gestión
residencial, el cual haremos un filtrado para generar el alcance de nuevas funciones para
Vivaru en aspectos contables y financieros»*. Y luego pidió esto otro. **Pueden ser lo
mismo o dos cosas distintas:**

- **Lectura A:** documentar **Vivaru tal como es hoy** en PRDs funcionales, y de ahí sacar
  el esqueleto. La exploración es del propio producto.
- **Lectura B:** estudiar **una solución de referencia ajena**, filtrarla, y usar eso para
  definir alcance nuevo — sobre todo contable y financiero.

La frase de esta última sesión apunta a **A** («navegue por el sitio», «PRDs funcionales
del sitio»), pero la anterior hablaba claramente de una solución de la que *extraer*.
**Pregúntaselo. Elegir mal cuesta la sesión entera.**

---

## 1 · Dónde estamos hoy

### El estado en una tabla

| | |
|---|---|
| **Roadmap de producto** | v0.9.12 — `docs/roadmap-producto.md` |
| **Roadmap financiero** | v0.3 — `docs/roadmap-finance.md` |
| **Producción** | rama `master` = `d17478d` |
| **Desarrollo** | rama `develop` = `9d509ad` (4 commits por delante; **son documentos y un script, no código de aplicación**) |
| **Niveles 1, 2 y 3** | **En producción**, validados a mano |
| **Clientes reales** | **CERO.** Los 9 conjuntos de producción son de prueba |
| **Pagos reales** | **CERO** |

### Lo que hay que saber sí o sí

**No hay ningún cliente real, y eso lo cambia todo.** Los nueve conjuntos de producción
son pruebas. No hay pagos reales, no hay leads reales, no hay conjuntos vendidos. Cuando
alguien diga «esto lo necesitan los clientes», la pregunta correcta es **qué cliente**,
porque la respuesta medida es: ninguno todavía.

**Lo fiscal salió del alcance** por decisión de David el 20 de agosto. Vivaru **no** emite
facturas ni maneja obligaciones fiscales — eso lo hace el cliente. El recibo de Vivaru es
un **documento interno**, no fiscal. El SRI de Ecuador se retiró del código y de los dos
ambientes. Si algo te lleva a proponer funcionalidad fiscal, **para y pregunta**: es una
frontera decidida, no un hueco.

**`FIN-001` está cerrada:** el recibo se emite dentro de la transacción del pago y el
reverso lo anula. Lo siguiente en Finance es **`F1`, el expediente de conciliación**, y
**tiene una pregunta de David sin contestar**: ¿vale la pena construir la bandeja si hay
cero pagos reales? Es exactamente el tipo de pregunta que esta exploración puede ayudar a
contestar.

**Los huecos conocidos que no urgen hoy** están listados en `docs/pendientes.md`. Léelo:
es el índice de traspaso del proyecto y arranca con el estado de Finance.

---

## 2 · Qué es Vivaru — la plataforma, medida

Vivaru es una plataforma de **gestión de propiedad horizontal** (conjuntos residenciales)
operada por Qintilab S.A.S. Es **multi-conjunto**: cada conjunto es un `tenant`.

### Cinco áreas, una por rol

| Área | Ruta base | Pantallas | Quién entra |
|---|---|---|---|
| **Administración** | `/admin` | **19** | El administrador del conjunto |
| **Residente** | `/resident` | **17** | El propietario o arrendatario |
| **Superadmin** | `/superadmin` | **12** | Qintilab, sobre todos los conjuntos |
| **Autenticación** | `/login`, `/activar`… | **7** | Todos |
| **Marketing** | `/`, `/mx`, legales | **6** | Público, sin sesión |
| **Portería** | `/guard` | **5** | El guarda de seguridad |
| | | **66 en total** | |

### Los roles reales, y una trampa

Del código (`src/lib/constants/roles.ts`), y **cada rol tiene dos nombres**:

| Rol | Alias | Etiqueta en pantalla |
|---|---|---|
| `superadmin` | `super_admin` | Superadmin HOGARU |
| `tenant_admin` | `admin_tenant` | Administración |
| `resident` | — | Residente |
| `security_guard` | `security` | Guarda de seguridad / Portería |
| `committee` | — | Consejo |

**La trampa:** los alias son reales y conviven en datos y reglas. `firestore.rules:23`
trata explícitamente `tenant_admin` y `admin_tenant` como el mismo. Si buscas un rol por
un solo nombre, vas a concluir que no existe.

**Y ojo con `committee`:** es el único rol parcial — solo puede entrar a
`/admin/documents`, nada más del área de administración. Lo dice
`src/lib/auth/routing.ts`.

**«HOGARU» en las etiquetas es el nombre viejo.** El proyecto de producción se llama
`hogaru-1`. No es un error tipográfico ni otro producto.

### Qué cubre funcionalmente

Por las rutas de administración: **cartera y facturación** (`billing`), **finanzas** con
egresos y conciliación, **PQRS**, **residentes** y **usuarios**, **reservas** de zonas
comunes, **visitantes**, **paquetería**, **comunicados**, **documentos**, **reglamentos**,
**encuestas**, **reportes**, **servicios** y **soporte**.

El residente ve su espejo de casi todo eso, más **acuerdos** y su **perfil**. La portería
tiene lo suyo: visitantes, paquetes y reservas.

---

## 3 · Cómo entrar — y la regla que no puedes saltarte

### La regla, primero

**No puedes escribir contraseñas. Nunca, en ninguna circunstancia, ni siquiera una de
demostración que esté escrita en el repositorio.** Es una prohibición dura, no una
preferencia, y no la levanta que David te la ofrezca.

**Cómo se pide bien, entonces:**

> «David, ¿me abres sesión en staging como administrador y me dejas la ventana lista? A
> partir de ahí navego yo.»

**Cómo NO se pide:** «pásame la contraseña de `admin@elnogal.co`». Eso te lo va a dar y
no lo vas a poder usar, y habrás gastado un intercambio.

David ya sabe que funciona así — él dijo *«me solicite el acceso y yo se los concedo»*.
Concederlo significa **abrir él la sesión**, no dictarte una clave.

### Dónde entrar

| Ambiente | URL | Rama |
|---|---|---|
| **Staging** | `https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app` | `develop` |
| **Producción** | `https://www.grupovivaru.com` | `master` |

**Recomendación: staging, y no es una precaución vacía.** Navegar de verdad significa
abrir formularios, crear una reserva, radicar un PQRS, ver qué pasa al guardar. En
producción eso escribe en la base que **va a ser la real cuando entre el primer cliente**.
En staging no le importa a nadie.

**Y ahora mismo staging es representativo:** `develop` va cuatro commits por delante de
`master`, pero son documentos y un script — **el código de aplicación es idéntico**. Lo
que veas en staging es lo que hay en producción.

### Con qué datos

Hay **conjuntos sembrados** con datos de prueba, creados por
`functions/scripts/seed-tenant.mjs`:

| Conjunto | `tenantId` | País |
|---|---|---|
| El Nogal | `tenant-nogal-bogota` | Colombia |
| Las Palmas | `tenant-palmas-cdmx` | México |

Con usuarios de cada rol —administrador, residentes y guarda— en el dominio de cada
conjunto. Los correos están en `functions/scripts/seed-data-co.mjs` y `-mx.mjs`; la
contraseña de demostración está ahí también, **y es David quien la usa para abrirte la
sesión, no tú**.

**Pregúntale a David en qué ambiente y con qué conjunto quiere que entres.** Si los datos
sembrados están flacos para lo que necesitas ver, `seed-tenant.mjs` es idempotente y se
puede resembrar.

---

## 4 · Sobre las pasadas — el material para que decidas tú

David te delega **cuántas pasadas** hacen falta. No te la doy hecha, pero aquí está lo que
necesitas para calcularla sin adivinar.

### Lo primero: 66 pantallas NO es la superficie real

La granularidad que David pide **no está en el listado de rutas**. Está por debajo:

- **Estados de cada pantalla:** vacía, con datos, cargando, con error. Una pantalla vacía
  y la misma con doscientas filas son dos diseños distintos, y en este proyecto **los
  estados vacíos han sido fuente de defectos reales**.
- **Cajones y diálogos.** El listado de páginas no los ve. Hay **40 componentes de
  funcionalidad** repartidos en seis módulos (`admin`, `auth`, `billing`, `finanzas`,
  `reservations`, `residents`), y ahí vive la mitad de la interacción.
- **El mismo dato desde dos roles.** Un PQRS lo ve el residente y lo ve el administrador,
  y no ven lo mismo. Recorrer solo `/admin` deja fuera la mitad de cada flujo.
- **Variantes por país.** Colombia y México tienen moneda y vocabulario distintos, y es un
  eje real del producto, no cosmética.

### Una advertencia que este proyecto ha pagado tres veces

**Lo que se mira hay que mirarlo.** En el historial reciente, tres defectos seguidos
—una pantalla que no existía, un pie de PDF que contradecía su encabezado, y recibos
numerados «undefined»— **salieron de mirar la salida, no de las pruebas**. Había 995
pruebas en verde mientras los tres estaban vivos.

Aplicado a tu tarea: **una pasada que solo lea código no cuenta como pasada.** El
propósito de entrar a la plataforma es ver lo que el código no dice.

### Lo que David espera de ti antes de empezar

Que le digas **cuántas pasadas, qué busca cada una, y cuándo para**. Un plan de una
pantalla, no un documento. Y que las pasadas sean distintas entre sí — repetir el mismo
recorrido tres veces no es profundidad.

---

## 5 · Lo que NO tienes que rehacer

Está todo hecho y comprometido. Si lo vuelves a proponer, estás gastando tiempo:

- **El recibo `000000001`** está anulado en producción (21 ago). Lo único que queda de
  eso es **mirarlo en pantalla** — que la tarjeta de Recibos emitidos lo pinte tachado y
  que el PDF salga con `ANULADO`. **Si entras a producción, míralo y dilo.**
- **La política de retención** está escrita y decidida: `docs/politica-retencion-datos.md`.
  Los dos números son 12 y 12.
- **`DECISIONES-A-002`** está redactado y **sin mandar**. Es de David mandarlo, no tuyo.
- **Lo fiscal está fuera del alcance.** No es un hueco.

---

## 6 · Cómo trabaja David

Está en su primer proyecto de inteligencia artificial y lo ha dicho explícitamente:

> **«Explícame cada paso antes y después, en cristiano y sin código, y para cuando
> aparezca una decisión mía. Sepáralo claro de lo que decides tú.»**

**Lo que eso significa en la práctica:**

- **Antes de cada paso**, di qué vas a hacer y por qué. **Después**, di qué salió.
- **Sin código en la explicación.** El código va en los ficheros, no en la conversación.
- **Separa lo que decides tú de lo que decide él**, y cuando aparezca una decisión suya,
  **para**. No la resuelvas por inercia y sigas.
- **Recomienda, no hagas encuestas.** Cuando le des opciones, di cuál elegirías y por qué.
- **Lee antes de afirmar.** Este proyecto tiene un historial de documentos que afirmaban
  cosas falsas sobre su propio código. Dos veces esta semana. Si un documento dice que
  algo no existe, **ve a mirarlo** antes de construir sobre esa frase.

**Y una regla suya sobre herramientas:** no lanzar subagentes ni flujos de trabajo
multiagente salvo que él lo pida.
