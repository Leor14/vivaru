# Simulación de cargas de archivo

Banco para meterle al importador archivos raros **construidos a propósito**, y ver qué hace.

```bash
npx tsx scripts/simulacion-de-cargas/construir.ts   # especificaciones → archivos reales
npx tsx scripts/simulacion-de-cargas/correr.ts      # archivos → qué ve el asistente
```

## Qué contesta, y qué NO

**Contesta preguntas de CORRECTITUD.** ¿Revienta con un BOM? ¿Elige la hoja buena cuando
«Saldos» va primera? ¿Conserva los ceros a la izquierda de un documento? ¿Qué hace con un
título que ocupa dos celdas? Para eso, un archivo inventado vale exactamente igual que uno
real: **el código no sabe de dónde vino.**

**NO contesta preguntas de FRECUENCIA.** Con qué asiduidad un padrón real trae el nombre
partido, o cuántos clientes exportan en punto y coma, **esto no lo dice y no puede decirlo**.
Eso sigue esperando archivos de un cliente de verdad — ver `docs/exploracion-ai-onb-001.md`,
que ya avisaba de lo mismo sobre sus propias sondas: «NO es corpus».

**Confundir las dos cosas sería el error caro:** tener treinta archivos que pasan no significa
que el importador esté listo para el primer cliente; significa que treinta formas conocidas de
romperlo ya no lo rompen.

## En qué se diferencia de las sondas de `AI-ONB-001`

Las sondas (`scripts/sondas-ai-onb-001/`) parten de **arreglos de encabezados escritos a
mano**, así que se saltan el lector entero. Esto empieza en los **bytes**, que es donde
muerden el título encima, el BOM, el fin de línea, la hoja equivocada y los encabezados
repetidos.

## Añadir un caso

Un JSON en `casos/`, y nada más. La interfaz está declarada en `construir.ts`; los dos
ejemplos de referencia son `00-control-limpio.json` (el control: si ESE falla, lo roto es el
banco) y `01-titulo-encima.json`.

El campo que hace útil el caso es **`queDeberiaPasar`**: la expectativa de quien lo escribió,
en una frase. Lo interesante no es la lista de casos que pasan — es **dónde lo medido no
coincide con lo esperado**.

## Dónde termina

El corredor llega hasta el mapeo y sus avisos. La validación por fila —correo, rol, si la
unidad existe— vive dentro de los componentes y no se alcanza sin arrastrar React, así que un
`✔` de aquí significa «el asistente sabría qué columna es cada cosa», **no** «entraría».
Para eso, el archivo se sube a mano por el navegador.

**Y un espejo conocido:** la lista de roles aceptados está copiada en `correr.ts` desde
`ROLE_ALIASES`, que vive dentro del asistente de residentes. Los tipos de unidad sí salen de
su catálogo (`src/lib/units/tipos.ts`). Si se añade un rol allí y no aquí, esta sonda mide de
menos.
