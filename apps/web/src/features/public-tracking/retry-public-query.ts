import { ApiError } from '@cockpit/shared/api'

/**
 * Retry override for the two public pages' trip query — see driver-page.tsx
 * for why they diverge from the app-wide retry: false. A 4xx (a genuinely
 * wrong/cancelled ref — the only 4xx this endpoint returns) should still
 * fail fast, same as before; only a transient failure (network blip, 5xx)
 * gets the retry.
 */
export function retryPublicQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 2
}
