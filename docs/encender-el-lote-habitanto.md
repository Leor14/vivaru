# Encender el lote de Habitanto — el frente 1, y no lleva código

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

| # | Bandera | Qué aparece | Qué comprobar después |
|---|---|---|---|
| 1 | `producto-plan-de-cuentas` | La edición del plan de cuentas | El plan sembrado sigue igual y **los informes dan los mismos números**. Solo aparece la edición |
| 2 | `producto-registro-proveedores` | Registro de proveedores y selector en el egreso | Un egreso **con el nombre a mano sigue funcionando** — ese camino nunca se retira |
| 3 | `producto-cobro-por-coeficiente` | El botón de generar por coeficiente | **La corrida plana de siempre sigue intacta.** No usar todavía la nueva |

### Grupo B — cambian un número que ya se mira. VAN SOLAS

**Antes de cada una, anotar en `/admin/billing` y `/admin/finanzas`:** cobrado, recaudado,
pendiente, % de recaudo, saldo de fondos, ingresos por cuotas y número de movimientos.

| # | Bandera | Qué cambia de verdad | Qué comprobar después |
|---|---|---|---|
| 4 | `producto-concepto-al-libro` | Al cobrar, el asiento lleva **la cuenta del concepto** en vez de «alicuota» fijo, y **el libro deja de contar dos veces** lo que Cartera ya suma | Registrar **un cobro de prueba** en un conjunto de ejemplo y ver que cae en la cuenta de su concepto. **Los asientos viejos NO cambian, y no se quieren cambiar: son los correctos** |
| 5 | `producto-anticipos` **global** | Un sobrepago **deja saldo a favor** en vez de contarse entero contra la cuota. **El recaudo de Cartera baja** en el importe del sobrante, que pasa a contarse por el libro | Ya está validada desde el 24 de agosto en `conjunto-las-playas` por override. Al hacerla global, **quitar el override** para que no quede una excepción sin sentido |
| 6 | `producto-pago-multiple` | Permite repartir un pago entre varios cargos, con un solo recibo | **Va DESPUÉS de `producto-anticipos`.** Con anticipos apagada, un reparto que no suma lo pagado **se rechaza** — es correcto y está medido, pero es una restricción que no hace falta arrastrar |

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
