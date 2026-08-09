# Auditoría AEO/GEO — nota base de www.grupovivaru.com

**Medido:** 8 de agosto de 2026 · **Páginas rastreadas:** 8 · **Herramienta:**
`audit-website-aeo` (onvoyage-ai/gtm-engineer-skills, MIT)

Esta es la **línea base**: el número contra el que comparar todo lo que venga
después. Se midió sobre **producción**, que hoy corre `master` — es decir, sin el
trabajo de SEO técnico que lleva desde el 8 de agosto parado en `develop`
(`875db2e`). Ver `docs/auditoria-seo-y-llm.md` y `docs/pendientes.md`.

## Puntuación

| | Nota | |
|---|---|---|
| Fundamentos (16 comprobaciones deterministas) | 34/100 | |
| Inteligencia (6 dimensiones, evaluadas leyendo las páginas) | 53/100 | |
| **Final** | **44/100** | **Nota: D** |

Un motor de respuesta que aterrice hoy en el sitio puede leerlo, pero no tiene de
dónde extraer hechos: no hay una sola marca de datos estructurados en las ocho
páginas, ni fechas, ni autor.

## Fundamentos — 5 de 16 comprobaciones

Las que **fallan**, por puntos perdidos:

| | Comprobación | Pts | Detalle |
|---|---|---|---|
| ✗ | Datos estructurados presentes | 8 | 0/8 páginas |
| ✗ | Tipos de schema reconocidos | 8 | 0/8 páginas |
| ✗ | `llms.txt` válido | 10 | no existe |
| ✗ | URL canónica | 8 | 0/8 páginas |
| ✗ | Profundidad de contenido (250+ palabras) | 12 | 5/8 páginas |
| ✗ | Feed RSS/Atom | 8 | no existe |
| ✗ | Enlazado interno (5+ enlaces) | 10 | 6/8 páginas |
| ✗ | Cobertura de `alt` en imágenes | 8 | 4/8 páginas |
| ✗ | Un solo `H1` | 8 | 6/8 páginas |
| ✗ | Open Graph básico | 8 | 6/8 páginas |
| ✗ | Estructura de encabezados | 6 | 5/8 páginas |

Las que **pasan**: título (10), meta descripción (10), indexabilidad (10),
etiquetas meta accesibles a IA (6) y acceso de bots de IA (12) — ningún rastreador
de IA está bloqueado en `robots.txt`, que es la que más cara habría salido.

## Inteligencia — 6 dimensiones

**Preparación para responder — 3/5.** El landing tiene un FAQ real con seis
preguntas que se responden directas, y encabezados en forma de pregunta
(«¿Cómo opera tu conjunto hoy?»). Pero ninguna página abre con una definición: el
`H1` es un lema de marca y el primer párrafo es propuesta de valor, no
«Vivaru es un software de…». *Hay respuestas, pero no lideran.*

**Citabilidad — 3/5.** Varios párrafos se sostienen solos —las tres afirmaciones
de «Tres momentos» son bloques limpios de 40-60 palabras— y las páginas legales
son muy citables por su numeración. No hay ni una tabla comparativa, que es el
formato que más se cita. *Se puede citar, pero no hay tablas ni bloques de datos.*

**Densidad de evidencia — 2/5.** El landing **no tiene estadísticas a propósito**:
los porcentajes del ImpactBand se retiraron porque no tenían fuente. Los números
que quedan son ilustrativos (la maqueta de cartera) o de proceso («72 horas»,
«15 días»). Sin autor, sin fuentes externas. Contrasta con las páginas legales,
que citan leyes y decretos con precisión y son lo más sólido del sitio en esta
dimensión. *La nota baja aquí es en parte una decisión deliberada, no un fallo.*

**Profundidad — 3/5.** El landing cubre muchos subtemas en 1.264 palabras: amplio
y poco hondo en cada uno. Las legales sí son exhaustivas. Con seis páginas y sin
blog ni documentación, no hay corpus del que extraer. *Amplio en el landing, sin
ninguna página de referencia.*

**Frescura — 1/5.** Cero señales de fecha en metadatos: ninguna página declara
publicación ni modificación. Las legales dicen «Versión 1.0 · Mayo 2026» en el
cuerpo, que es algo, pero no hay feed ni evidencia de mantenimiento. *Sin fechas,
un modelo no puede citar con confianza.*

