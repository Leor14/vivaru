# RESPUESTA-A-005 — Albert → Vivaru

> **Archivado el 28 de agosto de 2026, con cuatro valores retirados.** Llegó por el canal y
> estuvo fuera del repositorio hasta hoy, aunque el estado del frente lo citaba. Por la regla
> de `DECISIONES-A-002` §2 —*el repositorio lleva las decisiones; el canal lleva los datos
> personales, las credenciales y las fechas*— se retiraron **los dos `uid` y las dos
> direcciones de correo**, marcados en su sitio con `⟨⟨…⟩⟩`. **No se retiró nada más**: el
> texto y los argumentos están completos, y los valores siguen en el canal.

> Respuesta a las dudas que abristeis tras `DECISIONES-A-004`. El intercambio se había
> declarado cerrado; lo reabrís con dos datos que os bloquean, la definición de «A1 publicado»,
> dos correcciones a nuestro estado (tenéis razón en las dos) y una pregunta operativa.
> Contestamos las cinco, con confirmación verificada donde toca.

| | |
|---|---|
| **De** | Equipo de Albert CRM |
| **Para** | David (Vivaru / Qintilab) |
| **Responde a** | dudas post-`DECISIONES-A-004` |
| **Proyecto** | `albert-crm-1-1c162` · functions en `us-central1` |
| **Estado de construcción** | Albert: A5 + A1 + B1 + B3 **desplegados en producción** |

---

## 2 · Los dos datos del alta — **confirmados los dos**

### a) Confirmación de `tenants/vivaru` ✅

Existe y está **`active`** (name `Vivaru`). Verificado en la creación y re-verificado por Admin
SDK. Ya hay a qué suscribirse.

### b) Rol del usuario de servicio — **es `sales`** ✅

Tal como C2. Verificado en los tres sitios:
- custom claims: `{ tenantId: "vivaru", role: "sales", isSuperAdmin: false }`
- `users/{uid}`: `role: "sales"`, `active: true`
- `tenants/vivaru/users/{uid}`: `role: "sales"`

Como `canReadTenant` incluye `sales`, **el `onSnapshot` de C1 os funciona** (y además podéis
escribir: `canWriteTenantData` incluye `sales`). Nada os bloquea la suscripción.

### Identificadores de vuelta (lo que faltaba por el canal)

| Dato | Valor |
|---|---|
| `uid` del `tenant_admin` | `⟨⟨uid del tenant_admin — en el canal⟩⟩` |
| `uid` del usuario de servicio | `⟨⟨uid del usuario de servicio — en el canal⟩⟩` |
| correo / rol del usuario de servicio | `⟨⟨correo del usuario de servicio — en el canal⟩⟩` · `sales` |
| `tenants/vivaru` | `active` |

---

## 3 · Qué significa «A1 publicado» — **desplegado en producción, y ya está**

Significa exactamente lo que pedís: **desplegado en producción de `albert-crm-1-1c162`, no
fusionado en una rama.** Y está **hecho**:

- **Índice** `deals(externalRef.leadId ASC, updatedAt DESC)` → **LIVE en producción**
  (verificado con `firebase firestore:indexes`).
- **Web** con los campos A1 → **desplegada** en `https://albert-crm-1-1c162.web.app`.

Lo de las historias de git separadas (`main` vs `feat/albert-landing-leads`) es organización
interna del repo y **no afecta al despliegue**: el índice y la web se desplegaron **directo a
producción del proyecto**, no a una rama. La rama es solo dónde vive el código; lo que cuenta
es que está desplegado, y lo está. **Vuestra Fase 1 está desbloqueada ahora**, no depende de
ninguna fusión.

---

## 4 · Las dos correcciones — **tenéis razón en ambas, ya corregidas**

### a) Condición de vigilancia del N.º 2

Cierto: la habíamos apuntado sobre `docs/politica-retencion-datos.md`, que es **vuestro**
archivo. Movida a **nuestro** `docs/POLITICA-RETENCION-ALBERT.md`, con **nuestra** redacción,
verificable por **nuestros logs** de `eraseByExternalRef` en Cloud Logging:

> «El N.º 2 permanece en 12 meses mientras `eraseByExternalRef` no reciba llamadas de supresión
> originadas en Vivaru. Cuando ese camino exista, se revisa al alza `auditLogMonths`.»

Dos redacciones, una por casa, cada una comprobable sin depender de la otra — como en A-004 §4.

### b) Validación de `crmRef`

Corregido: ya no figura «arrancando». Queda como **terminada por Vivaru** (módulo con los dos
formatos, dos pantallas, 20 pruebas, suite en verde). Tachada de la Fase 0. Gracias por el dato.

---

## 5 · El enlace de reset — **fue por seguridad, no porque el buzón no reciba**

Os mandamos un enlace en vez de disparar el correo por **decisión nuestra de seguridad**:
creamos al `tenant_admin` vía Admin SDK **sin contraseña** y generamos el enlace, para no
manejar ninguna contraseña en claro en ningún momento. **No** es que `⟨⟨buzón del tenant_admin — en el canal⟩⟩`
no reciba — eso no lo probamos.

**Pero tenéis razón en que conviene saber la recuperación ahora**, y aquí va el hecho que
encontramos mirando el código: **el login de Albert, hasta hoy, no tenía «olvidé mi
contraseña» self-service.** La recuperación dependía de una acción de admin (generar enlace o
resetear por Admin SDK).

**Lo hemos resuelto:** añadimos el flujo **«¿Olvidaste tu contraseña?»** al login
(`sendPasswordResetEmail`, con mensaje neutro para no revelar si una cuenta existe), en los tres
idiomas. Con eso, `⟨⟨buzón del tenant_admin — en el canal⟩⟩` —y cualquier usuario— puede **auto-recuperarse**
desde la pantalla de login, sin que nadie genere enlaces a mano. Queda desplegado con la web.

> Si el correo de Firebase no llegara a vuestro buzón por filtros, decídnoslo y revisamos la
> plantilla/remitente; pero el camino self-service ya no depende de nosotros.

---

## Resumen — un renglón por punto

| # | Punto | Respuesta |
|---|---|---|
| **2a** | `tenants/vivaru` | ✅ Existe, `active`. |
| **2b** | Rol del servicio | ✅ `sales` (verificado). `onSnapshot` de C1 funciona. |
| **3** | «A1 publicado» | **Desplegado en producción** de `albert-crm-1-1c162` (índice + web). Hecho. |
| **4a** | Vigilancia N.º2 | Corregido: en **nuestro** `docs/POLITICA-RETENCION-ALBERT.md`. |
| **4b** | `crmRef` | Corregido: **terminada por Vivaru**. |
| **5** | Reset | Fue seguridad, no falta de recepción. Y **añadimos self-service** de reset al login. |

---

*Albert CRM — respuesta a las dudas post-DECISIONES-A-004 · confirmaciones verificadas contra producción de `albert-crm-1-1c162`.*
