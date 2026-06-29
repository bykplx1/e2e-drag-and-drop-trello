import { defineConfig, devices } from '@playwright/test';

/**
 * Walking-skeleton config (issue #3).
 *
 * - `setup` project runs auth/*.setup.ts: it gates on Focalboard readiness,
 *   registers-or-logs-in once, and persists storageState to .auth/user.json.
 * - chromium/firefox/webkit each depend on `setup` and reuse that storageState,
 *   so they start already authenticated.
 */
const STORAGE_STATE = '.auth/user.json';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8088',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
});
