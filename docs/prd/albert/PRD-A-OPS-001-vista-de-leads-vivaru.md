# PRD-A-OPS-001 — Vista de Leads de Vivaru en Albert

> **Primera PRD de la familia Albert.** Vivaru redacta, Albert desarrolla — decisión
> de los socios del 17 de agosto de 2026: Albert es de Qintilab y **se adapta a las
> reglas de negocio de Vivaru**, no al revés. Expediente completo de la decisión en
> `docs/albert-vivaru-integracion.md` (0.5).

| Campo | Valor |
|---|---|
| **ID** | `PRD-A-OPS-001` |
| **Tipo** | `OPS` — operación comercial; el usuario es interno |
| **Superficie** | Consola de Albert (nueva vista). En Vivaru no se construye nada: su mitad ya existe |
| **Usuario principal** | Los cinco comerciales (2 KAM + 3 socios) y quien opere la consola Superadmin de Vivaru |
| **Responsable** | David (Vivaru) redacta y acepta · equipo de Albert construye |
| **Estado** | **Borrador — NO lista para desarrollo** (ver «Lo que falta», §0) |
| **Dependencias** | `REVOPS-001E` ✅ construido (`11e3bae`) · `REVOPS-000` ⏳ sin empezar · decisión «¿Vivaru es un tenant de Albert?» TBD |
| **Riesgo** | Medio — datos comerciales internos; sin datos personales de residentes |
| **Reversibilidad** | Alta — la vista se puede retirar; los datos empujados quedan en Albert |

---

## 0 · Lo que falta para que esto sea desarrollable, dicho primero

Este borrador existe porque **la mitad del contrato ya está cerrada y verificada en
código** — el esquema de propiedad comercial construido en `REVOPS-001E`. La otra
mitad **no está y no se va a inventar aquí**:

1. **`REVOPS-000` sin empezar.** Los flujos reales de los cinco comerciales —cómo
   captan, qué anotan, cuándo consideran perdido— hoy viven en cinco cabezas. El §5
   (flujo funcional) queda deliberadamente en `TBD` hasta esa conversación. Redactar
   esos flujos por deducción sería especificar **el CRM que nos imaginamos** — el
   riesgo que el expediente advierte por escrito.
2. **Pregunta al equipo de Albert (expediente §6.4):** ¿la superficie de destino es la
   pestaña global de Leads sin desplegar, o los contactos del tenant? Este PRD
   **propone la vista global** (§4) porque el recorrido comercial de Vivaru es
   anterior a la existencia del tenant; queda `TBD` confirmar con Albert que esa
   pestaña es desplegable sin rehacerla.
3. **Decisión previa:** ¿Vivaru opera como un tenant de Albert? (expediente §6.3).
   Condiciona dónde viven estos datos en el modelo de Albert. `TBD` de negocio.

**Regla de avance:** este documento pasa a «Lista para desarrollo» cuando §5 se llene
con la salida de `REVOPS-000` y las dos `TBD` de arriba tengan respuesta. No antes.

---

## 1 · Resumen ejecutivo

Cinco personas venden Vivaru en tres países y su recorrido comercial no se registra en
ninguna parte: la única vía de escritura hacia Albert deja los leads en una colección
**sin interfaz**, y la pestaña de Leads no está desplegada. Vivaru ya construyó su
mitad — catálogo de comerciales, dueño en el lead, vendedor en el conjunto, referencia
cruzada. Falta la superficie donde los comerciales trabajen ese recorrido: una vista
de Leads en Albert **alineada con los estados y la propiedad que Vivaru ya registra**.
El valor: que «contactado» diga quién contactó, que «convertido» exista como terminal,
y que la comisión de cada conjunto sea atribuible sin arqueología.

## 2 · Problema y baseline

- **Baseline de recorrido registrado: cero.** Verificado en el expediente (0.5): la
  entrada por autoservicio son 5 leads de prueba, y sobre el canal asistido —el que
  está dotado— no hay dato de ninguna clase, porque nada lo observa.
- **Baseline de la vía actual:** `POST` de Vivaru → colección global `/leads` de
  Albert, **sin pantalla que la muestre** [V]. Siete pestañas en consola; Leads no es
  ninguna.
- **Baseline de estados:** Albert conoce `new · contacted · qualified · discarded`.
  **No tiene `convertido`**, que es exactamente el terminal que le importa a REVOPS.
- **La métrica que dirá si funcionó** (G1): a los 30 días de desplegada la vista,
  el 100 % de los conjuntos convertidos tiene `vendedorId` y el 100 % de los leads
  trabajados tiene dueño y estado distinto de `nuevo` — medible desde Vivaru, sin
  pedirle nada a Albert.

