---
tags: [diseno, animacion, navegacion]
tipo: tecnica
fuentes: ["sesion-onboarding-2026-07", "DESIGN.md"]
fecha_creacion: 2026-08-01
fecha_actualizacion: 2026-08-01
---

# Transiciones de navegación — el velo con el logo

Un velo a pantalla completa con el logo de Vivaru al centro y el fondo difuminado, mientras la aplicación cambia de sección. Dura menos de un segundo.

## Por qué existe

En [[onboarding-guiado]], seleccionar un paso llevaba a otra pantalla de forma tan abrupta que no parecía una redirección: parecía que la página había cambiado sola. El salto era demasiado rápido para leerse como causa y efecto.

El velo no está ahí para decorar. Cubre el hueco entre la intención y el resultado, que es el propósito legítimo de una animación de navegación: **evitar un cambio brusco que se lee como un fallo**.

## Dónde se aplica

- Al avanzar entre pasos de la guía de puesta en marcha.
- Al iniciar sesión, con cualquier tipo de cuenta. Es el momento con más espera real detrás —resolución de rol y destino— y el que más se beneficia.

Deliberadamente **no** se aplica a la navegación cotidiana del [[dashboard-admin]] ni entre módulos. Una animación que se ve decenas de veces al día deja de ayudar y empieza a estorbar: la frecuencia de uso es el primer criterio para decidir si algo debe animarse.

## Cómo se construye

Difuminado por debajo de 20px —más es caro, sobre todo en Safari— y `ease-out`, que arranca rápido y se siente responsivo. `ease-in` a la misma duración *parece* más lento, porque retrasa el movimiento justo en el instante que el usuario está mirando.

Solo se animan `transform` y `opacity`, la regla de [[animaciones]] que evita disparar layout y paint. El velo respeta `prefers-reduced-motion`.

## El resto de la interfaz

La guía se rehízo en el mismo trabajo, porque el layout parecía «SAP de hace muchos años»: cada fila de acción lleva ahora indicador de completado a la derecha, y los apartados posteriores adoptaron el mismo lenguaje visual en vez de conservar la identidad anterior. Sigue [[layout-patterns]] y los tokens de [[tokens-color]].

El mismo trabajo destapó **20 variables CSS usadas y nunca declaradas** —`--slate-400`, `--slate-50`, `--slate-800`, `--brand-100`, `--brand-300` y las escalas de error y advertencia—. Un token no declarado no falla ruidosamente: el color simplemente no se aplica y el texto queda sin contraste. Se declararon todas calculando tono y contraste.

Un hallazgo del barrido merece registro: `--radius-md` **no** faltaba. Tailwind v4 lo provee con valor `.375rem`, y la salida del build lo demostró — el override que había añadido sobraba y se retiró. Es el tipo de suposición que [[tailwind-v4-spacing-fix]] enseña a verificar contra el build antes que contra la intuición.

Ver también [[componentes]] y [[absolute-bans]], que prohíbe `transition: all`.
