# Auditoría SEO y de motores de respuesta — grupovivaru.com

Fecha: 8 de agosto de 2026. Medido sobre producción, no sobre el repo.

El diagnóstico de partida era correcto: **el sitio posiciona por marca y no por
categoría**. Este documento explica por qué, con datos, y ordena qué hacer por
impacto frente a esfuerzo.

Aviso de alcance: **no hay investigación de volúmenes de búsqueda**. No tengo
acceso a una herramienta de keywords, así que las familias semánticas que
propongo salen del producto y del mercado, no de datos de demanda. Antes de
construir páginas hay que validarlas con Search Console, Ahrefs o similar.

---

## 1. Tres errores técnicos que están costando posicionamiento ahora

### 1.1 El dominio sin `www` devuelve 404

```
https://grupovivaru.com/   ->  HTTP 404
https://www.grupovivaru.com/mx  ->  HTTP 200
```

Los dos resuelven a la misma IP (`35.219.200.1`), pero App Hosting solo tiene
configurado el `www`. El apex no redirige: **devuelve 404**.

Consecuencias: cualquier enlace entrante al dominio raíz —y son los que la gente
escribe y comparte— se pierde entero, con su autoridad. Google trata apex y www
como sitios distintos.

**Y hay un agravante en el código.** `src/app/(marketing)/layout.tsx:9`:

```ts
metadataBase: new URL('https://grupovivaru.com')
```

Todas las URL absolutas que Next genera a partir de ahí —Open Graph, canónicas—
apuntan al dominio que da 404.

**Arreglo:** configurar el apex en App Hosting con redirección 301 al `www`, y
alinear `metadataBase` con el dominio que realmente sirve.

### 1.2 La raíz redirige con 307, no con 301

```
https://www.grupovivaru.com/  ->  HTTP 307  location: /mx
```

Un **307 es temporal**: le dice a Google que no consolide autoridad en el
destino. La home es la URL que más enlaces recibe. Debe ser **308** (permanente,
el equivalente de 301 que usa Next).

### 1.3 No hay sitemap

`/sitemap.xml` devuelve **404** y `robots.txt` no lo declara. Con seis páginas
no es crítico, pero será imprescindible en cuanto se creen páginas por intención
(§3).

### Otros, menores pero gratis

| Hallazgo | Estado |
|---|---|
| `<link rel="canonical">` | **ausente** en todas las páginas |
| `og:image` | **ausente** — al compartir en WhatsApp o LinkedIn no sale imagen |
| `hreflang` | **ausente**, y el producto apunta a México, Colombia y Ecuador |
| Imágenes sin `alt` | 3 de 22 |
| Metadata propia de `/mx` | **no tiene**, hereda la del layout |

Lo que **sí está bien**: `robots.ts` distingue producción de staging y cierra
los ambientes de pruebas. Eso evita canibalización por contenido duplicado y
está bien pensado.

---

## 2. Por qué no posiciona por palabras clave

El cuerpo del landing tiene **1.264 palabras**. Estas son las apariciones de los
términos con los que se busca esta categoría:

| Término | Veces |
|---|---|
| `software` | **0** |
| `propiedad horizontal` | **0** |
| `conjunto residencial` (exacto) | **0** |
| `copropiedad` | **0** |
| `México` | **0** |
| `cuotas` · `expensas` · `mantenimiento` | **0** |
| `precio` | **0** |
| `administración` | 1 |
| `condominio` | 2 |
| `fraccionamiento` | 2 |

**La página nunca dice qué es, en las palabras con las que la gente lo busca.**

### El titular y el título son de marca, no de categoría

```
<title>Vivaru — Control residencial, vida más simple.</title>
<h1>Control residencial, vida más simple.</h1>
```

Nadie escribe «control residencial vida más simple» en Google. Es una frase
bonita y no es una consulta. Además el `<title>` empieza por la marca, que es
justo por lo que ya posicionas: estás gastando el espacio más valioso en lo
único que no necesitas reforzar.

### Los encabezados hablan hacia dentro

De los 15 `H2` de la página, ni uno contiene un término de búsqueda:

- «Tres momentos en los que no vas a quedar mal»
- «La plataforma completa, en cuatro dimensiones»
- «Así se ve un mes con Vivaru»
- «6 razones para elegir Vivaru»

Son buenos titulares de presentación comercial y malos encabezados de SEO. Los
`H2` son la segunda señal más fuerte de una página sobre de qué trata.

### Qué cambiar, sin perder la voz de marca

