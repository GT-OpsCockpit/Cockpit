# Permissions

Cockpit v2's replacement for the legacy's `promptAdminPassword` gate: a role-based
permission system spanning `apps/api` and `apps/web`, added 2026-08-27. Read this
before adding any new "only an Admin can do X" behavior — the primitives here
are meant to make that a two-line change, not a new mechanism.

## The model, in one paragraph

Every user has exactly one `Role` (`ADMIN` | `DISPATCHER`, from the Prisma
schema). A fixed, hardcoded map in `apps/api/src/common/permissions/permissions.ts`
says which roles hold which **named permissions** (`trip:cancel`,
`trip:edit-past`, ...). The backend is the only thing that ever evaluates that
map. The frontend never re-derives "does this role have this permission" —
`GET /auth/me` sends the current user's already-resolved permission list, and
the frontend just checks whether a name is in it. There is no re-authentication
step (no "type your password again to confirm") — a logged-in session's role
is trusted outright, unlike the legacy's `promptAdminPassword`/`ADMIN_PASSWORD`
shared-secret gate, which existed only because the legacy had one shared login
account for the whole app. Cockpit v2 has real per-user accounts, so the role
already on the session is a stronger signal than a re-typed password ever was.

## Where things live

- **`apps/api/src/common/permissions/permissions.ts`** — the single source of
  truth. `PERMISSIONS: Record<Permission, Role[]>`, plus:
  - `can(user, permission)` — the one function to call for a permission check,
    anywhere.
  - `roleHasPermission(role, permission)` — what `can()` wraps; use directly
    only where you have a bare `Role` and no user object.
  - `permissionsForRole(role)` — every permission a role currently holds; this
    is what `GET /auth/me` sends the frontend.
- **`apps/api/src/common/decorators/require-permission.decorator.ts`** +
  **`apps/api/src/common/guards/permissions.guard.ts`** — route-level
  enforcement for a gate that applies unconditionally to every caller of a
  route. `PermissionsGuard` is registered globally (`apps/api/src/auth/auth.module.ts`),
  same as `SessionAuthGuard` — no per-module wiring needed.
- **`apps/web/src/features/auth/use-permission.ts`** — `usePermission(name)`,
  the frontend read side. Purely a UX layer (hide/disable a control before the
  user hits a 403) — never the actual enforcement.
