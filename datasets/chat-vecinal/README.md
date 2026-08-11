# Corpus: chat vecinal anonimizado

**5.158 mensajes reales de un grupo de residentes**, de abril de 2024 a agosto
de 2026, 85 participantes. Es material de trabajo para el programa de IA — ver
`docs/hoja-de-ruta-ia.md`.

## Para qué sirve, y por qué es difícil de conseguir

El plan lo dice sobre PQRS: *«un ticket que escribe un modelo sale demasiado
limpio y demasiado bien redactado, así que un clasificador que acierta con ellos
no acierta con lo que escribe un residente enfadado a las once de la noche»*.

**Esto es ese registro.** No son tickets —no traen categoría, ni estado, ni
resolución— pero son la voz que ningún modelo imita: mensajes que mezclan tres
asuntos, a los que les falta el dato crítico, escritos con prisa o con enfado.

Dos usos previstos:

- **`FEAT-003`, el canario.** El grupo se llama «Avisos administración» y
  contiene comunicaciones reales escritas por un administrador. Alimenta el
  conjunto de evaluación del Paso 2.2.
- **`FEAT-002`, PQRS.** Permite diseñar las categorías con frecuencias
  observadas en vez de con intuición. No sustituye a los 150–250 tickets reales
  que el paso 3 sigue necesitando.

## Qué se le hizo

Dos pasadas, por herramientas distintas:

1. **Sustitución de nombres** (herramienta previa, fuera de este repo). Cambió
   los nombres de las personas por otros. **No tocó nada más.**
2. **`scripts/anonimizar-chat-vecinal.mjs`** (este repo, reproducible). Porque
   un nombre falso al lado de «H402» no anonimiza a nadie: para cualquiera de
   ese edificio, el número de departamento *es* el nombre.

Lo que hizo la segunda pasada, verificado antes y después:

| | Antes | Después |
|---|---|---|
| Identificadores de departamento | 1.169 | 0 |
| Remitentes con departamento en el nombre | 6 | 0 |
| Correos | 27 | 0 |
| Teléfonos | 10 | 0 |
| Menciones al edificio y a la administradora | 49 | 0 |
| Rutas de URL (se conserva el dominio) | 14 | 0 |

Los departamentos se mapearon a códigos falsos **consistentes entre el cuerpo y
el nombre del remitente** —si no, los hilos de conversación dejarían de cuadrar—,
**por hash y no por orden alfabético** —un mapeo ordenado lo revierte cualquiera
que tenga el listado del edificio— y **cambiando el formato** (`H402` → `T2-08`)
para que la estructura del original no se trasluzca.

**El mapeo no se guardó.** Sin él, este archivo no se puede revertir.

## Qué se conservó, a propósito

Los 5.158 mensajes, los 103 importes, las fechas y las horas. Son el contenido
que hace útil el corpus y no identifican a nadie.

Y los números de emergencia: «llama al 911» sigue diciendo 911. Mapearlos habría
dejado un aviso de seguridad apuntando a un número inventado.

## Cómo regenerarlo

El archivo de origen **no está en el repositorio y no debe estarlo**. Vive en el
disco de quien lo aportó.

```bash
node scripts/anonimizar-chat-vecinal.mjs <origen.txt> datasets/chat-vecinal/chat-anonimizado.txt
```

## Lo que hay que saber antes de usarlo

- **Es un corpus de UN edificio**, en Ciudad de México. Lo que aquí es frecuente
  puede no serlo en Bogotá o en Quito. Sirve para descubrir categorías y
  registro, no para fijar frecuencias como si fueran del mercado.
- **La mediana de mensaje son 40 caracteres**: la mayor parte es «gracias» y
  «👍». El material aprovechable son los ~348 mensajes de más de 200 caracteres
  y las ~419 preguntas.
- **No es un conjunto de evaluación todavía.** Un conjunto de evaluación lleva
  la respuesta esperada escrita de antemano; esto es materia prima.
