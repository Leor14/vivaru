/**
 * seed-tenant.mjs
 *
 * Script orquestador de seed demo para tenants profesionales.
 * Patrón: ESM + Admin SDK ADC, igual que seed-demo-users.mjs.
 *
 * USO:
 *   node functions/scripts/seed-tenant.mjs --tenant=co
 *   node functions/scripts/seed-tenant.mjs --tenant=mx
 *   node functions/scripts/seed-tenant.mjs --tenant=all
 *   CLEAR=true node functions/scripts/seed-tenant.mjs --tenant=co
 *
 * REQUISITOS:
 *   - Node 18+
 *   - GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
 *     (o usar Application Default Credentials: gcloud auth application-default login)
 *   - FIREBASE_PROJECT_ID=hogaru-1 (opcional, default: hogaru-1)
 *
 * El script es idempotente: todas las escrituras usan setDoc { merge: true }.
 * Si CLEAR=true: borra todos los docs del tenant antes de re-sembrar.
 * NOTA: Los usuarios Auth NUNCA se borran (solo se desactivan).
 */

import admin from "firebase-admin";

// ── Data modules ──────────────────────────────────────────────────────────────
import {
  TENANT_CO, USERS_CO, UNITS_CO, PEOPLE_CO, AMENITIES_CO,
  BILLING_CO, PQRS_CO, VISITORS_CO, PACKAGES_CO, COMMUNICATIONS_CO, RESERVATIONS_CO,
} from "./seed-data-co.mjs";

import {
  TENANT_MX, USERS_MX, UNITS_MX, PEOPLE_MX, AMENITIES_MX,
  BILLING_MX, PQRS_MX, VISITORS_MX, PACKAGES_MX, COMMUNICATIONS_MX, RESERVATIONS_MX,
} from "./seed-data-mx.mjs";

import {
  TENANT_PLAYAS, MODULE_VARIANTS_PLAYAS, RESIDENT_MODULES_PLAYAS,
  USERS_PLAYAS, UNITS_PLAYAS, PEOPLE_PLAYAS, AMENITIES_PLAYAS,
  BILLING_PLAYAS, PAYMENT_RECEIPTS_PLAYAS, PQRS_PLAYAS, VISITORS_PLAYAS,
  PACKAGES_PLAYAS, COMMUNICATIONS_PLAYAS, RESERVATIONS_PLAYAS,
  SURVEYS_PLAYAS, SURVEY_RESPONSES_PLAYAS, SURVEY_RESPONSE_COUNTS_PLAYAS, AGREEMENTS_PLAYAS,
  CAMPAIGNS_PLAYAS, BANK_ACCOUNTS_PLAYAS, EXPENSES_PLAYAS, LEDGER_PLAYAS, BANK_LINES_PLAYAS,
} from "./seed-data-playas.mjs";

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const CLEAR = process.env.CLEAR === "true";

const CLEARABLE_COLLECTIONS = [
  "tenants", "tenantSettings", "users", "tenantUsers", "units", "people",
  "amenities", "communications", "billingStatements", "billingCampaigns", "paymentReceipts",
  "packages", "visitors", "visitorPasses", "pqrs", "tickets",
  "reservations", "documents", "notifications",
  "surveys", "survey_responses", "committee_agreements", "committee_agreement_signatures",
  "expenses", "ledgerEntries", "bankAccounts", "bankStatementLines",
];

// ── CLI arg ───────────────────────────────────────────────────────────────────
const tenantArg = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];
if (!tenantArg || !["co", "mx", "playas", "all"].includes(tenantArg)) {
  console.error("Uso: node seed-tenant.mjs --tenant=co|mx|playas|all");
  process.exit(1);
}

