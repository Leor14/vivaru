// Ilustraciones de la demo (plan de documentos, T1.2): las áreas comunes, el logo, la esfera del
// medidor y el comprobante de una transferencia. Dibujadas en SVG y pasadas por `sharp`: nada
// descargado, nada de marcas reales, y la marca de demo en una esquina de cada imagen (decisión DD3).
//
// El tamaño de las fotos de las áreas imita al producto: `uploadAmenityPhoto` las recomprime a 800 px
// de ancho antes de subirlas.

import sharp from "sharp";

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FUENTE = "Helvetica, Arial, sans-serif";

/** La marca de demo, discreta, en la esquina inferior derecha. */
function marca(ancho, alto) {
  const w = 214;
  return `<g opacity="0.82">
    <rect x="${ancho - w - 14}" y="${alto - 40}" width="${w}" height="26" rx="13" fill="#1F2A24" fill-opacity="0.55"/>
    <text x="${ancho - w / 2 - 14}" y="${alto - 22}" text-anchor="middle" font-family="${FUENTE}" font-size="12" font-weight="bold" fill="#FFFFFF" letter-spacing="0.6">EJEMPLO · DEMO VIVARU</text>
  </g>`;
}

/** Cielo por hora del día: cada vista de un área cambia la luz, no solo el encuadre. */
const CIELOS = {
  dia: ["#8EC5EA", "#DDF0FA"],
  tarde: ["#F2B880", "#FBE3C2"],
  nublado: ["#AAB7C0", "#E6EBEE"],
};

function cielo(ancho, alto, luz) {
  const [a, b] = CIELOS[luz] ?? CIELOS.dia;
  return `<defs><linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="${ancho}" height="${alto}" fill="url(#cielo)"/>`;
}

function palmera(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 0 C 6 -60, -4 -120, 8 -180" stroke="#8A6A45" stroke-width="12" fill="none" stroke-linecap="round"/>
    ${[-70, -35, 0, 35, 70, 110, -110].map((g) => `<ellipse cx="8" cy="-180" rx="70" ry="14" fill="#3F7D4E" transform="rotate(${g} 8 -180) translate(36 0)"/>`).join("")}
  </g>`;
}

function arbol(x, y, s = 1, color = "#4E8A5B") {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-6" y="-40" width="12" height="44" fill="#7A5A3C"/>
    <circle cx="0" cy="-70" r="42" fill="${color}"/><circle cx="-26" cy="-52" r="28" fill="${color}"/><circle cx="26" cy="-52" r="28" fill="${color}"/>
  </g>`;
}

