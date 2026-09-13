// La historia de «Lomas de Sayilbedra»: el guion de la semilla (docs/plan-seed-demo-lomas-de-sayilbedra.md, §4).
//
// **Puro.** Ni Firestore ni el reloj del sistema: el mismo `tenantId` y el mismo «hoy» dan
// exactamente la misma historia, que es lo que hace la corrida idempotente.
//
// **Todo id lleva el conjunto delante** (`${tenantId}--…`). Las colecciones son raíz y sus ids,
// globales: dos semillas con el mismo id se pelean por un solo documento, y así perdió El Nogal
// cinco unidades (CLAUDE.md). Con el prefijo, la misma historia puede sembrarse en el emulador, en
// el ensayo de staging y en producción sin chocar.
//
// **Todo es ficticio**: nombres, correos inertes (`@ejemplo.vivaru.app`), CLABE con dígito de
// control inválido y ningún teléfono ni RFC. Esto contesta «¿se ve bien?», nunca «¿cómo es un
// conjunto real?» (plan §11).

import { azar } from "./azar.mjs";
import { eventosDeOperacion } from "./lomas-operacion.mjs";
import { diaDelMes, habilDesde, mesDe, mesMas, meses, sumarDias, ultimoHabil } from "./reloj.mjs";

export const HISTORIA = "lomas-de-sayilbedra";
export const NOMBRE = "Lomas de Sayilbedra";
export const SECCIONES = ["Encinos", "Fresnos", "Jacarandas"];
export const CASAS_POR_SECCION = 16;
export const DOMINIO_INERTE = "ejemplo.vivaru.app";

/** El primer día en Vivaru. Los saldos de apertura y la lectura base son de la víspera. */
export const INICIO = "2026-06-01";
export const APERTURA = "2026-05-31";

export const idDe = (tenantId, local) => `${tenantId}--${local}`;

/** El slug que el producto guarda en `units.unitId` (`createUnit`), carácter a carácter. */
export const slugDeUnidad = (displayName) => displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Para correos: sin acentos, solo letras y números separados por puntos. */
export function slugDeCorreo(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

// ── Las casas y cuentas con papel propio en la demo ────────────────────────────────────────────

/** Las tres casas de las cuentas con acceso, y la del segundo consejero (sin acceso). */
export const CASAS_DEMO = {
  resCorriente: "encinos-03",
  resMoroso: "fresnos-11",
  consejero: "jacarandas-05",
  consejeroSinAcceso: "encinos-12",
};

/** D3: las cuatro cuentas con acceso. Alias de la cuenta de David: le llegan a su buzón. */
export const CORREOS_CON_ACCESO = {
  resCorriente: "david.macar.18+lomas-res1@hotmail.com",
  resMoroso: "david.macar.18+lomas-res2@hotmail.com",
  consejero: "david.macar.18+lomas-consejo@hotmail.com",
  porteria: "david.macar.18+lomas-porteria@hotmail.com",
};

/** Plan §4.2. Las casas demo tienen cohorte fija; el resto sale del azar. */
const COHORTE_FIJA = {
  "encinos-03": "adelantado",
  "fresnos-11": "moroso",
  "jacarandas-05": "puntual",
  "encinos-12": "puntual",
};
const COHORTES_AL_AZAR = { moroso: 3, tardio: 7, multiple: 1, revertido: 1 };

/** Casas con inquilino: el dueño (inversionista) no vive ahí. */
const RENTADAS = 8;
/** D13: hogares que no tienen cuenta. El resto la tiene, sin acceso, con correo inerte. */
const SIN_CUENTA = 9;

// ── Nombres ficticios ──────────────────────────────────────────────────────────────────────────

const NOMBRES_F = [
  "Guadalupe", "Verónica", "Alejandra", "Patricia", "Gabriela", "Mariana", "Daniela", "Claudia",
  "Lucía", "Rocío", "Adriana", "Paola", "Karla", "Mónica", "Elena", "Teresa", "Beatriz", "Silvia",
  "Fernanda", "Ximena", "Regina", "Valeria", "Montserrat", "Itzel",
];
const NOMBRES_M = [
  "José Luis", "Juan Carlos", "Miguel Ángel", "Fernando", "Ricardo", "Alejandro", "Roberto",
  "Eduardo", "Sergio", "Arturo", "Francisco", "Javier", "Héctor", "Raúl", "Óscar", "Manuel",
  "Andrés", "Rodrigo", "Gerardo", "Emilio", "Santiago", "Diego", "Mauricio", "Iván",
];
const APELLIDOS = [
  "Hernández", "García", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez",
  "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez", "Torres",
  "Díaz", "Gutiérrez", "Ruiz", "Mendoza", "Aguilar", "Ortiz", "Moreno", "Castañeda", "Romo",
  "Álvarez", "Solís", "Chávez", "Rivera", "Juárez", "Ramos", "Domínguez", "Salinas", "Medina",
  "Castro", "Vargas", "Espinoza", "Velázquez", "Rojas", "Tapia", "Cervantes", "Ochoa", "Bravo",
];

// ── Indivisos ──────────────────────────────────────────────────────────────────────────────────

/**
 * Reparte el 100 % en proporción a las superficies, con resto mayor, en millonésimas de punto:
 * la suma da 100,000000 exacto, que es lo que exige `repartirPorCoeficiente` para cobrar.
 */
export function repartirIndivisos(superficies) {
  const TOTAL = 100_000_000;
  const suma = superficies.reduce((s, a) => s + a, 0);
  const exactos = superficies.map((a) => (a * TOTAL) / suma);
  const base = exactos.map((x) => Math.floor(x));
  const resto = TOTAL - base.reduce((s, b) => s + b, 0);
  const orden = exactos
    .map((x, i) => [x - Math.floor(x), i])
    .sort((p, q) => q[0] - p[0] || p[1] - q[1]);
  for (let k = 0; k < resto; k += 1) base[orden[k][1]] += 1;
  return base.map((b) => b / 1_000_000);
}

// ── CLABE que no puede ser de nadie ────────────────────────────────────────────────────────────

/** Dígito de control de Banxico: pesos 3, 7, 1 sobre los 17 primeros, módulo 10. */
export function digitoDeControlClabe(diecisiete) {
  const pesos = [3, 7, 1];
  let suma = 0;
  for (let i = 0; i < 17; i += 1) suma += (Number(diecisiete[i]) * pesos[i % 3]) % 10;
  return (10 - (suma % 10)) % 10;
}

/**
 * Una CLABE con el dígito de control **mal a propósito**. Ninguna cuenta real puede tenerlo, y el
 * producto no valida la CLABE (fase 0, §12.4): se ve como una de verdad y no es de nadie.
 */
export function clabeImposible(diecisiete) {
  return `${diecisiete}${(digitoDeControlClabe(diecisiete) + 5) % 10}`;
}

// ── Catálogos del conjunto ─────────────────────────────────────────────────────────────────────

function franjas(inicio, fin, minutos) {
  const aMin = (h) => {
    const [a, b] = h.split(":").map(Number);
    return a * 60 + b;
  };
  const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const lista = [];
  for (let t = aMin(inicio); t + minutos <= aMin(fin); t += minutos) lista.push(`${aHora(t)} - ${aHora(t + minutos)}`);
  return lista;
}

const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];