## 3 · Usuarios, roles y permisos

Los cinco comerciales **no tienen cuenta en Vivaru y no la van a tener** — decisión
cerrada de `REVOPS-001E`: sin cuentas, sin portal, sin tocar autenticación. Sus
cuentas viven en Albert.

| Rol (en Albert) | Ve | Puede | Prohibido |
|---|---|---|---|
| Comercial | Los leads de Vivaru; como mínimo los suyos | Trabajar el lead: cambiar estado, anotar, reasignarse con acuerdo | Borrar leads; editar los campos que empuja Vivaru (origen, contacto declarado, `vivaruLeadId`) |
| Administración Albert | Todo | Reasignar dueño; corregir estados | Borrar el histórico de transiciones |
| Vivaru (sistema) | — | Empujar leads nuevos y actualizaciones de su mitad | Escribir estados de trabajo comercial (eso es de quien trabaja el lead) |

`TBD-REVOPS-000`: si un comercial ve **solo su cartera o toda** — es una regla de
operación comercial, no técnica, y se decide con los cinco delante.

## 4 · Objetivo, alcance y exclusiones

**Objetivo:** que exista en la consola de Albert una vista donde los cinco trabajen
los leads de Vivaru, con los estados de Vivaru y la propiedad de Vivaru.

**Entra:**
- La vista de Leads (global, no por tenant — propuesta §0.2) con lista, detalle,
  cambio de estado y asignación de dueño.
- El ciclo de estados de Vivaru (§6) — incluido `convertido` como terminal.
- La identidad cruzada (§7): cada lead de Albert conserva el id del lead de Vivaru,
  y cada comercial de Albert es mapeable al catálogo `salesReps` de Vivaru.

**No entra, y por qué:**
- **La señal de vuelta Albert → Vivaru** (webhooks/eventos). No existe en Albert [V]
  y es un PRD propio; mientras tanto la referencia se anota a mano en la bandeja de
  Vivaru, que ya tiene el campo (`crmRef`).
- **El soporte.** El de Vivaru se queda en Vivaru — colisión de dominio documentada
  en el expediente (§4): adoptar el de Albert crearía una tercera superficie de
  tickets.
- **Enrutado del aviso comercial por país.** Fuera del alcance acordado el 17 de
  agosto también en la mitad de Vivaru.
- **Importar los 5 leads del landing.** Son pruebas, no clientes — ya se descartó una
  vez (expediente, changelog 0.4).

## 5 · Flujo funcional — `TBD-REVOPS-000`

**Esta sección se llena con la conversación con los cinco, no antes.** Lo que debe
salir de ahí, como mínimo: cómo entra un lead que no viene del landing (¿lo teclea el
comercial? ¿quién?), qué pasa en «contactado» (¿llamada, visita, WhatsApp?), cuánto
vive un lead sin tocar antes de considerarse frío, y quién decide «perdido» y con qué
motivos. El criterio de salida de `REVOPS-000` —un recuento escrito de oportunidades
reales por país y persona— es la materia prima de esta sección.

## 6 · Estados y transiciones

El ciclo es el de Vivaru — Albert se adapta, esa es la premisa de la familia:

```
nuevo → contactado → calificado → convertido (terminal)
   ↘________↘____________↘______→ perdido (terminal, con motivo obligatorio)
```

- **Todo estado tiene dueño:** el del lead (`ownerId`). Un lead sin dueño solo puede
  estar en `nuevo`.
- **`convertido` es terminal y no lo escribe un comercial a mano:** lo produce la
  conversión en Vivaru (hoy: `createTenantFromLead` marca el lead de Vivaru; la vista
  lo refleja vía la referencia cruzada — a mano mientras no haya señal de vuelta).
- **`perdido` exige motivo** — el aprendizaje comercial del que Vivaru ya guarda
  espejo (`lostReason`).
- Correspondencia con los estados actuales de Albert (`new·contacted·qualified·
  discarded`): **decisión de implementación de Albert** (renombrar o mapear), con una
  regla no negociable: `convertido` y `perdido` no se colapsan en `discarded` — son
  terminales distintos y REVOPS los cuenta por separado.

## 7 · Contrato de datos e identidad cruzada

La mitad de Vivaru **ya existe y está verificada en código** (`11e3bae`):

| En Vivaru | Campo | Quién lo escribe |
|---|---|---|
| `leads/{leadId}` | `ownerId` · `ownerAssignedAt` | Superadmin (bandeja) |
| `leads/{leadId}` | `crmRef` — **el id del lead en Albert** | Superadmin, a mano, hasta que exista señal de vuelta |
| `salesReps/{repId}` | `crmRef` — **la identidad del comercial en Albert** | Superadmin (página Comerciales) |
| `tenants/{tenantId}` | `vendedorId` | La conversión (ambos caminos) |

