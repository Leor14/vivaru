import {
  Building2,
  CalendarCheck,
  ClipboardList,
  DoorOpen,
  FileText,
  Home,
  MessageSquare,
  Package,
  ScrollText,
  Shield,
  Smartphone,
  Store,
  UserPlus,
  Wallet,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type { TrialModuleKey } from "@/lib/config/trial-modules";
import type { IconToneName } from "@/lib/ui/icon-tones";

/**
 * El recorrido guiado del administrador que acaba de entrar a su ambiente.
 *
 * Un checklist a secas es un marcador, no una guía: marca casillas pero deja al
 * usuario preguntándose *dónde* se hace y *cómo*. Por eso cada paso lleva tres
 * cosas juntas — **a dónde ir** (`route`), **qué hacer ahí** (`purpose` / `how`,
 * que se muestran al llegar) y **cómo se sabe que quedó hecho** (`signal`).
 *
 * Tres bloques con pesos distintos, a propósito:
 *
 * - `configura` + `prueba` = los **7 pasos de activación**. Miden puesta en
 *   marcha real y alimentan la columna "Activación" de la consola comercial.
 * - `descubre` = recorrido por el resto del producto. Se completan **viendo**,
 *   no creando: quince tareas obligatorias se leen como tarea escolar y se
 *   abandonan; el objetivo aquí es que sepa que el módulo existe y para qué.
 *
 * El bloque `prueba` no son tres visitas sueltas: es **una sola historia**. El
 * admin registra una visita, la ve aparecer en la pantalla del portero y ve el
 * QR en el celular del residente. Ese es el momento en que entiende qué compró.
 */

export type OnboardingBlockKey = "configura" | "prueba" | "descubre";

export type OnboardingBlock = {
  key: OnboardingBlockKey;
  title: string;
  description: string;
};

export const ONBOARDING_BLOCKS: OnboardingBlock[] = [
  {
    key: "configura",
    title: "Pon a punto tu conjunto",
    description: "La estructura mínima para que todo lo demás tenga dónde apoyarse.",
  },
  {
    key: "prueba",
    title: "Pruébalo de punta a punta",
    description: "Una visita recorriendo los tres portales: administración, portería y residente.",
  },
  {
    key: "descubre",
    title: "Descubre qué más hace Vivaru",
    description: "Un vistazo a cada módulo. Basta con entrar y leer; crear algo es opcional.",
  },
];

/**
 * Cómo se detecta que un paso quedó hecho.
 *
 * - `agrupaciones` → la lista canónica en `tenantSettings.agrupaciones`.
 * - `docs`         → hay al menos un documento en la colección. `filterExamples`
 *                    descarta lo sembrado (`isExample: true`), sin lo cual el
 *                    checklist nacería completo y no serviría para nada.
 * - `guardUser`    → existe un usuario de portería que no es la cuenta de prueba.
 * - `seen`         → no deja rastro en datos (recorrer un portal, leer una
 *                    pantalla): se marca al llegar con la guía abierta.
 */
export type OnboardingSignal =
  | { kind: "agrupaciones" }
  | { kind: "docs"; collection: string; filterExamples?: boolean }
  | { kind: "guardUser" }
  | { kind: "seen" };

export type OnboardingStep = {
  key: string;
  block: OnboardingBlockKey;
  /** Etiqueta imperativa del checklist. */
  title: string;
  /** Una línea: por qué vale la pena hacerlo. */
  why: string;
  /** Ruta destino, sin el parámetro `?guia=` (se agrega en `hrefFor`). */
  route: string;
  /** Qué resuelve el módulo. Se muestra al llegar. */
  purpose: string;
  /** El paso a paso concreto: dónde está el botón y qué se escribe. */
  how: string;
  /** Micro-tarea sugerida. Invita; no obliga. */
  tip?: string;
  /**
   * Botón de acción en la banda de guía. Solo aparece si la pantalla destino
   * registró un manejador con `useGuidedAction` — ver `guided-action.ts`.
   */
  action?: { label: string };
  signal: OnboardingSignal;
  /** Módulo al que pertenece, para saber si está en vista previa. */
  module?: TrialModuleKey;
  /** Icono del paso. Da identidad visual a la fila y ayuda a reencontrarla. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Tono del chip, del sistema pastel del producto (`--icon-*`). */
  tone: IconToneName;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ── Bloque 1: la estructura ────────────────────────────────────────────────
  {
    key: "agrupaciones",
    icon: Building2,
    tone: "sky",
    block: "configura",
    title: "Define tus torres o agrupaciones",
    why: "Es la base: cada unidad pertenece a una.",
    route: "/admin/settings",
    module: "settings",
    purpose:
      "Agrupar tus unidades por torre, bloque o manzana. Sobre esta lista se organiza todo lo demás: los filtros, la cartera y los reportes.",
    how:
      "En la pestaña «Conjunto» busca la tarjeta Torres y agrupaciones. Escribe el nombre tal como lo usa tu comunidad —Torre 1, Bloque A, Manzana 3— y agrégalo. Es una lista cerrada a propósito: al crear una unidad solo podrás elegir de aquí, y así nadie escribe «T1» donde otro escribió «torre 1».",
    tip: "¿Tu conjunto es uno solo, sin divisiones? Deja únicamente «Principal» y sigue.",
    action: { label: "Ir a Torres y agrupaciones" },
    signal: { kind: "agrupaciones" },
  },
  {
    key: "unidades",
    icon: Home,
    tone: "sky",
    block: "configura",
    title: "Crea tu primera unidad",
    why: "Es la pieza sobre la que gira todo el sistema.",
    route: "/admin/residents",
    module: "residents",
    purpose:
      "La unidad es el centro de Vivaru: a ella se le emiten las cuotas, se le asignan residentes, llegan sus visitas y se le guardan los paquetes.",
    how:
      "Pulsa «Nueva unidad», elige la agrupación que definiste, y escribe el identificador como lo conoce la comunidad: 101, A-302, Casa 14. Guarda y ya la tienes. Si son muchas, usa «Importar» y súbelas todas de una vez desde un archivo.",
    tip: "Crea una sola para probar. Las de ejemplo que ya ves puedes borrarlas cuando quieras.",
    action: { label: "Crear unidad" },
    signal: { kind: "docs", collection: "units", filterExamples: true },
  },
  {
    key: "residentes",
    icon: UserPlus,
    tone: "sky",
    block: "configura",
    title: "Registra al residente titular",
    why: "Sin persona vinculada no hay a quién cobrarle ni a quién avisarle.",
    route: "/admin/residents",
    module: "residents",
    purpose:
      "Vincular a la persona con su unidad. Ese vínculo es el que hace que le lleguen los comunicados, pueda reservar, autorizar visitas y ver su estado de cuenta.",
    how:
      "Abre la unidad que creaste y usa «Agregar persona». Indica si es propietario, arrendatario o ambos —eso define qué ve y qué puede hacer. Durante la prueba no se envían invitaciones por correo a personas reales; para recorrer el portal usarás tu cuenta de prueba en el paso 6.",
    action: { label: "Agregar persona" },
    signal: { kind: "docs", collection: "people", filterExamples: true },
  },
  {
    key: "porteria",
    icon: Shield,
    tone: "peach",
    block: "configura",
    title: "Da de alta a tu portería",
    why: "Es el segundo par de manos, y el que más usa Vivaru a diario.",
    route: "/admin/users",
    module: "users",
    purpose:
      "Portería tiene su propia pantalla: registra las visitas que llegan y entrega los paquetes. No ve cartera, ni finanzas, ni datos de unidades que no le corresponden.",
    how:
      "Crea un usuario con rol «Guarda de seguridad» y una contraseña temporal; en su primer ingreso se le pide cambiarla. Puedes dar de alta a tu portero real —es tu personal, no un tercero— o recorrer su portal con la cuenta de prueba que ya te dejamos lista en Configuración.",
    tip: "Meter al portero real es lo que convierte la prueba en operación: dos personas usándolo todos los días.",
    signal: { kind: "guardUser" },
  },

  // ── Bloque 2: una visita atravesando los tres portales ─────────────────────
  {
    key: "visita",
    icon: DoorOpen,
    tone: "peach",
    block: "prueba",
    title: "Registra una visita",
    why: "Es el arranque de la historia que vas a seguir en los dos pasos siguientes.",
    route: "/admin/visitors",
    module: "visitors",
    purpose:
      "Dejar autorizada la entrada de alguien a una unidad, con su hora y su ventana de validez. Es la operación más frecuente de cualquier conjunto.",
    how:
      "Pulsa «Nueva visita», elige la unidad que creaste, escribe el nombre de quien llega y la fecha. Al guardar se genera un pase con QR. No cierres esta idea aquí: en el paso 6 lo verás desde la portería y en el 7 desde el celular del residente.",
    action: { label: "Registrar visita" },
    signal: { kind: "docs", collection: "visitorPasses" },
  },
  {
    key: "portal-porteria",
    icon: Shield,
    tone: "peach",
    block: "prueba",
    title: "Míralo como portería",
    why: "Ver la pantalla del portero es entender la mitad del producto.",
    route: "/admin/settings",
    module: "settings",
    purpose:
      "Recorrer el portal de portería con tus propias credenciales de prueba, sin invitar a nadie ni compartir tu contraseña de administrador.",
    how:
      "En la pestaña «Conjunto» está la tarjeta Mis cuentas de prueba. Copia el correo y la contraseña de «Portería de prueba» y ábrela en una ventana de incógnito —así no cierras tu sesión de administrador. Vas a encontrar la visita que registraste esperando en la entrada, lista para validar con el QR.",
    tip: "Ventana de incógnito: Cmd+Shift+N en Chrome, Cmd+Shift+P en Firefox y Safari.",
    action: { label: "Ver mis cuentas de prueba" },
    signal: { kind: "seen" },
  },
  {
    key: "portal-residente",
    icon: Smartphone,
    tone: "mint",
    block: "prueba",
    title: "Míralo como residente",
    why: "Es exactamente lo que verá tu comunidad en el celular.",
    route: "/admin/settings",
    module: "settings",
    purpose:
      "Ver el producto desde el lado de quien vive en el conjunto: el portal del residente, pensado para el celular.",
    how:
      "En la misma tarjeta Mis cuentas de prueba, usa ahora «Residente de prueba». Ahí está el QR de la visita que registraste, sus comunicados, sus reservas, sus PQRS y su estado de cuenta. Si puedes, ábrelo en tu teléfono: está diseñado para esa pantalla.",
    tip: "Este es el portal que vas a mostrarle al comité. Vale la pena verlo antes que ellos.",
    action: { label: "Ver mis cuentas de prueba" },
    signal: { kind: "seen" },
  },

  // ── Bloque 3: el recorrido por el resto ────────────────────────────────────
  {
    key: "comunicados",
    icon: MessageSquare,
    tone: "sky",
    block: "descubre",
    title: "Comunicaciones",
    why: "Avisos que llegan de verdad, con constancia de quién los leyó.",
    route: "/admin/communications",
    module: "communications",
    purpose:
      "Publicar avisos a todo el conjunto o solo a una torre, y saber quién los leyó. Reemplaza el grupo de WhatsApp donde nadie sabe si el mensaje llegó.",
    how:
      "«Nuevo comunicado», eliges destinatarios —todos, una agrupación o unidades sueltas—, escribes y publicas. Le llega al residente en su portal y por correo. En la lista ves cuántos lo abrieron.",
    tip: "Pruébalo: publica el aviso de corte de agua del próximo mantenimiento.",
    action: { label: "Crear comunicado" },
    signal: { kind: "docs", collection: "communications" },
  },
  {
    key: "reservas",
    icon: CalendarCheck,
    tone: "mint",
    block: "descubre",
    title: "Reservas",
    why: "Se acaban las peleas por el salón comunal.",
    route: "/admin/reservations",
    module: "reservations",
    purpose:
      "Definir qué espacios se pueden reservar y con qué reglas: horarios, cupo, anticipación y si requieren tu aprobación. El residente reserva desde el celular y portería ve la agenda del día.",
    how:
      "En «Amenidades» defines cada espacio; en la agenda ves y apruebas lo que piden. Puedes exigir que estén al día con la cuota para poder reservar: quien deba, ve el bloqueo en su app sin que tengas que hacer nada.",
    tip: "Pruébalo: crea la «Sala social», de 9 a 22 h, máximo 4 horas por reserva.",
    action: { label: "Crear amenidad" },
    signal: { kind: "docs", collection: "amenities", filterExamples: true },
  },
  {
    key: "pqrs",
    icon: FileText,
    tone: "sand",
    block: "descubre",
    title: "PQRS",
    why: "Cada solicitud con responsable, fecha y rastro.",
    route: "/admin/pqrs",
    module: "pqrs",
    purpose:
      "Recibir peticiones, quejas, reclamos y sugerencias por un canal formal, con historial. Cada una queda con su fecha, su responsable y su respuesta escrita.",
    how:
      "El residente la crea desde su portal y aparece aquí. La tomas, respondes y la cierras; él ve el avance en tiempo real. El tablero te muestra las que llevan más tiempo abiertas para que ninguna se pierda.",
    signal: { kind: "docs", collection: "tickets" },
  },
  {
    key: "paqueteria",
    icon: Package,
    tone: "sand",
    block: "descubre",
    title: "Paquetería",
    why: "Se sabe quién recibió, quién entregó y cuándo.",
    route: "/admin/packages",
    module: "packages",
    purpose:
      "Controlar los paquetes que llegan a portería: quién los recibió, a qué unidad van y quién los retiró. Termina con el «yo nunca recibí nada».",
    how:
      "Portería registra el paquete al recibirlo y el residente recibe el aviso. Al entregarlo se marca con quién lo retiró. En el tablero ves lo que lleva días en bodega y puedes mandar un recordatorio.",
    signal: { kind: "docs", collection: "packages" },
  },
  {
    key: "encuestas",
    icon: ClipboardList,
    tone: "mint",
    block: "descubre",
    title: "Encuestas",
    why: "Consulta a la comunidad sin llenar el chat de mensajes.",
    route: "/admin/surveys",
    module: "surveys",
    purpose:
      "Preguntarle algo a la comunidad y tener el resultado contado: desde un sondeo de horarios hasta una consulta previa a la asamblea.",
    how:
      "Creas la encuesta con sus preguntas, eliges a quién va y la publicas. El residente responde desde su portal y tú ves el consolidado en vivo, sin contar votos a mano.",
    tip: "Pruébalo: pregunta a qué hora prefieren la asamblea.",
    signal: { kind: "docs", collection: "surveys" },
  },
  {
    key: "servicios",
    icon: Store,
    tone: "peach",
    block: "descubre",
    title: "Servicios",
    why: "El directorio de proveedores, en un solo lugar confiable.",
    route: "/admin/services",
    module: "services",
    purpose:
      "Publicar el directorio de proveedores y servicios que recomienda la administración: plomería, cerrajería, mudanzas, domicilios.",
    how:
      "Agregas cada proveedor con su contacto y categoría, y queda visible en el portal del residente. Evita que el dato de confianza viva solo en la memoria del portero de turno.",
    action: { label: "Agregar servicio" },
    signal: { kind: "docs", collection: "services" },
  },
  {
    key: "documentos",
    icon: ScrollText,
    tone: "sand",
    block: "descubre",
    title: "Documentos",
    why: "Actas y reglamentos donde todos los encuentran.",
    route: "/admin/documents",
    module: "documents",
    purpose:
      "Guardar y compartir los documentos del conjunto: actas de asamblea, reglamentos, pólizas, contratos. Organizados en carpetas y siempre a la mano.",
    how:
      "Creas carpetas y subes archivos; defines cuáles ve el residente y cuáles son solo de la administración. Durante la prueba el espacio de almacenamiento está limitado.",
    signal: { kind: "docs", collection: "documents" },
  },
  {
    key: "financiero",
    icon: Wallet,
    tone: "lavender",
    block: "descubre",
    title: "Cartera, finanzas y reportes",
    why: "Es el corazón del servicio. Míralo con datos de ejemplo.",
    route: "/admin/billing",
    module: "billing",
    purpose:
      "La parte que más tiempo te ahorra: emitir cuotas, registrar pagos, controlar la mora, llevar el libro de ingresos y egresos, conciliar contra el banco y sacar el informe del comité.",
    how:
      "Durante la prueba estos módulos —y también Reglamento con firmas— están en vista previa: los recorres poblados con datos de ejemplo para ver cómo se verían con tu conjunto, pero no se opera sobre ellos. Se habilitan al contratar el servicio. Recórrelos con calma: es lo que vas a presentarle al comité.",
    signal: { kind: "seen" },
  },
];

/** Los 7 pasos que miden puesta en marcha real. */
export const ACTIVATION_STEPS = ONBOARDING_STEPS.filter(
  (step) => step.block === "configura" || step.block === "prueba",
);

/** El recorrido por el resto del producto: señal secundaria, no obligatoria. */
export const DISCOVERY_STEPS = ONBOARDING_STEPS.filter((step) => step.block === "descubre");

export const ACTIVATION_TOTAL = ACTIVATION_STEPS.length;
export const DISCOVERY_TOTAL = DISCOVERY_STEPS.length;

/** Nombre del parámetro que activa la ayuda en la pantalla destino. */
export const GUIDE_PARAM = "guia";

export function stepByKey(key: string | null | undefined): OnboardingStep | undefined {
  if (!key) return undefined;
  return ONBOARDING_STEPS.find((step) => step.key === key);
}

/** Enlace del checklist: la ruta más el parámetro que abre la ayuda al llegar. */
export function hrefFor(step: OnboardingStep): string {
  return `${step.route}?${GUIDE_PARAM}=${step.key}`;
}

/** Posición 1-based dentro de su bloque, para el "Paso 2 de 4" de la banda. */
export function positionInBlock(step: OnboardingStep): { index: number; total: number } {
  const siblings = ONBOARDING_STEPS.filter((item) => item.block === step.block);
  return { index: siblings.findIndex((item) => item.key === step.key) + 1, total: siblings.length };
}

/** El paso siguiente del recorrido, saltando los que ya están hechos. */
export function nextStepAfter(step: OnboardingStep, isDone: (key: string) => boolean) {
  const from = ONBOARDING_STEPS.findIndex((item) => item.key === step.key);
  if (from < 0) return undefined;
  return ONBOARDING_STEPS.slice(from + 1).find((item) => !isDone(item.key));
}