export const AREAS = [
  {
    clave: "casa-club",
    name: "Casa club · salón de eventos",
    category: "social",
    availableWeekdays: TODOS_LOS_DIAS,
    operatingHoursStart: "10:00",
    operatingHoursEnd: "23:00",
    slotDurationMinutes: 240,
    maxReservationsPerSlot: 1,
    maxReservationDurationMinutes: 480,
    maxReservationsPerUnitPerMonth: 2,
    usageRules: "Máximo 80 personas. Música hasta las 23:00. Se entrega limpio al día siguiente antes de las 10:00.",
    blockOnDebt: true,
    autoApprove: false,
    minAdvanceMinutes: 2880,
  },
  {
    clave: "alberca",
    name: "Alberca",
    category: "wellness",
    availableWeekdays: [0, 2, 3, 4, 5, 6],
    operatingHoursStart: "09:00",
    operatingHoursEnd: "21:00",
    slotDurationMinutes: 120,
    maxReservationsPerSlot: 6,
    maxReservationDurationMinutes: 120,
    maxReservationsPerUnitPerMonth: 8,
    usageRules: "Lunes cerrada por mantenimiento. Menores de 12 años acompañados. Regaderazo antes de entrar.",
    blockOnDebt: true,
    autoApprove: true,
    minAdvanceMinutes: 60,
  },
  {
    clave: "palapa",
    name: "Palapa con asadores",
    category: "social",
    availableWeekdays: TODOS_LOS_DIAS,
    operatingHoursStart: "12:00",
    operatingHoursEnd: "22:00",
    slotDurationMinutes: 300,
    maxReservationsPerSlot: 1,
    maxReservationDurationMinutes: 300,
    maxReservationsPerUnitPerMonth: 2,
    usageRules: "Carbón y leña por cuenta de quien reserva. Se apagan los asadores antes de irse.",
    blockOnDebt: true,
    autoApprove: true,
    minAdvanceMinutes: 1440,
  },
  {
    clave: "gimnasio",
    name: "Gimnasio",
    category: "sports",
    availableWeekdays: TODOS_LOS_DIAS,
    operatingHoursStart: "06:00",
    operatingHoursEnd: "22:00",
    slotDurationMinutes: 60,
    maxReservationsPerSlot: 4,
    maxReservationDurationMinutes: 60,
    maxReservationsPerUnitPerMonth: 30,
    usageRules: "Toalla obligatoria. Se limpian los aparatos al terminar.",
    blockOnDebt: false,
    autoApprove: true,
    minAdvanceMinutes: 30,
  },
  {
    clave: "padel",
    name: "Cancha de pádel",
    category: "sports",
    availableWeekdays: TODOS_LOS_DIAS,
    operatingHoursStart: "07:00",
    operatingHoursEnd: "22:00",
    slotDurationMinutes: 90,
    maxReservationsPerSlot: 1,
    maxReservationDurationMinutes: 90,
    maxReservationsPerUnitPerMonth: 8,
    usageRules: "Calzado para pádel. Las luces se apagan a las 22:00.",
    blockOnDebt: true,
    autoApprove: true,
    minAdvanceMinutes: 60,
  },
].map((a) => ({ ...a, reservationSlots: franjas(a.operatingHoursStart, a.operatingHoursEnd, a.slotDurationMinutes) }));

