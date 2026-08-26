import { defineConfig } from 'orval';

// Generates a fully-typed TanStack Query v5 client from the live Cockpit API
// OpenAPI spec into packages/shared/src/api, split by controller tag
// (Clients, Trips, Drivers, ...). Re-run with `pnpm api:generate` (the API
// container must be up on :3000 — see docker-compose.override.yml) whenever
// apps/api's DTOs/controllers change.
export default defineConfig({
  cockpit: {
    input: {
      target: 'http://localhost:3000/api/docs-json',
    },
    output: {
      mode: 'tags-split',
      target: '../../packages/shared/src/api/endpoints/cockpit-api.ts',
      schemas: '../../packages/shared/src/api/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      indexFiles: true,
      override: {
        mutator: {
          path: '../../packages/shared/src/api/fetcher.ts',
          name: 'fetcher',
        },
        // fetcher.ts returns the parsed body directly (not a {data, status,
        // headers} envelope) — without this, orval's fetch client generates
        // types expecting that envelope while the mutator never produces it,
        // so every hook's `.data` would be `undefined` at runtime. This also
        // avoids a `.data.data` double-unwrap in every consumer (TanStack
        // Query's own `.data` plus orval's response `.data`).
        fetch: {
          includeHttpResponseReturnType: false,
        },
        // Deliberately NOT setting useQuery/useMutation here: orval's
        // defaults already give GET -> useQuery, everything else ->
        // useMutation, which is what we want. Explicitly forcing both to
        // `true` (as an earlier version of this config did) makes orval
        // enable BOTH hook types for every operation, and — per its
        // documented precedence rule — the mutation hook then wins for GET
        // and the query hook wins for non-GET, i.e. exactly inverted from
        // what we want (GET became useMutation, POST/PUT/PATCH/DELETE
        // became useQuery).
        query: {
          signal: true,
        },
      },
    },
  },
});
