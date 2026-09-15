// El CONTENIDO de los documentos de Lomas de Sayilbedra (plan de documentos, A1–C4). Puro: arma los
// bloques que pinta `documentoEstructurado`, a partir de los datos del guion. No escribe nada.
//
// Todo lo que cuenta un documento sale de un dato sembrado: los horarios y turnos de cada área de su
// política, los nombres del consejo de las cuentas con marca, la cuota del presupuesto. Los cuatro
// artículos que ya citan el guion y un PQRS (18, 24, 31 y 40) se conservan palabra por palabra.

import { createRequire } from "node:module";

import { azar } from "./azar.mjs";
import { AREAS, CUOTA_MENSUAL_TOTAL, EGRESOS_RECURRENTES, NOMBRE, PRESUPUESTO_2026, PROVEEDORES, SECCIONES } from "./lomas-de-sayilbedra.mjs";
import { ACUERDOS, COMUNICADOS, DOCUMENTOS, REGLAMENTO } from "./lomas-operacion.mjs";
import { mesMas } from "./reloj.mjs";

const require = createRequire(import.meta.url);
const { cuentaPorCodigo } = require("../../lib/plan-de-cuentas.js");
const libPagos = require("../../lib/payments.js");
const nucleo = require("../../lib/nucleo-estado-financiero.js");
const informeMensual = require("../../lib/informe-mensual.js");

/**
 * Sube cuando cambia el maquetador, un texto o un DIBUJO: la huella de cada archivo la incluye, y la
 * de una imagen no lee sus bytes (describe sus datos), así que un dibujo cambiado no se notaría solo.
 */