const ESCENAS = {
  alberca(v, W, H) {
    return `${cielo(W, H, ["dia", "tarde", "dia"][v])}
      <rect x="0" y="${H * 0.46}" width="${W}" height="${H * 0.54}" fill="#E8DCC6"/>
      <rect x="${W * 0.08}" y="${H * 0.22}" width="${W * 0.42}" height="${H * 0.26}" fill="#F4EFE6" stroke="#CFC5B4" stroke-width="3"/>
      <polygon points="${W * 0.06},${H * 0.23} ${W * 0.29},${H * 0.12} ${W * 0.52},${H * 0.23}" fill="#B35B3C"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${W * 0.11 + i * W * 0.095}" y="${H * 0.28}" width="${W * 0.06}" height="${H * 0.12}" fill="#9CC7DE" stroke="#FFFFFF" stroke-width="3"/>`).join("")}
      <defs><linearGradient id="agua" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FB3D9"/><stop offset="1" stop-color="#1F7FAF"/></linearGradient></defs>
      <polygon points="${W * 0.12},${H * 0.6} ${W * 0.88},${H * 0.6} ${W * 0.96},${H * 0.9} ${W * 0.04},${H * 0.9}" fill="url(#agua)" stroke="#FFFFFF" stroke-width="6"/>
      ${[1, 2, 3, 4].map((i) => `<line x1="${W * (0.12 + i * 0.152)}" y1="${H * 0.6}" x2="${W * (0.04 + i * 0.184)}" y2="${H * 0.9}" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="3"/>`).join("")}
      ${[0, 1, 2].map((i) => `<path d="M${W * 0.2 + i * 150} ${H * 0.72} q 20 -8 40 0 t 40 0" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="3" fill="none"/>`).join("")}
      ${[0, 1, 2].map((i) => `<rect x="${W * 0.6 + i * 64}" y="${H * 0.5}" width="50" height="14" rx="4" fill="#FFFFFF" stroke="#B9AE9B"/>`).join("")}
      <line x1="${W * 0.55}" y1="${H * 0.36}" x2="${W * 0.55}" y2="${H * 0.54}" stroke="#6B5B4B" stroke-width="4"/>
      <path d="M${W * 0.47} ${H * 0.38} Q ${W * 0.55} ${H * 0.29} ${W * 0.63} ${H * 0.38} Z" fill="#E8A33D"/>
      ${palmera(W * 0.82, H * 0.5, 0.9)}${palmera(W * 0.92, H * 0.52, 0.75)}`;
  },
  padel(v, W, H) {
    return `${cielo(W, H, ["dia", "nublado", "tarde"][v])}
      <rect x="0" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="#6E9E63"/>
      <polygon points="${W * 0.12},${H * 0.52} ${W * 0.88},${H * 0.52} ${W * 0.98},${H * 0.95} ${W * 0.02},${H * 0.95}" fill="#2F6FB3"/>
      <polygon points="${W * 0.12},${H * 0.52} ${W * 0.88},${H * 0.52} ${W * 0.98},${H * 0.95} ${W * 0.02},${H * 0.95}" fill="none" stroke="#FFFFFF" stroke-width="5"/>
      <line x1="${W * 0.5}" y1="${H * 0.52}" x2="${W * 0.5}" y2="${H * 0.95}" stroke="#FFFFFF" stroke-width="4"/>
      <line x1="${W * 0.085}" y1="${H * 0.7}" x2="${W * 0.915}" y2="${H * 0.7}" stroke="#FFFFFF" stroke-width="4"/>
      <rect x="${W * 0.06}" y="${H * 0.69}" width="${W * 0.88}" height="${H * 0.05}" fill="#1B1F24" fill-opacity="0.55"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${W * 0.12 + i * W * 0.095}" y="${H * 0.26}" width="${W * 0.09}" height="${H * 0.26}" fill="#CFE6F2" fill-opacity="0.35" stroke="#44515C" stroke-width="3"/>`).join("")}
      ${[0.1, 0.9].map((p) => `<line x1="${W * p}" y1="${H * 0.08}" x2="${W * p}" y2="${H * 0.52}" stroke="#44515C" stroke-width="6"/><rect x="${W * p - 22}" y="${H * 0.06}" width="44" height="14" fill="#F4F1C9"/>`).join("")}
      ${arbol(W * 0.04, H * 0.55, 0.8)}${arbol(W * 0.97, H * 0.56, 0.9)}`;
  },
  "casa-club"(v, W, H) {
    if (v === 1) {
      // Interior: el salón puesto para un evento.
      return `<rect width="${W}" height="${H}" fill="#F3EDE3"/>
        <rect x="0" y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="#B98B5E"/>
        ${[0, 1, 2, 3].map((i) => `<rect x="${W * 0.08 + i * W * 0.23}" y="${H * 0.12}" width="${W * 0.16}" height="${H * 0.36}" fill="#BFDDEB" stroke="#FFFFFF" stroke-width="6"/>`).join("")}
        ${[0, 1, 2, 3, 4].map((i) => `<line x1="${W * 0.1 + i * W * 0.2}" y1="0" x2="${W * 0.1 + i * W * 0.2}" y2="${H * 0.1}" stroke="#6B5B4B" stroke-width="2"/><circle cx="${W * 0.1 + i * W * 0.2}" cy="${H * 0.11}" r="12" fill="#F6D98B"/>`).join("")}
        ${[0, 1, 2].map((i) => `<ellipse cx="${W * 0.22 + i * W * 0.28}" cy="${H * 0.74}" rx="${W * 0.1}" ry="${H * 0.05}" fill="#FFFFFF" stroke="#D9D2C5"/><rect x="${W * 0.22 + i * W * 0.28 - W * 0.1}" y="${H * 0.74}" width="${W * 0.2}" height="${H * 0.1}" fill="#FFFFFF"/>`).join("")}
        ${[0, 1, 2].map((i) => `<circle cx="${W * 0.22 + i * W * 0.28}" cy="${H * 0.715}" r="10" fill="#C75D5D"/>`).join("")}`;
    }
    return `${cielo(W, H, ["dia", "dia", "tarde"][v])}
      <rect x="0" y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="#7FAE6E"/>
      <rect x="${W * 0.14}" y="${H * 0.3}" width="${W * 0.72}" height="${H * 0.42}" fill="#F4EFE6" stroke="#CFC5B4" stroke-width="3"/>
      <polygon points="${W * 0.1},${H * 0.31} ${W * 0.5},${H * 0.12} ${W * 0.9},${H * 0.31}" fill="#B35B3C"/>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="${W * 0.18 + i * W * 0.13}" y="${H * 0.38}" width="${W * 0.09}" height="${H * 0.22}" fill="#9CC7DE" stroke="#FFFFFF" stroke-width="4"/>`).join("")}
      <rect x="${W * 0.46}" y="${H * 0.52}" width="${W * 0.08}" height="${H * 0.2}" fill="#7A5A3C"/>
      <rect x="${W * 0.36}" y="${H * 0.72}" width="${W * 0.28}" height="${H * 0.28}" fill="#D8CDBA"/>
      ${arbol(W * 0.07, H * 0.72)}${arbol(W * 0.93, H * 0.72, 1.1)}`;
  },
  gimnasio(v, W, H) {
    return `<rect width="${W}" height="${H}" fill="${["#E9ECEF", "#DDE3E8", "#EFE9E2"][v]}"/>
      <rect x="0" y="${H * 0.66}" width="${W}" height="${H * 0.34}" fill="#3B4148"/>
      <rect x="${W * 0.05}" y="${H * 0.1}" width="${W * 0.55}" height="${H * 0.46}" fill="#C8D6DF" stroke="#9FB0BB" stroke-width="4"/>
      <line x1="${W * 0.325}" y1="${H * 0.1}" x2="${W * 0.325}" y2="${H * 0.56}" stroke="#9FB0BB" stroke-width="3"/>
      <rect x="${W * 0.66}" y="${H * 0.12}" width="${W * 0.28}" height="${H * 0.26}" fill="#BFDDEB" stroke="#FFFFFF" stroke-width="5"/>
      ${[0, 1, 2].map((i) => `<g transform="translate(${W * 0.1 + i * W * 0.17} ${H * 0.6})"><rect x="0" y="0" width="${W * 0.13}" height="${H * 0.08}" rx="6" fill="#23272C"/><rect x="${W * 0.1}" y="${-H * 0.16}" width="8" height="${H * 0.18}" fill="#23272C"/><rect x="${W * 0.085}" y="${-H * 0.19}" width="${W * 0.05}" height="${H * 0.04}" rx="3" fill="#5B6570"/></g>`).join("")}
      <rect x="${W * 0.66}" y="${H * 0.46}" width="${W * 0.28}" height="10" fill="#6B737C"/>
      ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${W * 0.69 + i * W * 0.055}" cy="${H * 0.52}" r="${14 + i * 2}" fill="#2B3036"/>`).join("")}
      <rect x="${W * 0.67}" y="${H * 0.58}" width="${W * 0.26}" height="12" rx="4" fill="#C75D5D"/>`;
  },
  palapa(v, W, H) {
    return `${cielo(W, H, ["dia", "tarde", "nublado"][v])}
      <rect x="0" y="${H * 0.6}" width="${W}" height="${H * 0.4}" fill="#7FAE6E"/>
      <polygon points="${W * 0.2},${H * 0.42} ${W * 0.5},${H * 0.12} ${W * 0.8},${H * 0.42}" fill="#C9A15B"/>
      ${Array.from({ length: 14 }, (_, i) => `<line x1="${W * 0.5}" y1="${H * 0.12}" x2="${W * (0.2 + i * 0.046)}" y2="${H * 0.42}" stroke="#A9823F" stroke-width="3"/>`).join("")}
      ${[0.26, 0.5, 0.74].map((p) => `<rect x="${W * p - 7}" y="${H * 0.42}" width="14" height="${H * 0.3}" fill="#7A5A3C"/>`).join("")}
      <rect x="${W * 0.32}" y="${H * 0.62}" width="${W * 0.36}" height="16" fill="#8A6A45"/>
      <rect x="${W * 0.34}" y="${H * 0.64}" width="10" height="${H * 0.08}" fill="#8A6A45"/><rect x="${W * 0.65}" y="${H * 0.64}" width="10" height="${H * 0.08}" fill="#8A6A45"/>
      <rect x="${W * 0.82}" y="${H * 0.58}" width="${W * 0.1}" height="${H * 0.12}" fill="#3B4148"/>
      ${[0, 1, 2].map((i) => `<path d="M${W * 0.84 + i * 18} ${H * 0.56} q -10 -20 0 -40 q 10 -20 0 -40" stroke="#B9C0C6" stroke-width="5" fill="none" stroke-opacity="0.7"/>`).join("")}
      ${arbol(W * 0.08, H * 0.62, 1.1)}${arbol(W * 0.14, H * 0.64, 0.8, "#5E9A68")}`;
  },
};

/** Las áreas con ilustración, por la clave que tiene cada una en el padrón. */
export const TIPOS_DE_AREA = Object.keys(ESCENAS);

/**
 * La foto de un área común: `tipo` (alberca, padel, casa-club, gimnasio, palapa) y `vista` 0, 1 o 2.
 * JPEG de 800×500, como la deja `uploadAmenityPhoto`.
 */
export async function fotoDeArea(tipo, vista = 0) {
  const escena = ESCENAS[tipo];
  if (!escena) throw new Error(`No hay ilustración para el área «${tipo}» (hay: ${TIPOS_DE_AREA.join(", ")}).`);
  const W = 800;
  const H = 500;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${escena(vista % 3, W, H)}${marca(W, H)}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toBuffer();
}

const TEMAS_DE_CARTEL = {
  limpieza: { fondo: "#E6F2E1", tinta: "#1F4D2E", acento: "#3F7D4E" },
  simulacro: { fondo: "#FFF1E0", tinta: "#7A2E0E", acento: "#D9661F" },
  fiesta: { fondo: "#FDF6EC", tinta: "#1F2A24", acento: "#C2185B" },
};

function adornoDeCartel(tema, W) {
  if (tema === "fiesta") {
    // Papel picado: dos tiras de banderitas de colores, con sus recortes.
    const colores = ["#C2185B", "#F4A300", "#2E7D32", "#1565C0", "#8E24AA", "#E53935"];
    const n = 8;
    const w = W / n;
    return [0, 1].map((fila) => {
      const y = 40 + fila * 120;
      // La segunda tira va desplazada media bandera, y lleva una más para llegar a los dos bordes.
      const banderas = Array.from({ length: n + fila }, (_, i) => {
        const x = i * w - (fila ? w / 2 : 0);
        const a = (w - 12) / 4;
        return `<path d="M${x + 6} ${y} h${w - 12} v70 l${-a} -14 l${-a} 14 l${-a} -14 l${-a} 14 Z" fill="${colores[(i + fila * 3) % colores.length]}"/>
          <circle cx="${x + w / 2}" cy="${y + 28}" r="9" fill="#FDF6EC"/>
          <rect x="${x + w / 2 - 22}" y="${y + 44}" width="10" height="10" fill="#FDF6EC" transform="rotate(45 ${x + w / 2 - 17} ${y + 49})"/>
          <rect x="${x + w / 2 + 12}" y="${y + 44}" width="10" height="10" fill="#FDF6EC" transform="rotate(45 ${x + w / 2 + 17} ${y + 49})"/>`;
      });
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#6B5B4B" stroke-width="3"/>${banderas.join("")}`;
    }).join("");
  }
  if (tema === "limpieza") {
    return `${arbol(W * 0.18, 300, 1.4)}${arbol(W * 0.5, 285, 1.7, "#5E9A68")}${arbol(W * 0.82, 300, 1.4)}<rect x="0" y="296" width="${W}" height="18" fill="#7FAE6E"/>`;
  }
  // Simulacro: la señal de punto de reunión, cuatro flechas hacia un centro sobre fondo verde.
  return `<g transform="translate(${W / 2} 190)">
    <circle r="120" fill="#2E7D32"/>
    ${[0, 90, 180, 270].map((g) => `<path d="M0 -30 L26 -62 L12 -62 L12 -104 L-12 -104 L-12 -62 L-26 -62 Z" fill="#FFFFFF" transform="rotate(${g})"/>`).join("")}
    <circle r="14" fill="#FFFFFF"/>
  </g>`;
}

