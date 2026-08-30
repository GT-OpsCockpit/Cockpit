# ADR-0005 — Business rules attached to a list live server-side, as filters, not client-side predicates

- **Status**: accepted
- **Date**: 2026-08-28
- **Scope**: system-wide, established while porting `driverEligibleForTrip` / `isEffectivelyActive` /
  reserved-vehicle auto-assignment (`apps/api/src/common/business/assignability.ts`)

## Context

On 2026-08-27, every list endpoint moved from "return everything, filter in
the browser" to server-side pagination (`docs/LEGACY_PARITY_AUDIT.md` calls
this "Plus rien sans pagination" — see also ADR-0001 for the one documented
exception). That refactor had a side effect nobody caught immediately:
business rules that used to run as a JS predicate over the *full* in-memory
list (the legacy's pattern, and v2's first pass at porting it) silently
stopped applying once the list was paginated — filtering client-side over a
20-row page only narrows what's *visible*, it doesn't exclude the other 980
rows the operator never sees.

Two concrete regressions came from exactly this: `GET /trips`'s
`baseVisibility` rule (B1, ADR — folded into `docs/LEGACY_PARITY_AUDIT.md`
§0) became a server-side default instead of an opt-in, hiding all past
courses from Invoicing; and `driverEligibleForTrip` /
`isEffectivelyActive` (unavailability/event windows) were left as dead,
unused JS predicates while the driver/vehicle pickers moved server-side
around them.

## Decision

**A rule that decides which rows a list may return lives in the query
itself (a Prisma filter), never as a client-side predicate over a page.**
`driverEligibleForTrip` and `isEffectivelyActive` were ported as composable
Prisma filters (`assignability.ts`), exposed via query params
(`availableOnly`, `compatibleWith`, etc.) rather than left as an
in-memory `.filter()` a component might or might not remember to call.

This generalizes past those two rules: reserved-vehicle auto-assignment
moved to one backend location (was duplicated in two frontend functions in
the legacy); margin/ASD totals stayed a pure shared function rather than a
per-page recomputation, precisely because they don't gate which rows come
back — they compute over rows already fetched.

## Consequences

- Before moving any list from unbounded-fetch to paginated/windowed, check
  whether a business rule was piggybacking on the old "fetch everything,
  filter in JS" shape. If so, it needs to become a query filter in the same
  change — not a follow-up, since the gap is invisible until someone hits a
  page the rule was supposed to have excluded from.
- New "is this record eligible/available/visible" rules attached to a list
  screen: write them as a Prisma `where` clause (or a composable filter
  function building one), not a `.filter()` after the fetch.
- Pure computations that don't gate row visibility (margin, totals, display
  formatting) are exempt — those are fine client-side or as shared
  functions recomputed on the already-fetched set.
