# validate-imp09.md — Checklist manual: Dashboard Métricas de Adopción

## 1. Acceso y nav

- [ ] Login como Superadmin → sidebar muestra "Métricas" entre Planes y Soporte
- [ ] Ícono BarChart2 (gráfico de barras) visible junto al label
- [ ] Click "Métricas" → navega a `/superadmin/metrics` sin error

## 2. Estado de carga

- [ ] Skeletons visibles brevemente en las 4 KPI cards durante fetch inicial
- [ ] Skeleton rows visibles en la tabla durante fetch
- [ ] Skeletons desaparecen cuando datos llegan (no quedan en pantalla)

## 3. KPI cards

- [ ] "Total tenants" — muestra número entero ≥ 1
- [ ] "Tenants activos" — muestra número ≤ Total tenants
- [ ] "Tickets abiertos" — suma global de openTickets de todos los tenants
- [ ] "Adopción alta" — count de tenants con adoptionScore ≥ 80

## 4. Tabla de métricas

- [ ] Columnas presentes: Tenant, Plan, Unidades, Residentes activos, Tickets abiertos, Tickets 30d, Visitas 30d, Pagos 30d, Paquetes 30d, Score
- [ ] Datos de tenant demo "El Nogal" visibles con valores numéricos (no "-" ni vacíos inesperados)
- [ ] Datos de tenant demo "Palmas CDMX" visibles con valores numéricos
- [ ] Badge de Score con color correcto: verde (Alto), amarillo (Medio), rojo (Bajo)
- [ ] Badge de status del tenant visible: trial / active / suspended con color asociado
- [ ] Tabla ordenada por score DESC (mayor adopción arriba)

## 5. Score coherente con seed data

- [ ] "El Nogal" tiene seed de billing + visitors + packages + people activos → score ≥ 60% (Medium o High)
- [ ] Un tenant sin datos (si existe) → score 0% → badge Bajo en rojo

## 6. Botón "Actualizar"

- [ ] Click → botón muestra spinner o estado disabled durante re-fetch
- [ ] Timestamp "Actualizado HH:MM:SS" aparece/actualiza después de fetch exitoso
- [ ] Datos se recargan sin reload de página (no navegación)

## 7. Footnote de limitaciones

- [ ] Texto visible debajo de la tabla mencionando paquetes sin fecha de llegada excluidos
- [ ] Texto menciona que Tickets 30d se basa en fecha de última actualización

## 8. Control de acceso

- [ ] Login como Admin (tenant_admin / admin_tenant) → intentar `/superadmin/metrics`
- [ ] Middleware redirige a `/unauthorized` (sin cambios de código)
- [ ] Login como Resident → mismo resultado

## 9. Índices Firestore (Firebase Console)

- [ ] Abrir Firebase Console → Firestore → Indexes
- [ ] Índice `tickets [tenantId ASC, status ASC]` → Estado: Enabled
- [ ] Índice `tickets [tenantId ASC, updatedAt ASC]` → Estado: Enabled
- [ ] Índice `visitorPasses [tenantId ASC, date ASC]` → Estado: Enabled
- [ ] Índice `billingStatements [tenantId ASC, period ASC]` → Estado: Enabled
- [ ] Índice `packages [tenantId ASC, arrivedAt ASC]` → Estado: Enabled
- [ ] Índice `people [tenantId ASC, status ASC]` → Estado: Enabled
- [ ] (Índices pueden tardar 1–2 min en activarse tras el deploy)