/**
 * El cartel de un comunicado (A4): un adorno por tema, el título en grande y los datos del evento.
 * JPEG de 800×1100. Los textos llegan ya partidos en líneas, porque SVG no parte el texto solo.
 */
export async function cartel({ tema, titulo, lineas, pie }) {
  const T = TEMAS_DE_CARTEL[tema];
  if (!T) throw new Error(`No hay tema de cartel «${tema}» (hay: ${Object.keys(TEMAS_DE_CARTEL).join(", ")}).`);
  const W = 800;
  const H = 1100;
  const y0 = 470;
  const yLineas = y0 + titulo.length * 78 + 50;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${T.fondo}"/>
    ${adornoDeCartel(tema, W)}
    ${titulo.map((l, i) => `<text x="${W / 2}" y="${y0 + i * 78}" text-anchor="middle" font-family="${FUENTE}" font-size="66" font-weight="bold" fill="${T.tinta}">${esc(l)}</text>`).join("")}
    <rect x="${W / 2 - 60}" y="${yLineas - 80}" width="120" height="6" rx="3" fill="${T.acento}"/>
    ${lineas.map((l, i) => `<text x="${W / 2}" y="${yLineas + i * 54}" text-anchor="middle" font-family="${FUENTE}" font-size="34" fill="${T.tinta}">${esc(l)}</text>`).join("")}
    <text x="${W / 2}" y="${H - 96}" text-anchor="middle" font-family="${FUENTE}" font-size="24" fill="${T.tinta}" fill-opacity="0.75">${esc(pie)}</text>
    ${marca(W, H - 20)}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toBuffer();
}

