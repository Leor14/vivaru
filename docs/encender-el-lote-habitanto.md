# Encender el lote de Habitanto — el frente 1, y no lleva código

> ## EJECUTADO — madrugada del 25 de agosto de 2026
>
> **Las seis encendidas globalmente en los nueve conjuntos, una a una y mirando. Cero código:**
> `develop` se quedó en `ed95829`. **Nada se rompió y ningún número se movió.**
>
> Estado final releído al terminar: `advances` **0**, `vendors` **0**, `chartOfAccounts` **0**,
> libro de Las Playas **54** movimientos, recaudado **$128.000**. Idéntico al principio. El único
> cambio en datos fueron **seis documentos de bandera y un campo de override borrado**.
>
> **Lo que NO se probó, dicho para que no se lea de más:** se verificó que cada capacidad aparece
> donde debía y que nada se rompió, pero **no se ejecutó ningún camino de escritura nuevo** — ni un
> pago, ni un reparto, ni una corrida. Decisión de David: sin cobro de prueba.
>
> Abajo, dentro de cada bandera, está lo que se vio de verdad.

**Escrito el 24 de agosto de 2026, al cerrar la jornada.** Existe porque **siete pasos están
construidos, probados, desplegados y dormidos**, y encenderlos es el mejor retorno del tablero: no
hay que escribir nada.

> **Por qué ahora y no después.** Producción **no tiene ni un cliente real** — los nueve conjuntos
> están marcados como de ejemplo. El modo de fallo de cualquiera de estas banderas alcanza hoy
> **solo datos de demostración**. El día que haya un cliente, encender cuesta infinitamente más.
> **El riesgo nunca va a ser más bajo que hoy.**

## La regla que gobierna esto

**Una cada vez, mirando, y con los números anotados ANTES.** No es ceremonia: dos de estas
banderas **cambian un número que alguien ya mira**, y la única forma de saber que cambió como
debía es haber escrito antes lo que valía.

**Se encienden desde `/superadmin/flags`**, que pide sesión de superadmin. Apagar es el rollback y
es inmediato: cada bandera lleva escrito en esa pantalla qué pasa al apagarla.

## El orden

### Grupo A — riesgo mínimo, no cambian ningún número

Estas tres solo **hacen aparecer** algo. Nada de lo que ya existe se comporta distinto.

| # | Bandera | Qué aparece | Qué se vio el 25 de agosto |
|---|---|---|---|
| 1 | `producto-plan-de-cuentas` | La edición del plan de cuentas | ✅ Botón «Plan de cuentas» en Finanzas. El diálogo dice **«Este conjunto todavía no tiene plan sembrado»** y «Nueva» sale **realmente** deshabilitado (`disabled: true`, `pointer-events: none`) |
| 2 | `producto-registro-proveedores` | Registro de proveedores y selector en el egreso | ✅ Botón «Proveedores» y selector «Beneficiario del registro» con **una sola opción**. El nombre a mano **es el valor por defecto**, así que quien ignore la novedad trabaja igual que ayer |
| 3 | `producto-cobro-por-coeficiente` | El botón de generar por coeficiente | ✅ Sale **«Generar por indiviso»** — vocabulario de MX, que es el país de Las Playas. La corrida plana intacta. **No se usó** |

> **La comprobación de la 1 estaba mal escrita, y solo se supo al medir.** Decía «el plan sembrado
> sigue igual y los informes dan los mismos números». **En producción no hay plan sembrado —
> `chartOfAccounts` tiene 0 documentos en todo el proyecto—**, así que esa frase no se podía
> comprobar. Lo que de verdad garantiza que no se mueve nada es más fuerte y está en el código: la
> suscripción al plan y el cálculo de los informes corren **fuera** de la bandera
> (`finanzas/page.tsx:146`), que solo gobierna un botón y un diálogo. **No añade ni una consulta.**
>
> Y el hueco que parecía quedar —un administrador creándose un plan a mano que luego choque con la
> semilla— **está cerrado**: con el plan vacío, «Nueva» está deshabilitado.

> **La 2 sí añade una consulta, y por eso se comprobó antes de encenderla.** `useVendors` solo se
> suscribe con la bandera puesta. Es el patrón que el 24 dejó cuatro índices sin poner. Se verificó
> que **no necesita índice compuesto** —es `where(tenantId)` sin `orderBy`, ordena en memoria— y que
> **la regla no la puede rechazar**, porque restringe por el mismo campo que la consulta filtra.
> Entró sin ruido.

> **Y la 3 tiene un matiz que esta ficha no decía: el servidor NO comprueba esa bandera.**
> `generateCoefficientCampaign` solo valida `assertActiveTenantAdmin`. Encenderla no abre ese hueco
> —ya estaba abierto—, pero **la bandera no es el freno, es solo el botón**. El freno real es que la
> corrida exige coeficientes y los verifica: **cero de las 88 unidades de producción tienen uno**,
> así que un intento lanza `failed-precondition` **nombrando las unidades**, ya en la vista previa.

