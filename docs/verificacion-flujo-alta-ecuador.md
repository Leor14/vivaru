# Verificación técnica del flujo de alta de Ecuador

**13 de agosto de 2026.** Contraste entre `docs/vivaru-ecuador-flujo-alta.md`
—la especificación jurídica del flujo, v1.0— y **lo que el código hace de
verdad**, comprobado archivo por archivo sobre el commit vigente en `develop`.

> Esto **no es asesoría legal** ni la corrige. La especificación cita normativa
> ecuatoriana con número y fecha, precedentes sancionatorios reales y una
> separación limpia entre lo que responde el conjunto y lo que responde
> Qintilab. Todo eso sigue en pie. Lo que aquí se verifica es **la descripción
> del sistema** sobre la que ese análisis se apoya.

---

## 1. La corrección de fondo

La especificación declara en su frontmatter, como **supuestos confirmados**, que
Vivaru captura `foto/biometría`, `reconocimiento de placas`,
`geolocalización/videovigilancia` y `cédula/pasaporte`.

**Tres de los cuatro no existen en el producto, y no están planeados**
(confirmado por David el 13 de agosto de 2026).

| Supuesto | Comprobación en el código | Estado |
|---|---|---|
| Biometría / foto facial | 0 referencias en `src/` y `functions/` | **No existe** |
| Geolocalización | 0 referencias (`geoloc`, `latitude`, `longitude`, `coords`) | **No existe** |
| Videovigilancia / CCTV | 0 referencias. El sitio público lo declara: *«No integra hardware de control físico: CCTV, torniquetes ni lectores IP»* (`src/app/llms.txt/route.ts`) | **No existe** |
| Reconocimiento de placas (LPR) | No hay lectura automática. Existe `plate?: string` en `src/features/visitors/invitations.ts`: **un campo de texto que teclea quien invita** | **Existe, pero no es LPR** |
| Cédula / pasaporte | `documentNumber` del visitante | **Existe** |

La única cámara del producto está en `src/components/securityGuard/GuardVisitors.tsx`
y sirve para **escanear el código QR del visitante**. Es vídeo en vivo; no
persiste ninguna imagen.

**Y el propio documento legal ya lo decía.** `src/content/legal/privacidad.md`
§109: *«Vivaru no recopila ni trata datos considerados sensibles […] ni datos
biométricos, ni datos de menores de edad»*. La especificación se construyó sobre
un supuesto que el corpus documental de Vivaru contradice por escrito.

### Qué se cae con esto

La sección 1 de la especificación —la que llama *«la restricción que gobierna
todo el diseño»*— se apoya en que existe dato sensible. Sin biometría:

- La **prohibición del interés legítimo** del Art. 26 LOPDP no se activa.
- El **consentimiento explícito obligatorio** (Art. 26.a) no aplica a ningún
  módulo actual.
- La **gran escala automática** no se dispara por `14.1` (sensibles) ni por
  `14.4` (biometría y geolocalización), y `14.3` exige videovigilancia, que no
  hay.
- `PROH-01` a `PROH-03` regulan cámaras **del conjunto**, que no son producto de
  Vivaru.

Y con ello se cae el eslabón del que colgaba la conclusión más cara: **DPD
propio y RAT propio para Qintilab** se derivaban de la gran escala, que se
derivaba de la biometría. **Puede que sigan siendo exigibles por otra vía** —el
numeral de NNA en entornos de prestación de servicios, o el modelo de puntuación
por volumen— pero eso hay que rederivarlo, no heredarlo.

**Esta es la pregunta que hay que llevarle al abogado**, y es la única que
cambia el presupuesto del proyecto.

---

## 2. Los catorce hallazgos, reclasificados