La marca puede seguir en el titular visible; lo que tiene que cambiar es el
`<title>`, la descripción y una parte de los `H2`.

```
title:  Software de administración de condominios y conjuntos — Vivaru
        (categoría primero, marca al final)

H1:     Administra tu conjunto residencial sin WhatsApp ni Excel
        (contiene la categoría y el dolor, y sigue sonando a Vivaru)
```

Y reescribir tres o cuatro `H2` hacia la consulta:

| Ahora | Propuesta |
|---|---|
| «La plataforma completa, en cuatro dimensiones» | «Todo lo que necesita la administración de un condominio» |
| «Así se ve un mes con Vivaru» | «Cómo se administra la cartera y las cuotas de mantenimiento» |
| «Cada conjunto, su propio sistema» | «Software para administrar varios conjuntos residenciales» |

Y decir **dónde opera**. Que México no aparezca ni una vez en un producto que
se vende en México es el hallazgo más caro de esta auditoría.

---

## 3. No hay superficie donde posicionar

El sitio tiene **seis páginas**, y de ellas tres son legales:

```
/mx            el landing — única página de contenido real
/diagnostico   captación
/legal/datos · /legal/terminos · /legal/privacidad
```

Una sola página no puede posicionar para varias intenciones distintas, por bien
escrita que esté. Google necesita una página por intención.

Las familias que el producto ya sabe cubrir —**a validar con datos de demanda
antes de construir**—:

- **Por categoría y país:** software de administración de condominios (México),
  administración de propiedad horizontal (Colombia)
- **Por módulo, que es donde está la demanda larga:** control de acceso y
  visitantes, reservas de amenidades, cartera y cuotas, PQRS
- **Precios.** Hoy la sección está comentada en `mx/page.tsx:13`. Es una de las
  consultas con más intención de compra de toda la categoría, y no existe.
- **Comparativas y alternativas**, que es como se busca en fase de decisión

---

## 4. Motores de respuesta (ChatGPT, Perplexity, Google AI)

Aquí el sitio parte peor que en buscadores clásicos, y por una razón concreta:
**no hay una sola marca de datos estructurados**.

```
scripts JSON-LD en la página: 0
/llms.txt: 404
```

Un modelo que quiera responder «¿qué software uso para administrar mi conjunto
en México?» necesita poder extraer hechos. Hoy tiene que inferirlos de prosa de
marketing, y por eso puede citar a un competidor que sí los declara.

**Qué falta, por orden de rentabilidad:**

1. **`FAQPage`.** Es lo más rentable del sitio entero. Ya existen seis preguntas
   reales y bien escritas —«¿Funciona para conjuntos de casas o solo edificios?»,
   «¿Qué tan rápido entra en operación?»— y no están marcadas. Marcarlas es
   media hora y las vuelve extraíbles y citables.
2. **`Organization`** — qué es Vivaru, dónde está, cómo se contacta.
3. **`SoftwareApplication`** — categoría, sistema operativo, precio. El precio
   es lo que más se pregunta y lo que hoy no se puede responder.
4. **`llms.txt`** — un resumen en texto plano de qué es el producto, para quién,
   en qué países y qué lo diferencia.

**Lo que un modelo no puede responder hoy sobre Vivaru:** en qué países opera,
cuánto cuesta, y qué lo distingue de un competidor. Las tres son preguntas de
comparación, que es exactamente el momento en el que la gente pregunta a un
modelo en vez de a un buscador.

---

## 5. Orden recomendado

| # | Qué | Esfuerzo | Por qué primero |
|---|---|---|---|
| 1 | Apex → 301 a `www`, y arreglar `metadataBase` | bajo | pierde enlaces y autoridad ahora mismo |
| 2 | `/` con 308 en vez de 307 | muy bajo | una línea |
| 3 | `title`, `description` y `H1` con la categoría | bajo | mayor impacto por unidad de esfuerzo |
| 4 | JSON-LD: `FAQPage`, `Organization`, `SoftwareApplication` | bajo | desbloquea los motores de respuesta |
| 5 | `canonical`, `og:image`, `sitemap.xml`, `alt` que faltan | bajo | higiene |
| 6 | Reescribir tres o cuatro `H2` y mencionar los países | medio | refuerza el 3 |
| 7 | Publicar precios | medio | decisión comercial, no técnica |
| 8 | Páginas por intención | alto | requiere validar demanda primero |

Del 1 al 5 es una tarde y no toca diseño ni copy visible salvo el `H1`. Del 6 en
adelante hay decisiones de negocio: qué mercados priorizar y si se publican
precios.
