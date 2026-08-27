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

## Coding rules

- **Fix bugs immediately, no TODOs.** If you find a bug — even pre-existing, even out of scope for the current task — fix it now. A "TODO: fix later" never gets fixed; don't leave one.
- **DRY: reuse existing code first.** Before writing new logic, look for an existing utility, service, or pattern in the codebase that already does it (or close to it) and reuse/extend it rather than duplicating.
- **KISS: match the project's style.** Write the simplest code that solves the problem and fits how this codebase already does things — no premature abstraction, no cleverness the surrounding code doesn't already use.
- **No dead code.** After implementing a change, check whether anything (old code, now-unused helpers, flags, imports) is still referenced. Remove what isn't essential — don't let unused code accumulate.
- **Follow framework best practices — don't reinvent them.** Use the idiomatic, documented way a framework/library expects (see the context7 lookup rule above); don't hand-roll a mechanism the framework already provides.

## Agent skills

### Issue tracker

Issues are tracked in GitHub (GT-OpsCockpit/Cockpit), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context layout — a root `CONTEXT-MAP.md` points to per-context `CONTEXT.md` files under `apps/api`, `apps/web`, and `packages/shared`. See `docs/agents/domain.md`.

### Permissions

Role-based permission system (`apps/api` + `apps/web`), replacing the legacy's password-prompt gate. Read `docs/agents/permissions.md` before adding any new "Admin only" behavior, or before touching anything under `apps/api/src/common/permissions/`.
