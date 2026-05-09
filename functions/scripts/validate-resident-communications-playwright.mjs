import { chromium } from "playwright";

const baseUrl = process.env.VALIDATION_BASE_URL || "https://vivaru--hogaru-1.us-central1.hosted.app";
const email = process.env.VALIDATION_RESIDENT_EMAIL || "residente@santamaria.co";
const password = process.env.VALIDATION_RESIDENT_PASSWORD || "Demo1234*";

const titles = {
  valid: "[QA] Comunicado vigente residente",
  expired: "[QA] Comunicado vencido residente",
  scheduled: "[QA] Comunicado programado residente",
};

const validBodySnippet = "detalle completo del comunicado vigente";
const validAttachment = "Manual de convivencia.pdf";

async function textContains(page, selector, text) {
  const content = await page.locator(selector).allInnerTexts();
  return content.some((value) => value.includes(text));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = {
    baseUrl,
    checks: {},
  };

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /Ingresar/i }).click();

  await page.waitForURL(/\/resident(\/|$)/, { timeout: 30000 });

  await page.goto(`${baseUrl}/resident/communications`, { waitUntil: "networkidle" });
  report.checks.residentCommunications = {
    validVisible: await textContains(page, "main, section, body", titles.valid),
    validBodyVisible: await textContains(page, "main, section, body", validBodySnippet),
    validAttachmentVisible: await textContains(page, "main, section, body", validAttachment),
    expiredHidden: !(await textContains(page, "main, section, body", titles.expired)),
    scheduledHidden: !(await textContains(page, "main, section, body", titles.scheduled)),
  };

  await page.goto(`${baseUrl}/resident`, { waitUntil: "networkidle" });
  report.checks.residentHome = {
    validVisible: await textContains(page, "main, section, body", titles.valid),
    validBodyVisible: await textContains(page, "main, section, body", validBodySnippet),
    validAttachmentVisible: await textContains(page, "main, section, body", validAttachment),
    expiredHidden: !(await textContains(page, "main, section, body", titles.expired)),
    scheduledHidden: !(await textContains(page, "main, section, body", titles.scheduled)),
  };

  const allChecks = [
    ...Object.values(report.checks.residentCommunications),
    ...Object.values(report.checks.residentHome),
  ];

  report.pass = allChecks.every(Boolean);

  console.log(JSON.stringify(report, null, 2));

  await browser.close();

  if (!report.pass) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Resident communications validation failed:", error);
  process.exitCode = 1;
});