/** Categorías de egreso SOLO del tipo (fase 0: `seguridad` y `servicios` están fuera). */
export const PROVEEDORES = [
  { clave: "vigilancia", legalName: "Vigilancia Integral Angelópolis, S.A. de C.V.", defaultCategory: "vigilancia" },
  { clave: "jardineria", legalName: "Jardines y Paisajes del Valle, S.A. de C.V.", defaultCategory: "mantenimiento" },
  { clave: "limpieza", legalName: "Limpieza Profesional Cholula, S.C.", defaultCategory: "mantenimiento" },
  { clave: "alberca", legalName: "Albercas y Filtros Atlixco", defaultCategory: "mantenimiento" },
  { clave: "cfe", legalName: "CFE Suministrador de Servicios Básicos", defaultCategory: "servicios_publicos" },
  { clave: "pipas", legalName: "Pipas de Agua La Calera", defaultCategory: "servicios_publicos" },
  { clave: "fumigacion", legalName: "Control de Plagas Xonaca", defaultCategory: "mantenimiento" },
  { clave: "impermeabilizacion", legalName: "Impermeabilizantes y Techos del Centro, S.A. de C.V.", defaultCategory: "mantenimiento" },
  { clave: "bombas", legalName: "Bombas e Hidráulica San Andrés", defaultCategory: "mantenimiento" },
  { clave: "administracion", legalName: "Sayil Administración de Inmuebles, S.C.", defaultCategory: "administracion" },
  { clave: "seguros", legalName: "Seguros Patrimoniales del Altiplano, S.A.", defaultCategory: "seguros" },
  { clave: "papeleria", legalName: "Papelería y Consumibles La Paz", defaultCategory: "otros" },
];

export const CUENTAS_BANCARIAS = [
  {
    clave: "operativa",
    label: "Cuenta operativa",
    bankName: "BBVA México",
    accountNumber: clabeImposible("01265000731905844"),
    saldoApertura: 186_400,
  },
  {
    clave: "reserva",
    label: "Fondo de reserva",
    bankName: "BBVA México",
    accountNumber: clabeImposible("01265000731906127"),
    saldoApertura: 412_000,
  },
];

export const SERVICIO_MEDIDO = { clave: "agua", name: "Agua potable (pozo)", unit: "m3", rate: 22, accountCode: "1.11" };

export const CAJA_CHICA = { clave: "caja-caseta", name: "Caja chica de caseta", limit: 3000 };

export const AJUSTES = {
  brandColor: "#2F5D50",
  residentModules: { reservations: true, services: true, surveys: true, regulations: true },
  reservationPolicy: { blockOnDebt: true },
  fiscalProfile: {
    taxId: null,
    legalName: "Asociación de Colonos de Lomas de Sayilbedra, A.C.",
    address: "Puebla, Pue.",
    country: "MX",
    voucherSeriesPrefix: null,
    dataRetentionMonths: 12,
  },
};

// ── El padrón ──────────────────────────────────────────────────────────────────────────────────

function nombreCompleto(r, genero, apellido1) {
  const nombre = r.elegir(genero === "f" ? NOMBRES_F : NOMBRES_M);
  const ap1 = apellido1 ?? r.elegir(APELLIDOS);
  let ap2 = r.elegir(APELLIDOS);
  while (ap2 === ap1) ap2 = r.elegir(APELLIDOS);
  return { nombre, ap1, ap2, fullName: `${nombre} ${ap1} ${ap2}` };
}

/**
 * Las 48 casas, sus ~120 personas y las ~40 cuentas (D3 + D13). Todo con id prefijado.
 */