- **`apps/api/src/auth/dto/auth.entity.ts`** (`AuthMeEntity.permissions`) — the
  wire format. Regenerate the frontend's typed client (`pnpm --filter web
  api:generate`, API dev server up) after adding a permission so
  `AuthMeEntityPermissionsItem` (the generated literal-union type) picks it up.

## How to gate a new action

**Unconditional** (every caller needs the permission, full stop — e.g.
`trip:cancel`): add the permission to `PERMISSIONS`, then
`@RequirePermission('your:permission')` on the controller (method or whole
class — see `UsersController`/`CompanyController` for class-level examples,
`TripsController.cancelAssignment` for a method-level one).

**Conditional** (only sometimes, depending on the request body or existing DB
state — e.g. "only if this trip's pickup already passed"): don't use the
decorator. Call `can(user, 'your:permission')` directly inside the service
method and `throw new ForbiddenException(...)` if it's false. See
`TripsService.update()` for the reference implementation (`trip:edit-past` /
`trip:edit-price`). The condition itself ("is this past", "did the price
change") is ordinary business logic — the permission system only ever answers
"is this role allowed", never "is this required right now".

Either way, mirror the check on the frontend with `usePermission()` so the
control is disabled/hidden before the user tries (see
`apps/web/src/features/bookings/booking-edit-dialog.tsx`) — this is UX only,
the backend enforces independently regardless of what the frontend shows.

## Adding a role or reshaping who gets what

Change `PERMISSIONS` in `permissions.ts`. Nothing else — no call site, no
guard, no frontend code — needs to change. If a role list ever needs to grow
beyond `ADMIN`/`DISPATCHER`, add the value to the `Role` enum in
`apps/api/prisma/schema.prisma` (migration required) and extend `PERMISSIONS`;
everything downstream (guards, `can()`, `GET /auth/me`, `usePermission()`)
keeps working unchanged.

Permission-to-role mapping is intentionally **not** stored in the database or
editable through a UI — it's source code, reviewed like any other logic
change. Which role a given *user* holds, on the other hand, is a normal `User.role`
DB column, editable through `PUT /api/users/:id` (`user:manage`) like any
other user field.

## Legacy fidelity: what was ported, what wasn't (yet)

The legacy gated a lot more than Bookings — but only Bookings has a v2
frontend today (2026-08-27). Everything else below is deliberately **not**
wired up yet; do it when the corresponding v2 feature gets built, using the
same `PERMISSIONS` map (add an entry, it likely already exists — check first).

| Legacy gate (file:line in `suivi-chauffeur-twilio/public/`) | Trigger | v2 permission | Status |
|---|---|---|---|
| `common.js:2487` — cancel a booking | always | `trip:cancel` | ✅ wired (`TripsController.cancelAssignment`) |
| `common.js:3250` — edit a booking, past pickup | pickup already passed | `trip:edit-past` | ✅ wired (`TripsService.update`) |
| `common.js:3250` — edit a booking, price change | `priceEur`/`partnerRate` changed | `trip:edit-price` | ✅ wired (`TripsService.update`) |
| `common.js:3310` — quick single-field trip update, past pickup | pickup already passed | `trip:edit-past` | ✅ wired (`TripsService.assign`, the Planning Gantt's drag&drop) — reuses `trip:edit-past` rather than a new permission, same as the full edit dialog. The other quick-popups (RegNbr/Passenger cell edits outside Planning) still weren't ported; that reassignment goes through the full edit dialog. |
| `owner.html:271`/`300` — unlock/reveal Company info | always | `company:edit` | ✅ wired (`CompanyController`, predates this doc) |
| `owner.html:435` — create an Access record with role=Admin | role selected = Admin | `user:manage` | ✅ wired, but broader than legacy: v2 requires it for creating *any* user, not just an Admin one (`UsersController`) |
| `common.js:3423` — edit a customer account | always | `client:edit` | ✅ wired (`ClientsController.update`) |
| `common.js:388` — permanent hard-delete of a record (`onPermanentDelete`) | whenever offered | `record:delete` | ✅ wired on all four routes (`DELETE /clients/:ref`, `/drivers/:ref`, `/fleet-vehicles/:ref`, `/vehicles/:ref`). One permission for all four because the legacy had one gate for all four. No v2 UI calls them yet, so there is nothing to mirror with `usePermission()` — do it when a hard-delete control is built. |
| `common.js:3596` — reactivate a deactivated driver/partner | always | *(none yet)* | ❌ not built. Suggested name: `driver:reactivate` |
| `vehicles.html:574` — reactivate a deactivated fleet vehicle | always | *(none yet)* | ❌ not built. Suggested name: `vehicle:reactivate` |
| `clients.html:474` / `events.html:439` — create an Events client / Event with a past start date | start date in the past | `client:create-past-event` | ✅ wired (`ClientsService.create`) |
| `invoicing.html:616` — "Correct" an invoice | always | *(none yet)* | ❌ not built in legacy either (`alert('to be specified next')`) — nothing to port |

Two legacy passwords collapsed into one role-based system: legacy had
`ADMIN_PASSWORD` (dashboard login + most gates, via `/api/auth/verify-password`)
and a separate `OWNER_PASSWORD` (`/api/owner/verify-password`, only the Owner
page and Events-with-past-date creation). Cockpit v2 has no equivalent split —
everything above maps to the single `ADMIN` role. If a future need genuinely
requires a permission `ADMIN` shouldn't automatically have, that's an argument
for a **new role**, not a parallel gate mechanism.

`POST /api/auth/verify-password` itself was removed (2026-08-27) — it checked
the current user's own password, which was never the legacy's mechanism (a
*shared* secret) and became pure dead code once permission checks stopped
requiring re-authentication at all (see "The model" above).

## Tests

`apps/api/test/permissions.e2e-spec.ts` covers the RBAC layer itself (both the
unconditional and conditional gates, plus `GET /auth/me`'s permission list) —
extend it, don't duplicate it, when adding a new permission. Each feature's
own e2e spec (`trips.e2e-spec.ts`, etc.) should keep using an `ADMIN` cookie
for its ordinary business-logic tests, same as before this system existed.
