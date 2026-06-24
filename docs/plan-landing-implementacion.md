# Plan de implementación — Cambios a la landing (cómo, qué contenido y dónde)

> Acompaña a `reporte-casos-uso-valor-landing.md`. Aterriza las 7 oportunidades en
> ediciones concretas: archivo, tipo de cambio y **copy literal listo**.
> Orden de secciones actual (en `src/app/(marketing)/mx/page.tsx`):
> Hero → ImpactBand → Pain → Solution → Perspectives → MultiConjunto → Differentiators →
> Pricing → FAQ → FinalCTA.

---

## C1 — 4º perfil "Comité / Presidente" en Perspectives  ⭐ (mayor impacto)

**Dónde:** `src/components/marketing/Perspectives.tsx`
**Cómo:**
1. `type TabKey = "admin" | "residente" | "porteria" | "comite";`
2. Añadir un `TabDef` al array `TABS` (ver contenido abajo).
3. Añadir `HEADLINE_COLOR.comite = "text-brand-blue"`.
4. Crear `ComiteComposite` (clon de `AdminComposite`, layout desktop) y una rama en
   `TabComposite` (`if (tab.key === "comite") return <ComiteComposite .../>`).
5. Cambiar el `<h2>` de la sección: **"Una plataforma, tres experiencias" → "Una plataforma,
   cuatro experiencias"**.
6. Colores del tab: reusar el token **`brand-blue`** (`textActive: "text-white"`,
   `bgActive: "bg-brand-blue"`, `ringActive: "ring-brand-blue"`) — ya existe (lo usa Solution).
7. Screenshots: `src: "/product/perspectives-comite-*.png"` (mientras no existan, el
   componente `Shot` ya pinta un placeholder con el `alt`; no bloquea el deploy).

**Contenido nuevo (TabDef):**
```
key: "comite"
label: "Comité"
headline: "Gobierna con evidencia"
bullets:
  - "Reporte de comité: tablero ejecutivo y comparativo"
  - "Antigüedad de cartera (aging) y alertas tempranas"
  - "Acuerdos accionables con aprobación y firma"
  - "Informe formal exportable a PDF y Excel"
shots:
  - alt: "Reporte de comité — tablero ejecutivo", 1440×900
  - alt: "Antigüedad de cartera y acuerdos", 1440×900
```

---

## C2 — Reescribir el pilar FINANZAS (y reforzar GOBERNANZA) en Solution

**Dónde:** `src/components/marketing/Solution.tsx` (array `PILLARS`)
**Cómo:** reemplazar los `bullets` del pilar `finanzas` y añadir el reporte de comité a
`gobernanza`. Cero cambios estructurales (solo strings).

**FINANZAS — bullets nuevos** (de "mecanismo" a "ciclo con trazabilidad"):
```
- "Campañas de cobro con embudo de recaudo"
- "Recordatorios automáticos a morosos"
- "Comprobantes aprobados en un clic"
- "Conciliación bancaria y libro de fondos"
- "Cierre de períodos y reportes (Excel/PDF)"
```
`problem` (se mantiene): *"Cartera opaca, morosidad sin control y reportes tardíos."*

**GOBERNANZA — bullets nuevos** (sumar el entregable del comité):
```
- "Reporte de comité para la asamblea"
- "Acuerdos con aprobación y firma"
- "Registro auditable de operaciones"
- "Repositorio de documentos e históricos"
- "Multi-conjunto con identidad propia"
```
`problem` (se mantiene): *"Roles difusos, juntas sin datos, sin auditoría."*

---

## C3 — Nueva sección "Migración + Confianza" (oportunidades 4 y 5 juntas)

**Dónde:** nuevo componente `src/components/marketing/TrustOnboarding.tsx`, montado en
`src/app/(marketing)/mx/page.tsx` **entre `<MultiConjunto />` y `<Differentiators />`**.
**Cómo:** componente nuevo, estático (sin estado), siguiendo el patrón visual de Solution
(grid de tarjetas + `container py-xxl`). Reusa tokens existentes.

**Contenido nuevo:**
- **Titular:** *"Empieza sin fricción, opera con confianza."*
- **Subtítulo:** *"Migrar tu conjunto no debería costar meses. Y manejar dinero y datos exige respaldo."*
- **Tarjeta 1 — Migra tu cartera en 72h:** *"Importa unidades, residentes y la cartera con la
  que llega tu conjunto por Excel. Operas el día 1 con tu realidad, no desde cero."*
- **Tarjeta 2 — Acceso seguro por enlace:** *"Cada usuario activa su cuenta desde un enlace y
  recupera su clave solo. Sin contraseñas compartidas ni la cédula como llave."*
- **Tarjeta 3 — Respaldos diarios y auditoría:** *"Copias de seguridad automáticas cada día y
  registro auditable de las operaciones sensibles. Tu información, protegida."*