| ID | Severidad original | Verificado | Nueva |
|---|---|---|---|
| V-01 Inventario desactualizado | ALTA | Parcial: faltan **placas**, no biometría | **BAJA** |
| V-02 «Tres perfiles» | ALTA | Premisa falsa: hay **cinco roles** | **MEDIA** |
| V-03 Sin flujo de menores | ALTA | Cierto | **MEDIA** |
| V-04 Borrado manual | ALTA | Parcial: ya hay purga automática | **MEDIA** |
| V-05 Suspensión bloquea derechos | ALTA | **Cierto y bien visto** | **MEDIA — restricción de diseño** |
| V-06 `auditLogs` ≠ registro de aceptación | MEDIA | Cierto | **MEDIA** |
| V-07 Exportación ≠ portabilidad | MEDIA | Cierto | **MEDIA** |
| V-08 Asistencia en derechos corta | MEDIA | Cierto | **MEDIA** |
| V-09 Canal público rompe aislamiento | MEDIA | Cierto | **MEDIA** |
| V-10 Portería y control laboral | MEDIA | **La mitad no aplica**: no hay vídeo | **BAJA** |
| V-11 Datos de navegación sin tratar | MEDIA | **Falso**: sí hay banner y compuerta de consentimiento | **CERRADO, con matiz** |
| V-12 Región de Google sin declarar | BAJA | **Dato disponible** | **CERRADO** |
| V-13 Aislamiento ≠ frontera legal | BAJA | Correcto conceptualmente | **BAJA** |
| V-14 Desajustes contrato/sistema | CONFIRMACIÓN | Sigue vigente | **Sin cambio** |

### Los que se cierran hoy

**V-12 — región de alojamiento.** App Hosting y Cloud Functions en
**`us-central1`**; Firestore en **`nam5`**. País de destino para el Registro
Nacional de Transferencias Internacionales: **Estados Unidos**. El documento lo
dejaba en `[REGIÓN]` porque el dato no constaba; consta.

**V-11 — cookies.** El hallazgo dice que *«no hay banner de cookies, ni
distinción entre necesarias y analíticas»*. **Lo hay:**
`src/components/marketing/CookieBanner.tsx` y una compuerta de consentimiento en
`AnalyticsProvider` que solo monta la analítica si
`localStorage["vivaru.consent"] === "accepted"`. El matiz que sí queda está en la
sección 3.

### Los que cambian de severidad, y por qué

**V-01 → BAJA.** El inventario del brief no omite biometría: omite **la placa
del vehículo**, que sí existe como campo. `datos.md` §84 ya la lista; el brief
§1 no. Es una línea de corrección documental.

**V-02 → MEDIA.** El brief decía «tres perfiles»; hay **cinco**: superadmin,
administrador de conjunto, residente, portería y comité. Pero el fondo del
hallazgo aguanta y es correcto: **el visitante no es un rol, es un registro sin
cuenta** —y así está bien modelado—, y **no existe ningún estado para menores**.

**V-04 → MEDIA.** Ya hay purga automática diaria: `anonymizeExpiredVouchersDaily`
para comprobantes vencidos y la purga de telemetría de IA a 12 meses
(`functions/src/data-retention.ts`). Lo que no existe es **retención
configurable por categoría de dato**, que es lo que promete la pantalla A4, ni
borrado individual a petición del titular.

**V-05 → restricción de diseño.** Verificado: `assertTenantOperable`
(`functions/src/index.ts:241`) lanza `failed-precondition` para un conjunto
suspendido. Dos matices que lo hacen manejable: **solo tres funciones lo
invocan**, y **hoy no existe ningún flujo de ejercicio de derechos** en el
producto. No hay incumplimiento vivo; hay una restricción que respetar cuando se
construyan esos flujos. **Sale mucho más barato acertar ahora.**

**V-10 → BAJA.** La mitad del hallazgo —videovigilancia usada para control de
desempeño laboral— **no aplica**: no hay vídeo. Queda la mitad menor y real: la
plataforma sí registra acciones de portería con marca de tiempo, y eso admite
lectura de monitoreo laboral. Es un punto para la ponderación del responsable,
no un bloqueo.

---

## 3. Lo que la especificación no vio

Tres hallazgos que aparecen al cruzar el documento con el código, y que **no
están en sus catorce**.

### N-01 · MEDIA · La política nombra Google Analytics; el código usa PostHog

