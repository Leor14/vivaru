# Plan — Explicar cada opción de variante antes de elegirla

> Objetivo: que al **crear** un conjunto (superadmin) o **cambiar** una variante (admin), se
> entienda **qué significa cada opción** antes de seleccionarla — con especial cuidado en las
> `locked` (Finanzas, Gobernanza), cuya elección al crear **no se puede revertir**.
>
> Análisis + planning. No ejecuta todavía.

---

## 1. Diagnóstico (estado actual)

- El contenido por opción vive en `MODULE_VARIANT_META` (`src/lib/config/module-variants.ts`): hoy
  cada opción tiene `value`, `label` y **una sola línea** `description`.
- Se renderiza en dos superficies, ambas con un `<select>` + la descripción **de la opción ya
  seleccionada** debajo:
  - Alta de superadmin: `src/app/(superadmin)/superadmin/tenants/page.tsx` (~líneas 371–397).
  - Configurador del admin: `src/features/admin/components/module-variants-card.tsx` (~85–120).
- **Gap:** la otra opción no se ve hasta seleccionarla; no hay "para quién", ni qué cambia, ni el
  aviso de irreversibilidad de las `locked`. El usuario elige a ciegas.

---

## 2. La mejor forma (recomendación de UX)

Reemplazar el `<select>` por un **selector de tarjetas (radio cards)**: ambas opciones visibles a
la vez, cada una con su explicación. Es el patrón más claro para "explicar antes de elegir".

Cada tarjeta muestra:
- **Etiqueta** (Canal oficial / Tablón simple…).
- **Resumen** (la `description` corta de hoy).
- **Para quién** (`bestFor`): a qué tipo de conjunto le conviene.
- **Qué incluye / qué cambia** (`highlights`): 2–4 viñetas concretas.

