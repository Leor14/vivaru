# Albert CRM + Vivaru — base de decisión para la integración

Auditoría del documento **«Albert CRM + Vivaru — Observaciones de producto, encaje con
REVOPS y posibilidades de integración» v1.0**, contrastada con lo que está medido del
lado de Vivaru y con la navegación propia de la consola de Albert.

Mantiene la estructura de tres zonas del roadmap de producto. Complementa a
`docs/roadmap-revops.md`, que es donde vive la épica; **esto es el expediente de la
decisión de integración**, no un roadmap paralelo.

---

## Estado de esta revisión

| Campo | Valor |
|---|---|
| **Versión** | 0.3 |
| **Fecha** | 17 de agosto de 2026, noche |
| **Base** | Documento de observaciones v1.0 + navegación propia + medición del lado Vivaru |
| **Verificado contra** | Repositorio en `600c8e6`, proyecto `hogaru-1`, y `albert-crm-1-1c162.web.app` en vivo |
| **Recomendación** | **Opción A escalonada**, con un paso cero que el documento original no contempla |

**Convención de evidencia:** **[V]** verificado por mí · **[O]** observado en el
documento auditado y no re-verificado · **[I]** inferencia.

**Qué aporta esta versión:**

- **El lado Vivaru, medido.** El documento auditado no tiene una sola cifra de Vivaru.
- **Tres asimetrías** que cambian la recomendación de integración.
- **Una colisión de dominio** que el documento no podía ver: Vivaru ya tiene sistema
  de soporte en producción.
- **Un paso cero de coste cero** antes de su Fase 1.
- **Tres carencias compartidas** por ambos productos que ninguno de los dos documentos
  identifica, y que son el mejor argumento a favor de integrar.

---

## 1 · Qué se verificó del documento auditado

**Es un buen documento y conviene decirlo primero.** Clasifica su evidencia
—observado, documentado, inferido, pendiente—, declara los límites de su inspección,
y advierte que «la presencia de un control en la interfaz no demuestra que su flujo
completo esté terminado». Esa disciplina es exactamente la que falta en otros
documentos de este proyecto.

Coincidimos de forma independiente en el hallazgo central: **la pestaña global de
Leads que la documentación de Albert describe no existe en la consola desplegada**.
Yo conté siete pestañas; él también. **[V]**

Confirmado además por navegación propia **[V]**: los tres tenants de prueba en
Starter con 0% de onboarting y 0% de adopción; los cuatro planes con límites y **sin
precio**; la pestaña «Plataforma» como cuatro viñetas estáticas; y la ausencia de
cualquier sección de integraciones, claves de API o webhooks.

Su inventario de superficies del workspace —pipeline, tareas, contactos, reportes con
forecast y metas, aprobaciones, soporte con SLA, y el asistente Beto— se toma como
**[O]**: no lo re-verifiqué campo por campo, y su propia advertencia aplica.

---

## 2 · El lado Vivaru, que el documento no tiene

El documento auditado describe con detalle qué puede aportar Albert y **no incluye una
sola cifra de Vivaru**. Sin ellas, la decisión se toma a ciegas por un lado.

Medido en producción (`hogaru-1`), 17 de agosto de 2026 **[V]**:

| | Valor |
|---|---|
| Leads | **5, y ninguno real** — pruebas internas, incluida una llamada «Prueba Dummy» |
| Origen | 3 `demo` · 2 `trial` |
| Conjuntos con `leadId` | 2 de 9 |
| Colección `plans` | **vacía**. El precio está decidido en la guía maestra, pero **no cableado** al producto |
| Eventos analíticos | **14 con nombre**, todos de landing, **ninguno de producto** |
| PostHog | importado y **sin configurar en ninguna rama**: no recibe nada |
| Definición de trial activado | **existe** — 7 pasos en la prueba, 10 en un cliente — y ya se ve en Superadmin |
| Puerta pública de alta intención | **no existe** |
| Agenda de demos | **no existe** |
| Sistema de soporte | **completo y en producción**: 6 callables desplegadas |

**La lectura que cambia la conversación:** el embudo de Vivaru **nunca ha recibido un
prospecto real**. Los cinco registros son pruebas internas. Cualquier integración se
diseñaría para un proceso que no solo no se ha ejercido — es que no ha tenido con qué.

---

## 3 · Tres asimetrías que cambian la recomendación

### 3.1 La entrada existe; la salida no

El documento lista «APIs o webhooks de Albert» como **una** brecha. **No son
simétricas** **[V]**:

