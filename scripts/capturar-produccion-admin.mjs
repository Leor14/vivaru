/**
 * Recorrido y capturas de administración, desde PRODUCCIÓN, con un solo login.
 *
 * Hermano de `capturar-produccion.mjs`, mismo trato con las credenciales: el
 * navegador se abre a la vista, el guion se detiene, **la persona escribe**, y
 * sigue en cuanto ve que la URL dejó de ser /login. Nunca ve la contraseña.
 *
 * Produce:
 *   multiconjunto-recorrido.webm   el paseo por cinco módulos
 *   multiconjunto-marca-b.png      el póster del vídeo (panel de control)
 *   trust-migracion.png            residentes y unidades
 *   trust-respaldos.png            libro y fondos (el registro auditable)
 *   trust-soporte.png              el formulario de soporte
 *
 * Para rehacer una sola captura sin volver a grabar:
 *   node scripts/capturar-produccion-admin.mjs --solo-fijas --solo respaldos
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

/**
 * El paseo. `pausa` es el tiempo QUE SE VE la pantalla ya cargada, no el tiempo
 * total de la parada: la carga se espera aparte.
 *
 * La primera versión usaba una espera fija por parada, y el mosaico de
 * fotogramas lo delató: a los 8,8 s cartera salía con «$0 / $0 / 0.0 %» y «no
 * hay datos suficientes» porque la foto cayó antes de que llegaran los datos, y
 * comunicaciones se quedó fuera del vídeo porque el retraso acumulado se comió
 * su turno. Ahora se espera a que no quede ni un esqueleto en pantalla.
 */
/**
 * Se navega por `href` y no por el texto del enlace.
 *
 * Por nombre exacto, «PQRS» no aparecía: el menú le pinta al lado la chapa con
 * el contador, así que su nombre accesible es «PQRS 7» y la coincidencia
 * fallaba en silencio. Lo mismo le pasaría a Paquetería. El `href` no lleva
 * chapa.
 *
 * PQRS queda FUERA del recorrido a propósito, no por el selector: su listado
 * son ocho filas con la etiqueta roja «Vencido», y una pared de vencidos no es
 * lo que se enseña para vender. El resto del paseo ya demuestra que hay
 * sistema.
 */
const RECORRIDO = [
  { href: "/admin", nombre: "panel de control", pausa: 2400 },
  { href: "/admin/residents", nombre: "residentes y unidades", pausa: 2400 },
  { href: "/admin/billing", nombre: "cartera", pausa: 2800 },
  { href: "/admin/reservations", nombre: "reservas", pausa: 2400 },
  { href: "/admin/communications", nombre: "comunicaciones", pausa: 2600 },
];

/** `--solo-fijas` salta la grabación; `--solo <parte>` filtra las capturas. */
const SOLO_FIJAS = process.argv.includes("--solo-fijas");
const SOLO = (() => {
  const i = process.argv.indexOf("--solo");
  return i !== -1 ? process.argv[i + 1] : null;
})();

/**
 * Espera a que la pantalla esté REALMENTE lista.
 *
 * `networkidle` no sirve —los escuchas de Firestore no dejan la red quieta— y
 * un `waitForTimeout` fijo es justo lo que produjo la captura vacía de cartera.
 * La señal buena es la del propio producto: mientras carga pinta esqueletos con
 * `animate-pulse`. Cuando no queda ninguno, hay datos.
 */
