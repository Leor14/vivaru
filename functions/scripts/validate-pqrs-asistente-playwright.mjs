import { chromium } from "playwright";

/**
 * Ensayo a ciegas del asistente de PQRS — Fase 3 de `PRD-VAI-FEAT-002`.
 *
 * **Existe para que el día de la sesión no se descubra nada.** Las dos sesiones
 * anteriores del programa gastaron el tiempo de un administrador en problemas de
 * ambiente, y una de ellas se quemó a la persona antes de tomarle la línea base.
 * Esto recorre el circuito entero con manos de máquina primero.
 *
 * Comprueba las dos variantes, porque son dos contratos distintos:
 *
 * - `con_sla`: el panel propone, la clasificación se puede aceptar y corregir, y
 *   el borrador se copia al cuadro de respuesta.
 * - `buzon_simple`: **la puerta dura de la PRD**, vista en pantalla y no solo en
 *   el evaluador — ahí el servidor devuelve nulls y no debe aparecer ninguna
 *   clasificación.
 *
 * USO:
 *   node functions/scripts/validate-pqrs-asistente-playwright.mjs
 *
 * Las credenciales son las cuentas demo sembradas por `seed-data-co.mjs` y
 * `seed-demo-users.mjs`, y salen de variables de entorno para no fijarlas aquí.
 */

const baseUrl =
  process.env.VALIDATION_BASE_URL || "https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app";

const conSla = {
  etiqueta: "con_sla · tenant-nogal-bogota",
  email: process.env.VALIDATION_ADMIN_EMAIL || "admin@elnogal.co",
  password: process.env.VALIDATION_ADMIN_PASSWORD || "Demo1234*",
};

const buzon = {
  etiqueta: "buzon_simple · tenant-santa-maria",
  email: process.env.VALIDATION_BUZON_EMAIL || "admin@santamaria.co",
  password: process.env.VALIDATION_BUZON_PASSWORD || "Demo1234*",
};

/** El modelo tarda segundos; el resto de la pantalla, milisegundos. */
const ESPERA_MODELO = 45_000;

async function entrar(page, cuenta) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", cuenta.email);
  await page.fill("#password", cuenta.password);
  await page.getByRole("button", { name: /Ingresar/i }).click();
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 30_000 });
}

async function abrirPrimerTicket(page) {
  // `domcontentloaded` y NO `networkidle`: esta pantalla escucha Firestore con
  // `onSnapshot`, así que la conexión no se cierra nunca y `networkidle` no
  // llega jamás. Se espera al elemento, que es lo que de verdad importa.
  await page.goto(`${baseUrl}/admin/pqrs`, { waitUntil: "domcontentloaded" });
  const botones = page.getByRole("button", { name: "Ver detalle" });
  await botones.first().waitFor({ timeout: 30_000 });
  const total = await botones.count();
  await botones.first().click();

  // **Esperar al drawer antes de leer nada.** Sin esto hay una carrera con su
  // animación de entrada: dos corridas seguidas dieron `botonPresente` true y
  // luego false sin que cambiara ni una línea de la aplicación. Un validador
  // que da resultados distintos sobre lo mismo no vale para decidir nada.
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByRole("button", { name: /Analizar con IA/i }).waitFor({ timeout: 15_000 });
  return total;
}

/**
 * Comparación **sin distinguir mayúsculas**, y no por comodidad.
 *
 * Los rótulos de la pantalla llevan `uppercase` en CSS, e `innerText` devuelve
 * el texto RENDERIZADO: «BORRADOR DE RESPUESTA», no «Borrador de respuesta». La
 * primera versión de este archivo comparaba tal cual y daba por ausentes tres
 * bloques que estaban delante — se notó porque encontraba «44 de 152», que va
 * dentro del mismo bloque en texto normal, y no encontraba su título.
 */
function vistoEn(texto, aguja) {
  return texto.toLocaleLowerCase().includes(aguja.toLocaleLowerCase());
}

