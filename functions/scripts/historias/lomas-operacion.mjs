// La operación de «Lomas de Sayilbedra»: comunicados, encuestas, acuerdos, documentos, servicios,
// soporte, reservas, visitas, paquetes y PQRS (plan §4.3 y §5). Puro, como el resto del guion.
//
// Todo nombre es ficticio y ningún campo lleva un dato que pueda ser de alguien: ni placas, ni
// documentos de identidad, ni teléfonos. Las fechas son días locales de Puebla.
//
// Va en su propio fichero para no alargar más el guion. Recibe de él lo que necesita (el padrón,
// el primer día y las casas demo) en vez de importarlo: el guion lo importa a él.

import { azar } from "./azar.mjs";
import { dias, diaDeSemana, esHabil, sumarDias, sumarHabiles } from "./reloj.mjs";

const NOMBRES = ["Andrea", "Luis", "Sofía", "Carlos", "Valentina", "Jorge", "Camila", "Pablo", "Renata", "Tomás", "Lorena", "Hugo", "Paula", "Rubén", "Natalia", "Óscar", "Julia", "Martín", "Elisa", "Gabriel"];
const APELLIDOS = ["Ibarra", "Lozano", "Pineda", "Quiroz", "Serrano", "Villa", "Zúñiga", "Aranda", "Beltrán", "Cortés", "Del Río", "Escobar", "Fuentes", "Galindo", "Ledesma", "Montes", "Nava", "Ocampo", "Pacheco", "Robles"];
const MOTIVOS_DE_VISITA = ["Visita familiar", "Comida con amigos", "Técnico de internet", "Entrega de muebles", "Clase particular", "Reunión de trabajo", "Cumpleaños", "Servicio de limpieza"];
const PAQUETES = ["Caja mediana", "Sobre", "Caja chica", "Paquete grande", "Bolsa de supermercado", "Caja de despensa", "Documentos certificados"];

export const COMUNICADOS = [
  { fecha: "2026-06-01", hora: "09:00", titulo: "Bienvenidos a Vivaru", texto: "Desde hoy, los avisos, pagos, reservas y PQRS del fraccionamiento se gestionan en Vivaru. Revisa tus datos en tu portal y activa las notificaciones." },
  { fecha: "2026-06-05", hora: "18:30", titulo: "Corte de agua el martes 9 de junio", texto: "Por mantenimiento de la bomba del pozo no habrá agua de 9:00 a 14:00. Te recomendamos almacenar lo necesario la noche anterior." },
  { fecha: "2026-06-12", hora: "10:00", titulo: "Fumigación de áreas comunes", texto: "El lunes 15 se fumigarán jardines, casa club y registros. Mantén a tus mascotas dentro de casa de 8:00 a 12:00." },
  { fecha: "2026-06-18", hora: "11:15", titulo: "Vota el horario de la alberca", texto: "Ya está abierta la encuesta sobre el horario de la alberca. Tu voto cuenta hasta el 30 de junio." },
  { fecha: "2026-07-01", hora: "09:30", titulo: "Vacaciones de verano: reglas de la alberca", texto: "Durante las vacaciones, los menores de 12 años deben ir acompañados y el aforo es de 6 personas por turno. Reserva desde tu portal." },
  { fecha: "2026-07-10", hora: "17:00", titulo: "Jornada de limpieza y reforestación", texto: "Sábado 18 de julio a las 8:00, punto de reunión en la palapa. Habrá guantes, bolsas y agua para todos." },
  { fecha: "2026-07-17", hora: "12:00", titulo: "Cuota extraordinaria para impermeabilizar la casa club", texto: "El consejo aprobó la impermeabilización de la casa club. El costo se reparte por indiviso en dos parcialidades, julio y agosto. El acta está en Documentos." },
  { fecha: "2026-07-22", hora: "19:00", titulo: "Recordatorio: cuota de mantenimiento", texto: "La cuota de mantenimiento vence el día 10 de cada mes. Puedes pagar por transferencia y subir tu comprobante desde tu portal." },
  { fecha: "2026-08-03", hora: "08:45", titulo: "Mantenimiento de la alberca del 10 al 12 de agosto", texto: "La alberca estará cerrada por limpieza profunda y cambio de filtros. Reabre el jueves 13 a las 9:00." },
  { fecha: "2026-08-14", hora: "10:30", titulo: "Simulacro de sismo el 19 de septiembre", texto: "Participaremos en el simulacro nacional. Al sonar la alarma, sal a la calle y dirígete al punto de reunión frente a la caseta." },
  { fecha: "2026-08-21", hora: "16:00", titulo: "Pipas de agua por el estiaje del pozo", texto: "Por la baja del nivel del pozo, esta semana complementamos con pipas. Te pedimos cuidar el consumo en las horas de la tarde." },
  { fecha: "2026-08-28", hora: "18:00", titulo: "Acceso de visitas con código QR", texto: "Desde septiembre, tus visitas entran con el código QR que generas en tu portal. La caseta lo escanea y te avisa al registrar su llegada." },
  { fecha: "2026-09-03", hora: "09:15", titulo: "Informe de agosto disponible", texto: "El informe económico de agosto ya está en Documentos. El consejo lo revisará en su sesión del 9 de septiembre." },
  { fecha: "2026-09-10", hora: "10:00", titulo: "Fiestas patrias: horario de la caseta", texto: "El 15 y el 16 de septiembre la caseta atenderá con doble turno. Registra a tus visitas con anticipación para agilizar el acceso.", inicio: "2026-09-10", fin: "2026-09-17" },
  { fecha: "2026-09-11", hora: "12:30", titulo: "Noche mexicana en la casa club", texto: "Te esperamos el martes 15 a las 20:00 en la casa club. Trae un platillo para compartir y responde la encuesta para saber cuántos seremos.", inicio: "2026-09-11", fin: "2026-09-16" },
  { fecha: "2026-09-12", hora: "11:00", titulo: "Mantenimiento de la cisterna el 22 de septiembre", texto: "Ese día no habrá agua de 10:00 a 16:00. Te enviaremos un recordatorio la víspera.", inicio: "2026-09-18", fin: "2026-09-22" },
];