### Grupo B — cambian un número que ya se mira. VAN SOLAS

**Antes de cada una, anotar en `/admin/billing` y `/admin/finanzas`:** cobrado, recaudado,
pendiente, % de recaudo, saldo de fondos, ingresos por cuotas y número de movimientos.

| # | Bandera | Qué cambia de verdad | Qué se vio el 25 de agosto |
|---|---|---|---|
| 4 | `producto-concepto-al-libro` | Al cobrar, el asiento lleva **la cuenta del concepto** en vez de «alicuota» fijo | ✅ **Ninguna tarjeta se movió.** El estado financiero exportado pasó de una línea a **tres**: 126.000 + 1.500 + 500 = **128.000**, el mismo total. Los asientos viejos, intactos |
| 5 | `producto-anticipos` **global** | Un sobrepago **deja saldo a favor** en vez de contarse entero contra la cuota | ✅ Global puesta y **override retirado**, con Las Playas conservando la capacidad. **0 anticipos siguen en 0** — el cambio es latente hasta el primer sobrepago |
| 6 | `producto-pago-multiple` | Permite repartir un pago entre varios cargos, con un solo recibo | ✅ El reparto aparece en **T2-204** (dos cargos de $3.000) y **no aparece** en T2-205 (un solo cargo). El camino de siempre, intacto |

> **La 4 mueve MENOS de lo que esta ficha decía, y conviene saber dónde exactamente.** No cambia
> ninguna tarjeta de pantalla: `/admin/finanzas` calcula las suyas con `recaudo.total`, que se lee
> **fuera** de la bandera. Lo que cambia es **el reparto** de los ingresos en el estado financiero
> exportado y en el informe de comité. **El total no puede cambiar**, y no es una promesa:
> `repartirRecaudo` construye el total y el reparto **en el mismo bucle**.
>
> Dos riesgos se descartaron antes de encender y luego se vieron cumplidos: **sin plan sembrado no
> sale ninguna clave en crudo** —las ocho categorías posibles tienen nombre en `CATEGORY_LABELS`, y
> son los mismos nombres que la semilla, a propósito—; y **la reversión no se rompe**, porque R13 ya
> está construido y el reverso arrastra `reversedSourceType`. **Sin R13, esta bandera arregla el
> cobro y rompe la reversión.**
>
> Un detalle que parece incoherencia y no lo es: el cobro del 24 se llama «Pago de alícuota» en el
> libro —texto viejo— pero cuenta como **Multas $500** en el informe. Correcto: el reparto lo hace
> **Cartera** desde el concepto del cargo, y el asiento se excluye del ingreso para no contarlo dos
> veces.

> **La 5 va en DOS pasos y en DOS sitios, y el orden no es opcional.** El script
> `mover-bandera.mjs` **no sabe quitar un override** —solo pone `true`/`false`—; quitarlo es el
> botón «Quitar override» de `/superadmin/flags`. Y como **el override manda sobre la global**, hay
> que poner la global **primero**: al revés, Las Playas se queda sin la capacidad. El documento del
> override no se borra, queda con `flags: {}`.
>
> Esta ficha decía que al hacerla global «el recaudo de Cartera baja». **Hoy no bajó nada**, y no
> por suerte: hay **0 anticipos** y ninguna cifra de cartera o finanzas depende de esta bandera. La
> bajada llegará **el día del primer sobrepago**, no al encenderla.

> **El orden entre 5 y 6 importa, y la ficha lo dice al revés.** `PRD-V-FLOW-002` §11.4 y el
> comentario del catálogo dicen «el reparto puede salir sin los anticipos, pero no al revés». Leído
> literal, invita a encender el reparto primero. **Medido contra el código (`payments.ts` 606–626),
> lo que ocurre es esto:** con reparto encendido y anticipos apagados, un reparto cuyo importe
> exceda los cargos **se rechaza** en vez de absorber el sobrante. No hay evaporación silenciosa
> —eso se corrigió el 24— pero sí una restricción gratuita. **Anticipos primero.**

## Lo que NO entra en este frente

**`producto-reservas-servidor` no es un interruptor: es un proceso, y es el frente 3.** Encenderla
**arranca un reloj**: hay que verla encendida un tiempo **sin escrituras directas** antes de cerrar
la rama del residente en las reglas (paso 4 de `PRD-V-FIX-001`), y **ese paso no se revierte con
bandera**. Se hace aparte, con su propia sesión.

## Cuándo parar

- Si un número del grupo B se mueve **en una dirección que no se predijo**, apagar y mirar. No
  «esperar a ver».
- Si aparece un error en la consola del navegador que antes no estaba. Las suites no cazan esto:
  el 24 de agosto, 1161 pruebas en verde convivían con cuatro consultas rotas en producción.
- Si algo se rompe y no está claro cuál de las banderas lo causó, es señal de que se encendieron
  dos juntas. Apagar las dos y volver a empezar de una en una.
