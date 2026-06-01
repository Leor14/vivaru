# Fuentes originales — Vivaru Wiki Producto

Esta carpeta contiene (o referencia) las fuentes originales del dominio PRODUCTO/DESARROLLO de Vivaru. Los archivos aquí son **inmutables** — nunca se editan directamente. Todo el conocimiento procesado vive en `wiki/`.

## Ubicación de las fuentes en el repositorio

Las fuentes originales se encuentran en el repositorio principal de Vivaru:

| Archivo | Ruta en el repo | Descripción |
|---|---|---|
| PRODUCT.md | `/PRODUCT.md` | Visión de producto, portales, principios de diseño, brand, tono de voz |
| DESIGN.md | `/DESIGN.md` | Tokens CSS, tipografía, componentes, animaciones, patrones de layout |
| domain.ts | `/src/types/domain.ts` | Tipos TypeScript del dominio (Tenant, SessionUser, módulos) |
| BACKLOG.md | `/BACKLOG.md` | Estado de módulos y tareas pendientes |
| middleware.ts | `/src/middleware.ts` | Autenticación, RBAC, routing por rol |
| firestore.rules | `/firestore.rules` | Reglas de seguridad Firestore (700+ líneas) |
| gtm-tecnico | (notas internas) | Roadmap técnico go-to-market, fases 0–4 |

## Regla de oro

> Nunca edites los archivos en `raw/`. Si una fuente cambia, ingesta la versión nueva y registra la actualización en `wiki/log.md`.