export function construirPadron(tenantId) {
  const claves = [];
  for (const seccion of SECCIONES) {
    for (let n = 1; n <= CASAS_POR_SECCION; n += 1) {
      const displayName = `${seccion} ${String(n).padStart(2, "0")}`;
      claves.push({ seccion, displayName, clave: slugDeUnidad(displayName) });
    }
  }

  // Superficie por sección: Encinos, lotes chicos; Jacarandas, los grandes.
  const RANGO = { Encinos: [150, 195], Fresnos: [175, 225], Jacarandas: [205, 260] };
  const superficies = claves.map(({ seccion, clave }) => {
    const [min, max] = RANGO[seccion];
    return azar(`superficie:${clave}`).entero(min, max);
  });
  const indivisos = repartirIndivisos(superficies);

  const demo = new Set(Object.values(CASAS_DEMO));
  const libres = azar("reparto:casas").barajar(claves.map((c) => c.clave).filter((c) => !demo.has(c)));
  const rentadas = new Set(libres.slice(0, RENTADAS));
  const cohorte = new Map(Object.entries(COHORTE_FIJA));
  let i = RENTADAS;
  for (const [nombre, cuantas] of Object.entries(COHORTES_AL_AZAR)) {
    for (let k = 0; k < cuantas; k += 1) cohorte.set(libres[i++], nombre);
  }
  const sinCuenta = new Set(azar("reparto:cuentas").barajar(libres).slice(0, SIN_CUENTA));

  const casas = [];
  const personas = [];
  const cuentas = [];
  const usados = new Set();

  claves.forEach(({ seccion, displayName, clave }, idx) => {
    const id = idDe(tenantId, `u-${clave}`);
    const r = azar(`hogar:${clave}`);
    const miembros = [];
    const nuevo = (datos) => {
      let n = datos;
      let intentos = 0;
      while (usados.has(n.fullName) && intentos < 20) {
        n = nombreCompleto(r, datos.genero, datos.ap1Fijo);
        n.genero = datos.genero;
        intentos += 1;
      }
      usados.add(n.fullName);
      return n;
    };

    const alquilada = rentadas.has(clave);
    // El titular del hogar: quien vive ahí (propietario o inquilino).
    const generoTitular = r.probable(0.5) ? "f" : "m";
    const titular = nuevo({ ...nombreCompleto(r, generoTitular), genero: generoTitular });
    miembros.push({ ...titular, roleType: alquilada ? "tenant" : "owner_occupant", titular: true });

    const tamano = r.elegir([1, 2, 2, 2, 3, 3, 3, 4]);
    if (tamano >= 2) {
      const g = generoTitular === "f" ? "m" : "f";
      miembros.push({ ...nuevo({ ...nombreCompleto(r, g), genero: g }), roleType: "other" });
    }
    for (let k = 2; k < tamano; k += 1) {
      const g = r.probable(0.5) ? "f" : "m";
      miembros.push({ ...nuevo({ ...nombreCompleto(r, g, titular.ap1), genero: g, ap1Fijo: titular.ap1 }), roleType: "other" });
    }
    if (alquilada) {
      const g = r.probable(0.5) ? "f" : "m";
      miembros.push({ ...nuevo({ ...nombreCompleto(r, g), genero: g }), roleType: "investor", fuera: true });
    }

    const ownerIds = [];
    const residentIds = [];
    miembros.forEach((m, k) => {
      const personaId = idDe(tenantId, `p-${clave}-${k + 1}`);
      const correoInerte = `${slugDeCorreo(m.nombre)}.${slugDeCorreo(m.ap1)}.${clave}${k ? `.${k + 1}` : ""}@${DOMINIO_INERTE}`;
      let email = correoInerte;
      if (m.titular && clave === CASAS_DEMO.resCorriente) email = CORREOS_CON_ACCESO.resCorriente;
      if (m.titular && clave === CASAS_DEMO.resMoroso) email = CORREOS_CON_ACCESO.resMoroso;
      if (m.titular && clave === CASAS_DEMO.consejero) email = CORREOS_CON_ACCESO.consejero;
      personas.push({
        id: personaId,
        casaId: id,
        fullName: m.fullName,
        email,
        roleType: m.roleType,
        tower: seccion,
        titular: Boolean(m.titular),
      });
      if (m.roleType === "owner_occupant" || m.roleType === "investor") ownerIds.push(personaId);
      else residentIds.push(personaId);
      if (m.titular && !sinCuenta.has(clave)) {
        const conAcceso = email !== correoInerte;
        cuentas.push({
          clave: `res-${clave}`,
          email,
          fullName: m.fullName,
          personaId,
          casaId: id,
          role: "resident",
          acceso: conAcceso,
          consejo: clave === CASAS_DEMO.consejero || clave === CASAS_DEMO.consejeroSinAcceso,
        });
      }
    });

    casas.push({
      id,
      clave,
      displayName,
      tower: seccion,
      type: "house",
      areaSqm: superficies[idx],
      coefficient: indivisos[idx],
      cohorte: cohorte.get(clave) ?? "puntual",
      alquilada,
      ownerIds,
      residentIds,
    });
  });

  cuentas.push({
    clave: "porteria",
    email: CORREOS_CON_ACCESO.porteria,
    fullName: "Caseta de vigilancia · Lomas de Sayilbedra",
    personaId: null,
    casaId: null,
    role: "security_guard",
    acceso: true,
    consejo: false,
  });

  return {
    casas,
    personas,
    cuentas,
    areas: AREAS.map((a) => ({ ...a, id: idDe(tenantId, `area-${a.clave}`) })),
    proveedores: PROVEEDORES.map((p) => ({ ...p, id: idDe(tenantId, `prov-${p.clave}`) })),
    bancos: CUENTAS_BANCARIAS.map((b) => ({ ...b, id: idDe(tenantId, `banco-${b.clave}`) })),
    servicioMedido: { ...SERVICIO_MEDIDO, id: idDe(tenantId, `servicio-${SERVICIO_MEDIDO.clave}`) },
    caja: { ...CAJA_CHICA, id: idDe(tenantId, CAJA_CHICA.clave) },
    ajustes: { ...AJUSTES, agrupaciones: [...SECCIONES], tenantName: NOMBRE },
  };
}

// ── La cartera: corridas, pagos por cohorte, multas, comprobantes y la reversión ──────────────

/** Lo que se reparte por indiviso cada mes: la cuota de mantenimiento del conjunto. */
export const CUOTA_MENSUAL_TOTAL = 100_000;

/** La cuota aproximada de una casa (la exacta la redondea la corrida). */
export const cuotaDe = (casa) => Math.round(casa.coefficient * CUOTA_MENSUAL_TOTAL) / 100;

const MULTAS = [
  { fecha: "2026-07-14", monto: 1000, motivo: "Ruido después de las 23:00 (reglamento, art. 18)" },
  { fecha: "2026-07-28", monto: 800, motivo: "Mascota sin correa en áreas comunes (reglamento, art. 24)" },
  { fecha: "2026-08-18", monto: 1200, motivo: "Vehículo estacionado frente a la casa club (reglamento, art. 31)" },
];

const PATRONES_DE_MORA = ["deja-en-julio", "un-mes-atras", "paga-dos-meses"];

function hora(r, desde = 8, hasta = 19) {
  return `${String(r.entero(desde, hasta)).padStart(2, "0")}:${r.elegir(["05", "12", "26", "34", "41", "58"])}`;
}

/**
 * Los eventos de cartera, del primer mes al de `hoy`. El importe de cada pago NO se fija aquí:
 * lo calcula el escritor al ejecutar, sobre la deuda real de la casa en ese momento (`hastaPeriodo`),
 * porque qué cargos existen depende de lo que se sembró antes (consumo, extraordinaria, multas).
 */
