import path from 'node:path'
import { test as setup } from '@playwright/test'
import { API_BASE_URL, DISPATCHER, dispatcherAuthFile } from './config'

// Reads ADMIN_EMAIL/ADMIN_PASSWORD straight from apps/api/.env.test instead of
// duplicating them here, so this stays in sync if that file ever changes.
process.loadEnvFile(path.resolve(import.meta.dirname, '../../api/.env.test'))

const authFile = 'playwright/.auth/admin.json'

async function login(request: import('@playwright/test').APIRequestContext, email: string, password: string) {
  const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email, password },
  })
  if (!loginResponse.ok()) {
    throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`)
  }
  // AUTH_DEV_OTP=true (apps/api/.env.test) returns the OTP straight in the
  // response instead of emailing it — see auth.service.ts's login().
  const { devCode } = (await loginResponse.json()) as { devCode?: string }
  if (!devCode) {
    throw new Error(
      'Expected a dev-mode `devCode` in the login response — check AUTH_DEV_OTP in apps/api/.env.test.',
    )
  }

  const verifyResponse = await request.post(`${API_BASE_URL}/api/auth/verify`, {
    data: { email, code: devCode },
  })
  if (!verifyResponse.ok()) {
    throw new Error(`OTP verification failed: ${verifyResponse.status()} ${await verifyResponse.text()}`)
  }
}

setup('authenticate as admin', async ({ request }) => {
  await login(request, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!)
  await request.storageState({ path: authFile })
})

setup('authenticate as dispatcher', async ({ request }) => {
  // Provision (as admin — user:manage — idempotent across repeated local runs:
  // a 409 Conflict just means a prior run already created this account) then
  // switch this same request context's session to the dispatcher by logging in
  // again — /api/auth/login's Set-Cookie replaces the admin session outright.
  await login(request, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!)
  const createResponse = await request.post(`${API_BASE_URL}/api/users`, {
    data: { ...DISPATCHER, role: 'DISPATCHER' },
  })
  if (!createResponse.ok() && createResponse.status() !== 409) {
    throw new Error(`Dispatcher provisioning failed: ${createResponse.status()} ${await createResponse.text()}`)
  }

  await login(request, DISPATCHER.email, DISPATCHER.password)
  await request.storageState({ path: dispatcherAuthFile })
})