async function revisarConSla(page, informe) {
  await entrar(page, conSla);
  const tickets = await abrirPrimerTicket(page);
  informe.conSla = { ticketsVisibles: tickets };

  const cuerpo = () => page.locator("body").innerText();

  // El editor de clasificación: el prerrequisito que se cerró al construir esto.
  const antes = await cuerpo();
  informe.conSla.editorPresente =
    vistoEn(antes, "Clasificación") && vistoEn(antes, "Guardar clasificación");

  // El panel nace PLEGADO: si al abrir el drawer ya se ve una propuesta, alguien
  // llamó al modelo en render y eso la PRD lo prohíbe.
  informe.conSla.panelPlegado = !vistoEn(antes, "Propuesta de la IA");
  informe.conSla.botonPresente = vistoEn(antes, "Analizar con IA");

  await page.getByRole("button", { name: /Analizar con IA/i }).click();
  const abierto = await cuerpo();
  informe.conSla.noAnalizaAlAbrir = !vistoEn(abierto, "Propuesta de la IA");

  await page.getByRole("button", { name: /Analizar este ticket/i }).click();
  await page.getByText("Propuesta de la IA").waitFor({ timeout: ESPERA_MODELO });
  const conPropuesta = await cuerpo();

  informe.conSla.resumen = vistoEn(conPropuesta, "Resumen");
  informe.conSla.clasificacionPropuesta = vistoEn(conPropuesta, "Clasificación propuesta");
  informe.conSla.borrador = vistoEn(conPropuesta, "Borrador de respuesta");
  informe.conSla.avisoDelBorrador = vistoEn(conPropuesta, "44 de 152");

  // Aceptar la clasificación RELLENA los selectores; no guarda.
  //
  // El selector se busca DENTRO del drawer. La primera versión usaba
  // `page.locator("select").first()`, que es el filtro de tipo de la lista de
  // atrás: devolvía «all» antes y después y no medía nada — un check que pasa
  // siempre porque mira el elemento equivocado.
  const drawer = page.getByRole("dialog");
  const selCategoria = drawer.getByLabel("Categoría");
  const categoriaAntes = await selCategoria.inputValue();
  await page.getByRole("button", { name: /Usar esta clasificación/i }).click();
  await page.getByText("Se copió a los selectores").waitFor({ timeout: 5_000 });
  informe.conSla.clasificacionSeAplica = true;
  informe.conSla.categoriaAntes = categoriaAntes;
  informe.conSla.categoriaDespues = await selCategoria.inputValue();
  informe.conSla.prioridadDespues = await drawer.getByLabel("Prioridad").inputValue();

  // Copiar el borrador llena el cuadro de respuesta; publicar sigue siendo otro clic.
  await page.getByRole("button", { name: /Copiar al cuadro de respuesta/i }).click();
  await page.getByText("Se copió abajo").waitFor({ timeout: 5_000 });
  const respuesta = await page.locator("textarea").last().inputValue();
  informe.conSla.borradorSeCopia = respuesta.trim().length > 0;
  informe.conSla.largoDelBorrador = respuesta.trim().length;

  await cerrarDrawer(page);
}

/**
 * Cierra el drawer y espera a que salga la fila de medición.
 *
 * **No es cortesía: es parte de lo que hay que probar.** La primera versión
 * cerraba el navegador de golpe, y así se descubrió que de once asistencias solo
 * llegaba una fila de `aiFeedback` — el envío no estaba enganchado al cierre del
 * panel, que es justo lo que hace una persona al terminar con un ticket.
 */
async function cerrarDrawer(page) {
  await page.getByRole("dialog").getByRole("button", { name: /^Cerrar$/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10_000 });
  // El envío es «dispara y olvida»: cerrar el contexto en el mismo instante
  // abortaría la petición y perderíamos justo lo que vinimos a medir.
  await page.waitForTimeout(3_000);
}

