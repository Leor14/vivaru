# Pendientes

Índice de traspaso, no resumen. Cada línea apunta a dónde está el detalle.
Actualizado el 8 de agosto de 2026.

## Listo para promocionar

- **SEO técnico y datos estructurados** — en `develop` (`875db2e`), verificado
  en un build de producción, **sin promocionar**. Producción sigue con el título
  viejo y `/sitemap.xml` en 404. Detalle en `docs/auditoria-seo-y-llm.md`.

## Necesitan consola, no código

- **El apex `grupovivaru.com` devuelve 404.** Registro A y certificado
  correctos; falla solo la verificación de propiedad, porque el TXT tiene un
  token viejo. **Estos dos valores no están escritos en ningún otro sitio:**

  ```
  quitar:  fah-claim=002-02-30634e11-5bdb-4497-8f2b-bfbac3583c19
  añadir:  fah-claim=002-02-d6e6e2d2-f549-4bd2-b2fe-e34695e9f910
  ```

  No tocar el registro A. **No borrar y volver a añadir el dominio en App
  Hosting:** cada alta genera un token nuevo y reproduce el fallo. La zona DNS
  no está en ninguno de los siete proyectos accesibles con `dev@qintilab.com`;
  probablemente esté bajo `luisEOteroR@gmail.com`. Estado consultable con
  `GET firebaseapphosting.googleapis.com/v1beta/…/backends/vivaru/domains`.

- **Dimensiones personalizadas de GA4** sin registrar: `entorno`, `section` y
  `cta`. Se recogen pero no son consultables, y GA4 no rellena hacia atrás.
  Topología de propiedades y cuentas en la memoria `analitica-ga4-vivaru`.

- **URL de acción de Firebase Auth** — pendiente desde antes, requiere la cuenta
  Owner. Ver `CLAUDE.md`, sección de estado actual.

## Seguridad

- **Rotar cinco credenciales de producción** pegadas en el chat el 8 de agosto
  (admin, portería y tres residentes del conjunto Las Playas, dominio
  `david.macar.18+*@hotmail.com`).

## Deuda menor, del app autenticado

- `src/lib/firebase/client.ts:20` incrusta el `measurementId` de producción como
  respaldo, contradiciendo la política que documenta `config.ts`. Al lado, un
  `projectNumber` de producción que también se aplica corriendo contra staging.
  Una línea cada uno; tocarlos obliga a verificar los portales.

## Contenido

- Dos capturas del deck siguen vacías: `residente-08-documentos` y
  `residente-04-visitantes`. Las dos porque el portal del residente no muestra
  lo que crea el administrador — es una limitación del producto, no del script.

## Decisiones de negocio, no técnicas

- Puntos 6 a 8 de `docs/auditoria-seo-y-llm.md`: reescribir tres o cuatro `H2`,
  publicar precios y crear páginas por intención. El punto 8 exige validar
  volúmenes de búsqueda antes de construir nada.
- El fondo del hero se mueve 23,3 en escritorio y 9,1 en móvil. No es un fallo
  —la sección vertical deja menos superficie libre—, pero si molesta se trata
  aparte con su propia consulta de medios.