/** El logo del conjunto: unas lomas y un árbol, con el nombre. PNG con fondo transparente. */
export async function logoDelConjunto({ nombre, color = "#2F6B4F" }) {
  const S = 512;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <circle cx="256" cy="200" r="150" fill="${esc(color)}"/>
    <path d="M106 250 Q 180 170 256 230 Q 330 180 406 250 L 406 290 Q 256 360 106 290 Z" fill="#FFFFFF" fill-opacity="0.9"/>
    <path d="M136 280 Q 220 220 300 270 Q 350 245 380 270" stroke="${esc(color)}" stroke-width="10" fill="none" stroke-opacity="0.6"/>
    <rect x="248" y="120" width="16" height="70" fill="#FFFFFF"/>
    <circle cx="256" cy="110" r="42" fill="#FFFFFF"/>
    <text x="256" y="420" text-anchor="middle" font-family="${FUENTE}" font-size="40" font-weight="bold" fill="${esc(color)}">${esc(nombre)}</text>
    <text x="256" y="462" text-anchor="middle" font-family="${FUENTE}" font-size="18" fill="#55605A" letter-spacing="3">EJEMPLO · DEMO</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** La foto de un medidor de agua: esfera con el totalizador en m³ y la etiqueta de la toma. */
export async function esferaDeMedidor({ casa, periodo, lectura, tomada }) {
  const S = 900;
  // Cinco dígitos negros para los m³ y uno rojo para la décima, como un totalizador real: el rojo
  // es la fracción, no las unidades.
  const entero = String(Math.floor(lectura)).padStart(5, "0").slice(-5).split("");
  const decima = String(Math.floor((lectura % 1) * 10));
  const digitos = [...entero, decima];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="#6D6A63"/>
    <rect x="0" y="0" width="${S}" height="${S}" fill="#8A857B" fill-opacity="0.35"/>
    <circle cx="450" cy="420" r="320" fill="#2C3136"/>
    <circle cx="450" cy="420" r="292" fill="#EDEFF0" stroke="#B7BDC2" stroke-width="10"/>
    <text x="450" y="250" text-anchor="middle" font-family="${FUENTE}" font-size="30" fill="#3B4148" letter-spacing="4">MEDIDOR DE AGUA</text>
    <rect x="212" y="300" width="476" height="96" rx="8" fill="#1B1F24"/>
    ${digitos.map((d, i) => `<rect x="${224 + i * 76}" y="310" width="66" height="76" rx="4" fill="${i === 5 ? "#B23A2B" : "#FFFFFF"}"/><text x="${257 + i * 76}" y="370" text-anchor="middle" font-family="${FUENTE}" font-size="54" font-weight="bold" fill="${i === 5 ? "#FFFFFF" : "#1B1F24"}">${d}</text>`).join("")}
    <text x="450" y="440" text-anchor="middle" font-family="${FUENTE}" font-size="30" fill="#3B4148">m³</text>
    ${[0, 1, 2].map((i) => `<circle cx="${330 + i * 120}" cy="520" r="40" fill="#FFFFFF" stroke="#8A9096" stroke-width="4"/><line x1="${330 + i * 120}" y1="520" x2="${330 + i * 120 + 22}" y2="${500 + i * 8}" stroke="#B23A2B" stroke-width="5"/>`).join("")}
    <rect x="150" y="752" width="600" height="96" rx="10" fill="#FFFFFF" fill-opacity="0.92"/>
    <text x="175" y="792" font-family="${FUENTE}" font-size="26" font-weight="bold" fill="#1F2A24">${esc(casa)} · ${esc(periodo)}</text>
    <text x="175" y="830" font-family="${FUENTE}" font-size="22" fill="#55605A">Tomada ${esc(tomada)}</text>
    ${marca(S, S - 20)}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

/**
 * El comprobante de una transferencia, como la captura de pantalla que sube un residente. Genérico:
 * sin nombre ni logo de ningún banco. Los textos largos van en su propia línea, sin cortar.
 * `recortado`: una captura mal hecha, sin la parte de arriba, que deja el importe a medias (el motivo
 * con que la administración rechaza uno de los sembrados).
 */
export async function comprobanteDeTransferencia({ fecha, importe, ordenante, beneficiario, cuentaDestino, concepto, referencia, rastreo, recortado = false }) {
  const W = 720;
  const H = 1280;
  const filas = [
    ["Fecha y hora", fecha],
    ["Ordenante", ordenante],
    ["Beneficiario", beneficiario],
    ["Cuenta destino", cuentaDestino],
    ["Concepto", concepto],
    ["Referencia", referencia],
    ["Clave de rastreo", rastreo],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#F4F6F8"/>
    <rect width="${W}" height="300" fill="#1E4E79"/>
    <circle cx="${W / 2}" cy="120" r="46" fill="#FFFFFF"/>
    <path d="M${W / 2 - 22} 120 l 15 16 l 30 -32" stroke="#1E7A4F" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${W / 2}" y="212" text-anchor="middle" font-family="${FUENTE}" font-size="32" font-weight="bold" fill="#FFFFFF">Transferencia enviada</text>
    <text x="${W / 2}" y="262" text-anchor="middle" font-family="${FUENTE}" font-size="46" font-weight="bold" fill="#FFFFFF">${esc(importe)}</text>
    <rect x="32" y="330" width="${W - 64}" height="${filas.length * 108 + 24}" rx="18" fill="#FFFFFF"/>
    ${filas.map(([k, v], i) => `<text x="64" y="${380 + i * 108}" font-family="${FUENTE}" font-size="22" fill="#6B7680">${esc(k)}</text>
      <text x="64" y="${416 + i * 108}" font-family="${FUENTE}" font-size="27" fill="#1F2A24">${esc(v)}</text>
      ${i < filas.length - 1 ? `<line x1="64" y1="${440 + i * 108}" x2="${W - 64}" y2="${440 + i * 108}" stroke="#E3E7EA" stroke-width="2"/>` : ""}`).join("")}
    <text x="${W / 2}" y="${H - 90}" text-anchor="middle" font-family="${FUENTE}" font-size="20" fill="#6B7680">Operación SPEI · comprobante para tus registros</text>
    ${marca(W, H - 20)}
  </svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  // El importe ocupa de y≈229 a y=262: cortar en 252 deja apenas el pie de las cifras, que no se leen
  // (en 244 todavía se leían: lo cazó mirar la captura).
  return recortado ? sharp(jpeg).extract({ left: 0, top: 252, width: W, height: H - 252 }).jpeg({ quality: 82 }).toBuffer() : jpeg;
}

/**
 * El plano general del fraccionamiento (A5): cada sección con sus casas numeradas a los dos lados de
 * su calle; la avenida con los dos accesos, la caseta y el estacionamiento de visitas; y las áreas
 * comunes. PNG de 1600×1100, ilustrativo y sin escala.
 */
export async function planoDelFraccionamiento({ secciones, casasPorSeccion }) {
  const W = 1600;
  const H = 1100;
  const COLORES = ["#EFE1BC", "#DCE8C8", "#E6D8EE"];
  const calles = [230, 530, 830];
  if (secciones.length > calles.length) throw new Error(`El plano dibuja ${calles.length} secciones y el padrón trae ${secciones.length}.`);
  const porLado = Math.ceil(casasPorSeccion / 2);
  const x0 = 150;
  const x1 = 770;
  const anchoLote = (x1 - x0 - 10) / porLado;
  const texto = (x, y, t, { tam = 20, color = "#4A4538", peso = "bold", ancla = "middle" } = {}) =>
    `<text x="${x}" y="${y}" text-anchor="${ancla}" font-family="${FUENTE}" font-size="${tam}" font-weight="${peso}" fill="${color}">${esc(t)}</text>`;

  const manzanas = secciones.map((nombre, k) => {
    const y = calles[k];
    const casas = Array.from({ length: casasPorSeccion }, (_, i) => {
      const arriba = i < porLado;
      const lx = x0 + (arriba ? i : i - porLado) * anchoLote;
      const ly = arriba ? y - 134 : y + 24;
      return `<rect x="${lx + 3}" y="${ly}" width="${anchoLote - 6}" height="110" rx="4" fill="${COLORES[k]}" stroke="#B89B62" stroke-width="2"/>
        <rect x="${lx + anchoLote / 2 - 18}" y="${arriba ? ly + 66 : ly + 18}" width="36" height="26" fill="#FFFFFF" stroke="#8C7A55" stroke-width="2"/>
        ${texto(lx + anchoLote / 2, arriba ? ly + 42 : ly + 98, String(i + 1).padStart(2, "0"), { color: "#5B4A2A" })}`;
    }).join("");
    return `<rect x="${x0 - 10}" y="${y - 22}" width="${x1 - x0 + 10}" height="44" fill="#CFC9BC"/>
      <line x1="${x0 + 190}" y1="${y}" x2="${x1}" y2="${y}" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="18 14"/>
      ${texto(x0 + 4, y + 7, `Calle ${nombre}`, { ancla: "start" })}
      ${casas}`;
  }).join("");

  const arboles = [[95, 300], [95, 600], [95, 900], [1300, 700], [1390, 770], [1470, 690], [1330, 860], [1470, 860]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="26" fill="#6E9E63"/><circle cx="${x - 14}" cy="${y + 8}" r="16" fill="#5E8E55"/>`).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#F3F1EA"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#6B6456" stroke-width="8"/>
    <rect x="860" y="80" width="680" height="840" rx="14" fill="#E4EEDC"/>
    ${arboles}
    ${manzanas}
    <rect x="770" y="32" width="60" height="${H - 64}" fill="#CFC9BC"/>
    <line x1="800" y1="40" x2="800" y2="${H - 40}" stroke="#FFFFFF" stroke-width="3" stroke-dasharray="18 14"/>
    <text transform="translate(824 640) rotate(-90)" text-anchor="middle" font-family="${FUENTE}" font-size="20" font-weight="bold" fill="#4A4538">Avenida principal</text>
    ${texto(800, 28, "Acceso de servicio")}
    ${texto(800, H - 12, "Acceso principal")}
    <rect x="840" y="${H - 120}" width="56" height="48" fill="#FFFFFF" stroke="#4A4538" stroke-width="3"/>
    ${texto(868, H - 128, "Caseta", { tam: 16 })}
    <rect x="920" y="${H - 140}" width="240" height="84" fill="#DAD5C9" stroke="#8C8577" stroke-width="2"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="${950 + i * 30}" y1="${H - 140}" x2="${950 + i * 30}" y2="${H - 104}" stroke="#FFFFFF" stroke-width="3"/>`).join("")}
    ${texto(1040, H - 148, "Estacionamiento de visitas", { tam: 16 })}
    <rect x="900" y="110" width="300" height="200" fill="#F4EFE6" stroke="#B35B3C" stroke-width="4"/>
    <rect x="900" y="110" width="300" height="26" fill="#B35B3C"/>
    ${texto(1050, 228, "Casa club", { tam: 26 })}
    <rect x="1230" y="110" width="280" height="130" fill="#E3E7EA" stroke="#5B6570" stroke-width="4"/>
    ${texto(1370, 184, "Gimnasio", { tam: 24 })}
    <rect x="890" y="370" width="380" height="260" rx="10" fill="#E8DCC6"/>
    <rect x="920" y="400" width="320" height="200" rx="8" fill="#4FB3D9" stroke="#FFFFFF" stroke-width="6"/>
    ${[1, 2, 3].map((i) => `<line x1="920" y1="${400 + i * 50}" x2="1240" y2="${400 + i * 50}" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="3"/>`).join("")}
    ${texto(1080, 510, "Alberca", { tam: 26, color: "#FFFFFF" })}
    <g transform="translate(1400 470)">
      <circle r="80" fill="#C9A15B" stroke="#A9823F" stroke-width="4"/>
      ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="0" x2="${(80 * Math.cos((i * Math.PI) / 6)).toFixed(1)}" y2="${(80 * Math.sin((i * Math.PI) / 6)).toFixed(1)}" stroke="#A9823F" stroke-width="3"/>`).join("")}
    </g>
    ${texto(1400, 582, "Palapa", { tam: 24 })}
    ${texto(1050, 674, "Cancha de pádel", { tam: 22 })}
    <rect x="900" y="690" width="300" height="190" fill="#2F6FB3" stroke="#FFFFFF" stroke-width="5"/>
    <line x1="1050" y1="690" x2="1050" y2="880" stroke="#FFFFFF" stroke-width="4"/>
    <line x1="900" y1="785" x2="1200" y2="785" stroke="#1B1F24" stroke-opacity="0.5" stroke-width="6"/>
    <g transform="translate(1480 990)">
      <polygon points="0,-34 14,10 0,2 -14,10" fill="#4A4538"/>
      ${texto(0, 34, "N")}
    </g>
    ${texto(60, H - 12, "Plano ilustrativo · sin escala", { tam: 16, peso: "normal", ancla: "start" })}
    ${marca(W, H - 20)}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Una foto de la azotea de la casa club, antes o después de impermeabilizarla (A5). JPEG de 800×500. */
export async function fotoDeObra(etapa) {
  if (etapa !== "antes" && etapa !== "despues") throw new Error(`Etapa de obra desconocida: «${etapa}» (hay: antes, despues).`);
  const W = 800;
  const H = 500;
  const antes = etapa === "antes";
  const azotea = "120,480 680,480 610,190 190,190";
  const detalle = antes
    ? `<ellipse cx="300" cy="300" rx="80" ry="26" fill="#6E6A63" fill-opacity="0.55"/>
      <ellipse cx="520" cy="380" rx="95" ry="28" fill="#6E6A63" fill-opacity="0.5"/>
      <ellipse cx="450" cy="235" rx="55" ry="16" fill="#6E6A63" fill-opacity="0.45"/>
      <polygon points="230,400 290,385 300,420 240,430" fill="#BDB4A4"/>
      <polygon points="560,250 600,245 590,275 555,272" fill="#BDB4A4"/>
      <polyline points="250,455 285,420 305,425 335,388 365,378" stroke="#3E3A35" stroke-width="3" fill="none"/>
      <polyline points="500,255 522,288 516,318 545,350 540,372" stroke="#3E3A35" stroke-width="3" fill="none"/>
      <polyline points="620,440 596,418 604,396" stroke="#3E3A35" stroke-width="2.5" fill="none"/>
      <ellipse cx="400" cy="440" rx="120" ry="24" fill="#8FB3C8" fill-opacity="0.8"/>`
    : `<defs><linearGradient id="brillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.22"/><stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${azotea}" fill="url(#brillo)"/>
      <polygon points="${azotea}" fill="none" stroke="#E7B7A8" stroke-width="6" stroke-linejoin="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${cielo(W, H, antes ? "nublado" : "dia")}
    ${arbol(70, 190, 0.9)}${arbol(740, 195, 1)}${arbol(660, 185, 0.7, "#5E9A68")}
    <polygon points="0,${H} ${W},${H} ${W - 110},170 110,170" fill="#D6CFC2"/>
    <polygon points="${azotea}" fill="${antes ? "#9A948A" : "#C8553D"}"/>
    ${detalle}
    <circle cx="400" cy="452" r="14" fill="#4A4538"/>
    <polygon points="${azotea}" fill="none" stroke="#8C8577" stroke-width="3"/>
    <rect x="20" y="20" width="170" height="46" rx="23" fill="${antes ? "#4A4538" : "#2E7D32"}"/>
    <text x="105" y="51" text-anchor="middle" font-family="${FUENTE}" font-size="22" font-weight="bold" fill="#FFFFFF" letter-spacing="1">${antes ? "ANTES" : "DESPUÉS"}</text>
    ${marca(W, H)}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toBuffer();
}

/** Parte un texto en líneas de como mucho `max` caracteres, por palabras (SVG no parte solo). */
function partirEnLineas(texto, max) {
  const lineas = [];
  for (const palabra of texto.split(" ")) {
    const ultima = lineas[lineas.length - 1];
    if (ultima && `${ultima} ${palabra}`.length <= max) lineas[lineas.length - 1] = `${ultima} ${palabra}`;
    else lineas.push(palabra);
  }
  return lineas;
}

/** El dibujo de cada servicio del guion, centrado en (cx, cy). */
const ICONOS_DE_SERVICIO = {
  ingles: (cx, cy) => ["A", "B", "C"].map((l, i) => `<g transform="translate(${cx - 118 + i * 82} ${cy - 40 + (i % 2) * 20})">
      <rect width="72" height="72" rx="10" fill="${["#E53935", "#1565C0", "#F4A300"][i]}"/>
      <text x="36" y="52" text-anchor="middle" font-family="${FUENTE}" font-size="46" font-weight="bold" fill="#FFFFFF">${l}</text></g>`).join(""),
  reposteria: (cx, cy) => `<rect x="${cx - 90}" y="${cy + 10}" width="180" height="60" rx="8" fill="#F2C1C8"/>
    <rect x="${cx - 70}" y="${cy - 40}" width="140" height="54" rx="8" fill="#F7D9DE"/>
    <path d="M${cx - 90} ${cy + 24} q 22 16 45 0 t 45 0 t 45 0 t 45 0" stroke="#FFFFFF" stroke-width="6" fill="none"/>
    <rect x="${cx - 4}" y="${cy - 78}" width="8" height="38" fill="#8E24AA"/>
    <path d="M${cx} ${cy - 98} q 11 12 0 20 q -11 -8 0 -20" fill="#F4A300"/>`,
  costura: (cx, cy) => `<rect x="${cx - 76}" y="${cy - 62}" width="84" height="16" rx="4" fill="#8A6A45"/>
    <rect x="${cx - 66}" y="${cy - 46}" width="64" height="90" fill="#C2185B"/>
    ${[0, 1, 2, 3, 4].map((i) => `<line x1="${cx - 66}" y1="${cy - 36 + i * 18}" x2="${cx - 2}" y2="${cy - 31 + i * 18}" stroke="#9C1449" stroke-width="3"/>`).join("")}
    <rect x="${cx - 76}" y="${cy + 44}" width="84" height="16" rx="4" fill="#8A6A45"/>
    <line x1="${cx + 36}" y1="${cy + 62}" x2="${cx + 108}" y2="${cy - 72}" stroke="#6B737C" stroke-width="6" stroke-linecap="round"/>
    <path d="M${cx - 2} ${cy} C ${cx + 40} ${cy - 10}, ${cx + 60} ${cy + 40}, ${cx + 96} ${cy - 50}" stroke="#C2185B" stroke-width="3" fill="none"/>`,
  cerrajero: (cx, cy) => `<circle cx="${cx - 62}" cy="${cy}" r="44" fill="none" stroke="#C9A227" stroke-width="18"/>
    <rect x="${cx - 20}" y="${cy - 10}" width="140" height="20" rx="4" fill="#C9A227"/>
    <rect x="${cx + 70}" y="${cy + 10}" width="16" height="28" fill="#C9A227"/>
    <rect x="${cx + 100}" y="${cy + 10}" width="16" height="20" fill="#C9A227"/>`,
  gas: (cx, cy) => `<rect x="${cx - 120}" y="${cy - 36}" width="190" height="86" rx="43" fill="#E9ECEF" stroke="#8A9096" stroke-width="5"/>
    <rect x="${cx - 44}" y="${cy - 58}" width="40" height="24" rx="4" fill="#8A9096"/>
    <path d="M${cx + 118} ${cy + 44} q -34 -30 -6 -76 q 4 26 20 30 q 8 -20 0 -38 q 40 30 22 84 z" fill="#F4511E"/>
    <path d="M${cx + 126} ${cy + 40} q -14 -16 -2 -38 q 10 16 14 38 z" fill="#FFC107"/>`,
  "jardineria-particular": (cx, cy) => `${arbol(cx - 60, cy + 60, 1.1)}
    <rect x="${cx - 150}" y="${cy + 60}" width="300" height="16" fill="#7FAE6E"/>
    <g transform="translate(${cx + 70} ${cy + 10}) rotate(-30)">
      <rect x="-6" y="-72" width="12" height="62" rx="4" fill="#6B737C"/>
      <rect x="-18" y="-10" width="14" height="62" rx="6" fill="#C75D5D"/><rect x="4" y="-10" width="14" height="62" rx="6" fill="#C75D5D"/>
    </g>`,
};

/**
 * La portada de un servicio (B2): su dibujo y su título. JPEG de 800×450; la tarjeta del residente la
 * recorta con `object-cover` en una franja apaisada, así que todo lo importante va al centro.
 */
export async function portadaDeServicio({ clave, titulo, detalle, tercero }) {
  const icono = ICONOS_DE_SERVICIO[clave];
  if (!icono) throw new Error(`No hay portada para el servicio «${clave}» (hay: ${Object.keys(ICONOS_DE_SERVICIO).join(", ")}).`);
  const W = 800;
  const H = 450;
  const tinta = tercero ? "#1E3A56" : "#5B3A1E";
  const lineas = partirEnLineas(titulo, 19);
  const y0 = 225 - (lineas.length * 44) / 2 + 10;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${tercero ? "#E7F0F7" : "#FDF1E4"}"/>
    <circle cx="200" cy="225" r="150" fill="#FFFFFF" fill-opacity="0.75"/>
    ${icono(200, 225)}
    <rect x="390" y="${y0 - 76}" width="${tercero ? 260 : 190}" height="32" rx="16" fill="${tinta}" fill-opacity="0.12"/>
    <text x="406" y="${y0 - 54}" font-family="${FUENTE}" font-size="18" font-weight="bold" fill="${tinta}">${tercero ? "PROVEEDOR RECOMENDADO" : "DE UN VECINO"}</text>
    ${lineas.map((l, i) => `<text x="390" y="${y0 + i * 44}" font-family="${FUENTE}" font-size="34" font-weight="bold" fill="${tinta}">${esc(l)}</text>`).join("")}
    <text x="390" y="${y0 + lineas.length * 44 + 8}" font-family="${FUENTE}" font-size="24" fill="${tinta}" fill-opacity="0.8">${esc(detalle)}</text>
    ${marca(W, H)}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toBuffer();
}
