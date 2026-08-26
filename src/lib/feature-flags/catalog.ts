/**
 * Catálogo de banderas de funcionalidad.
 *
 * **Es un mecanismo genérico de plataforma, no una pieza del programa de IA.**
 * Sirve para cualquier capacidad que tenga que poder encenderse y apagarse sin
 * desplegar: un módulo nuevo, un experimento, un cambio de comportamiento, una
 * integración con un tercero que se cae. El programa de IA es el primer cliente
 * que lo necesita (Paso 1.1 de `docs/hoja-de-ruta-ia.md`), no su dueño.
 *
 * Nada de lo que hay bajo `src/lib/feature-flags/` sabe qué es una operación de
 * IA, y así debe seguir.
 *
 * **Convención de clave:** `<area>-<capacidad>`, en kebab-case y sin puntos.
 * Sin puntos a propósito: la clave se usa como segmento de field path en
 * `featureFlagOverrides`, y un punto ahí se parsearía como anidamiento.
 *
 * Una bandera que no está aquí no existe: el lector la ignora y la consola de
 * superadmin la marca como desconocida. Eso es deliberado — un `flagKey` mal
 * escrito en la consola de Firestore tiene que ser visible, no silencioso.
 *
 * ESPEJO de `functions/src/feature-flags.ts`. `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así que el
 * catálogo vive duplicado a propósito.
 *
 * **EL CATÁLOGO VIVE EN CUATRO SITIOS, no en dos.** Añadir una bandera y tocar
 * solo los dos primeros la deja **imposible de encender**: el sembrador no crea
 * su documento y el movedor la rechaza como clave desconocida, así que la
 * capacidad se queda apagada para siempre y sin síntoma visible. Pasó con las
 * tres banderas de producto de agosto de 2026, y se descubrió al ir a
 * encenderlas en staging. Los cuatro:
 *
 *   1. `src/lib/feature-flags/catalog.ts`      — el cliente
 *   2. `functions/src/feature-flags.ts`        — el servidor
 *   3. `functions/scripts/seed-feature-flags.mjs` — crea los documentos
 *   4. `functions/scripts/mover-bandera.mjs`   — enciende y apaga
 */

/** Documento con el kill switch maestro, dentro de la misma colección. */
export const GLOBAL_FLAG_DOC_ID = "_global";

/** Colección de banderas (valores por defecto globales, sin dato de conjunto). */
export const FEATURE_FLAGS_COLLECTION = "featureFlags";

/** Colección de overrides: un documento por conjunto, con su mapa `flags`. */
export const FEATURE_FLAG_OVERRIDES_COLLECTION = "featureFlagOverrides";

/** Área de la que cuelga la capacidad. Se añaden a medida que hagan falta. */
export type FeatureFlagArea = "ia" | "producto" | "operacion";

export const FEATURE_FLAG_AREA_LABEL: Record<FeatureFlagArea, string> = {
  ia: "Inteligencia artificial",
  producto: "Producto",
  operacion: "Operación",
};

export type FeatureFlagKey =
  | "ai-gateway"
  | "ai-communications-draft"
  | "ai-pqrs-shadow"
  | "ai-pqrs-suggestions"
  | "ai-onboarding-column-mapping"
  | "ai-receipts-extraction"
  | "ia-proveedor-real"
  | "producto-importacion-masiva"
  | "producto-reservas-servidor"
  | "producto-cobro-por-coeficiente"
  | "producto-registro-proveedores"
  | "producto-plan-de-cuentas"
  | "producto-concepto-al-libro"
  | "producto-anticipos"
  | "producto-pago-multiple"
  | "producto-multiconjunto"
  | "producto-prorrateo-de-gastos"
  | "producto-estado-de-cuenta"
  | "producto-entrega-de-correo"
  | "operacion-app-check-monitor";

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  area: FeatureFlagArea;
  /** Nombre corto para la consola. */
  label: string;
  /** Qué apaga exactamente, en una frase. Lo lee quien tenga que apagarlo de madrugada. */
  description: string;
  /**
   * Valor cuando no hay documento en Firestore. La regla que decide cuál va:
   *
   *  - Capacidad **nueva** → `false`. Nace apagada y se enciende mirando.
   *  - Bandera puesta sobre una capacidad **que ya está viva** → `true`. Si
   *    naciera apagada, añadir la bandera sería apagar la función para todos.
   */
  defaultEnabled: boolean;
  /** De dónde sale, para que la consola no sea una lista de claves sueltas. */
  origen: string;
  /**
   * Qué sigue funcionando con la bandera apagada. Sin esta respuesta escrita,
   * apagar da miedo — y una bandera que da miedo apagar no es una bandera.
   */
  alApagar: string;
}

