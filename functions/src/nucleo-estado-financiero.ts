/**
 * El núcleo del estado financiero — `PRD-V-FLOW-007`, entrega 1.
 *
 * ## Por qué existe este fichero
 *
 * Hasta hoy la aritmética del informe estaba escrita **dos veces**: aquí, para
 * la pantalla, y **otra vez en línea** dentro de `monthlyFinancialArchive`
 * (`functions/src/index.ts`), que es lo que se archiva cada día 1 y lo que lee
 * el consejo. No es una hipótesis de deriva: **ya se desvió dos veces**.
 *
 *   - **R12/R13**, 23 de agosto de 2026 — el descuento del recaudo pasó a
 *     mirar el ORIGEN del asiento en `src/` y no llegó al servidor, que siguió
 *     preguntando por la categoría y **contando dos veces** todo cargo que no
 *     fuera la cuota. Con todas las suites en verde.
 *   - **R16**, 24 de agosto — el «% de recaudo» pasó a medir liquidación y no
 *     ingreso, otra vez solo en `src/`.
 *
 * Las dos pasaron por la misma causa mecánica: **nada comparaba las dos
 * implementaciones**. Este fichero es la implementación única, y
 * `functions/src/nucleo-estado-financiero.ts` es su copia **byte a byte**.
 *
 * ## Por qué una COPIA y no un import
 *
 * `src/` y `functions/` no pueden importarse entre sí: App Hosting hace
 * `npm ci` solo en la raíz y el `next build` se rompe (CLAUDE.md). Así que la
 * unificación posible no es un módulo compartido, es **un módulo con espejo
 * vigilado**. Lo que cambia respecto de antes es que el espejo ahora se compara
 * de dos maneras a la vez:
 *
 *   1. **byte a byte**, en `functions/tests/nucleo-estado-financiero-espejo.test.ts`;
 *   2. **por sus NÚMEROS**, pasando el mismo banco de casos por las dos copias
 *      (`tests/fixtures/estado-financiero-golden.json`), que es lo que pide
 *      `CA1`: «no vale comprobar que existe un import».
 *
 * ## LA REGLA QUE HACE POSIBLE LA COPIA BYTE A BYTE
 *
 * **Este fichero no importa NADA.** Ni tipos, ni utilidades, ni alias `@/`. En
 * cuanto tenga un `import`, las dos copias dejan de poder ser idénticas —los
 * caminos difieren— y el guardián más fuerte se cae. Si algo de aquí necesita
 * una utilidad de fuera, se copia dentro; si algo de fuera necesita una de
 * aquí, la reexporta (es lo que hace `codigo-de-cuenta.ts` con
 * `compararCodigos`).
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

/**
 * El asiento, reducido a lo que la aritmética mira.
 *
 * Es deliberadamente laxo —todo opcional menos nada— porque las dos copias
 * reciben formas distintas: en `src/` un `LedgerEntry` completo, y en el
 * servidor lo que sale de `doc.data()`, que no está tipado. Exigir aquí el tipo
 * del cliente obligaría a importarlo, y eso rompe la regla de arriba.
 */
export type AsientoDelNucleo = {
  type?: string;
  category?: string;
  accountCode?: string;
  sourceType?: string;
  reversedSourceType?: string;
  amount?: number;
};

export type CategoryTotal = { category: string; label: string; amount: number };

/** El plan de cuentas reducido a lo que un informe necesita. */
export type PlanParaInformes = {
  /** `systemKey` → código. Es lo que mete a los asientos viejos en el mismo cajón. */
  codigoPorSystemKey: Map<string, string>;
  /** código → nombre. Que la etiqueta salga de aquí es lo que hace posible CA6 de PLAT-003. */
  nombrePorCodigo: Map<string, string>;
};

/** El recaudo de Cartera repartido por concepto. El total manda sobre el reparto. */
export type RecaudoDelNucleo = { total: number; porCategoria: ReadonlyMap<string, number> };