- **Escribir en Albert funciona hoy.** `submitDemoLead` es un endpoint **HTTP público
  con CORS** que crea el lead. Vivaru podría empujar sin que Albert construya nada.
- **Recibir de Albert no existe.** Sin webhooks ni emisión de eventos, Albert no puede
  avisar de que un deal se ganó — que es justo la señal que cierra el circuito.

**Y hay un matiz que lo empeora:** ese endpoint escribe en la colección global
`/leads`, **que no tiene interfaz**. La única vía de escritura que funciona deja los
leads donde nadie los mira.

**Consecuencia:** la integración «mínima» del documento (§10, siete pasos) no es
mínima. Su paso 1 —crear lead/contacto— exige antes decidir **a qué superficie** se
escribe, y la que funciona sin construir nada no sirve.

### 3.2 Ninguno de los dos está rodado

El documento concluye que Albert «ya representa un activo reutilizable» y que su valor
está en aportar una base «que sería costoso reconstruir». **Las dos cosas son
ciertas.** Pero omite la simetría:

| | Albert | Vivaru |
|---|---|---|
| Tenants | 3, todos de prueba | 9, **7 marcados como ejemplo** |
| Adopción | **0%** en los tres | Los 2 reales, sin actividad |
| Última actividad | abril · junio · agosto | 1 comunicación de marzo |
| Planes | 4, con límites y **sin precio** | `plans` vacía; precio **decidido fuera del producto** |

**No se está conectando Vivaru a un CRM probado. Se están conectando dos productos
jóvenes que nunca han operado en serio.** Eso no invalida la decisión —puede ser
exactamente lo correcto— pero cambia su perfil de riesgo: no es una integración, es
un **co-desarrollo**, y Vivaru sería el primer usuario exigente de Albert.

Implicación práctica: los tiempos y la disponibilidad del equipo de Albert pasan a ser
una **dependencia de planificación de Vivaru**, no un supuesto.

### 3.3 Las dos colecciones `leads` no encajan

**[V]** Albert usa `new · contacted · qualified · discarded`. Vivaru usa `nuevo ·
contactado · calificado · **convertido** · **perdido**`.

**Albert no tiene estado convertido**, que es precisamente el terminal que a REVOPS le
importa. El mapeo no es uno a uno y hay que decidirlo, no deducirlo al integrar.

---

## 4 · La colisión de dominio que el documento no podía ver

El documento propone (§12.2) **extender el soporte de Albert para administradores de
Vivaru** y crear ahí una consola de Customer Operations.

**Vivaru ya tiene un sistema de soporte completo y en producción [V]:** seis callables
desplegadas, estados con terminal explícito, notas internas en subcolección —para que
las reglas no las expongan—, adjuntos con validación en servidor, límites por conjunto,
y una decisión de diseño deliberada: **está excluido de `assertTenantOperable` para que
un cliente suspendido pueda seguir pidiendo ayuda**.

Su §9 acierta al listar «tickets de soporte como PQRS de residentes» entre lo que no se
puede reutilizar sin separación. **Pero le falta el tercero:** adoptar el soporte de
Albert crearía una **tercera** superficie de tickets, junto a PQRS (residente →
administración) y Soporte Vivaru (administrador → Vivaru).

**Recomendación:** el soporte de Vivaru **se queda en Vivaru**. Lo que sí conviene
mirar de Albert es su modelo de SLA y su vencimiento, que Vivaru no tiene y que su
propio roadmap pide (`SUP-001`: `assignedTo` y `firstResponseAt`). **Copiar el patrón,
no adoptar el sistema.**

---

## 5 · Tres carencias compartidas — el mejor argumento a favor

Ninguno de los dos documentos lo señala, y sale de cruzar los dos inventarios **[V]**:

| Capacidad | Albert | Vivaru |
|---|---|---|
| **Agenda de demos** | No. Su landing agenda con formulario | No |
| **Motor de mensajería** con consentimiento, supresión y frecuencia | No. Solo plantillas con merge fields | No |
| **Precio de plan** | Planes con límites, sin precio | Decidido en la guía maestra, **no cableado** |

Los tres son **prerrequisitos del circuito comercial** de los dos productos, y ninguno
los tiene. Construirlos una vez y compartirlos es un argumento a favor de integrar más
sólido que la reutilización del pipeline — porque el pipeline se puede sustituir con
una hoja de cálculo durante meses, y esto no.

**Y es un argumento que apunta a la Opción B**, no a la A: si se van a compartir
capacidades y no solo intercambiar registros, la frontera entre los productos importa
menos de lo que el documento supone.

---

