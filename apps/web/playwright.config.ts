import { defineConfig, devices } from '@playwright/test'
import { API_PORT, WEB_PORT } from './e2e/config'

/**
 * e2e tests never touch the dev stack on :5173/:3000 (already running under
 * `docker compose` throughout local dev, seeded with hand-curated demo data
 * — see docs/handoff). They run against a dedicated Vite server + API
 * instance on these ports, backed by apps/api/.env.test's `cockpit_test`
 * database (same local Postgres as dev, separate DB — see .env.test).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  // `test:e2e:prepare` applies migrations and replays the seed against
  // cockpit_test — idempotent (findFirst/upsert), it does NOT truncate, so
  // trips/users created by a previous local run accumulate rather than reset
  // (specs must not assume a fixed ref — see booking-lifecycle.spec.ts's
  // module comment). Only apps/api/test/utils/reset-db.ts (the Jest e2e
  // suite, unrelated to Playwright) truncates. Reused across a whole local
  // run (`reuseExistingServer`); CI always starts clean regardless.
  webServer: [
    {
      // `start:e2e` = plain `nest start` against .env.test — the same build
      // path apps/api/Dockerfile's `prod` stage uses (`nest build` +
      // `node dist/main.js`). Two real bugs made that path crash at boot
      // until fixed this session: (1) @nestjs/swagger's CLI plugin emitting
      // absolute-path require()s instead of relative ones for any repo
      // checkout path containing non-ASCII characters — patched via pnpm
      // (see patches/@nestjs__swagger@11.4.7.patch); (2) `multer` used
      // directly in nameboard-upload.config.ts but never declared as a
      // runtime dependency (only @types/multer was) — added to
      // apps/api/package.json. Dev's `nest start --watch` never hit either
      // one (webpack bundling papers over both), so they went unnoticed.
      command:
        'pnpm --filter @cockpit/api test:e2e:prepare && pnpm --filter @cockpit/api start:e2e',
      cwd: '../..',
      url: `http://localhost:${API_PORT}/api/auth/me`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT}`,
      cwd: '.',
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
})
