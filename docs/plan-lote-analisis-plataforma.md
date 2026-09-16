# Plan — lo que sale del lote «Análisis de la plataforma»

> **Qué es.** El orden de trabajo del lote valorado el 15 sep 2026
> (`docs/valoraciones/lote-2026-09-15-analisis-plataforma.md`), partido en tareas pequeñas, cada una con
> sus criterios, su comprobación y lo que espera de David.
>
> **Estado al 15 sep 2026: APROBADO por David, con sus respuestas a §7.** Todavía no se ha construido
> nada. Va primero la fase 0; el apartado del roadmap (`docs/roadmap-producto.md`, «Lote "Análisis de la
> plataforma"») se escribió antes, a petición de David.
>
> **Reglas de siempre:** commit y push solo con el sí de David; datos, banderas y reglas de producción,
> con permiso en cada paso; una sola sesión que escriba; **firebase siempre con `--project`**. El CLI de
> firebase está caducado: antes de desplegar reglas o functions, David corre `firebase login --reauth`.

---

## 0. En una página

- **Primero se arregla el modelo, después se recalcula.** La regla de confianza no es monótona (§1.1),
  y recalcular con ella el «es prospecto» de David ordenaría el lote peor que antes.
- **Los defectos se reproducen en el emulador, no en staging.** Así no se escribe ningún dato de
  prueba: cada reproducción queda como una prueba que hoy falla y que el arreglo pondrá en verde.
  Staging se usa al final, para verlo con los ojos.
- **Lo que más pesa es D-2b, descubierto al planificar:** cualquier residente del conjunto puede leer
  un comunicado dirigido a otras unidades. La regla de `communications` es la comodín (`sameTenant`) y
  el destinatario solo se filtra en el navegador (§2).
- **Seis fases**, con un control después de cada una:

  | Fase | Qué |
  |---|---|
  | 0 | Modelo v0.4 y recálculo |
  | 1 | Reproducir |
  | 2 | Lo obligatorio |
  | 3 | Lote XS |
  | 4 | Defectos construibles ya |
  | 5 | Datos de producción |

  Las decisiones B no son tareas: cada una abre su propio plan cuando David decida (§6).
- **Unas 13 horas de trabajo activo**, en tres o cuatro sesiones, más las esperas de David.

---

## 1. Decisiones de método

### 1.1 Por qué el modelo va primero

La confianza de §5.4 es la de **la prueba más débil entre las estimaciones con nota 2 o 3**. Con el
Ingreso 2 del «es prospecto» (0,8), el recálculo pasa esto:

- las necesidades cuyo único 2 pasa a ser el Ingreso (L-05, L-06, L-07, L-09, L-13, L-14, L-26, L-27 y
  L-28) **suben de 0,5 a 0,8**;
- las que ya tenían otro 2 con prueba leída (L-08, L-22, L-23) **se quedan en 0,5**.

**Tener más pruebas baja la nota.** Propuesta de la v0.4: **cada estimación se multiplica por su propio
nivel**, `E = Σ peso × nota × nivel`, en vez de un factor común. Es monótona por construcción: subir una
nota o su prueba nunca baja el impacto.

### 1.2 Cómo se reproduce y cómo se arregla

1. **Primero, una prueba que describe lo correcto y hoy falla.** Esa es la reproducción, y el arreglo es
   ponerla en verde (TDD). **Falsación:** revertir el arreglo y ver que enrojece exactamente esa prueba.
2. **Los bancos:** `npm test`, `npm --prefix functions test`, `npm run test:rules:all` (emulador de
   Firestore y Storage) y `npm --prefix functions run test:emulator`. Además, los typechecks de la app y
   de functions en 0.
3. **Un fichero nuevo `*.rules.test.ts` va en las DOS listas**: el `include` de `vitest.rules.config.ts`
   y el `exclude` de `vitest.config.ts`. Lo vigila `tests/bancos-de-reglas-en-las-dos-listas.test.ts`.
4. **Orden de despliegue según el delta:** si la regla **restringe**, primero el front o las functions
   que ya cumplen la regla nueva, y la regla al final. Antes, se mide el radio.
5. **Verificar lo desplegado:** las reglas con `verificar-reglas-desplegadas.mjs`, las functions por su
   `updateTime`, el front por el build que sirve. «Deploy complete» no prueba nada.

---

## 2. D-2b: lo que se encontró al planificar

- `communications` no tiene bloque propio en `firestore.rules`. Cae en `match /{collection}/{docId}`
  (~l.553), cuya lectura es `sameTenant`: **cualquier miembro del conjunto**.
- La audiencia (`audienceUnitIds`, VIV-401) se filtra **solo en el navegador**
  (`src/app/(resident)/resident/communications/page.tsx:86`).
- El banco de reglas lo da por bueno: «permite lectura al residente de su tenant»
  (`tests/firestore.rules.test.ts:588`).
- **Y el aviso tampoco mira la audiencia (D-2):** `onCommunicationCreated`
  (`functions/src/index.ts:3156`) avisa a `listTenantUidsByRoles(tenantId, ["resident"])`, con el título
  del comunicado.

**Por qué el arreglo no es una línea.** Las reglas no filtran, rechazan: una consulta del residente que
no pueda demostrar que cada documento es suyo se rechaza entera. Hace falta:
- una forma de consultar que la regla pueda comprobar, por ejemplo `audienceKeys` con un comodín `"*"`
  para «todos» y `array-contains-any ["*", unitId]`;
- rellenar los comunicados existentes;
- desplegar el front antes que la regla.

Tamaño parecido a FLOW-004 (reglas que restringen, relleno en los dos ambientes): **unas 2,5 h**.

---

## 3. Grafo de dependencias

```
v0.4 del modelo ──► recálculo ──► orden definitivo de las decisiones B (§6)

Emulador (JDK en ~/.local/jdk) ──► Fase 1: reproducciones ──► control B: ¿qué es obligatorio?
                                                                  │
            D-2b (lectura por audiencia) ◄────────────────────────┤
                 └─► D-2 (avisos por audiencia) ─► D-1 (aviso de mora solo a los deudores)
            D-3 (categoría de Documentos) ◄────────────────────────┘

L-08a (salida del frecuente) ──► L-10 (servicios con horario, decisión B)
L-32 (FAQ y emergencia, decisión B) ──► L-32b (chatbot, C)
Lote XS, L-21d y L-29: independientes
Datos de producción (L-04, L-27): independientes; cada uno, con su permiso
```

---

## 4. Tareas

### Fase 0 · Modelo v0.4 y recálculo *(solo documentos; ~1 h)*

**T0.1 · Confianza por criterio.** Cambiar §5.4 y §7.1 a `E = Σ peso × nota × nivel`.
- **Criterios:** es monótona por construcción, y la tercera calibración conserva sus cuadrantes con el
  umbral de 4. *(Aquí decía «las 18 referencias mantienen su orden (ρ ≥ 0,9)», pero la confianza solo
  toca el impacto: el esfuerzo y su orden no cambian.)* **Hecho el 15 sep**: tres Ganancias rápidas y
  tres Rellenos, como con la v0.3.
- **Comprobación:** tabla antes y después en `docs/valoraciones/`.
- **Depende de:** el sí de David a §7.1.
- **Ficheros:** `docs/modelo-de-priorizacion.md`.

**T0.2 · Las definiciones que salieron del lote.**
- «Una administradora que evalúa por escrito cuenta como prospecto» (decidido el 15 sep).
- De los ocho hallazgos del lote (§6), los que David apruebe: Cierre para mejorar algo cerrado; la clase
  «ya existe y no se ve»; una referencia de solo datos o de encender una bandera; Día uno por país.
- **Criterio:** cada definición con su nota y un ejemplo del lote.
- **Depende de:** §7.2.

**T0.3 · Recalcular el lote.** Pasar las notas de las 31 fichas a una tabla y calcular con un script en
el scratchpad, no a mano.
- **Criterio:** el lote dice la versión del modelo y el orden nuevo; se anota qué filas cambiaron de
  cuadrante y por qué.
- **Depende de:** T0.1 y T0.2.
- **Ficheros:** `docs/valoraciones/lote-2026-09-15-analisis-plataforma.md`.

> **Control A.** David aprueba la v0.4 y el orden nuevo. Commit.
>
> **Fase 0 hecha el 15 sep; espera el control A.**
> - La v0.4 está en el modelo, con la confianza por criterio y las cuatro definiciones.
> - El lote está recalculado con un script que primero reproduce las 37 valoraciones de la v0.3 sin
>   ninguna diferencia.
> - **El umbral de impacto se queda en 4**: con la v0.4, la tercera calibración conserva sus cuadrantes.
> - El lote pasa de 4 a **6 Ganancias rápidas**: entran L-23 y L-10.

### Fase 1 · Reproducir *(emulador, sin datos; ~1,5 h)*

**T1.1 · D-2b y D-2.**
- Prueba de reglas: un residente de la unidad B no puede leer un comunicado con `audienceUnitIds: [A]`.
  **Hoy pasa**, y eso reproduce el agujero.
- Prueba de emulador del disparador: un comunicado dirigido solo avisa a su audiencia. **Hoy avisa a
  todos.**
- **Ficheros:** un `tests/*.rules.test.ts` nuevo (en las dos listas) y un
  `functions/tests/*.emulator.test.ts` nuevo.

**T1.2 · D-3.** Prueba de que un documento subido con la categoría por defecto no lo lee un residente.
**Hoy lo lee**: la categoría por defecto es «otro» (`documents/page.tsx:73`), y «otro» está en la lista
blanca (`firestore.rules:1325`). Además, **medir en solo lectura** cuántos documentos «otro» hay en los
dos ambientes y de qué son: es el radio de cualquier arreglo.

**T1.3 · D-1.** Prueba de que el aviso masivo de Cartera crea un comunicado con la audiencia de las
unidades elegidas. **Hoy no la lleva** (`billing/page.tsx:1255`). Para eso, sacar la construcción del
comunicado a una función que se pueda probar.

**T1.4 · L-08a.** Prueba de reglas: la portería puede pasar un pase de larga duración de `inside` a
`scheduled`. **Hoy lo niega**, porque la regla solo acepta `inside→completed`
(`use-visitor-passes.ts:412` pide `scheduled` si el pase es reentrable).

> **Control B.** Las cuatro pruebas en rojo, cada una por la causa esperada. **David decide qué es
> obligatorio** (§7.3): D-2b, y D-3 según su radio.
>
> **Fase 1 hecha el 15 sep; control B pasado.**
> - **Cinco reproducciones con `it.fails`** (el plan decía cuatro: D-2b y D-2 van por separado). Cada
>   una se convirtió un momento a `it` normal para comprobar que falla por su causa:
>   - `tests/comunicados-audiencia.rules.test.ts` (D-2b);
>   - `functions/tests/comunicado-avisos-audiencia.emulator.test.ts` (D-2, con `.run()` sobre el
>     disparador);
>   - `tests/aviso-de-mora-audiencia.test.ts` (D-1);
>   - `tests/documentos-categoria-por-defecto.test.ts` (D-3);
>   - `tests/visitante-frecuente.rules.test.ts` (L-08a, con el límite de que un pase puntual no puede
>     volver a `scheduled`).
> - **Cambio sobre T1.3:** D-1 se reproduce leyendo el código, sin sacar todavía la función. La
>   extracción va con su arreglo (T2.3).
> - **Radio de D-3** (`scripts/contar-documentos-por-categoria.mjs`): 2 documentos «otro» en producción
>   (el reglamento de convivencia y un acta de Las Playas, los dos compartibles) y 2 en staging.
>   **David: D-3 no es obligatorio, pero se arregla en la fase 2 obligando a elegir la categoría**, sin
>   tocar la lista blanca. Reclasificar esos dos documentos sería opcional y con permiso.
> - Bancos: `npm test` **2096** (+5 de las pruebas nuevas y +4 del guardián de las dos listas, que
>   genera dos por banco); functions **1084**. Typechecks en 0.

### Fase 2 · Lo obligatorio *(~4 h; orden según el control B)*

**T2.1 · D-2b: el residente solo lee los comunicados de su audiencia.** La forma de consultar (§2), el
relleno de los existentes (en seco primero), el front, y la regla al final.
- **Criterios:** T1.1 (reglas) en verde; la pantalla del residente carga en staging con un comunicado
  general y con uno dirigido; el radio medido antes (quién pierde qué); la falsación hecha.
- **Esperas:** reautenticar el CLI, el relleno en producción (permiso), la regla en producción
  (permiso), la validación con la sesión de un residente.
- **~2,5 h.**

**T2.2 · D-2: el aviso solo a la audiencia.** `onCommunicationCreated` resuelve los destinatarios por
unidad.
- **Criterios:** T1.1 (emulador) en verde; un comunicado general sigue avisando a todos.
- **Esperas:** el permiso de functions.
- **~0,8 h.**
- **Depende de:** T2.1, para que la audiencia signifique lo mismo en la lectura y en el aviso.

**T2.3 · D-1: el aviso de mora solo a los deudores elegidos**, con un mensaje de éxito que diga la
verdad. El correo es otra necesidad (L-23).
- **Criterios:** T1.3 en verde; en staging, un residente al día no lo ve.
- **~0,4 h.**
- **Depende de:** T2.1 y T2.2.

**T2.4 · D-3: la categoría de Documentos no se publica sola.**
- Recomendado: obligar a elegir categoría, sin valor por defecto. Sacar «otro» de la lista blanca
  quitaría el acceso a los documentos que ya lo usan: se decide con el radio de T1.2.
- **Criterios:** T1.2 en verde.
- **~0,4 h.**

> **Control C.** Los bancos en verde, falsación hecha, staging visto por David, producción con permiso
> y lo desplegado verificado. Commit y push con el sí de David.
>
> **Estado de la fase 2 (16 sep): EN PRODUCCIÓN (`9e4a052`), validada en staging.**
> - **Staging (15 sep):** relleno 16 → 0 sin `audience`; `onCommunicationCreated` rev. `-00028`
>   (23:19 UTC); front rollout `-014`; reglas `dbc4d470`, idénticas al repositorio.
> - **Validación en staging (16 sep), por el navegador y contra la base, en Santa María:** un
>   comunicado a T1 con adjunto avisó solo a los dos residentes de `u-t1-101`; el aviso de mora a
>   `u-t2-503`, solo a sus dos residentes; la residente de T2 ve el aviso y el comunicado general
>   rellenado, y no el de T1 (Comunicaciones e Inicio); el adjunto quedó `comunicado_dirigido`;
>   subir un documento sin categoría se rechaza. **No visto:** la pantalla de un residente de T1
>   (no hay contraseña de esas cuentas), y la consola del navegador no capturó mensajes.
> - **Producción (16 sep):** relleno 26 → 0 (lo corrió David); `onCommunicationCreated` rev.
>   `-00035` (21:17 UTC); push `444be09..9e4a052`, rollout `2026-09-16-001` sirviendo a las 21:23;
>   reglas `b654ec99` (21:25), idénticas al repositorio.
> - **Rareza del relleno:** `PV4jJOwL9lDTPWLbmzuV`, un «Aviso de cartera» de Santa María anterior a
>   D-1, no guardaba sus unidades y quedó `audience: "all"` — lo ve todo el conjunto, como antes.
>   Archivarlo espera a David.
>
> *Lo que sigue es el estado en local, del 15 sep por la noche:*
> - **D-2b.** `communications` tiene bloque propio en `firestore.rules`: lectura para la
>   administración, y para el residente los de `audience: "all"` o los de su unidad. La portería deja
>   de leerlos (ninguna pantalla lo hacía). `relaxedTenantCollection` queda vacía. `useCommunications`
>   tiene modo residente (dos consultas, sin `orderBy`), y `createCommunication` pone `audience: "all"`
>   por defecto. Se corrigieron las dos semillas que no la ponían. **Relleno en seco**
>   (`functions/scripts/rellenar-audiencia-de-comunicados.mjs`, medido el 15 sep): sin `audience`,
>   **26 de 42** en producción y **16 de 40** en staging; el resto, `all`. **Ninguno por torres ni por
>   unidades** en los dos. Uno por torres ya guarda sus `audienceUnitIds` (la pantalla resuelve las
>   torres a unidades), así que la regla nueva lo cubre.
> - **D-2.** El aviso va solo a la audiencia; dirigido y sin unidades, a nadie; sin `audience`, a
>   todos. `functions/lib` compilado.
> - **D-1.** `features/billing/aviso-de-mora.ts` (`audience: "units"`; sin unidades no se construye).
>   La pantalla de Comunicaciones conserva esa audiencia al editar.
> - **D-3.** La categoría arranca vacía y es obligatoria.
> - **D-2c (nuevo, el espejo de D-2b; lo decidió David el 15 sep).** El adjunto de un comunicado se
>   registraba en Documentos como `comunicado`, que lee todo residente: el de un aviso por torres se
>   leía desde otra torre. Ahora el de uno dirigido va como `comunicado_dirigido`,
>   solo-administración (`features/communications/adjunto-de-comunicado.ts`). La regla no cambia:
>   su lista blanca no la nombra. **Límite conocido:** al editar un comunicado general para
>   dirigirlo, los adjuntos ya registrados conservan `comunicado`. Hoy no hay ningún comunicado
>   dirigido en los dos ambientes.
> - **Falsación hecha:** con cada fichero de `HEAD`, enrojecen exactamente sus pruebas; D-2c, en
>   cuatro variantes (pantalla, función, lista, regla). Bancos: app **2104**, functions **1084**,
>   reglas **607** (con solo Firestore: `storage.rules.test.ts` aparte), emulador de D-2 **5 de 5**,
>   typechecks en 0.
> - **Un guardián ajeno enrojeció, y era correcto que lo hiciera**: `clave-de-unidad-guarda` cita
>   `services.ts` por número de línea, y la excepción se movió de la 736 a la 738 por dos líneas de
>   comentario. Se comprobó que es la misma línea contra `HEAD`.
>
> **Orden de despliegue, por ambiente** (el delta lo decide): **relleno → functions → front → regla**.
> El relleno va primero porque el front nuevo filtra por `audience`, y sin él el residente dejaría de
> ver los comunicados antiguos. El push a `develop` despliega el front de staging, así que el relleno de
> staging va ANTES del push.

### Fase 3 · Lote XS *(front; menos de 2 h en total)*

- **T3.1 · L-01a:** menta y violeta en los colores sugeridos (`use-tenant-branding-form.ts`).
- **T3.2 · L-02:** el formato de la carga masiva a la vista y en Excel, con parqueadero y bodega en
  «valores válidos» (los dos asistentes de importación).
- **T3.3 · L-11:** decir en Visitantes, Reservas y Paquetería que la portería tiene su propio panel.
- **T3.4 · L-12:** la fecha de publicación que pone la plataforma, a la vista del administrador
  (`admin/communications/page.tsx`).
- **T3.5 · Tildes:** «Tipo de ocupación» y «Núcleo familiar».

Para cada una: typecheck, `npm test` y un vistazo en staging.

> **Control D.** Un commit para el lote, push con el sí de David, staging visto.

### Fase 4 · Defectos construibles ya *(~3,7 h)*

**T4.1 · L-21d: PQRS enseña el nombre de la unidad y del residente**, resueltos por `unitId` con
`resolveUnitName` (el gemelo que usa `/admin/reservations`), en la tabla y en el detalle.
- **Medir antes:** cuántos tickets llevan la etiqueta sucia o un `unitId` fabricado desde el slug
  (`use-tickets.ts:114`, la trampa de FIX-002). No hay script de solo lectura para `tickets`: se escribe
  uno.
- **Criterios:** una prueba del resolvedor; en la captura de la administradora, la fila sale con su
  nombre.
- Corregir los datos es opcional y con permiso.
- **~1,1 h.**

**T4.2 · L-08a: la salida del frecuente.** La regla acepta `inside→scheduled` para los pases
reentrables. La regla **amplía**, así que el orden es el normal.
- **Criterios:** T1.4 en verde; una prueba de que un pase puntual sigue sin poder volver a `scheduled`.
- **~0,8 h.**

**T4.3 · L-29: quién registró cada entrada y salida.** `checkInBy` y `checkOutBy` iguales a
`request.auth.uid` (la regla amplía), la portería los escribe, y la administración los ve.
- **Criterios:** pruebas de reglas (el propio uid pasa, otro uid no); en staging, el nombre del guarda
  en el pase.
- **~1,8 h.**

> **Control E.** Como el control C.

### Fase 5 · Datos de producción *(cada paso con su permiso; ~1 h)*

**T5.0 · Confirmar la falta de moneda** (solo lectura): ¿`leer-monedas.mjs` lee el campo que usan los
formateadores? Si faltan de verdad, es la trampa de `CLAUDE.md` y va antes que T5.1.

**T5.1 · L-04: `country: CO` en Santa María** (el punto 4 del menú).
- **Radio:** las reservas pasan de hora de México a hora de Bogotá.
- **Criterio:** el alta de unidad dice «coeficiente» y las reservas se ven a la hora local.

**T5.2 · L-27: encender el presupuesto en Santa María** (`mover-bandera-de-conjunto.mjs`).
- **Criterio:** `/admin/finanzas/presupuesto` abre en Santa María.

---

## 5. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| D-2b rompe la pantalla de comunicados del residente: una consulta que la regla no puede demostrar se rechaza entera | Alto | Front antes que la regla; prueba en el emulador con la consulta real; staging con ojos antes de producción |
| El relleno de los comunicados en producción se equivoca | Medio | En seco primero; guardar el valor anterior; `--si-produccion` |
| Sacar «otro» de la lista blanca quita acceso a documentos legítimos | Medio | Medir el radio (T1.2); la opción recomendada no toca la regla |
| El CLI de firebase caducado frena los despliegues | Bajo | David reautentica antes de las fases 2 y 4 |
| Un banco de reglas nuevo fuera de una de las dos listas pone rojo `npm test` sin emulador | Bajo | El guardián `bancos-de-reglas-en-las-dos-listas` |
| No hay sesión de residente en staging para validar | Bajo | Enlace de contraseña (runbook de la demo), con permiso |

## 6. Decisiones B: se abren como plan propio cuando David decida

En el orden del lote (puntuación con la v0.3; el recálculo de T0.3 puede moverlas):

| Id | Qué hay que decidir |
|---|---|
| L-17 | El nombre de Encuestas |
| L-18 | El reglamento sin firmas por país, y qué pasa con la firma de acuerdos |
| L-32 | ¿FAQ del conjunto o de la plataforma? ¿Quién redacta? |
| L-03 | Los campos del alta de unidad que nadie lee: ¿retirar, esconder o por país? ¿Entra la H.39? |
| L-19 | ¿El valor de una reserva solo se informa o genera un cargo? |
| L-08b | ¿Crea el residente su propio frecuente? |
| L-15 | La taxonomía de los comunicados |
| L-06 | La inmobiliaria: ¿recibe cobros, avisos o acceso? |
| L-10 | Personal de servicios: ¿catálogo del conjunto o por unidad? |
| L-09 | Cómo lee la foto el residente, y cuánto tiempo se guarda |
| L-16 | Servicios como clasificados: el nombre y quién publica |
| L-14 | Qué se conserva de un comunicado borrado |
| Resto | L-26, L-25, L-30, L-28, L-01b y L-05 |

## 7. Preguntas para David

1. **¿Aprobado el cambio de la confianza** a «cada estimación por su propio nivel» (§1.1)?
2. **¿Qué definiciones de los ocho hallazgos entran en la v0.4?** Recomiendo: Cierre para mejorar algo
   cerrado, la clase «ya existe y no se ve», una referencia de encender una bandera, y Día uno por país.
3. **¿Cuenta D-2b como obligatorio?** §2.1 habla de acceso indebido «entre roles o entre conjuntos», y
   esto es entre unidades del mismo conjunto. Recomiendo que sí, y añadirlo a §2.1.
4. **¿Un commit por tarea o por fase?** Recomiendo por fase, con push en cada control.

**Respuestas de David, 15 sep 2026:**
1. Sí: la confianza por criterio.
2. Las cuatro recomendadas.
3. Sí: `D-2b` es obligatorio, y el acceso indebido entre unidades se añade a §2.1.
4. Un commit por fase.