## 6 · Recomendación: Opción A escalonada, con un paso cero

Se comparte la recomendación del documento —**empezar por la Opción A**, aplicación
independiente conectada, dejando abierta la evolución a la B—. Se corrige **por dónde
se empieza**.

Su Fase 1 («integración comercial mínima») incluye identidad, IDs externos,
deduplicación, creación de oportunidad, atribución, owner, SLA, tarea, respuesta
inmediata, bandeja de excepciones y dashboard. **Es mucho antes de saber si el equipo
va a usar el CRM.**

| Paso | Qué | Coste | Qué demuestra |
|---|---|---|---|
| **0** | **Volcar en Albert el recorrido que ya llevan los cinco comerciales**, a mano o por CSV | **Cero código** | Si el equipo entra al CRM, y cuál es la línea base real |
| **1** | Empujar el lead al crearse — **solo si el paso 0 demuestra uso, y a una superficie visible** | Bajo | Que la atribución sobrevive el salto |
| **2** | **La señal de vuelta**, construida en Albert: trigger sobre `deals` → callable de Vivaru | Medio, **en el repo de Albert** | Que el circuito cierra |
| **3** | Eventos de producto, tareas por señal, expediente de activación | Alto | Lo que el documento llama Fases 2 y 3 |

**El paso 0 cambió dos veces el 17 de agosto, y las dos veces por un motivo bueno.**
Se proponía importar los 5 leads por CSV y trabajarlos a mano. Al mirarlos resultó que
**los cinco son pruebas internas**: no había nada que importar, y meterlos habría
ensuciado el CRM con datos de mentira — el mismo error que la sombra de IA aprendió a
evitar. Así que se retiró.

**Y esa misma noche volvió, con material distinto.** Vivaru tiene **dos KAM** —México y
Colombia— y **tres socios de Qintilab** atendiendo en directo: David en México, Jaime en
Colombia y David en Ecuador. **Cinco personas vendiendo en tres países, y ni una línea
del producto sabe quiénes son.** Lo que hay que volcar no son cinco leads falsos de
Firestore: es el recorrido comercial que esas cinco personas llevan en la cabeza.

**El argumento de la retirada sigue siendo válido y ya no aplica.** No se importan datos
de mentira; se registra actividad real que hoy no está en ningún sistema. Y eso es
exactamente la pregunta que el paso 0 existía para contestar: **si el equipo comercial
entra al CRM**. Con cinco personas repartidas en tres países, la respuesta vale mucho
más que con un solo vendedor.

---

## 7 · Fuentes de verdad, con una corrección

El reparto del documento (§8.1 y §8.2) es correcto y se conserva: Albert dueño de
lead, contacto, oportunidad, owner, tareas, pipeline y forecast; Vivaru dueño de
usuario, tenant residencial, trial, uso, activación, suscripción y entitlements.

**Una corrección:** asigna a Albert «soporte comercial o de plataforma». Dado que el
soporte de Vivaru está **en producción**, eso debe quedar en Vivaru salvo decisión
explícita de migrar — no por defecto. Ver sección 4.

**Y una precisión sobre el trial:** el documento pide «definir trial activado» como
trabajo previo. **Ya está definido y calculado** — 7 pasos en la prueba, 10 en un
cliente— y visible en la consola de Vivaru. Lo que falta es **emitirlo como evento**,
que es bastante menos trabajo del que su tabla sugiere.

---

## 8 · Riesgos añadidos

| Riesgo | Severidad | Por qué no estaba |
|---|---|---|
| **Escribir leads donde no hay interfaz** | **Crítica** | La única vía de escritura que funciona apunta a una colección sin pantalla |
| **Co-desarrollo disfrazado de integración** | Alta | Albert no está rodado; sus tiempos pasan a ser dependencia de Vivaru |
| **Tercera superficie de tickets** | Alta | El documento no sabe que Soporte Vivaru ya está en producción |
| **Ningún lado puede producir un precio** | Alta | El contrato de integración incluye «plan propuesto» y no hay fuente en ninguno |
| **Diseñar el circuito antes de ejercerlo a mano** | Media | Con 5 leads, el proceso manual es la prueba más barata y no se ha hecho |

---

## 9 · Decisiones

**Se pueden tomar hoy:**

1. **¿Se hace el paso 0?** No depende de nadie más y responde la pregunta de fondo.
2. **¿El soporte de Vivaru se queda en Vivaru?** Recomendación: sí, copiando de Albert
   el patrón de SLA.
3. **¿Vivaru será un tenant de Albert?** Es la forma natural, y condiciona todo lo
   demás.

