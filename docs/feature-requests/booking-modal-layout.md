# Booking modal layout

## Problem

The "New booking" modal shows 30 fields as one flat list, and dispatchers report
fields visually overlapping. The cause is structural, in `trip-form-fields.tsx`:
six sibling grids whose column count changes from one row to the next
(`lg:grid-cols-6` for the first two, `lg:grid-cols-4` for the last four), plus
ad-hoc `col-span-2` overrides on Country and Customer. Nothing lines up
vertically between rows, and there is no visual grouping to compensate.

Three aggravating factors on top of that:

- **Uneven cell heights.** The Paris-equivalent hint under the pickup time is
  the form's only caption, so its cell is taller than its neighbours and the
  whole row tilts. The two checkbox items (`Sub-contracted`, `Tracking (send
  WhatsApp updates)`) use `items-end pb-2` with labels that wrap onto two lines
  and spill over the adjacent cell.
- **Colliding icons.** The pickup time field carries a clock icon as a leading
  `InputGroupAddon` *and* the native `input[type=time]` picker icon on the
  right. In a ~120 px column the two overlap — this is the overlap dispatchers
  actually see.
- **Global reflow.** Four conditional fields (`Nb H` when ASD, `DO` unless ASD,
  `Partner` and `Partner rate net` when sub-contracted, the whole flight block
  when an IATA code is detected) appear and disappear mid-entry. Because every
  row lives in the same flat container, one of them appearing shifts the entire
  rest of the form.

## Decision

Regroup the form into five business sections over a single 12-column grid, and
fix the four rendering defects above. No change to the field set, the Zod
schema, the DTO mapping, or any business rule.

## Scope

Applied to `TripFormFields` itself, so all three dialogs that share it inherit
the change: booking creation (Bookings / Clients / Drivers / Vehicles),
booking edit, and Event booking creation.

### The five sections

Titles in English, matching the rest of the UI. Each is a small uppercase
heading over a rule, and each owns its own 12-column grid so a conditional
field appearing only reflows its own section.

| Section | Fields |
| --- | --- |
| **Service** | Service, Country, Area, Date, PU (local) + Paris hint, Nb H\* |
| **Route** | PU, DO\*, flight/FBO sub-block\*, Info |
| **Customer & passengers** | Customer, Payment, Pax Name, Pax nb, POC Name, POC Mobile, Tracking |
| **Vehicle & assignment** | Vehicle, Sub-contracted → Driver + Reg Nbr *or* Partner |
| **Pricing** | Retail net, Partner rate net\* (+ margin) |

\* conditional

Ordering follows the order in which a dispatcher receives the information on
the phone: which service and when, from where to where, for whom, with which
vehicle and driver, at what price. Assignment and price close the booking.

### Fixes carried by the same change

- The pickup time field loses its leading clock addon (kept on the label), so
  it no longer collides with the native picker icon.
- The Paris hint moves inline, to the right of the time input, so every cell in
  that row has the same height.
- Required fields are marked with an asterisk — including the ones that only
  become required for a given service (`Nb H` for ASD, `Info` for SPEC, `DO`
  outside ASD). Previously the 8 requirements were only discoverable by
  submitting.
- Checkbox labels no longer overflow their cell.
- `Sub-contracted` moves to the head of the assignment section and acts as a
  mode switch: unchecked shows Driver + Reg Nbr, checked shows Partner.
- `Create & Dispatch`, when disabled, explains why in a tooltip — either
  nothing is assigned yet, or both a driver and a partner are set.
- The title and the action buttons no longer scroll away: the dialog is a
  column, and only the fields scroll between a pinned header and footer, so
  `Create` stays reachable on a long booking (ASD + sub-contracted + flight
  block). The scrolling pane carries `px-2` to absorb both an edge field's focus
  ring and the ~7px an InputGroup's trailing button overhangs by
  (`has-[>button]:mr-[-0.45rem]`, ui/input-group.tsx) — the dialog's own `p-6`
  used to swallow that, and without the padding it becomes a horizontal
  scrollbar. `-mx-2` gives the width back so the fields stay flush with the
  title and the buttons.

## Out of scope

Zod schema, `toCreateTripDto` / `toUpdateTripDto`, the `canDispatch` rule
itself, per-page localStorage drafts, row prefills, the Event select panel, and
the `trip:edit-past` / `trip:edit-price` permission gates.

## Design

UX choices were settled by a full grilling round (see the 2026-08-28 session),
each put to the user through `AskUserQuestion`. Chosen, with the rejected
alternatives:

- **Stacked business sections**, over: collapsible blocks (would hide the very
  fields that gate the `Create & Dispatch` button), a multi-step wizard (triples
  the clicks on a task repeated dozens of times a day), and a two-column split
  (forces a tab order that jumps between columns).
- **12-column grid at the current `max-w-4xl` width**, over widening to `5xl`
  (every other modal in the app is `4xl` or less) and a uniform 4-column grid
  (would make `Pax nb` as wide as `Customer`).
- **Reflow confined to each section**, over reserving space for every
  conditional field (a greyed-out `DO` on an ASD booking reads as a bug) and
  over stabilising only the flight block.
- **Titles with a rule**, over bordered cards (~120 px taller, reads as an
  administrative form) and over spacing alone (grouping becomes implicit).
- **`Pax nb` under Customer & passengers**, over pairing it with Vehicle: it is
  order data, not fleet data — the customer states three passengers before a car
  is picked. The existing `maxPax` cap still applies unchanged.
- **`Sub-contracted` as a section-head switch**, over a two-tab Own fleet /
  Partner selector (turns a boolean into a bespoke component, and drifts from
  the legacy dispatchers know) and over leaving the checkbox mid-row.
- **Tooltip on the disabled dispatch button**, over a permanently visible inline
  message under the assignment section.

### Skipped at the user's request

**Stage 2 (mockup).** Offered explicitly and declined in favour of going
straight to code: a static mockup would show neither the comboboxes, nor the
conditional reflow, nor the Paris hint — precisely what is being fixed. The
user's call, recorded here for traceability.

### Deviation found during implementation

Making `Sub-contracted` a mode switch means Driver and Reg Nbr are hidden while
it is checked. Left as-is, a dispatcher who filled in a driver *before* ticking
the box would hit a dead end: `canDispatch` treats "driver and partner both set"
as a conflict and disables the button, while the driver field causing it is no
longer on screen. Toggling the switch therefore clears the branch being left
(driver + fleet reg when switching to a partner, partner when switching back).
The `canDispatch` conflict guard itself is untouched, as a safety net for values
arriving from a prefill or from an existing trip.

## Follow-up fix (2026-08-28, same session)

`ClientsService`, `DriversService` and `FleetVehiclesService`'s paginated
`list()` all ordered by `[{ active: 'desc' }, { ref: 'asc' }]`. `ref` is a
monotonic counter, but scoped per ref-prefix (RefCounterService), so a fresh
record — the one a dispatcher just created — could land past the first
`PAGE_SIZE` (20) and effectively vanish from view without a search. Switched
the tiebreaker to `{ createdAt: 'desc' }` on all three: newest first, same
semantics as every other "just did X, see it on screen" flow in the app.
Confirms via `test:e2e:prepare`'s idempotent reseed plus a full Playwright run
(25/25) and the API's clients/drivers/fleet e2e specs (64/64) — none assert a
specific ref order, only counts and pagination boundaries.

## Next step

Implementation in `trip-form-fields.tsx`, plus `ui/tooltip.tsx` (the shadcn
component was missing from the project) and the dispatch-button tooltip in
`booking-create-dialog.tsx`.
