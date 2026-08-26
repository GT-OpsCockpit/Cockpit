import { ApiError } from '@cockpit/shared/api'

/** The API normalizes every error response to `{ error: 'human message' }` (see ApiExceptionFilter). */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: string } | undefined
    if (body?.error) return body.error
  }
  return fallback
}
