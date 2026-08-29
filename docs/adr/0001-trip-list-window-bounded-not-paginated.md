# ADR-0001 — `GET /trips` is bounded by its window and filters, not paginated

- **Status**: accepted
- **Date**: 2026-08-29
- **Scope**: system-wide (`apps/api` `TripsService.list()`, `apps/web` `trip-views.ts`)

## Context

Every other list endpoint in this app is paginated, always, with no "give me
everything" mode: `GET /clients`, `/drivers`, `/fleet-vehicles` all take
`page`/`limit` (default 20, hard cap 100). That rule was set deliberately, and
it is the right rule for a roster — a screen that shows twenty rows at a time
and lets the operator walk to the next twenty.

`GET /trips` is the exception. It returns `TripEntity[]`, unpaginated.

## Decision

**It stays unpaginated.** Its bound is its *window* — the named `period`, or an
explicit `from`/`to` range — plus the filters the caller sends. Completing
those filters is the work that replaces pagination here (see `trip-views.ts`:
every screen's narrowing is now a query parameter, none of it is re-applied in
the browser).

## Why this endpoint and not the others

Three of its four consumers need the **whole** window, not a page of it, and
would each have to re-implement paging over it to work at all:

- **The Excel exports** (`invoice-excel.ts`) write one file per period. A page
  of trips would produce a truncated file with no indication it was truncated —
  the worst possible failure for an accounting document.
- **The Planning Gantt** draws every booking that *overlaps* the visible days,
  clipped, on its own resource row. "Page 1" is not a meaningful subset of a
  chart: it would blank arbitrary rows.
- **The Bookings board's Local / Farm-out split** cuts the returned set in two
  tables. Paginating would cut a *page* in two, so the two tables would no
  longer add up to the window.

Only the Invoicing Pending table could take a page, and it is the one screen
whose whole job is to turn its full result into one invoice.

## The tension this ADR resolves

This **contradicts the standing rule** recorded during the 2026-08-27 Clients
work — "no list endpoint works without pagination", no exceptions. That rule was
right about the problem it was aimed at (a page that downloads the entire table
and filters it in the browser) and it is not being relaxed: what made that
pattern bad was the *unbounded fetch plus client-side narrowing*, and both
halves are gone here. The window is mandatory and server-resolved, and as of
this change no screen re-filters the rows it gets back.

What is being said is narrower: **bounded ≠ paginated**. A page number is one
way to bound a query; a date window and a filter set are another, and for a
booking list read by a chart and by an export it is the one that matches what
the callers actually need.

## Consequences

- A very wide window (`period=all` with no filters) still returns a lot of rows.
  That is a real limit, accepted: the screens that can send `period=all` are the
  logs, and they open on a month.
- If a screen ever appears that genuinely wants a page of bookings, it gets
  `page`/`limit` **as optional parameters** — it does not make them mandatory
  for the Gantt and the exports.
- Do not "fix" this endpoint by adding pagination in a later cleanup pass. This
  file exists because that proposal keeps coming back.