function eventosDeCartera(tenantId, hoy, padron) {
  const ev = [];
  const push = (fecha, h, tipo, clave, datos) => ev.push({ fecha, hora: h, tipo, clave, datos });
  const listaMeses = meses(mesDe(INICIO), mesDe(hoy));
  const mesHoy = mesDe(hoy);
  const ayer = sumarDias(hoy, -1);
  const cuentaDe = new Map(padron.cuentas.filter((c) => c.casaId).map((c) => [c.casaId, c]));
  const demo = new Set(Object.values(CASAS_DEMO));

  for (const M of listaMeses) {
    push(diaDelMes(M, 1), "08:00", "corrida-cuotas", `corrida-${M}`, {
      period: M,
      dueDate: diaDelMes(M, 10),
      totalAmount: CUOTA_MENSUAL_TOTAL,
      concept: "administracion",
    });
  }

  // La reversión: el pago de la casa «revertido» se registró la víspera en otra casa (morosa).
  const morosos = padron.casas.filter((c) => c.cohorte === "moroso" && !demo.has(c.clave));
  const patron = new Map(morosos.map((c, i) => [c.clave, PATRONES_DE_MORA[i % PATRONES_DE_MORA.length]]));
  const casaReal = padron.casas.find((c) => c.cohorte === "revertido");
  const casaEquivocada = morosos[0];
  // Un comprobante pendiente a hoy, de una casa tardía con cuenta: su pago del mes queda en revisión.
  const pendiente = padron.casas.find((c) => c.cohorte === "tardio" && cuentaDe.get(c.id) && !cuentaDe.get(c.id).acceso && !demo.has(c.clave));

  let rechazoHecho = false;
  for (const casa of padron.casas) {
    const cuenta = cuentaDe.get(casa.id);
    listaMeses.forEach((M, idx) => {
      const r = azar(`pago:${casa.clave}:${M}`);
      // Repartido (una operación para varios cargos) solo el que paga dos meses juntos y el
      // adelantado con su anticipo: el resto va cargo a cargo, que es lo que el banco concilia.
      const pago = (fecha, hasta, extra = 0, sufijo = "") =>
        push(fecha, hora(r), "pago", `pago-${casa.clave}-${M}${sufijo}`, {
          casa: casa.clave, hastaPeriodo: hasta, extra, repartido: extra > 0 || casa.cohorte === "multiple",
        });

      if (M === mesHoy && (casa === casaReal || casa === pendiente)) return;

      // Pagar con comprobante subido por el residente, en vez de por transferencia registrada.
      const conComprobante =
        cuenta && !cuenta.acceso && !demo.has(casa.clave) && M < mesHoy && ["puntual", "tardio"].includes(casa.cohorte) && r.probable(0.18);

      let fecha = null;
      let hasta = M;
      let extra = 0;
      switch (casa.cohorte) {
        case "puntual":
        case "revertido":
          fecha = habilDesde(diaDelMes(M, r.entero(2, 9)));
          break;
        case "tardio":
          fecha = habilDesde(diaDelMes(M, r.entero(15, 27)));
          break;
        case "multiple":
          if (idx % 2 === 1) fecha = habilDesde(diaDelMes(M, r.entero(8, 22)));
          break;
        case "adelantado":
          if (idx === 0) {
            fecha = "2026-06-04";
            extra = Math.round(cuotaDe(casa) * 4 * 100) / 100;
          } else {
            push(diaDelMes(M, 1), "09:00", "cruce-anticipo", `cruce-${casa.clave}-${M}`, { casa: casa.clave, periodo: M });
            fecha = habilDesde(diaDelMes(M, 5));
          }
          break;
        case "moroso":
          if (casa.clave === CASAS_DEMO.resMoroso) {
            if (idx === 0) fecha = "2026-06-22";
            if (idx === 2) {
              fecha = habilDesde(diaDelMes(M, 26));
              hasta = mesMas(M, -1);
            }
          } else {
            const p = patron.get(casa.clave);
            if (p === "deja-en-julio" && idx === 0) fecha = habilDesde(diaDelMes(M, 12));
            if (p === "un-mes-atras" && idx >= 1) {
              fecha = habilDesde(diaDelMes(M, 25));
              hasta = mesMas(M, -1);
            }
            if (p === "paga-dos-meses" && idx <= 1) fecha = habilDesde(diaDelMes(M, 18));
          }
          break;
        default:
          break;
      }
      if (!fecha) return;

      if (conComprobante) {
        const clave = `${casa.clave}-${M}`;
        push(fecha, "10:20", "comprobante-subido", `comprobante-${clave}-1`, { casa: casa.clave, periodo: M, cuenta: cuenta.clave, n: 1 });
        const revision = habilDesde(sumarDias(fecha, 1));
        if (!rechazoHecho && M === "2026-08") {
          rechazoHecho = true;
          push(revision, "11:30", "comprobante-revisado", `revision-${clave}-1`, {
            casa: casa.clave, periodo: M, n: 1, decision: "rechazar",
            motivo: "El comprobante no deja ver el importe completo. Por favor súbelo otra vez.",
          });
          const otra = habilDesde(sumarDias(revision, 1));
          push(otra, "09:50", "comprobante-subido", `comprobante-${clave}-2`, { casa: casa.clave, periodo: M, cuenta: cuenta.clave, n: 2 });
          const aprobacion = habilDesde(sumarDias(otra, 1));
          push(aprobacion, "11:30", "comprobante-revisado", `revision-${clave}-2`, { casa: casa.clave, periodo: M, n: 2, decision: "aprobar" });
          push(aprobacion, "12:10", "pago", `pago-${casa.clave}-${M}`, { casa: casa.clave, hastaPeriodo: M, extra: 0 });
        } else {
          push(revision, "11:30", "comprobante-revisado", `revision-${clave}-1`, { casa: casa.clave, periodo: M, n: 1, decision: "aprobar" });
          push(revision, "12:10", "pago", `pago-${casa.clave}-${M}`, { casa: casa.clave, hastaPeriodo: M, extra: 0 });
        }
        return;
      }
      pago(fecha, hasta, extra);
    });
  }

  // Dos comprobantes pendientes a hoy: el de la casa morosa demo (su cuota del mes pasado) y uno
  // del mes, recién subido.
  const moroso = padron.casas.find((c) => c.clave === CASAS_DEMO.resMoroso);
  push(sumarDias(hoy, -2), "10:40", "comprobante-subido", `comprobante-${moroso.clave}-${mesMas(mesHoy, -1)}-1`, {
    casa: moroso.clave, periodo: mesMas(mesHoy, -1), cuenta: `res-${moroso.clave}`, n: 1,
  });
  if (pendiente) {
    push(ayer, "21:15", "comprobante-subido", `comprobante-${pendiente.clave}-${mesHoy}-1`, {
      casa: pendiente.clave, periodo: mesHoy, cuenta: cuentaDe.get(pendiente.id).clave, n: 1,
    });
  }

  // Multas: dos a casas que pagan y una a una morosa, que queda sin pagar.
  const cumplidas = azar("multas").barajar(padron.casas.filter((c) => ["puntual", "tardio"].includes(c.cohorte) && !demo.has(c.clave)));
  const multadas = [cumplidas[0], cumplidas[1], morosos[1] ?? cumplidas[2]];
  MULTAS.forEach((m, i) => {
    push(m.fecha, "13:15", "multa", `multa-${i + 1}`, {
      casa: multadas[i].clave, monto: m.monto, periodo: mesDe(m.fecha), vence: sumarDias(m.fecha, 15), motivo: m.motivo,
    });
  });

  // La reversión: la víspera se registró en la casa equivocada; hoy se revierte y se aplica bien.
  if (casaReal && casaEquivocada) {
    push(ayer, "12:40", "pago-equivocado", `pago-equivocado-${mesHoy}`, {
      casaReal: casaReal.clave, casaDestino: casaEquivocada.clave, hastaPeriodo: mesHoy,
    });
    push(hoy, "10:05", "reversion", `reversion-${mesHoy}`, {
      pago: `pago-equivocado-${mesHoy}`,
      motivo: `Se registró en ${casaEquivocada.displayName} por error: el depósito era de ${casaReal.displayName}.`,
    });
    push(hoy, "10:15", "pago", `pago-${casaReal.clave}-${mesHoy}`, { casa: casaReal.clave, hastaPeriodo: mesHoy, extra: 0 });
  }

  return ev;
}

