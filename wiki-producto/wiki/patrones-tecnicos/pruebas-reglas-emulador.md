---
tags: [patron, pruebas, firebase, seguridad]
tipo: herramienta
fuentes: ["CLAUDE.md", "tests/firestore.rules.test.ts"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-27
---

# Pruebas de reglas con el emulador

`tests/firestore.rules.test.ts` es la única red que verifica que [[multi-tenancy]] se cumple de verdad. Estuvo **meses sin ejecutarse** y nadie lo notó, porque sus fallos se archivaban como «preexistentes». La causa era trivial: el emulador no arranca sin Java, y Java no estaba.

## Cómo se corre

Java vive local al usuario, sin sudo, en `~/.local/java/`:

```bash
export JAVA_HOME="$HOME/.local/java/jdk-21.0.12+8-jre/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
firebase emulators:start --only firestore --project hogaru-1-test   # en otra terminal
npx vitest run --dir tests tests/firestore.rules.test.ts
```

## Dos trampas

**`firebase emulators:exec "npx vitest ..."` no sirve.** La CLI corre el script con su Node empaquetado, que no puede cargar el ESM de vitest. El emulador hay que levantarlo aparte, en otra terminal.

**`--dir tests` no es opcional si hay worktrees.** Con copias del repositorio en `.claude/worktrees/`, vitest recoge también sus versiones del archivo. Comparten emulador y chocan entre sí con los mismos IDs de documento. Provocaba fallos fantasma en suites que no tenían nada que ver — eliminar un worktree abandonado bajó los «fallos preexistentes» de 9 a 5.

## Lo que apareció al encenderlo

En cuanto el emulador corrió, la prueba de [[reservaciones]] falló: exigía un `startAt` que la aplicación sí envía, y usaba una fecha en el pasado. Llevaba rota desde antes de que nadie recordara. Se corrigió con una fecha relativa.

La lección no es sobre Java. Es que **una prueba que no se ejecuta es peor que ninguna**, porque ocupa el lugar mental de la verificación sin hacerla. Encaja con lo que registra [[trampas-conocidas]] sobre errores que se normalizan.

Correrla es la condición mínima, no la verificación. Que una prueba pueda enrojecer —y que enrojezca exactamente la que debe cuando se rompe el código a propósito— es lo que la hace valer: el método está en [[falsacion-de-pruebas]].

## Para qué se usa

Es el gate de todo cambio en `firestore.rules`. Sirvió para verificar las 52 aplicaciones de `tenantOperable()` descritas en [[ciclo-de-vida-tenant]], y el bloque de permisos de [[soporte]] —incluida la subcolección de notas internas, que existe precisamente porque las reglas no filtran campos, como explica [[firebase-firestore]]—.

Cuando una prueba antigua falla tras un cambio de diseño, la respuesta correcta es **reescribirla, no borrarla**. `imp07-support-module.test.ts` falló tres veces y las tres con razón: fijaba el catálogo en inglés, la escritura directa y el alta manual, todo lo que el nuevo contrato eliminó. Ver [[portafolio-prd]].

## Orden de despliegue

Reglas → functions → front. Al revés, la interfaz llama a lo que todavía no existe. Es la secuencia que siguen todos los módulos, de [[billing]] a [[soporte]].