Lo que Albert debe conservar por cada lead recibido de Vivaru:

- **`vivaruLeadId`** (obligatorio, inmutable): el doc id de `leads/` en Vivaru. Es la
  clave del cruce en los dos sentidos; sin él, `crmRef` no tiene a qué apuntar.
- Los campos declarados que Vivaru ya empuja: nombre, contacto, país, unidades
  estimadas, origen (`demo`/`diagnostico`/`trial`).
- Dueño y estado, con su historial de transiciones (quién, cuándo).
- `TBD`: dónde vive esto en el modelo de Albert — depende de la decisión «¿Vivaru es
  un tenant de Albert?» (§0.3).

**Regla de oro del contrato:** los campos que empuja Vivaru los corrige Vivaru; los
campos de trabajo comercial los escribe Albert. Ninguno pisa los del otro.

## 8 · Reglas de negocio verificables

1. Un lead en estado distinto de `nuevo` **tiene dueño**. Siempre.
2. `convertido` y `perdido` son terminales: no admiten transición de salida.
3. `perdido` sin motivo **no se puede guardar**.
4. `vivaruLeadId` es inmutable tras la creación.
5. Ninguna acción de la vista borra un lead; retirar es `perdido` con motivo.

## 9 · Criterios de aceptación (borrador — se completan con §5)

- [ ] Un comercial abre la vista y ve leads de Vivaru con estado y dueño.
- [ ] Cambiar un estado deja rastro: quién y cuándo.
- [ ] Marcar `perdido` sin motivo **falla**.
- [ ] Transicionar desde `convertido` o `perdido` **falla**.
- [ ] Editar `vivaruLeadId` **falla**.
- [ ] Un lead empujado desde Vivaru aparece en la vista sin intervención de nadie.
- [ ] Con el `crmRef` anotado en Vivaru, una persona puede ir del lead de Vivaru al
      de Albert y volver sin ambigüedad.

## 10 · Riesgos

| Riesgo | Señal | Mitigación |
|---|---|---|
| Especificar flujos imaginados | §5 sigue `TBD` y alguien construye igual | La regla de avance de §0 — este PRD no pasa a desarrollo con §5 vacío |
| Doble digitación (Albert y bandeja de Vivaru) | Los cinco anotan dos veces o ninguna | Mientras no haya señal de vuelta, definir en §5 cuál es la fuente y quién replica |
| Los dos productos jóvenes a la vez | Tiempos de Albert bloquean REVOPS | Ya declarado en el expediente: es co-desarrollo, y sus tiempos son dependencia de planificación de Vivaru |
| Estados divergen con el tiempo | Un estado nuevo en un lado sin espejo | El ciclo de §6 es el contrato; cambiarlo exige tocar este PRD |

## 11 · Despliegue y operación

- El despliegue es **en Albert**; Vivaru no despliega nada para este PRD.
- **Quién opera esto a diario (G5):** los cinco comerciales en Albert; en Vivaru, el
  superadmin que ya opera la bandeja. La anotación manual de `crmRef` es operación
  diaria **hasta** la señal de vuelta — si eso dura más de un trimestre, la señal de
  vuelta sube de prioridad.
- Rollback: retirar la vista no pierde datos de Vivaru — Vivaru es la fuente de su
  mitad y nunca deja de guardarla.

## Puertas

| Puerta | Estado |
|---|---|
| G0 Necesidad | ✅ El problema está medido: cero recorrido registrado, comisión no atribuible |
| G1 Valor | ✅ Baseline cero y métrica declarada (§2) |
| G2 Datos y permisos | ◐ La mitad de Vivaru verificada en código; la de Albert `TBD` §0.3 |
| G3 Riesgo | ✅ Reversible; regla de avance en §0 |
| G4 Aceptación | ◐ Borrador — se completa con §5 |
| G5 Operación | ◐ Declarada, pendiente de validar con los cinco |
| G6 Escala | ✅ Cinco personas y decenas de leads: el volumen no es el riesgo aquí |

---

## Changelog

### 0.1 — 18 de agosto de 2026 (madrugada)

Borrador inicial. La mitad de Vivaru (esquema de `REVOPS-001E`) verificada contra
`11e3bae`; los hallazgos de Albert contra el expediente 0.5 (`docs/albert-vivaru-integracion.md`).
§5 vacío a propósito: se llena con la salida de `REVOPS-000`.