// ── Egresos, cuotas, prorrateo y tesorería ─────────────────────────────────────────────────────

const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (M) => `${MESES_ES[Number(M.slice(5, 7)) - 1]} ${M.slice(0, 4)}`;

/** Lo que se paga todos los meses. `emite` y `paga` son días del mes (se corren al hábil). */
const EGRESOS_RECURRENTES = [
  { clave: "administracion", proveedor: "administracion", categoria: "administracion", descripcion: "Honorarios de administración", monto: 12_000, emite: 1, paga: 3 },
  { clave: "vigilancia", proveedor: "vigilancia", categoria: "vigilancia", descripcion: "Servicio de vigilancia 24 h, caseta y rondines", monto: 42_000, emite: 1, paga: 5 },
  { clave: "jardineria", proveedor: "jardineria", categoria: "mantenimiento", descripcion: "Mantenimiento de jardines y camellones", monto: 9_500, emite: 2, paga: 6 },
  { clave: "limpieza", proveedor: "limpieza", categoria: "mantenimiento", descripcion: "Limpieza de áreas comunes y casa club", monto: 7_800, emite: 2, paga: 6 },
  { clave: "alberca", proveedor: "alberca", categoria: "mantenimiento", descripcion: "Mantenimiento de alberca y químicos", monto: 3_600, emite: 3, paga: 8 },
  { clave: "cfe", proveedor: "cfe", categoria: "servicios_publicos", descripcion: "Energía eléctrica: alumbrado y bombeo del pozo", monto: [6_200, 7_400], emite: 11, paga: 16 },
];

const GASTOS_DE_CAJA = [
  ["Garrafones de agua para la caseta", 360],
  ["Focos y material eléctrico", 540],
  ["Artículos de limpieza para la caseta", 420],
  ["Papelería y copias de avisos", 280],
  ["Pilas para los radios de vigilancia", 310],
  ["Candado y cadena para el acceso de servicio", 465],
];