export const ENCUESTAS = [
  {
    clave: "horario-alberca", fecha: "2026-06-18", cierre: "2026-06-30", titulo: "¿Qué horario prefieres para la alberca?",
    descripcion: "Queremos ajustar el horario de la alberca a lo que más convenga a la mayoría.",
    preguntas: [
      { type: "single_choice", text: "Horario de apertura entre semana", options: ["9:00 a 20:00", "10:00 a 21:00", "8:00 a 19:00"] },
      { type: "likert", text: "¿Qué tan satisfecho estás con la limpieza de la alberca?" },
    ],
    participacion: 0.7,
  },
  {
    clave: "camaras-accesos", fecha: "2026-07-20", cierre: "2026-08-05", titulo: "Cámaras de videovigilancia en los accesos",
    descripcion: "El consejo evalúa instalar cámaras en los dos accesos. Tu opinión nos ayuda a decidir.",
    preguntas: [
      { type: "single_choice", text: "¿Estás de acuerdo en instalar cámaras en los dos accesos?", options: ["Sí", "No", "Me da igual"] },
      { type: "multiple_choice", text: "¿Dónde más pondrías cámaras?", options: ["Casa club", "Palapa", "Estacionamiento de visitas", "Cancha de pádel"] },
      { type: "text", text: "Comentarios" },
    ],
    participacion: 0.65,
  },
  {
    clave: "posada", fecha: "2026-08-24", cierre: "2026-09-07", titulo: "Posada de fin de año",
    descripcion: "Ayúdanos a elegir la fecha de la posada del fraccionamiento.",
    preguntas: [
      { type: "single_choice", text: "¿Qué fecha prefieres?", options: ["Viernes 18 de diciembre", "Sábado 19 de diciembre", "Sábado 12 de diciembre"] },
      { type: "likert", text: "¿Te gustaría que hubiera piñatas para los niños?" },
    ],
    participacion: 0.55,
  },
  {
    clave: "noche-mexicana", fecha: "2026-09-08", cierre: "2026-09-20", titulo: "Noche mexicana del 15 de septiembre",
    descripcion: "Para organizar la cena y el mariachi, dinos si vienes y qué te gustaría.",
    preguntas: [
      { type: "single_choice", text: "¿Asistirás a la noche mexicana?", options: ["Sí, con mi familia", "Solo yo", "No podré ir"] },
      { type: "multiple_choice", text: "¿Qué te gustaría que hubiera?", options: ["Pozole", "Tostadas", "Mariachi", "Juegos de feria"] },
    ],
    participacion: 0.4,
  },
];

export const ACUERDOS = [
  {
    clave: "mantenimiento-bombas", sesion: "2026-06-18", enviado: "2026-06-19", modo: "informativo",
    titulo: "Contratación del mantenimiento preventivo de las bombas del pozo",
    detalle: "Se contrata a Bombas e Hidráulica San Andrés para el mantenimiento preventivo de las dos bombas del pozo, con una visita de revisión cada mes y un reporte escrito a la administración.",
  },
  {
    clave: "calendario-fumigaciones", sesion: "2026-06-18", enviado: "2026-06-19", modo: "informativo",
    titulo: "Calendario de fumigaciones bimestrales de áreas comunes",
    detalle: "Se fija la fumigación de las áreas comunes cada dos meses (junio, agosto, octubre y diciembre), con aviso a la comunidad una semana antes.",
  },
  {
    clave: "extraordinaria-impermeabilizacion", sesion: "2026-07-16", enviado: "2026-07-16", modo: "obligatoria", firmas: 0.82,
    titulo: "Aprobación de la cuota extraordinaria para impermeabilizar la casa club",
    detalle: "Se aprueba impermeabilizar la casa club por $96,000 en dos pagos al proveedor. El costo se reparte entre las 48 casas por indiviso, en las cuotas de julio y agosto.",
  },
  {
    clave: "alberca-lluvias", sesion: "2026-08-20", enviado: "2026-08-21", modo: "parcial", firmas: 0.45,
    titulo: "Uso de la alberca en temporada de lluvias",
    detalle: "En temporada de lluvias la alberca cierra con tormenta eléctrica y reabre cuando la caseta lo indique. Se pide respaldar la medida con la firma de cada casa.",
  },
  {
    clave: "camaras-accesos", sesion: "2026-09-09", enviado: "2026-09-10", modo: "obligatoria", firmas: 0.3, sinDemo: true,
    titulo: "Instalación de cámaras de videovigilancia en los dos accesos",
    detalle: "Se aprueba instalar cámaras en los dos accesos, con grabación de 30 días y consulta solo por acuerdo del consejo. El costo sale del fondo de reserva.",
  },
];