async function revisarBuzon(page, informe) {
  await entrar(page, buzon);
  const tickets = await abrirPrimerTicket(page);
  informe.buzon = { ticketsVisibles: tickets };

  const antes = await page.locator("body").innerText();
  // En buzón simple no hay clasificación que editar: la variante opera sin ella.
  informe.buzon.sinEditor = !vistoEn(antes, "Guardar clasificación");

  await page.getByRole("button", { name: /Analizar con IA/i }).click();
  await page.getByRole("button", { name: /Analizar este ticket/i }).click();
  await page.getByText("Propuesta de la IA").waitFor({ timeout: ESPERA_MODELO });
  const conPropuesta = await page.locator("body").innerText();

  informe.buzon.resumen = vistoEn(conPropuesta, "Resumen");
  // LA comprobación: la puerta dura, vista en pantalla.
  informe.buzon.sinClasificacion = !vistoEn(conPropuesta, "Clasificación propuesta");
  informe.buzon.loDice = vistoEn(conPropuesta, "En buzón simple el asistente no clasifica");
  informe.buzon.borrador = vistoEn(conPropuesta, "Borrador de respuesta");

  await cerrarDrawer(page);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const informe = { baseUrl };

  try {
    const ctxA = await browser.newContext();
    await revisarConSla(await ctxA.newPage(), informe);
    await ctxA.close();

    const ctxB = await browser.newContext();
    await revisarBuzon(await ctxB.newPage(), informe);
    await ctxB.close();
  } catch (error) {
    informe.error = error?.message ?? String(error);
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(informe, null, 2));

  /**
   * Una comprobación que NO llegó a correr no es una comprobación que falló.
   *
   * La primera versión de este archivo las mezclaba: al morir la navegación,
   * imprimía «PUERTA DURA: buzón simple enseñó clasificación» sin haber mirado
   * nunca esa pantalla. Es el mismo defecto que este programa ya se ha
   * encontrado cuatro veces —el instrumento fallando antes que la cosa medida—,
   * y aquí habría dado una alarma máxima por un `waitUntil` mal elegido.
   */
  const fallos = [];
  const sinCorrer = [];
  const revisar = (grupo, clave, mensaje) => {
    if (grupo === undefined || grupo[clave] === undefined) sinCorrer.push(mensaje);
    else if (grupo[clave] !== true) fallos.push(mensaje);
  };

  const c = informe.conSla;
  const b = informe.buzon;
  revisar(c, "editorPresente", "con_sla: no aparece el editor de clasificación");
  revisar(c, "panelPlegado", "con_sla: el panel no nace plegado");
  revisar(c, "noAnalizaAlAbrir", "con_sla: analizó al abrir el panel (la PRD lo prohíbe)");
  revisar(c, "resumen", "con_sla: no llegó el resumen");
  revisar(c, "clasificacionPropuesta", "con_sla: no llegó la clasificación propuesta");
  revisar(c, "avisoDelBorrador", "con_sla: falta el aviso del borrador");
  revisar(c, "borradorSeCopia", "con_sla: el borrador no se copió al cuadro de respuesta");
  revisar(b, "sinEditor", "buzon_simple: aparece el editor de clasificación y no debería");
  revisar(b, "sinClasificacion", "PUERTA DURA: buzón simple enseñó clasificación");
  revisar(b, "loDice", "buzon_simple: no explica por qué no clasifica");

  if (informe.error) {
    console.error(`\n✖ El ensayo se cortó: ${informe.error}`);
  }
  if (sinCorrer.length) {
    console.error(
      `\n⚠ ${sinCorrer.length} comprobaciones NO llegaron a correr (no son fallos):\n` +
        sinCorrer.map((f) => `  - ${f}`).join("\n"),
    );
  }
  if (fallos.length) {
    console.error("\n✖ Comprobaciones que corrieron y FALLARON:\n" + fallos.map((f) => `  - ${f}`).join("\n") + "\n");
  }

  if (fallos.length || sinCorrer.length || informe.error) process.exit(1);
  console.log("\n✔ Circuito completo en las dos variantes.\n");
  process.exit(0);
}

run();
