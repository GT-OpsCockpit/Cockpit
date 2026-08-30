# ADR-0003 — Pricing stays in EUR, the legacy's raw multi-currency storage does not return

- **Status**: accepted
- **Date**: 2026-08-28
- **Scope**: system-wide (`apps/api` trips/invoices, `packages/shared/src/business/pricing.js`)

## Context

The legacy stored `priceEur` (retail) in the retail currency and the partner
rate in the partner's country currency, both raw, no conversion, no currency
column. `docs/LEGACY_PARITY_AUDIT.md` §7.1 documents this as a real behavior
difference from v2, which stores and totals everything in EUR — raised
explicitly during the 2026-08-28 parity audit as a candidate for "restore
legacy fidelity."

## Decision

**It does not come back.** The legacy's behavior was a bug, not a business
rule: it summed retail and partner amounts from different currencies into
one `totalHT` on an invoice. Outside the euro zone that produces a financial
document with a wrong total — not a stylistic difference, an incorrect
invoice.

v2 keeps all monetary amounts in EUR. `vatRate` is a real, non-hardcoded
field — deliberately kept that way to prepare for future VAT-compliance work
(legal invoice numbering, mandatory mentions, accounting export — explicitly
out of scope for v1) — but currency handling itself is settled: one
currency, no per-record currency field, no conversion step.

## Consequences

- Do not reintroduce a currency field on `Trip`/`Invoice`/pricing inputs to
  "match the legacy" — that would resurrect the exact bug this ADR closes.
- The margin formula's `/1.1` divisor is about VAT, not currency — it stays
  unchanged under this decision.
- If real multi-currency support is ever required (a genuine new market
  need, not a fidelity request), it needs actual FX conversion to a
  reporting currency at write time, not raw storage of mixed-currency
  amounts — that's a new design, not a revert of this one.