**Necesitan al equipo de Albert:**

4. **¿Se despliega la pestaña de Leads, o la superficie de destino son los contactos
   del tenant?** Sin esto, el paso 1 no tiene destino.
5. **¿Quién construye la señal de vuelta y cuándo?** Es trabajo en su repo.
6. **¿La bandera «API» del tenant 360 [O] corresponde a un contrato real o es
   configuración administrativa?**

**Necesitan decisión de negocio:**

7. **¿Cuál de los dos marcos de precio manda** — la guía maestra del 12 de agosto o la
   base de MXN $40 del Documento Rector de Finance? Y **con qué nomenclatura se cablea**
   al producto. La decisión de precio ya existe; lo que falta es reconciliarla y
   conectarla.
8. **¿Dónde viven la agenda y la mensajería con consentimiento**, que ninguno tiene?

---

## Changelog

### 0.3 — 17 de agosto de 2026, noche

**El paso cero vuelve, y con mejor material del que tenía al principio.** La 0.2 lo
retiró porque los 5 leads eran pruebas internas y meterlos en el CRM habría sido
ensuciarlo con datos de mentira. **Ese argumento sigue en pie.** Lo que cambió es lo que
hay para volcar: Vivaru tiene **dos KAM** —México y Colombia— y **tres socios de
Qintilab** atendiendo en directo —David en México, Jaime en Colombia y David en
Ecuador—. Cinco personas vendiendo en tres países.

**Y ni una línea del producto sabe quiénes son.** Comprobado en el repositorio: la
palabra «KAM» aparece **una sola vez**, como etiqueta de log; el lead tiene estado y no
tiene dueño; el aviso comercial va a un buzón compartido sin enrutado por país.

**Por eso el paso 0 vale ahora más que en la 0.1.** Su pregunta era si el equipo
comercial entra al CRM. Con un vendedor la respuesta era anecdótica; con cinco
repartidos en tres países es la decisión de dónde vive el recorrido comercial de la
empresa. Y no se importa nada falso: se registra actividad real que hoy no está en
ningún sistema.

**Verificado contra:** `src/app/api/lead/route.ts`, `src/lib/marketing/leads.ts` y
`functions/src/index.ts` (`createTenantFromLead`). Detalle en
`docs/roadmap-producto.md`, ficha `REVOPS-000` y `REVOPS-001E`.

### 0.2 — 17 de agosto de 2026, noche

**Corrección del mismo día:** los 5 leads de producción **no son reales**. Son pruebas
internas —una se llama «Prueba Dummy», tres son la misma persona en cinco minutos—. No
es que el embudo pierda gente: **nunca ha entrado nadie**. Se retira la recomendación
de importarlos a un CRM y se sustituye por decidir el canal de salida al mercado.

**Por qué:** las versiones anteriores afirmaban que no había precio. Era falso: existe
desde el 12 de agosto de 2026 en `Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12`.
Lo que falta es cablearlo al producto y reconciliar la nomenclatura. Detalle en
`docs/roadmap-producto.md`, sección «El precio».

### 0.1 — 17 de agosto de 2026, noche

**Por qué:** auditar el documento de observaciones Albert + Vivaru con el mismo
tratamiento que los rectores de Finance y REVOPS, y dejar el expediente de la decisión
de integración en el repositorio.

**Verificado contra:** repositorio en `600c8e6`, `hogaru-1` y la consola de Albert en
vivo.

- **Se confirma su hallazgo central de forma independiente:** la pestaña global de
  Leads no está desplegada.
- **Se aporta el lado Vivaru, que el documento no tenía:** 5 leads con cero
  conversiones, `plans` vacía, 14 eventos solo de landing, PostHog inerte, sin puerta
  de alta intención ni agenda — y la definición de trial activado **ya existente**.
- **Se separa la asimetría entrada/salida:** escribir en Albert funciona hoy; recibir
  de Albert no existe. Y la vía que funciona escribe donde no hay interfaz.
- **Se nombra la simetría de madurez:** ninguno de los dos productos está rodado. La
  integración es un co-desarrollo, no una conexión a un CRM probado.
- **Se corrige la propuesta de soporte:** Vivaru ya tiene el suyo en producción;
  adoptar el de Albert crearía una tercera superficie de tickets.
- **Se identifican tres carencias compartidas** —agenda, mensajería con consentimiento
  y precio— que ningún documento veía y que son el mejor argumento a favor de integrar.
- **Se propone un paso cero de coste cero** —importar los 5 leads por CSV y trabajarlos
  a mano— antes de la Fase 1 del documento.