/**
 * De dónde sale el saldo inicial, y por qué es un dato y no un número.
 *
 * **`ausente` y `registrado: 0` NO son lo mismo**, y confundirlos es el defecto
 * que esta entrega viene a cerrar. Medido el 3 de septiembre de 2026 en los
 * nueve conjuntos: **cuatro tienen documento de saldo** —dos de ellos con el
 * valor cero, escrito a propósito— y **cinco no tienen ninguno**. Pintar «$0»
 * en los cinco afirma que el conjunto abrió el período sin un peso, que es una
 * afirmación que nadie hizo. `CA4`.
 */
export type OrigenDelSaldoInicial = "registrado" | "ausente";

export type EstadoFinanciero = {
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  cuotaIncome: number;
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
  /** El saldo con el que abrió el período. `undefined` = nadie lo registró. */
  openingBalance?: number;
  openingBalanceSource: OrigenDelSaldoInicial;
  /**
   * Saldo al cierre = inicial + ingresos − egresos.
   *
   * **Se llama `fundBalance` y no `closingBalance`**, que es el nombre que
   * cualquiera buscaría. Buscarlo por el nombre esperado da cero resultados y
   * lleva a construir por segunda vez algo que ya existe.
   */
  fundBalance: number;
  /** Lo facturado y todavía no cobrado. Cero calculado, nunca escondido (`CA8`). */
  pendingReceivables: number;
  /** Lo causado a proveedores y todavía no pagado. Cero calculado (`CA8`). */
  supplierDebt: number;
};

// ── Etiquetas ────────────────────────────────────────────────────────────────

/**
 * Etiqueta de respaldo para agrupar por `category` cuando el asiento no tiene
 * `accountCode`. Los nombres son **los mismos que la semilla del plan de
 * cuentas**, para que encender la bandera del plan no cambie también el texto.
 */