function eventosDeEgresos(tenantId, hoy, padron) {
  const ev = [];
  const push = (fecha, h, tipo, clave, datos) => {
    if (fecha < hoy) ev.push({ fecha, hora: h, tipo, clave, datos });
  };
  const listaMeses = meses(mesDe(INICIO), mesDe(hoy));
  const egreso = (fecha, h, clave, d) => push(fecha, h, "egreso", `egreso-${clave}`, { metodo: "transferencia", cuenta: "operativa", ...d, pago: d.pago && d.pago < hoy ? d.pago : null });

  for (const M of listaMeses) {
    for (const g of EGRESOS_RECURRENTES) {
      const r = azar(`egreso:${g.clave}:${M}`);
      const emision = habilDesde(diaDelMes(M, g.emite));
      const pago = habilDesde(diaDelMes(M, g.paga));
      egreso(emision, "10:10", `${g.clave}-${M}`, {
        proveedor: g.proveedor, categoria: g.categoria, descripcion: `${g.descripcion} · ${nombreMes(M)}`,
        monto: Array.isArray(g.monto) ? r.entero(g.monto[0], g.monto[1]) : g.monto, emision, vence: pago, pago,
      });
    }
    const cierre = ultimoHabil(M);
    egreso(cierre, "23:10", `comision-${M}`, {
      proveedor: null, vendorName: "BBVA México", categoria: "otros", descripcion: `Comisión por manejo de cuenta · ${nombreMes(M)}`,
      monto: 522, emision: cierre, vence: null, pago: cierre, metodo: "otro",
    });
    push(cierre, "23:20", "rendimiento", `rendimiento-${M}`, {
      concepto: `Rendimientos del fondo de reserva · ${nombreMes(M)}`, monto: azar(`rendimiento:${M}`).entero(1_650, 1_900), cuenta: "reserva",
    });
    // Aportación mensual al fondo de reserva.
    push(habilDesde(diaDelMes(M, 20)), "11:00", "traspaso", `traspaso-reserva-${M}`, {
      desde: "operativa", hacia: "reserva", monto: 8_000, detalle: `Aportación mensual al fondo de reserva · ${nombreMes(M)}`,
    });
    // Caja chica: dos gastos al mes desde que se abre, y reposición el 14.
    if (M >= "2026-07") {
      const r = azar(`caja:${M}`);
      const gastos = r.barajar(GASTOS_DE_CAJA).slice(0, 2);
      [9, 23].forEach((dia, i) => {
        const fecha = habilDesde(diaDelMes(M, dia));
        egreso(fecha, "13:30", `caja-${M}-${i + 1}`, {
          proveedor: i === 1 ? "papeleria" : null, vendorName: i === 1 ? null : "Compra en efectivo", categoria: "otros",
          descripcion: gastos[i][0], monto: gastos[i][1], emision: fecha, vence: null, pago: fecha, metodo: "efectivo", cuenta: "caja",
        });
      });
      if (M >= "2026-08") push(habilDesde(diaDelMes(M, 14)), "10:00", "reposicion-caja", `reposicion-caja-${M}`, {});
    }
  }

  egreso("2026-06-10", "11:00", "seguro-2026", {
    proveedor: "seguros", categoria: "seguros", descripcion: "Póliza anual de responsabilidad civil y daños en áreas comunes (2026–2027)",
    monto: 18_500, emision: "2026-06-10", vence: "2026-06-12", pago: "2026-06-12",
  });
  for (const [fecha, pago] of [["2026-06-12", "2026-06-15"], ["2026-08-12", "2026-08-14"]]) {
    egreso(fecha, "12:00", `fumigacion-${mesDe(fecha)}`, {
      proveedor: "fumigacion", categoria: "mantenimiento", descripcion: "Fumigación bimestral de áreas comunes y registros",
      monto: 2_800, emision: fecha, vence: pago, pago,
    });
  }
  for (const fecha of ["2026-08-20", "2026-08-27"]) {
    egreso(fecha, "09:40", `pipa-${fecha}`, {
      proveedor: "pipas", categoria: "servicios_publicos", descripcion: "Pipa de agua de 10 m³ (estiaje del pozo)",
      monto: 3_000, emision: fecha, vence: fecha, pago: fecha,
    });
  }

  // La impermeabilización de la casa club, en dos pagos, cada uno prorrateado por indiviso.
  const impermeabilizacion = [
    { clave: "impermeabilizacion-anticipo", emision: "2026-07-03", pago: "2026-07-06", prorrateo: "2026-07-07", periodo: "2026-07", nota: "anticipo del 50 %" },
    { clave: "impermeabilizacion-finiquito", emision: "2026-08-05", pago: "2026-08-07", prorrateo: "2026-08-08", periodo: "2026-08", nota: "finiquito del 50 %" },
  ];
  for (const p of impermeabilizacion) {
    egreso(p.emision, "12:30", p.clave, {
      proveedor: "impermeabilizacion", categoria: "mantenimiento", descripcion: `Impermeabilización de la casa club · ${p.nota}`,
      monto: 48_000, emision: p.emision, vence: p.pago, pago: p.pago,
    });
    push(p.prorrateo, "09:15", "prorrateo", `prorrateo-${p.clave}`, {
      egreso: `egreso-${p.clave}`, periodo: p.periodo, vence: diaDelMes(p.periodo, 31),
    });
  }

  // La bomba sumergible, en tres cuotas.
  push("2026-07-08", "10:45", "egreso-en-cuotas", "egreso-bomba-sumergible", {
    proveedor: "bombas", categoria: "mantenimiento", descripcion: "Bomba sumergible nueva para el pozo, con instalación",
    monto: 36_000, emision: "2026-07-08",
    cuotas: [
      { number: 1, dueDate: "2026-07-15", amount: 12_000 },
      { number: 2, dueDate: "2026-08-15", amount: 12_000 },
      { number: 3, dueDate: "2026-09-15", amount: 12_000 },
    ],
  });
  push("2026-07-15", "11:20", "pago-cuota-egreso", "pago-cuota-bomba-1", { egreso: "egreso-bomba-sumergible", numero: 1, pago: "2026-07-15" });
  push("2026-08-14", "11:20", "pago-cuota-egreso", "pago-cuota-bomba-2", { egreso: "egreso-bomba-sumergible", numero: 2, pago: "2026-08-14" });

  push("2026-07-03", "09:30", "apertura-caja", "apertura-caja", { desde: "operativa" });

  return ev;
}

// ── El banco: el extracto de cada mes y su conciliación ───────────────────────────────────────

function eventosDeBanco(hoy) {
  const ev = [];
  const push = (fecha, h, tipo, clave, datos) => {
    if (fecha < hoy) ev.push({ fecha, hora: h, tipo, clave, datos });
  };
  const ayer = sumarDias(hoy, -1);
  for (const M of meses(mesDe(INICIO), mesDe(hoy))) {
    const fin = diaDelMes(M, 31);
    const corte = fin < hoy ? fin : ayer;
    push(corte, "23:50", "extracto", `extracto-${M}`, { desde: diaDelMes(M, 1), hasta: corte });
    // La conciliación del mes, a los pocos días de cerrarlo.
    if (fin < hoy) push(habilDesde(diaDelMes(mesMas(M, 1), 4)), "10:30", "conciliacion", `conciliacion-${M}`, { hasta: fin });
  }
  // A la víspera, lo de hace más de seis días: la última semana queda por conciliar.
  push(ayer, "23:55", "conciliacion", `conciliacion-${ayer}`, { hasta: sumarDias(hoy, -6) });
  return ev;
}