Encima del grupo, un **texto de ayuda del módulo** (`helpText`) que explica el eje de elección.
Debajo, según editabilidad:
- `locked` → banda de **irreversibilidad** ("Se fija al crear el conjunto; no se puede cambiar
  después") + en el admin, las tarjetas en **solo lectura** (resaltada la elegida).
- `warn` → al elegir otra opción, modal de confirmación enriquecido con la implicación
  (`changeNote`: datos en vuelo, p. ej. QR activos / PQRS abiertos).
- `free` → cambio directo.

Un **único componente reutilizable** sirve para las dos superficies (alta y configurador),
parametrizado por contexto (`create` | `edit`) y editabilidad.

> Alternativa descartada: mantener el `<select>` y agregar un popover "?". Funciona, pero esconde
> la comparación; las tarjetas la hacen explícita. (Si se prefiere algo más compacto, las tarjetas
> pueden colapsarse en móvil mostrando solo resumen + "ver detalle").

---

## 3. Modelo de contenido extendido

En `src/lib/config/module-variants.ts`:

```ts
export type VariantOptionMeta = {
  value: string;
  label: string;
  description: string;     // resumen corto (ya existe)
  bestFor: string;         // "Para quién / cuándo conviene"
  highlights: string[];    // qué incluye / qué cambia (2–4 viñetas)
};

export type ModuleVariantMeta = {
  key: ModuleVariantKey;
  label: string;
  helpText: string;        // explica el eje de elección del módulo
  options: VariantOptionMeta[];
  changeNote?: string;     // implicación al cambiar (para `warn`)
};
```

`lockedNote` no hace falta como dato: se deriva de `VARIANT_EDITABILITY[key] === "locked"` con copy
estándar ("Se fija al crear el conjunto"). El `changeNote` sí es propio de cada módulo `warn`.

---

## 4. Componente reutilizable

`src/features/admin/components/variant-option-picker.tsx` (o en `components/shared`):

```tsx
<VariantOptionPicker
  meta={mod}                      // ModuleVariantMeta
  value={current}                 // opción seleccionada
  editability="warn|free|locked"
  context="create|edit"           // create = alta superadmin; edit = configurador admin
  onSelect={(value) => ...}       // en warn, el padre abre el modal de confirmación
/>
```

Comportamiento:
- Render de `helpText` + tarjetas (radio) con `description` + `bestFor` + `highlights`.
- `locked` + `edit` → solo lectura (la elegida resaltada, la otra atenuada con nota
  "Disponible solo al crear el conjunto").
- `locked` + `create` → seleccionable + banda de irreversibilidad.
- `warn` → `onSelect` delega al padre (modal con `changeNote`).
- `free` → `onSelect` aplica directo.

---

## 5. Cambios por superficie

1. **Config/contenido** (`module-variants.ts`): extender tipos + escribir todo el contenido (§6).
2. **Configurador admin** (`module-variants-card.tsx`): reemplazar el `<select>` por
   `VariantOptionPicker` con `context="edit"`; conservar el modal `warn` (enriquecido con
   `changeNote`) y el comportamiento `locked` (solo lectura).
3. **Alta superadmin** (`superadmin/tenants/page.tsx`): reemplazar el `<select>` por
   `VariantOptionPicker` con `context="create"`; banda de irreversibilidad para las `locked`.
   Integrar con `react-hook-form` (`setValue`/`watch` de `moduleVariants.<key>`).

No cambia el modelo de datos ni las Cloud Functions: es contenido + presentación.

---

## 6. Contenido propuesto (los 6 módulos)

> Copy listo para cargar en `MODULE_VARIANT_META`. Tono claro, sin jerga.

### Visitas — *helpText:* "Define cómo la portería gestiona el ingreso de visitantes."
- **Control completo (QR)** · *Para:* conjuntos con control estricto, varias torres o alto flujo.
  - El residente pre-autoriza la visita y se genera un QR.
  - La portería escanea y registra ingreso y salida.
  - Soporta autorizaciones de larga duración (ingresos repetidos).
- **Registro simple** · *Para:* conjuntos pequeños o que prefieren cero fricción.
  - La portería registra la visita al llegar (sin QR ni pre-autorización).
  - El residente recibe la notificación de la visita.
- *changeNote:* "Si pasas de QR a registro simple, las autorizaciones y QR activos dejan de usarse."

### Paquetería — *helpText:* "Define el nivel de control al recibir y entregar paquetes."
- **Con evidencia** · *Para:* conjuntos con bodega y volumen de correspondencia.
  - Recepción con foto y firma.
  - Estados de bodega y retiro confirmado con destinatario.
- **Aviso simple** · *Para:* conjuntos chicos sin bodega formal.
  - La portería registra "llegó un paquete" y notifica al residente.
  - Entrega de un toque, sin foto ni firma.

### PQRS — *helpText:* "Define si las solicitudes se gestionan con trazabilidad formal o como un buzón."
- **Con SLA** · *Para:* administradoras profesionales o conjuntos grandes.
  - Radicado único y categorías (petición, queja, reclamo, sugerencia).
  - Semáforo de tiempo de respuesta (15 días hábiles) y auditoría.
- **Buzón simple** · *Para:* comunidades pequeñas que solo quieren recibir y responder.
  - El residente envía asunto + mensaje; el admin responde.
  - Sin radicado, categorías ni semáforo.
- *changeNote:* "Los PQRS abiertos con SLA dejarán de mostrar su semáforo al pasar a buzón."

### Comunicaciones — *helpText:* "Define si los comunicados tienen vigencia/programación o son un muro simple."
- **Canal oficial** · *Para:* conjuntos que programan y dan vigencia a sus avisos.
  - Comunicados con fecha de inicio y expiración.
  - Estados Programado/Vencido y filtros por vigencia.
- **Tablón simple** · *Para:* comunidades que solo quieren un muro de anuncios.
  - Publicar y ver, sin fechas de vigencia ni programación.

### Gobernanza — *helpText:* "Define si las decisiones del comité tienen validez formal (firma) o son informativas." · 🔒
- **Formal (firma / votación)** · *Para:* conjuntos que exigen formalidad legal.
  - Acuerdos con firma digital.
  - Seguimiento de firmas (firmados/pendientes) y modalidades obligatoria/parcial.
- **Informativo** · *Para:* comunidades informales.
  - Los acuerdos se publican sin firma y quedan como informativos.
- *Irreversible:* se fija al crear; afecta la validez de decisiones que ya se hayan tomado.

### Finanzas / Cartera — *helpText:* "Define si la cartera se administra dentro de Vivaru o solo se consulta." · 🔒
- **Gestión completa** · *Para:* administradoras que cobran y concilian en la plataforma.
  - Cobros individuales y en lote, conciliación, comprobantes y mora.
  - Reportes y cierre de períodos.
- **Solo consulta** · *Para:* conjuntos que llevan la contabilidad por fuera.
  - El residente consulta su estado de cuenta y sube comprobantes.
  - Sin cobros automáticos, conciliación ni mora; el admin no gestiona cartera aquí.
- *Irreversible:* se fija al crear; cambiarlo a media vida contradice el histórico contable.

---

## 7. Plan de incrementos

1. **Contenido + tipos** (`module-variants.ts`): extender `VariantOptionMeta`/`ModuleVariantMeta` y
   cargar todo el §6. Sin riesgo de UI. → typecheck.
2. **Componente** `VariantOptionPicker` (tarjetas + locked/warn/free + create/edit). → typecheck + lint.
3. **Configurador admin**: integrar el picker (context=edit), conservar modal warn (con `changeNote`)
   y locked solo-lectura. → typecheck + verificación visual.
4. **Alta superadmin**: integrar el picker (context=create) + banda de irreversibilidad para locked;
   enganchar con react-hook-form. → typecheck.
5. **Pulido** (responsive, accesibilidad radio-group) + commit/push. Front-only; sin functions.

---

## 8. Decisiones a confirmar

1. **Patrón:** ¿tarjetas radio (recomendado) o mantener `<select>` + popover "?" más compacto?
2. **Alcance:** ¿aplico el picker enriquecido a **los 6 módulos** o solo a los que más lo
   necesitan (las `locked` Finanzas/Gobernanza, por irreversibilidad)? Recomiendo los 6, por
   consistencia.
3. **Contenido:** ¿el copy del §6 te sirve como está, o quieres ajustar tono/algún punto antes de
   cargarlo?
4. **Confirmación extra en locked:** al crear un conjunto con Finanzas/Gobernanza, ¿sumamos un
   checkbox "Entiendo que esto no se puede cambiar después" antes de permitir guardar? (recomendado).