const CATEGORY_LABELS: Record<string, string> = {
  alicuota: "Cuotas de administración",
  extraordinaria: "Cuotas extraordinarias",
  interes_mora: "Intereses de mora",
  multa: "Multas",
  reparacion: "Reparaciones a cargo del residente",
  parqueadero: "Parqueaderos",
  arriendo: "Arriendo de áreas comunes",
  cuota_vigilancia: "Cuotas de vigilancia",
  anticipo: "Anticipos de residentes",
  otros_ingresos: "Otros ingresos",
  nomina: "Nómina",
  servicios_publicos: "Servicios públicos",
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  administracion: "Administración",
  seguros: "Seguros",
  impuestos: "Impuestos",
  vigilancia: "Vigilancia y seguridad",
  otros: "Otros",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

// ── Orden del plan ───────────────────────────────────────────────────────────

/** Numérico jerárquico de dos niveles: `N` o `N.M`, sin ceros a la izquierda. */
const CODIGO_PATTERN = /^[1-9]\d{0,2}(\.[1-9]\d{0,2})?$/;

export function esCodigoDeCuenta(clave: string): boolean {
  return CODIGO_PATTERN.test(clave);
}

/**
 * Orden de lectura del plan: por código y **numéricamente**, no como texto.
 *
 * Ordenar `["1.10", "1.2"]` como cadenas pone la 1.10 antes que la 1.2, que es
 * exactamente el desorden que un contador nota al primer vistazo. `CA7`.
 */
export function compararCodigos(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  return pa[0] - pb[0] || (pa[1] ?? 0) - (pb[1] ?? 0);
}

// ── Dinero ───────────────────────────────────────────────────────────────────

/**
 * Redondea al **céntimo**. `CA3`.
 *
 * **No es cosmético: sin esto la identidad `final = inicial + ingresos −
 * egresos` no se cumple con MXN ni con USD.** Un caso real del banco de
 * `PRD-V-FLOW-007`: 2.000,44 de ingreso y 1.234,56 de egreso dan
 * `765.8800000000001` en coma flotante, y el saldo final arrastra el residuo.
 * Se pinta como «765,88» —así que en pantalla no se ve— pero una comparación
 * contra el extracto del banco, o contra el informe del mes pasado, falla por
 * 1e-13 sin que nada explique por qué.
 *
 * **Con COP no cambia nada**, que es la moneda de seis de los nueve conjuntos:
 * redondear un entero al céntimo lo deja igual. Por eso el defecto podía vivir
 * indefinidamente sin que nadie lo viera.
 *
 * Es la misma decisión que `aMoneda` en `functions/src/payments.ts`, tomada allí
 * el 24 de agosto de 2026 por el mismo motivo: dos guardianes rechazaban cobros
 * correctos con centavos.
 *
 * **Se redondean los TOTALES, no las líneas.** El importe de cada asiento es un
 * dato guardado y se enseña tal cual; el residuo nace de sumarlos.
 */
export function aCentimos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ── El descuento del recaudo ─────────────────────────────────────────────────

/**
 * Si un asiento de ingreso ya viene contado por Cartera y por tanto **no** debe
 * volver a sumarse desde el libro.
 *
 * **Mira el ORIGEN, no la categoría.** El recaudo de cargos se agrega aparte
 * como `cuotaIncome` —derivado de Cartera, que es la fuente completa— y el
 * libro tiene que descontarlo para no contarlo dos veces. Hasta el 22 de agosto
 * de 2026 ese descuento preguntaba `category !== "alicuota"`, y **acertaba por
 * accidente**: `aplicarPago` escribía `alicuota` fijo para todo, así que todo
 * cargo quedaba excluido. En cuanto el asiento lleva la cuenta de su concepto,
 * una multa deja de llamarse `alicuota`, entra en el ingreso del libro y
 * **sigue estando en `cuotaIncome`**: se cuenta dos veces, y justo en los
 * conjuntos que cobran algo distinto de la cuota. Regla **R12**.
 *
 * **El reverso cuenta igual que lo que anula (R13).** Un reverso pierde el
 * origen al nacer —pasa a `sourceType: "reversal"`—, así que sin
 * `reversedSourceType` un reverso de multa no sería ni `billingStatement` ni
 * `alicuota`: su monto **negativo** entraría en el ingreso del libro mientras
 * Cartera ya lo descontó del cargo, y el ingreso bajaría dos veces.
 *
 * La rama de `"alicuota"` es la **convivencia**: cubre todo lo escrito antes de
 * que existiera `reversedSourceType`. No se puede quitar mientras queden
 * asientos viejos, y no se migran.
 */
export function esRecaudoDeCartera(
  entry: Pick<AsientoDelNucleo, "sourceType" | "reversedSourceType" | "category">,
): boolean {
  return (
    entry.sourceType === "billingStatement" ||
    entry.reversedSourceType === "billingStatement" ||
    entry.category === "alicuota"
  );
}

// ── El cajón y su nombre ─────────────────────────────────────────────────────

/**
 * El cajón en el que cae un movimiento: su cuenta, o la de su categoría.
 *
 * **El código manda SOLO si el plan sabe nombrarlo.** Un código que nadie puede
 * nombrar no es un cajón: es un número. Sin esa condición, y **sin plan
 * sembrado** —la condición de producción—, un egreso viejo caía en
 * `mantenimiento` y uno nuevo, que ya lleva `accountCode`, en `2.3`: dos filas
 * **con la misma etiqueta «Mantenimiento»**.
 */
function cajonDe(
  accountCode: string | undefined,
  category: string | undefined,
  plan: PlanParaInformes | undefined,
  porDefecto: string,
): string {
  if (accountCode && plan?.nombrePorCodigo.has(accountCode)) return accountCode;
  if (category) return plan?.codigoPorSystemKey.get(category) ?? category;
  if (accountCode) return accountCode;
  return plan?.codigoPorSystemKey.get(porDefecto) ?? porDefecto;
}

/**
 * El nombre de una línea. Tres escalones, y el tercero importa: un asiento puede
 * llevar `accountCode` de un conjunto **sin plan sembrado**, y sin la caída a la
 * categoría la línea se llamaría «1.3».
 */
function etiquetaDe(
  cajon: string,
  category: string | undefined,
  plan: PlanParaInformes | undefined,
): string {
  const delPlan = plan?.nombrePorCodigo.get(cajon);
  if (delPlan) return delPlan;
  return categoryLabel(category ?? cajon);
}

// ── El cálculo ───────────────────────────────────────────────────────────────

export type EntradaDelNucleo = {
  /** Los asientos del período. */
  asientos: ReadonlyArray<AsientoDelNucleo>;
  /** El recaudo de Cartera: un total, o el mismo total repartido por concepto. */
  cuota: number | RecaudoDelNucleo;
  /**
   * El saldo con el que abrió el período. **`undefined` significa que nadie lo
   * registró**, y no es lo mismo que cero — ver `OrigenDelSaldoInicial`.
   */
  openingBalance?: number;
  plan?: PlanParaInformes;
  /** Lo facturado y no cobrado. Se pasa ya sumado: la fuente es Cartera. */
  pendingReceivables?: number;
  /** Lo causado a proveedores y no pagado. Se pasa ya sumado: la fuente son los egresos. */
  supplierDebt?: number;
};

/**
 * Construye el estado de ingresos y egresos a partir del libro y del recaudo.
 *
 * **`cuota` admite dos formas.** Un número se pinta entero como «Cuotas de
 * administración». Un `RecaudoDelNucleo` trae el mismo total **repartido por
 * concepto**, y entonces cada concepto tiene su línea. **El total es idéntico en
 * las dos formas**: son los mismos cargos, solo agrupados. Por eso el reparto se
 * toma tal cual y no se vuelve a sumar aquí — dos formas de calcular el mismo
 * número acaban discrepando.
 */
export function construirEstadoFinanciero(entrada: EntradaDelNucleo): EstadoFinanciero {
  const { asientos, cuota, openingBalance, plan } = entrada;

  // Se guarda la etiqueta junto al monto porque el cajón puede ser un código
  // (`1.3`) y el nombre venir de la categoría del asiento que cayó en él. Sin
  // esto habría que volver a recorrer los asientos para saber cómo se llama.
  const incomeMap = new Map<string, { amount: number; label: string }>();
  const expenseMap = new Map<string, { amount: number; label: string }>();

  const acumular = (
    map: Map<string, { amount: number; label: string }>,
    cajon: string,
    label: string,
    amount: number,
  ) => {
    const actual = map.get(cajon);
    // El primero que cae fija la etiqueta: si dos asientos del mismo cajón
    // traen nombres distintos —uno con plan y otro sin él—, quedarse con el
    // primero es arbitrario pero estable. Con plan sembrado nunca difieren.
    map.set(cajon, { amount: (actual?.amount ?? 0) + amount, label: actual?.label ?? label });
  };

  const cuotaIncome = typeof cuota === "number" ? cuota : cuota.total;
  if (typeof cuota === "number") {
    if (cuotaIncome) {
      const cajon = cajonDe(undefined, "alicuota", plan, "alicuota");
      acumular(incomeMap, cajon, etiquetaDe(cajon, "alicuota", plan), cuotaIncome);
    }
  } else {
    for (const [categoria, monto] of cuota.porCategoria) {
      if (!monto) continue;
      const cajon = cajonDe(undefined, categoria, plan, "otros_ingresos");
      acumular(incomeMap, cajon, etiquetaDe(cajon, categoria, plan), monto);
    }
  }

  for (const entry of asientos) {
    const amount = entry.amount ?? 0;
    if (entry.type === "ingreso") {
      if (esRecaudoDeCartera(entry)) continue;
      const cajon = cajonDe(entry.accountCode, entry.category, plan, "otros_ingresos");
      acumular(incomeMap, cajon, etiquetaDe(cajon, entry.category, plan), amount);
    } else if (entry.type === "egreso") {
      const cajon = cajonDe(entry.accountCode, entry.category, plan, "otros");
      acumular(expenseMap, cajon, etiquetaDe(cajon, entry.category, plan), amount);
    }
  }

  /**
   * Orden del plan cuando hay códigos, y por monto cuando no.
   *
   * Un contador lee el estado en el orden del plan —1.1, 1.2, 1.3…—, no por
   * quién recaudó más. **Los subtotales por cuenta padre NO entran aquí.** Un
   * conjunto sin plan no tiene códigos, así que conserva el orden de siempre.
   */
  const toRows = (map: Map<string, { amount: number; label: string }>): CategoryTotal[] =>
    [...map.entries()]
      .map(([category, { amount, label }]) => ({ category, label, amount }))
      .sort((a, b) => {
        const ca = esCodigoDeCuenta(a.category);
        const cb = esCodigoDeCuenta(b.category);
        if (ca && cb) return compararCodigos(a.category, b.category);
        if (ca !== cb) return ca ? -1 : 1;
        return b.amount - a.amount;
      });

  const incomeByCategory = toRows(incomeMap);
  const expenseByCategory = toRows(expenseMap);
  const totalIncome = aCentimos(incomeByCategory.reduce((sum, item) => sum + item.amount, 0));
  const totalExpenses = aCentimos(expenseByCategory.reduce((sum, item) => sum + item.amount, 0));
  const netResult = aCentimos(totalIncome - totalExpenses);

  // La identidad `final = inicial + ingresos − egresos` (`CA3`). Sin saldo
  // registrado el cierre se calcula desde cero —es lo único que se puede
  // hacer—, pero `openingBalanceSource` deja dicho que ese cero no lo afirmó
  // nadie, para que la pantalla no lo pinte como un dato.
  const hayApertura = typeof openingBalance === "number" && Number.isFinite(openingBalance);
  const apertura = hayApertura ? (openingBalance as number) : 0;

  return {
    incomeByCategory,
    expenseByCategory,
    cuotaIncome,
    totalIncome,
    totalExpenses,
    netResult,
    openingBalance: hayApertura ? apertura : undefined,
    openingBalanceSource: hayApertura ? "registrado" : "ausente",
    fundBalance: aCentimos(apertura + netResult),
    pendingReceivables: entrada.pendingReceivables ?? 0,
    supplierDebt: entrada.supplierDebt ?? 0,
  };
}

// ── Las dos partidas nuevas ──────────────────────────────────────────────────

/**
 * Lo facturado y todavía no cobrado.
 *
 * **Esta definición NO se inventó aquí: es la que ya usa `BillingHeroCard`**
 * (`totalPendingBalance`), y copiarla en vez de escribir una tercera es lo que
 * evita que la tarjeta de Cartera y el informe del mes digan cifras distintas
 * de la misma cosa. Sus tres condiciones, y por qué cada una:
 *
 *   - **fuera lo `cancelled`**: un cargo anulado conserva su importe a
 *     propósito —el cargo recuerda lo que llegó a decir— pero ya no es una
 *     deuda que nadie vaya a cobrar;
 *   - **fuera lo `paid`**: su saldo es cero y sumarlo no cambia nada, pero
 *     dejarlo dentro haría depender la cifra de que el saldo se cerrara bien;
 *   - **se suma el `balance` del cargo, no `amount − paymentAmount`**. El saldo
 *     ya descuenta lo cubierto con anticipos, y recalcularlo aquí sería un
 *     gemelo de `calcularSaldo` que olvidaría esa resta.
 *
 * **Y se topa en cero POR CARGO, no al final.** Un cargo con saldo negativo es
 * un sobrepago; dejarlo restar haría que un residente que pagó de más tapara la
 * deuda de otro, y el conjunto vería menos cartera de la que tiene.
 */
export function sumarCuentasPorCobrar(
  cargos: ReadonlyArray<{ balance?: number; status?: string }>,
): number {
  let total = 0;
  for (const cargo of cargos) {
    if (cargo.status === "cancelled" || cargo.status === "paid") continue;
    const saldo = cargo.balance ?? 0;
    if (saldo > 0) total += saldo;
  }
  return aCentimos(total);
}

/**
 * Lo causado a proveedores y todavía no pagado.
 *
 * **La fuente son los EGRESOS, no `vendors`.** Medido el 3 de septiembre de
 * 2026 en producción: `vendors` tiene **cero** filas y ningún egreso lleva
 * `vendorId`, pero **trece egresos están en `registrado`** repartidos en cuatro
 * conjuntos, y esa es la deuda. La ficha había anotado el riesgo al revés —«sale
 * cero porque no hay proveedores registrados»—: quien paga no está en `vendors`,
 * está en la factura que nadie ha pagado todavía.
 *
 * **El catálogo es castellano: `registrado | pagado | anulado`.** Filtrar por
 * `"paid"` / `"cancelled"` no excluye nada y devuelve los egresos pagados dentro
 * de la deuda — pasó al medir, y la cifra salió tres veces más grande.
 *
 * **Tampoco se inventó aquí:** es el `totalPayable` de `summarizePayables`, que
 * alimenta la tarjeta «Cuentas por pagar» de Cartera desde antes de esta ficha.
 * Aquella función pasa a llamar a esta, para que la tarjeta y el informe no
 * puedan decir dos cifras distintas de la misma deuda.
 */
export function sumarDeudaAProveedores(
  egresos: ReadonlyArray<{
    amount?: number;
    status?: string;
    paidAmount?: number;
    installments?: ReadonlyArray<{ amount?: number; status?: string }>;
  }>,
): number {
  let total = 0;
  for (const egreso of egresos) {
    if (egreso.status !== "registrado") continue;
    total += pendienteDelEgreso(egreso);
  }
  return aCentimos(total);
}

/**
 * Lo que falta por pagar de UN egreso. `PRD-V-FLOW-008`, `RN-09`.
 *
 * **Hasta el 4 de septiembre de 2026 esto era `amount` a secas**, y era correcto
 * mientras un egreso solo pudiera estar pagado o sin pagar. Con el **calendario
 * de cuotas** deja de serlo: una póliza de 1.100 con cinco cuotas de 100 ya
 * pagadas **seguiría contando 1.100 de deuda**. La cifra la leen la tarjeta de
 * Cartera, el informe mensual emitible y el archivo mensual automático, así que
 * los tres se equivocarían a la vez — y el informe mensual **ya está en
 * producción y lo lee el consejo**.
 *
 * **Un egreso sin plan no cambia**: `paidAmount` ausente vale cero y el resultado
 * es `amount`, byte por byte lo de siempre. Es lo que sostiene `CA10` y `CA11`.
 *
 * **Se topa en cero**, y no es defensivo por gusto: si `paidAmount` superara al
 * importe —por un dato corrupto o una factura editada a la baja—, un egreso
 * pasaría a restar deuda y **taparía la de otro proveedor**. Es el mismo topado
 * por documento que hace `sumarCuentasPorCobrar` con el sobrepago de una unidad.
 */
export function pendienteDelEgreso(
  egreso: {
    amount?: number;
    paidAmount?: number;
    installments?: ReadonlyArray<{ amount?: number; status?: string }>;
  },
): number {
  // **Con plan, la deuda son las cuotas que SIGUEN PENDIENTES**, y no
  // `amount − paidAmount`. La diferencia aparece en cuanto se anula una cuota
  // sin anular la factura —el proveedor perdona lo que queda—: con la resta, una
  // póliza de 1.100 con cinco cuotas pagadas y seis anuladas **seguiría contando
  // 600 de deuda que ya nadie debe**. Medido antes de escribir esto.
  //
  // Y hay una razón más de fondo: **las cuotas son la fuente de verdad y
  // `paidAmount` es un acumulado que hay que mantener**. Derivar la deuda de lo
  // que se mantiene solo es pedir que algún día se desincronice; derivarla de las
  // cuotas no puede desincronizarse de sí mismo.
  const cuotas = egreso.installments;
  if (cuotas && cuotas.length > 0) {
    let vivo = 0;
    for (const c of cuotas) {
      if (c.status !== "pendiente") continue;
      vivo += c.amount ?? 0;
    }
    return vivo > 0 ? vivo : 0;
  }

  const importe = egreso.amount ?? 0;
  const pagado = egreso.paidAmount ?? 0;
  const pendiente = importe - pagado;
  return pendiente > 0 ? pendiente : 0;
}

// ── El calendario de cuotas ───────────────────────────────────────────────────
//
// `PRD-V-FLOW-008`. **Vive aquí porque lo necesitan LOS DOS LADOS**: el cliente,
// para no dejar teclear un plan que no cuadra, y el servidor, que es quien de
// verdad lo guarda desde que la edición del plan pasó a callable (`R8`). Tener la
// misma regla escrita dos veces es exactamente cómo nacieron `R12` y `R16`.
//
// Los tipos son **laxos a propósito**, como el resto del núcleo: en `src/` llega
// un `Installment` y en el servidor lo que salga de `doc.data()`, que no está
// tipado. Exigir el tipo del cliente obligaría a importarlo, y eso rompe la regla
// que hace posible el espejo byte a byte.

export type CuotaDelNucleo = {
  number: number;
  dueDate: string;
  amount: number;
  status: "pendiente" | "pagada" | "anulada";
};

/** Cuánto suman las cuotas que todavía cuentan — las anuladas no. */
export function sumaDelPlan(
  cuotas: ReadonlyArray<{ amount?: number; status?: string }>,
): number {
  let total = 0;
  for (const c of cuotas) {
    if (c.status === "anulada") continue;
    total += c.amount ?? 0;
  }
  return aCentimos(total);
}

export type ProblemaDelPlan =
  | { tipo: "vacio" }
  | { tipo: "sin_vencimiento"; numeros: number[] }
  | { tipo: "numeracion" }
  | { tipo: "importe_no_positivo"; numeros: number[] }
  | { tipo: "no_cuadra"; diferencia: number };

/**
 * Comprueba el plan contra el total de la factura (`RN-01`–`RN-03`).
 *
 * Devuelve **todos** los problemas, no el primero: quien está tecleando once
 * filas prefiere verlos juntos a descubrirlos de uno en uno.
 */
export function validarPlan(
  cuotas: ReadonlyArray<{ number?: number; dueDate?: string; amount?: number; status?: string }>,
  totalFactura: number,
): ProblemaDelPlan[] {
  const problemas: ProblemaDelPlan[] = [];

  // Un plan vacío no es un plan. Va PRIMERO porque sobre cero cuotas todo lo
  // demás «cuadra» y devolvería un verde vacío — el error de la puerta que se
  // abre sobre un conjunto sin datos.
  if (cuotas.length === 0) return [{ tipo: "vacio" }];

  const sinFecha = cuotas.filter((c) => !c.dueDate).map((c) => c.number ?? 0);
  if (sinFecha.length > 0) problemas.push({ tipo: "sin_vencimiento", numeros: sinFecha });

  // Consecutivos desde 1 y sin repetir. Con huecos o duplicados, «la cuota 3»
  // deja de identificar una cuota — y es como se la nombra al pagarla.
  const numeros = cuotas.map((c) => c.number ?? 0).sort((a, b) => a - b);
  const bien = numeros.length === new Set(numeros).size && numeros.every((n, i) => n === i + 1);
  if (!bien) problemas.push({ tipo: "numeracion" });

  const noPositivos = cuotas.filter((c) => !((c.amount ?? 0) > 0)).map((c) => c.number ?? 0);
  if (noPositivos.length > 0) problemas.push({ tipo: "importe_no_positivo", numeros: noPositivos });

  // **Se compara en céntimos y no sobre los flotantes crudos**: once cuotas de
  // 100,01 arrastran residuo, y rechazar un plan correcto por un 0,0000001 es
  // peor que no validar. Es el mismo residuo que hizo fallar `CA3` en `FLOW-007`.
  const diferencia = aCentimos(aCentimos(totalFactura) - sumaDelPlan(cuotas));
  if (diferencia !== 0) problemas.push({ tipo: "no_cuadra", diferencia });

  return problemas;
}

/**
 * El problema, dicho para una persona. **Nombra la diferencia**, que es lo que
 * `CA1` pide: «no cuadra» obliga a sacar la calculadora; «faltan $11» no.
 *
 * El formateador se **inyecta** en vez de importarse: el núcleo no importa nada,
 * y así el cliente pone la moneda del conjunto y el servidor la suya.
 */
export function explicarProblemaDelPlan(
  p: ProblemaDelPlan,
  formatear: (n: number) => string,
): string {
  switch (p.tipo) {
    case "vacio":
      return "Un plan de pagos necesita al menos una cuota.";
    case "sin_vencimiento":
      return `Falta la fecha de vencimiento de la cuota ${p.numeros.join(", ")}. Cada cuota necesita la suya.`;
    case "numeracion":
      return "Las cuotas deben ir numeradas desde 1, sin saltos ni repetidas.";
    case "importe_no_positivo":
      return `El importe debe ser mayor que cero: cuota ${p.numeros.join(", ")}.`;
    case "no_cuadra":
      return p.diferencia > 0
        ? `Las cuotas no suman el total de la factura: faltan ${formatear(p.diferencia)}.`
        : `Las cuotas suman más que el total de la factura: sobran ${formatear(-p.diferencia)}.`;
  }
}

/**
 * Funde el plan que llega con el que está guardado.
 *
 * **Existe por un defecto que costó dinero de mentira y podría haberlo costado de
 * verdad**: editar la descripción de una factura **deshacía sus pagos**, porque el
 * formulario reenvía las cuotas sin lo que sella el servidor. Medido en staging:
 * `paidAmount` en 100, **cero cuotas pagadas**, y su asiento huérfano en el libro.
 *
 * **Una cuota que no está `pendiente` se conserva ENTERA** —importe y fecha
 * incluidos (`RN-07`)— y **sobrevive aunque el plan que llega ya no la traiga**:
 * no se borra una cuota que dejó un asiento en el libro.
 */
export function fundirPlan<T extends CuotaDelNucleo>(
  guardadas: ReadonlyArray<T> | undefined,
  entrantes: ReadonlyArray<{ number: number; dueDate: string; amount: number }> | undefined,
): T[] | null {
  const previas = guardadas ?? [];
  const selladas = previas.filter((c) => c.status !== "pendiente");

  if (!entrantes || entrantes.length === 0) {
    // Quitar el plan solo se puede si no había nada pagado ni anulado.
    return selladas.length > 0 ? [...selladas] : null;
  }

  const porNumero = new Map(previas.map((c) => [c.number, c]));
  const fundidas: T[] = [];
  for (const nueva of entrantes) {
    const previa = porNumero.get(nueva.number);
    if (previa && previa.status !== "pendiente") {
      fundidas.push(previa);
      continue;
    }
    // **Se RECONSTRUYE la cuota campo a campo, y esto ES la guarda.** Un
    // `...nueva` traería lo que viniera dentro —un `status: "pagada"`, un
    // `ledgerEntryId` inventado— y bajaría la deuda del conjunto sin que nadie
    // pagara nada. Lo confirmó una falsación: al cambiarlo por un esparcido,
    // enrojecen las dos pruebas que vigilan justo eso.
    fundidas.push({
      ...(previa ?? ({} as T)),
      number: nueva.number,
      dueDate: nueva.dueDate,
      amount: nueva.amount,
      status: "pendiente",
    } as T);
  }

  // Las selladas que el plan entrante ya no trae vuelven a la lista: no se borran.
  for (const c of selladas) {
    if (!fundidas.some((f) => f.number === c.number)) fundidas.push(c);
  }
  return fundidas.sort((a, b) => a.number - b.number);
}

/** Lo ya pagado de una factura con plan. **Derivado de las cuotas, nunca acumulado.** */
export function sumarPagadoDelPlan(
  cuotas: ReadonlyArray<{ amount?: number; status?: string }>,
): number {
  let total = 0;
  for (const c of cuotas) {
    if (c.status === "pagada") total += c.amount ?? 0;
  }
  return aCentimos(total);
}

/**
 * El estado que le corresponde al egreso, **derivado de sus cuotas** (`RN-04`).
 * `pagado` cuando ninguna queda pendiente. Nadie lo pone a mano.
 */
export function estadoDerivadoDelPlan(
  cuotas: ReadonlyArray<{ status?: string }>,
): "registrado" | "pagado" {
  return cuotas.some((c) => c.status === "pendiente") ? "registrado" : "pagado";
}