// ── El medidor de agua, el presupuesto, los informes mensuales y la constancia ────────────────

/** La lectura del medidor de una casa al cierre de un periodo: la base de mayo más lo consumido. */
export function lecturaDe(casa, periodo) {
  let lectura = azar(`medidor:${casa.clave}`).entero(120, 950);
  for (const M of meses(mesDe(INICIO), periodo)) lectura += azar(`consumo:${casa.clave}:${M}`).entero(12, 34);
  return lectura;
}

/** Presupuesto 2026 por cuenta contable (plan de cuentas sembrado), aprobado en asamblea en enero. */
export const PRESUPUESTO_2026 = [
  { accountCode: "1.1", amount: 1_200_000 },
  { accountCode: "1.2", amount: 96_000 },
  { accountCode: "1.3", amount: 6_000 },
  { accountCode: "1.8", amount: 21_000 },
  { accountCode: "1.11", amount: 240_000 },
  { accountCode: "2.2", amount: 96_000 },
  { accountCode: "2.3", amount: 330_000 },
  { accountCode: "2.5", amount: 144_000 },
  { accountCode: "2.6", amount: 18_500 },
  { accountCode: "2.8", amount: 18_000 },
  { accountCode: "2.9", amount: 504_000 },
];

/** Quién firma cada informe y cuándo. El de agosto queda con la firma del consejero demo pendiente. */
const FIRMAS_DE_INFORMES = {
  "2026-06": [[CASAS_DEMO.consejeroSinAcceso, "2026-07-09"], [CASAS_DEMO.consejero, "2026-07-13"]],
  "2026-07": [[CASAS_DEMO.consejeroSinAcceso, "2026-08-10"], [CASAS_DEMO.consejero, "2026-08-12"]],
  "2026-08": [[CASAS_DEMO.consejeroSinAcceso, "2026-09-09"]],
};

function eventosDeGobierno(hoy) {
  const ev = [];
  const push = (fecha, h, tipo, clave, datos) => {
    if (fecha < hoy) ev.push({ fecha, hora: h, tipo, clave, datos });
  };

  // Medidor: la lectura base el 31 de mayo y, cada mes, la de fin de mes, su cierre y su corrida.
  for (const P of [mesMas(mesDe(INICIO), -1), ...meses(mesDe(INICIO), mesDe(hoy))]) {
    const fin = diaDelMes(P, 31);
    push(fin, "09:00", "lecturas", `lecturas-${P}`, { periodo: P });
    if (P < mesDe(INICIO)) {
      push(fin, "18:00", "cierre-lecturas", `cierre-lecturas-${P}`, { periodo: P });
      continue;
    }
    const siguiente = mesMas(P, 1);
    push(diaDelMes(siguiente, 1), "09:30", "cierre-lecturas", `cierre-lecturas-${P}`, { periodo: P });
    push(diaDelMes(siguiente, 2), "08:30", "corrida-consumo", `corrida-consumo-${P}`, { periodo: P, vence: diaDelMes(siguiente, 10) });
  }

  // El presupuesto se cargó en Vivaru el primer lunes, con la fecha del acta de la asamblea.
  push("2026-06-02", "10:00", "presupuesto", "presupuesto-2026", { year: 2026, aprobadoEn: "2026-01-25" });

  // Informes: el borrador lo deja el cierre del día 1; se emite hacia el 7; lo firma el consejo.
  for (const M of meses(mesDe(INICIO), mesMas(mesDe(hoy), -1))) {
    const siguiente = mesMas(M, 1);
    push(diaDelMes(siguiente, 1), "06:10", "informe-borrador", `informe-borrador-${M}`, { periodo: M });
    push(habilDesde(diaDelMes(siguiente, 7)), "11:20", "informe-emision", `informe-emision-${M}`, { periodo: M });
    const firmas = FIRMAS_DE_INFORMES[M] ?? [[CASAS_DEMO.consejeroSinAcceso, habilDesde(diaDelMes(siguiente, 10))], [CASAS_DEMO.consejero, habilDesde(diaDelMes(siguiente, 13))]];
    for (const [casa, fecha] of firmas) push(fecha, "19:30", "informe-firma", `informe-firma-${M}-${casa}`, { periodo: M, cuenta: `res-${casa}` });
  }

  // La constancia de no adeudo de la casa adelantada, un día en que no debe nada.
  push("2026-08-06", "12:00", "constancia", `constancia-${CASAS_DEMO.resCorriente}`, { casa: CASAS_DEMO.resCorriente });

  return ev;
}

const ordenDeEventos = (a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora) || a.clave.localeCompare(b.clave);

/**
 * La historia entera: el padrón y los eventos, en orden, desde `INICIO` hasta la víspera de `hoy`,
 * más el lote de «hoy» y lo que viene. Los eventos se añaden dominio a dominio (plan §8, fase 1).
 */
export function construirHistoria({ tenantId, hoy }) {
  const padron = construirPadron(tenantId);
  const eventos = [
    ...eventosDeCartera(tenantId, hoy, padron),
    ...eventosDeEgresos(tenantId, hoy, padron),
    ...eventosDeBanco(hoy),
    ...eventosDeGobierno(hoy),
    ...eventosDeOperacion(tenantId, hoy, padron, { INICIO, CASAS_DEMO }),
  ].sort(ordenDeEventos);
  return { historia: HISTORIA, tenantId, hoy, padron, eventos };
}
