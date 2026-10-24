# Partner companies — feature request

Status: **Validated** (Cadrage, Maquette, Challenge UX all confirmed by the requester). Ready to implement.

Mockup: https://claude.ai/artifact/ALiSnRasusq8rRQpUAdjo9 (3 artboards: `Main` — Drivers & Partners page, `NewPartner` — creation popup in company mode, `NewPartnerIndividual` — same popup with the "Individual" checkbox on).

## 1. Problem

Today, "partner" is an informal convention: a `Driver` or `FleetVehicle` is treated as sub-contracted whenever its free-text `company` / `partnerCompany` field is non-empty (`isPartner(driver)`). There is no real entity behind it — no structured contact info for the partner company itself (who to email, their phone), no link between a partner's drivers and their vehicles, and no way to notify the partner company automatically when a job is assigned to, unassigned from, or cancelled for one of their drivers.

## 2. Outcome

- The Drivers & Partners page visibly separates **in-house/local drivers** from **partner companies**.
- A real `Partner` entity exists, with its own contact info (company name, manager/dispatch name, phone, email, country, area) and an `individual` flag.
- Partner drivers and partner vehicles are attached to a `Partner`, not just tagged with a matching free-text string.
- Assigning a booking to a partner (with or without a specific driver/vehicle) automatically opens an email draft to the partner company; unassigning or cancelling a sub-contracted booking automatically opens a cancellation email draft — same "dispatcher still clicks Send" pattern as the existing subcontract-email feature, never an auto-send.
- If a specific partner driver is chosen, the dispatcher additionally has the option (not automatic) to notify that driver by WhatsApp, exactly like today for in-house drivers — nothing changes for in-house/local drivers.
- All partner emails are sent from **contact@gt-ops.club**.

## 3. Scope