`privacidad.md` §272 y §278 dicen que las cookies de análisis *«pueden ser
proporcionadas por herramientas de terceros como Google Analytics»* y remiten al
**opt-out de Google Analytics**. El producto usa **PostHog** (`posthog-js` en
`package.json`, `src/lib/marketing/analytics.ts`).

Un titular que siga la instrucción de la política —usar el opt-out de Google—
**no consigue el efecto que la política le promete**. Y el destinatario real de
la transferencia no es el que está declarado, lo que afecta al registro de
transferencias internacionales.

Es el mismo patrón que el brief autoreporta en su §5: el contrato describe algo
que el sistema no hace.

### N-02 · MEDIA · La cláusula de menores solo cita ley colombiana

`privacidad.md` §288, en la sección «Menores de Edad», remite a *«el artículo 7
de la **Ley 1581 de 2012**»* — Colombia. Para un titular ecuatoriano esa
referencia no significa nada: el régimen aplicable es el **Art. 21 LOPDP**, que
la especificación desarrolla en su sección 6.

Es un ejemplo concreto y localizado del hueco que el brief describe en general
—«los tres documentos están construidos como pares Colombia/México»—, y es útil
precisamente por estar localizado: son líneas, no un documento entero.

### N-03 · BAJA · La política declara «no biometría» y eso conviene conservarlo

`privacidad.md` §109 declara que Vivaru no trata datos biométricos. **Hoy es
cierto y es un activo**: sostiene la base de legitimación de todo el módulo de
visitantes bajo interés legítimo.

Conviene tratarlo como **compromiso vinculante**, no como descripción pasajera:
el día que alguien proponga foto en garita o reconocimiento de placas por
cámara, esa línea deja de ser cierta y arrastra consigo la prohibición del Art.
26, la gran escala automática y —probablemente— el DPD propio. **La decisión de
producto y la jurídica son la misma decisión**, y así conviene que la vea quien
la tome.

---

## 4. Qué queda, y de quién es

**Del abogado, y solo suyo:**

- Rederivar si Qintilab califica como gran escala **sin** biometría ni
  geolocalización, y por tanto si necesita DPD y RAT propios. Es lo que decide
  el costo del proyecto.
- Validar todos los textos `copy` de la especificación.
- La consulta formal a la SPDP sobre visitantes en propiedad horizontal, que la
  especificación ya identifica y sigue sin tener respuesta pública.

**De producto, en orden de lo que bloquea:**

1. **Estado y flujo para menores** (V-02, V-03). Hoy un menor registrado como
   residente es indistinguible de un adulto.
2. **Retención configurable por categoría y borrado individual** (V-04).
3. **Registro de aceptaciones versionado**, separado de `auditLogs` (V-06).
4. **Portabilidad individual** (V-07), que Colombia no exige y Ecuador sí.
5. **Canal de derechos para quien no tiene cuenta** (V-09), con las cautelas de
   diseño que la propia especificación describe.

**Documental, y barato:**

- Añadir la placa al inventario del brief (V-01).
- Declarar la región `us-central1` / Estados Unidos (V-12).
- Corregir Google Analytics → PostHog (N-01).
- Añadir Ecuador a la cláusula de menores (N-02).

**Restricción de diseño, para cuando se construyan los flujos de derechos:**

- La suspensión por mora no puede bloquearlos (V-05).

---

## 5. Cómo se verificó

Todo lo anterior es comprobable en el repositorio. Las comprobaciones fueron
búsquedas sobre `src/` y `functions/` en el commit vigente, no lectura de
documentación. Donde este documento dice «0 referencias», significa que el
término no aparece en ningún archivo de código.

**Una corrección de método, dicha aquí porque casi se cuela:** la primera
búsqueda de banner de cookies dio vacío y se estuvo a punto de confirmar V-11
como cierto. El vacío venía de haber corrido la búsqueda desde el directorio
equivocado. **Un grep que devuelve cero no prueba que algo no exista; prueba que
no se encontró donde se buscó.**
