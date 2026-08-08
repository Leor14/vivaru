/**
 * Reconstruye desde la plataforma las capturas que usa la presentación
 * comercial (`Vivaru_Presentacion_Comercial_v2.pptx`).
 *
 * Las del PPTX están incrustadas a la resolución a la que las pegaron, sin
 * nombre útil (`image23.png`) y con los datos que hubiera ese día. Esto las
 * vuelve a sacar del producto vivo, a @2x, con nombre que dice qué es cada
 * una, para que la próxima versión del deck no dependa de buscar en el ZIP.
 *
 * Va contra STAGING con las cuentas de demo, así que no pide contraseñas a
 * nadie. Para sacarlas de producción existe `capturar-produccion-admin.mjs`,
 * que se detiene para que una persona escriba.
 *
 *   node scripts/capturar-assets-presentacion.mjs [carpeta-destino]
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

// El primer argumento que NO sea una bandera. Leer `argv[2]` a secas hacía que
// `--solo porteria` creara una carpeta llamada «--solo».
const DESTINO =
  process.argv.slice(2).find((a) => !a.startsWith("--") && !["admin", "residente", "porteria"].includes(a)) ??
  "/Users/david/Claude Coworker/Hogaru/Hogaru/Design/capturas-plataforma";

/**
 * `--produccion` cambia el origen Y la forma de entrar.
 *
 * Contra staging el guion escribe las credenciales de demo, que llevan meses
 * en el repositorio y no son secretas. Contra producción NO: el navegador se
 * abre a la vista, el guion se detiene y **la persona escribe**. El guion
 * nunca ve la contraseña, no la registra y no la guarda.
 */
const PRODUCCION = process.argv.includes("--produccion");
const BASE = PRODUCCION ? "https://www.grupovivaru.com" : "http://localhost:3000";
const ESPERA_LOGIN = 10 * 60 * 1000;

/**
 * Las cuentas son de siembra y viven en staging. No son secretos: el mismo
 * archivo de pruebas del repositorio las lleva desde hace meses.
 */
const CUENTAS = {
  admin: { correo: "admin@santamaria.co", clave: "Demo1234*" },
  residente: { correo: "residente@santamaria.co", clave: "Demo1234*" },
  // Santa María no tiene portería sembrada; El Nogal sí, y la interfaz es la
  // misma. Cambia el nombre del conjunto en la cabecera: si el deck necesita
  // coherencia de marca, hay que sembrar un guardia en Santa María.
  porteria: { correo: "guardia@elnogal.co", clave: "Demo1234*" },
};

/**
 * Cada entrada produce un archivo. El nombre lleva portal + pantalla, en ese
 * orden, para que el listado quede agrupado solo.
 *
 * `esperaExtra` sirve para las pantallas que hay que tocar antes de disparar
 * (abrir un modal, desplegar un detalle).
 */
const CAPTURAS = [
  // ── Administración ────────────────────────────────────────────────── 1440×900
  { rol: "admin", ruta: "/admin", archivo: "admin-01-panel-control.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/billing", archivo: "admin-02-cartera.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/residents", archivo: "admin-03-residentes-unidades.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/communications", archivo: "admin-04-comunicaciones.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/pqrs", archivo: "admin-05-pqrs.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/packages", archivo: "admin-06-paqueteria.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/visitors", archivo: "admin-07-visitantes.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/reservations", archivo: "admin-08-reservas.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/reports", archivo: "admin-09-reporte-comite.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/finanzas", archivo: "admin-10-libro-y-fondos.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/services", archivo: "admin-11-servicios.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/surveys", archivo: "admin-12-encuestas.png", w: 1440, h: 900 },
  { rol: "admin", ruta: "/admin/settings", archivo: "admin-13-ajustes-branding.png", w: 1440, h: 900 },

  // ── Portal del residente ──────────────────────────────────────────── 390×844
  { rol: "residente", ruta: "/resident", archivo: "residente-01-inicio.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/account", archivo: "residente-02-estado-de-cuenta.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/reservations", archivo: "residente-03-reservas.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/visitors", archivo: "residente-04-visitantes.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/packages", archivo: "residente-05-paquetes.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/pqrs", archivo: "residente-06-pqrs.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/services", archivo: "residente-07-servicios-comunitarios.png", w: 390, h: 844 },
  { rol: "residente", ruta: "/resident/documents", archivo: "residente-08-documentos.png", w: 390, h: 844 },

  { rol: "residente", ruta: "/resident/communications", archivo: "residente-09-comunicaciones.png", w: 390, h: 844 },
  // El deck enseña el formulario de invitación, no la lista vacía. Tiene ruta
  // propia, así que se entra por URL en vez de simular el clic: menos frágil.
  { rol: "residente", ruta: "/resident/visitors/new", archivo: "residente-10-crear-invitacion.png", w: 390, h: 844 },

  // ── Panel de portería ─────────────────────────────────────────────── 1024×768
  { rol: "porteria", ruta: "/guard", archivo: "porteria-01-panel-del-dia.png", w: 1024, h: 768 },
  { rol: "porteria", ruta: "/guard/visitors", archivo: "porteria-02-visitantes.png", w: 1024, h: 768 },
  { rol: "porteria", ruta: "/guard/reservations", archivo: "porteria-03-reservas.png", w: 1024, h: 768 },
  { rol: "porteria", ruta: "/guard/packages", archivo: "porteria-04-paquetes.png", w: 1024, h: 768 },
  { rol: "porteria", ruta: "/guard/packages/new", archivo: "porteria-05-registrar-paquete.png", w: 1024, h: 768 },
];

