/**
 * Structural placeholder, same as the legacy (finance.html: "Coming soon",
 * no logic ever implemented — see docs/LEGACY_FEATURES.md §"finance.html").
 * Unlike Invoicing's Driver log/History tabs, there's no documented intended
 * scope to build toward here; this closes out the page inventory in
 * docs/FRONTEND_PLAN.md, nothing more.
 */
export function FinancePage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Finance</h1>
      <p className="text-muted-foreground text-sm">Coming soon.</p>
    </div>
  )
}
