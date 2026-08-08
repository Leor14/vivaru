/**
 * Rellena por la INTERFAZ los cuatro huecos que dejan capturas vacías en el
 * deck comercial: servicios comunitarios, documentos y autorizaciones de visita.
 *
 * ⚠️ ESTO ESCRIBE EN PRODUCCIÓN. Se ejecuta solo cuando alguien lo pide.
 *
 * Va por los formularios del producto y NO por `seedTenantOperationalData`.
 * Esa función usa identificadores fijos, escribe con `set` en vez de `merge`,
 * crea únicamente tres unidades y **sobrescribe `tenantSettings`** — o sea, el
 * nombre, el logo y los colores del conjunto. Contra un conjunto real rompe
 * más de lo que arregla.
 *
 * Todo lo que crea es ficticio y reconocible: proveedores inventados, teléfonos
 * de ejemplo y visitantes con nombres que no corresponden a nadie. No se usa
 * ningún dato de contacto real.
 *
 *   node scripts/sembrar-huecos-presentacion.mjs
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const DESTINO = "/Users/david/Claude Coworker/Hogaru/Hogaru/Design/capturas-plataforma";
const BASE = "https://www.grupovivaru.com";
const ESPERA_LOGIN = 10 * 60 * 1000;

const SERVICIOS = [
  {
    titulo: "Plomería y destape 24 horas",
    tipo: "Plomería",
    proveedor: "Hidráulica del Valle S.A.S.",
    contacto: "3000000001",
    descripcion:
      "Atención de fugas, destapes y reparación de redes internas. Cobertura las 24 horas para urgencias del conjunto.",
    clase: "third_party",
  },
  {
    titulo: "Clases de yoga en la terraza",
    tipo: "Bienestar",
    proveedor: "Ana Sofía Romero",
    contacto: "3000000002",
    descripcion:
      "Sesiones de yoga los martes y jueves a las 7:00 a. m. en la terraza. Cupo limitado a 12 personas.",
    clase: "resident_offer",
  },
  {
    titulo: "Lavandería a domicilio",
    tipo: "Hogar",
    proveedor: "Lavaseco Nogal Express",
    contacto: "3000000003",
    descripcion:
      "Recogida y entrega en portería el mismo día. Tarifa preferencial para residentes del conjunto.",
    clase: "third_party",
  },
  {
    titulo: "Cuidado de mascotas y paseos",
    tipo: "Mascotas",
    proveedor: "Valentina Cruz Díaz",
    contacto: "3000000004",
    descripcion:
      "Paseos diarios y cuidado en casa durante viajes. Residente de la torre 1 con referencias del conjunto.",
    clase: "resident_offer",
  },
];

const VISITAS = [
  { nombre: "Camila", apellido: "Restrepo Ortiz", documento: "1010203040", razon: "Visita familiar" },
  { nombre: "Andrés", apellido: "Villamil Soto", documento: "1020304050", razon: "Entrega de domicilio" },
];

/**
 * PDF mínimo pero válido, escrito a mano.
 *
 * No hay librería de PDF en el proyecto y no merece añadir una para dos
 * archivos de ejemplo. La tabla `xref` se calcula con los desplazamientos
 * reales: un PDF con offsets inventados lo rechazan los visores.
 */
function pdfSimple(titulo, lineas) {
  const contenido =
    `BT /F1 20 Tf 60 780 Td (${titulo}) Tj ET\n` +
    lineas
      .map((l, i) => `BT /F1 11 Tf 60 ${740 - i * 20} Td (${l.replace(/[()\\]/g, "")}) Tj ET`)
      .join("\n");

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

async function esperarContenido(page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

async function entrarAMano(page, quien) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    `TE TOCA: entra como ${quien}.\n` +
      `Escribe correo y contraseña en la ventana de Chromium.\n\n` +
      `Sigo solo cuando la URL deje de ser /login. No escribo ni leo las claves.`
  );
  for (let t = 0; t < ESPERA_LOGIN; t += 500) {
    if (!new URL(page.url()).pathname.startsWith("/login")) break;
    await page.waitForTimeout(500);
  }
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("no se inició sesión");
  await page.waitForTimeout(1500);
  console.log(`✓ sesión iniciada (${quien})\n`);
}

async function foto(page, archivo) {
  await page.addStyleTag({ content: "[data-env-banner],nextjs-portal{display:none !important}" });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  fs.writeFileSync(path.join(DESTINO, archivo), await page.screenshot());
  console.log(`  ✓ ${archivo}`);
}

const navegador = await chromium.launch({ headless: false, slowMo: 60 });

