/** Whole-euro formatting with thousand separators, for aggregated totals —
 * distinct from the per-trip `X.XX €` convention used on booking rows
 * (invoiced-table.tsx, pending-trips-table.tsx): cents are noise once
 * amounts are in the thousands, and a bare `toFixed` on a period total would
 * read as "48200.00 €" instead of "48,200 €". */
export function formatMoney(amount: number): string {
  return `${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })} €`
}

/** Signed percentage change from `previous` to `current`, e.g. "+12%" /
 * "−8%" / "n/a" when there's nothing to compare against (previous is 0). */
export function formatDelta(current: number, previous: number | undefined): string {
  if (previous === undefined) return ''
  if (previous === 0) return current > 0 ? 'new' : '–'
  const pct = ((current - previous) / previous) * 100
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${Math.abs(pct).toFixed(0)}%`
}
