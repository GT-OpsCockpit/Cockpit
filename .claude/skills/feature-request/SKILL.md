---
name: feature-request
description: Mandatory gated workflow for any plain-language request from a non-technical collaborator to add a new feature or change existing behavior in Cockpit v2 (e.g. "j'aimerais qu'on puisse...", "est-ce qu'on peut ajouter...", "peux-tu faire en sorte que...", "I want users to be able to...", "ce serait bien si..."). Unlike the mattpocock-skills engineering skills, this one auto-triggers — it does not wait for a slash command, because the person asking won't know one exists. Do NOT trigger for bugfixes, typos, copy/content tweaks, or a request that already arrives as a full written spec where the person explicitly says to skip straight to implementation.
---

# Feature request gate

A non-technical collaborator is going to describe what they want in plain
language, possibly vaguely. Never jump straight to code. Walk through every
stage below in order, and do not skip a stage silently — if a stage doesn't
apply (no UI involved), say so explicitly and move on.

## 1. Cadrage (plan)

Reformulate the request in plain, jargon-free language:
- the problem it solves and for whom
- the expected outcome / what "done" looks like
- scope (what's included) and explicit out-of-scope (what's *not* included)
- assumptions you're making
- open questions

Present this back to them and ask them to confirm or correct it. Do not
proceed to stage 2 until they've explicitly confirmed the plan is right —
"ça a l'air bien" / "oui" / a correction counts, silence does not.

## 2. Maquette (only if the feature touches UI/UX)

If the request implies a new screen, new component, or a changed layout/flow,
build a quick, static HTML mockup — structure and visual only, no real data
or logic wired up. Publish it with the Artifact tool so they get a clickable
link (no local file, no dev server needed on their end).

If the feature is pure backend/logic with no visible UI impact, skip this
stage and say so explicitly instead of silently omitting it.

## 3. Challenge UX

Don't just present the mockup — critique it out loud, the way a designer
would push back in a review:
- call out anything that could confuse a user, a missing empty/error/loading
  state, an edge case, a mobile-width concern
- when there's a real choice (e.g. modal vs. inline panel, button vs. toggle,
  where a field lives), propose the alternatives and use AskUserQuestion so
  they can just pick, rather than asking an open-ended question they have to
  type an answer to
- if you'd genuinely make a different UX choice than what they described,
  say so and why, don't just build what was asked without comment

## 4. Validation gate

Every open question and every UX choice raised in stages 1–3 must be
explicitly answered by them before stage 5. If they try to skip ahead
("just build it"), push back once by summarizing what's still unresolved and
asking them to confirm they want to skip it anyway. If they still insist,
respect that — don't loop — but record in the doc (stage 5) which points
were explicitly skipped at their request, so it's traceable later.

## 5. Write the doc

Write the validated outcome to `docs/feature-requests/<slug>.md` (kebab-case
slug from the feature name). This file is the source of truth handed to
implementation — include:
- the plan from stage 1 (goal, scope, out-of-scope, decisions)
- the design section: UX choices made and why, a link to the mockup artifact
  if stage 2 ran, alternatives that were considered and rejected
- anything explicitly skipped per stage 4, and by whose call

## 6. Implement

Only now start implementation, following the doc. If something in the doc
turns out to be wrong or infeasible once you're in the code, stop and go
back to them instead of silently deviating from what was validated.
