# Driver log & History — design notes before building either

Both tabs on `/invoicing` are pure `Coming soon` placeholders, in the legacy
and in Cockpit v2 (added 2026-08-27).
The legacy's only trace of intent is two one-line comments:

- Driver log: *"per-driver export with costs + total"*
- History: *"immutable reports filed by client/period/ref-PO/event"*

Read this before building either — the goal is to stop the first person who
picks this up from reaching for more infrastructure than the actual
requirement needs.

## The question that came up: should this be Event Sourcing?

Mid-design, "this wants an event log" came up, and the word landed on **Event
Sourcing** — an append-only log of domain events as the *source of truth*,
with current state (and every read model) rebuilt by replaying/projecting
that log. Worth naming explicitly so the next person doesn't re-derive it:

**Verdict: no, not for this.** Two reasons:

1. **Both features are answerable from data that already exists**, in the
   plain CRUD tables Cockpit v2 already has (see below). Reaching for event
   sourcing here would mean migrating `Trip`/`Invoice`/`Client` off their
   current model, replaying history to rebuild state, and standing up a
   projection layer — a full architectural shift to solve two read-only
   report screens.
2. **Storage/ops cost for no benefit.** Even a *lighter* version — an
   append-only side-table logging every notable mutation, without going as
   far as making it the source of truth — was considered and set aside too:
   it would grow forever with no pruning story, for events nothing currently
   needs. Flagged explicitly during scoping (2026-08-27) as a real risk, not
   a hypothetical one: "un peu overkill et bourrer la bdd/vps pour rien."

Don't resurrect either version unless a *concrete* requirement shows up that
the plain-CRUD approach below genuinely can't answer (see "If a real need for
a log ever shows up" at the bottom) — and even then, reach for the narrow
side-table, not full event sourcing.

## What each tab actually needs, and where the data already lives

### History — "immutable reports filed by client/period/ref-PO/event"

This is describing the `Invoice` table almost exactly as it already exists:
`Invoice` is created once (`InvoicesService.create()`), never updated or
deleted, and already carries `clientId` (→ Ref/PO via the client, and
`isEvent`), `periodStart`/`periodEnd`, `createdAt`. **No new storage is
needed.** What's missing is purely on the read side:

- `GET /invoices` today (`apps/api/src/invoices/invoices.controller.ts`)
  takes no query params and returns everything, unpaginated — fine for the
  Customer tab's Invoiced panel (which already narrows by client/event/period
  client-side over that same unbounded call, see `apps/web/src/features/invoicing/customer-filters.ts`),
  but not acceptable as System-wide History per this repo's standing rule
  that no list endpoint ships without a bound ("Plus rien sans pagination,"
  2026-08-27 — see ADR-0001 and ADR-0005 for the rule and its one documented
  exception).
- Building History for real means: add `search`/`clientRef`/`period`/`refPo`
  query params + pagination to `GET /invoices` (same shape as
  `GET /clients`/`GET /drivers`), then a straightforward paginated table on
  the frontend — no different in kind from the Clients or Drivers pages
  already built.

### Driver log — "per-driver export with costs + total"

This is a **trip aggregation report**, not a log: for a driver/partner and a
period, list the trips they were assigned (`Trip.driverId`/`Trip.partnerId`),
show each one's rate (`Trip.priceEur` for in-house, `Trip.partnerRateEur` for
partners — both already on the record), and a summed total. Structurally
identical to the Partner log tab already built this session
(`apps/web/src/features/invoicing/partner-log-tab.tsx`) — same filters
(driver/partner + date range + ref/PO), same "reuse the generic trips list,
narrow client-side over an already-bounded `period=all` fetch" pattern — plus
a totals row/footer that Partner log doesn't currently have.

No new backend endpoint is obviously required: `GET /trips?period=all` already
returns everything needed once filtered by `driverId`/`partnerId` client-side,
same as Partner log. Add a totals summary purely on the frontend (sum
`priceEur`/`partnerRateEur` over the filtered set) the same way
`invoice-calc.ts` sums line items today.

## If a real need for a log ever shows up

Some legitimately different question — "show me everything that happened to
trip R-CI1-26-3, including reassignments and who cancelled what" — is *not*
answerable from current-state tables, because updates overwrite fields in
place. If that ever becomes an actual ask (not anticipated by anything on
the roadmap today), the right shape is still not full event sourcing:

- A narrow, append-only `ActivityEvent` table (`id`, `type`, `occurredAt`,
  `actorUserId`, a handful of nullable FKs — `tripId`/`invoiceId`/`clientId`/
  `driverId` — plus a small denormalized `payload` `Json` for what's needed at
  render time), populated by explicit calls added at the handful of existing
  service methods that already represent a real transition
  (`TripsService.advanceStep()`, `cancelAssignment()`,
  `InvoicesService.create()`, etc.) — additive, doesn't touch those methods'
  existing return values or the tables they already write.
- **Curate the event types by what a screen will actually render** — don't
  log every field diff "just in case." Start from the concrete read need, add
  one event type at a time.
- Serve it through the same bounded pattern as everything else in this app —
  paginated, filtered, no "give me everything."
- Keep `Trip`/`Invoice`/`Client` as they are — this log is a side-channel for
  questions current-state tables can't answer, not a replacement source of
  truth. That distinction is the whole reason this is *not* event sourcing.