export const FEATURE_FLAG_CATALOG: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  "ai-gateway": {
    key: "ai-gateway",
    area: "ia",
    label: "Puerta de entrada de IA",
    description:
      "Interruptor general de la plataforma de IA: con esto apagado ninguna operación asistida llega al proveedor, sin importar el resto de banderas.",
    defaultEnabled: false,
    origen: "PLAT-001",
    alApagar: "Todo el producto sigue igual. La IA todavía no tiene consumidores.",
  },
  "ai-communications-draft": {
    key: "ai-communications-draft",
    area: "ia",
    label: "Borrador asistido de comunicaciones",
    description: "Panel de hechos y propuesta de redacción dentro del formulario de comunicaciones.",
    defaultEnabled: false,
    origen: "FEAT-003 — el canario, Paso 2",
    alApagar: "El administrador redacta la comunicación a mano, como hoy.",
  },
  "ai-pqrs-shadow": {
    key: "ai-pqrs-shadow",
    area: "ia",
    label: "Clasificación de PQRS en modo sombra",
    description:
      "Clasifica cada ticket en silencio y guarda el resultado junto a lo que decidió el administrador. No se le muestra a nadie.",
    defaultEnabled: false,
    origen: "FEAT-002 — Paso 3",
    alApagar: "Se deja de acumular conjunto de evaluación. Ningún usuario nota nada.",
  },
  "ai-pqrs-suggestions": {
    key: "ai-pqrs-suggestions",
    area: "ia",
    label: "Sugerencia visible de PQRS",
    description: "Muestra al administrador la categoría y el resumen propuestos para un ticket.",
    defaultEnabled: false,
    origen: "FEAT-002 — Paso 3",
    alApagar: "El administrador clasifica el ticket a mano, como hoy.",
  },
  "ai-onboarding-column-mapping": {
    key: "ai-onboarding-column-mapping",
    area: "ia",
    label: "Mapeo asistido de columnas",
    description: "Resuelve encabezados ambiguos al importar el padrón en CSV o XLSX.",
    defaultEnabled: false,
    origen: "FEAT-001 — Paso 4",
    alApagar: "El importador cae al mapeo manual de columnas, que no depende de IA.",
  },
  "ai-receipts-extraction": {
    key: "ai-receipts-extraction",
    area: "ia",
    label: "Extracción de comprobantes",
    description:
      "Propone campos y niveles de confianza de un comprobante de pago. Nunca aplica el pago: eso sigue siendo de una persona.",
    defaultEnabled: false,
    origen: "DOC-001 — Paso 5",
    alApagar: "El comprobante se captura a mano. `approveReceiptAndRegisterPayment` no cambia.",
  },
  "ia-proveedor-real": {
    key: "ia-proveedor-real",
    area: "ia",
    label: "Llamar al proveedor real",
    description:
      "Apagada, las operaciones asistidas responden con un simulador y no cuestan nada. Encendida, se llama a Vertex AI de verdad.",
    // Es la bandera que empieza a gastar dinero. Nace apagada, y encenderla
    // debería ser un acto consciente y mirando la consola de consumo.
    defaultEnabled: false,
    origen: "Paso 1.4 — adaptador del proveedor",
    alApagar:
      "Se vuelve al simulador al instante, sin desplegar. Es el freno de mano si el proveedor se cae o el gasto se dispara.",
  },
  "producto-importacion-masiva": {
    key: "producto-importacion-masiva",
    area: "producto",
    label: "Importación masiva desde archivo",
    description:
      "Los dos asistentes de carga desde CSV o XLSX —unidades y residentes— con su paso de mapeo de columnas.",
    // Nace ENCENDIDA, y no es un descuido: los dos asistentes ya estaban vivos
    // en producción antes de que existiera esta bandera. Si naciera apagada,
    // añadirla le quitaría a los conjuntos actuales algo que hoy usan.
    defaultEnabled: true,
    origen: "PRD-V-FEAT-002 — importación de datos del conjunto",
    alApagar:
      "Desaparecen las dos entradas de /admin/residents y el recorrido guiado deja de abrir el asistente: manda al alta individual. Las unidades y las personas se crean a mano, una a una. Lo ya importado no se toca.",
  },
  "producto-multiconjunto": {
    key: "producto-multiconjunto",
    area: "producto",
    label: "Un administrador sobre varios conjuntos",
    description:
      "Selector de conjunto en la barra superior para quien tenga más de una membresía. No gobierna las callables: la autoridad es el documento de membresía y eso va desplegado aparte y antes.",
    // Nace APAGADA: capacidad nueva. Y hoy no la ve nadie aunque se encienda,
    // porque el selector solo aparece con DOS membresías o más, y en producción
    // no hay ninguna persona con dos.
    defaultEnabled: false,
    origen: "PRD-V-PLAT-002 §11.4 — administradora multiconjunto, entrega 2",
    alApagar:
      "Apagada GLOBALMENTE: desaparece el selector y cada quien opera el conjunto que ya tenía; quien tenga varias membresías se queda en la última usada y deja de poder cambiar sin cerrar sesión. Apagarla en UN SOLO conjunto es distinto y peor: quien esté parado en él pierde el selector y no puede volver a los demás sin cerrar sesión —y al reentrar, `lastActiveTenantId` lo devuelve ahí—. Por eso esta bandera se enciende y se apaga GLOBAL.",
  },
  "producto-prorrateo-de-gastos": {
    key: "producto-prorrateo-de-gastos",
    area: "producto",
    label: "Repartir un gasto entre las unidades",
    description:
      "Desde un egreso registrado, repartirlo entre las unidades activas por coeficiente y generar los cargos, con trazabilidad en los dos sentidos y anulación de la corrida entera.",
    // Nace APAGADA: crea decenas de cargos de dinero real en una operación.
    defaultEnabled: false,
    origen: "PRD-V-FLOW-001 §11.3 — prorrateo de un gasto entre las unidades",
    alApagar:
      "Desaparece «Repartir entre unidades» del egreso. **Lo ya repartido NO se deshace**: los cargos creados siguen vivos y se cobran. Para deshacerlos hay que anular la corrida ANTES de apagarla, porque apagada tampoco se puede anular. Un cargo con pagos aplicados no se anula en lote en ningún caso: eso es `revertirPago`.",
  },
  "producto-entrega-de-correo": {
    key: "producto-entrega-de-correo",
    area: "producto",
    label: "Rastro de entrega del correo",
    description:
      "Deja constancia de cada correo enviado y de qué le pasó — entregado, rebotado o marcado como spam—, para poder corregir el contacto de quien no lo recibe.",
    // Nace APAGADA: sin ella no se escribe una sola fila, así que encenderla es lo
    // que empieza a acumular el rastro. Apagarla NO borra lo ya acumulado.
    defaultEnabled: false,
    origen: "PRD-V-FLOW-003 §11.3 — entrega medida",
    alApagar:
      "Dejan de registrarse los envíos nuevos. **Lo ya registrado NO se borra** y el webhook sigue pudiendo mover esas filas, para que un rebote que llega tarde no se pierda. Lo que desaparece es el rastro de lo que se mande a partir de ese momento, y con él la lista de rebotes deja de crecer: alguien puede quedarse sin recibir avisos y nadie se enteraría.",
  },
  "producto-estado-de-cuenta": {
    key: "producto-estado-de-cuenta",
    area: "producto",
    label: "Estado de cuenta y paz y salvo",
    description:
      "El residente descarga el estado de cuenta de su unidad y, si está al día, emite su propio certificado de paz y salvo sin pedírselo al administrador.",
    // Nace APAGADA: el paz y salvo es un documento que se usa ante terceros.
    defaultEnabled: false,
    origen: "PRD-V-FEAT-004 §11.3 — estado de cuenta y paz y salvo",
    alApagar:
      "Desaparecen la descarga del estado de cuenta y la emisión del certificado. **Los certificados ya emitidos NO se retiran**: siguen vivos y descargables, y para retirarlos hay que anularlos ANTES de apagarla —anular sigue funcionando con la bandera apagada, justo para no dejar papeles sin forma de retirarlos—.",
  },
  "producto-reservas-servidor": {
    key: "producto-reservas-servidor",
    area: "producto",
    label: "Reservas decididas en el servidor",
    description:
      "La reserva del residente se crea vía callable, con las trece reglas —mora, cupo, aforo, horario, solapamiento— verificadas donde el cliente no puede mentir.",
    // Nace APAGADA: es el paso 2 del despliegue de PRD-V-FIX-001. La regla de
    // Firestore que permite la escritura directa NO se cierra hasta verificar,
    // con esto encendido en todos los conjuntos, que ya nadie escribe directo.
    defaultEnabled: false,
    origen: "PRD-V-FIX-001 — reglas de reserva en el servidor, entrega 1",
    alApagar:
      "El residente vuelve a crear la reserva escribiendo directo, con las comprobaciones solo en el navegador — el comportamiento de hoy. Nada se rompe mientras la regla de Firestore siga abierta; por eso la regla no se cierra hasta que esta bandera lleve tiempo encendida sin escrituras directas.",
  },
  "producto-cobro-por-coeficiente": {
    key: "producto-cobro-por-coeficiente",
    area: "producto",
    label: "Corrida de cobro por coeficiente",
    description:
      "Genera la cuota del período repartiendo un total entre las unidades según su coeficiente de copropiedad, con vista previa calculada por el servidor.",
    // Nace apagada: capacidad nueva. Los campos de la unidad (coeficiente,
    // expensa) se pueden cargar con la bandera apagada — son parte de la
    // puesta en marcha — pero el botón de generar no aparece hasta encenderla.
    defaultEnabled: false,
    origen: "PRD-V-PLAT-001 — copropiedad y modelo de unidad",
    alApagar:
      "Desaparece el botón de generar por coeficiente. La corrida plana de siempre sigue intacta, y los coeficientes ya cargados se conservan sin efecto.",
  },
  "producto-registro-proveedores": {
    key: "producto-registro-proveedores",
    area: "producto",
    label: "Registro de proveedores",
    description:
      "Proveedores y beneficiarios como entidad: datos bancarios, categoría por defecto y selección en el egreso con copia congelada del nombre.",
    // Nace apagada: capacidad nueva.
    defaultEnabled: false,
    origen: "PRD-V-FEAT-003 — registro de proveedores y beneficiarios",
    alApagar:
      "Desaparecen el botón de gestión y el selector del formulario de egreso. El nombre a mano sigue funcionando — nunca se retira — y los egresos ya ligados conservan su vendorId sin efecto.",
  },
  "producto-plan-de-cuentas": {
    key: "producto-plan-de-cuentas",
    area: "producto",
    label: "Plan de cuentas del conjunto",
    description:
      "Deja al administrador crear, renombrar y desactivar cuentas de su propio plan. No afecta a en qué cuenta cae el dinero: de eso se ocupa `producto-concepto-al-libro`.",
    defaultEnabled: false,
    origen: "PRD-V-PLAT-003",
    alApagar:
      "El plan sembrado sigue ahí y los informes lo siguen usando. Solo desaparece la edición.",
  },
  "producto-concepto-al-libro": {
    key: "producto-concepto-al-libro",
    area: "producto",
    label: "El concepto del cargo llega al libro",
    description:
      "Al cobrar, el asiento lleva la cuenta del concepto del cargo en vez de «alicuota» fijo — y el libro deja de contar dos veces lo que Cartera ya suma.",
    // Nace apagada y va SOLA en su despliegue: cambia lo que el administrador
    // ve en el estado financiero. No es un error nuevo, es el viejo dejando de
    // ocurrir (PRD §5.2), pero hay que poder encenderlo mirando.
    defaultEnabled: false,
    origen: "PRD-V-PLAT-003 §5.2",
    alApagar:
      "Todo asiento NUEVO vuelve a escribirse como «alicuota» y el recaudo se vuelve a ver junto. Los ya escritos con su cuenta correcta se quedan — y no se quieren revertir: son los correctos.",
  },
  "producto-anticipos": {
    key: "producto-anticipos",
    area: "producto",
    label: "El sobrepago deja saldo a favor",
    description:
      "Cuando alguien paga más de lo que debe, el excedente se guarda como anticipo de la unidad en vez de contarse entero como pago de la cuota.",
    // Nace apagada porque CAMBIA UN NÚMERO QUE YA SE MIRA: hoy un pago de 200
    // sobre una cuota de 140 deja `paymentAmount: 200`, y con la bandera
    // encendida deja 140 más un anticipo de 60. El dinero total es el mismo —lo
    // exige R1— pero el recaudo de Cartera baja en el importe del sobrante, que
    // pasa a contarse por el libro. Hay que poder encenderlo mirando.
    defaultEnabled: false,
    origen: "PRD-V-FLOW-002 §5.1, R2",
    alApagar:
      "Los anticipos ya creados NO se borran y SIGUEN VISIBLES, pero dejan de poder cruzarse y anularse hasta volver a encenderla: el servidor exige la bandera también para esas dos operaciones. Lo que vuelve al comportamiento viejo es el sobrepago NUEVO, que otra vez se contabiliza entero contra la cuota.",
  },
  "producto-pago-multiple": {
    key: "producto-pago-multiple",
    area: "producto",
    label: "Un pago cubre varios cargos",
    description:
      "Permite repartir un solo pago entre varios cargos de la misma unidad, en una sola operación y con un solo recibo, en vez de registrar uno por cuota.",
    // Separada de `producto-anticipos` a propósito (§11.4): el reparto puede
    // salir sin los anticipos, pero **no al revés** — sin anticipo, el sobrante
    // de un reparto volvería a evaporarse, que es el defecto que FLOW-002 cierra.
    defaultEnabled: false,
    origen: "PRD-V-FLOW-002 §5.1, R7",
    alApagar:
      "El servidor deja de aceptar repartos de más de un cargo. Los pagos ya repartidos NO se tocan: siguen aplicados y se revierten con normalidad.",
  },
  "operacion-app-check-monitor": {
    key: "operacion-app-check-monitor",
    area: "operacion",
    label: "App Check en modo monitor",
    description:
      "Mientras está encendida, la puerta de IA deja pasar llamadas sin token de App Check y las registra en los logs. Es el estado de observación previo a exigirlo.",
    // Nace ENCENDIDA porque describe lo que ya pasa hoy: no se exige App Check
    // en ningún sitio. Si naciera apagada, activaría un rechazo que nadie ha
    // podido comprobar todavía.
    defaultEnabled: true,
    origen: "Paso 1.2 — punto de entrada único",
    alApagar:
      "La puerta empieza a RECHAZAR las llamadas sin App Check. Apagarla solo después de ver en los logs que el tráfico legítimo trae token.",
  },
};

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAG_CATALOG) as FeatureFlagKey[];

/** Claves del catálogo agrupadas por área, en el orden en que se declararon. */
export function featureFlagKeysByArea(): Array<{ area: FeatureFlagArea; keys: FeatureFlagKey[] }> {
  const areas: FeatureFlagArea[] = ["ia", "producto", "operacion"];
  return areas
    .map((area) => ({ area, keys: FEATURE_FLAG_KEYS.filter((key) => FEATURE_FLAG_CATALOG[key].area === area) }))
    .filter((group) => group.keys.length > 0);
}

export function isKnownFeatureFlag(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_CATALOG, key);
}

/** El estado del que parte el cliente antes de leer Firestore. */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = FEATURE_FLAG_KEYS.reduce(
  (acc, key) => {
    acc[key] = FEATURE_FLAG_CATALOG[key].defaultEnabled;
    return acc;
  },
  {} as Record<FeatureFlagKey, boolean>,
);
