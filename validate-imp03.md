# validate-imp03.md — Verificación manual IMP-03

Fecha: 9 de mayo de 2026  
Rama: IMP-03 — Eliminar IDs técnicos visibles en UI

---

## Checklist de validación

### 1. Portal Residente — Perfil

- [ ] Login como residente
- [ ] Ir a **Mi Perfil**
- [ ] Verificar que la sección "Vivienda → Unidad" muestra formato `Torre X / DisplayName`
  - Ejemplo esperado: `Torre 1 / T2-503`
  - No debe aparecer: `t2-503`, `Torre 1-t2-503`, ni hashes de 20+ caracteres
- [ ] El modal "Solicitar cambio de unidad" → campo "Unidad actual" también muestra `Torre X / DisplayName`
- [ ] La sección "Tenant" (si visible) muestra nombre, no ID hash

---

### 2. Portal Residente — Invitaciones

- [ ] Ir a **Mis Invitaciones** o crear una nueva invitación
- [ ] En el resumen de invitación (VisitorInvitationSummaryCard):
  - El campo **Unidad** debe mostrar `unitLabel` (ej: `Torre 1-t2-503`) y NO el slug crudo `t2-503`
  - Si la invitación tiene `unitLabel`: se muestra `unitLabel`
  - Si no tiene `unitLabel`: se muestra `unitId` como fallback
- [ ] Verificar con invitaciones creadas antes y después de IMP-01/02

---

### 3. Portal Guardia — Dashboard

- [ ] Login como guardia
- [ ] Ir al **Panel de Portería (Dashboard)**
- [ ] En la lista "Visitantes del día":
  - Cada fila muestra `Unidad: Torre X / slug` con barra separadora
  - No muestra `Torre X-slug` (guión técnico)
- [ ] En la lista "Reservas activas":
  - Cada fila muestra `Unidad: Torre X / slug` con barra separadora
  - No muestra el compuesto con guión crudo

---

### 4. Portal Guardia — Paquetes

- [ ] Ir a **Paquetería**
- [ ] En la lista de paquetes pendientes:
  - Campo "Unidad" muestra `Torre X / slug` con barra
  - Si el paquete no tiene unidad: muestra "Sin unidad"
  - No muestra `Torre X-slug` crudo
- [ ] Verificar paquete sin unitLabel → aparece "Sin unidad" correctamente

---

### 5. Portal Guardia — Visitantes (QR)

- [ ] Ir a **Visitantes**
- [ ] Abrir el detalle de un visitante con `qrCodeValue` válido:
  - La sección "Código QR" muestra el QR escaneado/generado
  - El texto debajo del QR muestra el valor del token, NO un hash de Firestore
- [ ] Forzar caso sin QR:
  - Usar un visitante donde `qrCodeValue` sea null o vacío (o editar temporalmente en Firestore)
  - En vez del QR, debe aparecer el texto: **"Código QR no disponible"**
  - El DOM no debe contener strings con patrón `visitor-<hash20chars>`

---

### 6. Portal Superadmin — Tenants y Plans

- [ ] Login como superadmin
- [ ] Ir a **Tenants**:
  - Cada fila muestra el nombre del tenant
  - Debajo del nombre: `ID ···<últimos 6 chars>` (ej: `ID ···9jkl00`)
  - El ID completo NO es visible como texto principal
  - Al hacer hover, aparece el ID completo como tooltip (`title` attribute)
  - Al hacer **click** en el elemento ID: el ID completo se copia al portapapeles
    - Verificar con `Ctrl+V` / `Cmd+V` en un editor de texto
- [ ] Ir a **Plans**:
  - Mismo comportamiento: `ID ···<últimos 6>`, tooltip completo, click-to-copy

---

## Criterios de aceptación globales

| Criterio | Verificado |
|----------|-----------|
| Ningún portal residente muestra slugs técnicos (`t2-503`) como texto principal | [ ] |
| Ningún portal muestra hashes de Firestore de 20+ chars como texto visible | [ ] |
| ResidentProfileCard muestra `Torre X / DisplayName` cuando unit está en catálogo | [ ] |
| GuardDashboard y GuardPackagesList usan barra separadora (`/`) para unidades | [ ] |
| QR en GuardVisitors nunca usa `visitor-<firestoreId>` como valor del código | [ ] |
| Superadmin muestra solo últimos 6 chars del ID con copy-to-clipboard funcional | [ ] |
