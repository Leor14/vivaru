"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXAMPLE_TAG = void 0;
exports.seedTrialWorkspace = seedTrialWorkspace;
const firestore_1 = require("firebase-admin/firestore");
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
    const id = (local) => `${tenantId}--${local}`;
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
    const units = [];
    for (const tower of TOWERS) {
        const towerNum = tower.slice(-1);
        for (let i = 1; i <= UNITS_PER_TOWER; i++) {
            const slug = `t${towerNum}-${i}0${i}`;
            const label = `T${towerNum}-${i}0${i}`;
            units.push({ slug, label, tower });
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
            unitId: unit.slug,
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
                unitId: unit.slug,
                unitLabel: unit.label,
                period,
                concept: "administracion",
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
        openingBalance: 0,
        active: true,
        isExample: true,
    });
    stats.bankAccounts = 1;
    const gastos = [
        { local: "energia", category: "servicios", description: "Energía áreas comunes", vendor: "Comisión de Electricidad", amount: 1_250_000 },
        { local: "agua", category: "servicios", description: "Suministro de agua", vendor: "Servicio de Aguas", amount: 640_000 },
        { local: "aseo", category: "mantenimiento", description: "Aseo y limpieza", vendor: "Servicios Integrales", amount: 900_000 },
        { local: "vigilancia", category: "seguridad", description: "Vigilancia y portería", vendor: "Seguridad Total", amount: 2_100_000 },
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
