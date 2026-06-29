import { expect, test as setup } from '@playwright/test';
import { waitForFocalboard } from './waitForFocalboard';

/**
 * Auth setup project (issue #3).
 *
 * Runs once before the browser projects. It:
 *   1. gates on Focalboard readiness (GET /login -> 200),
 *   2. registers a fresh user, or — since registration only succeeds once per
 *      container — falls back to logging in if the user already exists,
 *   3. dismisses the first-run welcome dialog,
 *   4. asserts we are authenticated (board UI ready, not on /login),
 *   5. saves storageState to .auth/user.json for the browser projects to reuse.
 *
 * Credentials and selectors are locked to docs/spike-findings.md.
 */
const STORAGE_STATE = '.auth/user.json';
const BASE_URL = 'http://localhost:8088';

const EMAIL = 'e2e@example.com';
const USERNAME = 'e2e';
const PASSWORD = 'Test-passw0rd!';

setup('register-or-login and save storage state', async ({ page }) => {
  await waitForFocalboard(BASE_URL);

  // Try the first-run registration path.
  await page.goto('/register');
  await page.locator('#login-email').fill(EMAIL);
  await page.locator('#login-username').fill(USERNAME);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('button[type=submit]').click();

  // If the user already exists (container was registered earlier), Focalboard
  // keeps us on an auth page. Fall back to logging in.
  await page.waitForLoadState('networkidle');
  if (/\/(register|login)/.test(new URL(page.url()).pathname)) {
    await page.goto('/login');
    await page.locator('#login-username').fill(USERNAME);
    await page.locator('#login-password').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForLoadState('networkidle');
  }

  // Dismiss the first-run welcome / tour dialog if present.
  const closeDialog = page.locator('button[aria-label="Close dialog"]');
  if (await closeDialog.isVisible().catch(() => false)) {
    await closeDialog.click();
  }
  await page.keyboard.press('Escape');

  // Assert authenticated: board UI ready and not bounced back to /login.
  await expect(page.locator('.add-board')).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).not.toBe('/login');

  await page.context().storageState({ path: STORAGE_STATE });
});