- **Tarjeta 4 — Soporte en español:** *"Acompañamiento en tu idioma durante la activación y el
  día a día."* (refuerza la promesa que ya está en Hero.)

---

## C4 — Conectar el ImpactBand con el mecanismo (credibilidad)

**Dónde:** `src/components/marketing/ImpactBand.tsx` (array `STATS`)
**Cómo:** añadir un campo opcional `note?: string` al tipo `Stat` y renderizar una línea
pequeña bajo cada `label` (un `<p className="mt-1 text-xs text-slate-300">`). Es el "por qué"
de cada número, para que no sea un dato al aire.

**Contenido nuevo (notas por stat):**
```
-20 % a -35 % · Interacciones manuales del administrador
   nota: "Cobros en lote, recordatorios automáticos, QR de visitas y comprobantes en un clic."
+10 % a +25 % · Tracking de morosidad
   nota: "Embudo de recaudo y recordatorios a morosos y pendientes."
100 % · Trazabilidad auditable
   nota: "Cada cobro, pago y acceso queda registrado."
```

---

## C5 — Ampliar el FAQ (objeciones de migración, comité y seguridad)

**Dónde:** `src/components/marketing/FAQ.tsx` (array de preguntas)
**Cómo:** añadir 3 entradas nuevas al array (mismo formato pregunta/respuesta).

**Contenido nuevo:**
1. **P:** *"¿Cómo migro la información de mi conjunto si ya la llevo en Excel?"*
   **R:** *"Importas unidades, residentes y la cartera (saldos iniciales) desde plantillas de
   Excel. La activación promedio es de 72 horas y arrancas con tus datos reales."*
2. **P:** *"¿Qué recibe el comité o la presidencia para la asamblea?"*
   **R:** *"Un reporte de comité con tablero ejecutivo, antigüedad de cartera, alertas y
   acuerdos firmados, exportable a PDF y Excel y guardado en el repositorio del conjunto."*
3. **P:** *"¿Mi información está respaldada?"*
   **R:** *"Sí. Hacemos copias de seguridad automáticas a diario y mantenemos un registro
   auditable de las operaciones sensibles."*

---

## C6 — (Opcional) Differentiators y Hero afinados

**Dónde:** `src/components/marketing/Differentiators.tsx` y `Hero.tsx`
**Cómo:**
- Differentiators: cambiar el diferenciador #3 ("Ciclo financiero completo") para nombrar el
  mecanismo: *"De la cuota a la conciliación: campañas, recordatorios, comprobantes en un clic
  y cierre de períodos."* Y el #6 (Gobernanza) → *"Reporte de comité para asambleas + auditoría."*
- Hero: dejar como variante A/B un subtítulo que nombre los 4 perfiles
  (admin, residente, portería, **comité**) para alinear con la nueva sección de Perspectives.
  *(Opcional; no bloquea.)*

---

## Resumen: dónde habita cada cambio

| Cambio | Archivo | Tipo |
|---|---|---|
| C1 Tab Comité | `components/marketing/Perspectives.tsx` | Añadir tab + composite + headline |
| C2 Finanzas/Gobernanza | `components/marketing/Solution.tsx` | Editar strings de 2 pilares |
| C3 Migración + Confianza | **nuevo** `components/marketing/TrustOnboarding.tsx` + `app/(marketing)/mx/page.tsx` | Componente nuevo + montaje |
| C4 ImpactBand con mecanismo | `components/marketing/ImpactBand.tsx` | Añadir `note` por stat |
| C5 FAQ ampliado | `components/marketing/FAQ.tsx` | +3 preguntas |
| C6 Differentiators/Hero | `components/marketing/Differentiators.tsx`, `Hero.tsx` | Afinar copy (opcional) |

**Orden sugerido:** C2 + C5 (rápidos, solo strings) → C1 (tab comité, el de más valor) →
C4 → C3 (componente nuevo) → C6 (opcional). Cada uno con typecheck/lint y commit.

**Notas:**
- Los **screenshots** del tab Comité y de cualquier visual nuevo no bloquean: el patrón
  `Shot` ya pinta placeholders con el `alt` hasta que se suban los PNG a `/public/product/`.
- Todo es **contenido y maquetación**; ninguna pieza toca la app operativa ni la lógica.
- Tokens de color: reusar los existentes (`brand-blue`, `brand-green`, etc.); no hace falta
  crear tokens nuevos.

## Decisión a confirmar

¿Ejecuto en el orden sugerido (C2+C5 → C1 → C4 → C3, y C6 opcional)? ¿O prefieres que arranque
solo por **C1 (tab Comité)** y **C2 (pilar Finanzas)**, que son los de mayor retorno?
