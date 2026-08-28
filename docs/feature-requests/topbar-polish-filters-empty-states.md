# Topbar polish, filter reset, empty states

## Problem

Three small gaps surfaced once the core Bookings flow was in good shape:

- The v2 topbar (`app-shell.tsx`) has no brand identity beyond a plain
  `"Cockpit"` text span, no logout icon, and no live clock — the legacy app
  shows a live clock (with the viewer's timezone) next to a handwritten-style
  wordmark, and the user's colleague specifically relies on the clock.
- None of the app's 7 filter bars have a way to clear filters back to
  default — a dispatcher who narrows bookings down has to manually undo each
  field.
- None of the app's 9 list/table views have a real empty state. Every one
  renders the identical inline idiom
  (`list.length === 0 ? <TableRow><TableCell colSpan={n}>TEXT</TableCell></TableRow> : ...`)
  with plain muted text, no icon, and — critically — no distinction between
  "this dataset is genuinely empty" and "your filters matched nothing."

## Decision

- Add an isolated `LiveClock` component (own `setInterval`, no props) to the
  topbar, plus a handwritten-style wordmark, both scoped to the v2 topbar only.
- Add a `LogOut` icon to the existing logout menu item.
- Reflow the topbar from a 2-zone `justify-between` flex row to a 3-column
  grid so the center nav stays centered regardless of what's added to the
  right zone.
- Add a shared `EmptyState` component (built on shadcn's `Empty` primitives)
  used by all 9 tables, aware of whether filters are active so it can offer a
  "Reset filters" action inline when a search — not a truly empty dataset —
  produced zero rows.
- Add a "Reset filters" button, in the same position, to all 8 filter bars —
  always rendered, disabled when filters already equal their defaults.

## Scope

**In:**
- `app-shell.tsx`: wordmark, `LiveClock`, logout icon, grid layout.
- New `src/components/layout/live-clock.tsx`.
- New `src/components/ui/empty.tsx` (installed via `shadcn add empty`) plus a
  thin domain wrapper composing it into a single `EmptyState` component.
- All 8 filter bars: `booking-filters-bar.tsx`, `client-filters-bar.tsx`,
  `driver-filters-bar.tsx`, `vehicle-filters-bar.tsx`, `event-filters-bar.tsx`,
  `customer-filters-bar.tsx`, `partner-filters-bar.tsx`, `planning-filters-bar.tsx`.
- All 9 tables that currently inline an empty-state string: bookings,
  clients, drivers, fleet (internal + external vehicles), invoicing
  (invoiced + pending trips), planning list, settings users.

**Out:** dark mode, any change to filter *logic* (`applyXFilters` functions
stay untouched — reset just calls each page's existing `defaultXFilters()`),
pagination, and API changes.

## Design

Reviewed with the user via a mockup artifact before implementation
(topbar + filter-bar + empty-state states). Choices made, each with the
alternative considered:

- **Handwritten wordmark as a Google/self-hosted font (`Caveat`, via
  `@fontsource-variable/caveat`)**, over reusing the legacy's baked PNG
  assets (`cockpit-wordmark.png`) — a font stays crisp at any size/DPI and
  needs no image asset pipeline, at the cost of not being a pixel-identical
  match to the legacy mark. User's explicit call.
- **Compact `HH:mm:ss` + short zone abbreviation** (e.g. `14:32:07 CEST`, via
  Luxon's `offsetNameShort`), over the legacy's full
  `ccc dd LLL yyyy · HH:mm:ss` — the v2 clock sits directly beside the user's
  name in a fixed-width topbar, where the legacy's clock has a full header
  row to itself.
- **3-column CSS grid for the header** (`[1fr_auto_1fr]`, nav in the center
  column, clock + user menu together in the right column), over keeping
  `justify-between` — the latter only keeps the nav visually centered by
  accident, when the left and right zones happen to match in width; the grid
  guarantees it regardless of what's added to either side. This is the
  direct answer to "que ça ne décale pas le centrage."
- **`EmptyState` distinguishes "filtered to zero" from "truly empty"** and
  shows a "Reset filters" button only in the former case, over one identical
  message everywhere — avoids telling a dispatcher looking at an empty
  *filtered* view that there's simply no data at all.
- **Reset-filters button always visible, disabled at defaults**, over only
  rendering it once a filter is active — keeps the filter bar's layout
  stable (no button popping in/out) at the cost of one more constantly-visible
  element.

## Next step

Implementation:
1. `pnpm add @fontsource-variable/caveat` (workspace: `apps/web`), imported
   in `main.tsx` next to the existing Inter import.
2. `LiveClock` in `src/components/layout/live-clock.tsx`, Luxon-based, own
   `useState`/`useEffect` interval — isolated so its per-second tick never
   re-renders the rest of `AppShell`.
3. `app-shell.tsx`: grid layout, wordmark span, `<LiveClock />` + `LogOut`
   icon on the logout item.
4. `EmptyState` composing the newly-installed `ui/empty.tsx` shadcn
   primitives, taking `icon`, `title`, `description`, and an optional
   `onResetFilters` — dropped into all 9 tables in place of the inline
   `TableRow`/`TableCell` idiom.
5. A small shared reset-button block (icon + label, disabled when
   `filtersChanged(filters, defaults)` is false) added to each of the 8 filter
   bars, wired to each page's existing `setFilters(defaultXFilters())`.
