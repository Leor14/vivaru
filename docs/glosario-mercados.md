# Glosario de mercados — México, Colombia, Ecuador

**Para qué sirve.** Vivaru se vende en tres países que llaman distinto a las
mismas cosas. Este fichero es la referencia que se le pasa a cualquier trabajo de
copy, SEO o contenido asistido — sin él, las herramientas escriben en el español
neutro de un traductor, que no le habla a nadie en concreto.

**Decisión vigente (8-ago-2026):** copy en **español neutro** para los tres
países, no un texto por mercado. La columna «neutro» es la que manda. Las
columnas por país están para dos cosas: saber qué palabra es regional antes de
usarla sin darse cuenta, y tener el término local si algún día se localiza la
superficie de SEO (`title`, `description`, `H1`, `H2`, FAQ y schema).

**Neutralidad no siempre es una palabra.** En varios casos no existe un término
que funcione en los tres, y forzarlo suena peor que nombrar los dos. Ahí lo
neutro es el par: «condominios y conjuntos residenciales».

---

## El diagnóstico que originó este fichero

El landing `/mx` está escrito en vocabulario **colombiano** en una página cuyo
`<title>` dice México. Medido sobre `src/components/marketing/` + `sitio.ts`:

| Término | Veces | Mercado |
|---|---|---|
| conjunto | **78** | CO |
| condominio | 6 | MX · EC |
| fraccionamiento | 6 | MX |
| propiedad horizontal | 5 | CO · EC |
| cuota de administración | 1 | CO |
| cuota de mantenimiento | **0** en copy visible | MX |

---

## Glosario

### El inmueble

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| condominios y conjuntos residenciales | condominio · fraccionamiento · privada · unidad habitacional · coto (Jal.) | conjunto residencial · conjunto cerrado · copropiedad · unidad residencial | condominio · conjunto habitacional · urbanización |

No hay palabra única. «Conjunto» a secas no se usa en México; «fraccionamiento»
no significa nada en Colombia.

### El régimen legal

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| propiedad horizontal | propiedad en condominio (leyes **estatales**, no federal) | propiedad horizontal (**Ley 675 de 2001**) | propiedad horizontal (Ley de Propiedad Horizontal) |

«Propiedad horizontal» es el término técnico que se entiende en los tres, aunque
en México el habla corriente dice «condominio».

### La cuota

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| cuotas de mantenimiento | **cuota de mantenimiento** · cuota condominal | **cuota de administración** · expensas comunes | **alícuota** |

El más divergente de todos. «Alícuota» en Colombia se entiende como el
coeficiente de copropiedad, no como el pago mensual: usarlo fuera de Ecuador
confunde.

### Quien administra

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| administración del condominio | administrador(a) de condominios | administrador(a) de propiedad horizontal | administrador(a) de condominio |

### El órgano de gobierno

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| asamblea · comité | asamblea de condóminos · comité de vigilancia · mesa directiva | asamblea general de copropietarios · consejo de administración · revisor fiscal | junta general de copropietarios · directiva |

«Revisor fiscal» es una figura legal colombiana sin equivalente en los otros dos.

### Quien vive ahí

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| residente · propietario | condómino · residente · inquilino | copropietario · residente · arrendatario | copropietario · condómino |

### Solicitudes y quejas — **el caso más grave**

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| **quejas y solicitudes (PQRS)** | quejas y sugerencias · solicitudes · reportes | **PQRS** / PQRSD | quejas y reclamos |

**PQRS es una sigla regulatoria colombiana.** En México y Ecuador no significa
nada — ni como búsqueda ni como argumento de venta. Hoy aparece 6 veces en el
landing, incluida la descripción de `SoftwareApplication` y el pilar de
Operaciones con «PQRS con respuesta en **15 días**», que es el plazo de la ley
colombiana y fuera de Colombia no tiene fundamento.

Forma neutra recomendada: **«Quejas y solicitudes (PQRS)»** — se entiende en los
tres y conserva la sigla que sí busca un colombiano.

### Portería y acceso

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| control de acceso | caseta de vigilancia · vigilancia · control de acceso | **portería** · portero | garita · guardianía |

«Portería» nombra hoy un portal entero del producto (`/guard`). Como nombre
interno da igual; en el landing es vocabulario colombiano.

### Zonas comunes

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| áreas comunes | áreas comunes · amenidades | zonas comunes · áreas sociales | áreas comunales |

### Cobranza

| Neutro | México | Colombia | Ecuador |
|---|---|---|---|
| cartera · morosidad | cartera vencida · adeudos | cartera · mora | cartera vencida |

### Protección de datos

