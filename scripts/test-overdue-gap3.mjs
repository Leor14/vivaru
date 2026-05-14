/**
 * Test script for GAP 3 — updateOverdueStatements
 * Usage:
 *   node scripts/test-overdue-gap3.mjs seed    → insert test doc
 *   node scripts/test-overdue-gap3.mjs check   → verify status
 *   node scripts/test-overdue-gap3.mjs cleanup → delete test doc
 */
import { readFileSync } from "fs";

const toolsConfig = JSON.parse(
  readFileSync(`${process.env.HOME}/.config/configstore/firebase-tools.json`, "utf8")
);
const PROJECT = "hogaru-1";
const COLLECTION = "billingStatements";
const DOC_ID = "TEST-OVERDUE-GAP3";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getAccessToken() {
  return toolsConfig.tokens.access_token;
}

const cmd = process.argv[2];
const token = getAccessToken();

if (cmd === "seed") {
  const now = new Date().toISOString();
  const body = {
    fields: {
      tenantId: { stringValue: "tenant-santa-maria" },
      status: { stringValue: "pending" },
      dueDate: { stringValue: "2026-04-01" },
      unitId: { stringValue: "TEST-UNIT-001" },
      unitLabel: { stringValue: "TEST-101" },
      concept: { stringValue: "Test GAP3 - borrar despues" },
      amount: { doubleValue: 0 },
      paymentAmount: { doubleValue: 0 },
      balance: { doubleValue: 0 },
      createdAt: { timestampValue: now },
    },
  };
  const res = await fetch(`${BASE}/${COLLECTION}/${DOC_ID}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.ok) {
    console.log("✅ Documento de prueba creado:", DOC_ID);
    console.log("   status: pending | dueDate: 2026-04-01");
  } else {
    console.error("❌ Error:", JSON.stringify(data, null, 2));
  }
} else if (cmd === "check") {
  const res = await fetch(`${BASE}/${COLLECTION}/${DOC_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (res.ok) {
    const status = data.fields?.status?.stringValue ?? "(no status)";
    const dueDate = data.fields?.dueDate?.stringValue ?? "(no dueDate)";
    console.log(`📋 Doc: ${DOC_ID}`);
    console.log(`   status  : ${status}`);
    console.log(`   dueDate : ${dueDate}`);
    if (status === "overdue") {
      console.log("✅ PASS — status cambió a overdue correctamente");
    } else if (status === "pending") {
      console.log("⏳ PENDING — función aún no ha corrido o no procesó el doc");
    } else {
      console.log(`⚠️  status inesperado: ${status}`);
    }
  } else {
    console.error("❌ Error fetching doc:", JSON.stringify(data, null, 2));
  }
} else if (cmd === "cleanup") {
  const res = await fetch(`${BASE}/${COLLECTION}/${DOC_ID}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    console.log("🗑  Documento de prueba eliminado:", DOC_ID);
  } else {
    const data = await res.json();
    console.error("❌ Error deleting:", JSON.stringify(data, null, 2));
  }
} else {
  console.log("Uso: node scripts/test-overdue-gap3.mjs [seed|check|cleanup]");
}