export const CARPETAS = [
  { clave: "asambleas", name: "Asambleas", description: "Actas y convocatorias de asambleas." },
  { clave: "contratos", name: "Contratos y pólizas", description: "Contratos de servicios y pólizas de seguro." },
  { clave: "planos", name: "Planos y memorias", description: "Planos del fraccionamiento y memorias de obra." },
];

export const DOCUMENTOS = [
  { clave: "acta-asamblea-2026", fecha: "2026-06-02", carpeta: "asambleas", categoria: "asamblea", archivo: "acta-asamblea-ordinaria-2026.pdf", descripcion: "Acta de la asamblea ordinaria del 25 de enero de 2026", parrafos: ["En el fraccionamiento Lomas de Sayilbedra, siendo las 10:00 del 25 de enero de 2026, se reunió la asamblea ordinaria de condóminos con quórum suficiente.", "Se aprobó el presupuesto de ingresos y egresos para 2026, la cuota de mantenimiento repartida por indiviso y la aportación mensual al fondo de reserva.", "Se ratificó a la empresa administradora y se eligió al consejo de administración para el periodo 2026–2027."] },
  { clave: "poliza-2026", fecha: "2026-06-12", carpeta: "contratos", categoria: "legal", archivo: "poliza-rc-areas-comunes-2026-2027.pdf", descripcion: "Póliza de responsabilidad civil y daños en áreas comunes 2026–2027", parrafos: ["Póliza anual de responsabilidad civil y daños materiales para las áreas comunes del fraccionamiento.", "Vigencia: del 12 de junio de 2026 al 12 de junio de 2027. Suma asegurada y deducibles según la carátula anexa."] },
  { clave: "contrato-vigilancia", fecha: "2026-06-03", carpeta: "contratos", categoria: "contrato", archivo: "contrato-vigilancia-2026.pdf", descripcion: "Contrato del servicio de vigilancia 24 h", parrafos: ["Contrato de prestación de servicios de vigilancia con caseta y rondines las 24 horas, dos elementos por turno.", "Incluye bitácora de accesos, control de visitas con código QR y reporte mensual de incidencias."] },
  { clave: "plano-fraccionamiento", fecha: "2026-06-04", carpeta: "planos", categoria: "plano", archivo: "plano-lomas-de-sayilbedra.pdf", descripcion: "Plano general del fraccionamiento: secciones, áreas comunes y accesos", parrafos: ["Plano general del fraccionamiento con sus tres secciones (Encinos, Fresnos y Jacarandas), la casa club, la alberca, la palapa, el gimnasio, la cancha de pádel y los dos accesos."] },
  { clave: "memoria-impermeabilizacion", fecha: "2026-08-10", carpeta: "planos", categoria: "memoria", archivo: "memoria-impermeabilizacion-casa-club.pdf", descripcion: "Memoria de obra: impermeabilización de la casa club", parrafos: ["Trabajos realizados: retiro del impermeabilizante anterior, reparación de grietas, primario y aplicación de dos capas de impermeabilizante elastomérico.", "Garantía: cinco años. Se anexan fotografías del antes y el después."] },
];

export const REGLAMENTO = {
  clave: "reglamento-2026", fecha: "2026-06-01", titulo: "Reglamento interno de Lomas de Sayilbedra (2026)", archivo: "reglamento-interno-2026.pdf",
  parrafos: [
    "Artículo 18. El volumen de música y reuniones en las casas no debe molestar a los vecinos después de las 23:00 horas.",
    "Artículo 24. Las mascotas transitan por las áreas comunes siempre con correa y acompañadas; sus desechos se recogen de inmediato.",
    "Artículo 31. No se estacionan vehículos frente a la casa club ni en las entradas de otras casas.",
    "Artículo 40. Las áreas comunes se reservan desde el portal de Vivaru y se entregan limpias al terminar.",
  ],
  firmas: 0.75,
};

