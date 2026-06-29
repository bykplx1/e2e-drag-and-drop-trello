import { expect, test } from '@playwright/test';

/**
 * Walking-skeleton smoke test (issue #3).
 *
 * Proves the thinnest end-to-end path: an authenticated browser (storageState
 * from the setup project) can load the app and the board UI is ready.
 *
 * Readiness per docs/spike-findings.md: after auth we land on the app (not
 * /login) and the sidebar "+ Add board" affordance (`.add-board`) is visible.
 */
test('authenticated user lands on a ready board UI', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.add-board')).toBeVisible();
  expect(new URL(page.url()).pathname).not.toBe('/login');
});