try {
  // ══ Sesión 1 · administración ═══════════════════════════════════════════
  const ctxAdmin = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "es-CO",
  });
  const admin = await ctxAdmin.newPage();
  await entrarAMano(admin, "ADMINISTRADOR de Las Playas");

  // ── Servicios comunitarios ────────────────────────────────────────────
  console.log("→ creando servicios comunitarios");
  for (const s of SERVICIOS) {
    await admin.goto(`${BASE}/admin/services`, { waitUntil: "load" });
    await esperarContenido(admin);
    await admin.getByRole("button", { name: "Agregar servicio" }).first().click();
    await admin.waitForTimeout(1200);

    await admin.getByPlaceholder("Servicio de plomeria").fill(s.titulo);
    await admin.getByPlaceholder("Describe el servicio disponible para la comunidad").fill(s.descripcion);
    await admin.getByPlaceholder("Plomeria, electricidad, jardineria...").fill(s.tipo);
    await admin.getByPlaceholder("Juan Perez o Empresa S.A.S.").fill(s.proveedor);
    await admin.getByPlaceholder("3001234567 o correo@ejemplo.com").fill(s.contacto);
    await admin.selectOption('select:below(:text("Tipo de servicio"))', s.clase).catch(() => {});

    await admin.getByRole("button", { name: /^Guardar/ }).last().click();
    await admin.waitForTimeout(2500);
    console.log(`  + ${s.titulo}`);
  }

  // ── Documentos ────────────────────────────────────────────────────────
  console.log("→ subiendo documentos");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vivaru-docs-"));
  const docs = [
    {
      archivo: path.join(tmp, "Reglamento-interno-de-convivencia.pdf"),
      titulo: "Reglamento interno de convivencia",
      cuerpo: [
        "Documento de ejemplo del conjunto.",
        "Capitulo 1 - Uso de zonas comunes.",
        "Capitulo 2 - Horarios de silencio.",
        "Capitulo 3 - Mascotas y areas verdes.",
      ],
    },
    {
      archivo: path.join(tmp, "Acta-asamblea-ordinaria-junio-2026.pdf"),
      titulo: "Acta de asamblea ordinaria - junio 2026",
      cuerpo: [
        "Documento de ejemplo del conjunto.",
        "1. Aprobacion del presupuesto anual.",
        "2. Eleccion del consejo de administracion.",
        "3. Proyecto de mantenimiento de fachada.",
      ],
    },
  ];
  for (const d of docs) {
    fs.writeFileSync(d.archivo, pdfSimple(d.titulo, d.cuerpo));
    await admin.goto(`${BASE}/admin/documents`, { waitUntil: "load" });
    await esperarContenido(admin);
    // «Subir documento» NO es un botón: es el título de un formulario que ya
    // está en pantalla. El campo de archivo es #tenant-document-file y la
    // descripción es el input con placeholder «Acta consejo marzo 2026».
    await admin.setInputFiles("#tenant-document-file", d.archivo);
    await admin.waitForTimeout(1200);
    await admin.getByPlaceholder("Acta consejo marzo 2026").fill(d.titulo);
    await admin.locator('form button[type="submit"]').first().click();
    await admin.waitForTimeout(4000);
    console.log(`  + ${d.titulo}`);
  }

  // ── Autorizaciones de visita ──────────────────────────────────────────
  console.log("→ creando autorizaciones de visita");
  for (const v of VISITAS) {
    await admin.goto(`${BASE}/admin/visitors`, { waitUntil: "load" });
    await esperarContenido(admin);
    await admin.getByRole("button", { name: "Crear autorización" }).first().click();
    await admin.waitForTimeout(1500);
    for (const [etiqueta, valor] of [
      [/Nombre/i, v.nombre],
      [/Apellido/i, v.apellido],
      [/Documento|Identificaci/i, v.documento],
      [/Raz[oó]n|observaciones/i, v.razon],
    ]) {
      const campo = admin.getByLabel(etiqueta).first();
      if (await campo.count()) await campo.fill(valor).catch(() => {});
    }
    // La unidad es un desplegable: se elige la primera disponible.
    const sel = admin.locator("select").first();
    if (await sel.count()) {
      const ops = await sel.locator("option").allTextContents();
      const idx = ops.findIndex((o) => /T\d-\d{3}/.test(o));
      if (idx >= 0) await sel.selectOption({ index: idx }).catch(() => {});
    }
    await admin.getByRole("button", { name: /^Crear|^Guardar|^Autorizar/i }).last().click();
    await admin.waitForTimeout(3000);
    console.log(`  + ${v.nombre} ${v.apellido}`);
  }

  // ── Recapturas de administración ──────────────────────────────────────
  for (const [ruta, archivo] of [
    ["/admin/services", "admin-11-servicios.png"],
    ["/admin/visitors", "admin-07-visitantes.png"],
  ]) {
    await admin.goto(`${BASE}${ruta}`, { waitUntil: "load" });
    await esperarContenido(admin);
    await foto(admin, archivo);
  }
  await ctxAdmin.close();

  // ══ Sesión 2 · residente ════════════════════════════════════════════════
  const ctxRes = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "es-CO",
  });
  const res = await ctxRes.newPage();
  await entrarAMano(res, "RESIDENTE de T1-101");

  for (const [ruta, archivo] of [
    ["/resident/services", "residente-07-servicios-comunitarios.png"],
    ["/resident/documents", "residente-08-documentos.png"],
    ["/resident/visitors", "residente-04-visitantes.png"],
  ]) {
    await res.goto(`${BASE}${ruta}`, { waitUntil: "load" });
    await esperarContenido(res);
    await foto(res, archivo);
  }
  await ctxRes.close();
} finally {
  await navegador.close();
}

console.log("\nlisto");
