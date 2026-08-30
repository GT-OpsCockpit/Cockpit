# Testing

How this repo verifies a change, and what "the tests are fine" is required to mean.

## The verify suite

Run all seven, in this order, every time — none of them stands in for another:

```bash
cd apps/api && pnpm exec tsc --noEmit -p tsconfig.json
cd apps/api && pnpm exec eslint "src/**/*.ts" "test/**/*.ts"
cd apps/api && pnpm exec jest
cd apps/api && pnpm test:e2e
cd apps/web && pnpm exec tsc --noEmit -p tsconfig.app.json   # -p is mandatory — bare `tsc --noEmit` checks nothing here
cd apps/web && pnpm exec vitest run
cd apps/web && pnpm exec playwright test
```

**Never trust a stale "it's green."** Twice in this repo's history a suite
was reported green and had gone red since (a rebuild, a schema change, a
fixture drift) — one blocked the *entire* e2e web suite from running at all,
unnoticed for a day. Re-run the suite yourself before reporting a state; a
claim you didn't just verify is a guess, not a result.

## Red-first, by sabotage — the standing method

When you write or modify a test, prove it can fail before you trust that it
can catch anything:

1. Write the test against the real, correct behavior.
2. **Sabotage the implementation it covers** — revert the fix, break the
   invariant, whatever makes the behavior wrong again.
3. Verify the sabotage actually applied (re-read the diff, don't assume).
4. Run the test. Watch which assertions fail. If none do, the test asserts
   nothing real — strengthen it, it isn't done.
5. Restore the implementation, confirm green.

Marker to read for the actual failure, not just the run's exit code:
**Jest prints `●` next to a failing test, Vitest prints `✕`.** A red-first
check that reports "0 failures everywhere" against a sabotaged
implementation didn't fail — its parser did. That's a broken check, not a
passing one.

A concrete example of what this method catches that a passing suite alone
won't: three Playwright specs once asserted on a toast with `.first()` and
a comment claiming "the toast renders twice by design." That's a test
rewritten to dodge a real duplicate-mount bug rather than catch it — sabotage
would have shown 0 assertions moving. Fixed by asserting exactly one node
and removing the double-mount.

## No dead or deprecated tests — front, back, or Playwright

A test that no longer asserts anything real is a liability, not neutral
weight: it costs runtime, and its presence in a green suite implies coverage
that doesn't exist. Concretely:

- **A skipped test (`.skip()`, `xit`, `it.todo`) is a bug, not a to-do.**
  Fix it or delete it in the same change — don't leave a disabled test as a
  placeholder for later; later never comes and the suite quietly rots.
- **Test rewritten to dodge a bug rather than catch it** (loosened matcher,
  weakened assertion, `.first()`/`.last()` masking a duplicate, a comment
  explaining away a symptom instead of fixing it) — treat this the same as
  a skip. Fix the product, tighten the test back.
- **Red because the product changed underneath it, and the product is
  right** — the test is wrong, rewrite it against the new correct behavior,
  and say in the commit why the expected behavior changed.
- **Covers something that no longer exists, or duplicates another test
  exactly** — delete it, and say which test superseded it. A test that
  never asserted anything real when you look closely counts as this too.
- Apply this continuously, not just during a dedicated QA pass: any session
  that touches a test file is responsible for leaving it in one of the
  states above, never in "disabled and forgotten."

## Environment gotchas that affect test runs

See `docs/agents/dev-environment.md` for tooling/environment pitfalls
(regen steps, browser-automation quirks, etc.) that show up while running
or writing tests but aren't about test-writing discipline itself.
