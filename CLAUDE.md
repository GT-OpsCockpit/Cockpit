## First-time setup

This repo declares the `mattpocock-skills` and `context7` plugins in `.claude/settings.json`. The marketplace registers itself automatically once you trust this folder, but Claude Code can't auto-install an external plugin — run these once:

```
claude plugin install mattpocock-skills@claude-plugins-official
claude plugin install context7@claude-plugins-official
```

After that both are enabled for good; no need to repeat it. (A `SessionStart` hook already reminds you of this automatically if either is missing — see `.claude/hooks/check-required-plugins.sh`.)

## Documentation lookups (mandatory)

**For any request that involves writing, modifying, or debugging code against a library, framework, SDK, API, or CLI tool** (adding a dependency, calling an unfamiliar method, configuring a tool, fixing a type/version error, anything implementation-shaped) — **you must query context7 (`resolve-library-id` then `query-docs`) before or while writing the code**, not only when unsure. Training data can be stale or wrong on API shape and version-specific behavior; context7 pulls the current, real docs. This applies whether the request is phrased technically or in plain language (e.g. "add a way to send emails", "why isn't this Prisma query working").

Do this even for libraries you're confident about — the point is to verify against source, not to fill a gap in knowledge.

## Working with a non-technical collaborator

Several of the `mattpocock-skills` engineering skills (`implement`, `to-tickets`, `to-spec`, `triage`, `wayfinder`, and others) are deliberately **not** auto-invoked by the model — they require someone to type the exact slash command (e.g. `/implement`). This is intentional upstream, since these skills take real actions (creating GitHub issues, closing tickets, etc.) and shouldn't fire on a guess.

If the person you're working with doesn't know these commands exist, don't expect them to type one. Instead: when their plain-language request matches one of these skills' purpose, tell them in one short sentence which command to run (so they can copy-paste it), rather than assuming they know the ecosystem. Never invoke a user-invoked skill on their behalf without them explicitly typing or pasting the command themselves.

**Exception — feature requests:** when a non-technical collaborator asks in plain language to add a feature or change behavior (not a bugfix/typo), that's the `feature-request` skill's job (see `.claude/skills/feature-request/SKILL.md`), and it auto-triggers by design — unlike the mattpocock-skills ones above, it doesn't take irreversible actions on its own, it gates on their explicit confirmation at each stage before any code is written. Don't route these requests to `/implement` or similar directly; let the gate run first.

**Branches, when the collaborator isn't Romain:** every feature goes on its own branch + PR (see Coding rules below) — but a non-technical collaborator hasn't been told why, and may expect the change to just happen the way it used to (direct to `main`). The first time this comes up with them, explain briefly in plain language: the branch is a safe copy to work in, and the PR is the point where Romain reviews the change before it becomes part of what's actually running — it's not extra process for its own sake, it's what keeps an unreviewed change from reaching production by accident.

## Coding rules

- **Fix bugs immediately, no TODOs.** If you find a bug — even pre-existing, even out of scope for the current task — fix it now. A "TODO: fix later" never gets fixed; don't leave one.
- **DRY: reuse existing code first.** Before writing new logic, look for an existing utility, service, or pattern in the codebase that already does it (or close to it) and reuse/extend it rather than duplicating.
- **KISS: match the project's style.** Write the simplest code that solves the problem and fits how this codebase already does things — no premature abstraction, no cleverness the surrounding code doesn't already use.
- **No dead code.** After implementing a change, check whether anything (old code, now-unused helpers, flags, imports) is still referenced. Remove what isn't essential — don't let unused code accumulate.
- **Follow framework best practices — don't reinvent them.** Use the idiomatic, documented way a framework/library expects (see the context7 lookup rule above); don't hand-roll a mechanism the framework already provides.
- **No dead or deprecated tests — front, back, or Playwright.** A skipped test is a bug, not a to-do; a test weakened to dodge a failure instead of catching it gets the same treatment. When you touch a test file, leave every test in it either passing-and-real or deleted-with-a-reason. Full method and the exact "no dead tests" bar: `docs/agents/testing.md`.
- **Red-first, by sabotage, whenever you write or change a test.** Sabotage the implementation, confirm the sabotage actually applied, watch the right assertions fail, restore, confirm green. A red-first check reporting zero failures means the check is broken, not the code. Details: `docs/agents/testing.md`.
- **One branch per feature, opened as a PR — never commit straight to `main`.** (Changed 2026-08-30; earlier commits/docs in this repo's history say the opposite — that convention is retired, don't follow it.) Branch name: short, kebab-case, matching the feature. Open the PR as soon as the branch has a coherent commit, even for a small change — the PR is the review point before anything reaches `main`.
- **Prefer the actual shadcn component over a native fallback.** If a design needs something `components/ui/` doesn't have yet, add it (`pnpm dlx shadcn@latest add …`) rather than reaching for a bare `<select>`/`<input>` — don't ask, just add it.

## Agent skills

### Issue tracker

Issues are tracked in GitHub (GT-OpsCockpit/Cockpit), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context layout — a root `CONTEXT-MAP.md` points to per-context `CONTEXT.md` files under `apps/api`, `apps/web`, and `packages/shared`. See `docs/agents/domain.md`.

### Permissions

Role-based permission system (`apps/api` + `apps/web`), replacing the legacy's password-prompt gate. Read `docs/agents/permissions.md` before adding any new "Admin only" behavior, or before touching anything under `apps/api/src/common/permissions/`.

### Testing

The full verify suite, the red-first/sabotage method, and the no-dead-tests bar: `docs/agents/testing.md`.

### Dev environment gotchas

Non-obvious pitfalls already hit in this repo (regen steps after a schema/DTO change, browser-automation quirks, legacy-comparison traps, dev-seed caveats): `docs/agents/dev-environment.md`.

### Legacy parity

`docs/LEGACY_PARITY_AUDIT.md` is the live reference for every legacy-vs-v2 business-logic difference — what's a regression (fix it), what's an assumed/documented gap, and what's a deliberate modernization. Check it before treating a behavior difference from `suivi-chauffeur-twilio` as a bug.
