/**
 * Recorrido y capturas de administración, desde PRODUCCIÓN, con un solo login.
 *
 * Hermano de `capturar-produccion.mjs`, mismo trato con las credenciales: el
 * navegador se abre a la vista, el guion se detiene, **la persona escribe**, y
 * sigue en cuanto ve que la URL dejó de ser /login. Nunca ve la contraseña.
 *
 * Produce:
 *   multiconjunto-recorrido.webm   el paseo por seis módulos
 *   multiconjunto-marca-b.png      el póster del vídeo (panel de control)
 *   trust-migracion.png            residentes y unidades
 *   trust-respaldos.png            ajustes / auditoría
 *   trust-soporte.png              soporte dentro del producto
 *
 * Dos cosas que costaron sangre la primera vez y por eso están así:
 *
 *  - **Dos páginas del MISMO contexto.** La sesión de Firebase vive en
 *    IndexedDB. Aquí además el login lo hace una persona a mano, así que si se
 *    grabara esa misma página el vídeo empezaría por la pantalla de acceso.
 *    Playwright graba un vídeo POR PÁGINA: la 1 es para entrar (su vídeo se
 *    tira) y la 2 es la que se publica.
 *  - **La página 1 no se cierra** hasta el final: un contexto que graba se da
 *    por terminado cuando se queda sin páginas.
 *
 * Y una tercera: `waitForLoadState("networkidle")` NUNCA se cumple en este
 * producto, porque los escuchas en tiempo real de Firestore mantienen la red
 * ocupada. Se usa "load" y una espera fija.
 *
 *   node scripts/capturar-produccion-admin.mjs
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, "public", "product");
const TEMPORAL = path.join(RAIZ, ".videos-produccion");
const BASE = "https://www.grupovivaru.com";
const ESPERA_LOGIN = 10 * 60 * 1000;

const ANCHO = 1280;
const ALTO = 800;

/** El paseo. Cada parada se queda en pantalla `pausa` milisegundos. */
const RECORRIDO = [
  { ruta: "/admin", nombre: "panel de control", pausa: 2600 },
  { ruta: "/admin/residents", nombre: "residentes y unidades", pausa: 2600 },
  { ruta: "/admin/billing", nombre: "cartera", pausa: 3000 },
  { ruta: "/admin/reservations", nombre: "reservas", pausa: 2600 },
  { ruta: "/admin/pqrs", nombre: "PQRS", pausa: 2400 },
  { ruta: "/admin/communications", nombre: "comunicaciones", pausa: 2600 },
];

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

fs.mkdirSync(TEMPORAL, { recursive: true });

const navegador = await chromium.launch({ headless: false, slowMo: 30 });
const contexto = await navegador.newContext({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: 2,
  locale: "es-CO",
  recordVideo: { dir: TEMPORAL, size: { width: ANCHO, height: ALTO } },
});

// Si alguna ruta se cae, quiero saberlo aquí y no descubrirlo mirando el vídeo.
const rutasCaidas = [];

const paginaLogin = await contexto.newPage();

try {
  await paginaLogin.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    `TE TOCA: entra como ADMINISTRADOR de Las Playas.\n` +
      `Escribe correo y contraseña en la ventana de Chromium y pulsa «Ingresar».\n\n` +
      `Sigo solo en cuanto vea la sesión. No escribo ni leo las claves.`
  );
  await paginaLogin.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: ESPERA_LOGIN,
  });
  console.log("✓  sesión iniciada\n");

  // ── El recorrido, en una página nueva del mismo contexto ───────────────────
  const paginaVideo = await contexto.newPage();

  console.log("→ grabando el recorrido…");
  for (const parada of RECORRIDO) {
    await paginaVideo.goto(`${BASE}${parada.ruta}`, { waitUntil: "load" });
    await paginaVideo.waitForTimeout(1200);
    const caida = await paginaVideo
      .getByText(/Algo salió mal/i)
      .count()
      .then((n) => n > 0);
    if (caida) rutasCaidas.push(parada.ruta);
    console.log(`   ${parada.nombre}${caida ? "  ⚠ RUTA CAÍDA" : ""}`);
    await paginaVideo.mouse.move(0, 0);
    await paginaVideo.waitForTimeout(parada.pausa);
  }

  const video = paginaVideo.video();
  // Cerrar SOLO esta página vuelca el vídeo a disco; el contexto sigue vivo
  // porque `paginaLogin` sigue abierta.
  await paginaVideo.close();
  if (video) {
    const destino = path.join(SALIDA, "multiconjunto-recorrido.webm");
    fs.copyFileSync(await video.path(), destino);
    const kb = Math.round(fs.statSync(destino).size / 1024);
    console.log(`✓  multiconjunto-recorrido.webm  (${kb} KB)\n`);
  }

  // ── Capturas fijas, en la página que ya tenía sesión ───────────────────────
  async function foto(ruta, archivo, ancho, alto) {
    await paginaLogin.setViewportSize({ width: ancho, height: alto });
    await paginaLogin.goto(`${BASE}${ruta}`, { waitUntil: "load" });
    await paginaLogin.waitForTimeout(3500);
    if (await paginaLogin.getByText(/Algo salió mal/i).count()) {
      rutasCaidas.push(ruta);
      console.warn(`⚠  ${ruta} está caída: NO guardo ${archivo}`);
      return;
    }
    await paginaLogin.mouse.move(0, 0);
    await paginaLogin.waitForTimeout(400);
    fs.writeFileSync(path.join(SALIDA, archivo), await paginaLogin.screenshot());
    console.log(`✓  ${archivo}`);
  }

  // Póster del vídeo: el mismo panel con la marca del conjunto.
  await foto("/admin", "multiconjunto-marca-b.png", 1200, 900);

  // Las tres de «Empieza sin fricción», 16:9.
  await foto("/admin/residents", "trust-migracion.png", 1280, 720);
  await foto("/admin/settings", "trust-respaldos.png", 1280, 720);
  await foto("/admin/soporte", "trust-soporte.png", 1280, 720);

  if (rutasCaidas.length) {
    aviso(`OJO — rutas caídas en producción:\n  ${[...new Set(rutasCaidas)].join("\n  ")}`);
  }
  aviso("Listo. Ahora: node scripts/optimize-product-images.mjs");
} finally {
  await paginaLogin.close().catch(() => {});
  await contexto.close();
  await navegador.close();
  // Los .webm sueltos de la página de login no pintan nada en el repo.
  fs.rmSync(TEMPORAL, { recursive: true, force: true });
}