// ── Admin init ────────────────────────────────────────────────────────────────
function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId: PROJECT_ID });
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function ts(offsetDays = 0) {
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

function dateStr(offsetDays = 0) {
  // Hora LOCAL (no UTC) para que la fecha "hoy" del seed coincida con el panel/módulos.
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Auth upsert ───────────────────────────────────────────────────────────────
async function upsertAuthUser(seed) {
  const auth = admin.auth();
  let user;
  try {
    user = await auth.getUserByEmail(seed.email);
    user = await auth.updateUser(user.uid, {
      email: seed.email,
      password: seed.password,
      displayName: seed.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err;
    user = await auth.createUser({
      email: seed.email,
      password: seed.password,
      displayName: seed.displayName,
      emailVerified: true,
      disabled: false,
    });
  }
  await auth.setCustomUserClaims(user.uid, {
    role: seed.role,
    tenantId: seed.tenantId ?? null,
  });
  return user;
}

// ── Clear tenant data ─────────────────────────────────────────────────────────
async function clearTenant(db, tenantId) {
  console.log(`\n[CLEAR] Borrando datos existentes de tenant: ${tenantId}`);
  let totalDeleted = 0;

  for (const col of CLEARABLE_COLLECTIONS) {
    try {
      const snap = await db.collection(col).where("tenantId", "==", tenantId).get();
      if (snap.empty) continue;

      const refs = snap.docs.map((d) => d.ref);
      // Batch delete in chunks of 500
      for (let i = 0; i < refs.length; i += 500) {
        const chunk = refs.slice(i, i + 500);
        const batch = db.batch();
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
      totalDeleted += refs.length;
      console.log(`  [CLEAR] ${col}: ${refs.length} doc(s) eliminados`);
    } catch (err) {
      console.warn(`  [WARN] No se pudo limpiar ${col}: ${err.message}`);
    }
  }

  // Tenant doc itself
  try {
    await db.collection("tenants").doc(tenantId).delete();
    console.log(`  [CLEAR] tenants/${tenantId} eliminado`);
    totalDeleted++;
  } catch (err) {
    console.warn(`  [WARN] No se pudo eliminar tenant doc: ${err.message}`);
  }

  console.log(`[CLEAR] Total: ${totalDeleted} documentos eliminados`);
}

// ── Main seed function ────────────────────────────────────────────────────────
async function seedTenant(tenantData, users, units, people, amenities, billing,
                          pqrs, visitors, packages, communications, reservations, extras = {}) {
  const db = admin.firestore();
  const now = ts(0);
  const tenantId = tenantData.id;
  const stats = {};

  if (CLEAR) {
    await clearTenant(db, tenantId);
  }

  console.log(`\n[SEED] Iniciando seed para: ${tenantData.name} (${tenantId})`);

  // 1. Tenant doc
  await db.collection("tenants").doc(tenantId).set({
    name: tenantData.name,
    city: tenantData.city,
    country: tenantData.country,
    ...(tenantData.currency ? { currency: tenantData.currency } : {}),
    planId: tenantData.planId,
    status: tenantData.status,
    onboardingStatus: tenantData.onboardingStatus,
    branding: tenantData.branding,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  stats.tenants = 1;
  console.log(`  ✓ tenants: 1`);

  // 1b. tenantSettings (moduleVariants + residentModules) — solo si se pasan extras.
  if (extras.moduleVariants || extras.residentModules) {
    await db.collection("tenantSettings").doc(tenantId).set({
      tenantId,
      tenantName: tenantData.name,
      brandColor: tenantData.branding?.primaryColor ?? "#0b3c5d",
      ...(extras.moduleVariants ? { moduleVariants: extras.moduleVariants } : {}),
      ...(extras.residentModules ? { residentModules: extras.residentModules } : {}),
      updatedAt: now,
    }, { merge: true });
    stats.tenantSettings = 1;
    console.log(`  ✓ tenantSettings: 1`);
  }

  // 2–3. Auth + users + tenantUsers
  let usersCount = 0;
  for (const seed of users) {
    const user = await upsertAuthUser(seed);
    await db.collection("users").doc(user.uid).set({
      uid: user.uid,
      email: seed.email,
      fullName: seed.displayName,
      role: seed.role,
      tenantId: seed.tenantId ?? null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...(seed.unitId ? { unitId: seed.unitId } : {}),
      ...(seed.unitLabel ? { unitLabel: seed.unitLabel } : {}),
    }, { merge: true });

    if (seed.tenantId) {
      await db.collection("tenantUsers").doc(`${seed.tenantId}_${user.uid}`).set({
        uid: user.uid,
        tenantId: seed.tenantId,
        fullName: seed.displayName,
        email: seed.email,
        role: seed.role,
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...(seed.unitId ? { unitId: seed.unitId } : {}),
        ...(seed.unitLabel ? { unitLabel: seed.unitLabel } : {}),
      }, { merge: true });
    }
    usersCount++;
  }
  stats.users = usersCount;
  console.log(`  ✓ users + tenantUsers: ${usersCount}`);

  // 4. Units (ID = slug = unitId field)
  for (const unit of units) {
    await db.collection("units").doc(unit.id).set({
      tenantId,
      unitId: unit.unitId,   // ← slug, IMP-01/02 compatible
      displayName: unit.displayName,
      tower: unit.tower,
      type: "apartment",
      status: "active",
      ownerIds: [],
      residentIds: [],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  stats.units = units.length;
  console.log(`  ✓ units: ${units.length}`);

  // 5. People (unitId = slug)
  for (const p of people) {
    await db.collection("people").doc(p.id).set({
      tenantId,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      documentNumber: p.documentNumber ?? "",
      roleType: p.roleType,
      occupancyType: p.occupancyType,
      unitId: p.unitId,    // ← slug, IMP-02 compatible
      tower: p.tower,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  stats.people = people.length;
  console.log(`  ✓ people: ${people.length}`);

  // 6. Amenities
  for (const a of amenities) {
    await db.collection("amenities").doc(a.id).set({
      tenantId,
      name: a.name,
      category: a.category,
      status: a.status,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  stats.amenities = amenities.length;
  console.log(`  ✓ amenities: ${amenities.length}`);

  // 7. Communications
  for (const c of communications) {
    await db.collection("communications").doc(c.id).set({
      tenantId,
      title: c.title,
      message: c.message,
      status: c.status,
      startsAt: dateStr(c.startsOffsetDays),
      endsAt: dateStr(c.endsOffsetDays),
      publishedAt: now,
      createdBy: c.createdBy,
      createdAt: now,
      updatedAt: now,
      updatedBy: c.createdBy,
    }, { merge: true });
  }
  stats.communications = communications.length;
  console.log(`  ✓ communications: ${communications.length}`);

  // 8. BillingStatements (unitId = slug, IMP-01 compatible)
  for (const b of billing) {
    await db.collection("billingStatements").doc(b.id).set({
      tenantId,
      unitId: b.unitId,      // ← slug
      unitLabel: b.unitLabel,
      period: b.period,
      amount: b.amount,
      balance: b.balance,
      status: b.status,
      dueDate: b.dueDate ?? null,
      ...(b.concept ? { concept: b.concept } : {}),
      ...(b.source ? { source: b.source } : {}),
      ...(b.paymentAmount !== undefined ? { paymentAmount: b.paymentAmount } : {}),
      ...(b.lastPaymentAt ? { lastPaymentAt: b.lastPaymentAt } : {}),
      ...(b.campaignId ? { campaignId: b.campaignId } : {}),
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  stats.billingStatements = billing.length;
  console.log(`  ✓ billingStatements: ${billing.length}`);

  // 9. Packages
  for (const p of packages) {
    await db.collection("packages").doc(p.id).set({
      tenantId,
      unitId: p.unitId,
      unitLabel: p.unitLabel,
      recipientName: p.recipientName,
      reference: p.reference,
      description: p.description,
      status: p.status === "pending_pickup" ? "pending" : p.status,
      arrivedAt: ts(p.arrivedOffsetDays).toDate().toISOString(),
      ...(p.deliveredOffsetDays !== undefined ? {
        deliveredAt: ts(p.deliveredOffsetDays).toDate().toISOString(),
        deliveredToName: p.deliveredToName,
      } : {}),
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  stats.packages = packages.length;
  console.log(`  ✓ packages: ${packages.length}`);

  // 10. Visitors + visitorPasses (same data, two collections for admin vs guard views)
  for (const v of visitors) {
    const visitDate = dateStr(v.offsetDays);
    const scheduledTime = ts(v.offsetDays).toDate().toISOString();
    const baseDoc = {
      tenantId,
      unitId: v.unitId,
      unitLabel: v.unitLabel,
      tower: v.tower,
      unit: v.unit,
      visitorName: v.visitorName,
      documentNumber: v.documentNumber,
      qrCodeValue: v.qrCodeValue,
      hostResidentName: v.hostResidentName,
      visitorCategory: v.visitorCategory,
      date: visitDate,
      scheduledTime,
      status: v.status,
      ...(v.status === "inside" || v.status === "completed" ? { checkInAt: scheduledTime } : {}),
      ...(v.status === "completed" ? { checkOutAt: ts(v.offsetDays + 1).toDate().toISOString() } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("visitors").doc(v.id).set(baseDoc, { merge: true });
    await db.collection("visitorPasses").doc(v.id).set(baseDoc, { merge: true });
  }
  stats.visitors = visitors.length;
  console.log(`  ✓ visitors + visitorPasses: ${visitors.length}`);

  // 11. PQRS / tickets (la app lee de la colección "tickets")
  for (const t of pqrs) {
    const radicationDate = dateStr(t.radicationOffsetDays);
    await db.collection("tickets").doc(t.id).set({
      tenantId,
      unitId: t.unitId,
      unitLabel: t.unitLabel,
      category: t.category,
      type: t.type,
      subject: t.subject,
      message: t.message,
      status: t.status,
      priority: t.priority,
      radicationDate,
      createdAt: ts(t.radicationOffsetDays),
      updatedAt: now,
      residentName: t.residentName ?? "",
      ...(t.response ? {
        response: t.response,
        respondedAt: ts(t.respondedAt ?? t.radicationOffsetDays + 2).toDate().toISOString(),
      } : {}),
    }, { merge: true });
  }
  stats.pqrs = pqrs.length;
  console.log(`  ✓ pqrs: ${pqrs.length}`);

  // 12. Reservations
  for (const r of reservations) {
    await db.collection("reservations").doc(r.id).set({
      tenantId,
      amenityName: r.amenityName,
      unitId: r.unitId,
      unitLabel: r.unitLabel,
      reservedBy: r.reservedBy,
      date: dateStr(r.dateOffsetDays),
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      paymentConfirmed: r.paymentConfirmed ?? false,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  stats.reservations = reservations.length;
  console.log(`  ✓ reservations: ${reservations.length}`);

  // 13. Payment receipts (comprobantes subidos por residentes, pendientes de revisión)
  const receipts = extras.paymentReceipts ?? [];
  for (const r of receipts) {
    await db.collection("paymentReceipts").doc(r.id).set({
      tenantId,
      unitId: r.unitId,
      unitLabel: r.unitLabel,
      statementId: r.statementId,
      uploadedByName: r.uploadedByName,
      amount: r.amount,
      status: r.status,
      fileName: r.fileName,
      fileUrl: "",
      uploadedAt: ts(r.uploadedOffsetDays ?? -1).toDate().toISOString(),
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  if (receipts.length) { stats.paymentReceipts = receipts.length; console.log(`  ✓ paymentReceipts: ${receipts.length}`); }

  // 14. Surveys + responses
  const surveys = extras.surveys ?? [];
  for (const s of surveys) {
    await db.collection("surveys").doc(s.id).set({
      tenantId,
      title: s.title,
      description: s.description,
      questions: s.questions,
      targetAudience: { type: "all" },
      minResponsesForResults: s.minResponsesForResults ?? 3,
      responseCount: extras.surveyResponseCounts?.[s.id] ?? s.responseCount ?? 0,
      status: s.status,
      createdBy: s.createdBy,
      createdAt: ts(s.createdOffsetDays ?? -5),
      updatedAt: now,
      ...(s.closingOffsetDays !== undefined ? { closingDate: dateStr(s.closingOffsetDays) } : {}),
    }, { merge: true });
  }
  if (surveys.length) { stats.surveys = surveys.length; console.log(`  ✓ surveys: ${surveys.length}`); }

  const surveyResponses = extras.surveyResponses ?? [];
  for (const sr of surveyResponses) {
    await db.collection("survey_responses").doc(sr.id).set({
      tenantId,
      surveyId: sr.surveyId,
      respondentUid: sr.respondentUid ?? null,
      respondentName: sr.respondentName ?? "",
      unitId: sr.unitId ?? null,
      answers: sr.answers,
      respondedAt: ts(sr.respondedOffsetDays ?? -10),
      createdAt: ts(sr.respondedOffsetDays ?? -10),
      updatedAt: now,
    }, { merge: true });
  }
  if (surveyResponses.length) { stats.surveyResponses = surveyResponses.length; console.log(`  ✓ survey_responses: ${surveyResponses.length}`); }

  // 15. Committee agreements + signatures
  const agreements = extras.agreements ?? [];
  let signaturesCount = 0;
  for (const a of agreements) {
    const sessionDate = dateStr(a.sessionOffsetDays ?? -15);
    await db.collection("committee_agreements").doc(a.id).set({
      tenantId,
      title: a.title,
      sessionDate,
      eventDate: sessionDate,
      signatureMode: a.signatureMode,
      signerScope: a.signerScope ?? "all",
      status: a.status ?? "enviado",
      fileUrl: a.fileUrl ?? "",
      createdBy: a.createdBy,
      createdAt: ts(a.sessionOffsetDays ?? -15),
      updatedAt: now,
    }, { merge: true });

    for (const unitId of a.signedUnitIds ?? []) {
      const sigId = `sig-${a.id}-${unitId}`;
      await db.collection("committee_agreement_signatures").doc(sigId).set({
        tenantId,
        agreementId: a.id,
        unitId,
        signedBy: unitId,
        signatureDate: dateStr((a.sessionOffsetDays ?? -15) + 1),
        status: "signed",
        createdAt: ts((a.sessionOffsetDays ?? -15) + 1),
        updatedAt: now,
      }, { merge: true });
      signaturesCount++;
    }
  }
  if (agreements.length) {
    stats.committee_agreements = agreements.length;
    stats.committee_agreement_signatures = signaturesCount;
    console.log(`  ✓ committee_agreements: ${agreements.length} (firmas: ${signaturesCount})`);
  }

  // 16. Financiero: campañas, cuentas bancarias, egresos, libro/fondos y conciliación.
  const campaigns = extras.campaigns ?? [];
  for (const c of campaigns) {
    await db.collection("billingCampaigns").doc(c.id).set({
      tenantId,
      concept: c.concept ?? "administracion",
      period: c.period,
      unitAmount: c.unitAmount,
      dueDate: c.dueDate ?? null,
      unitCount: c.unitCount,
      source: c.source ?? "immediate",
      status: c.status ?? "vigente",
      sentAt: ts(c.sentOffsetDays ?? -14),
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }
  if (campaigns.length) { stats.billingCampaigns = campaigns.length; console.log(`  ✓ billingCampaigns: ${campaigns.length}`); }

  const bankAccounts = extras.bankAccounts ?? [];
  for (const a of bankAccounts) {
    await db.collection("bankAccounts").doc(a.id).set({
      tenantId,
      label: a.label, bankName: a.bankName, accountNumber: a.accountNumber ?? null,
      accountType: a.accountType ?? "corriente", currency: a.currency ?? "MXN",
      openingBalance: a.openingBalance ?? 0, active: a.active !== false,
      createdAt: now, updatedAt: now,
    }, { merge: true });
  }
  if (bankAccounts.length) { stats.bankAccounts = bankAccounts.length; console.log(`  ✓ bankAccounts: ${bankAccounts.length}`); }

  const expenses = extras.expenses ?? [];
  for (const e of expenses) {
    const paid = e.status === "pagado";
    await db.collection("expenses").doc(e.id).set({
      tenantId,
      category: e.category, description: e.description,
      vendorName: e.vendorName ?? null, amount: e.amount,
      issueDate: dateStr(e.issueOffsetDays),
      ...(e.dueOffsetDays !== undefined ? { dueDate: dateStr(e.dueOffsetDays) } : {}),
      status: e.status,
      paymentMethod: e.paymentMethod ?? null,
      bankAccountId: e.bankAccountId ?? "bank-playas-001",
      ...(paid ? { paidAt: dateStr(e.paidOffsetDays ?? e.issueOffsetDays), ledgerEntryId: `ledger-out-${e.id}` } : {}),
      createdAt: now, updatedAt: now,
    }, { merge: true });
  }
  if (expenses.length) { stats.expenses = expenses.length; console.log(`  ✓ expenses: ${expenses.length}`); }

  const ledger = extras.ledger ?? [];
  for (const l of ledger) {
    await db.collection("ledgerEntries").doc(l.id).set({
      tenantId,
      type: l.type, date: l.date, amount: l.amount, concept: l.concept,
      category: l.category ?? null, bankAccountId: l.bankAccountId ?? "bank-playas-001",
      sourceType: l.sourceType ?? "manual", sourceId: l.sourceId ?? null,
      reconciled: false,
      createdAt: now, updatedAt: now,
    }, { merge: true });
  }
  if (ledger.length) { stats.ledgerEntries = ledger.length; console.log(`  ✓ ledgerEntries: ${ledger.length}`); }

  const bankLines = extras.bankLines ?? [];
  for (const bl of bankLines) {
    await db.collection("bankStatementLines").doc(bl.id).set({
      tenantId,
      bankAccountId: bl.bankAccountId ?? "bank-playas-001",
      date: bl.date, description: bl.description, amount: bl.amount,
      reconciled: bl.reconciled === true,
      matchedLedgerEntryId: bl.matchedLedgerEntryId ?? null,
      createdAt: now,
    }, { merge: true });
    // Si la línea está conciliada, marca el ledgerEntry como conciliado.
    if (bl.reconciled && bl.matchedLedgerEntryId) {
      await db.collection("ledgerEntries").doc(bl.matchedLedgerEntryId).set(
        { reconciled: true, reconciledAt: bl.date, bankStatementLineId: bl.id, updatedAt: now },
        { merge: true },
      );
    }
  }
  if (bankLines.length) { stats.bankStatementLines = bankLines.length; console.log(`  ✓ bankStatementLines: ${bankLines.length}`); }

  return stats;
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function run() {
  initAdmin();

  const targets = tenantArg === "all" ? ["co", "mx"] : [tenantArg];
  const allStats = {};

  for (const t of targets) {
    if (t === "co") {
      allStats.co = await seedTenant(
        TENANT_CO, USERS_CO, UNITS_CO, PEOPLE_CO, AMENITIES_CO,
        BILLING_CO, PQRS_CO, VISITORS_CO, PACKAGES_CO, COMMUNICATIONS_CO, RESERVATIONS_CO,
      );
    } else if (t === "mx") {
      allStats.mx = await seedTenant(
        TENANT_MX, USERS_MX, UNITS_MX, PEOPLE_MX, AMENITIES_MX,
        BILLING_MX, PQRS_MX, VISITORS_MX, PACKAGES_MX, COMMUNICATIONS_MX, RESERVATIONS_MX,
      );
    } else if (t === "playas") {
      allStats.playas = await seedTenant(
        TENANT_PLAYAS, USERS_PLAYAS, UNITS_PLAYAS, PEOPLE_PLAYAS, AMENITIES_PLAYAS,
        BILLING_PLAYAS, PQRS_PLAYAS, VISITORS_PLAYAS, PACKAGES_PLAYAS, COMMUNICATIONS_PLAYAS, RESERVATIONS_PLAYAS,
        {
          moduleVariants: MODULE_VARIANTS_PLAYAS,
          residentModules: RESIDENT_MODULES_PLAYAS,
          paymentReceipts: PAYMENT_RECEIPTS_PLAYAS,
          surveys: SURVEYS_PLAYAS,
          surveyResponses: SURVEY_RESPONSES_PLAYAS,
          surveyResponseCounts: SURVEY_RESPONSE_COUNTS_PLAYAS,
          agreements: AGREEMENTS_PLAYAS,
          campaigns: CAMPAIGNS_PLAYAS,
          bankAccounts: BANK_ACCOUNTS_PLAYAS,
          expenses: EXPENSES_PLAYAS,
          ledger: LEDGER_PLAYAS,
          bankLines: BANK_LINES_PLAYAS,
        },
      );
    }
  }

  console.log("\n[SEED] Resumen final:");
  for (const [tenant, stats] of Object.entries(allStats)) {
    const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
    console.log(`  ${tenant.toUpperCase()}: ${total} documentos totales`);
    for (const [col, count] of Object.entries(stats)) {
      console.log(`    - ${col}: ${count}`);
    }
  }
  console.log("\n[SEED] Completado exitosamente.");
}

run().catch((err) => {
  console.error("[SEED] Error:", err);
  process.exitCode = 1;
});
