"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLUG_PRIMERA_UNIDAD = exports.EXAMPLE_TAG = void 0;
exports.idDeUnidadSembrada = idDeUnidadSembrada;
exports.seedTrialWorkspace = seedTrialWorkspace;
const firestore_1 = require("firebase-admin/firestore");
const clave_de_unidad_1 = require("./clave-de-unidad");
const plan_de_cuentas_1 = require("./plan-de-cuentas");
/**
 * Siembra del ambiente de prueba (Fase 1 del self-service).
 *
 * Dos diferencias esenciales con `functions/scripts/seed-tenant.mjs`:
 *
 * 1. **IDs prefijados por tenant.** El seed de Las Playas usa doc IDs
 *    hardcodeados (`unit.id`, `p.id`…), así que dos ambientes sembrados
 *    chocarían entre sí. Aquí todo doc lleva `${tenantId}--${local}`, que es lo
 *    que hace la siembra multi-tenant de verdad.
 *
 * 2. **Solo puebla lo que el prospecto NO va a cargar.** El plan decide que el
 *    conjunto arranque vacío en los módulos operativos (visitantes, paquetería,
 *    PQRS, comunicados, reservas) — esos los llena él y para eso está el
 *    checklist. Lo que se siembra son las **unidades de ejemplo mínimas** que
 *    sirven de andamio y **todo el bloque financiero**, porque los módulos en
 *    vista previa (Cartera, Egresos, Libro, Conciliación) tienen que verse
 *    llenos: un módulo financiero vacío no vende nada.
 *
 * Las fechas son relativas a hoy, así que el ambiente nunca "envejece".
 */
/** Perezoso: `initializeApp()` corre en index.ts y los imports se evalúan antes. */
function getDb() {
    return (0, firestore_1.getFirestore)();
}
/** Marca visible para que el prospecto distinga lo sembrado de lo suyo. */
exports.EXAMPLE_TAG = "Ejemplo";
/**
 * **El id de documento de una unidad sembrada, en un solo sitio.**
 *
 * Es la CLAVE de esa unidad (D1), y `trial-workspace.ts` la necesita para darle
 * unidad al residente de prueba. La llevaba escrita a mano como
 * `` `${tenantId}--t1-101` ``: dos sitios calculando el mismo id, y el día que el
 * esquema cambiara el residente de prueba quedaría apuntando a una unidad que no
 * existe — sin error, viendo una lista vacía, que es el defecto que persigue
 * `PRD-V-FIX-002`.
 */