export const SERVICIOS = [
  { clave: "ingles", category: "resident_offer", seccion: "Fresnos", title: "Clases de inglés para niños", serviceType: "Clases", providerName: "Vecina de Fresnos", description: "Clases de inglés en grupos pequeños, martes y jueves por la tarde, en la casa club." },
  { clave: "reposteria", category: "resident_offer", seccion: "Jacarandas", title: "Pasteles y postres por encargo", serviceType: "Alimentos", providerName: "Vecino de Jacarandas", description: "Pasteles para cumpleaños y postres por encargo con dos días de anticipación." },
  { clave: "costura", category: "resident_offer", seccion: "Encinos", title: "Arreglos de ropa y costura", serviceType: "Hogar", providerName: "Vecina de Encinos", description: "Arreglos de ropa, dobladillos y cortinas. Entrega en tres días." },
  { clave: "cerrajero", category: "third_party", title: "Cerrajería 24 horas", serviceType: "Mantenimiento", providerName: "Cerrajería de confianza", description: "Apertura de puertas, cambio de chapas y duplicado de llaves. Se registra en caseta." },
  { clave: "gas", category: "third_party", title: "Técnico de gas estacionario", serviceType: "Mantenimiento", providerName: "Técnico recomendado por la administración", description: "Revisión de fugas, cambio de reguladores y mantenimiento de calentadores." },
  { clave: "jardineria-particular", category: "third_party", title: "Jardinería para tu casa", serviceType: "Jardinería", providerName: "Cuadrilla de jardinería", description: "Poda, pasto y riego de jardines particulares, con presupuesto sin costo." },
];

export const PQRS = [
  { type: "complaint", subject: "Ruido excesivo en la casa de junto", message: "Desde hace dos fines de semana hay música a alto volumen después de las 23:00.", response: "Gracias por avisar. Hablamos con los vecinos y les recordamos el artículo 18 del reglamento. Si vuelve a pasar, repórtalo en caseta en el momento." },
  { type: "petition", subject: "Poda del árbol frente a mi casa", message: "Las ramas del fresno ya tocan los cables de luz frente a mi casa. ¿Pueden podarlo?", response: "Programamos la poda con jardinería para el jueves. Te avisamos un día antes." },
  { type: "claim", subject: "Luminaria fundida en el andador", message: "La luminaria del andador entre Encinos y Fresnos lleva una semana apagada; de noche está muy oscuro.", response: "Se cambió el foco y la fotocelda. Queda funcionando." },
  { type: "claim", subject: "Fuga de agua en el registro de la calle", message: "Sale agua del registro frente a mi casa desde ayer en la mañana.", response: "El fontanero reparó la válvula del registro. Revisamos la presión y quedó normal." },
  { type: "suggestion", subject: "Horario de la alberca los domingos", message: "Sugiero abrir la alberca desde las 8:00 los domingos, cuando hace menos calor.", response: "Lo llevamos al consejo; la encuesta de horario de alberca incluye esa opción." },
  { type: "petition", subject: "Alta de mi inquilino en el padrón", message: "Rento mi casa a partir del día 1. ¿Cómo doy de alta a mi inquilino?", response: "Envíanos el nombre completo del inquilino y lo damos de alta en el padrón; recibirá su invitación a Vivaru." },
  { type: "complaint", subject: "Perro suelto en la cancha", message: "Otra vez hay un perro sin correa en la cancha de pádel. Los niños se asustan.", response: "Identificamos al dueño y le recordamos el reglamento. Si reincide, se aplicará la multa." },
  { type: "claim", subject: "Dos cargos de agua en mi estado de cuenta", message: "Me aparecen dos cargos de consumo de agua y no sé por qué.", response: "Uno es del consumo de junio y otro del de julio. Te dejamos en tu estado de cuenta el detalle de las dos lecturas." },
  { type: "petition", subject: "Permiso para remodelación", message: "Quiero remodelar la cocina el próximo mes. ¿Qué horario y requisitos hay?", response: "Horario de obra: lunes a viernes de 8:00 a 18:00 y sábado hasta las 14:00. Registra a los trabajadores en caseta con 24 horas de anticipación." },
  { type: "complaint", subject: "Basura acumulada junto a la palapa", message: "Después del fin de semana quedó basura junto a la palapa y huele mal.", response: "Limpieza retiró la basura el lunes a primera hora. Reforzamos el recordatorio a quienes reservan la palapa." },
  { type: "other", subject: "¿Dónde consulto el reglamento?", message: "No encuentro el reglamento actualizado.", response: "Está en Documentos, en la carpeta de Reglamentos, y también puedes firmarlo desde tu portal." },
  { type: "claim", subject: "El portón vehicular no abre con el control", message: "El portón de entrada no responde a mi control desde anoche.", response: "Se reprogramó el receptor del portón. Si tu control sigue fallando, pasa a caseta para darlo de alta de nuevo." },
  { type: "petition", subject: "Más bancas en la zona de juegos", message: "Sería bueno poner dos bancas más cerca de los juegos infantiles.", response: "Lo incluimos en el presupuesto del próximo trimestre y lo presentaremos al consejo." },
  { type: "suggestion", subject: "Contenedores para reciclaje", message: "Propongo contenedores separados para PET y cartón junto a la caseta.", response: "Nos parece muy buena idea: cotizamos contenedores y lo comentaremos en la próxima sesión del consejo." },
];