**Claridad estructural — 4/5.** Lo mejor del sitio. Jerarquía `H1→H2→H3` limpia en
el landing, secciones semánticas, y las legales tienen un esquema numerado
excelente. Baja de 5 porque dos páginas no tienen un `H1` único. *Estructura
limpia; dos páginas rompen la regla del H1.*

Media: 2,67 → **53/100**.

## Arreglos por prioridad

**1. Promocionar `develop` a `master`.** Cuatro de las once comprobaciones que
fallan —schema, tipos de schema, `llms.txt` y canónica, **34 de 142 puntos**— ya
están resueltas en `875db2e` y llevan un mes sin desplegarse. Es el mayor salto
por unidad de esfuerzo del sitio entero, y no requiere escribir una línea.

**2. Dar metadatos a `/login` y `/registro`, o sacarlas del índice.** Es el
hallazgo no obvio de esta auditoría. Las dos viven en el route group `(auth)`, no
heredan el layout de `(marketing)` y por tanto no tienen canónica, ni Open Graph,
ni datos estructurados — y `robots.ts` bloquea `/admin`, `/resident`, `/guard`,
`/superadmin` y `/api/`, pero **no** a ellas. Son 2 de las 8 páginas rastreadas, y
una comprobación solo pasa a nivel de sitio con el **80 %**: 6 de 8 es 75 %. Es
decir, **aunque se promocione `develop`, schema y canónica seguirán fallando** por
culpa de esas dos páginas. Además son las dos peores del sitio (44 % y 52 %).

Decisión asociada: `/login` no aporta nada a un buscador y debería llevar
`noindex`. `/registro` es lo contrario — es la página de conversión del trial y
merece metadatos propios, no exclusión.

**3. Abrir con una definición.** Ninguna página dice qué es Vivaru en una frase
extraíble. Un párrafo de apertura del tipo «Vivaru es un software de administración
de condominios y conjuntos residenciales para México, Colombia y Ecuador que…» es
lo que un motor de respuesta cita literalmente. Barato y con efecto en dos
dimensiones a la vez (preparación para responder y citabilidad).

**4. Señales de fecha.** Es la dimensión más baja (1/5) y la que más pesa en los
motores de respuesta. Publicar `dateModified` en el schema del landing y de las
legales resuelve la mitad sin crear contenido nuevo.

**5. `hreflang` y `lang` por país.** No lo mide esta herramienta —no comprueba
ninguno de los dos— pero es un hueco real: hoy `<html lang="es">` genérico, y el
producto se vende en tres países. Bloqueado hasta que existan `/co` y `/ec`.

**6. Feed RSS y sección de documentación.** Valen 8 puntos y una recomendación
fija, pero ambas presuponen que se va a publicar contenido con regularidad. Un
feed vacío no sirve: es decisión de contenido antes que arreglo técnico.

## Páginas más débiles

| Nota | Página |
|---|---|
| 44 % | `/login` |
| 52 % | `/registro` |
| 54 % | `/diagnostico` |
| 80 % | `/legal/privacidad` |
| 80 % | `/legal/terminos` |

El landing `/mx` es la mejor del sitio (79 % como `home`).

## Recomendación

La mayor oportunidad no es escribir nada: es **desplegar lo que ya está escrito**,
y de paso decidir qué hacer con las dos páginas de `(auth)` que están arrastrando
las comprobaciones a nivel de sitio. Con esas dos cosas, los fundamentos suben de
34 a un entorno de 70 y la nota final pasa de D a C+/B-, sin tocar copy.

Volver a correr esta misma auditoría después del despliegue para medir el salto —
ese es el propósito de tener una línea base.

## Cómo reproducirla

```bash
node ~/.claude/skills/audit-website-aeo/scripts/aeo-audit.mjs \
  https://www.grupovivaru.com/mx --max-pages=10 --out=aeo-audit.json
```

Nota metodológica: la mitad determinista es reproducible; la de inteligencia la
puntúa un modelo leyendo las páginas y puede variar entre corridas. Los umbrales
de la rúbrica salen de estudios sobre corpus **en inglés y mercado
estadounidense** — sirven como dirección, no como meta numérica para es-MX.