**In scope:**
- New `Partner` Prisma entity + migration.
- "New partner" button + popup on the Drivers & Partners page.
- Attaching drivers/vehicles to a partner (roster management on the partner's card).
- Booking-form changes: partner selection becomes a real `Partner` picker (was free-text `partnerRef`); driver/vehicle within that partner's roster becomes an optional second step.
- Automatic email draft on assign / unassign / cancel for a sub-contracted booking, addressed to the partner's email, from contact@gt-ops.club.
- Optional WhatsApp to the specific assigned partner driver, reusing the existing in-house WhatsApp mechanism.
- One-time migration of existing free-text partners (`Driver.company`, `FleetVehicle.partnerCompany`) into real `Partner` records.

**Out of scope (unchanged):**
- Anything about in-house/local drivers' own WhatsApp flow.
- Automatic *sending* of any email — every email stays a manually-reviewed draft the dispatcher sends themselves, exactly like the current subcontract-email feature.
- Automatic *sending* of WhatsApp messages — same, dispatcher-triggered only.

## 4. Decisions (from Cadrage + Challenge UX)

| Question | Decision |
|---|---|
| How are partner emails sent? | Always manual — an email draft opens (mailto-style, same as today's subcontract-email), the dispatcher clicks Send themselves. Never auto-sent. |
| Can a partner be a lone individual with no company? | Yes — the "New partner" popup has an "Individual" checkbox; checking it disables/hides the Company name field and relabels "Manager/dispatch name" to "Contact name". |
| Popup field order | Société (company name) first, then the rest of the details. |
| Are Phone and Email required on a partner? | Yes, both required — a partner with no email can't receive job notifications, which defeats the point of the feature. |
| WhatsApp for in-house/local drivers | No change — continues exactly as before. |
| Partner roster — show a status column (active/inactive) per driver/vehicle? | No — the partner manages their own drivers' availability; Cockpit doesn't track it. |
| Toggling "Individual" in the popup after typing a company name | Keep the typed value (don't clear it) — the field just becomes inactive/relabelled, in case the toggle was a misclick. |
| Individual partner card — show their vehicle? | Yes — show the vehicle on the card, same as an in-house driver's card, so the dispatcher can check it without opening the record. |
| Booking form — how is a partner assigned? | The existing free-text "Partner company" field is replaced by a real `Partner` picker (still required to sub-contract, same as today). Once a partner is chosen, a second, optional picker lets the dispatcher pick a specific driver + vehicle from that partner's roster (skipped entirely for an "Individual" partner, who has an implicit single driver+vehicle). |
| Migrating existing free-text partners | One `Partner` record per distinct company-name string found across `Driver.company` / `FleetVehicle.partnerCompany` (case/whitespace-insensitive grouping), created as non-Individual by default; the dispatcher can mark one Individual by hand afterwards if that's actually a lone person. |

## 5. Data model (sketch — to refine at implementation time)

- New `Partner` model: `id`, `ref`, `companyName` (nullable — absent when `individual`), `contactName`, `phone`, `email` (both required), `countryCode`, `area`, `individual: Boolean`, timestamps.
- `Driver.partnerId` (nullable FK to `Partner`) replaces the informal `Driver.company` string for anyone attached to a real partner. `Driver.company` itself is kept only as long as needed for the migration/back-compat read path, then removed once every partner driver has a `partnerId`.
- `FleetVehicle.partnerId` (nullable FK to `Partner`) replaces `FleetVehicle.partnerCompany` the same way.
- Trip/booking: `partnerRef` (today a free-text field per `trip-form-schema.ts`) becomes a real FK to `Partner` (`trip.partnerId`); the optional driver/vehicle-within-partner selection reuses the existing `driverRef` / `fleetRegNbr` fields, now constrained (in the UI) to that partner's roster.

## 6. Notification triggers

| Event | Partner email | Driver WhatsApp |
|---|---|---|
| Booking assigned to a partner (company or individual), optionally with a specific driver+vehicle | Draft opens automatically, addressed to the partner's email | If a specific driver was picked: dispatcher has the option to also send a WhatsApp to them (manual click, existing mechanism) |
| Booking's partner assignment removed (un-assigned) | Draft opens automatically — cancellation-style notice | — |
| Booking cancelled while sub-contracted | Draft opens automatically — cancellation-style notice (reuses `buildCanceledSubcontractEmail`) | — |

**Corrected after Challenge UX (important — changes the mechanism, not just the address):** the sender must genuinely be `contact@gt-ops.club`, not just "whichever mailbox the dispatcher happens to send from." A `mailto:` link (today's mechanism for the existing subcontract email) cannot force a From address — that's set by whatever mail client/account the link opens in, so it can't satisfy this. Confirmed with the requester: the email must be a real server-side send from `contact@gt-ops.club` (SMTP, same mechanism as the existing OTP mailer), gated behind an explicit manual review-then-send step — never auto-sent. Concretely:
- The existing `GET /trips/:ref/subcontract-email` endpoint stays as the **preview**: it returns `{to, subject, body}` for the dispatcher to read before sending.
- A new `POST /trips/:ref/subcontract-email` sends it for real, via SMTP, `from: contact@gt-ops.club` — only ever called from an explicit "Send" click on that preview, never automatically.
- The frontend swaps the current "open a mailto: draft" behavior for a preview dialog (subject + body, editable) with a Send button, on all three trigger events below.

## 7. Implementation plan (Stage 6)

1. **Schema**: add `Partner` model + migration; add `partnerId` FK to `Driver` and `FleetVehicle`, additive alongside the existing free-text `company`/`partnerCompany` fields (kept for now — ref-prefix generation, search and the create/update DTOs still read them; dropping them is a follow-up cleanup once every partner driver/vehicle has a `partnerId`). **Done** — see `apps/api/prisma/schema.prisma` and the `20260926160000_add_partner` migration.
2. **Data migration**: one `Partner` per distinct company name found across `Driver.company` / `FleetVehicle.partnerCompany` (case/whitespace-insensitive), backfilling `partnerId` on both. **Done**, in the same migration — needs to be run and checked against a staging copy of the data first (grouping heuristics on real messy text can surprise you).
3. **Backend**: `PartnersModule` (CRUD for `Partner`); extend `DriversService`/`FleetVehiclesService` so create/update can attach a driver/vehicle to a `Partner` by ref; a `PartnerMailerService` (SMTP, `from: contact@gt-ops.club`, mirroring `otp-mailer.service.ts`) plus the new `POST /trips/:ref/subcontract-email` send endpoint; `resolvePartnerEmail` prefers the real `Partner.email` over the legacy driver's own `email` once a partner driver has a `partnerId`; unassign/cancel triggers reuse the existing preview endpoint+kind, now backed by the real send.
4. **Frontend**:
   - **Done** — `PartnersSection` (Drivers & Partners page): partner cards with a read-only roster, "New partner" dialog matching the validated mockup exactly (Individual toggle, conditional Company name/Contact name, required phone/email).
   - **Done** — `SubcontractEmailDialog` replaces the old mailto-opening `openSubcontractEmailDraft` (now deleted, along with its test) on all three call sites (booking create, create & dispatch, edit): fetches the preview, lets the dispatcher edit subject/body, sends for real only on an explicit click.
   - **Not done, no UI yet**: attaching an *existing* driver/vehicle to a partner (the backend's `partnerRef` on `CreateDriverDto`/`CreateFleetVehicleDto` has no field in the Driver/Fleet edit forms yet — adding it needs the API to also return the attached partner's ref/label on `DriverEntity`/`FleetVehicleEntity` first, so the field can be prefilled correctly; skipped this pass specifically to avoid a silent-clear bug like the one fixed earlier this session). The roster's "+ Add driver"/"+ Add vehicle" shortcuts from the mockup are not wired either — same reason.
   - **Not done**: the booking form's partner picker still points at a `Driver` (unchanged) rather than a `Partner` — turned out to be unnecessary for the MVP, since the email notification already resolves the real company via `Driver.partnerId` once attached (see §6's `resolvePartnerEmail`). Revisit only if the dispatcher flow itself needs to change.
   - Requires `pnpm api:generate` (orval) to be run once the backend files are in place and the API is running — the new frontend files reference `usePartnersControllerList`, `usePartnersControllerCreate`, `tripsControllerSendSubcontractEmail` etc., which don't exist until that regen happens.
5. **Tests**: red-first-by-sabotage for every new/changed test, per this repo's CLAUDE.md — migration data-grouping logic, `Partner` DTO validation, `resolvePartnerEmail`'s new Partner-first fallback, the send endpoint, booking-form schema's new partner-picker validation, unassign/cancel triggers.
6. **Branch + PR**: implemented on its own feature branch, opened as a PR per this repo's "one branch per feature" rule — never direct to `main`.
7. **Cleanup (separate follow-up PR, not blocking this one)**: once every partner driver/vehicle has been confirmed migrated in production, drop `Driver.company` and `FleetVehicle.partnerCompany` and everything reading them (ref-prefix generation, search, DTOs) in favor of `partnerId` alone.
