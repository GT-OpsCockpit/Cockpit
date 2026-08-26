import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@cockpit/shared/api'

function redirectToLoginOn401(error: unknown) {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    window.location.pathname !== '/login'
  ) {
    window.location.assign('/login')
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The API uses httpOnly cookie sessions with no refresh flow — a 401
      // means "not logged in", not "transient failure", so retrying just
      // delays the redirect to /login.
      retry: false,
      staleTime: 10_000,
    },
  },
  // Legacy patched the global `fetch` to redirect to /login.html on any
  // 401 (see LEGACY_FEATURES.md §10, common.js) — same behavior here, for
  // queries fired outside a route loader (e.g. a session that expires
  // mid-page). Loaders handle their own 401 via `redirect()` instead.
  queryCache: new QueryCache({ onError: redirectToLoginOn401 }),
})