/** `--solo <rol>` rehace un portal sin repetir los otros. */
const SOLO = (() => {
  const i = process.argv.indexOf("--solo");
  return i !== -1 ? process.argv[i + 1] : null;
})();

const caidas = [];
const hechas = [];

/**
 * Espera a que la pantalla tenga datos.
 *
 * `networkidle` NO se cumple nunca en este producto: los escuchas en tiempo
 * real de Firestore mantienen la red ocupada. La señal buena es la del propio
 * producto — mientras carga pinta esqueletos con `animate-pulse`.
 */
async function esperarContenido(page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, {
      timeout: 15_000,
    })
    .catch(() => {});
  await page.waitForTimeout(1000);
}

async function entrar(page, cuenta, rol) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

  if (PRODUCCION) {
    console.log(
      `\n${"─".repeat(64)}\n` +
        `TE TOCA: entra como ${rol.toUpperCase()} en la ventana de Chromium.\n` +
        `Escribe correo y contraseña y pulsa «Ingresar».\n\n` +
        `Sigo solo en cuanto vea que la URL deja de ser /login.\n` +
        `No escribo ni leo las claves.\n${"─".repeat(64)}\n`
    );
    for (let t = 0; t < ESPERA_LOGIN; t += 500) {
      if (!new URL(page.url()).pathname.startsWith("/login")) break;
      await page.waitForTimeout(500);
    }
    if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("no se inició sesión");
    await page.waitForTimeout(1500);
    console.log(`  ✓ sesión iniciada como ${rol}`);
    return;
  }

  await page.fill("#email", cuenta.correo);
  await page.fill("#password", cuenta.clave);
  await page.getByRole("button", { name: /Ingresar/i }).click();
  // Sondeo de la URL en vez de `waitForURL`.
  //
  // `waitForURL` espera por defecto al evento `load`, y tras entrar la
  // redirección al portal la hace el router del cliente: no hay `load` que
  // esperar. Con admin y residente colaba por casualidad; con portería se
  // quedaba colgado los 30 s aunque la sesión hubiera arrancado bien.
  const limite = 30_000;
  const inicio = await page.evaluate(() => performance.now());
  for (;;) {
    if (!new URL(page.url()).pathname.startsWith("/login")) break;
    const transcurrido = (await page.evaluate(() => performance.now())) - inicio;
    if (transcurrido > limite) throw new Error(`no salió de /login como ${cuenta.correo}`);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
}

fs.mkdirSync(DESTINO, { recursive: true });

// A la vista cuando hay que escribir; sin ventana cuando no hace falta.
const navegador = await chromium.launch({ headless: !PRODUCCION, slowMo: PRODUCCION ? 30 : 0 });

try {
  for (const rol of ["admin", "residente", "porteria"]) {
    if (SOLO && rol !== SOLO) continue;
    const lista = CAPTURAS.filter((c) => c.rol === rol);
    if (!lista.length) continue;

    const contexto = await navegador.newContext({
      viewport: { width: lista[0].w, height: lista[0].h },
      deviceScaleFactor: 2,
      locale: "es-CO",
    });
    const page = await contexto.newPage();

    console.log(`\n── ${rol} ──`);
    await entrar(page, CUENTAS[rol], rol);

    for (const c of lista) {
      await page.setViewportSize({ width: c.w, height: c.h });
      await page.goto(`${BASE}${c.ruta}`, { waitUntil: "load" });
      await esperarContenido(page);

      if (await page.getByText(/Algo salió mal/i).count()) {
        caidas.push(`${c.ruta} → ${c.archivo}`);
        console.warn(`  ⚠ ${c.ruta} está caída; NO guardo ${c.archivo}`);
        continue;
      }

      if (c.antes) await c.antes(page);

      // La banda «AMBIENTE DE PRUEBAS» no puede salir en material comercial.
      // Se tapa desde aquí y no con un parámetro de URL: una URL capaz de
      // esconder ese aviso es justo lo que no debe existir en el producto.
      await page.addStyleTag({
        content: "[data-env-banner],nextjs-portal{display:none !important}",
      });
      // El ratón abre tooltips de recharts si se queda sobre una barra.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);

      fs.writeFileSync(path.join(DESTINO, c.archivo), await page.screenshot());
      hechas.push(c.archivo);
      console.log(`  ✓ ${c.archivo}`);
    }

    await contexto.close();
  }
} finally {
  await navegador.close();
}

console.log(`\n${hechas.length} capturas en ${DESTINO}`);
if (caidas.length) console.log(`rutas caídas:\n  ${caidas.join("\n  ")}`);