async function esperarContenido(page, techo = 15_000) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, {
      timeout: techo,
    })
    .catch(() => console.warn("   ⚠ seguían saliendo esqueletos al agotar la espera"));
  // Un respiro para que recharts termine de dibujar sus barras.
  await page.waitForTimeout(900);
}

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

  if (!SOLO_FIJAS) {
  console.log("→ grabando el recorrido…");

  // Se entra UNA vez por URL; a partir de ahí se navega HACIENDO CLIC en el
  // menú lateral, no con `goto`.
  //
  // No es un capricho: `goto` recarga la página entera, y en el vídeo eso son
  // fotogramas en blanco entre módulo y módulo —se veían a los 0,5 s y a los
  // 8,6 s del intento anterior—. Pulsando el menú, la navegación es del lado
  // del cliente: el armazón no se vuelve a montar y el paso es continuo, que es
  // justo lo que este bloque tiene que demostrar.
  await paginaVideo.goto(`${BASE}/admin`, { waitUntil: "load" });
  await esperarContenido(paginaVideo);

  for (const parada of RECORRIDO) {
    const enlace = paginaVideo.locator(`a[href="${parada.href}"]`).first();
    if (await enlace.count()) {
      await enlace.click();
      await esperarContenido(paginaVideo);
    } else {
      console.warn(`   ⚠ no encontré en el menú un enlace a ${parada.href}`);
      continue;
    }
    const caida = await paginaVideo
      .getByText(/Algo salió mal/i)
      .count()
      .then((n) => n > 0);
    if (caida) rutasCaidas.push(parada.href);
    console.log(`   ${parada.nombre}${caida ? "  ⚠ RUTA CAÍDA" : ""}`);
    await paginaVideo.mouse.move(0, 0);
    await paginaVideo.waitForTimeout(parada.pausa);
  }

  const video = paginaVideo.video();
  // Cerrar SOLO esta página vuelca el vídeo; el contexto sigue vivo porque
  // `paginaLogin` sigue abierta.
  await paginaVideo.close();
  if (video) {
    const destino = path.join(SALIDA, "multiconjunto-recorrido.webm");
    // `saveAs` y NO `copyFileSync(await video.path())`. Copiar a pelo es una
    // carrera contra el codificador: el intento anterior perdió las dos últimas
    // paradas —PQRS y comunicaciones— porque el archivo se copió antes de que
    // terminara de escribirse. `saveAs` espera a que esté cerrado.
    await video.saveAs(destino);
    const kb = Math.round(fs.statSync(destino).size / 1024);
    console.log(`✓  multiconjunto-recorrido.webm  (${kb} KB)\n`);
  }
  }

  // ── Capturas fijas, en la página que ya tenía sesión ───────────────────────
  async function foto(ruta, archivo, ancho, alto, antesDeDisparar) {
    if (SOLO && !archivo.includes(SOLO)) return;
    await paginaLogin.setViewportSize({ width: ancho, height: alto });
    await paginaLogin.goto(`${BASE}${ruta}`, { waitUntil: "load" });
    await esperarContenido(paginaLogin);
    if (await paginaLogin.getByText(/Algo salió mal/i).count()) {
      rutasCaidas.push(ruta);
      console.warn(`⚠  ${ruta} está caída: NO guardo ${archivo}`);
      return;
    }
    if (antesDeDisparar) await antesDeDisparar();
    await paginaLogin.mouse.move(0, 0);
    await paginaLogin.waitForTimeout(400);
    fs.writeFileSync(path.join(SALIDA, archivo), await paginaLogin.screenshot());
    console.log(`✓  ${archivo}`);
  }

  // Póster del vídeo: el mismo panel con la marca del conjunto.
  await foto("/admin", "multiconjunto-marca-b.png", 1200, 900);

  // Migración: la tabla de unidades, con los botones de carga por CSV.
  await foto("/admin/residents", "trust-migracion.png", 1280, 720);

  // Auditoría: va a FINANZAS, no a ajustes.
  //
  // Estuvo apuntando a `/admin/settings`, que enseña «Branding del edificio» y
  // selectores de color mientras la tarjeta promete «registro auditable de las
  // operaciones sensibles». El libro contable sí lo es: sus asientos no se
  // borran nunca —una anulación crea un asiento inverso y el original queda
  // visible— justo «para conservar la trazabilidad ante auditorías», como dice
  // el propio producto en `admin/finanzas/page.tsx`.
  //
  // Y se BAJA hasta el libro antes de disparar. Arriba del todo, esta pantalla
  // abre con una alerta roja de «Fondo insuficiente» y el saldo en negativo, que
  // es cierto en este conjunto de siembra y pésimo en una tarjeta que habla de
  // información protegida. Los asientos —fecha, concepto, monto y la marca de
  // «Automático»— son la prueba, y viven más abajo.
  await foto("/admin/finanzas", "trust-respaldos.png", 1280, 720, async () => {
    // Rueda de ratón de verdad, y NO `window.scrollBy` ni
    // `scrollIntoViewIfNeeded`. El primero no mueve nada porque quien desplaza
    // aquí es un contenedor interno, no la ventana; el segundo tampoco, porque
    // el ancla ya estaba a la vista y se dio por satisfecho. Un evento de rueda
    // lo recibe el elemento que esté bajo el cursor, sea cual sea.
    await paginaLogin.mouse.move(800, 400);
    await paginaLogin.mouse.wheel(0, 620);
    await paginaLogin.waitForTimeout(1200);
  });

  // Soporte: con el formulario abierto, no con la lista.
  //
  // La lista enseñaba una solicitud real titulada «Problema con el login de
  // residentes». En una página que tres tarjetas más allá promete «Acceso
  // seguro por enlace», eso es un autogol. El formulario dice lo mismo —hay un
  // canal directo— sin poner una queja de ejemplo en el escaparate.
  await foto("/admin/soporte", "trust-soporte.png", 1280, 720, async () => {
    const nueva = paginaLogin.getByRole("button", { name: /Nueva solicitud/i }).first();
    if (await nueva.count()) {
      await nueva.click();
      await paginaLogin.waitForTimeout(1500);
    } else {
      console.warn("⚠  no encontré «Nueva solicitud»; queda la lista");
    }
  });

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