const EN_CURSO = "Estamos coordinando con el proveedor; te avisamos en cuanto quede resuelto.";

const nombreFicticio = (r) => `${r.elegir(NOMBRES)} ${r.elegir(APELLIDOS)}`;
const conHora = (r, desde, hasta) => `${String(r.entero(desde, hasta)).padStart(2, "0")}:${r.elegir(["00", "10", "20", "30", "40", "50"])}`;

/** El día hábil que queda `n` días hábiles antes de `desde`. */
function habilesAtras(desde, n) {
  let dia = desde;
  for (let i = 0; i < n; i += 1) {
    dia = sumarDias(dia, -1);
    while (!esHabil(dia)) dia = sumarDias(dia, -1);
  }
  return dia;
}

function proximo(desde, diaSemana) {
  let dia = desde;
  while (diaDeSemana(dia) !== diaSemana) dia = sumarDias(dia, 1);
  return dia;
}

const sumarMinutos = (hora, minutos) => {
  const total = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** Las personas que viven en cada casa (sin el dueño que la renta y vive fuera). */
function personasPorCasa(padron) {
  const mapa = new Map();
  for (const p of padron.personas) {
    if (p.roleType === "investor") continue;
    if (!mapa.has(p.casaId)) mapa.set(p.casaId, []);
    mapa.get(p.casaId).push(p);
  }
  return mapa;
}

/**
 * Un día en la portería: cuatro visitas (una que ya se fue, dos que siguen dentro y una que llega
 * por la tarde a la casa al corriente de la demo) y tres paquetes por entregar, el primero para esa
 * misma casa. Lo usan el lote de «hoy» de la siembra y `--refrescar`. `efecto` es la hora del último
 * hecho del evento: el lote de hoy no siembra lo que todavía no ha pasado.
 */
export function eventosDelDia(dia, padron, { CASAS_DEMO }) {
  const r = azar(`dia:${dia}`);
  const residentes = padron.cuentas.filter((c) => c.role === "resident");
  const casaDemo = padron.casas.find((c) => c.clave === CASAS_DEMO.resCorriente);
  const deLaCasa = personasPorCasa(padron);
  const VISITAS = [
    { hora: "07:50", inicio: "08:30", estado: "completed", estancia: 90 },
    { hora: "08:20", inicio: "10:20", estado: "inside", estancia: 150 },
    { hora: "09:05", inicio: "11:00", estado: "inside", estancia: 120 },
    { hora: "09:30", inicio: "17:30", estado: "scheduled", estancia: 120, cuenta: `res-${CASAS_DEMO.resCorriente}` },
  ];
  const ev = VISITAS.map((v, i) => ({
    fecha: dia, hora: v.hora, tipo: "invitacion", clave: `invitacion-dia-${dia}-${i + 1}`,
    datos: {
      cuenta: v.cuenta ?? r.elegir(residentes).clave, fecha: dia, inicio: v.inicio, visitante: nombreFicticio(r), motivo: r.elegir(MOTIVOS_DE_VISITA),
      adultos: r.entero(1, 3), ninos: r.entero(0, 1), estancia: v.estancia, estado: v.estado, retraso: 10,
      efecto: v.estado === "completed" ? sumarMinutos(v.inicio, 10 + v.estancia) : v.estado === "inside" ? sumarMinutos(v.inicio, 10) : v.hora,
    },
  }));
  [["09:15", casaDemo], ["11:40", r.elegir(padron.casas)], ["13:05", r.elegir(padron.casas)]].forEach(([hora, casa], i) => {
    ev.push({
      fecha: dia, hora, tipo: "paquete", clave: `paquete-dia-${dia}-${i + 1}`,
      datos: { casa: casa.clave, destinatario: r.elegir(deLaCasa.get(casa.id)).id, recibe: null, descripcion: r.elegir(PAQUETES), entrega: null, horaEntrega: null, efecto: hora },
    });
  });
  return ev;
}

/**
 * Los eventos de operación. Solo lo creado ANTES de hoy; lo que se reservó antes de hoy para
 * después (reservas, una mudanza, un comunicado programado) sí entra, con la fecha en que se hizo.
 * Lo que nace hoy es el lote de «hoy» (T1.9).
 */
export function eventosDeOperacion(tenantId, hoy, padron, { INICIO, CASAS_DEMO }) {
  const ev = [];
  const push = (fecha, hora, tipo, clave, datos) => {
    if (fecha < hoy) ev.push({ fecha, hora, tipo, clave, datos });
  };
  const ayer = sumarDias(hoy, -1);
  const residentes = padron.cuentas.filter((c) => c.role === "resident");
  const casaDe = new Map(padron.casas.map((c) => [c.id, c]));
  const demo = { corriente: `res-${CASAS_DEMO.resCorriente}`, moroso: `res-${CASAS_DEMO.resMoroso}`, consejero: `res-${CASAS_DEMO.consejero}` };
  const demos = new Set(Object.values(demo));
  const noDemo = residentes.filter((c) => !demos.has(c.clave));
  // Quien reserva un área con bloqueo por adeudo no puede deber: el escritor lo comprueba con la
  // regla del producto; aquí solo se evita proponer a quien seguro no puede. Las cuentas demo
  // tienen sus reservas a mano, más abajo, para que el cupo del mes no se las quite.
  const alCorriente = noDemo.filter((c) => casaDe.get(c.casaId)?.cohorte !== "moroso");

  COMUNICADOS.forEach((c, i) => push(c.fecha, c.hora, "comunicado", `comunicado-${String(i + 1).padStart(2, "0")}`, c));
  for (const e of ENCUESTAS) push(e.fecha, "11:00", "encuesta", `encuesta-${e.clave}`, e);
  for (const a of ACUERDOS) push(a.enviado, "18:00", "acuerdo", `acuerdo-${a.clave}`, a);

  // Documentos: las carpetas, el reglamento (con sus firmas) y el resto.
  for (const c of CARPETAS) push(INICIO, "09:00", "carpeta", `carpeta-${c.clave}`, c);
  push(REGLAMENTO.fecha, "10:30", "reglamento", REGLAMENTO.clave, REGLAMENTO);
  for (const d of DOCUMENTOS) push(d.fecha, "12:15", "documento", `documento-${d.clave}`, d);

  // Servicios: los de vecinos, de una casa de su sección.
  SERVICIOS.forEach((s, i) => {
    const vecino = s.seccion ? azar(`servicio:${s.clave}`).elegir(noDemo.filter((c) => casaDe.get(c.casaId)?.tower === s.seccion)) : null;
    push(sumarDias("2026-06-08", i * 5), "13:00", "servicio", `servicio-${s.clave}`, { ...s, casaId: vecino?.casaId ?? null });
  });

  push("2026-07-09", "10:20", "soporte", "soporte-informe-mensual", {
    asunto: "¿Cómo emito el informe mensual del conjunto?",
    descripcion: "Quiero emitir el informe de junio para que lo firme el consejo, pero no encuentro el botón.",
    respuesta: "En Finanzas, Informes, abre el borrador de junio y pulsa «Emitir». Una vez emitido, el consejo lo ve y lo firma desde su portal.",
    respondido: "2026-07-09T17:40:00.000Z",
    resuelto: "2026-07-10T15:05:00.000Z",
  });

  // Reservas: por área y por día. El escritor las valida con las reglas del producto.
  const sabadoDemo = proximo(sumarDias(hoy, 3), 6);
  const PLAN_DE_RESERVAS = [
    { area: "alberca", dias: [0, 6], porDia: [1, 3], franjas: ["11:00 - 13:00", "13:00 - 15:00", "15:00 - 17:00"] },
    { area: "palapa", dias: [0, 6], porDia: [0, 1], franjas: ["12:00 - 17:00"] },
    { area: "casa-club", dias: [6], porDia: [0, 1], franjas: ["14:00 - 18:00", "18:00 - 22:00"] },
    { area: "gimnasio", dias: [1, 2, 3, 4, 5], porDia: [0, 1], franjas: ["07:00 - 08:00", "19:00 - 20:00", "20:00 - 21:00"] },
    { area: "padel", dias: [2, 4], porDia: [0, 1], franjas: ["19:00 - 20:30", "20:30 - 22:00"] },
  ];
  for (const dia of dias(INICIO, sumarDias(hoy, 14))) {
    for (const p of PLAN_DE_RESERVAS) {
      if (!p.dias.includes(diaDeSemana(dia))) continue;
      // Ese sábado la casa club es de la reserva pendiente del consejero demo.
      if (p.area === "casa-club" && dia === sabadoDemo) continue;
      const r = azar(`reserva:${p.area}:${dia}`);
      const n = r.entero(p.porDia[0], p.porDia[1]);
      for (let k = 0; k < n; k += 1) {
        const cuenta = r.elegir(alCorriente);
        const [inicio, fin] = r.elegir(p.franjas).split(" - ");
        const antes = sumarDias(dia, -(p.area === "casa-club" ? r.entero(4, 12) : r.entero(1, 5)));
        const cancelada = dia < hoy && r.probable(0.06);
        push(antes < hoy ? antes : ayer, conHora(r, 8, 21), "reserva", `reserva-${p.area}-${dia}-${k + 1}`, {
          area: p.area, cuenta: cuenta.clave, fecha: dia, inicio, fin, cancelada,
          motivoCancelacion: cancelada ? r.elegir(["Cambio de planes", "Se canceló el evento", "Mal clima"]) : null,
        });
      }
    }
  }
  // Las de las cuentas demo: una por venir en la alberca, la casa club pendiente de aprobar, y el
  // gimnasio del moroso (la única de sus áreas que no bloquea por adeudo).
  // `fija`: si la regla no la deja, no se pasa a otra casa.
  const reservaDemo = (fecha, hora, clave, datos) => push(fecha, hora, "reserva", `reserva-demo-${clave}`, { cancelada: false, motivoCancelacion: null, fija: true, ...datos });
  reservaDemo(sumarDias(hoy, -3), "20:10", "alberca", { area: "alberca", cuenta: demo.corriente, fecha: sabadoDemo, inicio: "11:00", fin: "13:00" });
  reservaDemo(ayer, "19:45", "casa-club", { area: "casa-club", cuenta: demo.consejero, fecha: sabadoDemo, inicio: "18:00", fin: "22:00" });
  reservaDemo("2026-08-26", "18:30", "gimnasio", { area: "gimnasio", cuenta: demo.moroso, fecha: "2026-08-27", inicio: "19:00", fin: "20:00" });
  // Las próximas del plan (§4.3): la noche mexicana del 15 en la casa club y la palapa del 16.
  reservaDemo("2026-09-08", "12:40", "noche-mexicana", { area: "casa-club", cuenta: demo.consejero, fecha: "2026-09-15", inicio: "19:00", fin: "23:00" });
  reservaDemo("2026-09-09", "20:05", "palapa-16", { area: "palapa", cuenta: demo.corriente, fecha: "2026-09-16", inicio: "12:00", fin: "17:00" });

  // Mudanzas: una hecha y una por venir, de casas que se rentan y tienen cuenta.
  const rentadasConCuenta = padron.casas.filter((c) => c.alquilada && residentes.some((r) => r.casaId === c.id));
  const mudanza = (casa, fecha, hecha, aprobada) => {
    if (!casa) return;
    const cuenta = residentes.find((c) => c.casaId === casa.id);
    push(hecha, "19:10", "mudanza", `mudanza-${casa.clave}-${fecha}`, { cuenta: cuenta.clave, fecha, inicio: "09:00", fin: "14:00", aprobada });
  };
  mudanza(rentadasConCuenta[0], "2026-07-11", "2026-07-06", true);
  mudanza(rentadasConCuenta[1], sumarDias(hoy, 13), ayer, false);

  // Visitas por invitación QR: todos los días, más los fines de semana.
  const invitacion = (dia, clave, cuenta, r) => {
    const creada = r.probable(0.5) && sumarDias(dia, -1) >= INICIO ? sumarDias(dia, -1) : dia;
    push(creada, creada === dia ? conHora(r, 7, 9) : conHora(r, 18, 22), "invitacion", clave, {
      cuenta, fecha: dia, inicio: conHora(r, 10, 19), visitante: nombreFicticio(r), motivo: r.elegir(MOTIVOS_DE_VISITA),
      adultos: r.entero(1, 4), ninos: r.entero(0, 2), estancia: r.entero(60, 240),
      // Algunas no llegaron: su pase se queda programado.
      estado: r.probable(0.06) ? "scheduled" : "completed",
    });
  };
  for (const dia of dias(INICIO, ayer)) {
    const r = azar(`visitas:${dia}`);
    const finDeSemana = [0, 6].includes(diaDeSemana(dia));
    const n = r.entero(finDeSemana ? 2 : 1, finDeSemana ? 5 : 3);
    for (let k = 0; k < n; k += 1) invitacion(dia, `invitacion-${dia}-${k + 1}`, r.elegir(residentes).clave, r);
  }
  for (const [nombre, clave] of Object.entries(demo)) {
    for (const atras of [9, 4]) invitacion(sumarDias(hoy, -atras), `invitacion-demo-${nombre}-${atras}`, clave, azar(`visitas-demo:${nombre}:${atras}`));
  }

  // Autorizaciones de larga duración que da la administración, desde el día siguiente: el
  // producto no deja crear una visita que empieza antes de 15 minutos.
  const AUTORIZACIONES = [["Empleada doméstica", "servicio"], ["Jardinero particular", "servicio"], ["Enfermera", "servicio"], ["Niñera", "servicio"], ["Maestro de piano", "otro"], ["Abuela de visita", "familiar"]];
  AUTORIZACIONES.forEach(([rol, categoria], i) => {
    const r = azar(`autorizacion:${i}`);
    const fecha = sumarDias("2026-06-03", i * 6);
    push(fecha, "10:00", "autorizacion", `autorizacion-${i + 1}`, {
      cuenta: residentes[(i * 5 + 3) % residentes.length].clave, visitante: `${nombreFicticio(r)} (${rol.toLowerCase()})`, categoria,
      desde: sumarDias(fecha, 1), hasta: "2026-12-31", inicio: "08:00", fin: "18:00",
    });
  });

  // Paquetes: llegan casi a diario y la portería los entrega en uno o dos días.
  const deLaCasa = personasPorCasa(padron);
  const paquete = (dia, clave, casa, r) => {
    const personas = deLaCasa.get(casa.id);
    const entrega = sumarDias(dia, r.entero(0, 2));
    push(dia, conHora(r, 9, 18), "paquete", clave, {
      casa: casa.clave, destinatario: r.elegir(personas).id, recibe: r.elegir(personas).id, descripcion: r.elegir(PAQUETES),
      entrega: entrega < hoy ? entrega : null, horaEntrega: conHora(r, 13, 21),
    });
  };
  for (const dia of dias(INICIO, ayer)) {
    const r = azar(`paquetes:${dia}`);
    const n = r.entero(esHabil(dia) ? 1 : 0, esHabil(dia) ? 3 : 1);
    for (let k = 0; k < n; k += 1) paquete(dia, `paquete-${dia}-${k + 1}`, r.elegir(padron.casas), r);
  }
  for (const [nombre, clave] of Object.entries(demo)) {
    const casa = casaDe.get(residentes.find((c) => c.clave === clave).casaId);
    for (const atras of [8, 3]) paquete(sumarDias(hoy, -atras), `paquete-demo-${nombre}-${atras}`, casa, azar(`paquetes-demo:${nombre}:${atras}`));
  }

  // PQRS: resueltos casi todos, unos en curso, y tres abiertos a hoy (vencido, por vencer y nuevo).
  const quienesEscriben = azar("pqrs:quienes").barajar(residentes);
  let n = 0;
  for (const dia of dias(INICIO, sumarDias(hoy, -22))) {
    if (!esHabil(dia) || !azar(`pqrs:${dia}`).probable(0.45)) continue;
    const r = azar(`pqrs:detalle:${dia}`);
    const plantilla = PQRS[n % PQRS.length];
    const cuenta = quienesEscriben[n % quienesEscriben.length];
    n += 1;
    // Unos reclamos de la primera semana de agosto se respondieron fuera del plazo de 15 días hábiles.
    const tardio = dia >= "2026-08-03" && dia <= "2026-08-07" && plantilla.type === "claim";
    const respondido = sumarHabiles(dia, tardio ? 17 : r.entero(1, 7));
    const enCurso = respondido >= sumarDias(hoy, -10) && r.probable(0.5);
    push(dia, conHora(r, 8, 16), "pqrs", `pqrs-${dia}`, {
      ...plantilla, cuenta: cuenta.clave,
      respondido: respondido < hoy ? respondido : null,
      estado: respondido < hoy ? (enCurso ? "in_progress" : r.elegir(["resolved", "closed", "responded"])) : "open",
      prioridad: plantilla.type === "claim" ? "high" : r.elegir(["low", "medium"]),
      respuesta: enCurso ? EN_CURSO : plantilla.response,
    });
  }
  const demoPqrs = [
    ["corriente", PQRS[1], 16, 2, "resolved"],
    ["moroso", PQRS[7], 12, 3, "responded"],
    ["consejero", PQRS[13], 7, 1, "in_progress"],
  ];
  for (const [nombre, plantilla, atras, tarda, estado] of demoPqrs) {
    const dia = habilesAtras(hoy, atras);
    push(dia, "09:40", "pqrs", `pqrs-demo-${nombre}`, {
      ...plantilla, cuenta: demo[nombre], respondido: sumarHabiles(dia, tarda), estado,
      prioridad: plantilla.type === "claim" ? "high" : "medium", respuesta: estado === "in_progress" ? EN_CURSO : plantilla.response,
    });
  }
  // SLA de 15 días hábiles: vencido con 19 hábiles encima, por vencer con 13 (le quedan dos).
  const escribenSinDemo = quienesEscriben.filter((c) => !demos.has(c.clave));
  [["vencido", habilesAtras(hoy, 19), PQRS[3]], ["por-vencer", habilesAtras(hoy, 13), PQRS[2]], ["nuevo", ayer, PQRS[11]]].forEach(([clave, dia, plantilla], i) => {
    push(dia, "10:15", "pqrs", `pqrs-abierto-${clave}`, {
      ...plantilla, cuenta: escribenSinDemo[(n + i * 3) % escribenSinDemo.length].clave, respondido: null, estado: "open", prioridad: "high", respuesta: null,
    });
  });

  // El lote de «hoy» (§4.3, septiembre): el día en la portería y un PQRS recién llegado. Lo siembra
  // la corrida después de las membresías, y solo lo que ya pasó a la hora de correr.
  ev.push(...eventosDelDia(hoy, padron, { CASAS_DEMO }));
  ev.push({
    fecha: hoy, hora: "08:40", tipo: "pqrs", clave: `pqrs-hoy-${hoy}`,
    datos: { ...PQRS[9], cuenta: escribenSinDemo[(n + 11) % escribenSinDemo.length].clave, respondido: null, estado: "open", prioridad: "medium", respuesta: null },
  });

  return ev;
}
