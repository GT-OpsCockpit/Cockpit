/** Shared between playwright.config.ts and the test files — see playwright.config.ts for why these ports are dedicated to e2e. */
export const WEB_PORT = 5174
export const API_PORT = 3001
export const API_BASE_URL = `http://localhost:${API_PORT}`

export const dispatcherAuthFile = 'playwright/.auth/dispatcher.json'

// A dedicated DISPATCHER account for RBAC coverage (trip-cancel-rbac.spec.ts,
// provisioned by auth.setup.ts). Not part of apps/api/prisma/seed-data.ts's
// seedFixtures() on purpose — that baseline is shared with local dev, and this
// account only exists to prove a non-Admin role is actually blocked
// server-side, not to be a dev fixture.
export const DISPATCHER = {
  email: 'dispatcher.e2e@cockpit.test',
  password: 'Dispatcher-E2E-2026!',
  firstName: 'Dana',
  lastName: 'Dispatcher',
  // Required by CreateUserDto since the §15 parity pass (2026-08-29) — the
  // legacy asked it of every access account too (server.js:262-264). Omitting
  // it made auth.setup.ts fail with a 400, which took the whole web e2e suite
  // down with it.
  phone: '+33612000001',
}