function idDeUnidadSembrada(tenantId, slug) {
    return `${tenantId}--${slug}`;
}
/** El slug de la primera unidad sembrada. Es la que recibe el residente de prueba. */
exports.SLUG_PRIMERA_UNIDAD = "t1-101";
const UNITS_PER_TOWER = 3;
const TOWERS = ["Torre 1", "Torre 2"];
/** Meses de historia financiera (incluye el actual). */
const FINANCE_MONTHS = 4;
const MONTHLY_FEE = 850_000;
function dateStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function periodStr(monthsAgo) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Último día del período, como fecha de vencimiento. */
function dueDateFor(monthsAgo) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsAgo + 1);
    d.setDate(0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/**
 * Siembra el ambiente de prueba. Idempotente: todo se escribe con `merge` sobre
 * IDs deterministas, así que repetirla no duplica nada.
 */
async function seedTrialWorkspace(tenantId, currency = "MXN") {
    /** Todo doc del ambiente lleva el tenantId por delante — sin esto, colisión. */
    const id = (local) => idDeUnidadSembrada(tenantId, local);
    const now = firestore_1.FieldValue.serverTimestamp();
    const stats = {};
    const db = getDb();
    let batch = db.batch();
    let ops = 0;
    // Firestore limita a 500 operaciones por batch.
    const commitIfNeeded = async () => {
        ops += 1;
        if (ops >= 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    };
    const set = async (collection, docId, data) => {
        batch.set(db.collection(collection).doc(docId), { ...data, tenantId, createdAt: now, updatedAt: now }, { merge: true });
        await commitIfNeeded();
    };
    // ── Unidades de ejemplo (andamio del bloque financiero) ────────────────────
    //
    // **ESTA ERA LA FÁBRICA DE LA CONVENCIÓN MINORITARIA** (`PRD-V-FIX-002`, §12).
    // El documento de la unidad se crea con id `${tenantId}--${slug}` y su campo
    // `unitId` guarda el slug pelado; hasta el 26 de agosto de 2026 las personas y
    // los cargos sembrados apuntaban al SLUG, así que **todo conjunto nacido del
    // trial nacía partido**: `tenantUsers.unitId` acaba siendo el id del documento
    // y `residentOwnUnit` compara contra él, de modo que el residente de prueba
    // veía su cartera vacía sin un solo error en pantalla.
    //
    // Ahora la clave sale del resolvedor único (R6) y es el **id del documento**.
    // El campo `unitId` del documento de la unidad se sigue escribiendo porque hay
    // lectores que lo usan —su retirada es Fase 2—, pero ya no lo nombra nadie.
    const units = [];
    for (const tower of TOWERS) {
        const towerNum = tower.slice(-1);
        for (let i = 1; i <= UNITS_PER_TOWER; i++) {
            const slug = `t${towerNum}-${i}0${i}`;
            const label = `T${towerNum}-${i}0${i}`;
            units.push({ id: id(slug), slug, label, tower });
            await set("units", id(slug), {
                unitId: slug,
                displayName: label,
                tower,
                type: "apartment",
                status: "active",
                ownerIds: [],
                residentIds: [],
                isExample: true,
            });
        }
    }
    stats.units = units.length;
    // ── Personas de ejemplo (una por unidad) ───────────────────────────────────
    const NOMBRES = ["Ana Torres", "Luis Medina", "Carmen Ruiz", "Diego Salas", "Paula Vega", "Mario Cano"];
    for (const [i, unit] of units.entries()) {
        await set("people", id(`person-${unit.slug}`), {
            fullName: `${NOMBRES[i % NOMBRES.length]} (${exports.EXAMPLE_TAG})`,
            email: `ejemplo.${unit.slug}@ejemplo.vivaru.app`,
            phone: "",
            documentNumber: "",
            roleType: "owner_occupant",
            occupancyType: "owner_occupant",
            unitId: (0, clave_de_unidad_1.claveDeUnidad)(unit),
            tower: unit.tower,
            status: "active",
            isExample: true,
        });
    }
    stats.people = units.length;
    // ── Amenidades: para que Reservas funcione desde el primer minuto ──────────
    const amenities = [
        { local: "salon", name: "Salón comunal", category: "social" },
        { local: "gimnasio", name: "Gimnasio", category: "deportiva" },
        { local: "piscina", name: "Piscina", category: "social" },
    ];
    for (const a of amenities) {
        await set("amenities", id(`amenity-${a.local}`), {
            name: a.name,
            category: a.category,
            status: "active",
            isExample: true,
        });
    }
    stats.amenities = amenities.length;
    // ── Cartera: FINANCE_MONTHS de historia con mora realista ──────────────────
    // Mezcla deliberada de pagado / parcial / vencido para que el semáforo de
    // cartera y el tablero de mora se vean vivos en la vista previa.
    let billingCount = 0;
    const bankAccountId = id("bank-principal");
    for (let m = FINANCE_MONTHS - 1; m >= 0; m--) {
        const period = periodStr(m);
        const due = dueDateFor(m);
        for (const [index, unit] of units.entries()) {
            // Los meses viejos están pagados; el actual queda mayormente pendiente.
            const isOld = m >= 2;
            const unpaid = !isOld && (index % 3 === 0);
            const partial = !isOld && index % 3 === 1;
            const paymentAmount = isOld ? MONTHLY_FEE : unpaid ? 0 : partial ? MONTHLY_FEE / 2 : MONTHLY_FEE;
            const balance = MONTHLY_FEE - paymentAmount;
            await set("billingStatements", id(`bill-${period}-${unit.slug}`), {
                unitId: (0, clave_de_unidad_1.claveDeUnidad)(unit),
                unitLabel: unit.label,
                period,
                concept: "administracion",
                accountCode: (0, plan_de_cuentas_1.cuentaParaConcepto)("administracion").code,
                amount: MONTHLY_FEE,
                paymentAmount,
                balance,
                status: balance <= 0 ? "paid" : "pending",
                dueDate: due,
                isExample: true,
            });
            billingCount += 1;
        }
    }
    stats.billingStatements = billingCount;
    // ── Cuenta bancaria + libro + egresos + conciliación ───────────────────────
    await set("bankAccounts", bankAccountId, {
        label: "Cuenta principal",
        bankName: "Banco de ejemplo",
        accountNumber: "0000000000",
        accountType: "corriente",
        currency,
        // **`openingBalance` NO va aquí.** `FLOW-002` lo sacó a `bankAccountBalances`
        // para poder abrir la lectura de `bankAccounts` al residente: las reglas
        // conceden el documento entero y no se pueden ocultar campos, así que dejarlo
        // dentro enseñaría con cuánto dinero abrió cada cuenta el conjunto. Escribía
        // un cero, que no filtra nada, pero devolvía el campo al sitio del que la
        // migración lo había sacado — y la siguiente semilla ya no sería un cero.
        active: true,
        isExample: true,
    });
    await set("bankAccountBalances", bankAccountId, { openingBalance: 0, isExample: true });
    stats.bankAccounts = 1;
    // Las categorías tienen que ser valores de `ExpenseCategory` (`src/types/domain.ts`).
    // Hasta hoy dos no lo eran —`servicios` y `seguridad`— y el `set()` de esta
    // semilla no está tipado, así que compilaba y se escribía igual. El daño se veía
    // en pantalla: el estado financiero de todo conjunto de trial mostraba «servicios»
    // y «seguridad» en crudo y minúscula, porque `categoryLabel` devuelve la clave
    // cuando no la conoce. Y sin arreglarlo no hay cuenta que estampar.
    //
    // `vigilancia` YA tiene cuenta propia (2.9), decidido por David el 23 de agosto
    // de 2026. Estuvo unas horas en `proveedores` porque era lo correcto disponible
    // mientras el plan no la tenía. `trial-seed-categorias.test.ts` vigila que no se
    // vuelva a inventar una categoría que no existe.
    const gastos = [
        { local: "energia", category: "servicios_publicos", description: "Energía áreas comunes", vendor: "Comisión de Electricidad", amount: 1_250_000 },
        { local: "agua", category: "servicios_publicos", description: "Suministro de agua", vendor: "Servicio de Aguas", amount: 640_000 },
        { local: "aseo", category: "mantenimiento", description: "Aseo y limpieza", vendor: "Servicios Integrales", amount: 900_000 },
        { local: "vigilancia", category: "vigilancia", description: "Vigilancia y portería", vendor: "Seguridad Total", amount: 2_100_000 },
    ];
    let expenseCount = 0;
    let ledgerCount = 0;
    for (let m = FINANCE_MONTHS - 1; m >= 0; m--) {
        for (const g of gastos) {
            const local = `${g.local}-${periodStr(m)}`;
            const paid = m > 0;
            const issue = dateStr(-(m * 30 + 5));
            await set("expenses", id(`exp-${local}`), {
                category: g.category,
                accountCode: (0, plan_de_cuentas_1.cuentaParaCategoriaDeEgreso)(g.category).code,
                description: g.description,
                vendorName: g.vendor,
                amount: g.amount,
                issueDate: issue,
                status: paid ? "pagado" : "registrado",
                paymentMethod: paid ? "transferencia" : null,
                bankAccountId,
                isExample: true,
                ...(paid ? { paidAt: issue, ledgerEntryId: id(`ledger-exp-${local}`) } : {}),
            });
            expenseCount += 1;
            if (paid) {
                await set("ledgerEntries", id(`ledger-exp-${local}`), {
                    type: "egreso",
                    date: issue,
                    amount: g.amount,
                    concept: g.description,
                    category: g.category,
                    accountCode: (0, plan_de_cuentas_1.cuentaParaCategoriaDeEgreso)(g.category).code,
                    bankAccountId,
                    sourceType: "expense",
                    sourceId: id(`exp-${local}`),
                    reconciled: false,
                    isExample: true,
                });
                ledgerCount += 1;
            }
        }
    }
    stats.expenses = expenseCount;
    stats.ledgerEntries = ledgerCount;
    await batch.commit();
    return stats;
}
