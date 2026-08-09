# Propuesta de reescritura — 22 cadenas del landing

**Estado:** propuesta, sin tocar código · **Fecha:** 8 de agosto de 2026

Aplica dos decisiones ya tomadas: **español neutro** para los tres mercados, y el
hallazgo 6 de `docs/auditoria-seo-y-llm.md` (los `H2` no contienen ni un término
de búsqueda). Vocabulario y reglas en `docs/glosario-mercados.md`.

**La regla que resuelve casi todo:** de las dos palabras en disputa, **«condominio»
se entiende en los tres países y «conjunto» no se usa en México**. Donde haya que
elegir una sola, gana condominio. Donde quepan las dos, se nombran las dos.

**El criterio de edición** es el que ya sentó el propio Hero: edición mínima, se
conserva el ritmo y el remate. Se gana la palabra clave sin perder la voz.

---

## Dos cosas que hay que resolver antes

### Bloqueante · la canónica está mal en `develop`

Verificado en staging el 8-ago-2026:

```
/mx                → canonical: https://www.grupovivaru.com/mx   ✓
/diagnostico       → canonical: https://www.grupovivaru.com/mx   ✗
/legal/privacidad  → canonical: https://www.grupovivaru.com/mx   ✗
```

`alternates: { canonical: '/mx' }` vive en `(marketing)/layout.tsx:29` y Next lo
**hereda** a todas las rutas hijas. Al promover, Google recibiría la instrucción
de tratar `/diagnostico` y las tres legales como duplicados de `/mx`.

Arreglo: quitar `alternates` del layout y declararlo en cada `page.tsx`, o
calcularlo por ruta. **Va antes del despliegue**, no después.

### Código muerto · la línea de confianza no se renderiza

`Hero.tsx:52` declara `TRUST` («Demo y Activación en menos de 72 horas · Soporte
en español») y **no se usa en el JSX**. La línea no existe en la página. O se
restituye o se borra, pero no se debe corregir su texto pensando que alguien lo
lee. Si se restituye, debe decir «72 horas hábiles», que es lo que promete el
FAQ; «menos de 72 horas» promete más que la propia respuesta oficial.

---

## Metadata y datos estructurados

| Dónde | Actual | Propuesto | Por qué |
|---|---|---|---|
| `layout.tsx:22` `title` | Software de administración de condominios en México \| Vivaru | *(sin cambio)* | Ya lleva categoría, país y marca al final. Cuando existan `/co` y `/ec`, cada una lleva el suyo. |
| `layout.tsx:24` `description` | …cartera, cuotas, reservas, visitantes y **PQRS** en un solo lugar. | …cartera, cuotas de mantenimiento, reservas, visitantes y **quejas y solicitudes**, en un solo lugar. | «PQRS» a secas no se busca fuera de Colombia. |
| `layout.tsx:31` `og:title` | Software de administración de condominios y conjuntos \| Vivaru | *(sin cambio)* | Nombra el par, que es la forma neutra correcta. |
| `layout.tsx:33` `og:description` | …visitantes con QR y **PQRS**. Cada **conjunto** opera aislado… | …visitantes con QR y **quejas y solicitudes (PQRS)**. Cada **condominio** opera aislado… | Regionalismo + sigla sin glosar. |
| `DatosEstructurados.tsx:63` | …paquetería, **PQRS** y comunicaciones. Cada **conjunto** opera aislado… | …paquetería, **quejas y solicitudes (PQRS)** y comunicaciones. Cada **condominio** opera aislado… | Es el texto que un motor de respuesta extrae literal. |
| `sitio.ts:84` `MODULOS[]` | "PQRS" | "Quejas y solicitudes (PQRS)" | Mismo motivo. Conserva la sigla para quien sí la busca. |
| `sitio.ts:96` `PAISES[]` | ["México", "Colombia", "Ecuador"] | *(sin cambio)* | Ya coincide con el alcance decidido. |

---

## Hero

| Dónde | Actual | Propuesto |
|---|---|---|
| `Hero.tsx:43` `H1` | Control de tu **conjunto** residencial, vida más simple. | Control de tu **condominio residencial**, vida más simple. |
| `Hero.tsx:50` subtítulo | El software para administrar **conjuntos, condominios** y fraccionamientos en México… | El software para administrar **condominios, conjuntos residenciales** y fraccionamientos en México… |

El `H1` cambia una sola palabra y conserva la métrica, el balance de la coma y el
remate. «Condominio residencial» es colocación natural en México y se entiende en
Colombia y Ecuador; «conjunto residencial» no funciona en México, que es el país
al que apunta esta página.

El subtítulo solo reordena: el término dominante del mercado va primero, y
«conjuntos» pasa a «conjuntos residenciales», que es la forma completa que sí se
busca en Colombia.

---

## Los doce `H2`

### Obligatorios · llevan regionalismo

| Dónde | Actual | Propuesto |
|---|---|---|
| `Pain.tsx:79` | ¿Cómo opera tu **conjunto** hoy? | ¿Cómo **administras** tu **condominio** hoy? |
| `MultiConjunto.tsx:51` | Cada **conjunto**, su propio sistema | **Varios condominios**, cada uno con su propio sistema |
| `FinalCTA.tsx:72` | ¿Listo para transformar tu **conjunto**? | ¿Listo para transformar tu **condominio**? |

