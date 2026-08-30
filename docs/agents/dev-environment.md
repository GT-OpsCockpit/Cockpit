# Dev environment gotchas

Non-obvious pitfalls this repo's dev/QA sessions have already hit. Read
before debugging something that looks like a real bug but might be one of
these instead.

## Regenerating after a schema/contract change

- **After an API DTO/controller change**: regenerate the frontend's typed
  client — `pnpm --filter @cockpit/web api:generate` (API must be up on
  `:3000`). If the frontend then says `does not provide an export named …`,
  that's a stale Vite cache: `docker compose restart web`.
- **After a Prisma schema change**:
  `docker compose exec -w /app/apps/api api npx prisma generate`, then
  `docker compose restart api` — the `generated` folder isn't bind-mounted.
- **After an `apps/web/package.json` change**: `docker compose up --build web`
  — `node_modules` isn't bind-mounted, a plain restart won't pick it up.

## Formatting and typechecking

- **Never run Prettier on `apps/web`.** There's no config there; default
  values reformat the entire file and bury the real diff. Match the
  surrounding file's style by hand instead.
- **`apps/web` typecheck needs `-p tsconfig.app.json`.** Bare
  `pnpm exec tsc --noEmit` silently checks nothing in this package — always
  pass the `-p` flag. See `docs/agents/testing.md` for the full verify suite.

## UI gotchas

- **Cascading Radix `<Select>`s need a `key` prop on the downstream select,
  derived from the upstream field(s).** A `<Select>` only shows/commits a
  value for a `<SelectItem>` it has already rendered — `form.setValue()` /
  `form.reset()` alone don't force a remount when the option list changes
  within the same render, so a value can silently stay blank. Fix: a `key`
  derived from the upstream selection so React remounts the downstream
  select cleanly on each transition (see the Category→Make→Model cascade in
  `apps/web/src/features/vehicles/`).
- Always add the actual missing shadcn component (`pnpm dlx shadcn@latest
  add …`) rather than a native `<select>`/`<input>` fallback when a design
  needs something shadcn doesn't have yet in `components/ui/` — don't ask,
  just add it.

## Browser-automation (chrome-devtools MCP) gotchas

- **`fill` doesn't work on `<input type="date">` / `type="time">`.** The
  value shows, then silently clears on the next render or on blur, and the
  field then fails validation. Use `evaluate_script`: grab the native
  `HTMLInputElement.prototype.value` setter, call it, then dispatch `input`
  and `change` (`bubbles: true`) and `blur()`.
- **Radix `role="tab"` toggles don't respond to a synthetic `.click()`.**
  The tab stays selected and nothing changes — which looks exactly like a
  broken filter. Use a real browser click on this kind of control, not a
  scripted one.
- **v2 and the legacy both name their session cookie `session`, and cookies
  ignore port.** Opening both on `localhost` in the same browser context
  stomps whichever session was there first (either direction). Open the
  legacy in an isolated context (`new_page … isolatedContext`) when
  comparing the two live.
- **"browser is already running for … chrome-profile"**: a leftover
  automation Chrome from a previous session. Find and kill it —
  `ps aux | grep chrome-devtools-mcp/chrome-profile`, kill the parent
  process (it's automation state, not Romain's own browser) — then retry.
- The `No HydrateFallback element provided…` console warning fires on every
  navigation in dev. Known noise, not a bug to report — but don't let it
  become an excuse to skim past *other* console messages.

## Legacy comparison (`suivi-chauffeur-twilio`)

- **Never modify the legacy.** It's the read-only reference — no commits,
  no fixes, no new files in `../Cockpit/suivi-chauffeur-twilio/`.
- **No persistence.** `trips`/`clients` are in-memory `Map`s
  (`server.js:343-344`) — every restart starts empty. Don't look for a seed;
  recreate by hand whatever's needed to see a conditional control.
- **Listens on `3000` by default**, same as the v2 API. Always launch with
  `PORT=4100`, or one of the two servers won't start and you'll end up
  comparing v2 against itself.
- Some legacy pages sit behind `requireAuthPage` — an apparently-empty or
  missing screen usually means you're not logged in **on port 4100**
  specifically (a separate session from v2's).
- Legacy source-of-truth for behavior questions: `server.js` (2736 lines),
  `public/common.js` (4474 lines, all the client-side business logic), the
  14 `public/*.html` pages. **The legacy's own comments have been found
  wrong at least three times** (vehicle↔driver "editable" link that isn't;
  invoicing default period claimed as "current month," is actually the
  previous one; driver ref format `FR-INT-001` in a comment vs. `FR•INT•1`
  in the code) — verify against the code, not the comment, when the two
  disagree.

## Dev database

- The dev seed's Company record has 11 fields literally set to `À
  RESAISIR` — real data Romain hasn't entered yet. Don't invent values for
  them, don't "fix" them, and don't count their presence as a product bug.
- Phone numbers are stored E.164-only (`+33612345678`), enforced by
  `<PhoneInput>` and `@IsPhone` (`isValidPhone` in `@cockpit/shared`) — the
  legacy stored `0612345678` and `33612345678` as different-looking values
  for the same number. If a bulk import ever needs to backfill pre-existing
  non-E.164 phone data, `pnpm --filter @cockpit/api backfill:phones
  -- --merge-duplicates` handles the case where two records collide onto the
  same normalized number (it stops and lists the refs rather than silently
  merging — that's a business decision, not a migration step). `--dry-run`
  detects collisions from the *planned* values, not what's currently in the
  DB.