| | Norma |
|---|---|
| México | LFPDPPP y su Reglamento |
| Colombia | Ley 1581 de 2012 · Decreto 1377 de 2013 · Decreto 090 de 2018 |
| Ecuador | Ley Orgánica de Protección de Datos Personales (LOPDP) — **verificar con asesoría legal** |

⚠️ **HITL.** Las páginas legales citan hoy la norma colombiana y la mexicana. Con
Ecuador dentro del alcance comercial, **no hay ninguna mención a la norma
ecuatoriana**. Es decisión legal, no de contenido, y no debe resolverla un agente.

---

## Superficie a localizar

Las cadenas que un buscador y un motor de respuesta leen como señal de tema. Son
**22**, no tres landings. La columna «regional» marca las que hoy llevan
vocabulario de un solo país.

### Metadata y datos estructurados

| Dónde | Cadena actual | Regional |
|---|---|---|
| `(marketing)/layout.tsx:22` | `title`: «Software de administración de condominios en México \| Vivaru» | MX |
| `(marketing)/layout.tsx:24` | `description` | — |
| `(marketing)/layout.tsx:31` | `og:title` | — |
| `(marketing)/layout.tsx:33` | `og:description` | — |
| `DatosEstructurados.tsx:63` | `description` de `SoftwareApplication` — contiene **PQRS** | **CO** |
| `sitio.ts:78` | `MODULOS[]` — contiene **PQRS** | **CO** |
| `sitio.ts:96` | `PAISES[]` | — |

### Hero

| Dónde | Cadena actual | Regional |
|---|---|---|
| `Hero.tsx:43` | `H1`: «Control de tu **conjunto** residencial, vida más simple.» | **CO** |
| `Hero.tsx:50` | Subtítulo: «…administrar **conjuntos**, condominios y fraccionamientos en México…» | mixto |
| `Hero.tsx:53` | Línea de confianza: «Demo y Activación en menos de 72 horas» | — |

### Los doce `H2`

| Dónde | `H2` actual | Regional |
|---|---|---|
| `ProductGlimpse.tsx:94` | Un mes de cartera, en una pantalla | — |
| `ImpactBand.tsx:97` | Tres momentos en los que no vas a quedar mal | — |
| `Pain.tsx:79` | ¿Cómo opera tu **conjunto** hoy? | **CO** |
| `Solution.tsx:126` | La plataforma completa, en cuatro dimensiones | — |
| `MarquesinaModulos.tsx:120` | Módulos incluidos *(sr-only)* | — |
| `Perspectives.tsx:596` | Una plataforma, cuatro experiencias | — |
| `CasosDeUso.tsx:142` | Así se ve un mes con Vivaru | — |
| `MultiConjunto.tsx:51` | Cada **conjunto**, su propio sistema | **CO** |
| `Differentiators.tsx:123` | 6 razones para elegir Vivaru | — |
| `TrustOnboarding.tsx:211` | Empieza sin fricción, opera con confianza | — |
| `FAQ.tsx:135` | Preguntas frecuentes | — |
| `FinalCTA.tsx:72` | ¿Listo para transformar tu **conjunto**? | **CO** |

De los doce, **ninguno contiene un término de búsqueda** — es el hallazgo 6 de
`docs/auditoria-seo-y-llm.md`, todavía sin ejecutar.

### FAQ — **están duplicadas a propósito**

Las seis preguntas viven en `FAQ.tsx` (con enlaces, JSX) y en
`sitio.ts:43` (texto plano, para el marcado `FAQPage`). **Si se cambia una, hay
que cambiarla en los dos sitios**: `tests/landing-contract.test.ts` falla si los
enunciados dejan de coincidir. Dos de ellas llevan vocabulario mixto
(«conjuntos de casas», «fraccionamientos, privadas»).

---

## Reglas al aplicar esto

1. **El copy narrativo no se traduce por país.** Se mantiene uno solo, neutro. Lo
   que se localiza, si se decide, es la superficie de arriba.
2. **`PQRS` nunca solo.** Siempre «Quejas y solicitudes (PQRS)».
3. **Los «15 días» del PQRS son colombianos.** Fuera de Colombia, o se quita el
   plazo o se presenta como compromiso de servicio de Vivaru, no como ley.
4. **Sin cifras sin fuente.** Regla anterior a este fichero y le gana a cualquier
   recomendación de herramienta: los porcentajes del ImpactBand se retiraron
   porque con cero clientes no había de dónde sacarlos. Ver
   `docs/auditoria-aeo-base-ago2026.md`, dimensión de densidad de evidencia.
5. **`hreflang` no se puede poner todavía.** Hoy solo existe `/mx`; hasta que
   existan `/co` y `/ec` no hay entre qué apuntar. `<html lang="es">` sí puede
   pasar a `es-MX` en el landing ya mismo.
