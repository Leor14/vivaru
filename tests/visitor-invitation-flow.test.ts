// tests/visitor-invitation-flow.test.ts
// QA automatizado para el flujo de invitaciones de visitantes (Next.js + Playwright)

import { test, expect, type Page } from '@playwright/test';

// Ajusta estos datos según tu entorno de pruebas
const RESIDENT_EMAIL = 'residente@hogaru.co';
const RESIDENT_PASS = 'test1234';

// Utilidad para login
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', RESIDENT_EMAIL);
  await page.fill('input[type="password"]', RESIDENT_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/resident/);
}

test.describe('Flujo de invitaciones de visitantes', () => {
  test('Crear, ver detalle, QR y cancelar invitación', async ({ page }) => {
    await login(page);
    await page.goto('/resident/visitors/new');

    // Llenar formulario
    await page.fill('input[label="Nombre y apellido"]', 'Invitado QA');
    await page.fill('input[label="Identificación"]', '123456789');
    await page.fill('textarea[label*="Razón"]', 'Visita de prueba automatizada');
    await page.fill('input[type="date"]', '2026-03-12');
    await page.fill('input[type="time"]', '09:00');
    await page.locator('input[type="date"]').nth(1).fill('2026-03-12');
    await page.locator('input[type="time"]').nth(1).fill('18:00');
    // Usos, adultos, niños: dejar default
    await page.click('button[type="submit"]');

    // Esperar navegación al detalle
    await page.waitForURL(/\/resident\/visitors\//);
    await expect(page.locator('h1')).toHaveText(/Invitación/);
    await expect(page.locator('text=Invitado QA')).toBeVisible();
    await expect(page.locator('text=Visita de prueba automatizada')).toBeVisible();

    // Ir a QR
    await page.click('button:has-text("Ver invitación")');
    await page.waitForURL(/\/resident\/visitors\/.+\/qr/);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('text=Invitado QA')).toBeVisible();

    // Volver al detalle y cancelar
    await page.goBack();
    await page.click('button:has-text("Cancelar invitación")');
    await expect(page.locator('button:has-text("Invitación cancelada")')).toBeVisible();
    // Ir a QR y validar estado
    await page.click('button:has-text("Ver invitación")');
    await expect(page.locator('text=Invitación no activa')).toBeVisible();
  });
});
