/**
 * Custom `fetch` mutator for the orval-generated API client (see
 * ../../../apps/web/orval.config.ts, `output.override.mutator`).
 *
 * The Cockpit API uses httpOnly cookie sessions (see apps/api/src/auth), so
 * every request must go out with `credentials: 'include'` — otherwise the
 * session cookie set by POST /api/auth/verify is never sent back on
 * subsequent requests and every call past login looks unauthenticated.
 *
 * The base URL is read from VITE_API_URL so the browser talks to the
 * host-mapped API port (http://localhost:3000 in local dev — see
 * docker-compose.yml/.override.yml) rather than a container-internal
 * hostname the browser can't resolve. Only apps/web (a Vite project) is
 * meant to import this file at runtime — apps/api may reuse the generated
 * *types* from this package, but never this fetcher or the react-query hooks.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000';

export function getBaseUrl(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> })
    .env;
  return env?.VITE_API_URL || DEFAULT_BASE_URL;
}

async function parseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  // Some endpoints (e.g. auth logout) return no body at all.
  return undefined as T;
}

export class ApiError extends Error {
  // Not constructor parameter properties: apps/web's tsconfig enables
  // `erasableSyntaxOnly` (Node-compatible "type-stripping" TS only), which
  // rejects that shorthand since it has real runtime behavior.
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(
      `API request failed with status ${status}: ${JSON.stringify(body)}`,
    );
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * The mutator orval's `httpClient: 'fetch'` output calls for every request:
 * `customFetch<T>(url, options)`. `url` is already the fully-built path
 * (including query string) returned by the generated `get<Operation>Url()`
 * helpers, relative to the API's `/api` prefix.
 */
export async function fetcher<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await parseBody<unknown>(response);
    throw new ApiError(response.status, body);
  }

  return parseBody<T>(response);
}

export default fetcher;
