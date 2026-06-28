---
tags: [modulo, admin, configuracion, branding]
tipo: concepto
fuentes: ["domain.ts", "BACKLOG.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Configuración

Módulo de configuración del tenant en el portal administrador (`/admin/settings`). Permite al administrador personalizar el branding del conjunto, gestionar datos generales y ajustar preferencias operativas. La pestaña "Módulos" agrupa los toggles ON/OFF del residente y los modos de operación de cada módulo (ver [[modulos-variantes]]).

## Datos configurables

Los campos de `tenantSettings/{tenantId}` son:
- `logoUrl?`: logo del conjunto (sube a Firebase Storage)
- `primaryColor`: color institucional del conjunto (override del brand Vivaru)
- `accentColor`: color de acento
- Nombre comercial y datos de contacto del conjunto

Estos valores se leen en tiempo real para aplicar el branding per-tenant en toda la aplicación. Ver [[multi-tenancy]].

## Datos del tenant base

El documento `Tenant` en [[domain-types]] incluye `name`, `nit?`, `city`, `status` y `planId`. El módulo de configuración puede mostrar estos datos como lectura (no editables desde la UI — se gestionan desde [[superadmin]]).

## Estado: ✅ skeleton + footer mobile

Los fixes implementan el skeleton de carga para la sección de branding y corrigen el footer en mobile (se superponía al contenido en iOS Safari por el manejo de `safe-area-inset-bottom`). Ver [[mobile-first-ios]].

## Limitaciones por plan

El `planId` activo determina qué opciones de configuración están disponibles. Por ejemplo, el branding personalizado (logo + color) puede ser una función de planes superiores. El enforcement de límites es el ítem A2 del [[gtm-tecnico|GTM técnico Fase 2]].

## Integración con el sistema de diseño

El `primaryColor` del tenant puede sobreescribir `--brand-700` a nivel de CSS variables para toda la sesión del tenant. Esto implementa el branding per-tenant sin duplicar estilos. Ver [[tokens-color]].

## Relaciones

- Véase también: [[multi-tenancy]], [[domain-types]], [[tokens-color]]
- Depende de: [[firebase-firestore]]
- Se conecta con: [[superadmin]], [[mobile-first-ios]], [[gtm-tecnico]], [[componentes]]

## Fuentes

- [[domain-types]], [[backlog-md]]