`Pain` gana además el verbo de la categoría: «administrar» no aparece hoy en
ningún `H2`. `MultiConjunto` gana la intención de búsqueda que mejor te
diferencia, la de quien lleva más de un inmueble.

### Recomendados · ganan intención de búsqueda

| Dónde | Actual | Propuesto |
|---|---|---|
| `Solution.tsx:126` | La plataforma completa, en cuatro dimensiones | La **administración de tu condominio**, en cuatro dimensiones |
| `TrustOnboarding.tsx:211` | Empieza sin fricción, opera con confianza | **Migra desde Excel** y opera con confianza |
| `FAQ.tsx:135` | Preguntas frecuentes | Preguntas frecuentes sobre la **administración de condominios** |
| `MarquesinaModulos.tsx:120` *(sr-only)* | Módulos incluidos | Módulos incluidos en el **software de administración** |
| `Differentiators.tsx:123` | 6 razones para elegir Vivaru | 6 razones para elegir Vivaru **frente a Excel y WhatsApp** |
| `CasosDeUso.tsx:142` | Así se ve un mes con Vivaru | Así se **administra un condominio**, mes a mes |

`TrustOnboarding` no inventa nada: la primera tarjeta de la sección ya dice
«Importa unidades, residentes y la cartera desde Excel». `Differentiators` tampoco:
el comentario del propio componente dice que la sección se vende contra
Excel y la competencia. `MarquesinaModulos` es `sr-only`, así que no cuesta ni un
píxel de diseño.

### Dejar como están

| Dónde | `H2` | Por qué |
|---|---|---|
| `ProductGlimpse.tsx:94` | Un mes de cartera, en una pantalla | Ya lleva «cartera». Meter más sería forzarlo. |
| `ImpactBand.tsx:97` | Tres momentos en los que no vas a quedar mal | Es la mejor línea de la página. Ningún término entra sin romperla, y **doce `H2` con palabra clave se leen como spam**. La auditoría pedía reescribir tres o cuatro, no todos. |
| `Perspectives.tsx:596` | Una plataforma, cuatro experiencias | **Ojo:** «experiencias» y no «perfiles» está bien elegido. Hay cuatro pestañas pero el producto vende «3 perfiles de acceso» en `Differentiators`. Cambiarlo a «perfiles» crearía una contradicción visible en la misma página. |

---

## Las seis preguntas del FAQ

⚠️ **Están duplicadas a propósito.** Cada enunciado vive en `FAQ.tsx` y en
`sitio.ts:43` (texto plano para el marcado `FAQPage`). Cambiar uno sin el otro
hace fallar `tests/landing-contract.test.ts`. **Y los `id` no se renumeran**: van
1, 2, 3, 5, 6, 7 y el 4 no se reutiliza jamás.

| id | Actual | Propuesto |
|---|---|---|
| 1 | ¿Funciona para **conjuntos de casas** o solo edificios? | ¿Funciona para **fraccionamientos de casas** o solo edificios? |
| 2 | ¿Qué tan rápido entra en operación mi **conjunto**? | ¿Qué tan rápido entra en operación mi **condominio**? |
| 3 | ¿Necesito conectar mi cuenta bancaria o procesador de pagos? | *(sin cambio)* |
| 5 | ¿Cómo se manejan los datos personales de mis residentes? | *(sin cambio)* |
| 6 | ¿Qué pasa si quiero cancelar? | *(sin cambio)* |
| 7 | ¿Soportan integración con CCTV, torniquetes o control de acceso por hardware? | *(sin cambio)* |

Los **cuerpos** de las respuestas 1 y 2 también nombran «conjunto» varias veces y
habría que pasarlos por el glosario en el mismo cambio.

---

## Fuera de las 22, pero es el más delicado

| Dónde | Actual | Problema |
|---|---|---|
| `Solution.tsx:87` | PQRS con respuesta en **15 días** | Los 15 días son el plazo de la **ley colombiana**. En México y Ecuador no tienen fundamento legal, y presentarlo como característica del producto es una promesa sin respaldo fuera de Colombia. |
| `Differentiators.tsx:77` | Código único, **semáforo de 15 días** y auditoría completa | Mismo origen. |

Propuesta: **«Quejas y solicitudes (PQRS) con plazo de respuesta configurable»**, y
que el conjunto fije su propio plazo. Si comercial prefiere conservar los 15 días,
debe presentarse como compromiso de servicio de Vivaru y no como cumplimiento
normativo. **Es decisión de negocio, no de copy.**

---

## Cómo verificar después de aplicarlo

1. `npm test` — `tests/landing-contract.test.ts` es el que atrapa la
   desincronización entre `FAQ.tsx` y `sitio.ts`.
2. `npm run typecheck` — el gate real es 0 errores fuera de `tests/`.
3. Ningún cambio de esta propuesta toca marcado con instrumentación, así que los
   eventos (`faq_open`, `perspective_tab_change`, `cta_primary_view`,
   `cta_secondary_click`, `cta_login_click`) no deberían moverse. Comprobarlo
   igualmente en consola, que es la regla del plan de rediseño.
4. Volver a correr `audit-website-aeo` y comparar contra
   `docs/auditoria-aeo-base-ago2026.md` (44/100, nota D).
