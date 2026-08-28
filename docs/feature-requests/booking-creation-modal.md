# Booking creation modal

## Problem

Booking creation is currently a permanently-visible in-page panel (`BookingCreationBar`
on the Bookings page, `EventCreationBar` on the Events page) — the only "create" flow in
the app that isn't a modal. Every other entity (Clients, Drivers, Vehicles) uses a
"Create X" button that opens a shadcn `Dialog`. This inconsistency was inherited from the
legacy app (`suivi-chauffeur-twilio`) without a documented rationale (see
`docs/LEGACY_FEATURES.md` and the 2026-08-27 Events journal entry in
`docs/FRONTEND_PLAN.md`).

The legacy app also exposed this same booking-creation block on 5 pages
(`dispatcher.html`, `clients.html`, `drivers.html`, `vehicles.html`, `events.html`), by
literal copy-paste of the same ~160-line HTML fragment (identical on 4 of the 5; only
`events.html` added an event-select panel + a "Create bulk" button). In cockpit-v2 today,
the equivalent entry point only exists on 2 of those 5 pages (Bookings, Events) — Clients,
Drivers, and Vehicles have no booking-creation entry point at all yet.

## Decision

Convert booking creation to a single modal, consistent with the Create-X-button pattern
used everywhere else, and restore the entry point on all 5 pages the legacy app had it on.

## Outcome / scope

- A "New booking" button (same visual pattern as "New account" / "New driver" / "New
  vehicle") appears on: Bookings, Clients, Drivers, Vehicles, Events.
- The button opens one shared modal built on the existing `TripFormFields` component
  (already factored out and reused by both `BookingCreationBar` and `EventCreationBar`
  today — no field-level rework needed).
- On Bookings/Clients/Drivers/Vehicles: "Create" / "Create & Dispatch" buttons, same as
  today's `BookingCreationBar`.
- On Events: unchanged behavior — the "Select event" panel stays above the button, the
  Customer field locks once an event is confirmed, buttons are "Create" / "Create bulk",
  and driver/fleet-reg/partner fields stay hidden (every event trip starts unassigned and
  is dispatched later from the Ride list) — this is a straight port of `EventCreationBar`'s
  existing logic into the new modal, not a behavior change.
- **New:** contextual pre-fill, editable (not locked) —
  - Clients page → Customer field pre-filled with the client whose page you're on.
  - Drivers page → Driver field pre-filled with the driver whose page you're on.
  - Vehicles page → Vehicle type + Fleet reg nbr pre-filled with that vehicle; pax count
    capped to that vehicle's max (reuses the existing Vehicle→paxCount cap logic already
    in `trip-form-fields.tsx`).
  - Bookings page → no pre-fill, blank form (nothing to carry over).
  - Events keeps its existing locked-Customer behavior — that's a business rule (event↔
    client integrity), not a convenience pre-fill, so it's the one exception to "editable".
- Draft persistence is kept, and scoped **per page** (one localStorage key per context:
  Bookings, Clients, Drivers, Vehicles each get their own key; Events keeps its existing
  separate `newEventBookingDraft`) — mirrors the reasoning already in the Events code
  (`event-creation-bar.tsx` comment: "an event-locked client ref should never leak onto
  the plain Bookings creation bar later"), extended to the 3 new contexts so a
  vehicle-prefilled draft from the Vehicles page can't resurface on another page.

## Out of scope

- No change to field set, validation, or bulk-create logic.
- No change to the Events "Select event" panel logic itself.
- No client/driver/vehicle detail pages — cockpit-v2 has none today; the button lives on
  the existing list pages.

## Design

Mockup: https://claude.ai/code/artifact/9de9c3f8-9b50-411a-9d78-3cdc9690173d — clickable,
shows all 5 page contexts and their modal variant (pre-fill tags, locked-field tag on
Events, per-context draft-key annotation in the footer).

Alternatives considered and rejected:
- **Locking pre-filled fields on Clients/Drivers/Vehicles** (like Events' Customer field):
  rejected — there's no business rule backing a lock on those 3 pages, it's a pure
  convenience shortcut, so locking would only add friction if the dispatcher wants to
  correct the pre-filled value.
- **One shared draft across all contexts**: rejected — same leak risk Events already
  guards against (a prefilled draft from one context reappearing in a different context's
  blank/pre-filled form later).

No open questions remain — both real UX choices above were confirmed by the user via
AskUserQuestion, no defaults were silently assumed.

## Next step

Implementation (stage 6): build the shared modal component, wire the 3 new pre-fill
sources and per-page draft keys, add the "New booking" button to Clients/Drivers/Vehicles
pages, retire `BookingCreationBar` and `EventCreationBar` in favor of it.