export const VERSION_DOCUMENTOS = 5;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fechaLarga = (dia) => `${Number(dia.slice(8, 10))} de ${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;

function duracion(minutos) {
  if (minutos % 1440 === 0) return minutos === 1440 ? "un día" : `${minutos / 1440} días`;
  if (minutos % 60 === 0) return minutos === 60 ? "una hora" : `${minutos / 60} horas`;
  if (minutos > 60) {
    const horas = Math.floor(minutos / 60);
    return `${horas === 1 ? "una hora" : `${horas} horas`} y ${minutos % 60} minutos`;
  }
  return `${minutos} minutos`;
}

function diasDeServicio(disponibles) {
  if (disponibles.length === 7) return "todos los días";
  const cerrados = DIAS.filter((_, i) => !disponibles.includes(i));
  return `todos los días salvo ${cerrados.join(" y ")}`;
}

/** Los artículos que el guion ya usa, por número: su texto no se toca. */
function articulosDelGuion() {
  const fijos = new Map();
  for (const p of REGLAMENTO.parrafos) {
    const m = /^Artículo (\d+)\. (.*)$/.exec(p);
    if (!m) throw new Error(`El reglamento del guion trae un párrafo sin número: «${p}»`);
    fijos.set(Number(m[1]), m[2]);
  }
  return fijos;
}

/** Las reglas de cada área, de su política en el padrón. */
function reglasDeArea(a) {
  const partes = [
    `${a.name}: ${diasDeServicio(a.availableWeekdays)}, de ${a.operatingHoursStart} a ${a.operatingHoursEnd} horas, en turnos de ${duracion(a.slotDurationMinutes)}.`,
    `Se reserva con al menos ${duracion(a.minAdvanceMinutes)} de anticipación y cada casa puede tener hasta ${a.maxReservationsPerUnitPerMonth} reservas al mes.`,
    a.autoApprove ? "La reserva queda confirmada al hacerla." : "La administración confirma cada reserva.",
    a.blockOnDebt ? "No puede reservarla una casa con cuotas vencidas." : "Puede reservarla cualquier casa, esté o no al corriente.",
    a.usageRules,
  ];
  return partes.join(" ");
}

/** El consejo: las dos cuentas con marca del padrón, en su orden, con su cargo y su casa. */
function consejoDe(padron) {
  const casas = new Map(padron.casas.map((c) => [c.id, c.displayName]));
  const consejo = padron.cuentas.filter((c) => c.consejo);
  if (consejo.length < 2) throw new Error(`El consejo son dos consejeros y el padrón trae ${consejo.length}.`);
  const cargos = ["Presidente del consejo de administración", "Secretaria del consejo de administración"];
  return consejo.slice(0, 2).map((c, i) => ({ nombre: c.fullName, cargo: cargos[i], casa: casas.get(c.casaId) ?? "" }));
}

/**
 * El reglamento interno completo (A1). Artículos numerados en orden: los del guion caen en su número
 * y el resto se reparte alrededor, por capítulos.
 */
export function reglamentoCompleto(padron) {
  const fijos = articulosDelGuion();
  const consejo = consejoDe(padron);
  const cuotaTexto = CUOTA_MENSUAL_TOTAL.toLocaleString("es-MX");

  const capitulos = [
    ["Capítulo I. Disposiciones generales", [
      `Este reglamento rige la convivencia, el uso de las áreas comunes y la administración del fraccionamiento ${NOMBRE}, integrado por ${padron.casas.length} casas en tres secciones: Encinos, Fresnos y Jacarandas.`,
      "Lo deben cumplir condóminos, inquilinos, familiares, empleados y visitantes. Quien renta su casa entrega una copia de este reglamento a su inquilino.",
      "Son áreas comunes las calles, andadores, jardines, la caseta, la casa club, la alberca, la palapa, el gimnasio y la cancha de pádel.",
      "Los avisos oficiales de la administración y del consejo se publican en el portal de Vivaru; lo publicado ahí se tiene por comunicado.",
      "Lo que este reglamento no prevea lo resuelve el consejo de administración, y en su caso la asamblea.",
    ]],
    ["Capítulo II. Asamblea, consejo y administración", [
      "La asamblea de condóminos es el órgano supremo del fraccionamiento. Se reúne en forma ordinaria una vez al año, en enero, y en forma extraordinaria cuando la convoque el consejo.",
      "Cada casa vota según su indiviso. El quórum de la asamblea ordinaria es la mitad más uno de los indivisos en primera convocatoria y los presentes en segunda.",
      "El consejo de administración vigila a la administración, aprueba los gastos no presupuestados y firma el informe económico de cada mes.",
      "La administración cobra las cuotas, paga a los proveedores, lleva la contabilidad y presenta cada mes el informe económico al consejo.",
      "Los acuerdos del consejo que obligan a los condóminos se publican en el portal y se firman desde ahí.",
      "Cualquier condómino puede consultar en el portal los informes económicos firmados y los acuerdos vigentes.",
    ]],
    ["Capítulo III. Cuotas, indiviso y fondo de reserva", [
      `La cuota de mantenimiento cubre el presupuesto aprobado por la asamblea. En 2026 suma $${cuotaTexto} al mes y se reparte entre las casas según su indiviso.`,
      "La cuota se paga por mes adelantado y vence el día 10. Se paga por transferencia a la cuenta del fraccionamiento, y el comprobante se sube en el portal.",
      "Una parte de la cuota se destina al fondo de reserva, que solo se usa para reparaciones mayores o emergencias aprobadas por el consejo.",
      "Las cuotas extraordinarias las aprueba el consejo o la asamblea, y se reparten también por indiviso.",
      "Quien tenga saldo a favor lo ve en su estado de cuenta, y se aplica a la siguiente cuota que venza.",
    ]],
    ["Capítulo IV. Convivencia", [
      "Las fiestas en las casas se avisan en caseta con un día de anticipación, con la lista de invitados.",
      "La basura se saca en bolsas cerradas los lunes, miércoles y viernes, antes de las 8:00. Los muebles y escombros se retiran por cuenta de cada casa.",
      "Las fachadas conservan los colores aprobados por la asamblea; un cambio de color o de rejas se consulta antes con el consejo.",
      "La ropa no se tiende a la vista desde la calle.",
      "No se permite fumar en las áreas comunes techadas, en la alberca ni en el gimnasio.",
    ]],
    ["Capítulo V. Mascotas", [
      "Cada casa puede tener hasta dos perros o gatos. Se registran en la administración con su cartilla de vacunación.",
      "Los perros de razas de guardia salen siempre con correa corta y bozal.",
      "No se permite la entrada de mascotas a la alberca, al gimnasio ni a la casa club.",
    ]],
    ["Capítulo VI. Estacionamiento y vialidad", [
      "La velocidad máxima dentro del fraccionamiento es de 20 kilómetros por hora.",
      "Cada casa estaciona en su cochera. Los visitantes usan el estacionamiento de visitas junto a la caseta.",
      "Los vehículos pesados solo entran para mudanzas o entregas, en el horario que marca este reglamento.",
      "Un vehículo abandonado más de 15 días en un área común se reporta a la administración.",
      "Las bicicletas y patines circulan por la derecha y ceden el paso a los peatones.",
    ]],
    ["Capítulo VII. Seguridad, accesos y visitas", [
      // Sin el QR ni las cámaras: el reglamento es de enero, el QR llegó en agosto (comunicado del
      // 28) y las cámaras las aprobó el consejo en septiembre. Un documento no puede citar su futuro.
      "Las visitas entran con la autorización del residente, que la caseta confirma antes de abrir.",
      "Los proveedores y trabajadores de las casas se registran en caseta con una identificación, a la entrada y a la salida.",
      "La caseta recibe los paquetes de los residentes y los avisa; se entregan a quien viva en la casa.",
      "La caseta lleva una bitácora de entradas y salidas, que el consejo puede consultar ante un incidente.",
    ]],
    ["Capítulo VIII. Áreas comunes y reservas", [
      "Los niños menores de 12 años usan las áreas comunes acompañados de un adulto.",
      "Quien reserva un área responde por sus invitados y por los daños que causen.",
      "La administración puede cerrar un área por mantenimiento o por clima, y lo avisa en el portal.",
      ...AREAS.map(reglasDeArea),
    ]],
    ["Capítulo IX. Mudanzas y obras", [
      // Sin plazo de anticipación: el producto pide 30 minutos (`construirMudanza`), y un reglamento
      // que exigiera días contradiría lo que la pantalla deja hacer.
      "Las mudanzas se solicitan en el portal antes de hacerlas, y se hacen de 9:00 a 14:00, de lunes a sábado.",
      "Las obras y remodelaciones se avisan a la administración antes de empezar, con el nombre del responsable y la duración.",
      "Los trabajos con ruido se hacen de lunes a viernes de 9:00 a 18:00 y los sábados de 9:00 a 14:00.",
      "El escombro se retira el mismo día y no se deja en la calle.",
    ]],
    ["Capítulo X. Sanciones", [
      "El incumplimiento de este reglamento se reporta a la administración, que da aviso por escrito a la casa responsable.",
      "Si la falta se repite, el consejo puede suspender el uso de las áreas comunes a la casa responsable.",
      "Los daños a las áreas comunes los paga quien los causa, previa cotización de la administración.",
    ]],
  ];

  const bloques = [];
  let numero = 1;
  const siguienteLibre = () => {
    while (fijos.has(numero)) numero += 1;
  };
  for (const [titulo, articulos] of capitulos) {
    bloques.push({ tipo: "capitulo", texto: titulo });
    for (const texto of articulos) {
      // Antes de cada artículo nuevo, los del guion que ya tocan en este punto de la numeración.
      while (fijos.has(numero)) {
        bloques.push({ tipo: "articulo", numero: `Artículo ${numero}.`, texto: fijos.get(numero) });
        numero += 1;
      }
      siguienteLibre();
      bloques.push({ tipo: "articulo", numero: `Artículo ${numero}.`, texto });
      numero += 1;
    }
  }
  const pendientes = [...fijos.keys()].filter((n) => n >= numero);
  if (pendientes.length) throw new Error(`El reglamento se quedó corto: los artículos ${pendientes.join(", ")} del guion no caben.`);

  bloques.push({ tipo: "capitulo", texto: "Transitorios" });
  bloques.push({ tipo: "articulo", numero: "Primero.", texto: "Este reglamento entra en vigor el día de su aprobación por la asamblea ordinaria del 25 de enero de 2026." });
  bloques.push({ tipo: "articulo", numero: "Segundo.", texto: "Queda sin efecto el reglamento anterior y cualquier disposición que se le oponga." });
  bloques.push({ tipo: "parrafo", texto: "Aprobado por la asamblea ordinaria de condóminos. Firman el presidente y la secretaria del consejo de administración." });
  bloques.push({ tipo: "firmas", firmantes: consejo.map(({ nombre, cargo }) => ({ nombre, cargo })) });

  return {
    titulo: REGLAMENTO.titulo,
    subtitulo: "Aprobado en la asamblea ordinaria del 25 de enero de 2026",
    encabezado: `${NOMBRE} · Reglamento interno 2026`,
    fecha: new Date(Date.UTC(2026, 0, 25)),
    bloques,
  };
}

/**
 * Lo que pasó en cada sesión del consejo además de sus acuerdos, que vienen de `ACUERDOS` palabra por
 * palabra. Cada dato cita algo sembrado —un comunicado, un egreso, una firma de informe, una
 * encuesta— y ninguno lo contradice.
 *
 * - La del 16 de julio cierra antes de las 17:30 porque su acuerdo se sube a esa hora y se envía a las
 *   18:00 del mismo día (`acuerdo`, en `escritores/operacion.mjs`). `actaDelConsejo` lo comprueba.
 * - Y en ella el consejo RATIFICA: la historia paga el anticipo de la impermeabilización el 6 de julio
 *   y lo prorratea el 7, antes de la sesión. El acta lo cuenta como una autorización urgente.
 * - El 9 de septiembre solo firma el informe de agosto el presidente (`FIRMAS_DE_INFORMES`): la
 *   secretaria es la cuenta demo del consejo, y la demo necesita esa firma pendiente.
 */
export const SESIONES_DEL_CONSEJO = {
  "2026-06-18": {
    tipo: "ordinaria", inicio: "19:00", cierre: "20:10",
    informe: [
      "Desde el 1 de junio, los avisos, los pagos, las reservas y los PQRS del fraccionamiento se gestionan en el portal de Vivaru. En la primera semana la administración subió a Documentos el reglamento interno, el acta de la asamblea de enero, el contrato de vigilancia y el plano del fraccionamiento.",
      "El martes 9 de junio se cortó el agua de 9:00 a 14:00 para dar mantenimiento a la bomba del pozo, con aviso a la comunidad desde el día 5.",
      "El 12 de junio se contrató la póliza de responsabilidad civil y daños en áreas comunes para 2026–2027, por $18,500.",
      "El lunes 15 de junio se fumigaron los jardines, la casa club y los registros, por $2,800.",
    ],
    notas: {},
    generales: [
      "La administración informa que hoy se abrió en el portal la encuesta sobre el horario de la alberca, con voto hasta el 30 de junio.",
    ],
  },
  "2026-07-16": {
    tipo: "extraordinaria", inicio: "10:00", cierre: "11:20",
    informe: [
      "El informe económico de junio quedó firmado en el portal por los dos consejeros el 13 de julio.",
      "Con las primeras lluvias de julio aparecieron filtraciones en el techo del salón de la casa club. Por la urgencia, el presidente autorizó a la administración contratar la impermeabilización con Impermeabilizantes y Techos del Centro, S.A. de C.V., por $96,000 en dos pagos. El lunes 6 de julio se pagó el anticipo del 50 %, $48,000, y el 7 se cargó a cada casa su parte, por indiviso.",
      "El 8 de julio se compró una bomba sumergible nueva para el pozo, con instalación, por $36,000, pagadera al proveedor en tres cuotas de $12,000: el 15 de julio, el 15 de agosto y el 15 de septiembre. La primera se pagó ayer.",
    ],
    notas: {
      "extraordinaria-impermeabilizacion": "El consejo ratifica la autorización del presidente y el anticipo pagado. El finiquito del 50 % se paga al terminar la obra, en agosto, y se carga a las casas de la misma manera.",
    },
    generales: [
      "El consejo ratifica la compra de la bomba sumergible del pozo.",
      "Se recuerda la jornada de limpieza y reforestación del sábado 18 de julio a las 8:00, con punto de reunión en la palapa.",
    ],
  },
  "2026-08-20": {
    tipo: "ordinaria", inicio: "19:00", cierre: "20:05",
    informe: [
      "El informe económico de julio quedó firmado en el portal por los dos consejeros el 12 de agosto.",
      "El 7 de agosto se pagó el finiquito de la impermeabilización de la casa club, $48,000, y el 8 se cargó a cada casa su parte, por indiviso. El 10 de agosto la administración subió a Documentos la memoria de la obra, que tiene garantía de cinco años.",
      "Del 10 al 12 de agosto la alberca cerró por limpieza profunda y cambio de filtros; reabrió el jueves 13.",
      "El 14 de agosto se pagaron la segunda cuota de la bomba del pozo, $12,000, y la fumigación bimestral de agosto, $2,800, conforme al calendario acordado en junio.",
    ],
    notas: {},
    generales: [
      "Se informa a la comunidad del simulacro nacional de sismo del sábado 19 de septiembre; el punto de reunión es frente a la caseta.",
    ],
  },
  "2026-09-09": {
    tipo: "ordinaria", inicio: "19:00", cierre: "20:20",
    informe: [
      "La administración presenta el informe económico de agosto, que está en Documentos desde el 3 de septiembre. El consejo lo revisa sin observaciones; el presidente lo firma en el portal y la secretaria lo firmará en los próximos días.",
      "Desde el 1 de septiembre las visitas entran con el código QR que genera cada residente en su portal; la caseta lo escanea y avisa a la casa al registrar la llegada.",
      "La tercera y última cuota de la bomba del pozo, $12,000, vence el 15 de septiembre.",
    ],
    notas: {
      "camaras-accesos": "El consejo tomó en cuenta la encuesta que respondió la comunidad del 20 de julio al 5 de agosto. Antes de contratar, la administración presentará tres cotizaciones.",
    },
    generales: [
      "La encuesta sobre la posada de fin de año cerró el 7 de septiembre; el consejo fijará la fecha con sus resultados.",
      "Para la noche mexicana del martes 15 de septiembre en la casa club, la administración abrió ayer la encuesta en el portal. El 15 y el 16 la caseta atenderá con doble turno.",
    ],
  },
};

const EN_EL_PORTAL = {
  obligatoria: "Se publica en el portal de Vivaru, donde cada casa lo firma.",
  parcial: "Se publica en el portal de Vivaru para que lo respalden con su firma las casas que quieran.",
  informativo: "Se publica en el portal de Vivaru para conocimiento de la comunidad; no requiere firma.",
};

/**
 * El acta completa de una sesión del consejo (A2): asistencia y quórum, orden del día, informe de la
 * administración, los acuerdos de la sesión con su número del año, asuntos generales y firmas. Los
 * acuerdos de una misma sesión comparten acta, como en papel.
 */
export function actaDelConsejo(padron, dia) {
  const s = SESIONES_DEL_CONSEJO[dia];
  const acuerdos = ACUERDOS.map((a, i) => ({ ...a, numero: i + 1 })).filter((a) => a.sesion === dia);
  if (!s || !acuerdos.length) throw new Error(`No hay sesión del consejo el ${dia} en el guion (o no tiene acuerdos).`);
  for (const clave of Object.keys(s.notas)) {
    if (!acuerdos.some((a) => a.clave === clave)) throw new Error(`La sesión del ${dia} anota el acuerdo «${clave}», que no es suyo.`);
  }
  for (const a of acuerdos) {
    if (!EN_EL_PORTAL[a.modo]) throw new Error(`El acuerdo «${a.clave}» trae un modo de firma desconocido: ${a.modo}`);
    if (a.enviado === dia && s.cierre >= "17:30") throw new Error(`La sesión del ${dia} cierra a las ${s.cierre} y su acuerdo «${a.clave}» se sube a las 17:30.`);
  }
  const consejo = consejoDe(padron);

  const bloques = [
    { tipo: "parrafo", texto: `En el fraccionamiento ${NOMBRE}, en el salón de la casa club, siendo las ${s.inicio} horas del ${fechaLarga(dia)}, se reunió en sesión ${s.tipo} el consejo de administración.` },
    { tipo: "capitulo", texto: "Asistencia y quórum" },
    {
      tipo: "tabla", columnas: ["Nombre", "Cargo", "Casa"], anchos: [3, 3.4, 1.2],
      filas: [...consejo.map((c) => [c.nombre, c.cargo, c.casa]), ["Administración del fraccionamiento", "Con voz y sin voto", "—"]],
    },
    { tipo: "parrafo", texto: "Están presentes los dos integrantes del consejo, por lo que hay quórum para sesionar. Preside el presidente y levanta el acta la secretaria." },
    { tipo: "capitulo", texto: "Orden del día" },
    { tipo: "lista", items: ["Asistencia y quórum.", "Informe de la administración.", ...acuerdos.map((a) => `${a.titulo}.`), "Asuntos generales."] },
    { tipo: "capitulo", texto: "Informe de la administración" },
    ...s.informe.map((texto) => ({ tipo: "parrafo", texto })),
    { tipo: "capitulo", texto: "Acuerdos" },
    ...acuerdos.flatMap((a) => [
      { tipo: "articulo", numero: `Acuerdo ${a.numero} de 2026.`, texto: a.detalle },
      { tipo: "parrafo", texto: [s.notas[a.clave], "Votación: dos votos a favor y ninguno en contra; se aprueba por unanimidad.", EN_EL_PORTAL[a.modo]].filter(Boolean).join(" ") },
    ]),
    { tipo: "capitulo", texto: "Asuntos generales" },
    ...s.generales.map((texto) => ({ tipo: "parrafo", texto })),
    { tipo: "parrafo", texto: `No habiendo más asuntos que tratar, se cierra la sesión a las ${s.cierre} horas del mismo día. Firman al calce los integrantes del consejo.` },
    { tipo: "firmas", firmantes: consejo.map(({ nombre, cargo }) => ({ nombre, cargo })) },
  ];

  return {
    titulo: "Acta de la sesión del consejo de administración",
    subtitulo: `Sesión ${s.tipo} del ${fechaLarga(dia)} · ${NOMBRE}`,
    encabezado: `${NOMBRE} · Consejo de administración · ${fechaLarga(dia)}`,
    fecha: new Date(`${dia}T12:00:00.000Z`),
    bloques,
  };
}

// ── A3 · La asamblea ordinaria de enero ──────────────────────────────────────────────────────────

/**
 * La asamblea ordinaria de 2026. La fecha la ponen el reglamento y el presupuesto sembrado
 * (`aprobadoEn: "2026-01-25"`); la hora, el acta del guion («siendo las 10:00»), que es la primera
 * convocatoria: por eso el quórum tiene que pasar de la mitad de los indivisos.
 */
const ASAMBLEA = { dia: "2026-01-25", convocada: "2026-01-09", consulta: "2026-01-12", primera: "10:00", segunda: "10:30", cierre: "13:40" };

/** El orden del día: el mismo en la convocatoria y en el acta. */
const ORDEN_DE_LA_ASAMBLEA = [
  "Lista de asistencia y quórum.",
  "Informe de la administración y cuentas de 2025.",
  "Presupuesto de 2026 y cuota de mantenimiento.",
  "Reglamento interno 2026.",
  "Portal de administración en línea.",
  "Ratificación de la empresa administradora.",
  "Elección del consejo de administración 2026–2027.",
  "Asuntos generales.",
];

const pesos = (n) => `$${n.toLocaleString("es-MX")}`;
const porciento = (n) => n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Quién vino: el condómino de cada casa —su propietario, que en una casa rentada no es quien vive
 * ahí—, en persona, con carta poder o ausente. Al azar pero estable, y el consejo, presente.
 */
function asistenciaDeLaAsamblea(padron) {
  const personas = new Map(padron.personas.map((p) => [p.id, p]));
  const delConsejo = new Set(padron.cuentas.filter((c) => c.consejo).map((c) => c.casaId));
  const estado = new Map([...delConsejo].map((id) => [id, "Presente"]));
  azar("asamblea-2026:asistencia")
    .barajar(padron.casas.filter((c) => !delConsejo.has(c.id)))
    .forEach((c, i) => estado.set(c.id, i < 29 ? "Presente" : i < 35 ? "Con carta poder" : "Ausente"));
  const filas = padron.casas.map((casa) => {
    const dueno = personas.get(casa.ownerIds[0]);
    if (!dueno) throw new Error(`La casa ${casa.displayName} no tiene propietario en el padrón.`);
    return { casa, condomino: dueno.fullName, asistencia: estado.get(casa.id) };
  });
  const presentes = filas.filter((f) => f.asistencia !== "Ausente");
  const quorum = presentes.reduce((s, f) => s + f.casa.coefficient, 0);
  if (quorum <= 50) throw new Error(`La asamblea no tendría quórum en primera convocatoria: ${porciento(quorum)} % de los indivisos.`);
  return { filas, presentes, quorum };
}

/** Cómo votó la asamblea un punto: por indiviso, sobre lo presente y representado. Estable por punto. */
function votacion(presentes, punto, contra = 0, abstencion = 0) {
  if (!contra && !abstencion) return "Se aprueba por unanimidad de los indivisos presentes y representados.";
  const orden = azar(`asamblea-2026:voto:${punto}`).barajar(presentes);
  const total = presentes.reduce((s, f) => s + f.casa.coefficient, 0);
  const pct = (lista) => porciento((lista.reduce((s, f) => s + f.casa.coefficient, 0) / total) * 100);
  const partes = [`Votan a favor casas que suman el ${pct(orden.slice(contra + abstencion))} % de los indivisos presentes y representados`];
  if (contra) partes.push(`en contra, el ${pct(orden.slice(0, contra))} %`);
  if (abstencion) partes.push(`se abstienen, el ${pct(orden.slice(contra, contra + abstencion))} %`);
  return `${partes.join("; ")}. Se aprueba por mayoría.`;
}

/** El presupuesto 2026 como tabla, con los nombres de cuenta del plan del producto. */
function presupuestoEnTabla() {
  const lineas = PRESUPUESTO_2026.map(({ accountCode, amount }) => {
    const cuenta = cuentaPorCodigo(accountCode);
    if (!cuenta) throw new Error(`El presupuesto trae la cuenta ${accountCode}, que no está en el plan de cuentas.`);
    return { ...cuenta, amount };
  });
  const de = (tipo) => lineas.filter((l) => l.type === tipo);
  const suma = (tipo) => de(tipo).reduce((s, l) => s + l.amount, 0);
  return {
    filas: [
      ...de("ingreso").map((l) => [l.code, l.name, pesos(l.amount)]),
      ["", "Total de ingresos", pesos(suma("ingreso"))],
      ...de("egreso").map((l) => [l.code, l.name, pesos(l.amount)]),
      ["", "Total de egresos", pesos(suma("egreso"))],
    ],
    ingresos: suma("ingreso"),
    egresos: suma("egreso"),
  };
}

/** El acta completa de la asamblea ordinaria (A3): asistencia por indiviso, quórum, acuerdos votados y firmas. */
export function actaDeAsamblea(padron) {
  const consejo = consejoDe(padron);
  const { filas, presentes, quorum } = asistenciaDeLaAsamblea(padron);
  const cuantas = (que) => filas.filter((f) => f.asistencia === que).length;
  const presupuesto = presupuestoEnTabla();
  const cuotas = PRESUPUESTO_2026.find((l) => l.accountCode === "1.1")?.amount;
  if (cuotas !== CUOTA_MENSUAL_TOTAL * 12) throw new Error(`El presupuesto de cuotas (${cuotas}) no son doce cuotas de ${CUOTA_MENSUAL_TOTAL}.`);
  const extraordinaria = PRESUPUESTO_2026.find((l) => l.accountCode === "1.2")?.amount ?? 0;
  const acuerdo = (numero, texto, voto) => [{ tipo: "articulo", numero: `Acuerdo ${numero}.`, texto }, { tipo: "parrafo", texto: voto }];
  const cargoCorto = (c) => c.cargo.split(" ")[0].toLowerCase();

  const bloques = [
    { tipo: "parrafo", texto: `En el fraccionamiento ${NOMBRE}, en el salón de la casa club, siendo las ${ASAMBLEA.primera} horas del domingo ${fechaLarga(ASAMBLEA.dia)}, se reunió en primera convocatoria la asamblea ordinaria de condóminos, convocada por el consejo de administración el ${fechaLarga(ASAMBLEA.convocada)}.` },
    { tipo: "capitulo", texto: "Lista de asistencia y quórum" },
    { tipo: "parrafo", texto: `Asisten en persona los condóminos de ${cuantas("Presente")} casas y, con carta poder, los de ${cuantas("Con carta poder")}; entre todos suman el ${porciento(quorum)} % de los indivisos. Como pasan de la mitad, hay quórum en primera convocatoria. Preside el presidente del consejo y levanta el acta la secretaria.` },
    {
      tipo: "tabla", columnas: ["Casa", "Condómino", "Indiviso (%)", "Asistencia"], anchos: [1.3, 3, 1.3, 1.6], alinear: ["left", "left", "right", "left"],
      filas: filas.map((f) => [f.casa.displayName, f.condomino, f.casa.coefficient.toFixed(4), f.asistencia]),
    },
    { tipo: "capitulo", texto: "Orden del día" },
    { tipo: "lista", items: ORDEN_DE_LA_ASAMBLEA },
    { tipo: "capitulo", texto: "Desarrollo y acuerdos" },
    ...acuerdo(1, "La administración presenta el informe de ingresos y egresos de 2025 y el estado del fondo de reserva al cierre del año. Se aprueban las cuentas de 2025.", votacion(presentes, "cuentas-2025", 0, 2)),
    { tipo: "parrafo", texto: "La administración presenta el presupuesto de 2026 por cuenta contable:" },
    { tipo: "tabla", columnas: ["Cuenta", "Concepto", "Monto anual"], anchos: [0.8, 3, 1.4], alinear: ["left", "left", "right"], filas: presupuesto.filas },
    ...acuerdo(2, `Se aprueba el presupuesto de 2026. La cuota de mantenimiento suma ${pesos(CUOTA_MENSUAL_TOTAL)} al mes, se reparte entre las ${padron.casas.length} casas según su indiviso y vence el día 10 de cada mes. Se prevé una cuota extraordinaria de ${pesos(extraordinaria)} para impermeabilizar la casa club, que se cobrará por indiviso cuando el consejo contrate la obra. La diferencia entre ingresos (${pesos(presupuesto.ingresos)}) y egresos (${pesos(presupuesto.egresos)}) cubre la aportación mensual al fondo de reserva y un margen para imprevistos.`, votacion(presentes, "presupuesto-2026", 3, 1)),
    ...acuerdo(3, "Se aprueba el reglamento interno 2026, que entra en vigor hoy y deja sin efecto el anterior.", votacion(presentes, "reglamento-2026", 1, 2)),
    ...acuerdo(4, "Se aprueba adoptar el portal de Vivaru para los avisos, los pagos, las reservas y los PQRS del fraccionamiento. La administración lo pondrá en marcha a mediados del año.", votacion(presentes, "portal", 2, 1)),
    ...acuerdo(5, "Se ratifica a la empresa administradora del fraccionamiento para 2026.", votacion(presentes, "administradora")),
    ...acuerdo(6, `Se elige al consejo de administración para el periodo 2026–2027: ${consejo.map((c) => `${c.nombre} (${c.casa}), ${cargoCorto(c)}`).join(", y ")}.`, votacion(presentes, "consejo", 0, 2)),
    { tipo: "capitulo", texto: "Asuntos generales" },
    { tipo: "parrafo", texto: "Se pide a la administración fumigar las áreas comunes con regularidad durante la temporada de lluvias y avisar a la comunidad antes de cada servicio." },
    { tipo: "parrafo", texto: `No habiendo más asuntos que tratar, se cierra la asamblea a las ${ASAMBLEA.cierre} horas del mismo día. Firman el presidente y la secretaria del consejo de administración, que dan fe de la lista de asistencia.` },
    { tipo: "firmas", firmantes: consejo.map(({ nombre, cargo }) => ({ nombre, cargo })) },
  ];

  return {
    titulo: "Acta de la asamblea ordinaria de condóminos 2026",
    subtitulo: `${fechaLarga(ASAMBLEA.dia)} · ${NOMBRE}`,
    encabezado: `${NOMBRE} · Asamblea ordinaria · ${fechaLarga(ASAMBLEA.dia)}`,
    fecha: new Date(`${ASAMBLEA.dia}T12:00:00.000Z`),
    bloques,
  };
}

/** La convocatoria de la asamblea (A3): un documento NUEVO de categoría `asamblea`, que no dispara avisos. */
export function convocatoriaDeAsamblea(padron) {
  const consejo = consejoDe(padron);
  return {
    titulo: "Convocatoria a la asamblea ordinaria de condóminos 2026",
    subtitulo: `${NOMBRE} · ${fechaLarga(ASAMBLEA.convocada)}`,
    encabezado: `${NOMBRE} · Convocatoria a la asamblea ordinaria 2026`,
    fecha: new Date(`${ASAMBLEA.convocada}T12:00:00.000Z`),
    bloques: [
      { tipo: "parrafo", texto: `El consejo de administración convoca a los condóminos del fraccionamiento ${NOMBRE} a la asamblea ordinaria de 2026, que se celebrará el domingo ${fechaLarga(ASAMBLEA.dia)} en el salón de la casa club.` },
      {
        tipo: "lista", items: [
          `Primera convocatoria: ${ASAMBLEA.primera} horas, con condóminos que sumen más de la mitad de los indivisos.`,
          `Segunda convocatoria: ${ASAMBLEA.segunda} horas, con los condóminos presentes.`,
        ],
      },
      { tipo: "capitulo", texto: "Orden del día" },
      { tipo: "lista", items: ORDEN_DE_LA_ASAMBLEA },
      { tipo: "capitulo", texto: "Representación y consulta" },
      { tipo: "parrafo", texto: "Quien no pueda asistir puede hacerse representar con carta poder simple, firmada ante dos testigos, que se entrega a la administración antes de iniciar la asamblea." },
      { tipo: "parrafo", texto: `Los proyectos de presupuesto y de reglamento interno para 2026 se pueden consultar en la administración desde el lunes ${fechaLarga(ASAMBLEA.consulta)}.` },
      { tipo: "parrafo", texto: "Atentamente, el consejo de administración." },
      { tipo: "firmas", firmantes: consejo.map(({ nombre, cargo }) => ({ nombre, cargo })) },
    ],
  };
}

// ── A4 · Los adjuntos de los comunicados ─────────────────────────────────────────────────────────

/** La clave del evento de un comunicado del guion, por su título (`comunicado-NN`, `lomas-operacion.mjs`). */
function comunicadoDelGuion(titulo) {
  const i = COMUNICADOS.findIndex((c) => c.titulo === titulo);
  if (i < 0) throw new Error(`El guion no trae el comunicado «${titulo}».`);
  return { clave: `comunicado-${String(i + 1).padStart(2, "0")}`, comunicado: COMUNICADOS[i] };
}

const horarioDe = (a) => `${diasDeServicio(a.availableWeekdays)}, de ${a.operatingHoursStart} a ${a.operatingHoursEnd} horas, en turnos de ${duracion(a.slotDurationMinutes)}`;

/** Una circular de la administración en PDF: lo que dice el comunicado, con el detalle práctico. */
function circular(titulo, { parrafos, lista = [], cierre }) {
  const { clave, comunicado } = comunicadoDelGuion(titulo);
  return {
    clave, titulo, tipo: "pdf",
    contenido: {
      titulo: comunicado.titulo,
      subtitulo: `Circular de la administración · ${fechaLarga(comunicado.fecha)}`,
      encabezado: `${NOMBRE} · Circular`,
      fecha: new Date(`${comunicado.fecha}T12:00:00.000Z`),
      bloques: [
        ...parrafos.map((texto) => ({ tipo: "parrafo", texto })),
        ...(lista.length ? [{ tipo: "lista", items: lista }] : []),
        ...(cierre ? [{ tipo: "parrafo", texto: cierre }] : []),
        { tipo: "firmas", firmantes: [{ nombre: "La administración", cargo: `Fraccionamiento ${NOMBRE}` }] },
      ],
    },
  };
}

/** Un cartel en imagen (`cartel`, en `ilustraciones.mjs`) para un comunicado del guion. */
function cartelDe(titulo, { tema, lineas, texto }) {
  const { clave } = comunicadoDelGuion(titulo);
  return { clave, titulo, tipo: "cartel", cartel: { tema, titulo: texto, lineas, pie: `${NOMBRE} · La administración` } };
}

/**
 * Los adjuntos de los comunicados (A4): cinco circulares y tres carteles, para los comunicados donde
 * un archivo tiene sentido. Cada uno repite lo que dice su comunicado y no añade fechas ni cifras que
 * no estén sembradas; el horario de la alberca sale de su política. Los nombres de archivo ya vienen
 * como los deja `uploadCommunicationAttachment` (minúsculas, sin espacios).
 */
export function adjuntosDeComunicados() {
  const alberca = AREAS.find((a) => a.clave === "alberca");
  if (!alberca) throw new Error("El padrón no trae la alberca.");
  return [
    {
      archivo: "aviso-corte-de-agua-9-de-junio.pdf",
      ...circular("Corte de agua el martes 9 de junio", {
        parrafos: ["Por mantenimiento de la bomba del pozo, el martes 9 de junio de 2026 no habrá agua en el fraccionamiento de 9:00 a 14:00."],
        lista: [
          "Almacena la noche anterior el agua que vayas a necesitar.",
          "Cierra la llave de paso de tu casa mientras dure el corte.",
          "Al volver el servicio, abre primero una llave del jardín para sacar el aire de la tubería.",
        ],
        cierre: "Si al terminar notas baja presión, repórtalo en el portal como PQRS.",
      }),
    },
    {
      archivo: "aviso-fumigacion-15-de-junio.pdf",
      ...circular("Fumigación de áreas comunes", {
        parrafos: ["El lunes 15 de junio de 2026, de 8:00 a 12:00, Control de Plagas Xonaca fumigará los jardines, la casa club y los registros del fraccionamiento."],
        lista: [
          "Mantén a tus mascotas dentro de casa durante la fumigación.",
          "Cierra las puertas y ventanas que den al jardín.",
          "No uses las áreas fumigadas hasta dos horas después de terminar.",
        ],
      }),
    },
    {
      archivo: "reglas-alberca-verano-2026.pdf",
      ...circular("Vacaciones de verano: reglas de la alberca", {
        parrafos: ["Durante las vacaciones de verano la alberca recibe a más familias. Para que todos la disfruten, recordamos sus reglas:"],
        lista: [
          `Horario: ${horarioDe(alberca)}.`,
          "Los menores de 12 años entran acompañados de un adulto.",
          "El aforo es de 6 personas por turno.",
          "Se reserva desde el portal de Vivaru, y la reserva queda confirmada al hacerla.",
          "Regaderazo antes de entrar; no se permiten envases de vidrio en el andador.",
        ],
      }),
    },
    {
      archivo: "aviso-mantenimiento-alberca-agosto.pdf",
      ...circular("Mantenimiento de la alberca del 10 al 12 de agosto", {
        parrafos: ["La alberca estará cerrada del lunes 10 al miércoles 12 de agosto de 2026 por limpieza profunda y cambio de filtros. Reabre el jueves 13 a las 9:00."],
        lista: ["Vaciado parcial y cepillado del vaso.", "Cambio de la arena de los filtros.", "Balance químico del agua antes de reabrir."],
        cierre: "Gracias por tu comprensión.",
      }),
    },
    {
      archivo: "aviso-mantenimiento-cisterna.pdf",
      ...circular("Mantenimiento de la cisterna el 22 de septiembre", {
        parrafos: ["El martes 22 de septiembre de 2026 se dará mantenimiento a la cisterna del fraccionamiento. Ese día no habrá agua de 10:00 a 16:00."],
        lista: [
          "Almacena la noche anterior el agua que vayas a necesitar.",
          "La víspera te enviaremos un recordatorio en el portal.",
          "Al volver el servicio, deja correr el agua unos minutos antes de usarla para beber o cocinar.",
        ],
      }),
    },
    {
      archivo: "cartel-jornada-de-limpieza.jpg",
      ...cartelDe("Jornada de limpieza y reforestación", {
        tema: "limpieza", texto: ["Jornada de limpieza", "y reforestación"],
        lineas: ["Sábado 18 de julio · 8:00", "Punto de reunión: la palapa", "Habrá guantes, bolsas y agua para todos"],
      }),
    },
    {
      archivo: "cartel-simulacro-19-de-septiembre.jpg",
      ...cartelDe("Simulacro de sismo el 19 de septiembre", {
        tema: "simulacro", texto: ["Simulacro nacional", "de sismo"],
        lineas: ["Sábado 19 de septiembre", "Al sonar la alarma, sal a la calle", "Punto de reunión: frente a la caseta"],
      }),
    },
    {
      archivo: "cartel-noche-mexicana.jpg",
      ...cartelDe("Noche mexicana en la casa club", {
        tema: "fiesta", texto: ["Noche mexicana"],
        lineas: ["Martes 15 de septiembre · 20:00", "Casa club", "Trae un platillo para compartir", "Responde la encuesta en tu portal"],
      }),
    },
  ];
}

// ── A5 · El plano y la memoria de obra ───────────────────────────────────────────────────────────

function delGuion(clave) {
  const d = DOCUMENTOS.find((x) => x.clave === clave);
  if (!d) throw new Error(`El guion no trae el documento «${clave}».`);
  return d;
}

/** El plano general (A5): la ilustración del plano y la tabla de las secciones, sacada del padrón. */
export function planoGeneral(padron, imagen) {
  const guion = delGuion("plano-fraccionamiento");
  const filas = SECCIONES.map((s) => {
    const casas = padron.casas.filter((c) => c.tower === s);
    return [s, casas.length, casas.reduce((x, c) => x + c.areaSqm, 0), casas.reduce((x, c) => x + c.coefficient, 0)];
  });
  const total = filas.reduce((t, f) => ["Total", t[1] + f[1], t[2] + f[2], t[3] + f[3]], ["Total", 0, 0, 0]);
  if (total[1] !== padron.casas.length) throw new Error(`Las secciones suman ${total[1]} casas y el padrón trae ${padron.casas.length}.`);
  const fila = ([s, n, m2, indiviso]) => [s, String(n), Math.round(m2).toLocaleString("es-MX"), indiviso.toFixed(4)];
  return {
    titulo: `Plano general de ${NOMBRE}`,
    subtitulo: "Secciones, casas, áreas comunes y accesos",
    encabezado: `${NOMBRE} · Plano general`,
    fecha: new Date(`${guion.fecha}T12:00:00.000Z`),
    bloques: [
      { tipo: "parrafo", texto: `El fraccionamiento tiene ${padron.casas.length} casas en ${SECCIONES.length} secciones, cada una a los dos lados de su calle, que sale de la avenida principal. Las áreas comunes quedan del otro lado de la avenida. Se entra por el acceso principal, con la caseta y el estacionamiento de visitas, o por el acceso de servicio.` },
      { tipo: "imagen", buffer: imagen, alto: 330, clave: "plano-del-fraccionamiento", pie: "Plano ilustrativo, sin escala. Cada casa lleva su número dentro de su sección." },
      { tipo: "capitulo", texto: "Secciones" },
      {
        tipo: "tabla", columnas: ["Sección", "Casas", "Superficie de las casas (m²)", "Indiviso (%)"], anchos: [1.4, 0.8, 2, 1.2],
        alinear: ["left", "right", "right", "right"], filas: [...filas.map(fila), fila(total)],
      },
      { tipo: "capitulo", texto: "Áreas comunes" },
      { tipo: "lista", items: AREAS.map((a) => `${a.name}: ${horarioDe(a)}.`) },
    ],
  };
}

/**
 * La memoria de obra de la impermeabilización (A5). Los importes y las fechas de pago salen de los
 * egresos de la historia, y el contratista, del padrón de proveedores: nada que la pantalla de egresos
 * pueda contradecir.
 */
export function memoriaDeObra(eventos, { antes, despues }) {
  const guion = delGuion("memoria-impermeabilizacion");
  const pagos = ["anticipo", "finiquito"].map((etapa) => {
    const ev = eventos.find((e) => e.tipo === "egreso" && e.clave === `egreso-impermeabilizacion-${etapa}`);
    if (!ev?.datos?.pago) throw new Error(`La historia no trae pagado el ${etapa} de la impermeabilización.`);
    return ev.datos;
  });
  const contratista = PROVEEDORES.find((p) => p.clave === pagos[0].proveedor)?.legalName;
  if (!contratista) throw new Error(`El proveedor «${pagos[0].proveedor}» no está en el padrón.`);
  const sesion = ACUERDOS.find((a) => a.clave === "extraordinaria-impermeabilizacion")?.sesion;
  const total = pagos[0].monto + pagos[1].monto;
  return {
    titulo: "Memoria de obra: impermeabilización de la casa club",
    subtitulo: `${NOMBRE} · ${fechaLarga(guion.fecha)}`,
    encabezado: `${NOMBRE} · Memoria de obra`,
    fecha: new Date(`${guion.fecha}T12:00:00.000Z`),
    bloques: [
      // La razón social ya acaba en punto («S.A. de C.V.»): va al final, sin otro detrás.
      { tipo: "parrafo", texto: `Obra: impermeabilización de la azotea de la casa club. Monto: ${pesos(total)}, en dos pagos. Contratista: ${/\.$/.test(contratista) ? contratista : `${contratista}.`}` },
      { tipo: "capitulo", texto: "Trabajos realizados" },
      {
        tipo: "lista", items: [
          "Retiro del impermeabilizante anterior.",
          "Reparación de grietas y resanes.",
          "Aplicación de primario en toda la superficie.",
          "Dos capas de impermeabilizante elastomérico, con malla de refuerzo en las grietas.",
        ],
      },
      { tipo: "parrafo", texto: "El salón siguió en uso durante la obra: los trabajos fueron en la azotea." },
      { tipo: "capitulo", texto: "Pagos" },
      {
        tipo: "tabla", columnas: ["Pago", "Fecha", "Importe"], anchos: [2, 2, 1.2], alinear: ["left", "left", "right"],
        filas: [
          ["Anticipo del 50 %", fechaLarga(pagos[0].pago), pesos(pagos[0].monto)],
          ["Finiquito del 50 %", fechaLarga(pagos[1].pago), pesos(pagos[1].monto)],
          ["Total", "", pesos(total)],
        ],
      },
      { tipo: "parrafo", texto: `El costo se repartió entre las casas por indiviso, en las cuotas de julio y agosto, como ratificó el consejo el ${fechaLarga(sesion)}.` },
      { tipo: "capitulo", texto: "Garantía" },
      { tipo: "parrafo", texto: "Cinco años a partir de la entrega, contra filtraciones por defecto de los materiales o de su aplicación." },
      { tipo: "capitulo", texto: "Fotografías" },
      { tipo: "imagen", buffer: antes, alto: 230, clave: "obra-antes", pie: "Antes: impermeabilizante gastado, grietas y encharcamiento junto a la bajada de agua." },
      { tipo: "imagen", buffer: despues, alto: 230, clave: "obra-despues", pie: "Después: dos capas de impermeabilizante elastomérico." },
      { tipo: "firmas", firmantes: [{ nombre: contratista, cargo: "Contratista" }, { nombre: "La administración", cargo: `Recibe la obra · ${NOMBRE}` }] },
    ],
  };
}

// ── B2 · Las hojas de tarifas de los servicios ───────────────────────────────────────────────────

/**
 * Precios de referencia de cada servicio. Son del directorio del conjunto, no de Vivaru: nadie los
 * cobra por el portal, así que no cruzan con ningún dato sembrado. La hoja ya empieza por la
 * descripción del servicio: las notas dicen solo lo que ella no dice, y sin horas ni fechas que
 * chocarían con las reservas sembradas.
 */
const TARIFAS = {
  ingles: { lineas: [["Mensualidad (ocho clases)", "$600"], ["Inscripción, con el libro del curso", "$250"]], nota: "El libro se entrega en la primera clase." },
  reposteria: { lineas: [["Pastel para 10 personas", "$380"], ["Pastel para 20 personas", "$650"], ["Docena de galletas decoradas", "$180"], ["Gelatina de mosaico", "$150"]] },
  costura: { lineas: [["Dobladillo de pantalón", "$60"], ["Ajuste de cintura", "$90"], ["Cambio de cierre", "$80"], ["Cortina, por metro", "$120"]] },
  cerrajero: { lineas: [["Apertura de puerta", "$450"], ["Cambio de chapa (sin material)", "$350"], ["Duplicado de llave", "$40"]], nota: "Atiende también en fin de semana y en días festivos." },
  gas: { lineas: [["Revisión de fugas", "$350"], ["Cambio de regulador (sin material)", "$250"], ["Mantenimiento de calentador", "$550"]] },
  "jardineria-particular": { lineas: [["Corte de pasto, jardín de hasta 50 m²", "$300"], ["Poda, por árbol", "desde $400"], ["Presupuesto", "sin costo"]] },
};

/** La hoja de tarifas de un servicio (B2): su descripción, los precios y cómo contactarlo. */
export function hojaDeTarifas(servicio, contacto) {
  const tarifas = TARIFAS[servicio.clave];
  if (!tarifas) throw new Error(`No hay tarifas para el servicio «${servicio.clave}».`);
  const vecino = servicio.category === "resident_offer";
  return {
    titulo: servicio.title,
    subtitulo: `${servicio.providerName} · precios de referencia 2026`,
    encabezado: `${NOMBRE} · Directorio de servicios`,
    bloques: [
      { tipo: "parrafo", texto: servicio.description },
      { tipo: "tabla", columnas: ["Concepto", "Precio"], anchos: [3, 1.2], alinear: ["left", "right"], filas: tarifas.lineas },
      ...(tarifas.nota ? [{ tipo: "parrafo", texto: tarifas.nota }] : []),
      { tipo: "parrafo", texto: `Contacto: ${contacto.charAt(0).toLowerCase()}${contacto.slice(1)}.` },
      {
        tipo: "parrafo",
        texto: vecino
          ? "Precios de referencia. El trato y el pago son directos con quien ofrece el servicio; la administración solo lo publica."
          : "Precios de referencia. La administración recomienda este servicio, pero el trato y el pago son directos con el proveedor.",
      },
    ],
  };
}

// ── C3 · Contratos de los prestadores y póliza ───────────────────────────────────────────────────

/** Lo que hace cada prestador con cuota fija, en palabras del contrato. Sin el QR: llegó en septiembre. */
const OBJETO_DEL_CONTRATO = {
  vigilancia: { servicio: "vigilancia", objeto: "Vigilancia del fraccionamiento las 24 horas, con dos elementos por turno en la caseta y rondines por las tres secciones y las áreas comunes. El prestador lleva la bitácora de entradas y salidas y entrega a la administración un reporte mensual de incidencias." },
  jardineria: { servicio: "jardinería", objeto: "Mantenimiento de jardines y camellones: corte de pasto cada dos semanas, poda de arbustos y árboles bajos, riego y retiro de la basura verde." },
  limpieza: { servicio: "limpieza", objeto: "Limpieza de las áreas comunes, la caseta y la casa club, de lunes a sábado, con los insumos a cargo del prestador." },
  alberca: { servicio: "mantenimiento de la alberca", objeto: "Mantenimiento de la alberca: limpieza del vaso, revisión de los filtros y del equipo de bombeo, y control químico del agua, con los productos a cargo del prestador." },
};

/**
 * Los contratos se firmaron después de la asamblea que aprobó el presupuesto, y su vigencia empieza en
 * febrero: así cubren los egresos de mayo, que la historia ya paga.
 */
const FIRMA_DE_CONTRATOS = "2026-01-30";

/**
 * El contrato de un prestador con cuota fija (C3). El precio, el día del recibo y el del pago salen de
 * `EGRESOS_RECURRENTES`, que es lo que pagan los egresos sembrados; el prestador, del padrón.
 */
export function contratoDeServicio(padron, clave) {
  const o = OBJETO_DEL_CONTRATO[clave];
  const g = EGRESOS_RECURRENTES.find((e) => e.clave === clave);
  const prestador = PROVEEDORES.find((p) => p.clave === g?.proveedor)?.legalName;
  if (!o || !g || !prestador || typeof g.monto !== "number") throw new Error(`No hay contrato de cuota fija para «${clave}».`);
  const [presidente] = consejoDe(padron);
  const clausulas = [
    ["Primera. Objeto.", o.objeto],
    ["Segunda. Vigencia.", "Del 1 de febrero de 2026 al 31 de enero de 2027. Se renueva por otro año si ninguna de las partes avisa lo contrario por escrito con 30 días de anticipación."],
    ["Tercera. Precio.", `${pesos(g.monto)} al mes. El prestador entrega su recibo el día ${g.emite} de cada mes y la asociación lo paga por transferencia el día ${g.paga}, o el siguiente día hábil.`],
    ["Cuarta. Personal.", "El personal es del prestador, que responde por sus salarios, su seguridad social y sus uniformes. No existe relación laboral entre ese personal y la asociación."],
    ["Quinta. Supervisión.", "La administración supervisa el servicio, recibe las quejas de los condóminos por el portal y las comunica al prestador."],
    ["Sexta. Daños.", "El prestador responde por los daños que su personal cause en las áreas comunes o en los bienes de los condóminos."],
    ["Séptima. Terminación.", "Cualquiera de las partes puede darlo por terminado con 30 días de aviso por escrito. La asociación puede terminarlo de inmediato si el servicio se deja de prestar."],
  ];
  return {
    titulo: `Contrato de prestación de servicios de ${o.servicio}`,
    subtitulo: `${NOMBRE} · firmado el ${fechaLarga(FIRMA_DE_CONTRATOS)}`,
    encabezado: `${NOMBRE} · Contrato de ${o.servicio}`,
    fecha: new Date(`${FIRMA_DE_CONTRATOS}T12:00:00.000Z`),
    bloques: [
      { tipo: "parrafo", texto: `Contrato que celebran la Asociación de Colonos ${NOMBRE} («la asociación»), representada por ${presidente.nombre}, presidente de su consejo de administración, y ${prestador} («el prestador»), conforme al presupuesto de 2026 que aprobó la asamblea el ${fechaLarga(ASAMBLEA.dia)}.` },
      { tipo: "capitulo", texto: "Cláusulas" },
      ...clausulas.map(([numero, texto]) => ({ tipo: "articulo", numero, texto })),
      { tipo: "firmas", firmantes: [{ nombre: presidente.nombre, cargo: "Por la asociación" }, { nombre: prestador, cargo: "Por el prestador" }] },
    ],
  };
}

/**
 * La póliza de responsabilidad civil y daños (C3). La prima y su fecha salen del egreso sembrado; la
 * vigencia, del guion. Las sumas aseguradas no cruzan con ningún dato: son de la carátula.
 */
export function polizaDeSeguro(padron, eventos) {
  const guion = delGuion("poliza-2026");
  const ev = eventos.find((e) => e.tipo === "egreso" && e.clave === "egreso-seguro-2026");
  if (!ev?.datos?.pago) throw new Error("La historia no trae pagada la póliza (`egreso-seguro-2026`).");
  const aseguradora = PROVEEDORES.find((p) => p.clave === ev.datos.proveedor)?.legalName;
  if (!aseguradora) throw new Error(`El proveedor «${ev.datos.proveedor}» no está en el padrón.`);
  const [presidente] = consejoDe(padron);
  return {
    titulo: "Póliza de responsabilidad civil y daños en áreas comunes",
    subtitulo: `${aseguradora} · vigencia 2026–2027`,
    encabezado: `${NOMBRE} · Póliza de seguro`,
    fecha: new Date(`${guion.fecha}T12:00:00.000Z`),
    bloques: [
      { tipo: "capitulo", texto: "Carátula" },
      {
        tipo: "tabla", columnas: ["Dato", "Valor"], anchos: [1.2, 3.4], filas: [
          ["Póliza", "RCA-2026-004817"],
          ["Asegurado", `Asociación de Colonos ${NOMBRE}`],
          ["Ubicación", `Fraccionamiento ${NOMBRE}, Puebla, Pue.: calles, áreas comunes, casa club, alberca y caseta`],
          ["Vigencia", "Del 12 de junio de 2026 al 12 de junio de 2027, a las 12:00 horas"],
          ["Prima anual", `${pesos(ev.datos.monto)}, pagada el ${fechaLarga(ev.datos.pago)}`],
        ],
      },
      { tipo: "capitulo", texto: "Coberturas" },
      {
        tipo: "tabla", columnas: ["Cobertura", "Suma asegurada", "Deducible"], anchos: [2.6, 1.3, 1.5], alinear: ["left", "right", "left"], filas: [
          ["Responsabilidad civil general: daños a terceros en las áreas comunes", "$3,000,000", "10 % de la pérdida"],
          ["Daños materiales en áreas comunes: incendio, sismo y fenómenos hidrometeorológicos", "$8,000,000", "2 % del valor"],
          ["Rotura de maquinaria: bombas del pozo y equipo de la alberca", "$250,000", "$5,000"],
          ["Responsabilidad civil por el uso de la alberca", "Incluida", "10 % de la pérdida"],
        ],
      },
      { tipo: "capitulo", texto: "Exclusiones principales" },
      {
        tipo: "lista", items: [
          "Los daños dentro de las casas y los bienes de cada condómino, que se aseguran por separado.",
          "El desgaste normal y la falta de mantenimiento.",
          "Los daños que cause un vehículo en circulación dentro del fraccionamiento.",
        ],
      },
      { tipo: "capitulo", texto: "Aviso de siniestro" },
      { tipo: "parrafo", texto: "La administración avisa a la aseguradora dentro de los cinco días hábiles siguientes al siniestro y conserva las fotografías y los reportes de caseta que lo documenten." },
      { tipo: "firmas", firmantes: [{ nombre: aseguradora, cargo: "La aseguradora" }, { nombre: presidente.nombre, cargo: "Por el asegurado" }] },
    ],
  };
}

// ── C1 · Relaciones mensuales de movimientos bancarios ───────────────────────────────────────────

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const conCentavos = (n) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const aCentavos = (n) => Math.round(n * 100) / 100;
export const mesLargo = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

/**
 * La relación mensual de movimientos de una cuenta (C1), elaborada por la administración con las
 * líneas del extracto importadas. No imita el estado de cuenta de ningún banco: sin su nombre ni su
 * imagen, solo la cuenta y su terminación. Los saldos salen de las mismas líneas que concilia el
 * producto, así que cuadran con la conciliación por construcción; y si no cuadran, falla.
 */
export function relacionDeMovimientos({ cuenta, mes, saldoInicial, lineas, elaborada, sinIdentificar }) {
  const ajenas = lineas.filter((l) => l.date.slice(0, 7) !== mes);
  if (ajenas.length) throw new Error(`La relación de ${mes} trae ${ajenas.length} líneas de otro mes.`);
  let saldo = aCentavos(saldoInicial);
  const filas = lineas.map((l) => {
    saldo = aCentavos(saldo + l.amount);
    const dia = `${Number(l.date.slice(8, 10))} ${MESES_CORTOS[Number(l.date.slice(5, 7)) - 1]}`;
    return [dia, l.description, l.amount < 0 ? conCentavos(-l.amount) : "", l.amount > 0 ? conCentavos(l.amount) : "", conCentavos(saldo)];
  });
  const abonos = lineas.filter((l) => l.amount > 0);
  const cargos = lineas.filter((l) => l.amount < 0);
  const totalAbonos = aCentavos(abonos.reduce((s, l) => s + l.amount, 0));
  const totalCargos = aCentavos(cargos.reduce((s, l) => s - l.amount, 0));
  const saldoFinal = aCentavos(saldoInicial + totalAbonos - totalCargos);
  if (Math.abs(saldoFinal - saldo) > 0.005) throw new Error(`La relación de ${mes} no cuadra: ${saldoFinal} por totales y ${saldo} línea a línea.`);
  const cuentaCorta = `${cuenta.label} ····${cuenta.accountNumber.slice(-4)}`;
  return {
    titulo: "Relación de movimientos bancarios",
    subtitulo: `${cuentaCorta} · ${mesLargo(mes)}`,
    encabezado: `${NOMBRE} · ${cuentaCorta} · ${mesLargo(mes)}`,
    fecha: new Date(`${elaborada}T12:00:00.000Z`),
    bloques: [
      { tipo: "parrafo", texto: "Relación que elabora la administración con las líneas del extracto importadas en Vivaru. No sustituye al estado de cuenta del banco, que es el documento oficial de la cuenta." },
      {
        tipo: "tabla", columnas: ["Resumen del mes", "Importe"], anchos: [3, 1.4], alinear: ["left", "right"], filas: [
          ["Saldo al inicio del mes", conCentavos(saldoInicial)],
          [`Abonos (${abonos.length})`, conCentavos(totalAbonos)],
          [`Cargos (${cargos.length})`, conCentavos(totalCargos)],
          ["Saldo al cierre del mes", conCentavos(saldoFinal)],
        ],
      },
      ...(sinIdentificar
        ? [{ tipo: "parrafo", texto: `El depósito del ${fechaLarga(sinIdentificar.date)} por ${conCentavos(sinIdentificar.amount)} («${sinIdentificar.description}») no trae referencia: la administración lo está identificando.` }]
        : []),
      { tipo: "capitulo", texto: "Movimientos" },
      { tipo: "tabla", columnas: ["Fecha", "Concepto", "Cargo", "Abono", "Saldo"], anchos: [0.7, 3.5, 1.1, 1.1, 1.2], alinear: ["left", "left", "right", "right", "right"], filas },
      { tipo: "parrafo", texto: `Elaborada por la administración el ${fechaLarga(elaborada)}.` },
    ],
  };
}

// ── C2 · El archivo mensual del cron, rellenado hacia atrás ──────────────────────────────────────

const milis = (x) => (typeof x?.toMillis === "function" ? x.toMillis() : x instanceof Date ? x.getTime() : 0);

/**
 * La cartera como estaba en `corte` (C2): los cargos ya creados, con lo pagado y lo cruzado con
 * anticipos ANTES de ese día, y su saldo y estado según `calcularSaldo` del producto. Un pago revertido
 * deja de contar desde el día de su reversión (el asiento de reversión apunta al revertido por
 * `reversedByEntryId`). El cron corre a las 06:00 UTC: «antes» es el día UTC del corte, y lo creado
 * después de ese instante no existía todavía.
 */
export function carteraAl(corte, { cargos, asientos, aplicaciones }) {
  const dia = corte.toISOString().slice(0, 10);
  const hasta = corte.getTime();
  const antes = (x) => milis(x.createdAt) <= hasta && (x.date ?? "") < dia;
  const reversiones = new Map(asientos.filter((a) => a.sourceType === "reversal").map((a) => [a.id, a]));
  const vigente = (a) => !a.reversedByEntryId || !antes(reversiones.get(a.reversedByEntryId) ?? { createdAt: 0, date: "" });
  const pagado = new Map();
  for (const a of asientos) {
    if (a.sourceType !== "billingStatement" || !antes(a) || !vigente(a)) continue;
    pagado.set(a.sourceId, (pagado.get(a.sourceId) ?? 0) + (a.type === "ingreso" ? a.amount : -a.amount));
  }
  const cruzado = new Map();
  for (const x of aplicaciones) if (antes(x)) cruzado.set(x.statementId, (cruzado.get(x.statementId) ?? 0) + x.amount);
  return cargos
    .filter((c) => milis(c.createdAt) <= hasta)
    .map((c) => {
      if (c.status === "cancelled") return c;
      const paymentAmount = libPagos.aMoneda(pagado.get(c.id) ?? 0);
      const advanceAppliedAmount = libPagos.aMoneda(cruzado.get(c.id) ?? 0);
      const { balance, status } = libPagos.calcularSaldo(c.amount ?? 0, paymentAmount, advanceAppliedAmount, c.dueDate, dia);
      return { ...c, paymentAmount, advanceAppliedAmount, balance, status };
    });
}

/**
 * Los egresos como estaban en `corte`: los ya registrados, pagados solo si su pago (o el de cada cuota)
 * es anterior a ese día. Es lo que lee `sumarDeudaAProveedores`: el estado y las cuotas pendientes.
 */
export function egresosAl(corte, egresos) {
  const dia = corte.toISOString().slice(0, 10);
  const hasta = corte.getTime();
  return egresos
    .filter((e) => milis(e.createdAt) <= hasta)
    .map((e) => {
      if (e.status === "anulado") return e;
      if (e.installments?.length) {
        const installments = e.installments.map((q) => (q.status === "pagada" && !(q.paidAt && q.paidAt < dia) ? { ...q, status: "pendiente" } : q));
        const paidAmount = installments.filter((q) => q.status === "pagada").reduce((s, q) => s + (q.amount ?? 0), 0);
        return { ...e, installments, paidAmount, status: installments.some((q) => q.status === "pendiente") ? "registrado" : "pagado" };
      }
      return { ...e, status: e.paidAt && e.paidAt < dia ? "pagado" : "registrado" };
    });
}

/** El formato de dinero de `monthlyFinancialArchive` (`formatMoney`, `es-CO`): «$598.400». Es la H.40 del contrato de la semilla. */
const formatoDelCron = (v) => `$${Math.round(v).toLocaleString("es-CO")}`;

/**
 * Lo que `monthlyFinancialArchive` (`functions/src/index.ts`) habría archivado en `corte`, línea por
 * línea: el histórico de cartera (recaudo por período y morosos) y el reporte de comité del mes
 * anterior, con `construirEstadoFinanciero` y las sumas del producto. `null` si al corte no había
 * cargos, que es cuando el cron se salta el conjunto.
 */
export function archivoMensualAl(corte, { cargos, asientos, aplicaciones, egresos, saldos, informeAnclado }) {
  const stamp = corte.toISOString().slice(0, 10);
  const prevMonth = mesMas(stamp.slice(0, 7), -1);
  const stmts = carteraAl(corte, { cargos, asientos, aplicaciones });
  if (!stmts.length) return null;
  const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "0%");

  const byPeriod = new Map();
  for (const s of stmts) {
    const k = s.period ?? "";
    if (!k) continue;
    const e = byPeriod.get(k) ?? { f: 0, r: 0, l: 0, p: 0 };
    e.f += libPagos.montoFacturadoDelCargo(s);
    e.r += Math.max(s.paymentAmount ?? 0, 0);
    e.l += libPagos.montoLiquidadoDelCargo(s);
    e.p += s.balance ?? 0;
    byPeriod.set(k, e);
  }
  const periodRows = [...byPeriod.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, v]) => [k, v.f, v.r, v.l, pct(v.l, v.f), v.p]);
  const byUnit = new Map();
  for (const s of stmts) {
    if ((s.balance ?? 0) <= 0) continue;
    const id = s.unitId ?? "";
    const e = byUnit.get(id) ?? { label: s.unitLabel ?? id, deuda: 0, periodos: new Set() };
    e.deuda += s.balance ?? 0;
    if (s.period) e.periodos.add(s.period);
    byUnit.set(id, e);
  }
  const morososRows = [...byUnit.values()].sort((a, b) => b.deuda - a.deuda).map((m) => [m.label, m.deuda, m.periodos.size]);

  const bsMonth = stmts.filter((s) => s.period === prevMonth);
  const facturado = bsMonth.reduce((a, s) => a + libPagos.montoFacturadoDelCargo(s), 0);
  const recaudado = bsMonth.reduce((a, s) => a + Math.max(s.paymentAmount ?? 0, 0), 0);
  const liquidado = bsMonth.reduce((a, s) => a + libPagos.montoLiquidadoDelCargo(s), 0);
  const billedAll = stmts.reduce((a, s) => a + libPagos.montoFacturadoDelCargo(s), 0);
  const overdueAmt = stmts.filter((s) => s.status === "overdue").reduce((a, s) => a + (s.balance ?? 0), 0);
  const monthLed = asientos.filter((e) => milis(e.createdAt) <= corte.getTime() && (e.date ?? "").slice(0, 7) === prevMonth);
  let saldoInicial;
  let porCobrar = 0;
  let deudaProveedores = 0;
  if (informeAnclado) {
    saldoInicial = informeMensual.sumarSaldoDeApertura(saldos);
    porCobrar = nucleo.sumarCuentasPorCobrar(stmts);
    deudaProveedores = nucleo.sumarDeudaAProveedores(egresosAl(corte, egresos));
  }
  const estado = nucleo.construirEstadoFinanciero({ asientos: monthLed, cuota: recaudado, openingBalance: saldoInicial, pendingReceivables: porCobrar, supplierDebt: deudaProveedores });
  const ingresos = estado.totalIncome;
  const egresosDelMes = estado.totalExpenses;
  const saldoDeApertura = estado.openingBalanceSource === "registrado" ? estado.openingBalance ?? 0 : null;

  return {
    historico: {
      stamp,
      fileName: `Historico-cartera-${stamp}.xlsx`,
      sheets: [
        { name: "Recaudo por período", rows: [["Período", "Facturado (esperado)", "Recaudado", "Liquidado", "% recaudo", "Pendiente"], ...periodRows] },
        { name: "Morosos", rows: [["Unidad", "Deuda total", "# períodos"], ...morososRows] },
      ],
      description: `Histórico de cartera al ${stamp} (automático)`,
    },
    comite: {
      mes: prevMonth,
      fileNameXlsx: `Reporte-Comite-${prevMonth}.xlsx`,
      fileNamePdf: `Reporte-Comite-${prevMonth}.pdf`,
      sheets: [{
        name: "Resumen", rows: [
          ["Reporte de comité — Resumen mensual (automático)", prevMonth],
          [],
          ["Facturado del mes", facturado],
          ["Recaudado del mes", recaudado],
          ["Liquidado del mes", liquidado],
          ["% de recaudo", pct(liquidado, facturado)],
          ["Índice de morosidad (monto, acum.)", pct(overdueAmt, billedAll)],
          ["Ingresos del mes", ingresos],
          ["Egresos del mes", egresosDelMes],
          ["Resultado neto del mes", ingresos - egresosDelMes],
          ...(informeAnclado
            ? [[], ["Saldo inicial del banco", saldoDeApertura ?? "Sin saldo bancario de apertura"], ["Saldo final del fondo", estado.fundBalance], ["Cuentas pendientes de cobro", estado.pendingReceivables], ["Deuda a proveedores", estado.supplierDebt]]
            : []),
        ],
      }],
      titulo: "Reporte de comité — Resumen mensual",
      subtitulo: `${prevMonth} · generado automáticamente`,
      filasPdf: [
        ["Facturado del mes", formatoDelCron(facturado)],
        ["Recaudado del mes", formatoDelCron(recaudado)],
        ["Liquidado del mes", formatoDelCron(liquidado)],
        ["% de recaudo", pct(liquidado, facturado)],
        ["Índice de morosidad (monto, acum.)", pct(overdueAmt, billedAll)],
        ["Ingresos del mes", formatoDelCron(ingresos)],
        ["Egresos del mes", formatoDelCron(egresosDelMes)],
        ["Resultado neto del mes", formatoDelCron(ingresos - egresosDelMes)],
        ...(informeAnclado
          ? [
              ["Saldo inicial del banco", saldoDeApertura === null ? "Sin saldo bancario de apertura" : formatoDelCron(saldoDeApertura)],
              ["Saldo final del fondo", formatoDelCron(estado.fundBalance)],
              ["Cuentas pendientes de cobro", formatoDelCron(estado.pendingReceivables)],
              ["Deuda a proveedores", formatoDelCron(estado.supplierDebt)],
            ]
          : []),
      ],
      description: `Reporte de comité ${prevMonth} (automático, resumen financiero)`,
    },
  };
}